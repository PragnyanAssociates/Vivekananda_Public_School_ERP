import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
  useColorScheme,
  StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../api/client';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext'; 

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const Colors = {
  light: {
    primary: '#008080',
    background: '#FFFFFF', // Matches your Dashboard Light Theme
    card: '#ffffff',
    textMain: '#333333',
    textSub: '#555555',
    textLight: '#999999',
    border: '#b2ebf2',
    filterBg: '#e0f2f7',
    unreadBg: '#e6fffa',
    shadow: '#000000'
  },
  dark: {
    primary: '#008080',
    background: '#121212', // Matches your Dashboard Dark Theme
    card: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    textLight: '#757575',
    border: '#333333',
    filterBg: '#2C2C2C',
    unreadBg: 'rgba(0, 128, 128, 0.25)', 
    shadow: '#000000'
  }
};

// --- ICON MAPPING ---
// Updated to include all modules found in the Dashboards
const notificationIcons = {
  default: 'https://cdn-icons-png.flaticon.com/128/8297/8297354.png',
  homework: 'https://cdn-icons-png.flaticon.com/128/11647/11647336.png',
  submission: 'https://cdn-icons-png.flaticon.com/128/11647/11647336.png',
  event: 'https://cdn-icons-png.flaticon.com/128/9592/9592283.png',
  announcement: 'https://cdn-icons-png.flaticon.com/128/16117/16117762.png',
  calendar: 'https://cdn-icons-png.flaticon.com/128/4982/4982266.png',
  timetable: 'https://cdn-icons-png.flaticon.com/128/1254/1254275.png',
  exam: 'https://cdn-icons-png.flaticon.com/128/9913/9913475.png',
  report: 'https://cdn-icons-png.flaticon.com/128/1378/1378646.png', // Performance/Marks
  syllabus: 'https://cdn-icons-png.flaticon.com/128/1584/1584937.png',
  gallery: 'https://cdn-icons-png.flaticon.com/128/8418/8418513.png',
  health: 'https://cdn-icons-png.flaticon.com/128/2382/2382533.png',
  lab: 'https://cdn-icons-png.flaticon.com/128/17104/17104528.png',
  sport: 'https://cdn-icons-png.flaticon.com/128/3429/3429456.png', // Activity
  transport: 'https://cdn-icons-png.flaticon.com/128/2945/2945694.png',
  food: 'https://cdn-icons-png.flaticon.com/128/561/561611.png',
  kitchen: 'https://cdn-icons-png.flaticon.com/128/1698/1698742.png',
  ad: 'https://cdn-icons-png.flaticon.com/128/4944/4944482.png',
  helpdesk: 'https://cdn-icons-png.flaticon.com/128/4961/4961736.png',
  feedback: 'https://cdn-icons-png.flaticon.com/128/9722/9722906.png',
  payment: 'https://cdn-icons-png.flaticon.com/128/1198/1198291.png', // Accounts
  chat: 'https://cdn-icons-png.flaticon.com/128/13819/13819448.png',
  'online-class': 'https://cdn-icons-png.flaticon.com/128/8388/8388104.png',
  attendance: 'https://cdn-icons-png.flaticon.com/128/992/992683.png',
  library: 'https://cdn-icons-png.flaticon.com/128/9043/9043296.png',
  ptm: 'https://cdn-icons-png.flaticon.com/128/3214/3214781.png',
  alumni: 'https://cdn-icons-png.flaticon.com/128/9517/9517272.png',
  login: 'https://cdn-icons-png.flaticon.com/128/15096/15096966.png' // AdminLM
};

