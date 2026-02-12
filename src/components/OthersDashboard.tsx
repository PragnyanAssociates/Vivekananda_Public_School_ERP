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
  // --- CHANGE 1: REMOVE standard Image component (Kept comment as requested) ---
  // Image,
  Platform,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
  useColorScheme,
  StatusBar
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
import TransportScreen from '../screens/transport/TransportScreen';

// --- COMPONENT IMPORTS ---
import NotificationsScreen from '../screens/NotificationsScreen';
import AcademicCalendar from './AcademicCalendar';
import ProfileScreen from '../screens/ProfileScreen';
import AboutUs from './AboutUs';
import FoodScreen from '../screens/food/FoodScreen';
import KitchenScreen from '../screens/kitchen/KitchenScreen';

const { width: windowWidth } = Dimensions.get('window');
const CARD_GAP = 12;
const CONTENT_HORIZONTAL_PADDING = 15;
const BOTTOM_NAV_HEIGHT = 70;
const PRIMARY_COLOR = '#008080';
const DANGER_COLOR = '#ef4444';

const MAIN_TABS = ['home', 'calendar', 'profile'];

// --- THEME COLORS ---
const COLORS = {
    light: {
        background: '#f8f8ff',
        cardBg: '#ffffff',
        textPrimary: '#333333',
        textSecondary: '#555555',
        border: '#b2ebf2',
        secondary: '#e0f2f7',
        inputBg: '#ffffff',
        placeholder: '#555555',
        shadow: '#000000',
    },
    dark: {
        background: '#121212',
        cardBg: '#1e1e1e',
        textPrimary: '#ffffff',
        textSecondary: '#bbbbbb',
        border: '#333333',
        secondary: '#1e1e1e',
        inputBg: '#2C2C2C',
        placeholder: '#888888',
        shadow: '#000000',
    }
};

