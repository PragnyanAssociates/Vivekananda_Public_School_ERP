import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
  useColorScheme,
  StatusBar,
  Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';

import apiClient from '../api/client'; 
import { useAuth } from '../context/AuthContext'; 

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    textLight: '#90A4AE',
    border: '#CFD8DC',
    iconBg: '#E0F2F1',
    unreadBg: '#E0F2F1', 
    shadow: '#000000',
    white: '#ffffff',
    danger: '#E53935',
    success: '#43A047',
    blue: '#1E88E5'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    textLight: '#757575',
    border: '#333333',
    iconBg: 'rgba(0, 128, 128, 0.2)',
    unreadBg: 'rgba(0, 128, 128, 0.15)',
    shadow: '#000000',
    white: '#ffffff',
    danger: '#EF5350',
    success: '#66BB6A',
    blue: '#42A5F5'
};

// --- ICON MAPPING ---
const notificationIcons = {
  default: 'https://cdn-icons-png.flaticon.com/128/8297/8297354.png',
  homework: 'https://cdn-icons-png.flaticon.com/128/11647/11647336.png',
  submission: 'https://cdn-icons-png.flaticon.com/128/11647/11647336.png',
  event: 'https://cdn-icons-png.flaticon.com/128/9592/9592283.png',
  calendar: 'https://cdn-icons-png.flaticon.com/128/4982/4982266.png',
  timetable: 'https://cdn-icons-png.flaticon.com/128/1254/1254275.png',
  exam: 'https://cdn-icons-png.flaticon.com/128/9913/9913475.png',
  report: 'https://cdn-icons-png.flaticon.com/128/1378/1378646.png',
  syllabus: 'https://cdn-icons-png.flaticon.com/128/1584/1584937.png',
  gallery: 'https://cdn-icons-png.flaticon.com/128/8418/8418513.png',
  health: 'https://cdn-icons-png.flaticon.com/128/2382/2382533.png',
  lab: 'https://cdn-icons-png.flaticon.com/128/17104/17104528.png',
  transport: 'https://cdn-icons-png.flaticon.com/128/2945/2945694.png',
  food: 'https://cdn-icons-png.flaticon.com/128/561/561611.png',
  kitchen: 'https://cdn-icons-png.flaticon.com/128/1698/1698742.png',
  chat: 'https://cdn-icons-png.flaticon.com/128/13819/13819448.png',
  'online-class': 'https://cdn-icons-png.flaticon.com/128/8388/8388104.png',
  attendance: 'https://cdn-icons-png.flaticon.com/128/992/992683.png',
  library: 'https://cdn-icons-png.flaticon.com/128/9043/9043296.png',
  ptm: 'https://cdn-icons-png.flaticon.com/128/3214/3214781.png',
  materials: 'https://cdn-icons-png.flaticon.com/128/3273/3273259.png'
};

const getIconForTitle = (title) => {
    const lower = (title || '').toLowerCase();
    
    if (lower.includes('homework') || lower.includes('assignment')) return notificationIcons.homework;
    if (lower.includes('exam')) return notificationIcons.exam;
    if (lower.includes('submit') || lower.includes('submission')) return notificationIcons.submission;
    if (lower.includes('material') || lower.includes('resource') || lower.includes('notes')) return notificationIcons.materials;
    if (lower.includes('timetable') || lower.includes('schedule')) return notificationIcons.timetable;
    if (lower.includes('syllabus')) return notificationIcons.syllabus;
    if (lower.includes('class') || lower.includes('online')) return notificationIcons['online-class'];
    if (lower.includes('attendance') || lower.includes('absent')) return notificationIcons.attendance;
    if (lower.includes('result') || lower.includes('report') || lower.includes('mark')) return notificationIcons.report;
    if (lower.includes('library') || lower.includes('book')) return notificationIcons.library;
    if (lower.includes('lab')) return notificationIcons.lab;
    if (lower.includes('transport') || lower.includes('bus')) return notificationIcons.transport;
    if (lower.includes('food') || lower.includes('menu')) return notificationIcons.food;
    if (lower.includes('kitchen')) return notificationIcons.kitchen;
    if (lower.includes('chat') || lower.includes('message')) return notificationIcons.chat;
    if (lower.includes('ptm') || lower.includes('meeting')) return notificationIcons.ptm;
    if (lower.includes('gallery') || lower.includes('photo')) return notificationIcons.gallery;
    if (lower.includes('health')) return notificationIcons.health;
    if (lower.includes('event')) return notificationIcons.event;
    
    return notificationIcons.default;
};

// --- CORRECTED DATE FORMATTER (Matching GroupChatScreen Logic) ---
const formatNotificationDate = (dateInput) => {
  if (!dateInput) return '';
  try {
      // Logic borrowed from GroupChatScreen: new Date(timestamp)
      // This respects the string sent from the server without adding extra timezone offsets
      const date = new Date(dateInput);
      
      if (isNaN(date.getTime())) return String(dateInput);

      // Extract Time (HH:MM AM/PM)
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Extract Date (DD/MM/YYYY)
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      return `${day}/${month}/${year} • ${timeStr}`;
  } catch (e) { 
      return String(dateInput); 
  }
};

