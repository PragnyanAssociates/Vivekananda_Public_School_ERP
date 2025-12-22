import React, { useState, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    TextInput, ActivityIndicator, RefreshControl, Alert, StatusBar 
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client'; // Adjust path to your api client

const AdminActionScreen = () => {
    const navigation = useNavigation();
    
    // --- State ---
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('PENDING'); // PENDING | ISSUED | OVERDUE
    const [searchText, setSearchText] = useState('');

    // --- Fetch Data ---
    const fetchData = async () => {
        try {
            const response = await apiClient.get('/api/library/admin/requests');
            setRequests(response.data || []);
        } catch (error) {
            console.error("Fetch Error:", error);
            // Optional: Alert.alert("Error", "Failed to load requests.");
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

    // --- Helper: Get Date Status ---
    const isOverdue = (dateString) => {
        const today = new Date();
        const returnDate = new Date(dateString);
        return returnDate < today;
    };

    // --- Filter Data Logic ---
    const getFilteredData = () => {
        let data = [...requests];

        // 1. Filter by Tab
        if (activeTab === 'PENDING') {
            data = data.filter(item => item.status === 'pending');
        } else if (activeTab === 'ISSUED') {
            // Approved AND Not Overdue
            data = data.filter(item => item.status === 'approved' && !isOverdue(item.expected_return_date));
        } else if (activeTab === 'OVERDUE') {
            // Approved AND Overdue
            data = data.filter(item => item.status === 'approved' && isOverdue(item.expected_return_date));
        }

        // 2. Filter by Search
        if (searchText) {
            const lower = searchText.toLowerCase();
            data = data.filter(item => 
                item.book_title?.toLowerCase().includes(lower) || 
                item.full_name?.toLowerCase().includes(lower) ||
                item.roll_no?.toLowerCase().includes(lower)
            );
        }

        return data;
    };

    // --- Actions ---
    const handleAction = async (id, type) => {
        // type: 'approved', 'rejected', 'returned'
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
                            if (type === 'returned') {
                                endpoint = `/api/library/return/${id}`;
                                await apiClient.put(endpoint);
                            } else {
                                endpoint = `/api/library/admin/request-action/${id}`;
                                await apiClient.put(endpoint, { action: type });
                            }
                            
                            Alert.alert("Success", "Updated successfully");
                            fetchData(); // Refresh list
                        } catch (error) {
                            Alert.alert("Error", error.response?.data?.message || "Action failed");
                            setLoading(false);
                        }
                    } 
                }
            ]
        );
    };

    // --- Render Item ---
    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={{flex: 1}}>
                    <Text style={styles.bookTitle}>{item.book_title || "Unknown Book"}</Text>
                    <Text style={styles.studentDetails}>
                        👤 {item.full_name} ({item.roll_no})
                    </Text>
                    <Text style={styles.classDetails}>Class: {item.class_name}</Text>
                </View>
                <View style={[styles.badge, 
                    { backgroundColor: item.status === 'pending' ? '#FEF3C7' : '#DBEAFE' }
                ]}>
                    <Text style={[styles.badgeText, 
                        { color: item.status === 'pending' ? '#D97706' : '#1E40AF' }
                    ]}>{item.status.toUpperCase()}</Text>
                </View>
            </View>

            <View style={styles.dateRow}>
                <Text style={styles.dateText}>📅 Borrow: {item.borrow_date?.split('T')[0]}</Text>
                <Text style={[styles.dateText, 
                    isOverdue(item.expected_return_date) && item.status === 'approved' && { color: '#EF4444', fontWeight: 'bold' }
                ]}>
                    📅 Return: {item.expected_return_date?.split('T')[0]}
                </Text>
            </View>

            {/* Action Buttons based on Tab */}
            <View style={styles.actionRow}>
                {item.status === 'pending' && (
                    <>
                        <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={() => handleAction(item.id, 'approved')}>
                            <Text style={styles.btnText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={() => handleAction(item.id, 'rejected')}>
                            <Text style={styles.btnText}>Reject</Text>
                        </TouchableOpacity>
                    </>
                )}

                {(item.status === 'approved') && (
                    <TouchableOpacity style={[styles.btn, styles.btnReturn]} onPress={() => handleAction(item.id, 'returned')}>
                        <Text style={styles.btnText}>Mark Returned</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    // --- Render Tabs ---
    const TabButton = ({ title, tabKey, color }) => (
        <TouchableOpacity 
            style={[styles.tab, activeTab === tabKey && { backgroundColor: color + '20', borderColor: color }]}
            onPress={() => setActiveTab(tabKey)}
        >
            <Text style={[styles.tabText, activeTab === tabKey && { color: color, fontWeight: 'bold' }]}>
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
                    <Text style={styles.screenTitle}>Library Requests</Text>
                    <TouchableOpacity 
                        style={styles.historyBtn} 
                        onPress={() => navigation.navigate('LibraryHistoryScreen')}
                    >
                        <Text style={styles.historyBtnText}>📜 History</Text>
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={styles.searchBox}>
                    <TextInput 
                        placeholder="Search Student or Book..." 
                        style={styles.searchInput}
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                </View>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TabButton title="Pending" tabKey="PENDING" color="#F59E0B" />
                    <TabButton title="Issued" tabKey="ISSUED" color="#3B82F6" />
                    <TabButton title="Overdue" tabKey="OVERDUE" color="#EF4444" />
                </View>
            </View>

            {/* List */}
            <FlatList
                data={getFilteredData()}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No {activeTab.toLowerCase()} requests found.</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    headerContainer: { backgroundColor: '#FFF', padding: 16, paddingBottom: 0, elevation: 4 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    screenTitle: { fontSize: 24, fontWeight: 'bold', color: '#1E293B' },
    historyBtn: { backgroundColor: '#334155', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
    historyBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
    
    searchBox: { backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 12, marginBottom: 12 },
    searchInput: { height: 40, color: '#334155' },

    tabContainer: { flexDirection: 'row', justifyContent: 'space-between' },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 3, borderColor: 'transparent' },
    tabText: { color: '#64748B', fontSize: 14, fontWeight: '600' },

    listContent: { padding: 16 },
    card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    bookTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 4 },
    studentDetails: { fontSize: 13, color: '#475569', fontWeight: '500' },
    classDetails: { fontSize: 12, color: '#94A3B8' },
    
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, height: 24, justifyContent: 'center' },
    badgeText: { fontSize: 10, fontWeight: 'bold' },

    dateRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 6, marginVertical: 10 },
    dateText: { fontSize: 12, color: '#334155' },

    actionRow: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    btnApprove: { backgroundColor: '#10B981' },
    btnReject: { backgroundColor: '#EF4444' },
    btnReturn: { backgroundColor: '#3B82F6' },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: '#94A3B8', fontSize: 16 }
});

export default AdminActionScreen;