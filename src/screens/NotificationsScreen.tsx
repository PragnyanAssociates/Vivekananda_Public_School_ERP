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
    background: '#f8f8ff',
    card: '#ffffff',
    textMain: '#333333',
    textSub: '#666666',
    textLight: '#999999',
    border: '#cccccc',
    filterBg: '#ffffff',
    unreadBg: '#e6fffa',
    shadow: '#000000'
  },
  dark: {
    primary: '#008080',
    background: '#121212',
    card: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    textLight: '#757575',
    border: '#333333',
    filterBg: '#2C2C2C',
    unreadBg: 'rgba(0, 128, 128, 0.25)', // Darker translucent teal
    shadow: '#000000'
  }
};

const notificationIcons = {
  default: 'https://cdn-icons-png.flaticon.com/128/8297/8297354.png',
  homework: 'https://cdn-icons-png.flaticon.com/128/11647/11647336.png',
  submission: 'https://cdn-icons-png.flaticon.com/128/11647/11647336.png',
  event: 'https://cdn-icons-png.flaticon.com/128/9592/9592283.png',
  announcement: 'https://cdn-icons-png.flaticon.com/128/16117/16117762.png',
  calendar: 'https://cdn-icons-png.flaticon.com/128/4982/4982266.png',
  timetable: 'https://cdn-icons-png.flaticon.com/128/1254/1254275.png',
  exam: 'https://cdn-icons-png.flaticon.com/128/9913/9913475.png',
  report: 'https://cdn-icons-png.flaticon.com/128/1378/1378646.png',
  syllabus: 'https://cdn-icons-png.flaticon.com/128/1584/1584937.png',
  gallery: 'https://cdn-icons-png.flaticon.com/128/8418/8418513.png',
  health: 'https://cdn-icons-png.flaticon.com/128/2382/2382533.png',
  lab: 'https://cdn-icons-png.flaticon.com/128/17104/17104528.png',
  sport: 'https://cdn-icons-png.flaticon.com/128/3429/3429456.png',
  transport: 'https://cdn-icons-png.flaticon.com/128/2945/2945694.png',
  food: 'https://cdn-icons-png.flaticon.com/128/561/561611.png',
  ad: 'https://cdn-icons-png.flaticon.com/128/4944/4944482.png',
  helpdesk: 'https://cdn-icons-png.flaticon.com/128/4961/4961736.png',
  suggestion: 'https://cdn-icons-png.flaticon.com/128/9722/9722906.png',
  payment: 'https://cdn-icons-png.flaticon.com/128/1198/1198291.png',
  kitchen: 'https://cdn-icons-png.flaticon.com/128/1698/1698742.png',
  chat: 'https://cdn-icons-png.flaticon.com/128/13819/13819448.png',
  'online-class': 'https://cdn-icons-png.flaticon.com/128/8388/8388104.png',
  attendance: 'https://cdn-icons-png.flaticon.com/128/992/992683.png',
};