const NotificationsScreen = ({ onUnreadCountChange }) => {
  const navigation = useNavigation(); 
  const { user } = useAuth(); 
  
  // Theme Hooks
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? DarkColors : LightColors;

  const [filterStatus, setFilterStatus] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useLayoutEffect(() => {
      navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // --- FETCH NOTIFICATIONS (Sorted Newest First) ---
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await apiClient.get('/notifications');
      
      // SORT: Latest date first (Desc Order)
      const sortedData = response.data.sort((a, b) => {
          return new Date(b.created_at) - new Date(a.created_at);
      });

      setNotifications(sortedData);
      
      // Update Badge
      if (onUnreadCountChange) {
          const unreadCount = sortedData.filter(n => !n.is_read || n.is_read === 0).length;
          onUnreadCountChange(unreadCount);
      }
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
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
    // 1. OPTIMISTIC UI UPDATE (Mark as read immediately)
    if (!notification.is_read || notification.is_read === 0) {
        
        const updatedList = notifications.map(n => 
            n.id === notification.id ? { ...n, is_read: 1 } : n
        );
        setNotifications(updatedList);

        if (onUnreadCountChange) {
            const unreadCount = updatedList.filter(n => !n.is_read || n.is_read === 0).length;
            onUnreadCountChange(unreadCount);
        }

        apiClient.put(`/notifications/${notification.id}/read`).catch(error => {
            console.error("Background Read Update Failed:", error);
        });
    }

    // 2. Navigation Logic
    if (!notification.link) return;

    try {
        const parts = notification.link.split('/').filter(Boolean);
        if (parts.length === 0) return;

        const screenType = parts[0].toLowerCase(); 

        switch (screenType) {
            // --- ATTENDANCE ---
            case 'attendance':
            case 'my-attendance':
            case 'attendance-alert':
                navigation.navigate('Attendance'); 
                break;

            case 'mark-attendance':
                if (user?.role === 'teacher' || user?.role === 'admin') {
                    navigation.navigate('MarkStudentAttendance');
                } else {
                    navigation.navigate('Attendance');
                }
                break;

            // --- EVENTS ---
            case 'events':
                if (user?.role === 'student') {
                    navigation.navigate('StudentEventsScreen');
                } else {
                    navigation.navigate('AdminEventsScreen');
                }
                break;

            // --- TIMETABLE ---
            case 'timetable':
                navigation.navigate('TimetableScreen'); 
                break;

            // --- HOMEWORK ---
            case 'homework':
            case 'assignment':
            case 'submissions':
                if (user?.role === 'student') {
                    navigation.navigate('StudentHomework'); 
                } else {
                    navigation.navigate('TeacherAdminHomeworkScreen');
                }
                break;

            // --- STUDY MATERIALS ---
            case 'study-materials':
            case 'materials':
                if (user?.role === 'student') {
                    navigation.navigate('StudentMaterialsScreen');
                } else {
                    navigation.navigate('TeacherAdminMaterialsScreen');
                }
                break;

            // --- EXAMS ---
            case 'exams':
            case 'exam':
                if (user?.role === 'student') navigation.navigate('StudentExamsScreen');
                else navigation.navigate('TeacherAdminExamsScreen');
                break;
            case 'exam-schedule':
                if (user?.role === 'student') navigation.navigate('StudentExamScreen');
                else navigation.navigate('TeacherAdminExamScreen');
                break;
            case 'marks':
            case 'result':
                if (user?.role === 'student') navigation.navigate('MyPerformance');
                else navigation.navigate('ReportScreen');
                break;

            // --- GENERAL ACADEMICS ---
            case 'syllabus':
                if (user?.role === 'student') navigation.navigate('StudentSyllabusScreen');
                else if (user?.role === 'teacher') navigation.navigate('TeacherSyllabusScreen');
                else navigation.navigate('AdminSyllabusScreen');
                break;
            case 'online-class':
                navigation.navigate('OnlineClassScreen');
                break;
            case 'labs':
                if (user?.role === 'student') navigation.navigate('StudentLabsScreen');
                else navigation.navigate('TeacherAdminLabsScreen');
                break;
            
            // --- FACILITIES ---
            case 'health':
            case 'health-info':
                if (user?.role === 'student') navigation.navigate('StudentHealthScreen');
                else navigation.navigate('TeacherHealthAdminScreen');
                break;
            case 'transport':
                navigation.navigate('TransportScreen');
                break;
            case 'food':
            case 'menu':
                navigation.navigate('FoodScreen');
                break;
            case 'library':
                navigation.navigate('LibraryHomeScreen');
                break;

            // --- COMMUNICATION ---
            case 'ptm':
                if (user?.role === 'student') navigation.navigate('StudentPTMScreen');
                else navigation.navigate('TeacherAdminPTMScreen');
                break;
            case 'chat':
                navigation.navigate('ChatFeature');
                break;

            // --- GENERAL ---
            case 'calendar': 
                navigation.navigate('AcademicCalendar'); 
                break;
            case 'gallery':
                navigation.navigate('Gallery'); 
                break;
            case 'profile':
                navigation.navigate('ProfileScreen');
                break;

            default:
                Alert.alert("Notification", notification.message);
        }
    } catch (e) {
        console.error("Navigation Error", e);
        Alert.alert("Error", "Could not open link.");
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    const isRead = notification.is_read === 1 || notification.is_read === true;
    
    if (filterStatus === 'unread') return !isRead;
    if (filterStatus === 'read') return isRead;
    return true;
  });

  const styles = getStyles(theme);

  const renderItem = ({ item, index }) => {
    const isRead = item.is_read === 1 || item.is_read === true;

    return (
        <Animatable.View animation="fadeInUp" duration={500} delay={index * 50}>
            <TouchableOpacity
                style={[styles.card, !isRead && styles.unreadCard]}
                onPress={() => handleNotificationPress(item)}
                activeOpacity={0.7}
            >
                <View style={styles.row}>
                    <Image source={{ uri: getIconForTitle(item.title) }} style={styles.icon} />
                    <View style={styles.content}>
                        <View style={styles.headerRow}>
                            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                            {!isRead && <View style={styles.dot} />}
                        </View>
                        <Text style={styles.message} numberOfLines={3}>{item.message}</Text>
                        <View style={styles.footer}>
                            <Text style={styles.sender}>{item.sender_name || 'System'}</Text>
                            {/* Updated Time Format */}
                            <Text style={styles.date}>{formatNotificationDate(item.created_at)}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </Animatable.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      
      {/* --- HEADER CARD --- */}
      <View style={styles.headerCard}>
        <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={24} color={theme.textMain} />
            </TouchableOpacity>
            <View style={styles.headerIconContainer}>
                <MaterialIcons name="notifications-none" size={24} color={theme.primary} />
            </View>
            <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Notifications</Text>
                <Text style={styles.headerSubtitle}>Stay Updated</Text>
            </View>
        </View>
      </View>

      {/* --- FILTER TABS --- */}
      <View style={styles.filterContainer}>
        {['all', 'unread', 'read'].map(status => (
          <TouchableOpacity
            key={status}
            style={[styles.filterButton, filterStatus === status && styles.filterButtonActive]}
            onPress={() => setFilterStatus(status)}
          >
            <Text style={[styles.filterText, filterStatus === status && styles.filterTextActive]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* --- NOTIFICATION LIST --- */}
      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
            data={filteredNotifications}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.primary]} tintColor={theme.primary} />
            }
            ListEmptyComponent={
                <View style={styles.emptyBox}>
                    <MaterialCommunityIcons name="bell-sleep-outline" size={60} color={theme.textLight} />
                    <Text style={styles.emptyText}>No notifications found.</Text>
                </View>
            }
        />
      )}
    </SafeAreaView>
  );
};

