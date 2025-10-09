import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  SafeAreaView, 
  Dimensions, 
  Image, 
  Platform, 
  TextInput,
  Modal,
  Animated, // Only used for the profile image modal
  TouchableWithoutFeedback,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { SERVER_URL } from '../../apiConfig';
import apiClient from '../api/client';

// --- COMPONENT IMPORTS ---
import NotificationsScreen from '../screens/NotificationsScreen';
import AcademicCalendar from './AcademicCalendar';
import AdminLM from './AdminLM';
import ProfileScreen from '../screens/ProfileScreen';
import TimetableScreen from '../screens/TimetableScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import TeacherAdminHomeworkScreen from '../screens/homework/TeacherAdminHomeworkScreen';
import AboutUs from './AboutUs';
// ★★★ 1. FIX: GalleryScreen is no longer imported because it's a separate screen we navigate to ★★★
// import GalleryScreen from '../screens/gallery/GalleryScreen'; 

interface ProfileData {
  full_name: string;
  profile_image_url?: string;
  role: string;
}

const { width: windowWidth } = Dimensions.get('window');
const CARD_GAP = 12;
const CONTENT_HORIZONTAL_PADDING = 15;
const BOTTOM_NAV_HEIGHT = 70;
const PRIMARY_COLOR = '#008080';
const SECONDARY_COLOR = '#e0f2f7';
const TERTIARY_COLOR = '#f8f8ff';
const TEXT_COLOR_DARK = '#333';
const TEXT_COLOR_MEDIUM = '#555';
const BORDER_COLOR = '#b2ebf2';
const DANGER_COLOR = '#ef4444';
const GRADIENT_COLORS = [TERTIARY_COLOR, '#eaf7f7'];

const MAIN_TABS = ['home', 'calendar', 'profile'];

