import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, TextInput, Alert, ActivityIndicator, Platform, PermissionsAndroid,
  Modal, Pressable
} from 'react-native';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { useAuth } from '../context/AuthContext';
import { SERVER_URL } from '../../apiConfig';
import apiClient from '../api/client';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import FastImage from 'react-native-fast-image';

// --- Type Definitions ---
export interface ProfileData {
  id: number;
  username: string;
  full_name: string;
  role: string;
  class_group: string;
  dob?: string;
  gender?: string;
  phone?: string;
  address?: string;
  profile_image_url?: string;
  admission_date?: string;
  roll_no?: string;
  email?: string;
  admission_no?: string;
  parent_name?: string;
  aadhar_no?: string;
  pen_no?: string;
}

interface ProfileScreenProps {
  onBackPress?: () => void;
  staticProfileData?: ProfileData;
  onStaticSave?: (updatedData: ProfileData, newImage: Asset | null) => Promise<void>;
  onProfileUpdate?: (newProfileData: ProfileData) => void;
}

// --- Constants ---
const PRIMARY_ACCENT = '#008080';
const PAGE_BACKGROUND = '#ffffffff';
const CARD_BACKGROUND = '#FFFFFF';
const TEXT_PRIMARY = '#2C3E50';
const TEXT_SECONDARY = '#8A94A6';
const BORDER_COLOR = '#EAECEF';

// --- Helper Functions ---
const getProfileImageSource = (url?: string | null) => {
  if (!url || typeof url !== 'string') {
    // This is a placeholder text, you can replace it with a default image require()
     return require('../assets/default_avatar.png');
    // Using a text-based placeholder for simplicity if you don't have a default image.
    // return { uri: 'https://via.placeholder.com/150/e0e0e0/808080?text=No+Image' }; 
  }
  if (url.startsWith('http') || url.startsWith('file')) {
    return { uri: url, priority: FastImage.priority.normal };
  }
  const fullUrl = url.startsWith('/') ? `${SERVER_URL}${url}` : `${SERVER_URL}/${url}`;
  return { uri: `${fullUrl}?t=${new Date().getTime()}`, priority: FastImage.priority.high };
};

// --- Memoized Child Components for Performance ---

const DetailRow = memo(({ label, value, icon }: { label: string; value?: string | null; icon: string }) => (
  <View style={styles.detailRow}>
    <MaterialIcons name={icon} size={20} color={PRIMARY_ACCENT} style={styles.detailIcon} />
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value || 'N/A'}</Text>
  </View>
));

const EditField = memo(({ label, value, onChange, ...props }: any) => (
  <View style={styles.inputGroup}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      style={props.multiline ? [styles.textInput, styles.multilineInput] : styles.textInput}
      value={value || ''}
      onChangeText={onChange}
      placeholderTextColor="#C7C7CD"
      {...props}
    />
  </View>
));

