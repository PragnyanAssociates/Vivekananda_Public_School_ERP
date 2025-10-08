import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, SafeAreaView, Dimensions, Image, Platform, TextInput } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
// ★★★ 1. CORRECT IMPORTS: Use apiClient and SERVER_URL for consistency ★★★
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { SERVER_URL } from '../../apiConfig';

// --- Component Imports ---
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AcademicCalendar from './AcademicCalendar';
import TimetableScreen from '../screens/TimetableScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
// import TeacherHealthAdminScreen from '../screens/health/TeacherHealthAdminScreen';
// import AdminSportsScreen from '../screens/sports/AdminSportsScreen';
// import AdminEventsScreen from '../screens/events/AdminEventsScreen';
// import UserHelpDeskScreen from '../screens/helpdesk/UserHelpDeskScreen';
// import TeacherAdminPTMScreen from '../screens/ptm/TeacherAdminPTMScreen';
// import TeacherAdminLabsScreen from '../screens/labs/TeacherAdminLabsScreen';
import TeacherAdminHomeworkScreen from '../screens/homework/TeacherAdminHomeworkScreen';
// import TeacherAdminExamScreen from '../screens/exams_Schedule/TeacherAdminExamScreen';
// import TeacherAdminExamsScreen from '../screens/exams/TeacherAdminExamsScreen';
// import TeacherAdminMaterialsScreen from '../screens/study-materials/TeacherAdminMaterialsScreen';
// import TeacherAdminResultsScreen from '../screens/results/TeacherAdminResultsScreen';
// import TeacherSyllabusScreen from '../screens/syllabus/TeacherSyllabusScreen';
// import TransportScreen from '../screens/transport/TransportScreen';
import AboutUs from './AboutUs';
// import ChatAIScreen from '../screens/chatai/ChatAIScreen';
// import FoodScreen from '../screens/food/FoodScreen';
// import GroupChatScreen from '../screens/chat/GroupChatScreen';
import GalleryScreen from '../screens/gallery/GalleryScreen';
// import OnlineClassScreen from '../screens/Online_Class/OnlineClassScreen';
// import TeacherAdminResourcesScreen from '../screens/syllabus_Textbook/TeacherAdminResourcesScreen';

// --- Type Definitions ---
// ★★★ 2. FIX a. Update ProfileData interface to use snake_case for consistency ★★★
interface ProfileData { 
  full_name: string; 
  class_group: string; 
  profile_image_url?: string; 
  role: string; 
}

// --- Constants & Colors ---
const { width: windowWidth } = Dimensions.get('window');
const CARD_GAP = 12;
const CONTENT_HORIZONTAL_PADDING = 15;
const BOTTOM_NAV_HEIGHT = 70;
const PRIMARY_COLOR = '#008080';
const SECONDARY_COLOR = '#e0f2f7';
const TERTIARY_COLOR = '#F4F6F8';
const TEXT_COLOR_DARK = '#37474F';
const TEXT_COLOR_MEDIUM = '#566573';
const BORDER_COLOR = '#E0E0E0';
const WHITE = '#ffffff';
const DANGER_COLOR = '#E53935';

