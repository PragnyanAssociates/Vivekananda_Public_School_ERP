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
  useColorScheme,
  FlatList,
  BackHandler,
  StatusBar
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
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
import StudentEventsScreen from '../screens/events/StudentEventsScreen';
import StudentExamScreen from '../screens/exams_Schedule/StudentExamScreen';
import StudentLabsScreen from '../screens/labs/StudentLabsScreen';
import StudentMaterialsScreen from '../screens/study-materials/StudentMaterialsScreen';
import StudentSyllabusScreen from '../screens/syllabus/StudentSyllabusScreen';
import StudentResourcesScreen from '../screens/syllabus_Textbook/StudentResourcesScreen';
import ActivitiesScreen from '../screens/Extra_activity/ActivitiesScreen';
import DictionaryScreen from '../screens/dictionary/DictionaryScreen';
import TransportScreen from '../screens/transport/TransportScreen';
import LibraryHomeScreen from '../screens/library/LibraryHomeScreen';
import MyPerformance from '../screens/report/MyPerformance';
import TeacherFeedback from '../screens/Feedbacks/TeacherFeedback';

const { width: windowWidth } = Dimensions.get('window');
const BOTTOM_NAV_HEIGHT = 70;
const PRIMARY_COLOR = '#008080';
const DANGER_COLOR = '#ef4444';

const MAIN_TABS = ['home', 'calendar', 'profile'];

// --- THEME COLORS CONFIGURATION ---
const COLORS = {
    light: {
        background: '#f8f8ff',
        cardBg: '#ffffff',
        textPrimary: '#333333',
        textSecondary: '#555555',
        border: '#b2ebf2',
        secondary: '#e0f2f7',
        headerIconBg: '#E0F2F1',
        subCardBg: '#FFFFFF',
        subCardImageBg: '#F7FAFC',
        shadow: '#000000',
    },
    dark: {
        background: '#121212',
        cardBg: '#1e1e1e',
        textPrimary: '#ffffff',
        textSecondary: '#bbbbbb',
        border: '#333333',
        secondary: '#1e1e1e',
        headerIconBg: 'rgba(0, 128, 128, 0.2)',
        subCardBg: '#2C2C2C',
        subCardImageBg: '#3A3A3A',
        shadow: '#000000',
    }
};