const DisplayProfileView = memo(({ userProfile, onEditPress }: { userProfile: ProfileData, onEditPress: () => void }) => {
  const profileImageSource = getProfileImageSource(userProfile.profile_image_url);
  const showAcademicDetails = userProfile.role !== 'donor';
  const [isViewerVisible, setViewerVisible] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Modal
        visible={isViewerVisible}
        transparent={true}
        onRequestClose={() => setViewerVisible(false)}
        animationType="fade"
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setViewerVisible(false)}>
          <View style={styles.modalContent}>
            <FastImage
              source={profileImageSource}
              style={styles.enlargedProfileImage}
              resizeMode={FastImage.resizeMode.contain}
            />
            <TouchableOpacity style={styles.closeButton} onPress={() => setViewerVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <ScrollView contentContainerStyle={styles.container}>
        <Animatable.View animation="zoomIn" duration={500} delay={100} style={styles.profileHeader}>
          <TouchableOpacity onPress={() => setViewerVisible(true)}>
            <FastImage source={profileImageSource} style={styles.profileImage} resizeMode={FastImage.resizeMode.cover} />
          </TouchableOpacity>
          <Text style={styles.profileName}>{userProfile.full_name}</Text>
          <Text style={styles.profileRole}>{userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)}</Text>
          <TouchableOpacity onPress={onEditPress} style={styles.editProfileButton}>
            <MaterialIcons name="edit" size={16} color={PRIMARY_ACCENT} />
            <Text style={styles.editProfileButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </Animatable.View>
        <Animatable.View animation="fadeInUp" duration={500} delay={200} style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          <DetailRow label="User ID:" value={userProfile.username} icon="badge" />
          {showAcademicDetails && <DetailRow label="Date of Birth:" value={userProfile.dob} icon="cake" />}
          {showAcademicDetails && <DetailRow label="Gender:" value={userProfile.gender} icon="wc" />}
        </Animatable.View>
        <Animatable.View animation="fadeInUp" duration={500} delay={300} style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Contact Information</Text>
          <DetailRow label="Email:" value={userProfile.email} icon="email" />
          <DetailRow label="Phone:" value={userProfile.phone} icon="phone" />
          <DetailRow label="Address:" value={userProfile.address} icon="home" />
        </Animatable.View>
        {showAcademicDetails && (
          <Animatable.View animation="fadeInUp" duration={500} delay={400} style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Academic Details</Text>
            <DetailRow label="Class:" value={userProfile.class_group} icon="class" />
            <DetailRow label="Roll No.:" value={userProfile.roll_no} icon="assignment-ind" />
            <DetailRow label="Admission No.:" value={userProfile.admission_no} icon="person-add" />
            <DetailRow label="Parent Name:" value={userProfile.parent_name} icon="people" />
            <DetailRow label="Aadhar No.:" value={userProfile.aadhar_no} icon="fingerprint" />
            <DetailRow label="PEN No.:" value={userProfile.pen_no} icon="description" />
            <DetailRow label="Admission Date:" value={userProfile.admission_date} icon="event" />
          </Animatable.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
});

const EditProfileView = memo(({ userProfile, onSave, onCancel, isSaving }: { userProfile: ProfileData, onSave: (data: ProfileData, newImage: Asset | null) => void, onCancel: () => void, isSaving: boolean }) => {
  const [editedData, setEditedData] = useState(userProfile);
  const [newImage, setNewImage] = useState<Asset | null>(null);

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
        console.warn('Permission request error:', err);
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

  const handleChange = useCallback((field: keyof ProfileData, value: string) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  }, []);
  
  const handleSaveChanges = () => {
    onSave(editedData, newImage);
  }

  const imageSource = getProfileImageSource(editedData.profile_image_url);
  const showAcademicFields = userProfile.role !== 'donor';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.profileHeader}>
          <FastImage source={imageSource} style={styles.profileImage} resizeMode={FastImage.resizeMode.cover} />
          <View style={styles.imageActionsContainer}>
              <TouchableOpacity onPress={handleChoosePhoto} style={styles.changeImageButton}>
                <MaterialIcons name="photo-camera" size={16} color={PRIMARY_ACCENT} style={{ marginRight: 8 }} />
                <Text style={styles.changeImageButtonText}>Change</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRemovePhoto} style={styles.removeImageButton}>
                <MaterialIcons name="delete" size={16} color={'#D32F2F'} style={{ marginRight: 8 }} />
                <Text style={styles.removeImageButtonText}>Remove</Text>
              </TouchableOpacity>
          </View>
        </View>
        <EditField label="Full Name" value={editedData.full_name} onChange={text => handleChange('full_name', text)} />
        <EditField label="Email" value={editedData.email} onChange={text => handleChange('email', text)} keyboardType="email-address" />
        <EditField label="Phone" value={editedData.phone} onChange={text => handleChange('phone', text)} keyboardType="phone-pad" />
        <EditField label="Address" value={editedData.address} onChange={text => handleChange('address', text)} multiline />
        {showAcademicFields && (
          <>
            <EditField label="Date of Birth" value={editedData.dob} onChange={text => handleChange('dob', text)} placeholder="YYYY-MM-DD" />
            <EditField label="Gender" value={editedData.gender} onChange={text => handleChange('gender', text)} />
            <EditField label="Class / Group" value={editedData.class_group} onChange={text => handleChange('class_group', text)} />
            <EditField label="Roll No." value={editedData.roll_no} onChange={text => handleChange('roll_no', text)} />
            <EditField label="Admission No." value={editedData.admission_no} onChange={text => handleChange('admission_no', text)} />
            <EditField label="Parent Name" value={editedData.parent_name} onChange={text => handleChange('parent_name', text)} />
            <EditField label="Aadhar No." value={editedData.aadhar_no} onChange={text => handleChange('aadhar_no', text)} keyboardType="numeric" maxLength={12} />
            <EditField label="PEN No." value={editedData.pen_no} onChange={text => handleChange('pen_no', text)} />
            <EditField label="Admission Date" value={editedData.admission_date} onChange={text => handleChange('admission_date', text)} placeholder="YYYY-MM-DD" />
          </>
        )}
        {isSaving ? <ActivityIndicator size="large" color={PRIMARY_ACCENT} style={{ marginTop: 20 }} /> : (
            <View style={styles.editActionsContainer}>
                <TouchableOpacity style={[styles.editActionButton, styles.cancelButton]} onPress={onCancel}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.editActionButton, styles.saveButton]} onPress={handleSaveChanges}>
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                </TouchableOpacity>
            </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
});