const getIconForTitle = (title) => {
    const lowerCaseTitle = (title || '').toLowerCase();
    
    // Academic & Classroom
    if (lowerCaseTitle.includes('homework') || lowerCaseTitle.includes('assignment')) return notificationIcons.homework;
    if (lowerCaseTitle.includes('exam') || lowerCaseTitle.includes('test')) return notificationIcons.exam;
    if (lowerCaseTitle.includes('submit') || lowerCaseTitle.includes('submission')) return notificationIcons.submission;
    if (lowerCaseTitle.includes('timetable') || lowerCaseTitle.includes('schedule')) return notificationIcons.timetable;
    if (lowerCaseTitle.includes('syllabus')) return notificationIcons.syllabus;
    if (lowerCaseTitle.includes('class') || lowerCaseTitle.includes('online')) return notificationIcons['online-class'];
    if (lowerCaseTitle.includes('attendance') || lowerCaseTitle.includes('absent')) return notificationIcons.attendance;
    if (lowerCaseTitle.includes('result') || lowerCaseTitle.includes('report') || lowerCaseTitle.includes('mark')) return notificationIcons.report;
    
    // Resources & Facilities
    if (lowerCaseTitle.includes('library') || lowerCaseTitle.includes('book')) return notificationIcons.library;
    if (lowerCaseTitle.includes('lab')) return notificationIcons.lab;
    if (lowerCaseTitle.includes('transport') || lowerCaseTitle.includes('bus')) return notificationIcons.transport;
    if (lowerCaseTitle.includes('food') || lowerCaseTitle.includes('menu') || lowerCaseTitle.includes('lunch')) return notificationIcons.food;
    if (lowerCaseTitle.includes('kitchen') || lowerCaseTitle.includes('stock')) return notificationIcons.kitchen;
    
    // Communication & People
    if (lowerCaseTitle.includes('chat') || lowerCaseTitle.includes('message')) return notificationIcons.chat;
    if (lowerCaseTitle.includes('ptm') || lowerCaseTitle.includes('meeting')) return notificationIcons.ptm;
    if (lowerCaseTitle.includes('feedback') || lowerCaseTitle.includes('review')) return notificationIcons.feedback;
    if (lowerCaseTitle.includes('gallery') || lowerCaseTitle.includes('photo')) return notificationIcons.gallery;
    if (lowerCaseTitle.includes('alumni')) return notificationIcons.alumni;
    
    // Admin & Misc
    if (lowerCaseTitle.includes('account') || lowerCaseTitle.includes('fee') || lowerCaseTitle.includes('payment')) return notificationIcons.payment;
    if (lowerCaseTitle.includes('login') || lowerCaseTitle.includes('access')) return notificationIcons.login;
    if (lowerCaseTitle.includes('event')) return notificationIcons.event;
    if (lowerCaseTitle.includes('calendar')) return notificationIcons.calendar;
    if (lowerCaseTitle.includes('health')) return notificationIcons.health;
    if (lowerCaseTitle.includes('sport') || lowerCaseTitle.includes('activity')) return notificationIcons.sport;

    return notificationIcons.default;
};

// --- DATE FORMATTER ---
const formatNotificationTime = (dateInput) => {
  if (!dateInput) return '';
  try {
      if (dateInput instanceof Date) {
          return format(dateInput, "MMM d, yyyy - h:mm a");
      }
      let dateString = String(dateInput);
      // Ensure ISO format compatibility
      if (dateString.indexOf('T') === -1 && dateString.indexOf('Z') === -1) {
         dateString = dateString.replace(' ', 'T') + 'Z';
      }
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return String(dateInput);
      return format(date, "MMM d, yyyy - h:mm a");
  } catch (e) {
      console.error("Date parsing error", e);
      return String(dateInput);
  }
};

