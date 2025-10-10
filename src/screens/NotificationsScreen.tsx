// 📂 File: src/screens/NotificationsScreen.tsx (FINAL VERSION WITH COMPLETE NAVIGATION)

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
} from 'react-native';
// ★ 1. IMPORT useNavigation
import { useNavigation } from '@react-navigation/native'; 
import apiClient from '../api/client';
import { format } from 'date-fns';

// --- Style Constants and Icons (No changes needed here) ---
const PRIMARY_COLOR = '#008080';
const TERTIARY_COLOR = '#f8f8ff';
// ... (rest of your constants are fine)

const notificationIcons = {
  default: 'https://cdn-icons-png.flaticon.com/128/8297/8297354.png',
  homework: 'https://cdn-icons-png.flaticon.com/128/2158/2158507.png',
  submission: 'https://cdn-icons-png.flaticon.com/128/17877/17877365.png',
  event: 'https://cdn-icons-png.flaticon.com/128/9592/9592283.png',
  announcement: 'https://cdn-icons-png.flaticon.com/128/11779/11779894.png',
  calendar: 'https://cdn-icons-png.flaticon.com/128/2693/2693507.png',
  timetable: 'https://cdn-icons-png.flaticon.com/128/1254/1254275.png',
  exam: 'https://cdn-icons-png.flaticon.com/128/4029/4029113.png',
  report: 'https://cdn-icons-png.flaticon.com/128/9913/9913576.png',
  syllabus: 'https://cdn-icons-png.flaticon.com/128/1584/1584937.png',
  gallery: 'https://cdn-icons-png.flaticon.com/128/8418/8418513.png',
  health: 'https://cdn-icons-png.flaticon.com/128/3004/3004458.png',
  lab: 'https://cdn-icons-png.flaticon.com/128/9562/9562280.png',
  sport: 'https://cdn-icons-png.flaticon.com/128/3429/3429456.png',
  transport: 'https://cdn-icons-png.flaticon.com/128/2945/2945694.png',
  food: 'https://cdn-icons-png.flaticon.com/128/2276/2276931.png',
  ad: 'https://cdn-icons-png.flaticon.com/128/4944/4944482.png',
  helpdesk: 'https://cdn-icons-png.flaticon.com/128/4961/4961736.png',
  suggestion: 'https://cdn-icons-png.flaticon.com/128/9722/9722906.png',
  payment: 'https://cdn-icons-png.flaticon.com/128/1198/1198291.png',
  kitchen: 'https://cdn-icons-png.flaticon.com/128/3081/3081448.png',
};

const getIconForTitle = (title: string = '') => {
    const lowerCaseTitle = title.toLowerCase();
    if (lowerCaseTitle.includes('homework') || lowerCaseTitle.includes('assignment')) return notificationIcons.homework;
    if (lowerCaseTitle.includes('submit') || lowerCaseTitle.includes('submission')) return notificationIcons.submission;
    if (lowerCaseTitle.includes('event')) return notificationIcons.event;
    if (lowerCaseTitle.includes('calendar')) return notificationIcons.calendar;
    if (lowerCaseTitle.includes('timetable') || lowerCaseTitle.includes('schedule')) return notificationIcons.timetable;
    if (lowerCaseTitle.includes('exam')) return notificationIcons.exam;
    if (lowerCaseTitle.includes('report')) return notificationIcons.report;
    if (lowerCaseTitle.includes('syllabus')) return notificationIcons.syllabus;
    if (lowerCaseTitle.includes('gallery')) return notificationIcons.gallery;
    // ... rest of your icon logic is fine
    return notificationIcons.default;
};

