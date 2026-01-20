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
  // --- CHANGE 1: REMOVE standard Image component ---
  // Image,
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
import { SERVER_URL } from '../../apiConfig';
import apiClient from '../api/client';
// --- CHANGE 2: IMPORT FastImage and the standard Image component for the card icons ---
import FastImage from 'react-native-fast-image';
import { Image } from 'react-native'; // Keep this for non-cached images like icons

// --- COMPONENT IMPORTS ---
import NotificationsScreen from '../screens/NotificationsScreen';
import AcademicCalendar from './AcademicCalendar';
import AdminLM from './AdminLM';
import ProfileScreen from '../screens/ProfileScreen';
import TimetableScreen from '../screens/TimetableScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import MarkStudentAttendance from '../screens/MarkStudentAttendance';
import TeacherAdminHomeworkScreen from '../screens/homework/TeacherAdminHomeworkScreen';
import AboutUs from './AboutUs';
import TeacherAdminExamsScreen from '../screens/exams/TeacherAdminExamsScreen';
import TeacherAdminPTMScreen from '../screens/ptm/TeacherAdminPTMScreen';
import OnlineClassScreen from '../screens/Online_Class/OnlineClassScreen';
import FoodScreen from '../screens/food/FoodScreen';
import TeacherHealthAdminScreen from '../screens/health/TeacherHealthAdminScreen';
// import GroupChatScreen from '../screens/chat/GroupChatScreen';
import AlumniScreen from '../screens/Alumni/AlumniScreen';
import PreAdmissionsScreen from '../screens/Pre-Admissions/PreAdmissionsScreen';
import AdminEventsScreen from '../screens/events/AdminEventsScreen';
import TeacherAdminExamScreen from '../screens/exams_Schedule/TeacherAdminExamScreen';
import KitchenScreen from '../screens/kitchen/KitchenScreen';
import TeacherAdminLabsScreen from '../screens/labs/TeacherAdminLabsScreen';
// import MarksEntryScreen from '../screens/report/MarksEntryScreen';
import TeacherAdminMaterialsScreen from '../screens/study-materials/TeacherAdminMaterialsScreen';
import AdminSyllabusScreen from '../screens/syllabus/AdminSyllabusScreen';
import TeacherAdminResourcesScreen from '../screens/syllabus_Textbook/TeacherAdminResourcesScreen';
import TeacherAttendanceMarkingScreen from '../screens/teacher_attendence/TeacherAttendanceMarkingScreen';

import TeacherPerformanceScreen from '../screens/Performance/TeacherPerformanceScreen';
import StudentPerformance from '../screens/Performance/StudentPerformance';
import StudentStackNavigator from '../screens/StudentStackNavigator';
import StaffNavigator from '../screens/StaffNavigator';
import AccountsScreen from '../screens/Accounts/AccountsScreen';

import ActivitiesScreen from '../screens/Extra_activity/ActivitiesScreen';
import DictionaryScreen from '../screens/dictionary/DictionaryScreen';
import TransportScreen from '../screens/transport/TransportScreen';
import LibraryHomeScreen from '../screens/library/LibraryHomeScreen';
import PerformanceFilter from '../screens/report/PerformanceFilter';
import TeacherFilter from '../screens/report/TeacherFilter';

import StudentFeedback from '../screens/Feedbacks/StudentFeedback';
import TeacherFeedback from '../screens/Feedbacks/TeacherFeedback';

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
const GRADIENT_COLORS = [TERTIARY_COLOR, '#ffffffff'];

const MAIN_TABS = ['home', 'calendar', 'profile'];