const ProfileScreen = ({ staticProfileData, onStaticSave, onProfileUpdate }: ProfileScreenProps) => {
  const { user, isLoading: isAuthLoading, updateUser } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

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
    return <View style={styles.centered}><ActivityIndicator size="large" color={PRIMARY_ACCENT} /></View>;
  }

  if (!profileData) {
    return <View style={styles.centered}><Text>Profile not available.</Text></View>;
  }

  return (
    <Animatable.View key={String(isEditing)} animation="fadeIn" duration={400} style={{flex: 1}}>
      {isEditing
        ? <EditProfileView userProfile={profileData} onSave={handleSave} onCancel={() => setIsEditing(false)} isSaving={isSaving} />
        : <DisplayProfileView userProfile={profileData} onEditPress={() => setIsEditing(true)} />
      }
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: PAGE_BACKGROUND },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PAGE_BACKGROUND },
  container: { 
    paddingHorizontal: 15, 
    paddingBottom: 40,
    paddingTop: 20
  },
  profileHeader: { alignItems: 'center', marginVertical: 20 },
  profileImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: CARD_BACKGROUND, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 5, backgroundColor: '#e0e0e0' },
  profileName: { fontSize: 26, fontWeight: 'bold', color: TEXT_PRIMARY, textAlign: 'center' },
  profileRole: { fontSize: 16, color: TEXT_SECONDARY, marginTop: 5, textTransform: 'capitalize' },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(0, 128, 128, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 25,
  },
  editProfileButtonText: { color: PRIMARY_ACCENT, fontWeight: 'bold', marginLeft: 8, fontSize: 16, },
  detailsCard: { backgroundColor: CARD_BACKGROUND, borderRadius: 12, padding: 20, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: PRIMARY_ACCENT, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, paddingBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  detailIcon: { marginRight: 15, width: 20 },
  detailLabel: { fontSize: 15, fontWeight: '500', color: TEXT_SECONDARY, flex: 2 },
  detailValue: { fontSize: 15, color: TEXT_PRIMARY, flex: 3, textAlign: 'right' },
  imageActionsContainer: { flexDirection: 'row', marginTop: 10, justifyContent: 'center', alignItems: 'center', },
  changeImageButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 128, 128, 0.1)', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, marginHorizontal: 5, },
  changeImageButtonText: { color: PRIMARY_ACCENT, fontWeight: 'bold' },
  removeImageButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(211, 47, 47, 0.1)', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, marginHorizontal: 5, },
  removeImageButtonText: { color: '#D32F2F', fontWeight: 'bold', },
  inputGroup: { marginBottom: 15 },
  inputLabel: { fontSize: 15, fontWeight: '500', color: TEXT_SECONDARY, marginBottom: 8 },
  textInput: { backgroundColor: '#F7F8FA', borderRadius: 10, padding: 12, fontSize: 16, color: TEXT_PRIMARY, borderWidth: 1, borderColor: BORDER_COLOR },
  multilineInput: { height: 100, textAlignVertical: 'top' },
  editActionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, },
  editActionButton: { flex: 1, paddingVertical: 15, borderRadius: 10, alignItems: 'center', },
  cancelButton: { backgroundColor: '#EAECEF', marginRight: 10, },
  saveButton: { backgroundColor: PRIMARY_ACCENT, marginLeft: 10, },
  cancelButtonText: { color: TEXT_SECONDARY, fontWeight: 'bold', fontSize: 16 },
  saveButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', alignItems: 'center', },
  modalContent: { width: '90%', height: '70%', justifyContent: 'center', alignItems: 'center', },
  enlargedProfileImage: { width: '100%', height: '100%', borderRadius: 20, },
  closeButton: { position: 'absolute', bottom: -50, backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 30, borderRadius: 25, },
  closeButtonText: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: 'bold', },
});

export default ProfileScreen;