// --- Main Component ---
const TeacherDashboard = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const isFocused = useIsFocused();

  // ★★★ 2. FIX b. USE apiClient to fetch profile data ★★★
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const response = await apiClient.get(`/profiles/${user.id}`);
        setProfile(response.data);
      } catch (error: any) { 
        console.error("Error fetching profile:", error);
        Alert.alert("Error", error.response?.data?.message || "Could not load profile data.");
      }
    };
    if (isFocused) {
        fetchProfile();
    }
  }, [user, isFocused]);

  const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  // ★★★ 2. FIX c. USE SERVER_URL to display profile image ★★★
  const profileImageSource = profile?.profile_image_url ? { uri: `${SERVER_URL}${profile.profile_image_url}` } : { uri: 'default_avatar' };
  
  // ★★★ 2. FIX d. USE apiClient to fetch notifications ★★★
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const response = await apiClient.get('/notifications');
      setUnreadNotificationsCount(response.data.filter(n => !n.is_read).length);
    } catch (error) {
      console.error("Error fetching initial unread count:", error);
    }
  }, [user]);

  useEffect(() => {
    if (isFocused) {
      fetchUnreadCount();
    }
  }, [isFocused, fetchUnreadCount]);

  const handleLogout = () => { Alert.alert("Logout", "Are you sure you want to log out?", [ { text: "Cancel", style: "cancel" }, { text: "Logout", onPress: logout, style: "destructive" } ]); };

  // --- Quick Access Items (No changes needed here) ---
  const allQuickAccessItems = [
    // { id: 'qa-ads-create', title: 'Create Ad', imageSource: 'https://cdn-icons-png.flaticon.com/128/4944/4944482.png', navigateTo: 'CreateAdScreen' },
    { id: 'qa2', title: 'Timetable', imageSource: 'https://cdn-icons-png.flaticon.com/128/1254/1254275.png', navigateToTab: 'Timetable' },
    { id: 'qa3', title: 'Attendance', imageSource: 'https://cdn-icons-png.flaticon.com/128/10293/10293877.png', navigateToTab: 'Attendance' },
    // { id: 'qa4', title: 'Syllabus Tracker', imageSource: 'https://cdn-icons-png.flaticon.com/128/1584/1584937.png', navigateToTab: 'TeacherSyllabusScreen' },
    // { id: 'qa40', title: 'Syllabus & Textbook', imageSource: 'https://cdn-icons-png.flaticon.com/128/3185/3185838.png', navigateToTab: 'TeacherAdminResourcesScreen' },
    // { id: 'qa7', title: 'Exam Schedule', imageSource: 'https://cdn-icons-png.flaticon.com/128/4029/4029113.png', navigateToTab: 'TeacherAdminExamScreen' },
    // { id: 'qa5', title: 'Exams', imageSource: 'https://cdn-icons-png.flaticon.com/128/207/207190.png', navigateToTab: 'TeacherAdminExamsScreen' },
    // { id: 'qa6', title: 'Reports', imageSource: 'https://cdn-icons-png.flaticon.com/128/9913/9913576.png', navigateToTab: 'TeacherAdminResultsScreen' },
    // { id: 'qa15', title: 'Study materials', imageSource: 'https://cdn-icons-png.flaticon.com/128/3273/3273259.png', navigateToTab: 'TeacherAdminMaterialsScreen' },
    { id: 'qa14', title: 'Home Work', imageSource: 'https://cdn-icons-png.flaticon.com/128/11647/11647336.png', navigateToTab: 'TeacherAdminHomeworkScreen' },
    // { id: 'qa27', title: 'Online Class', imageSource: 'https://cdn-icons-png.flaticon.com/128/3214/3214781.png', navigateToTab: 'OnlineClassScreen' }, 
    // { id: 'qa8', title: 'Digital Labs', imageSource: 'https://cdn-icons-png.flaticon.com/128/9562/9562280.png', navigateToTab: 'TeacherAdminLabsScreen' },
    // { id: 'qa9', title: 'Sports', imageSource: 'https://cdn-icons-png.flaticon.com/128/3429/3429456.png', navigateToTab: 'AdminSportsScreen' },
    // { id: 'qa10', title: 'Health Info', imageSource: 'https://cdn-icons-png.flaticon.com/128/3004/3004458.png', navigateToTab: 'TeacherHealthAdminScreen' },
    // { id: 'qa13', title: 'Events', imageSource: 'https://cdn-icons-png.flaticon.com/128/9592/9592283.png', navigateToTab: 'AdminEventsScreen' },
    // { id: 'qa11', title: 'PTM', imageSource: 'https://cdn-icons-png.flaticon.com/128/17588/17588666.png', navigateToTab: 'TeacherAdminPTMScreen' },
    // { id: 'qa17', title: 'Transport', imageSource: 'https://cdn-icons-png.flaticon.com/128/2945/2945694.png', navigateToTab: 'TransportScreen' },
    // { id: 'qa16', title: 'Help Desk', imageSource: 'https://cdn-icons-png.flaticon.com/128/4961/4961736.png', navigateToTab: 'UserHelpDeskScreen' },
    { id: 'qa18', title: 'Gallery', imageSource: 'https://cdn-icons-png.flaticon.com/128/8418/8418513.png', navigateTo: 'Gallery' },
    { id: 'qa21', title: 'About Us', imageSource: 'https://cdn-icons-png.flaticon.com/128/3815/3815523.png', navigateToTab: 'AboutUs' },
    // { id: 'qa20', title: 'Chat AI', imageSource: 'https://cdn-icons-png.flaticon.com/128/6028/6028616.png', navigateToTab: 'ChatAI' },
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

  const renderContent = () => {
    const handleBack = () => setActiveTab('home');
    const ContentScreenHeader = ({ title }) => ( <View style={styles.contentHeader}><TouchableOpacity onPress={handleBack} style={styles.backButtonGlobal}><MaterialIcons name="arrow-back" size={24} color={PRIMARY_COLOR} /></TouchableOpacity><Text style={styles.contentHeaderTitle}>{title}</Text><View style={{ width: 30 }} /></View> );
    switch (activeTab) {
      case 'home':
        return ( 
            <>
              <View style={styles.searchContainer}>
                <MaterialIcons name="search" size={22} color={TEXT_COLOR_MEDIUM} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search modules..."
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
                                      Alert.alert(item.title, `Coming soon!`);
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
      
      case 'allNotifications': return ( <><ContentScreenHeader title="Notifications" /><NotificationsScreen onUnreadCountChange={setUnreadNotificationsCount} /></> );
      case 'calendar': return <AcademicCalendar />;
      case 'profile': return <ProfileScreen onBackPress={() => setActiveTab('home')} />;
      // case 'TeacherHealthAdminScreen': return ( <><ContentScreenHeader title="Health Information" /><TeacherHealthAdminScreen /></> );
      // case 'AdminEventsScreen': return ( <><ContentScreenHeader title="Events" /><AdminEventsScreen /></> );
      case 'TeacherAdminHomeworkScreen': return ( <><ContentScreenHeader title="Homework" /><TeacherAdminHomeworkScreen /></> );
      // case 'UserHelpDeskScreen': return ( <><ContentScreenHeader title="Help Desk" /><UserHelpDeskScreen /></> );
      case 'Timetable': return ( <><ContentScreenHeader title="My Timetable" /><TimetableScreen /></> );
      // case 'AdminSportsScreen': return ( <><ContentScreenHeader title="Sports" /><AdminSportsScreen /></> );
      // case 'TeacherAdminLabsScreen': return ( <><ContentScreenHeader title="Digital Labs" /><TeacherAdminLabsScreen /></> );
      // case 'TeacherAdminExamScreen': return ( <><ContentScreenHeader title="Exam Schedule" /><TeacherAdminExamScreen /></> );
      // case 'TeacherAdminExamsScreen': return ( <><ContentScreenHeader title="Exams" /><TeacherAdminExamsScreen /></> );
      // case 'TeacherAdminMaterialsScreen': return ( <><ContentScreenHeader title="Study Materials" /><TeacherAdminMaterialsScreen /></> );
      // case 'TeacherSyllabusScreen': return ( <><ContentScreenHeader title="Syllabus Tracker" /><TeacherSyllabusScreen /></> );
      // case 'TransportScreen': return ( <><ContentScreenHeader title="Transport" /><TransportScreen /></> );
      // case 'TeacherAdminPTMScreen': return ( <><ContentScreenHeader title="Meetings" /><TeacherAdminPTMScreen navigation={navigation} /></> );
      // case 'TeacherAdminResultsScreen': return ( <><ContentScreenHeader title="Reports" /><TeacherAdminResultsScreen navigation={navigation} /></> );
      case 'Attendance': return ( <><ContentScreenHeader title="Attendance Report" /><AttendanceScreen /></> );
      case 'AboutUs': return ( <><ContentScreenHeader title="About Us" /><AboutUs /></> );
      // case 'ChatAI': return ( <><ContentScreenHeader title="AI Assistant" /><ChatAIScreen /></> );
      // case 'FoodScreen': return ( <><ContentScreenHeader title="Food" /><FoodScreen /></> );
      // case 'GroupChatScreen': return ( <><ContentScreenHeader title="Group Chat" /><GroupChatScreen /></> );
      case 'Gallery': return ( <><ContentScreenHeader title="Gallery" /><GalleryScreen /></> );
      // case 'OnlineClassScreen': return ( <><ContentScreenHeader title="Online Class" /><OnlineClassScreen /></> );
      // case 'TeacherAdminResourcesScreen': return ( <><ContentScreenHeader title="Syllabus & Textbook" /><TeacherAdminResourcesScreen /></> );

      default: return ( <><ContentScreenHeader title={capitalize(activeTab)} /><View style={styles.fallbackContent}><Text style={styles.fallbackText}>Content not available yet.</Text></View></> );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {activeTab === 'home' && (
        <View style={styles.topBar}>
          <View style={styles.profileContainer}>
            <Image source={profileImageSource} style={styles.profileImage} />
            <View style={styles.profileTextContainer}>
              {/* ★★★ 2. FIX e. Use profile.full_name to display the name ★★★ */}
              <Text style={styles.profileNameText} numberOfLines={1}>{profile?.full_name || user?.username || 'Teacher'}</Text>
              <Text style={styles.profileRoleText}>{profile?.class_group || capitalize(profile?.role || user?.role || '')}</Text>
            </View>
          </View>
          <View style={styles.topBarActions}>
            <TouchableOpacity onPress={() => setActiveTab('allNotifications')} style={styles.iconButton}><MaterialIcons name="notifications-none" size={26} color={PRIMARY_COLOR} />{unreadNotificationsCount > 0 && (<View style={styles.notificationCountBubble}><Text style={styles.notificationCountText}>{unreadNotificationsCount}</Text></View>)}</TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.iconButton}><MaterialIcons name="logout" size={24} color={PRIMARY_COLOR} /></TouchableOpacity>
          </View>
        </View>
      )}
      <View style={styles.mainContent}>
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

// --- UI Helper Components ---
const DashboardSectionCard = ({ title, imageSource, onPress }: { title: string, imageSource: string, onPress: () => void }) => ( <TouchableOpacity style={styles.dashboardCard} onPress={onPress}> <View style={styles.cardIconContainer}><Image source={{ uri: imageSource }} style={styles.cardImage} /></View> <Text style={styles.cardTitle}>{title}</Text> </TouchableOpacity> );
const BottomNavItem = ({ icon, label, isActive, onPress }: { icon: string; label: string; isActive: boolean; onPress: () => void }) => ( <TouchableOpacity style={styles.navItem} onPress={onPress}> <Icon name={icon} size={isActive ? 24 : 22} color={isActive ? PRIMARY_COLOR : TEXT_COLOR_MEDIUM} /> <Text style={[styles.navText, isActive && styles.navTextActive]}>{label}</Text> </TouchableOpacity> );

// --- Styles ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: TERTIARY_COLOR },
    mainContent: { flex: 1 },
    topBar: { backgroundColor: SECONDARY_COLOR, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 12 : 15, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#455A64', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, },
    profileContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
    profileImage: { width: 45, height: 45, borderRadius: 22.5, borderWidth: 2, borderColor: PRIMARY_COLOR, backgroundColor: '#e0e0e0' },
    profileTextContainer: { marginLeft: 12, flex: 1 },
    profileNameText: { color: PRIMARY_COLOR, fontSize: 18, fontWeight: 'bold' },
    profileRoleText: { color: TEXT_COLOR_MEDIUM, fontSize: 14 },
    topBarActions: { flexDirection: 'row', alignItems: 'center' },
    iconButton: { position: 'relative', padding: 8 },
    notificationCountBubble: { position: 'absolute', top: 3, right: 3, backgroundColor: DANGER_COLOR, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, },
    notificationCountText: { color: WHITE, fontSize: 11, fontWeight: 'bold' },
    contentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: SECONDARY_COLOR, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, },
    backButtonGlobal: { padding: 5 },
    contentHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: PRIMARY_COLOR, textAlign: 'center', flex: 1, },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 12, marginHorizontal: CONTENT_HORIZONTAL_PADDING, marginTop: 15, marginBottom: 5, borderColor: BORDER_COLOR, borderWidth: 1, elevation: 2 },
    searchIcon: { marginLeft: 15 },
    searchInput: { flex: 1, height: 48, paddingLeft: 10, fontSize: 16, color: TEXT_COLOR_DARK },
    noResultsContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50, paddingHorizontal: 20 },
    noResultsText: { fontSize: 16, color: TEXT_COLOR_MEDIUM, textAlign: 'center' },
    contentScrollViewContainer: { paddingHorizontal: CONTENT_HORIZONTAL_PADDING, paddingTop: 10, paddingBottom: 20, flexGrow: 1, },
    dashboardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    dashboardCard: { width: (windowWidth - (CONTENT_HORIZONTAL_PADDING * 2) - (CARD_GAP * 2)) / 3, borderRadius: 10, paddingVertical: 15, marginBottom: CARD_GAP, alignItems: 'center', justifyContent: 'center', height: 115, backgroundColor: WHITE, shadowColor: '#455A64', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3, borderWidth: 1, borderColor: BORDER_COLOR, },
    cardIconContainer: { width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    cardImage: { width: 38, height: 38, resizeMode: 'contain' },
    cardTitle: { fontSize: 11, fontWeight: '600', color: TEXT_COLOR_DARK, textAlign: 'center', lineHeight: 14, paddingHorizontal: 4, },
    bottomNav: { flexDirection: 'row', backgroundColor: SECONDARY_COLOR, borderTopWidth: 1, borderTopColor: BORDER_COLOR, paddingVertical: Platform.OS === 'ios' ? 10 : 8, paddingBottom: Platform.OS === 'ios' ? 20 : 8, minHeight: BOTTOM_NAV_HEIGHT, },
    navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 5 },
    navText: { fontSize: 10, color: TEXT_COLOR_MEDIUM, marginTop: 3 },
    navTextActive: { color: PRIMARY_COLOR, fontWeight: 'bold' },
    fallbackContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: TERTIARY_COLOR },
    fallbackText: { fontSize: 16, color: TEXT_COLOR_MEDIUM, textAlign: 'center', marginBottom: 10 },
});

export default TeacherDashboard;