const AdminDashboard = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const isFocused = useIsFocused();
  
  const [isProfileModalVisible, setProfileModalVisible] = useState(false);
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(true);
  const profileScaleAnim = useRef(new Animated.Value(0.5)).current;

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const response = await apiClient.get('/notifications');
      const unreadCount = response.data.filter(n => !n.is_read).length;
      setUnreadNotificationsCount(unreadCount);
    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  }, [user]);

  useEffect(() => {
    if (isFocused) {
      fetchUnreadCount();
    }
  }, [isFocused, fetchUnreadCount]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const response = await apiClient.get(`/profiles/${user.id}`);
        setProfile(response.data);
      } catch (error: any) {
        Alert.alert('Error', error.response?.data?.message || 'Could not fetch profile.');
      }
    };
    if (isFocused) {
      fetchProfile();
    }
  }, [user, isFocused]);
  
  useEffect(() => {
      if (isProfileModalVisible) {
          Animated.spring(profileScaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
      } else {
          profileScaleAnim.setValue(0.5);
      }
  }, [isProfileModalVisible]);

  const profileImageSource = profile?.profile_image_url
    ? { uri: `${SERVER_URL}${profile.profile_image_url}` }
    : { uri: 'default_avatar' };

  const allQuickAccessItems = [
    { id: 'qa0', title: 'LM', imageSource: 'https://cdn-icons-png.flaticon.com/128/15096/15096966.png', navigateToTab: 'AdminLM' },
    { id: 'qa5', title: 'Time Table', imageSource: 'https://cdn-icons-png.flaticon.com/128/1254/1254275.png', navigateToTab: 'Timetable' },
    { id: 'qa3', title: 'Attendance', imageSource: 'https://cdn-icons-png.flaticon.com/128/10293/10293877.png', navigateToTab: 'Attendance' },
    { id: 'qa13', title: 'Homework', imageSource: 'https://cdn-icons-png.flaticon.com/128/11647/11647336.png', navigateToTab: 'TeacherAdminHomeworkScreen' },
    // ★★★ 2. FIX: Changed 'navigateToTab' to 'navigateTo'. This tells the button to open a new screen. ★★★
    { id: 'qa18', title: 'Gallery', imageSource: 'https://cdn-icons-png.flaticon.com/128/8418/8418513.png', navigateTo: 'Gallery' },
    { id: 'qa19', title: 'About Us', imageSource: 'https://cdn-icons-png.flaticon.com/128/3815/3815523.png', navigateToTab: 'AboutUs' },
  ];

  const [filteredItems, setFilteredItems] = useState(allQuickAccessItems);

  useEffect(() => {
    setFilteredItems(searchQuery.trim() === '' ? allQuickAccessItems : allQuickAccessItems.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase())));
  }, [searchQuery]);

  const handleLogout = () => { Alert.alert("Logout", "Are you sure?", [{ text: "Cancel", style: "cancel" }, { text: "Logout", onPress: logout, style: "destructive" }]); };
  
  const switchTab = (tab: string) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setIsBottomNavVisible(MAIN_TABS.includes(tab));
  };

  const ContentScreenHeader = ({ title, onBack }) => ( <View style={styles.contentHeader}><TouchableOpacity onPress={onBack} style={styles.backButtonGlobal}><MaterialIcons name="arrow-back" size={24} color={PRIMARY_COLOR} /></TouchableOpacity><Text style={styles.contentHeaderTitle}>{title}</Text><View style={{ width: 30 }} /></View> );

  const renderContent = () => {
    const handleBack = () => switchTab('home');

    switch (activeTab) {
      case 'home': 
        return ( 
          <>
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={22} color={TEXT_COLOR_MEDIUM} style={styles.searchIcon} />
              <TextInput style={styles.searchInput} placeholder="Search for a module..." placeholderTextColor={TEXT_COLOR_MEDIUM} value={searchQuery} onChangeText={setSearchQuery} clearButtonMode="while-editing" />
            </View>
            <ScrollView contentContainerStyle={styles.contentScrollViewContainer}>
              <View style={styles.dashboardGrid}>
                {filteredItems.map((item) => (
                    <DashboardCard key={item.id} item={item} onPress={() => { 
                        // This logic now correctly handles the 'navigateTo' property for Gallery
                        if (item.navigateTo) {
                            navigation.navigate(item.navigateTo); 
                        } else if (item.navigateToTab) {
                            switchTab(item.navigateToTab);
                        } else {
                            Alert.alert(item.title, `This feature is coming soon!`);
                        }
                    }} /> 
                  ))}
                  {/* Added grid layout fix for consistency */}
                  {filteredItems.length % 3 === 2 && <View style={styles.placeholderCard} />}
                  {filteredItems.length % 3 === 1 && <><View style={styles.placeholderCard} /><View style={styles.placeholderCard} /></>}
              </View>
              {filteredItems.length === 0 && (<View style={styles.noResultsContainer}><Text style={styles.noResultsText}>No modules found for "{searchQuery}"</Text></View>)}
            </ScrollView> 
          </>
        );
      
      case 'allNotifications': return ( <><ContentScreenHeader title="Notifications" onBack={handleBack} /><NotificationsScreen onUnreadCountChange={setUnreadNotificationsCount} /></> );
      case 'calendar': return <AcademicCalendar />;
      case 'profile': return <ProfileScreen onBackPress={handleBack} />;
      case 'AdminLM': return ( <><ContentScreenHeader title="Login Management" onBack={handleBack} /><AdminLM /></> );
      case 'Timetable': return ( <><ContentScreenHeader title="Time Table Management" onBack={handleBack} /><TimetableScreen /></> );
      case 'Attendance': return ( <><ContentScreenHeader title="Attendance" onBack={handleBack} /><AttendanceScreen /></> );
      case 'TeacherAdminHomeworkScreen': return ( <> <ContentScreenHeader title="Homework" onBack={handleBack} /> <TeacherAdminHomeworkScreen /> </> );
      // ★★★ 3. FIX: Removed the 'Gallery' case. It's no longer needed here. ★★★
      case 'AboutUs': return ( <><ContentScreenHeader title="About Us" onBack={handleBack} /><AboutUs /></> );
      
      default: return ( <View style={styles.fallbackContent}><Text style={styles.fallbackText}>Content for '{activeTab}' is not available.</Text><TouchableOpacity onPress={handleBack}><Text style={styles.fallbackLink}>Go to Home</Text></TouchableOpacity></View> );
    }
  };

  return (
    <LinearGradient colors={GRADIENT_COLORS} style={{flex: 1}}>
    <SafeAreaView style={styles.safeArea}>
      {activeTab === 'home' && (
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.profileContainer} onPress={() => setProfileModalVisible(true)} activeOpacity={0.8}>
              <Image source={profileImageSource} style={styles.profileImage} />
              <View style={styles.profileTextContainer}>
                <Text style={styles.profileNameText} numberOfLines={1}>{profile?.full_name || 'Administrator'}</Text>
                <Text style={styles.profileRoleText}>{profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Admin'}</Text>
              </View>
          </TouchableOpacity>
          <View style={styles.topBarActions}>
            <TouchableOpacity onPress={() => switchTab('allNotifications')} style={styles.iconButton}>
              <MaterialIcons name="notifications-none" size={26} color={PRIMARY_COLOR} />
              {unreadNotificationsCount > 0 && ( <View style={styles.notificationCountBubble}><Text style={styles.notificationCountText}>{unreadNotificationsCount}</Text></View> )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
              <MaterialIcons name="logout" size={26} color={PRIMARY_COLOR} />
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      <View style={{ flex: 1 }}>
        {renderContent()}
      </View>
      
      {isBottomNavVisible && (
        <View style={styles.bottomNav}>
          <BottomNavItem icon="home" label="Home" isActive={activeTab === 'home'} onPress={() => switchTab('home')} />
          <BottomNavItem icon="calendar" label="Calendar" isActive={activeTab === 'calendar'} onPress={() => switchTab('calendar')} />
          <BottomNavItem icon="user" label="Profile" isActive={activeTab === 'profile'} onPress={() => switchTab('profile')} />
        </View>
      )}

      <Modal animationType="fade" transparent={true} visible={isProfileModalVisible} onRequestClose={() => setProfileModalVisible(false)}>
          <TouchableWithoutFeedback onPress={() => setProfileModalVisible(false)}>
              <View style={styles.modalOverlay}>
                  <Animated.Image source={profileImageSource} style={[ styles.enlargedProfileImage, { transform: [{ scale: profileScaleAnim }] } ]} />
                  <TouchableOpacity style={styles.closeModalButton} onPress={() => setProfileModalVisible(false)}>
                      <MaterialIcons name="close" size={30} color="#fff" />
                  </TouchableOpacity>
              </View>
          </TouchableWithoutFeedback>
      </Modal>

    </SafeAreaView>
    </LinearGradient>
  );
};

// --- Helper Components (Simplified) ---

const DashboardCard = ({ item, onPress }) => {
    return (
        <TouchableOpacity style={styles.dashboardCardWrapper} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.dashboardCard}>
                <View style={styles.cardIconContainer}>
                    <Image source={{ uri: item.imageSource }} style={styles.cardImage} />
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
            </View>
        </TouchableOpacity>
    );
};

const BottomNavItem = ({ icon, label, isActive, onPress }) => {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
        <Icon name={icon} size={24} color={isActive ? PRIMARY_COLOR : TEXT_COLOR_MEDIUM} />
        <Text style={[styles.navText, isActive && styles.navTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  topBar: { backgroundColor: SECONDARY_COLOR, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 12 : 15, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, },
  profileContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10, },
  profileImage: { width: 45, height: 45, borderRadius: 22.5, borderWidth: 2, borderColor: PRIMARY_COLOR, backgroundColor: '#e0e0e0', },
  profileTextContainer: { marginLeft: 12, flex: 1, },
  profileNameText: { color: PRIMARY_COLOR, fontSize: 17, fontWeight: 'bold', },
  profileRoleText: { color: TEXT_COLOR_MEDIUM, fontSize: 13, },
  topBarActions: { flexDirection: 'row', alignItems: 'center', },
  iconButton: { position: 'relative', padding: 8 },
  notificationCountBubble: { position: 'absolute', top: 3, right: 3, backgroundColor: DANGER_COLOR, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, borderWidth: 1, borderColor: 'white' },
  notificationCountText: { color: 'white', fontSize: 11, fontWeight: 'bold', },
  contentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: SECONDARY_COLOR, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, },
  backButtonGlobal: { padding: 5, },
  contentHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: PRIMARY_COLOR, textAlign: 'center', flex: 1, },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, marginHorizontal: CONTENT_HORIZONTAL_PADDING, marginTop: 15, marginBottom: 10, borderColor: BORDER_COLOR, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.84, elevation: 2, },
  searchIcon: { marginLeft: 15, },
  searchInput: { flex: 1, height: 48, paddingLeft: 10, fontSize: 16, color: TEXT_COLOR_DARK, },
  noResultsContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50, paddingHorizontal: 20, },
  noResultsText: { fontSize: 16, color: TEXT_COLOR_MEDIUM, textAlign: 'center', },
  contentScrollViewContainer: { paddingHorizontal: CONTENT_HORIZONTAL_PADDING, paddingBottom: 20, flexGrow: 1, },
  dashboardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', },
  dashboardCardWrapper: { width: (windowWidth - (CONTENT_HORIZONTAL_PADDING * 2) - (CARD_GAP * 2)) / 3, marginBottom: CARD_GAP, },
  dashboardCard: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'flex-start', height: 110, backgroundColor: '#fff', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 4, },
  cardIconContainer: { width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 8, },
  cardImage: { width: 38, height: 38, resizeMode: 'contain', },
  cardTitle: { fontSize: 11, fontWeight: '600', color: TEXT_COLOR_DARK, textAlign: 'center', lineHeight: 14, paddingHorizontal: 4, marginTop: 'auto', },
  bottomNav: { flexDirection: 'row', backgroundColor: SECONDARY_COLOR, borderTopWidth: 1, borderTopColor: BORDER_COLOR, paddingVertical: Platform.OS === 'ios' ? 10 : 8, paddingBottom: Platform.OS === 'ios' ? 20 : 8, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 5, minHeight: BOTTOM_NAV_HEIGHT, },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 5, },
  navText: { fontSize: 10, color: TEXT_COLOR_MEDIUM, marginTop: 3, },
  navTextActive: { color: PRIMARY_COLOR, fontWeight: 'bold', },
  fallbackContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
  fallbackText: { fontSize: 16, color: TEXT_COLOR_MEDIUM, textAlign: 'center', marginBottom: 10, },
  fallbackLink: { fontSize: 16, color: PRIMARY_COLOR, fontWeight: 'bold', },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center' },
  enlargedProfileImage: { width: windowWidth * 0.8, height: windowWidth * 0.8, borderRadius: (windowWidth * 0.8) / 2, borderWidth: 4, borderColor: '#fff' },
  closeModalButton: { position: 'absolute', top: 50, right: 20, padding: 10, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)' },
  placeholderCard: {
    width: (windowWidth - (CONTENT_HORIZONTAL_PADDING * 2) - (CARD_GAP * 2)) / 3,
  },
});

export default AdminDashboard;