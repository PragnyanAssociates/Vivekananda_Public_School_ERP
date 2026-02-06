import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  Modal,
  Pressable,
  useColorScheme,
  StatusBar,
  KeyboardAvoidingView
} from 'react-native';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { useAuth } from '../context/AuthContext';
import { SERVER_URL } from '../../apiConfig';
import apiClient from '../api/client';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import FastImage from 'react-native-fast-image';
import DateTimePicker from '@react-native-community/datetimepicker';

// --- Type Definitions ---
export interface ProfileData {
  id: number;
  username: string;
  full_name: string;
  role: 'student' | 'teacher' | 'admin' | 'others';
  class_group: string;
  dob?: string;
  gender?: string;
  phone?: string;
  address?: string;
  profile_image_url?: string;
  email?: string;

  // Student Fields
  admission_date?: string;
  roll_no?: string;
  admission_no?: string;
  parent_name?: string;
  pen_no?: string;

  // Admin / Teacher / Others Fields
  aadhar_no?: string;
  joining_date?: string;
  previous_salary?: string;
  present_salary?: string;
  experience?: string;
}

interface ProfileScreenProps {
  onBackPress?: () => void;
  staticProfileData?: ProfileData;
  onStaticSave?: (updatedData: ProfileData, newImage: Asset | null) => Promise<void>;
  onProfileUpdate?: (newProfileData: ProfileData) => void;
}

// --- Theme Constants ---
const Colors = {
  light: {
    background: '#FFFFFF',
    card: '#F8F9FA',
    textPrimary: '#2C3E50',
    textSecondary: '#8A94A6',
    border: '#EAECEF',
    accent: '#008080',
    inputBg: '#FFFFFF',
    danger: '#D32F2F',
    iconBg: 'rgba(0, 128, 128, 0.1)',
    placeholder: '#B0B7C3'
  },
  dark: {
    background: '#121212',
    card: '#1E1E1E',
    textPrimary: '#E0E0E0',
    textSecondary: '#A0A0A0',
    border: '#333333',
    accent: '#4DB6AC',
    inputBg: '#2C2C2C',
    danger: '#EF5350',
    iconBg: 'rgba(77, 182, 172, 0.15)',
    placeholder: '#555555'
  }
};

// --- Helper Functions ---

const formatDateForDisplay = (dateString?: string | null) => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
  }
  return dateString;
};

