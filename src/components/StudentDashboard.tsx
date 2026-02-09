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
  BackHandler
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
        return false;
      };
      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }
  }, [isFocused, fetchUnreadCount, currentView]);

  const handleLogout = () => { Alert.alert("Logout", "Are you sure you want to log out?", [{ text: "Cancel", style: "cancel" }, { text: "Logout", onPress: logout, style: "destructive" }], { cancelable: true }); };

  const switchTab = (tab) => {
    if (tab === activeTab && currentView === 'dashboard') return;
    
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
        if(item.navigateToTab === 'calendar' || item.navigateToTab === 'profile') {
            switchTab(item.navigateToTab);
        } else {
            setActiveTab(item.navigateToTab);
        }
    } else {
        Alert.alert(item.title, `Coming soon!`);
    }
  };

  const ContentScreenHeader = ({ title, onBack }) => ( <View style={styles.contentHeader}><TouchableOpacity onPress={onBack} style={styles.backButtonGlobal}><MaterialIcons name="arrow-back" size={24} color={PRIMARY_COLOR} /></TouchableOpacity><Text style={styles.contentHeaderTitle}>{title}</Text><View style={{ width: 30 }} /></View> );

  // --- RENDERING LOGIC ---

  // 1. MAIN DASHBOARD (CATEGORIES)
  const renderDashboardCategories = () => (
      <ScrollView contentContainerStyle={styles.contentScrollViewContainer}>
          
          {/* --- HEADER CARD --- */}
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

  // 2. SUB-MODULES VIEW
  const renderSubCategoryView = () => {
    if (!selectedCategory) return null;

    return (
        <View style={{ flex: 1, backgroundColor: '#F2F5F8' }}>
            {/* Header Card */}
            <View style={styles.subHeaderCard}>
                <View style={styles.subHeaderIconContainer}>
                    <Image source={{ uri: selectedCategory.imageSource }} style={{ width: 28, height: 28 }} resizeMode="contain" />
                </View>
                <View style={styles.subHeaderTextContainer}>
                    <Text style={styles.subHeaderTitle}>{selectedCategory.title}</Text>
                    <Text style={styles.subHeaderSubtitle}>{selectedCategory.subtitle}</Text>
                </View>
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

  const renderContent = () => {
    const handleBack = () => switchTab('home');

    // Home Tab Logic
    if (activeTab === 'home') {
        if (currentView === 'category_detail') {
            return renderSubCategoryView();
        }
        return renderDashboardCategories();
    }

    // Other Tabs Logic
    switch (activeTab) {
      case 'allNotifications': return ( <><ContentScreenHeader title="Notifications" onBack={handleBack} /><NotificationsScreen onUnreadCountChange={setUnreadNotificationsCount} /></> );
      case 'calendar': return ( <><ContentScreenHeader title="Academic Calendar" onBack={handleBack} /><AcademicCalendar /></> );
      case 'profile': return ( <><ContentScreenHeader title="My Profile" onBack={handleBack} /><ProfileScreen /></> );
      
      case 'Timetable': return ( <><ContentScreenHeader title="Time Table" onBack={handleBack} /><TimetableScreen /></> );
      case 'Attendance': return ( <><ContentScreenHeader title="Attendance" onBack={handleBack} /><AttendanceScreen /></> );
      case 'AboutUs': return ( <><ContentScreenHeader title="About Us" onBack={handleBack} /><AboutUs /></> );
      case 'StudentExamsScreen': return ( <><ContentScreenHeader title="Exams" onBack={handleBack} /><StudentExamsScreen /></> );
      case 'StudentPTMScreen': return ( <><ContentScreenHeader title="Parents-Teacher Meetings" onBack={handleBack} /><StudentPTMScreen /></> );
      case 'OnlineClassScreen': return ( <><ContentScreenHeader title="Online Class" onBack={handleBack} /><OnlineClassScreen /></> );
      case 'FoodScreen': return ( <><ContentScreenHeader title="Lunch Menu" onBack={handleBack} /><FoodScreen /></> );
      case 'StudentHealthScreen': return ( <><ContentScreenHeader title="Health Info" onBack={handleBack} /><StudentHealthScreen /></> );
      case 'StudentEventsScreen': return ( <><ContentScreenHeader title="Events" onBack={handleBack} /><StudentEventsScreen /></> );
      case 'StudentExamScreen': return ( <><ContentScreenHeader title="Exam Schedules" onBack={handleBack} /><StudentExamScreen /></> );
      case 'StudentLabsScreen': return ( <><ContentScreenHeader title="Digital Labs" onBack={handleBack} /><StudentLabsScreen /></> );
      case 'StudentMaterialsScreen': return ( <><ContentScreenHeader title="Study Materials" onBack={handleBack} /><StudentMaterialsScreen /></> );
      case 'StudentSyllabusNavigator': return ( <><ContentScreenHeader title="Syllabus Tracking" onBack={handleBack} /><StudentSyllabusScreen /></> );
      case 'StudentResourcesScreen': return ( <><ContentScreenHeader title="Textbooks" onBack={handleBack} /><StudentResourcesScreen /></> );
      case 'ActivitiesScreen': return ( <><ContentScreenHeader title="Extracurricular Activities" onBack={handleBack} /><ActivitiesScreen /></> );
      case 'DictionaryScreen': return ( <><ContentScreenHeader title="Dictionary" onBack={handleBack} /><DictionaryScreen /></> );
      case 'TransportScreen': return ( <><ContentScreenHeader title="Transport" onBack={handleBack} /><TransportScreen /></> );
      case 'LibraryHomeScreen': return ( <><ContentScreenHeader title="Library" onBack={handleBack} /><LibraryHomeScreen /></> );
      case 'MyPerformance': return ( <><ContentScreenHeader title="My Performance" onBack={handleBack} /><MyPerformance /></> );
      case 'TeacherFeedback': return ( <><ContentScreenHeader title="Teacher Feedback" onBack={handleBack} /><TeacherFeedback /></> );

      default: return ( <View style={styles.fallbackContent}><Text style={styles.fallbackText}>Content for '{activeTab}' is not available.</Text><TouchableOpacity onPress={handleBack}><Text style={styles.fallbackLink}>Go to Home</Text></TouchableOpacity></View> );
    }
  };

  return (
    <LinearGradient colors={GRADIENT_COLORS} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        {activeTab === 'home' && currentView === 'dashboard' && (
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

// --- UI Helper Components ---
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
  
  // --- HEADER CARD STYLES ---
  contentScrollViewContainer: { paddingHorizontal: 15, paddingBottom: 20, flexGrow: 1, paddingTop: 15 },
  headerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 20, 
      marginBottom: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 3, 
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.03)'
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
  categoryIconCircle: { width: 60, height: 60, backgroundColor: '#f0fdf4', borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  categoryImage: { width: 40, height: 40 },
  categoryTitle: { fontSize: 15, fontWeight: 'bold', color: TEXT_COLOR_DARK, textAlign: 'center', marginBottom: 2 },
  categorySubtitle: { fontSize: 11, color: TEXT_COLOR_MEDIUM, textAlign: 'center' },

  // --- SUB-VIEW STYLES ---
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
  subGridContainer: { paddingHorizontal: 8, paddingBottom: 20, },
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
    maxWidth: (windowWidth / 2) - 16, 
  },
  subCardImageContainer: { marginBottom: 15, padding: 10, backgroundColor: '#F7FAFC', borderRadius: 50, },
  subCardImage: { width: 50, height: 50, },
  subCardTitle: { fontSize: 15, fontWeight: '600', color: '#2D3748', textAlign: 'center', },

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
});

export default StudentDashboard;