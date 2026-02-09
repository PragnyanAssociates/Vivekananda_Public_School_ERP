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
  Platform,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
  Image,
  FlatList,
  BackHandler,
  useColorScheme // Added for Dark/Light mode detection
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { SERVER_URL } from '../../apiConfig';
import apiClient from '../api/client';
import FastImage from 'react-native-fast-image';

// --- COMPONENT IMPORTS ---
// (All your existing imports remain here)
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
import AlumniScreen from '../screens/Alumni/AlumniScreen';
import PreAdmissionsScreen from '../screens/Pre-Admissions/PreAdmissionsScreen';
import AdminEventsScreen from '../screens/events/AdminEventsScreen';
import TeacherAdminExamScreen from '../screens/exams_Schedule/TeacherAdminExamScreen';
import KitchenScreen from '../screens/kitchen/KitchenScreen';
import TeacherAdminLabsScreen from '../screens/labs/TeacherAdminLabsScreen';
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
import StudentAttendance from '../screens/StudentAttendance';

// --- CONSTANTS ---
const { width: windowWidth } = Dimensions.get('window');
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
  // View State: 'dashboard' (Main Categories) OR 'category_detail' (Sub-modules)
  const [currentView, setCurrentView] = useState('dashboard'); 
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  const { user, logout } = useAuth();
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const isFocused = useIsFocused();
  const [isProfileModalVisible, setProfileModalVisible] = useState(false);
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(true);

  // Hook for Dark/Light Mode
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  // --- 1. DEFINE THE DATA STRUCTURE ---
  // We group modules into Main Categories. Each Category has an Image and a list of Sub-Modules.
  
  const MAIN_CATEGORIES = [
    {
        id: 'cat_admin',
        title: 'Administration',
        subtitle: 'Logins, Accounts, Alumni & Gallery.',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/2345/2345338.png', // Admin Icon
        subModules: [
            { id: 'qa0', title: 'Manage Login', imageSource: 'https://cdn-icons-png.flaticon.com/128/15096/15096966.png', navigateToTab: 'AdminLM' },
            { id: 'qa1', title: 'Accounts', imageSource: 'https://cdn-icons-png.flaticon.com/128/1552/1552545.png', navigateToTab: 'AccountsScreen' },
            { id: 'qa2', title: 'Pre-Admissions', imageSource: 'https://cdn-icons-png.flaticon.com/128/1552/1552545.png', navigateToTab: 'PreAdmissionsScreen' },
            { id: 'qa3', title: 'Alumni', imageSource: 'https://cdn-icons-png.flaticon.com/128/9517/9517272.png', navigateToTab: 'AlumniScreen' },
            { id: 'qa4', title: 'About Us', imageSource: 'https://cdn-icons-png.flaticon.com/128/3815/3815523.png', navigateToTab: 'AboutUs' },
            { id: 'qa5', title: 'Gallery', imageSource: 'https://cdn-icons-png.flaticon.com/128/8418/8418513.png', navigateTo: 'Gallery' },
        ]
    },
       {
        id: 'cat_Teachers',
        title: 'Teachers',
        subtitle: 'Attendance, Performance & PTM. ',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/1995/1995574.png',
        subModules: [
            { id: 'qa6', title: 'Staff List', imageSource: 'https://cdn-icons-png.flaticon.com/128/12105/12105197.png', navigateToTab: 'StaffNavigator' },
            { id: 'qa7', title: 'Teachers Performance Report', imageSource: 'https://cdn-icons-png.flaticon.com/128/3094/3094829.png', navigateToTab: 'TeacherFilter' },
            { id: 'qa8', title: 'Teacher Attendance', imageSource: 'https://cdn-icons-png.flaticon.com/128/12404/12404284.png', navigateToTab: 'TeacherAttendanceMarkingScreen' },
            { id: 'qa9', title: 'Teacher Feedback', imageSource: 'https://cdn-icons-png.flaticon.com/128/8540/8540828.png', navigateToTab: 'TeacherFeedback' },
            { id: 'qa10', title: 'PTM', imageSource: 'https://cdn-icons-png.flaticon.com/128/11277/11277118.png', navigateToTab: 'TeacherAdminPTMScreen' },
        ]
    },
    {
        id: 'cat_students',
        title: 'Students',
        subtitle: 'Attendance, Performance & Health Info.',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/2784/2784403.png',
        subModules: [
            { id: 'qa11', title: 'Students List', imageSource: 'https://cdn-icons-png.flaticon.com/128/16405/16405976.png', navigateToTab: 'StudentStackNavigator' },
            { id: 'qa12', title: 'Students  Performance Report', imageSource: 'https://cdn-icons-png.flaticon.com/128/15175/15175651.png', navigateToTab: 'PerformanceFilter' },
            { id: 'qa13', title: 'Student Attendance', imageSource: 'https://cdn-icons-png.flaticon.com/128/10293/10293877.png', navigateToTab: 'StudentAttendance' },
            { id: 'qa14', title: 'Student Feedback', imageSource: 'https://cdn-icons-png.flaticon.com/128/2839/2839244.png', navigateToTab: 'StudentFeedback' },
            { id: 'qa15', title: 'Health Info', imageSource: 'https://cdn-icons-png.flaticon.com/128/2382/2382533.png', navigateToTab: 'TeacherHealthAdminScreen' },
        ]
    },
    {
        id: 'cat_academic',
        title: 'Academics',
        subtitle: 'Timetable, Syllabus, Homework & Exams.',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/1773/1773017.png',
        subModules: [
            { id: 'qa16', title: 'Time Table', imageSource: 'https://cdn-icons-png.flaticon.com/128/1254/1254275.png', navigateToTab: 'Timetable' },
            { id: 'qa17', title: 'Syllabus Tracking', imageSource: 'https://cdn-icons-png.flaticon.com/128/1584/1584937.png', navigateToTab: 'AdminSyllabusScreen' },
            { id: 'qa18', title: 'Online Class', imageSource: 'https://cdn-icons-png.flaticon.com/128/3214/3214781.png', navigateToTab: 'OnlineClassScreen' },
            { id: 'qa19', title: 'Homework', imageSource: 'https://cdn-icons-png.flaticon.com/128/11647/11647336.png', navigateToTab: 'TeacherAdminHomeworkScreen' },
            { id: 'qa20', title: 'Exams', imageSource: 'https://cdn-icons-png.flaticon.com/128/9913/9913475.png', navigateToTab: 'TeacherAdminExamsScreen' },
            { id: 'qa21', title: 'Exam Schedules', imageSource: 'https://cdn-icons-png.flaticon.com/128/15447/15447954.png', navigateToTab: 'TeacherAdminExamScreen' },
            { id: 'qa22', title: 'Marks Entry', imageSource: 'https://cdn-icons-png.flaticon.com/128/18479/18479099.png', navigateTo: 'ReportScreen' },
            { id: 'qa23', title: 'Group Chat', imageSource: 'https://cdn-icons-png.flaticon.com/128/6576/6576146.png', navigateTo: 'ChatFeature' },
        ]
    },
    {
        id: 'cat_resource',
        title: 'Study Materials',
        subtitle: 'Learning Resources',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/1156/1156964.png',
        subModules: [
            { id: 'qa24', title: 'Library', imageSource: 'https://cdn-icons-png.flaticon.com/128/9043/9043296.png', navigateToTab: 'LibraryHomeScreen' },
            { id: 'qa25', title: 'Textbooks', imageSource: 'https://cdn-icons-png.flaticon.com/128/4541/4541151.png', navigateToTab: 'TeacherAdminResourcesScreen' },
            { id: 'qa26', title: 'Study Materials', imageSource: 'https://cdn-icons-png.flaticon.com/128/3273/3273259.png', navigateToTab: 'TeacherAdminMaterialsScreen' },
            { id: 'qa27', title: 'Digital Labs', imageSource: 'https://cdn-icons-png.flaticon.com/128/17104/17104528.png', navigateToTab: 'TeacherAdminLabsScreen' },
            { id: 'qa28', title: 'Dictionary', imageSource: 'https://cdn-icons-png.flaticon.com/128/4033/4033369.png', navigateToTab: 'DictionaryScreen' },
        ]
    },
    {
        id: 'cat_Extracurricular',
        title: 'Extracurricular Activities',
        subtitle: 'Sports & Kitchen',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/12693/12693554.png',
        subModules: [
            { id: 'qa29', title: 'Events', imageSource: 'https://cdn-icons-png.flaticon.com/128/9592/9592283.png', navigateToTab: 'AdminEventsScreen' },
            { id: 'qa30', title: 'Kitchen Stock', imageSource: 'https://cdn-icons-png.flaticon.com/128/1698/1698742.png', navigateToTab: 'KitchenScreen' },
            { id: 'qa31', title: 'Lunch Menu', imageSource: 'https://cdn-icons-png.flaticon.com/128/561/561611.png', navigateToTab: 'FoodScreen' },
        ]
    },
   
  ];

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
      // Handle Hardware Back Button
      const backAction = () => {
        if (currentView === 'category_detail') {
          setCurrentView('dashboard');
          setSelectedCategory(null);
          return true; // Prevent default behavior
        }
        return false; // Allow default behavior (exit app or go back stack)
      };
      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }
  }, [isFocused, fetchUnreadCount, currentView]);

  const profileImageSource = user?.profile_image_url
    ? {
        uri: `${SERVER_URL}${user.profile_image_url}?t=${new Date().getTime()}`,
        priority: FastImage.priority.high, 
      }
    : require('../assets/default_avatar.png');

  const handleLogout = () => { Alert.alert("Logout", "Are you sure?", [{ text: "Cancel", style: "cancel" }, { text: "Logout", onPress: logout, style: "destructive" }]); };

  const switchTab = (tab) => {
    if (tab === activeTab && currentView === 'dashboard') return;
    
    // If clicking Home from sub-menu, go back to dashboard
    if (tab === 'home') {
        setCurrentView('dashboard');
        setSelectedCategory(null);
    }
    setActiveTab(tab);
    setIsBottomNavVisible(MAIN_TABS.includes(tab));
  };

  const handleCategoryPress = (category) => {
      setSelectedCategory(category);
      setCurrentView('category_detail');
  };

  const handleSubModuleNavigation = (item) => {
    if (item.navigateTo) {
        navigation.navigate(item.navigateTo);
    } else if (item.navigateToTab) {
        // Special case for tabs that are main tabs
        if(item.navigateToTab === 'calendar' || item.navigateToTab === 'profile') {
            switchTab(item.navigateToTab);
        } else {
            // For screens that replace the dashboard content
            setActiveTab(item.navigateToTab);
        }
    } else {
        Alert.alert(item.title, `This feature is coming soon!`);
    }
  };

  // --- RENDERING LOGIC ---

  // 1. RENDER MAIN DASHBOARD (CATEGORIES)
  const renderDashboardCategories = () => (
      <ScrollView contentContainerStyle={styles.contentScrollViewContainer}>
          
          {/* --- NEW HEADER CARD START --- */}
          <View style={[
              styles.headerCard, 
              { backgroundColor: isDarkMode ? '#1f2937' : '#ffffff' }
          ]}>
              <View style={[
                  styles.headerIconContainer,
                  { backgroundColor: isDarkMode ? 'rgba(0, 128, 128, 0.2)' : '#e0f2f7' }
              ]}>
                  <MaterialCommunityIcons 
                    name="view-dashboard" 
                    size={28} 
                    color={PRIMARY_COLOR} 
                  />
              </View>
              <View style={styles.headerTextContainer}>
                  <Text style={[
                      styles.headerTitle,
                      { color: isDarkMode ? '#ffffff' : '#333333' }
                  ]}>Dashboard</Text>
                  <Text style={[
                      styles.headerSubtitle,
                      { color: isDarkMode ? '#9ca3af' : '#666666' }
                  ]}>Overview & Quick Access</Text>
              </View>
          </View>
          {/* --- NEW HEADER CARD END --- */}

          <View style={styles.dashboardGrid}>
              {MAIN_CATEGORIES.map((category) => (
                  <TouchableOpacity 
                    key={category.id} 
                    style={styles.categoryCard} 
                    onPress={() => handleCategoryPress(category)}
                    activeOpacity={0.8}
                  >
                      <View style={styles.categoryIconCircle}>
                         <Image source={{ uri: category.imageSource }} style={styles.categoryImage} resizeMode="contain" />
                      </View>
                      <Text style={styles.categoryTitle}>{category.title}</Text>
                      <Text style={styles.categorySubtitle}>{category.subtitle}</Text>
                  </TouchableOpacity>
              ))}
          </View>
      </ScrollView>
  );

  // 2. RENDER SUB-MODULES (Based on your "Accounts" reference)
  const renderSubCategoryView = () => {
    if (!selectedCategory) return null;

    return (
        <View style={{ flex: 1, backgroundColor: '#F2F5F8' }}>
            {/* Header Card (Matches your reference) */}
            <View style={styles.subHeaderCard}>
                <View style={styles.subHeaderIconContainer}>
                    {/* Using Image for icon consistency */}
                    <Image source={{ uri: selectedCategory.imageSource }} style={{ width: 28, height: 28 }} resizeMode="contain" />
                </View>
                <View style={styles.subHeaderTextContainer}>
                    <Text style={styles.subHeaderTitle}>{selectedCategory.title}</Text>
                    <Text style={styles.subHeaderSubtitle}>{selectedCategory.subtitle}</Text>
                </View>
                {/* Close/Back Button */}
                <TouchableOpacity onPress={() => { setCurrentView('dashboard'); setSelectedCategory(null); }} style={styles.closeSubViewButton}>
                    <MaterialIcons name="close" size={24} color="#666" />
                </TouchableOpacity>
            </View>

            {/* Grid of Sub-Modules */}
            <FlatList
                data={selectedCategory.subModules}
                keyExtractor={(item) => item.id}
                numColumns={2}
                contentContainerStyle={styles.subGridContainer}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.subCard}
                        onPress={() => handleSubModuleNavigation(item)}
                        activeOpacity={0.8}
                    >
                        <View style={styles.subCardImageContainer}>
                            <Image
                                source={{ uri: item.imageSource }}
                                style={styles.subCardImage}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={styles.subCardTitle}>{item.title}</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
  };

  const ContentScreenHeader = ({ title, onBack }) => ( 
    <View style={styles.contentHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButtonGlobal}>
            <MaterialIcons name="arrow-back" size={24} color={PRIMARY_COLOR} />
        </TouchableOpacity>
        <Text style={styles.contentHeaderTitle}>{title}</Text>
        <View style={{ width: 30 }} />
    </View> 
  );

  const renderContent = () => {
    const handleBackToHome = () => switchTab('home');

    // If we are in the 'home' tab...
    if (activeTab === 'home') {
        if (currentView === 'category_detail') {
            return renderSubCategoryView();
        }
        return renderDashboardCategories();
    }

    // ... Else render other screens
    switch (activeTab) {
        case 'allNotifications': return ( <><ContentScreenHeader title="Notifications" onBack={handleBackToHome} /><NotificationsScreen onUnreadCountChange={setUnreadNotificationsCount} /></> );
        case 'calendar': return ( <><ContentScreenHeader title="Academic Calendar" onBack={handleBackToHome} /><AcademicCalendar /></> );
        case 'profile': return ( <><ContentScreenHeader title="My Profile" onBack={handleBackToHome} /><ProfileScreen /></> );
        
        // Modules
        case 'AdminLM': return ( <><ContentScreenHeader title="Login Management" onBack={handleBackToHome} /><AdminLM /></> );
        case 'Timetable': return ( <><ContentScreenHeader title="Time Table Management" onBack={handleBackToHome} /><TimetableScreen /></> );
        case 'Attendance': return ( <><ContentScreenHeader title="Attendance" onBack={handleBackToHome} /><AttendanceScreen /></> );
        case 'MarkStudentAttendance': return ( <><ContentScreenHeader title="Mark Student Attendance" onBack={handleBackToHome} /><MarkStudentAttendance /></> );
        case 'TeacherAdminHomeworkScreen': return ( <> <ContentScreenHeader title="Homework" onBack={handleBackToHome} /> <TeacherAdminHomeworkScreen /> </> );
        case 'AboutUs': return ( <><ContentScreenHeader title="About Us" onBack={handleBackToHome} /><AboutUs /></> );
        case 'TeacherAdminExamsScreen': return ( <><ContentScreenHeader title="Exams" onBack={handleBackToHome} /><TeacherAdminExamsScreen /></> );
        case 'TeacherAdminPTMScreen': return ( <><ContentScreenHeader title="Parents-Teacher Meetings" onBack={handleBackToHome} /><TeacherAdminPTMScreen /></> );
        case 'OnlineClassScreen': return ( <><ContentScreenHeader title="Online Class" onBack={handleBackToHome} /><OnlineClassScreen /></> );
        case 'FoodScreen': return ( <><ContentScreenHeader title="Lunch Menu" onBack={handleBackToHome} /><FoodScreen /></> );
        case 'TeacherHealthAdminScreen': return ( <><ContentScreenHeader title="Healh Info" onBack={handleBackToHome} /><TeacherHealthAdminScreen /></> );
        case 'AlumniScreen': return ( <><ContentScreenHeader title="Alumni" onBack={handleBackToHome} /><AlumniScreen /></> );
        case 'PreAdmissionsScreen': return ( <><ContentScreenHeader title="Pre-Admissions" onBack={handleBackToHome} /><PreAdmissionsScreen /></> );
        case 'AdminEventsScreen': return ( <><ContentScreenHeader title="Events" onBack={handleBackToHome} /><AdminEventsScreen /></> );
        case 'TeacherAdminExamScreen': return ( <><ContentScreenHeader title="Exam Schedules" onBack={handleBackToHome} /><TeacherAdminExamScreen /></> );
        case 'KitchenScreen': return ( <><ContentScreenHeader title="Kitchen" onBack={handleBackToHome} /><KitchenScreen /></> );
        case 'TeacherAdminLabsScreen': return ( <><ContentScreenHeader title="Digital Labs" onBack={handleBackToHome} /><TeacherAdminLabsScreen /></> );
        case 'TeacherAdminMaterialsScreen': return ( <><ContentScreenHeader title="Study Materials" onBack={handleBackToHome} /><TeacherAdminMaterialsScreen /></> );
        case 'AdminSyllabusScreen': return ( <><ContentScreenHeader title="Syllabus Tracking" onBack={handleBackToHome} /><AdminSyllabusScreen /></> );
        case 'TeacherAdminResourcesScreen': return ( <><ContentScreenHeader title="Textbooks" onBack={handleBackToHome} /><TeacherAdminResourcesScreen /></> );
        case 'TeacherAttendanceMarkingScreen': return ( <><ContentScreenHeader title="Teacher Attendence" onBack={handleBackToHome} /><TeacherAttendanceMarkingScreen /></> );
        case 'TeacherPerformanceScreen': return ( <><ContentScreenHeader title="Teacher Performance" onBack={handleBackToHome} /><TeacherPerformanceScreen /></> );
        case 'StudentPerformance': return ( <><ContentScreenHeader title="Student Performance" onBack={handleBackToHome} /><StudentPerformance /></> );
        case 'StudentStackNavigator': return ( <><ContentScreenHeader title="Students" onBack={handleBackToHome} /><StudentStackNavigator /></> );
        case 'StaffNavigator': return ( <><ContentScreenHeader title="Staff" onBack={handleBackToHome} /><StaffNavigator /></> );
        case 'AccountsScreen': return ( <><ContentScreenHeader title="Accounts" onBack={handleBackToHome} /><AccountsScreen /></> );
        case 'ActivitiesScreen': return ( <><ContentScreenHeader title="Extracurricular Activities" onBack={handleBackToHome} /><ActivitiesScreen /></> );
        case 'DictionaryScreen': return ( <><ContentScreenHeader title="Dictionary" onBack={handleBackToHome} /><DictionaryScreen /></> );
        case 'TransportScreen': return ( <><ContentScreenHeader title="Transport" onBack={handleBackToHome} /><TransportScreen /></> );
        case 'LibraryHomeScreen': return ( <><ContentScreenHeader title="Library" onBack={handleBackToHome} /><LibraryHomeScreen /></> );
        case 'PerformanceFilter': return ( <><ContentScreenHeader title="Student Status Report" onBack={handleBackToHome} /><PerformanceFilter /></> );
        case 'TeacherFilter': return ( <><ContentScreenHeader title="Teacher Status Report" onBack={handleBackToHome} /><TeacherFilter /></> );
        case 'StudentFeedback': return ( <><ContentScreenHeader title="Student Feedback" onBack={handleBackToHome} /><StudentFeedback /></> );
        case 'TeacherFeedback': return ( <><ContentScreenHeader title="Teacher Feedback" onBack={handleBackToHome} /><TeacherFeedback /></> );
        case 'StudentAttendance': return ( <><ContentScreenHeader title="Student Attendance" onBack={handleBackToHome} /><StudentAttendance /></> );

        default: return ( <View style={styles.fallbackContent}><Text style={styles.fallbackText}>Content not available.</Text><TouchableOpacity onPress={handleBackToHome}><Text style={styles.fallbackLink}>Go Home</Text></TouchableOpacity></View> );
      }
  };

  return (
    <LinearGradient colors={GRADIENT_COLORS} style={{flex: 1}}>
    <SafeAreaView style={styles.safeArea}>
      
      {/* TOP BAR: Only show on Main Dashboard, or if you want it on sub-screens too, remove the condition. 
          Usually cleaner to only show on Main Dashboard. */}
      {activeTab === 'home' && currentView === 'dashboard' && (
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.profileContainer} onPress={() => setProfileModalVisible(true)} activeOpacity={0.8}>
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

      {/* MAIN CONTENT AREA */}
      <View style={{ flex: 1 }}>
        {renderContent()}
      </View>

      {/* BOTTOM NAV: Hide when inside a specific module (not the sub-menu, but the actual screen) */}
      {isBottomNavVisible && (
        <View style={styles.bottomNav}>
          <BottomNavItem icon="home" label="Home" isActive={activeTab === 'home'} onPress={() => switchTab('home')} />
          <BottomNavItem icon="calendar" label="Calendar" isActive={activeTab === 'calendar'} onPress={() => switchTab('calendar')} />
          <BottomNavItem icon="user" label="Profile" isActive={activeTab === 'profile'} onPress={() => switchTab('profile')} />
        </View>
      )}

      {/* PROFILE MODAL */}
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

// --- Helper Components ---
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
    
    // --- TOP BAR ---
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

    // --- MAIN DASHBOARD (CATEGORIES) STYLES ---
    contentScrollViewContainer: { paddingHorizontal: 15, paddingBottom: 20, flexGrow: 1, paddingTop: 15 },
    
    // --- NEW HEADER CARD STYLES ---
    headerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20, // More rounded like the image
        marginBottom: 20,
        // Shadows for Card Effect
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3, // Android Shadow
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)'
    },
    headerIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25, // Circle
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    headerTextContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20, // Responsive text
        fontWeight: 'bold',
        marginBottom: 2,
    },
    headerSubtitle: {
        fontSize: 13,
        fontWeight: '400',
    },
    // --- END NEW HEADER STYLES ---

    dashboardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    // Category Cards (Large, 2 columns)
    categoryCard: {
        width: (windowWidth - 45) / 2, // 2 columns with padding
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 15,
        marginBottom: 15,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 4,
        minHeight: 140,
        justifyContent: 'center'
    },
    categoryIconCircle: {
        width: 60, height: 60, backgroundColor: '#f0fdf4', borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 10
    },
    categoryImage: { width: 40, height: 40 },
    categoryTitle: { fontSize: 15, fontWeight: 'bold', color: TEXT_COLOR_DARK, textAlign: 'center', marginBottom: 2 },
    categorySubtitle: { fontSize: 11, color: TEXT_COLOR_MEDIUM, textAlign: 'center' },

    // --- SUB-VIEW STYLES (MATCHING YOUR REFERENCE) ---
    // 1. Header Card
    subHeaderCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 15,
        paddingVertical: 10,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    subHeaderIconContainer: {
        backgroundColor: '#E0F2F1',
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    subHeaderTextContainer: { justifyContent: 'center', flex: 1 },
    subHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: '#333333', },
    subHeaderSubtitle: { fontSize: 13, color: '#666666', marginTop: 1, },
    closeSubViewButton: { padding: 5 },

    // 2. Grid Container
    subGridContainer: { paddingHorizontal: 8, paddingBottom: 20, },

    // 3. Sub-Module Card
    subCard: {
        flex: 1,
        margin: 6,
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 10,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        maxWidth: (windowWidth / 2) - 16, // Force 2 columns
    },
    subCardImageContainer: { marginBottom: 15, padding: 10, backgroundColor: '#F7FAFC', borderRadius: 50, },
    subCardImage: { width: 50, height: 50, },
    subCardTitle: { fontSize: 15, fontWeight: '600', color: '#2D3748', textAlign: 'center', },

    // --- GENERIC CONTENT HEADER ---
    contentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: SECONDARY_COLOR, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, },
    backButtonGlobal: { padding: 5, },
    contentHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: PRIMARY_COLOR, textAlign: 'center', flex: 1, },
    
    // --- BOTTOM NAV ---
    bottomNav: { flexDirection: 'row', backgroundColor: SECONDARY_COLOR, borderTopWidth: 1, borderTopColor: BORDER_COLOR, paddingVertical: Platform.OS === 'ios' ? 10 : 8, paddingBottom: Platform.OS === 'ios' ? 20 : 8, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 5, minHeight: BOTTOM_NAV_HEIGHT, },
    navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 5, },
    navText: { fontSize: 10, color: TEXT_COLOR_MEDIUM, marginTop: 3, },
    navTextActive: { color: PRIMARY_COLOR, fontWeight: 'bold', },

    // --- FALLBACKS & MODALS ---
    fallbackContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    fallbackText: { fontSize: 16, color: TEXT_COLOR_MEDIUM, textAlign: 'center', marginBottom: 10, },
    fallbackLink: { fontSize: 16, color: PRIMARY_COLOR, fontWeight: 'bold', },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center' },
    enlargedProfileImage: { width: windowWidth * 0.8, height: windowWidth * 0.8, borderRadius: (windowWidth * 0.8) / 2, borderWidth: 4, borderColor: '#fff' },
    closeModalButton: { position: 'absolute', top: 50, right: 20, padding: 10, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)' },
});

export default AdminDashboard;