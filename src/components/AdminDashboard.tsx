// 📂 File: src/components/AdminDashboard.tsx (FINAL & VERIFIED)

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, SafeAreaView, Dimensions, Image, Platform, TextInput } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../context/AuthContext';
// ★★★ CORRECT IMPORTS: Added apiClient and SERVER_URL, removed API_BASE_URL ★★★
import { SERVER_URL } from '../../apiConfig';
import apiClient from '../api/client';

// --- COMPONENT IMPORTS ---
import NotificationsScreen from '../screens/NotificationsScreen';
import AcademicCalendar from './AcademicCalendar';
import AdminLM from './AdminLM';
import ProfileScreen from '../screens/ProfileScreen';
import TimetableScreen from '../screens/TimetableScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
// import TeacherHealthAdminScreen from '../screens/health/TeacherHealthAdminScreen';
// import AdminSportsScreen from '../screens/sports/AdminSportsScreen';
// import AdminEventsScreen from '../screens/events/AdminEventsScreen';
// import AdminHelpDeskScreen from '../screens/helpdesk/AdminHelpDeskScreen';
// import TeacherAdminPTMScreen from '../screens/ptm/TeacherAdminPTMScreen';
// import TeacherAdminLabsScreen from '../screens/labs/TeacherAdminLabsScreen';
// import TeacherAdminHomeworkScreen from '../screens/homework/TeacherAdminHomeworkScreen';
// import TeacherAdminExamScreen from '../screens/exams_Schedule/TeacherAdminExamScreen';
// import TeacherAdminExamsScreen from '../screens/exams/TeacherAdminExamsScreen';
// import TeacherAdminMaterialsScreen from '../screens/study-materials/TeacherAdminMaterialsScreen';
// import TeacherAdminResultsScreen from '../screens/results/TeacherAdminResultsScreen';
// import AdminSyllabusScreen from '../screens/syllabus/AdminSyllabusScreen';
// import TransportScreen from '../screens/transport/TransportScreen';
import AboutUs from './AboutUs';
import GalleryScreen from '../screens/gallery/GalleryScreen';
// import ChatAIScreen from '../screens/chatai/ChatAIScreen';
// import AdminSuggestionsScreen from '../screens/suggestions/AdminSuggestionsScreen';
// import AdminSponsorScreen from '../screens/sponsorship/AdminSponsorScreen';
// import AdminPaymentScreen from '../screens/payments/AdminPaymentScreen';
// import KitchenScreen from '../screens/kitchen/KitchenScreen';
// import FoodScreen from '../screens/food/FoodScreen';
// import GroupChatScreen from '../screens/chat/GroupChatScreen';
// import OnlineClassScreen from '../screens/Online_Class/OnlineClassScreen';
// import AlumniScreen from '../screens/Alumni/AlumniScreen';
// import PreAdmissionsScreen from '../screens/Pre-Admissions/PreAdmissionsScreen';
// import TeacherAdminResourcesScreen from '../screens/syllabus_Textbook/TeacherAdminResourcesScreen';

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