const StudentDashboard = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('home');
  
  // Navigation State: 'dashboard' vs 'category_detail'
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedCategory, setSelectedCategory] = useState(null);

  const { user, logout } = useAuth();
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const isFocused = useIsFocused();
  const [isProfileModalVisible, setProfileModalVisible] = useState(false);
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(true);

  // Dark Mode / Light Mode
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const theme = isDarkMode ? COLORS.dark : COLORS.light;

  // --- DATA STRUCTURE: GROUPED CATEGORIES ---
  const MAIN_CATEGORIES = [
    {
      id: 'cat_students',
      title: 'Students',
      subtitle: 'Attendance, Performance & Health Info.',
      imageSource: 'https://cdn-icons-png.flaticon.com/128/2784/2784403.png',
      subModules: [
        { id: 'qa4', title: 'My Performance', imageSource: 'https://cdn-icons-png.flaticon.com/128/3696/3696744.png', navigateToTab: 'MyPerformance' },
        { id: 'qa2', title: 'My Attendance', imageSource: 'https://cdn-icons-png.flaticon.com/128/10293/10293877.png', navigateToTab: 'Attendance' },
        { id: 'qa18', title: 'Progress Reports', imageSource: 'https://cdn-icons-png.flaticon.com/128/1378/1378646.png', navigateTo: 'StudentProgressReport' },
        { id: 'qa13', title: 'Health Info', imageSource: 'https://cdn-icons-png.flaticon.com/128/2382/2382533.png', navigateToTab: 'StudentHealthScreen' },
        { id: 'qa6', title: 'Gallery', imageSource: 'https://cdn-icons-png.flaticon.com/128/8418/8418513.png', navigateTo: 'Gallery' },
        { id: 'qa7', title: 'About Us', imageSource: 'https://cdn-icons-png.flaticon.com/128/3815/3815523.png', navigateToTab: 'AboutUs' },
      ]
    },
    {
      id: 'cat_Teachers',
      title: 'Teachers',
      subtitle: 'Attendance, Performance & PTM. ',
      imageSource: 'https://cdn-icons-png.flaticon.com/128/1995/1995574.png',
      subModules: [
        { id: 'qa10', title: 'PTM', imageSource: 'https://cdn-icons-png.flaticon.com/128/3214/3214781.png', navigateToTab: 'StudentPTMScreen' },
        { id: 'qa60', title: 'Teacher Feedback', imageSource: 'https://cdn-icons-png.flaticon.com/128/8540/8540828.png', navigateToTab: 'TeacherFeedback' },
      ]
    },
    {
      id: 'cat_academic',
      title: 'Academics',
      subtitle: 'Timetable, Syllabus, Homework & Exams.',
      imageSource: 'https://cdn-icons-png.flaticon.com/128/1773/1773017.png',
      subModules: [
        { id: 'qa1', title: 'Timetable', imageSource: 'https://cdn-icons-png.flaticon.com/128/1254/1254275.png', navigateToTab: 'Timetable' },
        { id: 'qa11', title: 'Online Class', imageSource: 'https://cdn-icons-png.flaticon.com/128/8388/8388104.png', navigateToTab: 'OnlineClassScreen' },
        { id: 'qa5', title: 'Home Work', imageSource: 'https://cdn-icons-png.flaticon.com/128/11647/11647336.png', navigateTo: 'StudentHomework' },
        { id: 'qa20', title: 'Syllabus Tracking', imageSource: 'https://cdn-icons-png.flaticon.com/128/1584/1584937.png', navigateToTab: 'StudentSyllabusNavigator' },
        { id: 'qa8', title: 'Exams', imageSource: 'https://cdn-icons-png.flaticon.com/128/12886/12886027.png', navigateToTab: 'StudentExamsScreen' },
        { id: 'qa16', title: 'Exam Schedules', imageSource: 'https://cdn-icons-png.flaticon.com/128/15447/15447954.png', navigateToTab: 'StudentExamScreen' },
        { id: 'qa14', title: 'Group Chat', imageSource: 'https://cdn-icons-png.flaticon.com/128/6576/6576146.png', navigateTo: 'ChatFeature' },
      ]
    },
    {
      id: 'cat_resources',
      title: 'Study Materials',
      subtitle: 'Learning Resources',
      imageSource: 'https://cdn-icons-png.flaticon.com/128/1156/1156964.png',
      subModules: [
        { id: 'qa19', title: 'Study Materials', imageSource: 'https://cdn-icons-png.flaticon.com/128/3273/3273259.png', navigateToTab: 'StudentMaterialsScreen' },
        { id: 'qa3', title: 'Library', imageSource: 'https://cdn-icons-png.flaticon.com/128/9043/9043296.png', navigateToTab: 'LibraryHomeScreen' },
        { id: 'qa21', title: 'Textbooks', imageSource: 'https://cdn-icons-png.flaticon.com/128/4541/4541151.png', navigateToTab: 'StudentResourcesScreen' },
        { id: 'qa17', title: 'Digital Labs', imageSource: 'https://cdn-icons-png.flaticon.com/128/17104/17104528.png', navigateToTab: 'StudentLabsScreen' },
        { id: 'qa9', title: 'Dictionary', imageSource: 'https://cdn-icons-png.flaticon.com/128/4033/4033369.png', navigateToTab: 'DictionaryScreen' },
      ]
    },
    {
      id: 'cat_Extracurricular',
      title: 'Extracurricular Activities',
      subtitle: 'Sports & Kitchen',
      imageSource: 'https://cdn-icons-png.flaticon.com/128/12693/12693554.png',
      subModules: [
        { id: 'qa12', title: 'Lunch Menu', imageSource: 'https://cdn-icons-png.flaticon.com/128/561/561611.png', navigateToTab: 'FoodScreen' },
        { id: 'qa15', title: 'Events', imageSource: 'https://cdn-icons-png.flaticon.com/128/9592/9592283.png', navigateToTab: 'StudentEventsScreen' },
      ]
    },
  ];

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

  // --- HARDWARE BACK BUTTON LOGIC ---
  useEffect(() => {
    if (isFocused) {
      fetchUnreadCount();
      
      const backAction = () => {
        // 1. If we are in a Sub-Module (ActiveTab is NOT Home/Calendar/Profile)
        if (!MAIN_TABS.includes(activeTab)) {
            // Go back to the "Head Module" (Category Detail View)
            setActiveTab('home');
            setCurrentView('category_detail');
            setIsBottomNavVisible(true);
            return true; // Stop default exit
        }

        // 2. If we are in 'home' tab but viewing a Sub-Category (Head Module)
        if (activeTab === 'home' && currentView === 'category_detail') {
            // Go back to Main Dashboard
            setCurrentView('dashboard');
            setSelectedCategory(null);
            return true;
        }

        // 3. If in Calendar or Profile, go to Home Dashboard
        if (activeTab !== 'home') {
             switchTab('home');
             return true;
        }

        return false; // Allow default behavior (exit app)
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }
  }, [isFocused, fetchUnreadCount, currentView, activeTab]);

  const handleLogout = () => { Alert.alert("Logout", "Are you sure you want to log out?", [{ text: "Cancel", style: "cancel" }, { text: "Logout", onPress: logout, style: "destructive" }], { cancelable: true }); };

  // --- NAVIGATION CONTROLLERS ---
  const switchTab = (tab) => {
    if (tab === activeTab && currentView === 'dashboard') return;
    
    if (tab === 'home') {
        setCurrentView('dashboard');
        setSelectedCategory(null);
    }
    setActiveTab(tab);
    setIsBottomNavVisible(MAIN_TABS.includes(tab));
  };

  // Module Back Button Logic
  const handleModuleBack = () => {
      // Switch back to Home tab, but PRESERVE the category_detail view
      setActiveTab('home');
      if (selectedCategory) {
          setCurrentView('category_detail');
      } else {
          setCurrentView('dashboard');
      }
      setIsBottomNavVisible(true);
  };

  const handleCategoryPress = (category) => {
    setSelectedCategory(category);
    setCurrentView('category_detail');
  };

  const handleSubModuleNavigation = (item) => {
    if (item.navigateTo) {
        navigation.navigate(item.navigateTo);
    } else if (item.navigateToTab) {
        if(item.navigateToTab === 'calendar' || item.navigateToTab === 'profile') {
            switchTab(item.navigateToTab);
        } else {
            setActiveTab(item.navigateToTab);
            setIsBottomNavVisible(false); // Hide bottom nav in modules
        }
    } else {
        Alert.alert(item.title, `Coming soon!`);
    }
  };

  const ContentScreenHeader = ({ title, onBack }) => ( 
    <View style={[styles.contentHeader, { backgroundColor: theme.secondary, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButtonGlobal}>
            <MaterialIcons name="arrow-back" size={24} color={PRIMARY_COLOR} />
        </TouchableOpacity>
        <Text style={[styles.contentHeaderTitle, { color: PRIMARY_COLOR }]}>{title}</Text>
        <View style={{ width: 30 }} />
    </View> 
  );

  // --- RENDERING LOGIC ---

  // 1. MAIN DASHBOARD (CATEGORIES)
  const renderDashboardCategories = () => (
      <ScrollView contentContainerStyle={styles.contentScrollViewContainer}>
          
          {/* --- HEADER CARD --- */}
          <View style={[styles.headerCard, { backgroundColor: theme.cardBg, borderColor: theme.border, shadowColor: theme.shadow }]}>
              <View style={[styles.headerIconContainer, { backgroundColor: theme.headerIconBg }]}>
                  <MaterialCommunityIcons 
                    name="view-dashboard" 
                    size={28} 
                    color={PRIMARY_COLOR} 
                  />
              </View>
              <View style={styles.headerTextContainer}>
                  <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Dashboard</Text>
                  <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Overview & Quick Access</Text>
              </View>
          </View>

          <View style={styles.dashboardGrid}>
              {MAIN_CATEGORIES.map((category) => (
                  <TouchableOpacity 
                    key={category.id} 
                    style={[styles.categoryCard, { backgroundColor: theme.cardBg, shadowColor: theme.shadow }]} 
                    onPress={() => handleCategoryPress(category)}
                    activeOpacity={0.8}
                  >
                      <View style={[styles.categoryIconCircle, { backgroundColor: theme.headerIconBg }]}>
                         <Image source={{ uri: category.imageSource }} style={styles.categoryImage} resizeMode="contain" />
                      </View>
                      <Text style={[styles.categoryTitle, { color: theme.textPrimary }]}>{category.title}</Text>
                      <Text style={[styles.categorySubtitle, { color: theme.textSecondary }]}>{category.subtitle}</Text>
                  </TouchableOpacity>
              ))}
          </View>
      </ScrollView>
  );

  // 2. SUB-MODULES VIEW (Head Module)
  const renderSubCategoryView = () => {
    if (!selectedCategory) return null;

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            {/* Header Card */}
            <View style={[styles.subHeaderCard, { backgroundColor: theme.cardBg, shadowColor: theme.shadow }]}>
                <View style={[styles.subHeaderIconContainer, { backgroundColor: theme.headerIconBg }]}>
                    <Image source={{ uri: selectedCategory.imageSource }} style={{ width: 28, height: 28 }} resizeMode="contain" />
                </View>
                <View style={styles.subHeaderTextContainer}>
                    <Text style={[styles.subHeaderTitle, { color: theme.textPrimary }]}>{selectedCategory.title}</Text>
                    <Text style={[styles.subHeaderSubtitle, { color: theme.textSecondary }]}>{selectedCategory.subtitle}</Text>
                </View>
                <TouchableOpacity onPress={() => { setCurrentView('dashboard'); setSelectedCategory(null); }} style={styles.closeSubViewButton}>
                    <MaterialIcons name="close" size={24} color={theme.textSecondary} />
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
                        style={[styles.subCard, { backgroundColor: theme.subCardBg, shadowColor: theme.shadow }]}
                        onPress={() => handleSubModuleNavigation(item)}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.subCardImageContainer, { backgroundColor: theme.subCardImageBg }]}>
                            <Image
                                source={{ uri: item.imageSource }}
                                style={styles.subCardImage}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={[styles.subCardTitle, { color: theme.textPrimary }]}>{item.title}</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
  };

  const renderContent = () => {
    // If in Home Tab
    if (activeTab === 'home') {
        if (currentView === 'category_detail') {
            return renderSubCategoryView();
        }
        return renderDashboardCategories();
    }

    // Screens that should return to Sub-Menu (Head Module) use `handleModuleBack`
    // Screens that are Main Tabs (Calendar, Profile) use `switchTab('home')`

    switch (activeTab) {
      case 'allNotifications': return ( <><ContentScreenHeader title="Notifications" onBack={() => switchTab('home')} /><NotificationsScreen onUnreadCountChange={setUnreadNotificationsCount} /></> );
      case 'calendar': return ( <><ContentScreenHeader title="Academic Calendar" onBack={() => switchTab('home')} /><AcademicCalendar /></> );
      case 'profile': return ( <><ContentScreenHeader title="My Profile" onBack={() => switchTab('home')} /><ProfileScreen /></> );
      
      // Modules
      case 'Timetable': return ( <><ContentScreenHeader title="Time Table" onBack={handleModuleBack} /><TimetableScreen /></> );
      case 'Attendance': return ( <><ContentScreenHeader title="Attendance" onBack={handleModuleBack} /><AttendanceScreen /></> );
      case 'AboutUs': return ( <><ContentScreenHeader title="About Us" onBack={handleModuleBack} /><AboutUs /></> );
      case 'StudentExamsScreen': return ( <><ContentScreenHeader title="Exams" onBack={handleModuleBack} /><StudentExamsScreen /></> );
      case 'StudentPTMScreen': return ( <><ContentScreenHeader title="Parents-Teacher Meetings" onBack={handleModuleBack} /><StudentPTMScreen /></> );
      case 'OnlineClassScreen': return ( <><ContentScreenHeader title="Online Class" onBack={handleModuleBack} /><OnlineClassScreen /></> );
      case 'FoodScreen': return ( <><ContentScreenHeader title="Lunch Menu" onBack={handleModuleBack} /><FoodScreen /></> );
      case 'StudentHealthScreen': return ( <><ContentScreenHeader title="Health Info" onBack={handleModuleBack} /><StudentHealthScreen /></> );
      case 'StudentEventsScreen': return ( <><ContentScreenHeader title="Events" onBack={handleModuleBack} /><StudentEventsScreen /></> );
      case 'StudentExamScreen': return ( <><ContentScreenHeader title="Exam Schedules" onBack={handleModuleBack} /><StudentExamScreen /></> );
      case 'StudentLabsScreen': return ( <><ContentScreenHeader title="Digital Labs" onBack={handleModuleBack} /><StudentLabsScreen /></> );
      case 'StudentMaterialsScreen': return ( <><ContentScreenHeader title="Study Materials" onBack={handleModuleBack} /><StudentMaterialsScreen /></> );
      case 'StudentSyllabusNavigator': return ( <><ContentScreenHeader title="Syllabus Tracking" onBack={handleModuleBack} /><StudentSyllabusScreen /></> );
      case 'StudentResourcesScreen': return ( <><ContentScreenHeader title="Textbooks" onBack={handleModuleBack} /><StudentResourcesScreen /></> );
      case 'ActivitiesScreen': return ( <><ContentScreenHeader title="Extracurricular Activities" onBack={handleModuleBack} /><ActivitiesScreen /></> );
      case 'DictionaryScreen': return ( <><ContentScreenHeader title="Dictionary" onBack={handleModuleBack} /><DictionaryScreen /></> );
      case 'TransportScreen': return ( <><ContentScreenHeader title="Transport" onBack={handleModuleBack} /><TransportScreen /></> );
      case 'LibraryHomeScreen': return ( <><ContentScreenHeader title="Library" onBack={handleModuleBack} /><LibraryHomeScreen /></> );
      case 'MyPerformance': return ( <><ContentScreenHeader title="My Performance" onBack={handleModuleBack} /><MyPerformance /></> );
      case 'TeacherFeedback': return ( <><ContentScreenHeader title="Teacher Feedback" onBack={handleModuleBack} /><TeacherFeedback /></> );

      default: return ( 
          <View style={[styles.fallbackContent, {backgroundColor: theme.background}]}>
              <Text style={[styles.fallbackText, {color: theme.textSecondary}]}>Content for '{activeTab}' is not available.</Text>
              <TouchableOpacity onPress={() => switchTab('home')}><Text style={styles.fallbackLink}>Go to Home</Text></TouchableOpacity>
          </View> 
      );
    }
  };

  return (
    <LinearGradient colors={[theme.background, theme.background]} style={{ flex: 1 }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.secondary} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        
        {/* TOP BAR: Only show on Main Dashboard */}
        {activeTab === 'home' && currentView === 'dashboard' && (
          <View style={[styles.topBar, { backgroundColor: theme.secondary, borderBottomColor: theme.border, shadowColor: theme.shadow }]}>
            <TouchableOpacity style={styles.profileContainer} onPress={() => setProfileModalVisible(true)} activeOpacity={0.8}>
              <FastImage source={profileImageSource} style={[styles.profileImage, { borderColor: PRIMARY_COLOR, backgroundColor: theme.cardBg }]} />
              <View style={styles.profileTextContainer}>
                <Text style={styles.profileNameText} numberOfLines={1}>{user?.full_name || 'Student'}</Text>
                <Text style={[styles.profileRoleText, { color: theme.textSecondary }]}>{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Student'}</Text>
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
          <View style={[styles.bottomNav, { backgroundColor: theme.secondary, borderTopColor: theme.border, shadowColor: theme.shadow }]}>
            <BottomNavItem icon="home" label="Home" isActive={activeTab === 'home'} onPress={() => switchTab('home')} theme={theme} />
            <BottomNavItem icon="calendar" label="Calendar" isActive={activeTab === 'calendar'} onPress={() => switchTab('calendar')} theme={theme} />
            <BottomNavItem icon="user" label="Profile" isActive={activeTab === 'profile'} onPress={() => switchTab('profile')} theme={theme} />
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

// --- UI Helper Components ---
const BottomNavItem = ({ icon, label, isActive, onPress, theme }) => (
  <TouchableOpacity style={styles.navItem} onPress={onPress}>
    <Icon name={icon} size={24} color={isActive ? PRIMARY_COLOR : theme.textSecondary} />
    <Text style={[styles.navText, { color: isActive ? PRIMARY_COLOR : theme.textSecondary, fontWeight: isActive ? 'bold' : 'normal' }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  mainContent: { flex: 1 },
  
  // --- TOP BAR ---
  topBar: { paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 12 : 15, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3, borderBottomWidth: 1 },
  profileContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  profileImage: { width: 45, height: 45, borderRadius: 22.5, borderWidth: 2 },
  profileTextContainer: { marginLeft: 12, flex: 1 },
  profileNameText: { color: PRIMARY_COLOR, fontSize: 18, fontWeight: 'bold' },
  profileRoleText: { fontSize: 14 },
  topBarActions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { position: 'relative', padding: 8 },
  notificationCountBubble: { position: 'absolute', top: 3, right: 3, backgroundColor: DANGER_COLOR, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, borderWidth: 1, borderColor: 'white' },
  notificationCountText: { color: 'white', fontSize: 11, fontWeight: 'bold' },
  
  // --- GENERIC CONTENT HEADER ---
  contentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1 },
  backButtonGlobal: { padding: 5 },
  contentHeaderTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', flex: 1 },
  
  // --- HEADER CARD STYLES ---
  contentScrollViewContainer: { paddingHorizontal: 15, paddingBottom: 20, flexGrow: 1, paddingTop: 15 },
  headerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 20, 
      marginBottom: 20,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 3, 
      borderWidth: 1,
  },
  headerIconContainer: {
      width: 50,
      height: 50,
      borderRadius: 25, 
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 15,
  },
  headerTextContainer: { flex: 1, justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 2 },
  headerSubtitle: { fontSize: 13, fontWeight: '400' },

  // --- DASHBOARD CATEGORY GRID ---
  dashboardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  categoryCard: {
    width: (windowWidth - 45) / 2,
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 4,
    minHeight: 140,
    justifyContent: 'center'
  },
  categoryIconCircle: { width: 60, height: 60, backgroundColor: '#f0fdf4', borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  categoryImage: { width: 40, height: 40 },
  categoryTitle: { fontSize: 15, fontWeight: 'bold', textAlign: 'center', marginBottom: 2 },
  categorySubtitle: { fontSize: 11, textAlign: 'center' },

  // --- SUB-VIEW STYLES ---
  subHeaderCard: {
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
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    shadowOffset: { width: 0, height: 2 },
  },
  subHeaderIconContainer: {
    borderRadius: 30,
    width: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  subHeaderTextContainer: { justifyContent: 'center', flex: 1 },
  subHeaderTitle: { fontSize: 20, fontWeight: 'bold' },
  subHeaderSubtitle: { fontSize: 13, marginTop: 1, },
  closeSubViewButton: { padding: 5 },
  subGridContainer: { paddingHorizontal: 8, paddingBottom: 20, },
  subCard: {
    flex: 1,
    margin: 6,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    padding: 10,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxWidth: (windowWidth / 2) - 16, 
  },
  subCardImageContainer: { marginBottom: 15, padding: 10, borderRadius: 50, },
  subCardImage: { width: 50, height: 50, },
  subCardTitle: { fontSize: 15, fontWeight: '600', textAlign: 'center', },

  // --- BOTTOM NAV ---
  bottomNav: { flexDirection: 'row', borderTopWidth: 1, paddingVertical: Platform.OS === 'ios' ? 10 : 8, paddingBottom: Platform.OS === 'ios' ? 20 : 8, minHeight: BOTTOM_NAV_HEIGHT, shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 5 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 5 },
  navText: { fontSize: 10, marginTop: 3 },
  
  fallbackContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  fallbackText: { fontSize: 16, textAlign: 'center', marginBottom: 10 },
  fallbackLink: { fontSize: 16, color: PRIMARY_COLOR, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center' },
  enlargedProfileImage: { width: windowWidth * 0.8, height: windowWidth * 0.8, borderRadius: (windowWidth * 0.8) / 2, borderWidth: 4, borderColor: '#fff' },
  closeModalButton: { position: 'absolute', top: 50, right: 20, padding: 10, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)' },
});

export default StudentDashboard;