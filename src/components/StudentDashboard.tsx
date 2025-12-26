import React, { useState, useEffect, useCallback } from 'react';
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
  TouchableWithoutFeedback,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { SERVER_URL } from '../../apiConfig';
import FastImage from 'react-native-fast-image';

// --- COMPONENT IMPORTS ---
import NotificationsScreen from '../screens/NotificationsScreen';
import AcademicCalendar from './AcademicCalendar';
import ProfileScreen from '../screens/ProfileScreen';
import TimetableScreen from '../screens/TimetableScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import AboutUs from './AboutUs';
import StudentExamsScreen from '../screens/exams/StudentExamsScreen';
import StudentPTMScreen from '../screens/ptm/StudentPTMScreen';
import OnlineClassScreen from '../screens/Online_Class/OnlineClassScreen';
import FoodScreen from '../screens/food/FoodScreen';
import StudentHealthScreen from '../screens/health/StudentHealthScreen';
// import GroupChatScreen from '../screens/chat/GroupChatScreen';
import StudentEventsScreen from '../screens/events/StudentEventsScreen';
import StudentExamScreen from '../screens/exams_Schedule/StudentExamScreen';
import StudentLabsScreen from '../screens/labs/StudentLabsScreen';
// import StudentReportCardScreen from '../screens/report/StudentReportCardScreen';
import StudentMaterialsScreen from '../screens/study-materials/StudentMaterialsScreen';
import StudentSyllabusScreen from '../screens/syllabus/StudentSyllabusScreen';
import StudentResourcesScreen from '../screens/syllabus_Textbook/StudentResourcesScreen';

import ActivitiesScreen from '../screens/Extra_activity/ActivitiesScreen';
import DictionaryScreen from '../screens/dictionary/DictionaryScreen';
import TransportScreen from '../screens/transport/TransportScreen';
import LibraryHomeScreen from '../screens/library/LibraryHomeScreen';

import MyPerformance from '../screens/report/MyPerformance';

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
const GRADIENT_COLORS = [TERTIARY_COLOR, '#ffffffff'];

const MAIN_TABS = ['home', 'calendar', 'profile'];