const OthersDashboard = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const isFocused = useIsFocused();
  const [isProfileModalVisible, setProfileModalVisible] = useState(false);
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(true);
  
  // Theme Hooks
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const theme = isDarkMode ? COLORS.dark : COLORS.light;

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
    { id: 'qa4', title: 'Gallery', imageSource: 'https://cdn-icons-png.flaticon.com/128/8418/8418513.png', navigateTo: 'Gallery' },
    { id: 'qa5', title: 'About Us', imageSource: 'https://cdn-icons-png.flaticon.com/128/3815/3815523.png', navigateToTab: 'AboutUs' },
    { id: 'qa9', title: 'Lunch Menu', imageSource: 'https://cdn-icons-png.flaticon.com/128/561/561611.png', navigateToTab: 'FoodScreen' },
    { id: 'qa16', title: 'Kitchen', imageSource: 'https://cdn-icons-png.flaticon.com/128/1698/1698742.png', navigateToTab: 'KitchenScreen' },
    // { id: 'qa31', title: 'Transport', imageSource: 'https://cdn-icons-png.flaticon.com/128/3124/3124263.png', navigateToTab: 'TransportScreen' },
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

  const ContentScreenHeader = ({ title, onBack }) => ( 
    <View style={[styles.contentHeader, { backgroundColor: theme.secondary, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButtonGlobal}>
            <MaterialIcons name="arrow-back" size={24} color={PRIMARY_COLOR} />
        </TouchableOpacity>
        <Text style={[styles.contentHeaderTitle, { color: PRIMARY_COLOR }]}>{title}</Text>
        <View style={{ width: 30 }} />
    </View> 
  );

  const renderContent = () => {
    const handleBack = () => switchTab('home');
    
    switch (activeTab) {
        case 'home':
          return (
            <>
              <View style={[styles.searchContainer, { backgroundColor: theme.inputBg, borderColor: theme.border, shadowColor: theme.shadow }]}>
                <MaterialIcons name="search" size={22} color={theme.textSecondary} style={styles.searchIcon} />
                <TextInput 
                    style={[styles.searchInput, { color: theme.textPrimary }]} 
                    placeholder="Search for a module..." 
                    placeholderTextColor={theme.placeholder} 
                    value={searchQuery} 
                    onChangeText={setSearchQuery} 
                    clearButtonMode="while-editing" 
                />
              </View>
              <ScrollView contentContainerStyle={styles.contentScrollViewContainer}>
                <View style={styles.dashboardGrid}>
                  {filteredItems.map((item) => (
                      <DashboardCard 
                        key={item.id} 
                        item={item} 
                        theme={theme}
                        onPress={() => {
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
                {filteredItems.length === 0 && (<View style={styles.noResultsContainer}><Text style={[styles.noResultsText, { color: theme.textSecondary }]}>No modules found for "{searchQuery}"</Text></View>)}
              </ScrollView>
            </>
          );
  
        case 'allNotifications': return ( <><ContentScreenHeader title="Notifications" onBack={handleBack} /><NotificationsScreen onUnreadCountChange={setUnreadNotificationsCount} /></> );
        case 'calendar': return ( <><ContentScreenHeader title="Academic Calendar" onBack={handleBack} /><AcademicCalendar /></> );
        case 'profile': return ( <><ContentScreenHeader title="My Profile" onBack={handleBack} /><ProfileScreen /></> );
        case 'AboutUs': return ( <><ContentScreenHeader title="About Us" onBack={handleBack} /><AboutUs /></> );
        case 'FoodScreen': return ( <><ContentScreenHeader title="Lunch Menu" onBack={handleBack} /><FoodScreen /></> );
        case 'KitchenScreen': return ( <><ContentScreenHeader title="Kitchen" onBack={handleBack} /><KitchenScreen /></> );
        case 'TransportScreen': return ( <><ContentScreenHeader title="Transport" onBack={handleBack} /><TransportScreen /></> );

        default: return ( <View style={styles.fallbackContent}><Text style={[styles.fallbackText, { color: theme.textSecondary }]}>Content for '{activeTab}' is not available.</Text><TouchableOpacity onPress={handleBack}><Text style={styles.fallbackLink}>Go to Home</Text></TouchableOpacity></View> );
      }
  };

  return (
    <LinearGradient colors={[theme.background, theme.background]} style={{flex: 1}}>
    <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.secondary} />
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {activeTab === 'home' && (
        <View style={[styles.topBar, { backgroundColor: theme.secondary, borderBottomColor: theme.border, shadowColor: theme.shadow }]}>
          <TouchableOpacity style={styles.profileContainer} onPress={() => setProfileModalVisible(true)} activeOpacity={0.8}>
              {/* --- CHANGE 4: USE FastImage INSTEAD OF Image --- */}
              <FastImage source={profileImageSource} style={[styles.profileImage, { borderColor: PRIMARY_COLOR, backgroundColor: theme.cardBg }]} />
              <View style={styles.profileTextContainer}>
                <Text style={styles.profileNameText} numberOfLines={1}>{user?.full_name || 'Administrator'}</Text>
                <Text style={[styles.profileRoleText, { color: theme.textSecondary }]}>{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin'}</Text>
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
        <View style={[styles.bottomNav, { backgroundColor: theme.secondary, borderTopColor: theme.border, shadowColor: theme.shadow }]}>
          <BottomNavItem icon="home" label="Home" isActive={activeTab === 'home'} theme={theme} onPress={() => switchTab('home')} />
          <BottomNavItem icon="calendar" label="Calendar" isActive={activeTab === 'calendar'} theme={theme} onPress={() => switchTab('calendar')} />
          <BottomNavItem icon="user" label="Profile" isActive={activeTab === 'profile'} theme={theme} onPress={() => switchTab('profile')} />
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

// --- Helper Components ---

const DashboardCard = ({ item, onPress, theme }) => {
    return (
        <TouchableOpacity style={styles.dashboardCardWrapper} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.dashboardCard, { backgroundColor: theme.cardBg, shadowColor: theme.shadow }]}>
                <View style={styles.cardIconContainer}>
                    {/* The standard Image component is fine for these external icons */}
                    <Image source={{ uri: item.imageSource }} style={styles.cardImage} />
                </View>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{item.title}</Text>
            </View>
        </TouchableOpacity>
    );
};

const BottomNavItem = ({ icon, label, isActive, onPress, theme }) => {
    return (
      <TouchableOpacity style={styles.navItem} onPress={onPress}>
          <Icon name={icon} size={24} color={isActive ? PRIMARY_COLOR : theme.textSecondary} />
          <Text style={[styles.navText, { color: isActive ? PRIMARY_COLOR : theme.textSecondary, fontWeight: isActive ? 'bold' : 'normal' }]}>{label}</Text>
      </TouchableOpacity>
    );
};
  
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    topBar: { paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 12 : 15, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderBottomWidth: 1 },
    profileContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10, },
    profileImage: { width: 45, height: 45, borderRadius: 22.5, borderWidth: 2 },
    profileTextContainer: { marginLeft: 12, flex: 1, },
    profileNameText: { color: PRIMARY_COLOR, fontSize: 17, fontWeight: 'bold', },
    profileRoleText: { fontSize: 13, },
    topBarActions: { flexDirection: 'row', alignItems: 'center', },
    iconButton: { position: 'relative', padding: 8 },
    notificationCountBubble: { position: 'absolute', top: 3, right: 3, backgroundColor: DANGER_COLOR, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, borderWidth: 1, borderColor: 'white' },
    notificationCountText: { color: 'white', fontSize: 11, fontWeight: 'bold', },
    contentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1 },
    backButtonGlobal: { padding: 5, },
    contentHeaderTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', flex: 1, },
    searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, marginHorizontal: CONTENT_HORIZONTAL_PADDING, marginTop: 15, marginBottom: 10, borderWidth: 1, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.84, elevation: 2, },
    searchIcon: { marginLeft: 15, },
    searchInput: { flex: 1, height: 48, paddingLeft: 10, fontSize: 16 },
    noResultsContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50, paddingHorizontal: 20, },
    noResultsText: { fontSize: 16, textAlign: 'center', },
    contentScrollViewContainer: { paddingHorizontal: CONTENT_HORIZONTAL_PADDING, paddingBottom: 20, flexGrow: 1, },
    dashboardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', },
    dashboardCardWrapper: { width: (windowWidth - (CONTENT_HORIZONTAL_PADDING * 2) - (CARD_GAP * 2)) / 3, marginBottom: CARD_GAP, },
    dashboardCard: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'flex-start', height: 110, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 4, },
    cardIconContainer: { width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 8, },
    cardImage: { width: 38, height: 38, resizeMode: 'contain', },
    cardTitle: { fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 14, paddingHorizontal: 4, marginTop: 'auto', },
    bottomNav: { flexDirection: 'row', borderTopWidth: 1, paddingVertical: Platform.OS === 'ios' ? 10 : 8, paddingBottom: Platform.OS === 'ios' ? 20 : 8, shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 5, minHeight: BOTTOM_NAV_HEIGHT, },
    navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 5, },
    navText: { fontSize: 10, marginTop: 3, },
    fallbackContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    fallbackText: { fontSize: 16, textAlign: 'center', marginBottom: 10, },
    fallbackLink: { fontSize: 16, color: PRIMARY_COLOR, fontWeight: 'bold', },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center' },
    enlargedProfileImage: { width: windowWidth * 0.8, height: windowWidth * 0.8, borderRadius: (windowWidth * 0.8) / 2, borderWidth: 4, borderColor: '#fff' },
    closeModalButton: { position: 'absolute', top: 50, right: 20, padding: 10, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)' },
    placeholderCard: {
      width: (windowWidth - (CONTENT_HORIZONTAL_PADDING * 2) - (CARD_GAP * 2)) / 3,
    },
});

export default OthersDashboard;