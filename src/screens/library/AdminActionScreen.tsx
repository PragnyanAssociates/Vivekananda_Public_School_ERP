/**
 * File: src/screens/library/AdminActionScreen.js
 * Purpose: Admin interface to manage library book requests.
 * Updated: Added Phone Number display, Responsive Design, Role Handling.
 */
import React, { useState, useCallback, useLayoutEffect } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    TextInput, RefreshControl, Alert, StatusBar, ActivityIndicator, 
    SafeAreaView, useColorScheme, Platform 
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client'; 
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    success: '#43A047',
    danger: '#E53935',
    blue: '#1E88E5',
    warning: '#F59E0B',
    iconBg: '#E0F2F1',
    inputBg: '#FFFFFF',
    tabBg: '#FFFFFF',
    tabActiveBg: '#E0F2F1',
    dateRowBg: '#F8FAFC',
    dateRowBorder: '#f0f0f0',
    badgePendingBg: '#FEF3C7',
    badgeIssuedBg: '#DBEAFE',
    white: '#ffffff'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212', 
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    success: '#4CAF50',
    danger: '#EF5350',
    blue: '#42A5F5',
    warning: '#FFB300',
    iconBg: '#333333',
    inputBg: '#2C2C2C',
    tabBg: '#2C2C2C',
    tabActiveBg: '#004D40',
    dateRowBg: '#252525',
    dateRowBorder: '#333333',
    badgePendingBg: '#42381A',
    badgeIssuedBg: '#1A365D',
    white: '#ffffff'
};

const AdminActionScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const navigation = useNavigation();
    
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('PENDING'); 
    const [searchText, setSearchText] = useState('');

    const fetchData = async () => {
        try {
            const response = await apiClient.get('/library/admin/requests');
            setRequests(response.data || []);
        } catch (error) {
            console.error("Fetch Error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const d = new Date(dateString);
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    };

    const isOverdue = (dateString) => {
        if (!dateString) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        const returnDate = new Date(dateString);
        return returnDate < today;
    };

    const getFilteredData = () => {
        let data = [...requests];

        if (activeTab === 'PENDING') {
            data = data.filter(item => item.status === 'pending');
        } else if (activeTab === 'ISSUED') {
            data = data.filter(item => item.status === 'approved' && !isOverdue(item.expected_return_date));
        } else if (activeTab === 'OVERDUE') {
            data = data.filter(item => item.status === 'approved' && isOverdue(item.expected_return_date));
        }

        if (searchText) {
            const lower = searchText.toLowerCase();
            data = data.filter(item => 
                (item.book_title && item.book_title.toLowerCase().includes(lower)) || 
                (item.full_name && item.full_name.toLowerCase().includes(lower)) ||
                (item.roll_no && item.roll_no.toLowerCase().includes(lower)) ||
                (item.mobile && item.mobile.includes(lower))
            );
        }
        return data;
    };

    const handleAction = async (id, type) => {
        Alert.alert(
            "Confirm Action",
            `Are you sure you want to mark this as ${type}?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Confirm", 
                    onPress: async () => {
                        setLoading(true);
                        try {
                            let endpoint = '';
                            let body = {};
                            if (type === 'returned') {
                                endpoint = `/library/return/${id}`;
                            } else {
                                endpoint = `/library/admin/request-action/${id}`;
                                body = { action: type };
                            }
                            await apiClient.put(endpoint, body);
                            Alert.alert("Success", "Updated successfully");
                            fetchData(); 
                        } catch (error) {
                            Alert.alert("Error", error.response?.data?.message || "Action failed");
                            setLoading(false);
                        }
                    } 
                }
            ]
        );
    };

    const renderItem = ({ item, index }) => {
        const overdue = isOverdue(item.expected_return_date);
        const isStudent = item.user_role === 'student';

        return (
            <Animatable.View animation="fadeInUp" duration={500} delay={index * 50}>
                <View style={[styles.card, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                    <View style={styles.cardHeader}>
                        <View style={{flex: 1, paddingRight: 10}}>
                            {/* Book Title */}
                            <Text style={[styles.bookTitle, { color: theme.textMain }]} numberOfLines={2}>
                                {item.book_title || "Unknown Book"}
                            </Text>
                            
                            {/* Name & Role */}
                            <Text style={[styles.studentDetails, { color: theme.textSub }]}>
                                {item.full_name} 
                                <Text style={{fontWeight: 'normal', fontStyle: 'italic', fontSize: 12}}> ({item.user_role || 'user'})</Text>
                            </Text>
                            
                            {/* ID & Class */}
                            <Text style={[styles.classDetails, { color: theme.textSub }]}>
                                {isStudent ? `ID: ${item.roll_no} | Class: ${item.class_name}` : `User ID: ${item.roll_no}`}
                            </Text>

                            {/* --- ADDED PHONE NUMBER HERE --- */}
                            <Text style={[styles.classDetails, { color: theme.textSub, marginTop: 4 }]}>
                                <MaterialIcons name="phone" size={12} /> {item.mobile}
                            </Text>
                        </View>

                        <View style={[styles.badge, { backgroundColor: item.status === 'pending' ? theme.badgePendingBg : theme.badgeIssuedBg }]}>
                            <Text style={[styles.badgeText, { color: item.status === 'pending' ? theme.warning : theme.blue }]}>
                                {item.status.toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.dateRow, { backgroundColor: theme.dateRowBg, borderColor: theme.dateRowBorder }]}>
                        <View style={styles.dateItem}>
                            <MaterialIcons name="event" size={14} color={theme.textSub} />
                            <Text style={[styles.dateText, { color: theme.textMain }]}> Borrow: {formatDate(item.borrow_date)}</Text>
                        </View>
                        <View style={styles.dateItem}>
                            <MaterialIcons name="event-available" size={14} color={overdue && item.status === 'approved' ? theme.danger : theme.textSub} />
                            <Text style={[
                                styles.dateText, 
                                { color: theme.textMain },
                                overdue && item.status === 'approved' && { color: theme.danger, fontWeight: 'bold' }
                            ]}>
                                Return: {formatDate(item.expected_return_date)}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.actionRow}>
                        {item.status === 'pending' && (
                            <>
                                <TouchableOpacity style={[styles.btn, { backgroundColor: theme.success }]} onPress={() => handleAction(item.id, 'approved')}>
                                    <Text style={[styles.btnText, { color: theme.white }]}>Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, { backgroundColor: theme.danger }]} onPress={() => handleAction(item.id, 'rejected')}>
                                    <Text style={[styles.btnText, { color: theme.white }]}>Reject</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {(item.status === 'approved') && (
                            <TouchableOpacity style={[styles.btn, { backgroundColor: theme.blue }]} onPress={() => handleAction(item.id, 'returned')}>
                                <Text style={[styles.btnText, { color: theme.white }]}>Mark Returned</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Animatable.View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar backgroundColor={theme.background} barStyle={isDark ? "light-content" : "dark-content"} />
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={theme.textMain} />
                    </TouchableOpacity>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialIcons name="pending-actions" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Action Center</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Library Requests</Text>
                    </View>
                </View>
                
                <TouchableOpacity style={[styles.headerBtn, { backgroundColor: theme.primary }]} onPress={() => navigation.navigate('LibraryHistoryScreen')}>
                    <MaterialIcons name="history" size={20} color={theme.white} />
                </TouchableOpacity>
            </View>

            {/* --- SEARCH & TABS --- */}
            <View style={styles.filterContainer}>
                <View style={[styles.searchBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                    <MaterialIcons name="search" size={20} color={theme.textSub} style={styles.searchIcon} />
                    <TextInput 
                        placeholder="Search Student, ID, or Book..." 
                        style={[styles.searchInput, { color: theme.textMain }]}
                        value={searchText}
                        onChangeText={setSearchText}
                        placeholderTextColor={theme.textSub}
                    />
                </View>

                <View style={[styles.tabContainer, { backgroundColor: theme.tabBg, borderColor: theme.border }]}>
                    {['PENDING', 'ISSUED', 'OVERDUE'].map(tab => (
                        <TouchableOpacity 
                            key={tab}
                            style={[styles.tab, activeTab === tab && { backgroundColor: theme.tabActiveBg }]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Text style={[styles.tabText, { color: theme.textSub }, activeTab === tab && { color: theme.primary, fontWeight: 'bold' }]}>
                                {tab.charAt(0) + tab.slice(1).toLowerCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
            ) : (
                <FlatList
                    data={getFilteredData()}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[theme.primary]} tintColor={theme.primary}/>}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="playlist-check" size={50} color={theme.border} />
                            <Text style={[styles.emptyText, { color: theme.textSub }]}>No {activeTab.toLowerCase()} requests found.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loader: { marginTop: 40 },
    headerCard: {
        paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10, borderRadius: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    backButton: { marginRight: 10, padding: 4 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },
    headerBtn: { padding: 8, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    filterContainer: { paddingHorizontal: 15, marginBottom: 10 },
    searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 10, borderWidth: 1, height: 45, marginBottom: 15 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, height: 45, fontSize: 15 },
    tabContainer: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 8, padding: 4, borderWidth: 1 },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 6 },
    tabText: { fontSize: 13, fontWeight: '600' },
    listContent: { paddingHorizontal: 15, paddingBottom: 20 },
    card: { borderRadius: 12, padding: 15, marginBottom: 12, elevation: 2, shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    bookTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
    studentDetails: { fontSize: 13, fontWeight: '600' },
    classDetails: { fontSize: 12, marginTop: 2 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, height: 24, justifyContent: 'center' },
    badgeText: { fontSize: 10, fontWeight: 'bold' },
    dateRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderRadius: 8, marginVertical: 10, borderWidth: 1 },
    dateItem: { flexDirection: 'row', alignItems: 'center' },
    dateText: { fontSize: 12, fontWeight: '500', marginLeft: 4 },
    actionRow: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontWeight: 'bold', fontSize: 13 },
    emptyContainer: { alignItems: 'center', marginTop: 60 },
    emptyText: { fontSize: 16, marginTop: 10 }
});

export default AdminActionScreen;