const NotificationsScreen = ({ onUnreadCountChange }) => {
  const navigation = useNavigation(); 
  const { user } = useAuth(); 
  
  // Theme Hooks
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  const [filterStatus, setFilterStatus] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // --- FETCH NOTIFICATIONS ---
  const fetchNotifications = useCallback(async () => {
    try {
      // In a real app, you might paginate this
      const response = await apiClient.get('/notifications');
      setNotifications(response.data);
      if (onUnreadCountChange) {
          onUnreadCountChange(response.data.filter(n => !n.is_read).length);
      }
    } catch (e) {
      setError("Failed to fetch notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  // --- MAIN NAVIGATION LOGIC ---
  const handleNotificationPress = async (notification) => {
    // 1. Mark as read immediately in UI and Backend
    if (!notification.is_read) {
        try {
            await apiClient.put(`/notifications/${notification.id}/read`);
            const updatedList = notifications.map(n => n.id === notification.id ? { ...n, is_read: 1 } : n);
            setNotifications(updatedList);
            if (onUnreadCountChange) {
                onUnreadCountChange(updatedList.filter(n => !n.is_read).length);
            }
        } catch (error) {
            console.error("Failed to mark notification as read:", error);
        }
    }

    // 2. Parse Link
    // Assumed format: "module_name" or "module_name/id" or "module_name/sub_type/id"
    if (!notification.link) return;

    try {
        const parts = notification.link.split('/').filter(Boolean);
        if (parts.length === 0) return;

        const screenType = parts[0].toLowerCase(); // e.g., 'homework', 'exams'
        // Optional params if needed by the screen
        const param1 = parts[1]; 
        const param2 = parts[2];

        // --- NAVIGATION SWITCH BASED ON DASHBOARDS ---
        // This maps the notification type to the exact screen name found in your provided code
        switch (screenType) {
            
            // --- GLOBAL SCREENS (Accessible by all) ---
            case 'calendar': 
                navigation.navigate('AcademicCalendar'); 
                break;
            case 'gallery':
                // Assuming Gallery takes nested nav, or just the main screen
                navigation.navigate('Gallery'); 
                break;
            case 'about': 
                navigation.navigate('AboutUs'); 
                break;
            case 'profile':
                navigation.navigate('ProfileScreen');
                break;

            // --- ACADEMICS: HOMEWORK ---
            case 'homework':
            case 'assignment':
                if (user?.role === 'student') {
                    navigation.navigate('StudentHomework'); // From StudentDashboard
                } else {
                    navigation.navigate('TeacherAdminHomeworkScreen'); // From Admin/Teacher Dashboard
                }
                break;

            // --- ACADEMICS: EXAMS ---
            case 'exams':
            case 'exam':
                if (user?.role === 'student') {
                    navigation.navigate('StudentExamsScreen');
                } else {
                    navigation.navigate('TeacherAdminExamsScreen');
                }
                break;
            case 'exam-schedule':
                if (user?.role === 'student') {
                    navigation.navigate('StudentExamScreen');
                } else {
                    navigation.navigate('TeacherAdminExamScreen');
                }
                break;
            case 'marks':
            case 'result':
                if (user?.role === 'student') {
                    navigation.navigate('MyPerformance'); // Student Result View
                } else {
                    navigation.navigate('ReportScreen'); // Admin/Teacher Entry
                }
                break;

            // --- ACADEMICS: TIMETABLE & SYLLABUS ---
            case 'timetable':
                // All dashboards use 'Timetable' or 'TimetableScreen' mapped to 'Timetable' in tabs
                navigation.navigate('Timetable'); 
                break;
            case 'syllabus':
                if (user?.role === 'student') {
                    navigation.navigate('StudentSyllabusNavigator');
                } else if (user?.role === 'teacher') {
                    navigation.navigate('TeacherSyllabusScreen');
                } else {
                    navigation.navigate('AdminSyllabusScreen');
                }
                break;
            case 'online-class':
                navigation.navigate('OnlineClassScreen');
                break;

            // --- ATTENDANCE ---
            case 'attendance':
                // "My Attendance" vs "Mark Attendance"
                if (user?.role === 'student') {
                    navigation.navigate('Attendance'); // Student's own attendance
                } else if (user?.role === 'teacher') {
                    // Context matters here. If notif is "Mark Attendance", go to Marking. 
                    // If "Your Attendance", go to Report. Defaulting to Report for safety.
                    navigation.navigate('TeacherAttendanceReportScreen'); 
                } else {
                    navigation.navigate('TeacherAttendanceMarkingScreen'); // Admin view
                }
                break;
            case 'student-attendance': 
                // Specific Link for Admin/Teachers to check students
                if (user?.role === 'admin') navigation.navigate('StudentAttendance');
                else if (user?.role === 'teacher') navigation.navigate('Attendance'); // Reuses component name in TeacherDashboard
                break;

            // --- PERFORMANCE & REPORTS ---
            case 'performance':
                if (user?.role === 'student') navigation.navigate('MyPerformance');
                else if (user?.role === 'teacher') navigation.navigate('TeacherPerformanceScreen'); // Their own perf
                else navigation.navigate('TeacherFilter'); // Admin viewing teachers
                break;
            case 'student-performance-report':
                // Admin/Teacher viewing Student stats
                navigation.navigate('PerformanceFilter');
                break;

            // --- COMMUNICATION ---
            case 'ptm':
                if (user?.role === 'student') {
                    navigation.navigate('StudentPTMScreen');
                } else {
                    navigation.navigate('TeacherAdminPTMScreen');
                }
                break;
            case 'chat':
            case 'group-chat':
                navigation.navigate('ChatFeature');
                break;
            case 'feedback':
                // Differentiating based on who the feedback is FOR
                if (param1 === 'teacher') navigation.navigate('TeacherFeedback');
                else navigation.navigate('StudentFeedback');
                break;

            // --- RESOURCES (Library, Books, Labs) ---
            case 'library':
                navigation.navigate('LibraryHomeScreen');
                break;
            case 'textbooks':
            case 'resources':
                if (user?.role === 'student') navigation.navigate('StudentResourcesScreen');
                else navigation.navigate('TeacherAdminResourcesScreen');
                break;
            case 'materials':
                if (user?.role === 'student') navigation.navigate('StudentMaterialsScreen');
                else navigation.navigate('TeacherAdminMaterialsScreen');
                break;
            case 'labs':
                if (user?.role === 'student') navigation.navigate('StudentLabsScreen');
                else navigation.navigate('TeacherAdminLabsScreen');
                break;
            case 'dictionary':
                navigation.navigate('DictionaryScreen');
                break;

            // --- EXTRACURRICULAR ---
            case 'events':
                if (user?.role === 'student') {
                    navigation.navigate('StudentEventsScreen');
                } else {
                    navigation.navigate('AdminEventsScreen');
                }
                break;
            case 'food':
            case 'menu':
                navigation.navigate('FoodScreen');
                break;
            case 'kitchen':
                // Admin only
                if (user?.role === 'admin') navigation.navigate('KitchenScreen');
                else Alert.alert("Access Denied", "Kitchen management is for admins only.");
                break;
            case 'activities':
                navigation.navigate('ActivitiesScreen');
                break;

            // --- ADMIN SPECIFIC ---
            case 'accounts':
            case 'fees':
                if (user?.role === 'admin') navigation.navigate('AccountsScreen');
                break;
            case 'admissions':
                if (user?.role === 'admin') navigation.navigate('PreAdmissionsScreen');
                break;
            case 'alumni':
                if (user?.role === 'admin') navigation.navigate('AlumniScreen');
                break;
            case 'login-management':
            case 'users':
                if (user?.role === 'admin') navigation.navigate('AdminLM');
                break;
            case 'transport':
                navigation.navigate('TransportScreen');
                break;
            case 'health':
                if (user?.role === 'student') navigation.navigate('StudentHealthScreen');
                else navigation.navigate('TeacherHealthAdminScreen');
                break;

            default:
                // Fallback for unknown links
                console.log("Unknown link type:", screenType);
                Alert.alert("Notification", "Unable to open this specific screen directly.");
        }
    } catch (e) {
        console.error("Navigation Error", e);
        Alert.alert("Navigation Error", "Could not open the linked page.");
    }
  };

  // Filter Logic
  const filteredNotifications = notifications.filter(notification => {
    if (filterStatus === 'unread') return !notification.is_read;
    if (filterStatus === 'read') return notification.is_read;
    return true;
  });

  // Dynamic Styles Generator
  const styles = getStyles(theme);

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />;
    }
    if (error) {
      return <Text style={styles.errorText}>{error}</Text>;
    }
    if (filteredNotifications.length === 0) {
      return (
        <View style={styles.emptyContainer}>
            <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/128/4076/4076478.png' }} style={styles.emptyImage} />
            <Text style={styles.noNotificationsText}>You're all caught up!</Text>
        </View>
      );
    }
    return filteredNotifications.map(notification => (
      <TouchableOpacity
        key={notification.id}
        style={[styles.notificationItem, !notification.is_read && styles.notificationItemUnread]}
        onPress={() => handleNotificationPress(notification)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: getIconForTitle(notification.title) }}
          style={styles.notificationImage}
        />
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle} numberOfLines={1}>{notification.title}</Text>
          <Text style={styles.notificationMessage} numberOfLines={3}>{notification.message}</Text>
          <Text style={styles.notificationDate}>
            {formatNotificationTime(notification.created_at)}
          </Text>
        </View>
        {!notification.is_read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    ));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {['all', 'unread', 'read'].map(status => (
          <TouchableOpacity
            key={status}
            style={[styles.filterButton, filterStatus === status && styles.filterButtonActive]}
            onPress={() => setFilterStatus(status)}
          >
            <Text style={[styles.filterButtonText, filterStatus === status && styles.filterButtonTextActive]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
};

// --- STYLES ---
const getStyles = (theme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  
  filterContainer: { 
    flexDirection: 'row', 
    backgroundColor: theme.filterBg, 
    borderRadius: 25, 
    marginHorizontal: 15, 
    marginBottom: 15, 
    marginTop: 10, 
    padding: 4, 
    // Soft shadow
    shadowColor: theme.shadow, 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 2, 
    elevation: 2, 
  },
  filterButton: { flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  filterButtonActive: { backgroundColor: theme.primary, elevation: 2 },
  filterButtonText: { fontSize: 13, fontWeight: '600', color: theme.textSub },
  filterButtonTextActive: { color: '#ffffff' },
  
  scrollViewContent: { paddingHorizontal: 15, paddingBottom: 50, flexGrow: 1 },
  
  notificationItem: { 
    backgroundColor: theme.card, 
    borderRadius: 12, 
    padding: 15, 
    marginBottom: 12, 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    borderWidth: 1,
    borderColor: 'transparent',
    // Card Shadow
    shadowColor: theme.shadow, 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 3, 
    elevation: 2, 
  },
  notificationItemUnread: { 
    backgroundColor: theme.unreadBg, 
    borderColor: theme.border,
  },
  
  notificationImage: { width: 36, height: 36, marginRight: 15, resizeMode: 'contain', marginTop: 2 },
  
  notificationContent: { flex: 1, paddingRight: 5 },
  notificationTitle: { fontSize: 16, fontWeight: 'bold', color: theme.textMain, marginBottom: 4 },
  notificationMessage: { fontSize: 14, color: theme.textSub, marginBottom: 8, lineHeight: 20 },
  notificationDate: { fontSize: 11, color: theme.textLight, fontStyle: 'italic' },
  
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary, marginTop: 6 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyImage: { width: 80, height: 80, opacity: 0.5, marginBottom: 15 },
  noNotificationsText: { fontSize: 16, color: theme.textSub, textAlign: 'center' },
  errorText: { textAlign: 'center', marginTop: 50, fontSize: 14, color: '#ef4444' },
});

export default NotificationsScreen;