// --- STYLES ---
const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  
  // Header Card
  headerCard: {
    paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center',
    marginTop: 15, marginBottom: 10, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.cardBg,
    elevation: 3, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    shadowColor: theme.shadow
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  backButton: { padding: 5, marginRight: 5 },
  headerIconContainer: {
    borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center',
    marginRight: 12, backgroundColor: theme.iconBg
  },
  headerTextContainer: { justifyContent: 'center', flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: theme.textMain },
  headerSubtitle: { fontSize: 13, color: theme.textSub, marginTop: 2 },

  // Filters
  filterContainer: {
    flexDirection: 'row', backgroundColor: theme.background,
    marginHorizontal: 15, marginBottom: 10
  },
  filterButton: {
    flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 20,
    borderWidth: 1, borderColor: theme.border, marginRight: 8,
    backgroundColor: theme.cardBg
  },
  filterButtonActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: theme.textSub },
  filterTextActive: { color: '#fff' },

  // List Items
  listContent: { paddingHorizontal: width * 0.03, paddingBottom: 20 },
  card: {
    backgroundColor: theme.cardBg, borderRadius: 12, padding: 15, marginBottom: 12,
    elevation: 2, shadowColor: theme.shadow, shadowOpacity: 0.05, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, borderLeftWidth: 4, borderLeftColor: 'transparent'
  },
  unreadCard: { backgroundColor: theme.unreadBg, borderLeftColor: theme.primary },
  
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  icon: { width: 36, height: 36, resizeMode: 'contain', marginRight: 15, marginTop: 2 },
  content: { flex: 1 },
  
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 15, fontWeight: 'bold', color: theme.textMain, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary },
  
  message: { fontSize: 13, color: theme.textSub, lineHeight: 18, marginBottom: 8 },
  
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sender: { fontSize: 12, color: theme.primary, fontWeight: '600' },
  date: { fontSize: 11, color: theme.textLight, fontStyle: 'italic' },

  emptyBox: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { marginTop: 10, color: theme.textSub, fontSize: 16 }
});

export default NotificationsScreen;