const NotificationsScreen = ({ onUnreadCountChange }) => {
  // ★ 2. GET THE NAVIGATION OBJECT
  const navigation = useNavigation();
  const [filterStatus, setFilterStatus] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    // ... no changes in this function
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

  // ★ 3. THE COMPLETE NAVIGATION HANDLER
  const handleNotificationPress = async (notification) => {
    // Mark the notification as read if it isn't already
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

    // Navigate based on the 'link' property
    if (!notification.link) {
        return; // Do nothing if there's no link
    }

    try {
        const parts = notification.link.split('/').filter(Boolean); // e.g., ['homework', '123']
        if (parts.length === 0) return;

        const screen = parts[0];
        const id1 = parts[1]; // Can be an ID or title
        const id2 = parts[2]; // For more complex links like /helpdesk/ticket/45

        console.log(`Navigating to screen: ${screen} with IDs:`, id1, id2);

        // Make sure to replace screen names with your actual screen names from your navigator!
        switch (screen) {
            case 'calendar':
                navigation.navigate('AcademicCalendar');
                break;
            case 'gallery':
                // For nested navigators, you might need to specify the screen inside a navigator
                navigation.navigate('Gallery', { screen: 'AlbumDetail', params: { albumTitle: id1 } });
                break;
            case 'homework':
                // Assumes you have a Homework screen that takes an assignmentId
                navigation.navigate('StudentHomework', { assignmentId: parseInt(id1, 10) });
                break;
            case 'submissions':
                // For a teacher to view submissions for an assignment
                navigation.navigate('TeacherHomeworkSubmissions', { assignmentId: parseInt(id1, 10) });
                break;
            case 'helpdesk':
                 if (id1 === 'ticket') {
                    navigation.navigate('HelpDeskTicketDetail', { ticketId: parseInt(id2, 10) });
                 }
                 break;
            // Add other cases here based on your backend links...
            
            default:
                console.warn(`No navigation route configured for link: ${notification.link}`);
                // Optional: navigate to a default screen if the link is unknown
                // navigation.navigate('Home'); 
        }
    } catch (e) {
        console.error("Navigation error:", e);
        Alert.alert("Navigation Error", "Could not open the linked page. The screen may not exist.");
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filterStatus === 'unread') return !notification.is_read;
    return true;
  });

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator size="large" color={PRIMARY_COLOR} style={{ marginTop: 50 }} />;
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
        // ★ 4. ATTACH THE HANDLER
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
            {format(new Date(notification.created_at), "MMM d, yyyy - h:mm a")}
          </Text>
        </View>
      </TouchableOpacity>
    ));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[PRIMARY_COLOR]} />}
      >
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // ... no changes to styles
  safeArea: { flex: 1, backgroundColor: TERTIARY_COLOR },
  filterContainer: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 25, marginHorizontal: 15, marginBottom: 15, marginTop: 10, padding: 5, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, },
  filterButton: { flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  filterButtonActive: { backgroundColor: PRIMARY_COLOR },
  filterButtonText: { fontSize: 14, fontWeight: 'bold', color: TEXT_COLOR_MEDIUM },
  filterButtonTextActive: { color: 'white' },
  scrollViewContent: { paddingHorizontal: 15, paddingBottom: 100, minHeight: '100%' },
  notificationItem: { backgroundColor: 'white', borderRadius: 10, padding: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 5, borderLeftColor: '#ccc', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, },
  notificationItemUnread: { backgroundColor: '#e6fffa', borderLeftColor: PRIMARY_COLOR, },
  notificationImage: { width: 32, height: 32, marginRight: 15, },
  notificationContent: { flex: 1 },
  notificationTitle: { fontSize: 16, fontWeight: 'bold', color: TEXT_COLOR_DARK, marginBottom: 4 },
  notificationMessage: { fontSize: 14, color: TEXT_COLOR_MEDIUM, marginBottom: 6, lineHeight: 20 },
  notificationDate: { fontSize: 12, color: TEXT_COLOR_LIGHT },
  noNotificationsText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: TEXT_COLOR_MEDIUM, },
  errorText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: 'red', marginHorizontal: 20, },
});

export default NotificationsScreen;