const formatDateForApi = (date: Date) => {
  try {
    // Get local date components to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    // Fallback in case of invalid date
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

const getProfileImageSource = (url?: string | null) => {
  if (!url || typeof url !== 'string') {
     return require('../assets/default_avatar.png');
  }
  if (url.startsWith('http') || url.startsWith('file')) {
    return { uri: url, priority: FastImage.priority.normal };
  }
  const fullUrl = url.startsWith('/') ? `${SERVER_URL}${url}` : `${SERVER_URL}/${url}`;
  return { uri: `${fullUrl}?t=${new Date().getTime()}`, priority: FastImage.priority.high };
};

// --- Date Parsing Utility (Fixes the Pre-1970 Issue) ---
const parseDateString = (dateString?: string): Date => {
  if (!dateString) return new Date();
  
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
    const day = parseInt(parts[2], 10);
    
    // Handle pre-1970 dates safely using UTC to avoid timezone glitching negative timestamps
    if (year < 1970) {
      const utcDate = Date.UTC(year, month, day);
      const date = new Date(utcDate);
      
      // Double check validity
      if (date.getUTCFullYear() === year && 
          date.getUTCMonth() === month && 
          date.getUTCDate() === day) {
        return date;
      }
      
      // Fallback
      const fallbackDate = new Date();
      fallbackDate.setFullYear(year);
      fallbackDate.setMonth(month);
      fallbackDate.setDate(day);
      return fallbackDate;
    }
    
    // For 1970 and later, standard constructor works fine
    return new Date(year, month, day);
  }
  
  return new Date();
};

// --- Validation Helpers ---
const sanitizeNumeric = (text: string) => text.replace(/[^0-9]/g, '');
const sanitizeName = (text: string) => text.replace(/[^a-zA-Z\s\-']/g, '');
const sanitizeGeneralText = (text: string) => text.replace(/[^a-zA-Z0-9\s.,\-\/]/g, '');
const sanitizeAddress = (text: string) => text.replace(/[^\w\s.,\-\/#]/g, '');


// --- Components ---

const DetailRow = memo(({ label, value, icon, themeColors }: { label: string; value?: string | null; icon: string, themeColors: any }) => (
  <View style={styles.detailRow}>
    <View style={[styles.iconContainer, { backgroundColor: themeColors.iconBg }]}>
      <MaterialIcons name={icon} size={20} color={themeColors.accent} />
    </View>
    <View style={styles.detailTextContainer}>
      <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: themeColors.textPrimary }]}>{value || 'N/A'}</Text>
    </View>
  </View>
));

const GenderSelectField = memo(({ value, onChange, themeColors }: { value?: string, onChange: (val: string) => void, themeColors: any }) => {
    const isMale = value?.toLowerCase() === 'male';
    const isFemale = value?.toLowerCase() === 'female';

    return (
        <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>Gender</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity
                    style={[
                        styles.genderOption,
                        {
                            backgroundColor: isMale ? themeColors.accent : themeColors.inputBg,
                            borderColor: isMale ? themeColors.accent : themeColors.border
                        }
                    ]}
                    onPress={() => onChange('Male')}
                >
                    <MaterialIcons name="male" size={20} color={isMale ? '#FFF' : themeColors.textSecondary} />
                    <Text style={[styles.genderText, { color: isMale ? '#FFF' : themeColors.textSecondary }]}>Male</Text>
                </TouchableOpacity>

                <View style={{ width: 15 }} />

                <TouchableOpacity
                    style={[
                        styles.genderOption,
                        {
                            backgroundColor: isFemale ? themeColors.accent : themeColors.inputBg,
                            borderColor: isFemale ? themeColors.accent : themeColors.border
                        }
                    ]}
                    onPress={() => onChange('Female')}
                >
                    <MaterialIcons name="female" size={20} color={isFemale ? '#FFF' : themeColors.textSecondary} />
                    <Text style={[styles.genderText, { color: isFemale ? '#FFF' : themeColors.textSecondary }]}>Female</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
});

interface EditFieldProps {
  label: string;
  value: string | undefined;
  onChange?: (text: string) => void;
  isDate?: boolean;
  onDatePress?: () => void;
  themeColors: any;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'numeric' | 'email-address' | 'phone-pad';
  maxLength?: number;
  placeholder?: string;
}

const EditField = memo(({ label, value, onChange, isDate, onDatePress, themeColors, placeholder, ...props }: EditFieldProps) => {
  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      {isDate ? (
        <TouchableOpacity
          onPress={onDatePress}
          style={[styles.textInput, {
            backgroundColor: themeColors.inputBg,
            borderColor: themeColors.border,
            justifyContent: 'center'
          }]}
        >
          <Text style={{ color: value ? themeColors.textPrimary : themeColors.placeholder, fontSize: 16 }}>
            {value ? formatDateForDisplay(value) : placeholder || 'DD/MM/YYYY'}
          </Text>
          <MaterialIcons name="event" size={20} color={themeColors.textSecondary} style={{ position: 'absolute', right: 10 }} />
        </TouchableOpacity>
      ) : (
        <TextInput
          style={[
            styles.textInput,
            props.multiline && styles.multilineInput,
            {
              backgroundColor: themeColors.inputBg,
              borderColor: themeColors.border,
              color: themeColors.textPrimary
            }
          ]}
          value={value || ''}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={themeColors.placeholder}
          {...props}
        />
      )}
    </View>
  );
});

const DisplayProfileView = memo(({ userProfile, onEditPress, themeColors }: { userProfile: ProfileData, onEditPress: () => void, themeColors: any }) => {
  const profileImageSource = getProfileImageSource(userProfile.profile_image_url);
  const [isViewerVisible, setViewerVisible] = useState(false);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <Modal
        visible={isViewerVisible}
        transparent={true}
        onRequestClose={() => setViewerVisible(false)}
        animationType="fade"
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setViewerVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <FastImage
              source={profileImageSource}
              style={styles.enlargedProfileImage}
              resizeMode={FastImage.resizeMode.contain}
            />
            <TouchableOpacity style={[styles.closeButton, { backgroundColor: themeColors.card }]} onPress={() => setViewerVisible(false)}>
              <Text style={[styles.closeButtonText, { color: themeColors.textPrimary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Animatable.View animation="zoomIn" duration={500} delay={100} style={styles.profileHeader}>
          <TouchableOpacity onPress={() => setViewerVisible(true)}>
            <FastImage
              source={profileImageSource}
              style={[styles.profileImage, { borderColor: themeColors.card, backgroundColor: themeColors.border }]}
              resizeMode={FastImage.resizeMode.cover}
            />
          </TouchableOpacity>
          <Text style={[styles.profileName, { color: themeColors.textPrimary }]}>{userProfile.full_name}</Text>
          <Text style={[styles.profileRole, { color: themeColors.textSecondary }]}>
            {userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)}
          </Text>
          <TouchableOpacity onPress={onEditPress} style={[styles.editProfileButton, { backgroundColor: themeColors.iconBg }]}>
            <MaterialIcons name="edit" size={16} color={themeColors.accent} />
            <Text style={[styles.editProfileButtonText, { color: themeColors.accent }]}>Edit Profile</Text>
          </TouchableOpacity>
        </Animatable.View>

        <Animatable.View animation="fadeInUp" duration={500} delay={200} style={[styles.detailsCard, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.cardTitle, { color: themeColors.accent, borderColor: themeColors.border }]}>Personal Information</Text>
          <DetailRow label="User ID" value={userProfile.username} icon="badge" themeColors={themeColors} />
          <DetailRow label="Date of Birth" value={formatDateForDisplay(userProfile.dob)} icon="cake" themeColors={themeColors} />
          <DetailRow label="Gender" value={userProfile.gender} icon="wc" themeColors={themeColors} />
        </Animatable.View>

        <Animatable.View animation="fadeInUp" duration={500} delay={300} style={[styles.detailsCard, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.cardTitle, { color: themeColors.accent, borderColor: themeColors.border }]}>Contact Information</Text>
          <DetailRow label="Email" value={userProfile.email} icon="email" themeColors={themeColors} />
          <DetailRow label="Phone" value={userProfile.phone} icon="phone" themeColors={themeColors} />
          <DetailRow label="Address" value={userProfile.address} icon="home" themeColors={themeColors} />
        </Animatable.View>

        {userProfile.role === 'student' ? (
          <Animatable.View animation="fadeInUp" duration={500} delay={400} style={[styles.detailsCard, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.cardTitle, { color: themeColors.accent, borderColor: themeColors.border }]}>Academic Details</Text>
            <DetailRow label="Class" value={userProfile.class_group} icon="class" themeColors={themeColors} />
            <DetailRow label="Roll No." value={userProfile.roll_no} icon="assignment-ind" themeColors={themeColors} />
            <DetailRow label="Admission No." value={userProfile.admission_no} icon="person-add" themeColors={themeColors} />
            <DetailRow label="Parent Name" value={userProfile.parent_name} icon="people" themeColors={themeColors} />
            <DetailRow label="Aadhar No." value={userProfile.aadhar_no} icon="fingerprint" themeColors={themeColors} />
            <DetailRow label="PEN No." value={userProfile.pen_no} icon="description" themeColors={themeColors} />
            <DetailRow label="Admission Date" value={formatDateForDisplay(userProfile.admission_date)} icon="event" themeColors={themeColors} />
          </Animatable.View>
        ) : (
          <Animatable.View animation="fadeInUp" duration={500} delay={400} style={[styles.detailsCard, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.cardTitle, { color: themeColors.accent, borderColor: themeColors.border }]}>Professional Details</Text>
            <DetailRow label="Aadhar No." value={userProfile.aadhar_no} icon="fingerprint" themeColors={themeColors} />
            <DetailRow label="Joining Date" value={formatDateForDisplay(userProfile.joining_date)} icon="event-available" themeColors={themeColors} />
            <DetailRow label="Previous Salary" value={userProfile.previous_salary} icon="money-off" themeColors={themeColors} />
            <DetailRow label="Present Salary" value={userProfile.present_salary} icon="attach-money" themeColors={themeColors} />
            <DetailRow label="Experience" value={userProfile.experience} icon="work" themeColors={themeColors} />
          </Animatable.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
});

const EditProfileView = memo(({ userProfile, onSave, onCancel, isSaving, themeColors }: { userProfile: ProfileData, onSave: (data: ProfileData, newImage: Asset | null) => void, onCancel: () => void, isSaving: boolean, themeColors: any }) => {
  const [editedData, setEditedData] = useState(userProfile);
  const [newImage, setNewImage] = useState<Asset | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  // Important: This state holds the 'Date' object for the picker
  const [pickerDate, setPickerDate] = useState(new Date()); 
  const [datePickerField, setDatePickerField] = useState<keyof ProfileData | null>(null);

  const requestGalleryPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const permission = Platform.Version >= 33
            ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
            : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

        const granted = await PermissionsAndroid.request(permission, {
          title: 'Gallery Access Permission',
          message: 'App needs access to your gallery to select a profile picture.',
          buttonPositive: 'OK'
        });
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        return false;
      }
    }
    return true;
  }, []);

  const handleChoosePhoto = useCallback(async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Please grant gallery access in your device settings.');
      return;
    }
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.7 });
      if (result.assets && result.assets.length > 0) {
        const imageAsset = result.assets[0];
        setNewImage(imageAsset);
        setEditedData(prev => ({ ...prev, profile_image_url: imageAsset.uri }));
      }
    } catch (error) { console.error('Image picker error:', error); }
  }, [requestGalleryPermission]);

  const handleRemovePhoto = useCallback(() => {
    setNewImage(null);
    setEditedData(prev => ({ ...prev, profile_image_url: undefined }));
  }, []);

  const handleTextChange = useCallback((field: keyof ProfileData, value: string, type: 'numeric' | 'alpha' | 'general' | 'address') => {
    let cleanedValue = value;
    switch (type) {
      case 'numeric': cleanedValue = sanitizeNumeric(value); break;
      case 'alpha': cleanedValue = sanitizeName(value); break;
      case 'address': cleanedValue = sanitizeAddress(value); break;
      case 'general': default: cleanedValue = sanitizeGeneralText(value); break;
    }
    setEditedData(prev => ({ ...prev, [field]: cleanedValue }));
  }, []);

  // --- UPDATED DATE LOGIC ---
  const openDatePicker = (field: keyof ProfileData) => {
    const currentDateString = editedData[field];
    // Use the robust parser that handles pre-1970 dates correctly
    const targetDate = parseDateString(currentDateString);
    
    setPickerDate(targetDate);
    setDatePickerField(field);
    setShowDatePicker(true);
  };

  const handleDateConfirm = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    
    if (event.type === 'dismissed') {
        setDatePickerField(null);
        return;
    }
    
    if (selectedDate && datePickerField) {
      const formattedDate = formatDateForApi(selectedDate);
      setEditedData(prev => ({ ...prev, [datePickerField]: formattedDate }));
    }
    setDatePickerField(null);
  };

  const handleSaveChanges = () => {
    onSave(editedData, newImage);
  };

  const imageSource = getProfileImageSource(editedData.profile_image_url);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.profileHeader}>
            <FastImage source={imageSource} style={[styles.profileImage, { borderColor: themeColors.card, backgroundColor: themeColors.border }]} resizeMode={FastImage.resizeMode.cover} />
            <View style={styles.imageActionsContainer}>
                <TouchableOpacity onPress={handleChoosePhoto} style={[styles.changeImageButton, { backgroundColor: themeColors.iconBg }]}>
                  <MaterialIcons name="photo-camera" size={16} color={themeColors.accent} style={{ marginRight: 8 }} />
                  <Text style={[styles.changeImageButtonText, { color: themeColors.accent }]}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleRemovePhoto} style={styles.removeImageButton}>
                  <MaterialIcons name="delete" size={16} color={themeColors.danger} style={{ marginRight: 8 }} />
                  <Text style={[styles.removeImageButtonText, { color: themeColors.danger }]}>Remove</Text>
                </TouchableOpacity>
            </View>
          </View>

          {/* Editable Fields with Placeholders */}
          <EditField
            label="Full Name"
            value={editedData.full_name}
            onChange={text => handleTextChange('full_name', text, 'alpha')}
            themeColors={themeColors}
            placeholder="e.g. John Doe"
          />
          <EditField
            label="Email"
            value={editedData.email}
            onChange={text => handleTextChange('email', text, 'general')}
            keyboardType="email-address"
            themeColors={themeColors}
            placeholder="e.g. john.doe@example.com"
          />
          <EditField
            label="Phone"
            value={editedData.phone}
            onChange={text => handleTextChange('phone', text, 'numeric')}
            keyboardType="phone-pad"
            maxLength={10}
            themeColors={themeColors}
            placeholder="e.g. 9876543210"
          />
          <EditField
            label="Address"
            value={editedData.address}
            onChange={text => handleTextChange('address', text, 'address')}
            multiline
            themeColors={themeColors}
            placeholder="e.g. #123, Main Street, City"
          />

          <EditField
            label="Date of Birth"
            value={editedData.dob}
            isDate={true}
            onDatePress={() => openDatePicker('dob')}
            themeColors={themeColors}
            placeholder="Select Date of Birth"
          />

          {/* GENDER SELECTOR */}
          <GenderSelectField
            value={editedData.gender}
            onChange={(val) => setEditedData(prev => ({ ...prev, gender: val }))}
            themeColors={themeColors}
          />

          {userProfile.role === 'student' ? (
            <>
              <EditField
                label="Class / Group"
                value={editedData.class_group}
                onChange={text => handleTextChange('class_group', text, 'general')}
                themeColors={themeColors}
                placeholder="e.g. 10-A"
              />
              <EditField
                label="Roll No."
                value={editedData.roll_no}
                onChange={text => handleTextChange('roll_no', text, 'numeric')}
                keyboardType="numeric"
                themeColors={themeColors}
                placeholder="e.g. 12"
              />
              <EditField
                label="Admission No."
                value={editedData.admission_no}
                onChange={text => handleTextChange('admission_no', text, 'numeric')}
                keyboardType="numeric"
                themeColors={themeColors}
                placeholder="e.g. 4025"
              />
              <EditField
                label="Parent Name"
                value={editedData.parent_name}
                onChange={text => handleTextChange('parent_name', text, 'alpha')}
                themeColors={themeColors}
                placeholder="e.g. Robert Doe"
              />
              <EditField
                label="Aadhar No."
                value={editedData.aadhar_no}
                onChange={text => handleTextChange('aadhar_no', text, 'numeric')}
                keyboardType="numeric"
                maxLength={12}
                themeColors={themeColors}
                placeholder="e.g. 1234 5678 9012"
              />
              <EditField
                label="PEN No."
                value={editedData.pen_no}
                onChange={text => handleTextChange('pen_no', text, 'numeric')}
                keyboardType="numeric"
                themeColors={themeColors}
                placeholder="e.g. 11223344"
              />
              <EditField
                label="Admission Date"
                value={editedData.admission_date}
                isDate={true}
                onDatePress={() => openDatePicker('admission_date')}
                themeColors={themeColors}
                placeholder="Select Admission Date"
              />
            </>
          ) : (
            <>
              <EditField
                label="Aadhar No."
                value={editedData.aadhar_no}
                onChange={text => handleTextChange('aadhar_no', text, 'numeric')}
                keyboardType="numeric"
                maxLength={12}
                themeColors={themeColors}
                placeholder="e.g. 1234 5678 9012"
              />
              <EditField
                label="Joining Date"
                value={editedData.joining_date}
                isDate={true}
                onDatePress={() => openDatePicker('joining_date')}
                themeColors={themeColors}
                placeholder="Select Joining Date"
              />
              <EditField
                label="Previous Salary"
                value={editedData.previous_salary}
                onChange={text => handleTextChange('previous_salary', text, 'numeric')}
                keyboardType="numeric"
                themeColors={themeColors}
                placeholder="e.g. 40000"
              />
              <EditField
                label="Present Salary"
                value={editedData.present_salary}
                onChange={text => handleTextChange('present_salary', text, 'numeric')}
                keyboardType="numeric"
                themeColors={themeColors}
                placeholder="e.g. 55000"
              />
              <EditField
                label="Experience"
                value={editedData.experience}
                onChange={text => handleTextChange('experience', text, 'general')}
                multiline
                themeColors={themeColors}
                placeholder="e.g. 5 years in Mathematics"
              />
            </>
          )}

          {isSaving ? (
            <ActivityIndicator size="large" color={themeColors.accent} style={{ marginTop: 20 }} />
          ) : (
              <View style={styles.editActionsContainer}>
                  <TouchableOpacity style={[styles.editActionButton, styles.cancelButton]} onPress={onCancel}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.editActionButton, { backgroundColor: themeColors.accent }]} onPress={handleSaveChanges}>
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                  </TouchableOpacity>
              </View>
          )}
        </ScrollView>

        {/* Calendar Picker Modal - Uses 'pickerDate' state which is calculated via parseDateString */}
        {showDatePicker && (
          <DateTimePicker
            testID="dateTimePicker"
            value={pickerDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateConfirm}
            maximumDate={new Date()}
            // Allow selecting dates as far back as 1900
            minimumDate={new Date(1900, 0, 1)}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
});