const AdminDashboard = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const isFocused = useIsFocused();

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      // ★★★ API CALL FIXED: Using apiClient ★★★
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
        // ★★★ API CALL FIXED: Using apiClient with proper error handling ★★★
        const response = await apiClient.get(`/profiles/${user.id}`);
        setProfile(response.data);
      } catch (error: any) {
        // ★★★ ERROR HANDLING IMPROVED: Shows an alert to the user ★★★
        Alert.alert('Error', error.response?.data?.message || 'Could not fetch profile.');
      }
    };
    if (isFocused) {
      fetchProfile();
    }
  }, [user, isFocused]);

  // ★★★ IMAGE URL FIXED: Using SERVER_URL for images from the backend ★★★
  const profileImageSource = profile?.profile_image_url
    ? { uri: `${SERVER_URL}${profile.profile_image_url}` }
    : { uri: 'default_avatar' };

  const allQuickAccessItems = [
    // { id: 'qa1', title: 'Pre-Admissions', imageSource: 'https://cdn-icons-png.flaticon.com/128/16495/16495874.png', navigateToTab: 'PreAdmissionsScreen' },
    // { id: 'qa2', title: 'Alumni', imageSource: 'https://cdn-icons-png.flaticon.com/128/2641/2641333.png', navigateToTab: 'AlumniScreen' },
    // { id: 'qa-ads-manage', title: 'Ads Management', imageSource: 'https://cdn-icons-png.flaticon.com/128/19006/19006038.png', navigateTo: 'AdminAdDashboardScreen' },
    // { id: 'qa-ads-create', title: 'Create Ad', imageSource: 'https://cdn-icons-png.flaticon.com/128/4944/4944482.png', navigateTo: 'CreateAdScreen' },
    { id: 'qa0', title: 'LM', imageSource: 'https://cdn-icons-png.flaticon.com/128/15096/15096966.png', navigateToTab: 'AdminLM' },
    { id: 'qa5', title: 'Time Table', imageSource: 'https://cdn-icons-png.flaticon.com/128/1254/1254275.png', navigateToTab: 'Timetable' },
    { id: 'qa3', title: 'Attendance', imageSource: 'https://cdn-icons-png.flaticon.com/128/10293/10293877.png', navigateToTab: 'Attendance' },
    // { id: 'qa4', title: 'Syllabus Tracker', imageSource: 'https://cdn-icons-png.flaticon.com/128/4728/4728712.png', navigateToTab: 'AdminSyllabusScreen' },
    // { id: 'qa40', title: 'Syllabus & Textbook', imageSource: 'https://cdn-icons-png.flaticon.com/128/3185/3185838.png', navigateToTab: 'TeacherAdminResourcesScreen' },
    // { id: 'qa7', title: 'Exam Schedule', imageSource: 'https://cdn-icons-png.flaticon.com/128/4029/4029113.png', navigateToTab: 'TeacherAdminExamScreen' },
    // { id: 'qa15', title: 'Exams', imageSource: 'https://cdn-icons-png.flaticon.com/128/207/207190.png', navigateToTab: 'TeacherAdminExamsScreen' },
    // { id: 'qa6', title: 'Reports', imageSource: 'https://cdn-icons-png.flaticon.com/128/9913/9913576.png', navigateToTab: 'TeacherAdminResultsScreen' },
    // { id: 'qa16', title: 'Study Materials', imageSource: 'https://cdn-icons-png.flaticon.com/128/3273/3273259.png', navigateToTab: 'TeacherAdminMaterialsScreen' },
    { id: 'qa13', title: 'Homework', imageSource: 'https://cdn-icons-png.flaticon.com/128/11647/11647336.png', navigateToTab: 'TeacherAdminHomeworkScreen' },
    // { id: 'qa27', title: 'Online Class', imageSource: 'https://cdn-icons-png.flaticon.com/128/3214/3214781.png', navigateToTab: 'OnlineClassScreen' },
    // { id: 'qa8', title: 'Digital Labs', imageSource: 'https://cdn-icons-png.flaticon.com/128/9562/9562280.png', navigateToTab: 'TeacherAdminLabsScreen' },
    // { id: 'qa9', title: 'Sports', imageSource: 'https://cdn-icons-png.flaticon.com/128/3429/3429456.png', navigateToTab: 'AdminSportsScreen' },
    // { id: 'qa12', title: 'Health Info', imageSource: 'https://cdn-icons-png.flaticon.com/128/3004/3004458.png', navigateToTab: 'TeacherHealthAdminScreen' },
    // { id: 'qa11', title: 'Events', imageSource: 'https://cdn-icons-png.flaticon.com/128/9592/9592283.png', navigateToTab: 'AdminEventsScreen' },
    // { id: 'qa10', title: 'PTM', imageSource: 'https://cdn-icons-png.flaticon.com/128/17588/17588666.png', navigateToTab: 'TeacherAdminPTMScreen' },
    // { id: 'qa17', title: 'Transport', imageSource: 'https://cdn-icons-png.flaticon.com/128/2945/2945694.png', navigateToTab: 'TransportScreen' },    
    // { id: 'qa14', title: 'Help Desk', imageSource: 'https://cdn-icons-png.flaticon.com/128/4961/4961736.png', navigateToTab: 'AdminHelpDeskScreen' },
    { id: 'qa18', title: 'Gallery', imageSource: 'https://cdn-icons-png.flaticon.com/128/8418/8418513.png', navigateTo: 'Gallery' },
    { id: 'qa19', title: 'About Us', imageSource: 'https://cdn-icons-png.flaticon.com/128/3815/3815523.png', navigateToTab: 'AboutUs' },
    // { id: 'qa20', title: 'Chat AI', imageSource: 'https://cdn-icons-png.flaticon.com/128/6028/6028616.png', navigateToTab: 'ChatAI' },
    // { id: 'qa21', title: 'Suggestions', imageSource: 'https://cdn-icons-png.flaticon.com/128/9722/9722906.png', navigateToTab: 'AdminSuggestionsScreen' },
    // { id: 'qa22', title: 'Sponsorship', imageSource: 'https://cdn-icons-png.flaticon.com/128/18835/18835518.png', navigateToTab: 'AdminSponsorScreen' },
    // { id: 'qa23', title: 'Payments', imageSource: 'https://cdn-icons-png.flaticon.com/128/1198/1198291.png', navigateToTab: 'AdminPaymentScreen' },
    // { id: 'qa24', title: 'Kitchen', imageSource: 'https://cdn-icons-png.flaticon.com/128/1698/1698742.png', navigateToTab: 'KitchenScreen' },
    // { id: 'qa25', title: 'Food', imageSource: 'https://cdn-icons-png.flaticon.com/128/2276/2276931.png', navigateToTab: 'FoodScreen' },
    // { id: 'qa26', title: 'Group Chat', imageSource: 'https://cdn-icons-png.flaticon.com/128/745/745205.png', navigateToTab: 'GroupChatScreen' },
  ];

  const [filteredItems, setFilteredItems] = useState(allQuickAccessItems);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredItems(allQuickAccessItems);
    } else {
      const lowercasedQuery = searchQuery.toLowerCase();
      const filtered = allQuickAccessItems.filter(item =>
        item.title.toLowerCase().includes(lowercasedQuery)
      );
      setFilteredItems(filtered);
    }
  }, [searchQuery]);

  const handleLogout = () => { Alert.alert("Logout", "Are you sure?", [{ text: "Cancel", style: "cancel" }, { text: "Logout", onPress: logout, style: "destructive" }]); };
  const handleBellIconClick = () => setActiveTab('allNotifications');

  const DashboardSectionCard = ({ title, imageSource, onPress }) => ( <TouchableOpacity style={styles.dashboardCard} onPress={onPress}><View style={styles.cardIconContainer}><Image source={{ uri: imageSource }} style={styles.cardImage} /></View><Text style={styles.cardTitle}>{title}</Text></TouchableOpacity> );
  
  const ContentScreenHeader = ({ title, onBack }) => ( <View style={styles.contentHeader}><TouchableOpacity onPress={onBack} style={styles.backButtonGlobal}><MaterialIcons name="arrow-back" size={24} color={PRIMARY_COLOR} /></TouchableOpacity><Text style={styles.contentHeaderTitle}>{title}</Text><View style={{ width: 30 }} /></View> );

  const renderContent = () => {
    const handleBack = () => setActiveTab('home');

    switch (activeTab) {
      case 'home': 
        return ( 
          <>
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={22} color={TEXT_COLOR_MEDIUM} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a module..."
                placeholderTextColor={TEXT_COLOR_MEDIUM}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
            </View>
            <ScrollView contentContainerStyle={styles.contentScrollViewContainer}>
              <View style={styles.dashboardGrid}>
                {filteredItems.map(item => ( 
                  <DashboardSectionCard 
                    key={item.id} 
                    title={item.title} 
                    imageSource={item.imageSource} 
                    onPress={() => { 
                      if (item.navigateTo) {
                          navigation.navigate(item.navigateTo);
                      } else if (item.navigateToTab) { 
                          setActiveTab(item.navigateToTab); 
                      } else { 
                          Alert.alert(item.title, `This feature is coming soon!`); 
                      }
                    }}
                  /> 
                ))}
              </View>
              {filteredItems.length === 0 && (
                <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>No modules found for "{searchQuery}"</Text>
                </View>
              )}
            </ScrollView> 
          </>
        );
      
      case 'allNotifications': return ( <><ContentScreenHeader title="Notifications" onBack={handleBack} /><NotificationsScreen onUnreadCountChange={setUnreadNotificationsCount} /></> );
      case 'calendar': return <AcademicCalendar />;
      case 'profile': return <ProfileScreen onBackPress={handleBack} />;
      case 'AdminLM': return ( <><ContentScreenHeader title="Login Management" onBack={handleBack} /><AdminLM /></> );
      case 'Timetable': return ( <><ContentScreenHeader title="Time Table Management" onBack={handleBack} /><TimetableScreen /></> );
      case 'Attendance': return ( <><ContentScreenHeader title="Attendance" onBack={handleBack} /><AttendanceScreen /></> );
      // case 'TeacherHealthAdminScreen': return ( <> <ContentScreenHeader title="Health Information" onBack={handleBack} /> <TeacherHealthAdminScreen /> </> );
      // case 'AdminSportsScreen': return ( <> <ContentScreenHeader title="Sports" onBack={handleBack} /> <AdminSportsScreen /> </> );
      // case 'AdminEventsScreen': return ( <> <ContentScreenHeader title="Events" onBack={handleBack} /> <AdminEventsScreen /> </> );
      // case 'AdminHelpDeskScreen': return ( <> <ContentScreenHeader title="Help Desk" onBack={handleBack} /> <AdminHelpDeskScreen /> </> );
      // case 'TeacherAdminPTMScreen': return ( <> <ContentScreenHeader title="Meetings" onBack={handleBack} /> <TeacherAdminPTMScreen navigation={navigation}/> </> );
      // case 'TeacherAdminLabsScreen': return ( <> <ContentScreenHeader title="Digital Labs" onBack={handleBack} /> <TeacherAdminLabsScreen /> </> );
      case 'TeacherAdminHomeworkScreen': return ( <> <ContentScreenHeader title="Homework" onBack={handleBack} /> <TeacherAdminHomeworkScreen /> </> );
      // case 'TeacherAdminExamScreen': return ( <> <ContentScreenHeader title="Exam Schedule" onBack={handleBack} /> <TeacherAdminExamScreen /> </> );
      // case 'TeacherAdminExamsScreen': return ( <> <ContentScreenHeader title="Exams" onBack={handleBack} /> <TeacherAdminExamsScreen /> </> );
      // case 'TeacherAdminMaterialsScreen': return ( <> <ContentScreenHeader title="Study Materials" onBack={handleBack} /> <TeacherAdminMaterialsScreen /> </> );
      // case 'AdminSyllabusScreen': return ( <> <ContentScreenHeader title="Syllabus Tracker" onBack={handleBack} /> <AdminSyllabusScreen /> </> );
      // case 'TransportScreen': return ( <> <ContentScreenHeader title="Transport" onBack={handleBack} /> <TransportScreen /> </> );
      // case 'TeacherAdminResultsScreen': return ( <> <ContentScreenHeader title="Reports" onBack={handleBack} /> <TeacherAdminResultsScreen navigation={navigation} /> </> );
      case 'Gallery': return ( <><ContentScreenHeader title="Gallery" onBack={handleBack} /><GalleryScreen /></> );
      case 'AboutUs': return ( <><ContentScreenHeader title="About Us" onBack={handleBack} /><AboutUs /></> );
      // case 'ChatAI': return ( <><ContentScreenHeader title="AI Assistant" onBack={handleBack} /><ChatAIScreen /></> );
      // case 'AdminSuggestionsScreen': return ( <><ContentScreenHeader title="Suggestions" onBack={handleBack} /><AdminSuggestionsScreen /></> );
      // case 'AdminSponsorScreen': return ( <><ContentScreenHeader title="Sponsorship" onBack={handleBack} /><AdminSponsorScreen /></> );
      // case 'AdminPaymentScreen': return ( <><ContentScreenHeader title="Payments" onBack={handleBack} /><AdminPaymentScreen /></> );
      // case 'KitchenScreen': return ( <><ContentScreenHeader title="Kitchen" onBack={handleBack} /><KitchenScreen /></> );
      // case 'FoodScreen': return ( <><ContentScreenHeader title="Food" onBack={handleBack} /><FoodScreen /></> );
      // case 'AlumniScreen': return ( <><ContentScreenHeader title="Alumni" onBack={handleBack} /><AlumniScreen /></> );
      // case 'GroupChatScreen': return ( <><ContentScreenHeader title="Group Chat" onBack={handleBack} /><GroupChatScreen /></> );
      // case 'OnlineClassScreen': return ( <><ContentScreenHeader title="Online Class" onBack={handleBack} /><OnlineClassScreen /></> );
      // case 'PreAdmissionsScreen': return ( <><ContentScreenHeader title="Pre-Admissions" onBack={handleBack} /><PreAdmissionsScreen /></> );
      // case 'TeacherAdminResourcesScreen': return ( <><ContentScreenHeader title="Syllabus & Textbook" /><TeacherAdminResourcesScreen /></> );
      
      default: return ( <View style={styles.fallbackContent}><Text style={styles.fallbackText}>Content for '{activeTab}' is not available.</Text><TouchableOpacity onPress={handleBack}><Text style={styles.fallbackLink}>Go to Home</Text></TouchableOpacity></View> );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {activeTab === 'home' && (
        <View style={styles.topBar}>
          <View style={styles.profileContainer}>
            <Image source={profileImageSource} style={styles.profileImage} />
            <View style={styles.profileTextContainer}>
              <Text style={styles.profileNameText} numberOfLines={1}>{profile?.full_name || 'Administrator'}</Text>
              <Text style={styles.profileRoleText}>{profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Admin'}</Text>
            </View>
          </View>
          <View style={styles.topBarActions}>
            <TouchableOpacity onPress={handleBellIconClick} style={styles.iconButton}>
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
      
      <View style={styles.bottomNav}>
        <BottomNavItem icon="home" label="Home" isActive={activeTab === 'home'} onPress={() => setActiveTab('home')} />
        <BottomNavItem icon="calendar" label="Calendar" isActive={activeTab === 'calendar'} onPress={() => setActiveTab('calendar')} />
        <BottomNavItem icon="user" label="Profile" isActive={activeTab === 'profile'} onPress={() => setActiveTab('profile')} />
      </View>
    </SafeAreaView>
  );
};

// --- Helper Components ---
const BottomNavItem = ({ icon, label, isActive, onPress }) => (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
        <Icon name={icon} size={24} color={isActive ? PRIMARY_COLOR : TEXT_COLOR_MEDIUM} />
        <Text style={[styles.navText, isActive && styles.navTextActive]}>{label}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TERTIARY_COLOR, },
  topBar: { backgroundColor: SECONDARY_COLOR, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 12 : 15, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, },
  profileContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10, },
  profileImage: { width: 45, height: 45, borderRadius: 22.5, borderWidth: 2, borderColor: PRIMARY_COLOR, backgroundColor: '#e0e0e0', },
  profileTextContainer: { marginLeft: 12, flex: 1, },
  profileNameText: { color: PRIMARY_COLOR, fontSize: 17, fontWeight: 'bold', },
  profileRoleText: { color: TEXT_COLOR_MEDIUM, fontSize: 13, },
  topBarActions: { flexDirection: 'row', alignItems: 'center', },
  iconButton: { position: 'relative', padding: 8 },
  notificationCountBubble: { position: 'absolute', top: 3, right: 3, backgroundColor: DANGER_COLOR, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, },
  notificationCountText: { color: 'white', fontSize: 11, fontWeight: 'bold', },
  contentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: SECONDARY_COLOR, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, },
  backButtonGlobal: { padding: 5, },
  contentHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: PRIMARY_COLOR, textAlign: 'center', flex: 1, },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, marginHorizontal: CONTENT_HORIZONTAL_PADDING, marginTop: 15, marginBottom: 10, borderColor: BORDER_COLOR, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.84, elevation: 2, },
  searchIcon: { marginLeft: 15, },
  searchInput: { flex: 1, height: 48, paddingLeft: 10, fontSize: 16, color: TEXT_COLOR_DARK, },
  noResultsContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50, paddingHorizontal: 20, },
  noResultsText: { fontSize: 16, color: TEXT_COLOR_MEDIUM, textAlign: 'center', },
  contentScrollViewContainer: { paddingHorizontal: CONTENT_HORIZONTAL_PADDING, paddingBottom: BOTTOM_NAV_HEIGHT + 20, flexGrow: 1, },
  dashboardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', },
  dashboardCard: { width: (windowWidth - (CONTENT_HORIZONTAL_PADDING * 2) - (CARD_GAP * 2)) / 3, borderRadius: 12, paddingVertical: 15, marginBottom: CARD_GAP, alignItems: 'center', justifyContent: 'flex-start', height: 110, backgroundColor: '#fff', shadowColor: "#000", shadowOffset: { width: 0, height: 1, }, shadowOpacity: 0.10, shadowRadius: 1.84, elevation: 2, },
  cardIconContainer: { width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 8, },
  cardImage: { width: 38, height: 38, resizeMode: 'contain', },
  cardTitle: { fontSize: 11, fontWeight: '600', color: TEXT_COLOR_DARK, textAlign: 'center', lineHeight: 14, paddingHorizontal: 4, marginTop: 'auto', },
  bottomNav: { flexDirection: 'row', backgroundColor: SECONDARY_COLOR, borderTopWidth: 1, borderTopColor: BORDER_COLOR, paddingVertical: Platform.OS === 'ios' ? 10 : 8, paddingBottom: Platform.OS === 'ios' ? 15 : 8, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 5, minHeight: BOTTOM_NAV_HEIGHT, },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 5, },
  navText: { fontSize: 10, color: TEXT_COLOR_MEDIUM, marginTop: 3, },
  navTextActive: { color: PRIMARY_COLOR, fontWeight: 'bold', },
  fallbackContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
  fallbackText: { fontSize: 16, color: TEXT_COLOR_MEDIUM, textAlign: 'center', marginBottom: 10, },
  fallbackLink: { fontSize: 16, color: PRIMARY_COLOR, fontWeight: 'bold', }
});

export default AdminDashboard;