const getIconForTitle = (title) => {
    const lowerCaseTitle = (title || '').toLowerCase();
    if (lowerCaseTitle.includes('homework') || lowerCaseTitle.includes('assignment')) return notificationIcons.homework;
    if (lowerCaseTitle.includes('submit') || lowerCaseTitle.includes('submission')) return notificationIcons.submission;
    if (lowerCaseTitle.includes('event')) return notificationIcons.event;
    if (lowerCaseTitle.includes('calendar')) return notificationIcons.calendar;
    if (lowerCaseTitle.includes('timetable') || lowerCaseTitle.includes('schedule')) return notificationIcons.timetable;
    if (lowerCaseTitle.includes('exam')) return notificationIcons.exam;
    if (lowerCaseTitle.includes('result') || lowerCaseTitle.includes('report')) return notificationIcons.report;
    if (lowerCaseTitle.includes('syllabus')) return notificationIcons.syllabus;
    if (lowerCaseTitle.includes('gallery')) return notificationIcons.gallery;
    if (lowerCaseTitle.includes('health')) return notificationIcons.health;
    if (lowerCaseTitle.includes('lab')) return notificationIcons.lab;
    if (lowerCaseTitle.includes('chat')) return notificationIcons.chat;
    if (lowerCaseTitle.includes('class')) return notificationIcons['online-class'];
    if (lowerCaseTitle.includes('food') || lowerCaseTitle.includes('kitchen')) return notificationIcons.food;
    if (lowerCaseTitle.includes('attendance') || lowerCaseTitle.includes('absent')) return notificationIcons.attendance;
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

  const fetchNotifications = useCallback(async () => {
    try {
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

  const handleNotificationPress = async (notification) => {
    if (!notification.is_read) {
        try {
            await apiClient.put(`/notifications/${notification.id}/read`);
            setNotifications(prev =>
                prev.map(n => n.id === notification.id ? { ...n, is_read: 1 } : n)
            );
        } catch (error) {
            console.error("Failed to mark notification as read:", error);
        }
    }

    if (!notification.link) return;

    try {
        const parts = notification.link.split('/').filter(Boolean);
        if (parts.length === 0) return;

        const screen = parts[0].toLowerCase();
        const param1 = parts[1];
        const param2 = parts[2];

        if (user?.role === 'teacher' && (screen === 'teacher-attendance' || screen === 'my-attendance-report')) {
            return navigation.navigate('TeacherAttendanceReportScreen');
        }
        if (user?.role === 'admin' && (screen === 'teacher-attendance')) {
            return navigation.navigate('TeacherAttendanceMarkingScreen');
        }
        
        switch (screen) {
            case 'calendar': navigation.navigate('AcademicCalendar'); break;
            case 'timetable': navigation.navigate('TimetableScreen'); break;
            case 'my-attendance':
            case 'attendance': navigation.navigate('Attendance'); break;
            case 'chat':
            case 'groupchat': navigation.navigate('GroupChatScreen'); break;
            case 'online-class': navigation.navigate('OnlineClassScreen'); break;
            case 'gallery':
                navigation.navigate('Gallery', { screen: 'AlbumDetail', params: { title: param1 } });
                break;
            case 'homework': navigation.navigate('StudentHomework', { screen: 'HomeworkList' }); break;
            case 'events': navigation.navigate(user?.role === 'admin' ? 'AdminEventsScreen' : 'StudentEventsScreen'); break;
            case 'health':
            case 'health-info': navigation.navigate(user?.role === 'teacher' ? 'TeacherHealthAdminScreen' : 'StudentHealthScreen'); break;
            case 'exam-schedule': navigation.navigate(user?.role === 'teacher' ? 'TeacherAdminExamScreen' : 'StudentExamScreen'); break;
            case 'exams': navigation.navigate(user?.role === 'teacher' ? 'TeacherAdminExamsScreen' : 'StudentExamsScreen'); break;
            case 'materials': navigation.navigate(user?.role === 'teacher' ? 'TeacherAdminMaterialsScreen' : 'StudentMaterialsScreen'); break;
            case 'syllabus': navigation.navigate(user?.role === 'teacher' ? 'TeacherSyllabusScreen' : 'StudentSyllabusScreen'); break;
            case 'resources': navigation.navigate(user?.role === 'teacher' ? 'TeacherAdminResourcesScreen' : 'StudentResourcesScreen'); break;
            case 'ptm': navigation.navigate(user?.role === 'teacher' ? 'TeacherAdminPTMScreen' : 'StudentPTMScreen'); break;
            case 'labs': navigation.navigate(user?.role === 'teacher' ? 'TeacherAdminLabsScreen' : 'StudentLabsScreen'); break;
            case 'reports':
                if (param1 === 'report' && param2) {
                    navigation.navigate('ReportDetailScreen', { reportId: parseInt(param2, 10) });
                } else {
                    navigation.navigate(user?.role === 'teacher' ? 'TeacherAdminResultsScreen' : 'StudentResultsScreen');
                }
                break;
            case 'submissions': navigation.navigate('TeacherAdminHomeworkScreen'); break;
            case 'leave': navigation.navigate('AdminLM'); break;
            case 'ads': navigation.navigate('AdminAdDashboardScreen'); break;
            case 'food-menu':
            case 'food': navigation.navigate('FoodScreen'); break;
            case 'kitchen': navigation.navigate('KitchenScreen'); break;
            default:
                Alert.alert("Navigation", `This notification type (${screen}) doesn't have a configured screen.`);
        }
    } catch (e) {
        Alert.alert("Navigation Error", "Could not open the linked page.");
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filterStatus === 'unread') return !notification.is_read;
    if (filterStatus === 'read') return notification.is_read;
    return true;
  });

  // Dynamic Styles
  const styles = getStyles(theme);

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />;
    }
    if (error) {
      return <Text style={styles.errorText}>{error}</Text>;
    }
    if (filteredNotifications.length === 0) {
      return <Text style={styles.noNotificationsText}>You're all caught up!</Text>;
    }
    return filteredNotifications.map(notification => (
      <TouchableOpacity
        key={notification.id}
        style={[styles.notificationItem, !notification.is_read && styles.notificationItemUnread]}
        onPress={() => handleNotificationPress(notification)}
      >
        <Image
          source={{ uri: getIconForTitle(notification.title) }}
          style={styles.notificationImage}
        />
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>{notification.title}</Text>
          <Text style={styles.notificationMessage}>{notification.message}</Text>
          <Text style={styles.notificationDate}>
            {formatNotificationTime(notification.created_at)}
          </Text>
        </View>
      </TouchableOpacity>
    ));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      
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
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
      >
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  
  filterContainer: { 
    flexDirection: 'row', 
    backgroundColor: theme.filterBg, 
    borderRadius: 25, 
    marginHorizontal: width * 0.04, 
    marginBottom: 15, 
    marginTop: 10, 
    padding: 5, 
    elevation: 2, 
    shadowColor: theme.shadow, 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 3, 
  },
  filterButton: { flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  filterButtonActive: { backgroundColor: theme.primary },
  filterButtonText: { fontSize: 14, fontWeight: 'bold', color: theme.textSub },
  filterButtonTextActive: { color: '#ffffff' },
  
  scrollViewContent: { paddingHorizontal: width * 0.04, paddingBottom: 100, minHeight: '100%' },
  
  notificationItem: { 
    backgroundColor: theme.card, 
    borderRadius: 10, 
    padding: 15, 
    marginBottom: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderLeftWidth: 5, 
    borderLeftColor: theme.border, 
    elevation: 2, 
    shadowColor: theme.shadow, 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 3, 
  },
  notificationItemUnread: { 
    backgroundColor: theme.unreadBg, 
    borderLeftColor: theme.primary, 
  },
  
  notificationImage: { width: 32, height: 32, marginRight: 15, resizeMode: 'contain' },
  
  notificationContent: { flex: 1 },
  notificationTitle: { fontSize: 16, fontWeight: 'bold', color: theme.textMain, marginBottom: 4 },
  notificationMessage: { fontSize: 14, color: theme.textSub, marginBottom: 6, lineHeight: 20 },
  notificationDate: { fontSize: 12, color: theme.textLight },
  
  noNotificationsText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: theme.textSub },
  errorText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: 'red', marginHorizontal: 20 },
});

export default NotificationsScreen;