const StudentDashboard = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const isFocused = useIsFocused();
  const [isProfileModalVisible, setProfileModalVisible] = useState(false);
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(true);

  const profileImageSource = user?.profile_image_url
    ? {
        uri: `${SERVER_URL}${user.profile_image_url}?t=${new Date().getTime()}`,
        priority: FastImage.priority.high,
      }
    : require('../assets/default_avatar.png');

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

  const allQuickAccessItems = [
    { id: 'qa2', title: 'Timetable', imageSource: 'https://cdn-icons-png.flaticon.com/128/1254/1254275.png', navigateToTab: 'Timetable' },
    { id: 'qa3', title: 'Attendance', imageSource: 'https://cdn-icons-png.flaticon.com/128/10293/10293877.png', navigateToTab: 'Attendance' },
    { id: 'qa32', title: 'Library', imageSource: 'https://cdn-icons-png.flaticon.com/128/9043/9043296.png', navigateToTab: 'LibraryHomeScreen' },
    { id: 'qa32', title: 'My Performance', imageSource: 'https://cdn-icons-png.flaticon.com/128/3696/3696744.png', navigateToTab: 'MyPerformance' },
    // { id: 'qa31', title: 'Transport', imageSource: 'https://cdn-icons-png.flaticon.com/128/3124/3124263.png', navigateToTab: 'TransportScreen' },
    // { id: 'qa28', title: 'Extracurricular Activities', imageSource: 'https://cdn-icons-png.flaticon.com/128/12693/12693554.png', navigateToTab: 'ActivitiesScreen' },
    { id: 'qa14', title: 'Home Work', imageSource: 'https://cdn-icons-png.flaticon.com/128/11647/11647336.png', navigateTo: 'StudentHomework' },
    { id: 'qa18', title: 'Gallery', imageSource: 'https://cdn-icons-png.flaticon.com/128/8418/8418513.png', navigateTo: 'Gallery' },
    { id: 'qa19', title: 'About Us', imageSource: 'https://cdn-icons-png.flaticon.com/128/3815/3815523.png', navigateToTab: 'AboutUs' },
    { id: 'qa4', title: 'Exams', imageSource: 'https://cdn-icons-png.flaticon.com/128/12886/12886027.png', navigateToTab: 'StudentExamsScreen' },
    { id: 'qa29', title: 'Dictionary', imageSource: 'https://cdn-icons-png.flaticon.com/128/4033/4033369.png', navigateToTab: 'DictionaryScreen' },
    { id: 'qa1', title: 'PTM', imageSource: 'https://cdn-icons-png.flaticon.com/128/3214/3214781.png', navigateToTab: 'StudentPTMScreen' },
    { id: 'qa7', title: 'Online class', imageSource: 'https://cdn-icons-png.flaticon.com/128/8388/8388104.png', navigateToTab: 'OnlineClassScreen' },
    { id: 'qa8', title: 'Lunch Menu', imageSource: 'https://cdn-icons-png.flaticon.com/128/561/561611.png', navigateToTab: 'FoodScreen' },
    { id: 'qa9', title: 'Health Info', imageSource: 'https://cdn-icons-png.flaticon.com/128/2382/2382533.png', navigateToTab: 'StudentHealthScreen' },
    { id: 'qa10', title: 'Group chat', imageSource: 'https://cdn-icons-png.flaticon.com/128/6576/6576146.png', navigateTo: 'ChatFeature' },
    { id: 'qa11', title: 'Events', imageSource: 'https://cdn-icons-png.flaticon.com/128/9592/9592283.png', navigateToTab: 'StudentEventsScreen' },
    { id: 'qa15', title: 'Exam Schedules', imageSource: 'https://cdn-icons-png.flaticon.com/128/15447/15447954.png', navigateToTab: 'StudentExamScreen' },
    { id: 'qa13', title: 'Digital Labs', imageSource: 'https://cdn-icons-png.flaticon.com/128/17104/17104528.png', navigateToTab: 'StudentLabsScreen' },
    { id: 'qa18', title: 'Progress Reports', imageSource: 'https://cdn-icons-png.flaticon.com/128/1378/1378646.png', navigateTo: 'StudentProgressReport' },
    { id: 'qa15', title: 'Study Materials', imageSource: 'https://cdn-icons-png.flaticon.com/128/3273/3273259.png', navigateToTab: 'StudentMaterialsScreen' },
    { id: 'qa20', title: 'Syllabus Tracking', imageSource: 'https://cdn-icons-png.flaticon.com/128/1584/1584937.png', navigateToTab: 'StudentSyllabusNavigator' },
    { id: 'qa22', title: 'Textbooks', imageSource: 'https://cdn-icons-png.flaticon.com/128/4541/4541151.png', navigateToTab: 'StudentResourcesScreen' },
    // { id: 'qa-ads-create', title: 'Create Ad', imageSource: 'https://cdn-icons-png.flaticon.com/128/4944/4944482.png', navigateTo: 'CreateAdScreen' },
    

  ];

  const [filteredItems, setFilteredItems] = useState(allQuickAccessItems);

  useEffect(() => {
    setFilteredItems(searchQuery.trim() === '' ? allQuickAccessItems : allQuickAccessItems.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase())));
  }, [searchQuery]);

  const handleLogout = () => { Alert.alert("Logout", "Are you sure you want to log out?", [{ text: "Cancel", style: "cancel" }, { text: "Logout", onPress: logout, style: "destructive" }], { cancelable: true }); };

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
              <TextInput style={styles.searchInput} placeholder="Search modules..." placeholderTextColor={TEXT_COLOR_MEDIUM} value={searchQuery} onChangeText={setSearchQuery} clearButtonMode="while-editing" />
            </View>
            <ScrollView contentContainerStyle={styles.contentScrollViewContainer}>
              <View style={styles.dashboardGrid}>
                {filteredItems.map(item => (
                  <DashboardCard
                    key={item.id}
                    item={item}
                    onPress={() => {
                      if (item.navigateTo) {
                        navigation.navigate(item.navigateTo);
                      } else if (item.navigateToTab) {
                        switchTab(item.navigateToTab);
                      } else {
                        Alert.alert(item.title, `Coming soon!`);
                      }
                    }}
                  />
                ))}
                {filteredItems.length % 3 === 2 && <View style={styles.placeholderCard} />}
                {filteredItems.length % 3 === 1 && <><View style={styles.placeholderCard} /><View style={styles.placeholderCard} /></>}
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
      case 'calendar': return ( <><ContentScreenHeader title="Academic Calendar" onBack={handleBack} /><AcademicCalendar /></> );
      case 'profile': return ( <><ContentScreenHeader title="My Profile" onBack={handleBack} /><ProfileScreen /></> );
      // ★★★ THIS CASE IS NO LONGER NEEDED AND HAS BEEN REMOVED ★★★
      case 'Timetable': return ( <><ContentScreenHeader title="Time Table" onBack={handleBack} /><TimetableScreen /></> );
      case 'Attendance': return ( <><ContentScreenHeader title="Attendance" onBack={handleBack} /><AttendanceScreen /></> );
      case 'AboutUs': return ( <><ContentScreenHeader title="About Us" onBack={handleBack} /><AboutUs /></> );
      case 'StudentExamsScreen': return ( <><ContentScreenHeader title="Exams" onBack={handleBack} /><StudentExamsScreen /></> );
      case 'StudentPTMScreen': return ( <><ContentScreenHeader title="Parents-Teacher Meetings" onBack={handleBack} /><StudentPTMScreen /></> );
      case 'OnlineClassScreen': return ( <><ContentScreenHeader title="Online Class" onBack={handleBack} /><OnlineClassScreen /></> );
      case 'FoodScreen': return ( <><ContentScreenHeader title="Lunch Menu" onBack={handleBack} /><FoodScreen /></> );
      case 'StudentHealthScreen': return ( <><ContentScreenHeader title="Health Info" onBack={handleBack} /><StudentHealthScreen /></> );
      // case 'GroupChatScreen': return ( <><ContentScreenHeader title="Group Chat" onBack={handleBack} /><GroupChatScreen /></> );
      case 'StudentEventsScreen': return ( <><ContentScreenHeader title="Events" onBack={handleBack} /><StudentEventsScreen /></> );
      case 'StudentExamScreen': return ( <><ContentScreenHeader title="Exam Schedules" onBack={handleBack} /><StudentExamScreen /></> );
      case 'StudentLabsScreen': return ( <><ContentScreenHeader title="Digital Labs" onBack={handleBack} /><StudentLabsScreen /></> );
      // case 'StudentReportCardScreen': return ( <><ContentScreenHeader title="Progress Reports" onBack={handleBack} /><StudentReportCardScreen /></> );
      case 'StudentMaterialsScreen': return ( <><ContentScreenHeader title="Study Materials" onBack={handleBack} /><StudentMaterialsScreen /></> );
      case 'StudentSyllabusNavigator': return ( <><ContentScreenHeader title="Syllabus Tracking" onBack={handleBack} /><StudentSyllabusScreen /></> );
      case 'StudentResourcesScreen': return ( <><ContentScreenHeader title="Textbooks" onBack={handleBack} /><StudentResourcesScreen /></> );

      case 'ActivitiesScreen': return ( <><ContentScreenHeader title="Extracurricular Activities" onBack={handleBack} /><ActivitiesScreen /></> );
      case 'DictionaryScreen': return ( <><ContentScreenHeader title="Dictionary" onBack={handleBack} /><DictionaryScreen /></> );
      case 'TransportScreen': return ( <><ContentScreenHeader title="Transport" onBack={handleBack} /><TransportScreen /></> );
      case 'LibraryHomeScreen': return ( <><ContentScreenHeader title="Library" onBack={handleBack} /><LibraryHomeScreen /></> );
      case 'MyPerformance': return ( <><ContentScreenHeader title="My Performance" onBack={handleBack} /><MyPerformance /></> );
      

      default: return ( <View style={styles.fallbackContent}><Text style={styles.fallbackText}>Content for '{activeTab}' is not available.</Text><TouchableOpacity onPress={handleBack}><Text style={styles.fallbackLink}>Go to Home</Text></TouchableOpacity></View> );
    }
  };

  return (
    <LinearGradient colors={GRADIENT_COLORS} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        {activeTab === 'home' && (
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.profileContainer} onPress={() => setProfileModalVisible(true)} activeOpacity={0.8}>
              <FastImage source={profileImageSource} style={styles.profileImage} />
              <View style={styles.profileTextContainer}>
                <Text style={styles.profileNameText} numberOfLines={1}>{user?.full_name || 'Student'}</Text>
                <Text style={styles.profileRoleText}>{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Student'}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.topBarActions}>
              <TouchableOpacity onPress={() => switchTab('allNotifications')} style={styles.iconButton}>
                <MaterialIcons name="notifications-none" size={26} color={PRIMARY_COLOR} />
                {unreadNotificationsCount > 0 && (<View style={styles.notificationCountBubble}><Text style={styles.notificationCountText}>{unreadNotificationsCount}</Text></View>)}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
                <MaterialIcons name="logout" size={24} color={PRIMARY_COLOR} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        <View style={styles.mainContent}>{renderContent()}</View>

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
              <FastImage source={profileImageSource} style={styles.enlargedProfileImage} />
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

const DashboardCard = ({ item, onPress }) => (
  <TouchableOpacity style={styles.dashboardCardWrapper} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.dashboardCard}>
      <View style={styles.cardIconContainer}>
        <Image source={{ uri: item.imageSource }} style={styles.cardImage} />
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
    </View>
  </TouchableOpacity>
);

const BottomNavItem = ({ icon, label, isActive, onPress }) => (
  <TouchableOpacity style={styles.navItem} onPress={onPress}>
    <Icon name={icon} size={24} color={isActive ? PRIMARY_COLOR : TEXT_COLOR_MEDIUM} />
    <Text style={[styles.navText, isActive && styles.navTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  mainContent: { flex: 1 },
  topBar: { backgroundColor: SECONDARY_COLOR, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 12 : 15, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#455A64', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, },
  profileContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  profileImage: { width: 45, height: 45, borderRadius: 22.5, borderWidth: 2, borderColor: PRIMARY_COLOR, backgroundColor: '#e0e0e0' },
  profileTextContainer: { marginLeft: 12, flex: 1 },
  profileNameText: { color: PRIMARY_COLOR, fontSize: 18, fontWeight: 'bold' },
  profileRoleText: { color: TEXT_COLOR_MEDIUM, fontSize: 14 },
  topBarActions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { position: 'relative', padding: 8 },
  notificationCountBubble: { position: 'absolute', top: 3, right: 3, backgroundColor: DANGER_COLOR, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  notificationCountText: { color: WHITE, fontSize: 11, fontWeight: 'bold' },
  contentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: SECONDARY_COLOR, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  backButtonGlobal: { padding: 5 },
  contentHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: PRIMARY_COLOR, textAlign: 'center', flex: 1 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 12, marginHorizontal: CONTENT_HORIZONTAL_PADDING, marginTop: 15, marginBottom: 5, borderColor: BORDER_COLOR, borderWidth: 1, elevation: 2 },
  searchIcon: { marginLeft: 15 },
  searchInput: { flex: 1, height: 48, paddingLeft: 10, fontSize: 16, color: TEXT_COLOR_DARK },
  noResultsContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50, paddingHorizontal: 20 },
  noResultsText: { fontSize: 16, color: TEXT_COLOR_MEDIUM, textAlign: 'center' },
  contentScrollViewContainer: { paddingHorizontal: CONTENT_HORIZONTAL_PADDING, paddingTop: 10, paddingBottom: 20, flexGrow: 1, },
  dashboardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  dashboardCardWrapper: { width: (windowWidth - (CONTENT_HORIZONTAL_PADDING * 2) - (CARD_GAP * 2)) / 3, marginBottom: CARD_GAP },
  dashboardCard: { borderRadius: 10, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', height: 115, backgroundColor: WHITE, shadowColor: '#455A64', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3, borderWidth: 1, borderColor: BORDER_COLOR },
  cardIconContainer: { width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  cardImage: { width: 38, height: 38, resizeMode: 'contain' },
  cardTitle: { fontSize: 11, fontWeight: '600', color: TEXT_COLOR_DARK, textAlign: 'center', lineHeight: 14, paddingHorizontal: 4 },
  bottomNav: { flexDirection: 'row', backgroundColor: SECONDARY_COLOR, borderTopWidth: 1, borderTopColor: BORDER_COLOR, paddingVertical: Platform.OS === 'ios' ? 10 : 8, paddingBottom: Platform.OS === 'ios' ? 20 : 8, minHeight: BOTTOM_NAV_HEIGHT },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 5 },
  navText: { fontSize: 10, color: TEXT_COLOR_MEDIUM, marginTop: 3 },
  navTextActive: { color: PRIMARY_COLOR, fontWeight: 'bold' },
  fallbackContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: TERTIARY_COLOR },
  fallbackText: { fontSize: 16, color: TEXT_COLOR_MEDIUM, textAlign: 'center', marginBottom: 10 },
  fallbackLink: { fontSize: 16, color: PRIMARY_COLOR, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center' },
  enlargedProfileImage: { width: windowWidth * 0.8, height: windowWidth * 0.8, borderRadius: (windowWidth * 0.8) / 2, borderWidth: 4, borderColor: '#fff' },
  closeModalButton: { position: 'absolute', top: 50, right: 20, padding: 10, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)' },
  placeholderCard: {
    width: (windowWidth - (CONTENT_HORIZONTAL_PADDING * 2) - (CARD_GAP * 2)) / 3,
  },
});

export default StudentDashboard;