const AdminDashboard = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const isFocused = useIsFocused();
  const [isProfileModalVisible, setProfileModalVisible] = useState(false);
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(true);
  
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

  // --- CHANGE 3: CONSTRUCT a source object suitable for FastImage ---
  // This tells FastImage to prioritize loading this image and enables its caching.
  const profileImageSource = user?.profile_image_url
    ? {
        uri: `${SERVER_URL}${user.profile_image_url}?t=${new Date().getTime()}`,
        priority: FastImage.priority.high, // Prioritize loading this image
      }
    : require('../assets/default_avatar.png');

  const allQuickAccessItems = [
    { id: 'qa0', title: 'Manage Login', imageSource: 'https://cdn-icons-png.flaticon.com/128/15096/15096966.png', navigateToTab: 'AdminLM' },
    { id: 'qa1', title: 'Accounts', imageSource: 'https://cdn-icons-png.flaticon.com/128/1552/1552545.png', navigateToTab: 'AccountsScreen' },
    { id: 'qa2', title: 'Library', imageSource: 'https://cdn-icons-png.flaticon.com/128/9043/9043296.png', navigateToTab: 'LibraryHomeScreen' },
    { id: 'qa3', title: 'Students Status Report', imageSource: 'https://cdn-icons-png.flaticon.com/128/9733/9733233.png', navigateToTab: 'PerformanceFilter' },
    { id: 'qa4', title: 'Teacher Status Report', imageSource: 'https://cdn-icons-png.flaticon.com/128/3094/3094910.png', navigateToTab: 'TeacherFilter' },
    // { id: 'qa100', title: 'Transport', imageSource: 'https://cdn-icons-png.flaticon.com/128/3124/3124263.png', navigateToTab: 'TransportScreen' },
    { id: 'qa5', title: 'Staff', imageSource: 'https://cdn-icons-png.flaticon.com/128/12105/12105197.png', navigateToTab: 'StaffNavigator' },
    { id: 'qa6', title: 'Students', imageSource: 'https://cdn-icons-png.flaticon.com/128/16405/16405976.png', navigateToTab: 'StudentStackNavigator' },
    { id: 'qa7', title: 'Teacher Performance', imageSource: 'https://cdn-icons-png.flaticon.com/128/3094/3094829.png', navigateToTab: 'TeacherPerformanceScreen' },
    { id: 'qa8', title: 'Student Performance', imageSource: 'https://cdn-icons-png.flaticon.com/128/15175/15175651.png', navigateToTab: 'StudentPerformance' },
    { id: 'qa9', title: 'Marks Entry', imageSource: 'https://cdn-icons-png.flaticon.com/128/18479/18479099.png', navigateTo: 'ReportScreen' },
    { id: 'qa10', title: 'Time Table', imageSource: 'https://cdn-icons-png.flaticon.com/128/1254/1254275.png', navigateToTab: 'Timetable' },
    { id: 'qa11', title: 'Mark Student Attendance', imageSource: 'https://cdn-icons-png.flaticon.com/128/3125/3125856.png', navigateToTab: 'MarkStudentAttendance' },
    { id: 'qa12', title: 'Student Attendance', imageSource: 'https://cdn-icons-png.flaticon.com/128/10293/10293877.png', navigateToTab: 'Attendance' },
    { id: 'qa13', title: 'Teacher Attendence', imageSource: 'https://cdn-icons-png.flaticon.com/128/12404/12404284.png', navigateToTab: 'TeacherAttendanceMarkingScreen' },
    { id: 'qa14', title: 'Homework', imageSource: 'https://cdn-icons-png.flaticon.com/128/11647/11647336.png', navigateToTab: 'TeacherAdminHomeworkScreen' },
    // { id: 'qa200', title: 'Extracurricular Activities', imageSource: 'https://cdn-icons-png.flaticon.com/128/12693/12693554.png', navigateToTab: 'ActivitiesScreen' },
    { id: 'qa15', title: 'Gallery', imageSource: 'https://cdn-icons-png.flaticon.com/128/8418/8418513.png', navigateTo: 'Gallery' },
    { id: 'qa16', title: 'Exams', imageSource: 'https://cdn-icons-png.flaticon.com/128/9913/9913475.png', navigateToTab: 'TeacherAdminExamsScreen' },
    { id: 'qa32', title: 'Dictionary', imageSource: 'https://cdn-icons-png.flaticon.com/128/4033/4033369.png', navigateToTab: 'DictionaryScreen' },
    { id: 'qa17', title: 'PTM', imageSource: 'https://cdn-icons-png.flaticon.com/128/11277/11277118.png', navigateToTab: 'TeacherAdminPTMScreen' },
    { id: 'qa18', title: 'Online class', imageSource: 'https://cdn-icons-png.flaticon.com/128/3214/3214781.png', navigateToTab: 'OnlineClassScreen' },
    { id: 'qa19', title: 'Lunch Menu', imageSource: 'https://cdn-icons-png.flaticon.com/128/561/561611.png', navigateToTab: 'FoodScreen' },
    { id: 'qa20', title: 'Health Info', imageSource: 'https://cdn-icons-png.flaticon.com/128/2382/2382533.png', navigateToTab: 'TeacherHealthAdminScreen' },
    { id: 'qa21', title: 'Group chat', imageSource: 'https://cdn-icons-png.flaticon.com/128/6576/6576146.png', navigateTo: 'ChatFeature' },
    { id: 'qa22', title: 'Alumni', imageSource: 'https://cdn-icons-png.flaticon.com/128/9517/9517272.png', navigateToTab: 'AlumniScreen' },
    { id: 'qa23', title: 'Pre-Admissions', imageSource: 'https://cdn-icons-png.flaticon.com/128/10220/10220958.png', navigateToTab: 'PreAdmissionsScreen' },
    { id: 'qa24', title: 'Events', imageSource: 'https://cdn-icons-png.flaticon.com/128/9592/9592283.png', navigateToTab: 'AdminEventsScreen' },
    { id: 'qa25', title: 'Exam Schedules', imageSource: 'https://cdn-icons-png.flaticon.com/128/15447/15447954.png', navigateToTab: 'TeacherAdminExamScreen' },
    { id: 'qa26', title: 'Kitchen', imageSource: 'https://cdn-icons-png.flaticon.com/128/1698/1698742.png', navigateToTab: 'KitchenScreen' },
    { id: 'qa27', title: 'Digital Labs', imageSource: 'https://cdn-icons-png.flaticon.com/128/17104/17104528.png', navigateToTab: 'TeacherAdminLabsScreen' },
    { id: 'qa28', title: 'Study Materials', imageSource: 'https://cdn-icons-png.flaticon.com/128/3273/3273259.png', navigateToTab: 'TeacherAdminMaterialsScreen' },
    { id: 'qa29', title: 'Syllabus Tracking', imageSource: 'https://cdn-icons-png.flaticon.com/128/1584/1584937.png', navigateToTab: 'AdminSyllabusScreen' },
    { id: 'qa30', title: 'Textbooks', imageSource: 'https://cdn-icons-png.flaticon.com/128/4541/4541151.png', navigateToTab: 'TeacherAdminResourcesScreen' },
    { id: 'qa31', title: 'About Us', imageSource: 'https://cdn-icons-png.flaticon.com/128/3815/3815523.png', navigateToTab: 'AboutUs' },
    { id: 'qa33', title: 'Student Feedback', imageSource: 'https://cdn-icons-png.flaticon.com/128/2839/2839244.png', navigateToTab: 'StudentFeedback' },
    { id: 'qa60', title: 'Teacher Feedback', imageSource: 'https://cdn-icons-png.flaticon.com/128/11871/11871051.png', navigateToTab: 'TeacherFeedback' },
    // { id: 'qa-ads-manage', title: 'Ads Management', imageSource: 'https://cdn-icons-png.flaticon.com/128/19006/19006038.png', navigateTo: 'AdminAdDashboardScreen' },
    // { id: 'qa-ads-create', title: 'Create Ad', imageSource: 'https://cdn-icons-png.flaticon.com/128/4944/4944482.png', navigateTo: 'CreateAdScreen' },

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
    // ... No changes inside renderContent ...
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
                          if (item.navigateTo) {
                              navigation.navigate(item.navigateTo);
                          } else if (item.navigateToTab) {
                              switchTab(item.navigateToTab);
                          } else {
                              Alert.alert(item.title, `This feature is coming soon!`);
                          }
                      }} />
                    ))}
                    {filteredItems.length % 3 === 2 && <View style={styles.placeholderCard} />}
                    {filteredItems.length % 3 === 1 && <><View style={styles.placeholderCard} /><View style={styles.placeholderCard} /></>}
                </View>
                {filteredItems.length === 0 && (<View style={styles.noResultsContainer}><Text style={styles.noResultsText}>No modules found for "{searchQuery}"</Text></View>)}
              </ScrollView>
            </>
          );
  
        case 'allNotifications': return ( <><ContentScreenHeader title="Notifications" onBack={handleBack} /><NotificationsScreen onUnreadCountChange={setUnreadNotificationsCount} /></> );
        case 'calendar': return ( <><ContentScreenHeader title="Academic Calendar" onBack={handleBack} /><AcademicCalendar /></> );
        case 'profile': return ( <><ContentScreenHeader title="My Profile" onBack={handleBack} /><ProfileScreen /></> );
        case 'AdminLM': return ( <><ContentScreenHeader title="Login Management" onBack={handleBack} /><AdminLM /></> );
        case 'Timetable': return ( <><ContentScreenHeader title="Time Table Management" onBack={handleBack} /><TimetableScreen /></> );
        case 'Attendance': return ( <><ContentScreenHeader title="Attendance" onBack={handleBack} /><AttendanceScreen /></> );
        case 'MarkStudentAttendance': return ( <><ContentScreenHeader title="Mark Student Attendance" onBack={handleBack} /><MarkStudentAttendance /></> );
        case 'TeacherAdminHomeworkScreen': return ( <> <ContentScreenHeader title="Homework" onBack={handleBack} /> <TeacherAdminHomeworkScreen /> </> );
        case 'AboutUs': return ( <><ContentScreenHeader title="About Us" onBack={handleBack} /><AboutUs /></> );
        case 'TeacherAdminExamsScreen': return ( <><ContentScreenHeader title="Exams" onBack={handleBack} /><TeacherAdminExamsScreen /></> );
        case 'TeacherAdminPTMScreen': return ( <><ContentScreenHeader title="Parents-Teacher Meetings" onBack={handleBack} /><TeacherAdminPTMScreen /></> );
        case 'OnlineClassScreen': return ( <><ContentScreenHeader title="Online Class" onBack={handleBack} /><OnlineClassScreen /></> );
        case 'FoodScreen': return ( <><ContentScreenHeader title="Lunch Menu" onBack={handleBack} /><FoodScreen /></> );
        case 'TeacherHealthAdminScreen': return ( <><ContentScreenHeader title="Healh Info" onBack={handleBack} /><TeacherHealthAdminScreen /></> );
        // case 'GroupChatScreen': return ( <><ContentScreenHeader title="Group Chat" onBack={handleBack} /><GroupChatScreen /></> );
        case 'AlumniScreen': return ( <><ContentScreenHeader title="Alumni" onBack={handleBack} /><AlumniScreen /></> );
        case 'PreAdmissionsScreen': return ( <><ContentScreenHeader title="Pre-Admissions" onBack={handleBack} /><PreAdmissionsScreen /></> );
        case 'AdminEventsScreen': return ( <><ContentScreenHeader title="Events" onBack={handleBack} /><AdminEventsScreen /></> );
        case 'TeacherAdminExamScreen': return ( <><ContentScreenHeader title="Exam Schedules" onBack={handleBack} /><TeacherAdminExamScreen /></> );
        case 'KitchenScreen': return ( <><ContentScreenHeader title="Kitchen" onBack={handleBack} /><KitchenScreen /></> );
        case 'TeacherAdminLabsScreen': return ( <><ContentScreenHeader title="Digital Labs" onBack={handleBack} /><TeacherAdminLabsScreen /></> );
        // case 'MarksEntryScreen': return ( <><ContentScreenHeader title="Progress Reports" onBack={handleBack} /><MarksEntryScreen /></> );
        case 'TeacherAdminMaterialsScreen': return ( <><ContentScreenHeader title="Study Materials" onBack={handleBack} /><TeacherAdminMaterialsScreen /></> );
        case 'AdminSyllabusScreen': return ( <><ContentScreenHeader title="Syllabus Tracking" onBack={handleBack} /><AdminSyllabusScreen /></> );
        case 'TeacherAdminResourcesScreen': return ( <><ContentScreenHeader title="Textbooks" onBack={handleBack} /><TeacherAdminResourcesScreen /></> );
        case 'TeacherAttendanceMarkingScreen': return ( <><ContentScreenHeader title="Teacher Attendence" onBack={handleBack} /><TeacherAttendanceMarkingScreen /></> );
        case 'TeacherPerformanceScreen': return ( <><ContentScreenHeader title="Teacher Performance" onBack={handleBack} /><TeacherPerformanceScreen /></> );
        case 'StudentPerformance': return ( <><ContentScreenHeader title="Student Performance" onBack={handleBack} /><StudentPerformance /></> );
        case 'StudentStackNavigator': return ( <><ContentScreenHeader title="Students" onBack={handleBack} /><StudentStackNavigator /></> );
        case 'StaffNavigator': return ( <><ContentScreenHeader title="Staff" onBack={handleBack} /><StaffNavigator /></> );
        case 'AccountsScreen': return ( <><ContentScreenHeader title="Accounts" onBack={handleBack} /><AccountsScreen /></> );
        case 'ActivitiesScreen': return ( <><ContentScreenHeader title="Extracurricular Activities" onBack={handleBack} /><ActivitiesScreen /></> );
        case 'DictionaryScreen': return ( <><ContentScreenHeader title="Dictionary" onBack={handleBack} /><DictionaryScreen /></> );
        case 'TransportScreen': return ( <><ContentScreenHeader title="Transport" onBack={handleBack} /><TransportScreen /></> );
        case 'LibraryHomeScreen': return ( <><ContentScreenHeader title="Library" onBack={handleBack} /><LibraryHomeScreen /></> );
        case 'PerformanceFilter': return ( <><ContentScreenHeader title="Student Status Report" onBack={handleBack} /><PerformanceFilter /></> );
        case 'TeacherFilter': return ( <><ContentScreenHeader title="Teacher Status Report" onBack={handleBack} /><TeacherFilter /></> );
        case 'StudentFeedback': return ( <><ContentScreenHeader title="Student Feedback" onBack={handleBack} /><StudentFeedback /></> );
        case 'TeacherFeedback': return ( <><ContentScreenHeader title="Teacher Feedback" onBack={handleBack} /><TeacherFeedback /></> );

        default: return ( <View style={styles.fallbackContent}><Text style={styles.fallbackText}>Content for '{activeTab}' is not available.</Text><TouchableOpacity onPress={handleBack}><Text style={styles.fallbackLink}>Go to Home</Text></TouchableOpacity></View> );
      }
  };

  return (
    <LinearGradient colors={GRADIENT_COLORS} style={{flex: 1}}>
    <SafeAreaView style={styles.safeArea}>
      {activeTab === 'home' && (
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.profileContainer} onPress={() => setProfileModalVisible(true)} activeOpacity={0.8}>
              {/* --- CHANGE 4: USE FastImage INSTEAD OF Image --- */}
              <FastImage source={profileImageSource} style={styles.profileImage} />
              <View style={styles.profileTextContainer}>
                <Text style={styles.profileNameText} numberOfLines={1}>{user?.full_name || 'Administrator'}</Text>
                <Text style={styles.profileRoleText}>{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin'}</Text>
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
                  {/* --- CHANGE 5: USE FastImage IN THE MODAL AS WELL --- */}
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

// --- Helper Components (Simplified) ---

const DashboardCard = ({ item, onPress }) => {
    return (
        <TouchableOpacity style={styles.dashboardCardWrapper} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.dashboardCard}>
                <View style={styles.cardIconContainer}>
                    {/* The standard Image component is fine for these external icons */}
                    <Image source={{ uri: item.imageSource }} style={styles.cardImage} />
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
            </View>
        </TouchableOpacity>
    );
};

// ... No changes to BottomNavItem or styles ...
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