const ProfileScreen = ({ staticProfileData, onStaticSave, onProfileUpdate }: ProfileScreenProps) => {
  const { user, isLoading: isAuthLoading, updateUser } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const themeColors = isDark ? Colors.dark : Colors.light;

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  useEffect(() => {
    StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
    if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(themeColors.background);
    }
  }, [isDark, themeColors.background]);

  useEffect(() => {
    const loadProfile = async () => {
      if (staticProfileData) {
        setProfileData(staticProfileData as ProfileData);
        setIsProfileLoading(false);
        return;
      }

      if (!isAuthLoading && user) {
        setIsProfileLoading(true);
        try {
          const response = await apiClient.get(`/profiles/${user.id}`);
          setProfileData(response.data);
        } catch (error: any) {
          Alert.alert('Error', error.response?.data?.message || 'Could not fetch profile.');
          setProfileData(null);
        } finally {
          setIsProfileLoading(false);
        }
      } else if (!isAuthLoading && !user) {
        setIsProfileLoading(false);
        setProfileData(null);
      }
    };

    loadProfile();
  }, [user, isAuthLoading, staticProfileData]);

  const handleSave = useCallback(async (editedData: ProfileData, newImage: Asset | null) => {
    setIsSaving(true);
    try {
      if (onStaticSave) {
        const wasImageRemoved = profileData?.profile_image_url && !editedData.profile_image_url;
        if(wasImageRemoved) editedData.profile_image_url = undefined;

        await onStaticSave(editedData, newImage);

        const updatedProfile = { ...profileData, ...editedData } as ProfileData;
        if (newImage?.uri) {
          updatedProfile.profile_image_url = newImage.uri;
        } else if (wasImageRemoved) {
          updatedProfile.profile_image_url = undefined;
        }
        setProfileData(updatedProfile);
        setIsEditing(false);

      } else if (user) {
        const formData = new FormData();
        Object.entries(editedData).forEach(([key, value]) => {
          if (key !== 'profile_image_url' && value !== null && value !== undefined) {
            formData.append(key, String(value));
          }
        });

        if (newImage?.uri) {
          formData.append('profileImage', {
            uri: newImage.uri,
            type: newImage.type || 'image/jpeg',
            name: newImage.fileName || `profile-${Date.now()}.jpg`
          });
        } else if (profileData?.profile_image_url && !editedData.profile_image_url) {
          formData.append('profile_image_url', 'null');
        }

        const response = await apiClient.put(`/profiles/${user.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const refreshedDataFromServer = response.data;
        const finalUpdatedProfile = {
          ...profileData,
          ...editedData,
          profile_image_url: refreshedDataFromServer.profile_image_url,
        } as ProfileData;

        setProfileData(finalUpdatedProfile);

        if (updateUser) {
          updateUser(finalUpdatedProfile);
        }

        if (onProfileUpdate) {
            onProfileUpdate(finalUpdatedProfile);
        }

        Alert.alert('Success', 'Profile updated successfully!');
        setIsEditing(false);
      }
    } catch (error: any)
    {
      Alert.alert('Update Failed', error.response?.data?.message || 'Failed to save profile.');
    } finally {
      setIsSaving(false);
    }
  }, [user, onStaticSave, onProfileUpdate, profileData, updateUser]);

  if (isAuthLoading || isProfileLoading) {
    return (
        <View style={[styles.centered, { backgroundColor: themeColors.background }]}>
            <ActivityIndicator size="large" color={themeColors.accent} />
        </View>
    );
  }

  if (!profileData) {
    return (
        <View style={[styles.centered, { backgroundColor: themeColors.background }]}>
            <Text style={{color: themeColors.textPrimary}}>Profile not available.</Text>
        </View>
    );
  }

  return (
    <Animatable.View key={String(isEditing)} animation="fadeIn" duration={400} style={{flex: 1}}>
      {isEditing
        ? <EditProfileView userProfile={profileData} onSave={handleSave} onCancel={() => setIsEditing(false)} isSaving={isSaving} themeColors={themeColors} />
        : <DisplayProfileView userProfile={profileData} onEditPress={() => setIsEditing(true)} themeColors={themeColors} />
      }
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: {
    paddingHorizontal: '4%',
    paddingBottom: 40,
    paddingTop: 20
  },
  profileHeader: { alignItems: 'center', marginVertical: 20 },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5
  },
  profileName: { fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
  profileRole: { fontSize: 16, marginTop: 5, textTransform: 'capitalize' },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 25,
  },
  editProfileButtonText: { fontWeight: 'bold', marginLeft: 8, fontSize: 16, },
  detailsCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    borderBottomWidth: 1,
    paddingBottom: 10
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  detailTextContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 14, fontWeight: '500', flex: 1 },
  detailValue: { fontSize: 15, fontWeight: '600', flex: 1.5, textAlign: 'right' },
  imageActionsContainer: { flexDirection: 'row', marginTop: 10, justifyContent: 'center', alignItems: 'center', },
  changeImageButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, marginHorizontal: 5, },
  changeImageButtonText: { fontWeight: 'bold' },
  removeImageButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(211, 47, 47, 0.1)', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, marginHorizontal: 5, },
  removeImageButtonText: { fontWeight: 'bold', },
  inputGroup: { marginBottom: 15 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  textInput: {
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  multilineInput: { height: 100, textAlignVertical: 'top' },
  genderOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  genderText: {
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 15
  },
  editActionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, },
  editActionButton: { flex: 1, paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
  cancelButton: { backgroundColor: '#EAECEF', },
  cancelButtonText: { color: '#8A94A6', fontWeight: 'bold', fontSize: 16 },
  saveButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center', },
  modalContent: { width: '90%', height: '60%', justifyContent: 'center', alignItems: 'center', borderRadius: 20, padding: 10 },
  enlargedProfileImage: { width: '100%', height: '80%', borderRadius: 10, marginBottom: 20 },
  closeButton: { paddingVertical: 10, paddingHorizontal: 30, borderRadius: 25, elevation: 5 },
  closeButtonText: { fontSize: 16, fontWeight: 'bold', },
});

export default ProfileScreen;