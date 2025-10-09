import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  SafeAreaView, TextInput, Alert, ActivityIndicator, Platform, PermissionsAndroid
} from 'react-native';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { useAuth } from '../context/AuthContext';
import { SERVER_URL } from '../../apiConfig';
import apiClient from '../api/client';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable'; // ✨ NEW: Import animation library

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
}

interface ProfileScreenProps {
  onBackPress?: () => void;
  staticProfileData?: ProfileData;
  onStaticSave?: (updatedData: ProfileData, newImage: Asset | null) => Promise<void>;
  onProfileUpdate?: (newProfileData: ProfileData) => void;
}

// ✨ --- NEW: Modern, vibrant color palette ---
const PRIMARY_ACCENT = '#008080'; // A friendly, modern blue
const PAGE_BACKGROUND = '#f7fcfbff';
const CARD_BACKGROUND = '#FFFFFF';
const TEXT_PRIMARY = '#2C3E50';
const TEXT_SECONDARY = '#8A94A6';
const BORDER_COLOR = '#EAECEF';
const WHITE_COLOR = '#FFFFFF';

const ProfileScreen = ({ onBackPress, staticProfileData, onStaticSave, onProfileUpdate }: ProfileScreenProps) => {
  const { user, isLoading: isAuthLoading } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      if (staticProfileData) {
        setProfileData(staticProfileData);
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

  const handleSave = async (editedData: ProfileData, newImage: Asset | null) => {
    setIsSaving(true);
    try {
      if (onStaticSave) {
        await onStaticSave(editedData, newImage);
        const updatedProfile = { ...profileData, ...editedData } as ProfileData;
        if (newImage && newImage.uri) {
          updatedProfile.profile_image_url = newImage.uri;
        }
        setProfileData(updatedProfile);
        setIsEditing(false);
      } else if (user) {
        const formData = new FormData();
        Object.entries(editedData).forEach(([key, value]) => {
          if (value != null) {
            formData.append(key, String(value));
          }
        });
        if (newImage && newImage.uri) {
          formData.append('profileImage', {
            uri: newImage.uri,
            type: newImage.type || 'image/jpeg',
            name: newImage.fileName || `profile-${Date.now()}.jpg`
          });
        }
        
        const response = await apiClient.put(`/profiles/${user.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const refreshedProfile = response.data;
        const updatedProfile = { ...profileData, ...editedData, ...refreshedProfile } as ProfileData;
        setProfileData(updatedProfile);
        if (onProfileUpdate) {
          onProfileUpdate(updatedProfile);
        }
        Alert.alert('Success', 'Profile updated successfully!');
        setIsEditing(false);
      }
    } catch (error: any) {
      Alert.alert('Update Failed', error.response?.data?.message || 'Failed to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isAuthLoading || isProfileLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={PRIMARY_ACCENT} /></View>;
  }

  if (!profileData) {
    return <View style={styles.centered}><Text>Profile not available.</Text></View>;
  }
  
  // ✨ NEW: Animate the transition between Display and Edit views
  return (
    <Animatable.View key={String(isEditing)} animation="fadeIn" duration={400} style={{flex: 1}}>
      {isEditing
        ? <EditProfileView userProfile={profileData} onSave={handleSave} onCancel={() => setIsEditing(false)} isSaving={isSaving} />
        : <DisplayProfileView userProfile={profileData} onEditPress={() => setIsEditing(true)} onBackPress={onBackPress} />
      }
    </Animatable.View>
  );
};

const DisplayProfileView = ({ userProfile, onEditPress, onBackPress }: { userProfile: ProfileData, onEditPress: () => void, onBackPress?: () => void }) => {
  let profileImageSource;
  const imageUri = userProfile.profile_image_url;

  if (imageUri) {
    const fullUri = (imageUri.startsWith('http') || imageUri.startsWith('file')) ? imageUri : `${SERVER_URL}${imageUri}`;
    profileImageSource = { uri: fullUri };
  } else {
    profileImageSource = { uri: 'default_avatar' };
  }

  const showAcademicDetails = userProfile.role !== 'donor';

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animatable.View animation="fadeInDown" duration={500}>
        <View style={styles.header}>
            {onBackPress ? (
            <TouchableOpacity onPress={onBackPress} style={styles.headerButton}>
                <MaterialIcons name="arrow-back" size={24} color={PRIMARY_ACCENT} />
            </TouchableOpacity>
            ) : (
            <View style={styles.headerButton} />
            )}
            <Text style={styles.headerTitle}>My Profile</Text>
            <TouchableOpacity onPress={onEditPress} style={styles.headerButton}>
            <MaterialIcons name="edit" size={24} color={PRIMARY_ACCENT} />
            </TouchableOpacity>
        </View>
      </Animatable.View>
      <ScrollView contentContainerStyle={styles.container}>
        <Animatable.View animation="zoomIn" duration={500} delay={100} style={styles.profileHeader}>
          <Image source={profileImageSource} style={styles.profileImage} />
          <Text style={styles.profileName}>{userProfile.full_name}</Text>
          <Text style={styles.profileRole}>{userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)}</Text>
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
            <DetailRow label="Admission Date:" value={userProfile.admission_date} icon="event" />
          </Animatable.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const EditProfileView = ({ userProfile, onSave, onCancel, isSaving }: { userProfile: ProfileData, onSave: (data: ProfileData, newImage: Asset | null) => void, onCancel: () => void, isSaving: boolean }) => {
  const [editedData, setEditedData] = useState(userProfile);
  const [newImage, setNewImage] = useState<Asset | null>(null);

  const requestGalleryPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          { title: 'Gallery Access Permission', message: 'App needs access to your gallery.', buttonPositive: 'OK' }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) { return false; }
    }
    return true;
  };

  const handleChoosePhoto = async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      if (result.assets && result.assets.length > 0) {
        setNewImage(result.assets[0]);
      }
    } catch (error) { console.error('Image picker error:', error); }
  };

  const handleChange = (field: keyof ProfileData, value: string) => setEditedData(prev => ({ ...prev, [field]: value }));

  const imageSource = newImage?.uri
    ? { uri: newImage.uri }
    : (editedData.profile_image_url
      ? (editedData.profile_image_url.startsWith('http') || editedData.profile_image_url.startsWith('file') ? { uri: editedData.profile_image_url } : { uri: `${SERVER_URL}${editedData.profile_image_url}` })
      : { uri: 'default_avatar' });

  const showAcademicFields = userProfile.role !== 'donor';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.headerButton} disabled={isSaving}>
          <Text style={styles.headerButtonTextCancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={() => onSave(editedData, newImage)} style={styles.headerButton} disabled={isSaving}>
          <Text style={styles.headerButtonTextSave}>Save</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.profileHeader}>
          <Image source={imageSource} style={styles.profileImage} />
          <TouchableOpacity onPress={handleChoosePhoto} style={styles.changeImageButton}>
            <MaterialIcons name="photo-camera" size={16} color={PRIMARY_ACCENT} style={{ marginRight: 8 }} />
            <Text style={styles.changeImageButtonText}>Change Photo</Text>
          </TouchableOpacity>
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
            <EditField label="Admission Date" value={editedData.admission_date} onChange={text => handleChange('admission_date', text)} placeholder="YYYY-MM-DD" />
          </>
        )}
        {isSaving && <ActivityIndicator size="large" color={PRIMARY_ACCENT} style={{ marginTop: 20 }} />}
      </ScrollView>
    </SafeAreaView>
  );
};

const DetailRow = ({ label, value, icon }: { label: string; value?: string | null; icon: string }) => (
  <View style={styles.detailRow}>
    <MaterialIcons name={icon} size={20} color={PRIMARY_ACCENT} style={styles.detailIcon} />
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value || 'N/A'}</Text>
  </View>
);

const EditField = ({ label, value, onChange, ...props }: any) => (
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
);

// ✨ --- NEW: Revamped styles for a modern, dynamic UI ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: PAGE_BACKGROUND },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PAGE_BACKGROUND },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: CARD_BACKGROUND, paddingVertical: 15, paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: BORDER_COLOR,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 3
  },
  headerButton: { padding: 8, minWidth: 60, alignItems: 'center' },
  headerButtonTextSave: { color: PRIMARY_ACCENT, fontSize: 16, fontWeight: '600' },
  headerButtonTextCancel: { color: TEXT_SECONDARY, fontSize: 16, fontWeight: '500' },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: 'bold' },
  container: { paddingHorizontal: 15, paddingBottom: 40 },
  profileHeader: { alignItems: 'center', marginVertical: 20 },
  profileImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: CARD_BACKGROUND, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 5 },
  profileName: { fontSize: 26, fontWeight: 'bold', color: TEXT_PRIMARY, textAlign: 'center' },
  profileRole: { fontSize: 16, color: TEXT_SECONDARY, marginTop: 5, textTransform: 'capitalize' },
  detailsCard: { backgroundColor: CARD_BACKGROUND, borderRadius: 12, padding: 20, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: PRIMARY_ACCENT, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, paddingBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  detailIcon: { marginRight: 15, width: 20 },
  detailLabel: { fontSize: 15, fontWeight: '500', color: TEXT_SECONDARY, flex: 2 },
  detailValue: { fontSize: 15, color: TEXT_PRIMARY, flex: 3, textAlign: 'right' },
  changeImageButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74, 105, 226, 0.1)', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20 },
  changeImageButtonText: { color: PRIMARY_ACCENT, fontWeight: 'bold' },
  inputGroup: { marginBottom: 15 },
  inputLabel: { fontSize: 15, fontWeight: '500', color: TEXT_SECONDARY, marginBottom: 8 },
  textInput: { backgroundColor: CARD_BACKGROUND, borderRadius: 10, padding: 12, fontSize: 16, color: TEXT_PRIMARY, borderWidth: 1, borderColor: BORDER_COLOR },
  multilineInput: { height: 100, textAlignVertical: 'top' },
});

export default ProfileScreen;