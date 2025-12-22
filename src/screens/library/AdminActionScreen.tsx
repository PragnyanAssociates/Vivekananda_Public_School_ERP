import React, { useState, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    TextInput, RefreshControl, Alert, StatusBar, ActivityIndicator 
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client'; 

const AdminActionScreen = () => {
    const navigation = useNavigation();
    
    // --- State ---
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Default Tab: PENDING (This ensures you see new requests first)
    const [activeTab, setActiveTab] = useState('PENDING'); 
    const [searchText, setSearchText] = useState('');

    // --- Fetch Data ---
    const fetchData = async () => {
        try {
            // FIXED URL: Removed the extra '/api' prefix to match your other screens
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

    // --- Date Helper ---
    // Safely format dates to prevent crashes
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return dateString.split('T')[0];
    };

    const isOverdue = (dateString) => {
        if (!dateString) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize today to midnight
        
        const returnDate = new Date(dateString);
        return returnDate < today;
    };

    // --- Filter Logic ---
    const getFilteredData = () => {
        let data = [...requests];

        // 1. Filter by Tab
        if (activeTab === 'PENDING') {
            data = data.filter(item => item.status === 'pending');
        } else if (activeTab === 'ISSUED') {
            // Show Approved items that are NOT overdue
            data = data.filter(item => item.status === 'approved' && !isOverdue(item.expected_return_date));
        } else if (activeTab === 'OVERDUE') {
            // Show Approved items that ARE overdue
            data = data.filter(item => item.status === 'approved' && isOverdue(item.expected_return_date));
        }

        // 2. Filter by Search
        if (searchText) {
            const lower = searchText.toLowerCase();
            data = data.filter(item => 
                (item.book_title && item.book_title.toLowerCase().includes(lower)) || 
                (item.full_name && item.full_name.toLowerCase().includes(lower)) ||
                (item.roll_no && item.roll_no.toLowerCase().includes(lower))
            );
        }

        return data;
    };

    // --- Handle Actions (Approve, Reject, Return) ---
    const handleAction = async (id, type) => {
        // type: 'approved', 'rejected', 'returned'
        
        // Show confirmation alert
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
                                // FIXED URL: Removed '/api' prefix
                                endpoint = `/library/return/${id}`;
                            } else {
                                // FIXED URL: Removed '/api' prefix
                                endpoint = `/library/admin/request-action/${id}`;
                                body = { action: type };
                            }
                            
                            // Make the API call
                            await apiClient.put(endpoint, body);
                            
                            Alert.alert("Success", "Updated successfully");
                            fetchData(); // Refresh the list
                        } catch (error) {
                            console.error(error);
                            Alert.alert("Error", error.response?.data?.message || "Action failed");
                            setLoading(false);
                        }
                    } 
                }
            ]
        );
    };

    // --- Render Card Item ---
    const renderItem = ({ item }) => {
        const overdue = isOverdue(item.expected_return_date);

        return (
            <View style={styles.card}>
                {/* Header: Book Title & Status Badge */}
                <View style={styles.cardHeader}>
                    <View style={{flex: 1, paddingRight: 10}}>
                        <Text style={styles.bookTitle} numberOfLines={2}>
                            {item.book_title || "Unknown Book"}
                        </Text>
                        <Text style={styles.studentDetails}>
                            👤 {item.full_name} ({item.roll_no})
                        </Text>
                        <Text style={styles.classDetails}>Class: {item.class_name || 'N/A'}</Text>
                    </View>

                    {/* Status Badge */}
                    <View style={[styles.badge, 
                        { backgroundColor: item.status === 'pending' ? '#FEF3C7' : '#DBEAFE' }
                    ]}>
                        <Text style={[styles.badgeText, 
                            { color: item.status === 'pending' ? '#D97706' : '#1E40AF' }
                        ]}>{item.status.toUpperCase()}</Text>
                    </View>
                </View>

                {/* Dates Section */}
                <View style={styles.dateRow}>
                    <Text style={styles.dateText}>
                        📅 Borrow: {formatDate(item.borrow_date)}
                    </Text>
                    <Text style={[styles.dateText, 
                        overdue && item.status === 'approved' && { color: '#EF4444', fontWeight: 'bold' }
                    ]}>
                        📅 Return: {formatDate(item.expected_return_date)}
                    </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                    {/* Show Approve/Reject ONLY for Pending items */}
                    {item.status === 'pending' && (
                        <>
                            <TouchableOpacity 
                                style={[styles.btn, styles.btnApprove]} 
                                onPress={() => handleAction(item.id, 'approved')}
                            >
                                <Text style={styles.btnText}>Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.btn, styles.btnReject]} 
                                onPress={() => handleAction(item.id, 'rejected')}
                            >
                                <Text style={styles.btnText}>Reject</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {/* Show Return Button for Issued/Overdue items */}
                    {(item.status === 'approved') && (
                        <TouchableOpacity 
                            style={[styles.btn, styles.btnReturn]} 
                            onPress={() => handleAction(item.id, 'returned')}
                        >
                            <Text style={styles.btnText}>Mark Returned</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    // --- Render Tab Component ---
    const TabButton = ({ title, tabKey, color }) => (
        <TouchableOpacity 
            style={[
                styles.tab, 
                activeTab === tabKey && { backgroundColor: color + '20', borderColor: color }
            ]}
            onPress={() => setActiveTab(tabKey)}
        >
            <Text style={[
                styles.tabText, 
                activeTab === tabKey && { color: color, fontWeight: 'bold' }
            ]}>
                {title}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#F8FAFC" barStyle="dark-content" />
            
            {/* Header Area */}
            <View style={styles.headerContainer}>
                <View style={styles.topRow}>
                    <Text style={styles.screenTitle}>Action Center</Text>
                    <TouchableOpacity 
                        style={styles.historyBtn} 
                        onPress={() => navigation.navigate('LibraryHistoryScreen')}
                    >
                        <Text style={styles.historyBtnText}>📜 History</Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchBox}>
                    <TextInput 
                        placeholder="Search Student, ID, or Book..." 
                        style={styles.searchInput}
                        value={searchText}
                        onChangeText={setSearchText}
                        placeholderTextColor="#94A3B8"
                    />
                </View>

                {/* Filter Tabs */}
                <View style={styles.tabContainer}>
                    <TabButton title="Pending" tabKey="PENDING" color="#F59E0B" />
                    <TabButton title="Issued" tabKey="ISSUED" color="#3B82F6" />
                    <TabButton title="Overdue" tabKey="OVERDUE" color="#EF4444" />
                </View>
            </View>

            {/* List */}
            {loading ? (
                <ActivityIndicator size="large" color="#2563EB" style={{marginTop: 40}} />
            ) : (
                <FlatList
                    data={getFilteredData()}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No {activeTab.toLowerCase()} requests found.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    
    // Header
    headerContainer: { backgroundColor: '#FFF', padding: 16, paddingBottom: 0, elevation: 4, borderBottomLeftRadius: 15, borderBottomRightRadius: 15 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    screenTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B' },
    historyBtn: { backgroundColor: '#334155', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
    historyBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
    
    // Search
    searchBox: { backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 12, marginBottom: 12 },
    searchInput: { height: 40, color: '#334155', fontSize: 14 },

    // Tabs
    tabContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 10 },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, marginHorizontal: 4, borderBottomWidth: 3, borderColor: 'transparent' },
    tabText: { color: '#64748B', fontSize: 13, fontWeight: '600' },

    // List & Cards
    listContent: { padding: 16 },
    card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    bookTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 4 },
    studentDetails: { fontSize: 13, color: '#475569', fontWeight: '500' },
    classDetails: { fontSize: 12, color: '#94A3B8' },
    
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, height: 24, justifyContent: 'center' },
    badgeText: { fontSize: 10, fontWeight: 'bold' },

    dateRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 6, marginVertical: 10 },
    dateText: { fontSize: 12, color: '#334155', fontWeight: '500' },

    // Buttons
    actionRow: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    btnApprove: { backgroundColor: '#10B981' },
    btnReject: { backgroundColor: '#EF4444' },
    btnReturn: { backgroundColor: '#3B82F6' },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

    // Empty State
    emptyContainer: { alignItems: 'center', marginTop: 60 },
    emptyText: { color: '#94A3B8', fontSize: 16 }
});

export default AdminActionScreen;