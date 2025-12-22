import React, { useState, useCallback } from 'react';
import { 
    View, Text, FlatList, StyleSheet, TouchableOpacity, 
    Alert, ActivityIndicator, RefreshControl, TextInput, StatusBar 
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client'; // Adjust your path

const AdminActionScreen = () => {
    const navigation = useNavigation();
    
    // State Management
    const [requests, setRequests] = useState([]);
    const [stats, setStats] = useState({ issued: 0, overdue: 0, pending: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Filters
    const [activeFilter, setActiveFilter] = useState('PENDING'); 
    const [searchText, setSearchText] = useState('');

    // --- 1. Fetch Data (Runs every time screen is focused) ---
    const fetchData = async () => {
        try {
            // Fetch both Requests and Statistics in parallel
            const [reqRes, statRes] = await Promise.all([
                apiClient.get('/api/library/admin/requests'), // Get transactions
                apiClient.get('/api/library/stats')           // Get counts
            ]);
            
            setRequests(reqRes.data || []);
            setStats(statRes.data || { issued: 0, overdue: 0, pending: 0 });
        } catch (e) { 
            console.error("Error fetching data:", e);
            Alert.alert("Error", "Could not load library data.");
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

    // --- 2. Filter Logic (Pending vs Issued vs Overdue) ---
    const getProcessedData = () => {
        let data = [...requests];

        // Filter by Status Tab
        if (activeFilter === 'PENDING') {
            data = data.filter(item => item.status === 'pending');
        } else if (activeFilter === 'OVERDUE') {
            // Status is approved BUT date is passed
            data = data.filter(item => item.status === 'approved' && item.is_overdue === 1);
        } else if (activeFilter === 'ISSUED') {
            // Status is approved AND date is NOT passed
            data = data.filter(item => item.status === 'approved' && item.is_overdue === 0);
        }

        // Filter by Search Text (Student Name or Book Title)
        if (searchText) {
            const lower = searchText.toLowerCase();
            data = data.filter(item => 
                (item.book_title?.toLowerCase().includes(lower)) ||
                (item.full_name?.toLowerCase().includes(lower)) ||
                (item.roll_no?.toLowerCase().includes(lower))
            );
        }
        return data;
    };

    // --- 3. Handle Actions (Approve, Reject, Return) ---
    const handleAction = async (id, action) => {
        setLoading(true);
        try {
            let endpoint = '';
            let body = {};

            if (action === 'returned') {
                // Return Book Logic
                endpoint = `/library/return/${id}`;
            } else {
                // Approve/Reject Logic
                endpoint = `/library/admin/request-action/${id}`;
                body = { action }; // 'approved' or 'rejected'
            }
            
            await apiClient.put(endpoint, body);
            
            Alert.alert(
                "Success", 
                action === 'returned' ? "Book marked as returned & moved to history." : `Request ${action}.`
            );
            
            fetchData(); // Refresh list immediately
        } catch (e) { 
            console.error(e);
            Alert.alert("Action Failed", e.response?.data?.message || "Something went wrong.");
            setLoading(false);
        }
    };

    // --- 4. Sub-Components ---
    
    // The clickable Stat Boxes (Tabs)
    const StatCard = ({ label, count, type }) => {
        const isActive = activeFilter === type;
        
        // Dynamic Colors based on type
        let activeColor = '#2563EB'; // Blue (Issued)
        if (type === 'PENDING') activeColor = '#F59E0B'; // Orange
        if (type === 'OVERDUE') activeColor = '#EF4444'; // Red

        return (
            <TouchableOpacity 
                style={[
                    styles.statCard, 
                    isActive && { backgroundColor: activeColor + '15', borderColor: activeColor } // Add tint when active
                ]} 
                onPress={() => setActiveFilter(type)}
            >
                <Text style={[styles.statNum, { color: isActive ? activeColor : '#64748B' }]}>
                    {count}
                </Text>
                <Text style={[styles.statLabel, { color: isActive ? activeColor : '#64748B' }]}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    // The individual Transaction Card
    const renderItem = ({ item }) => {
        const isOverdue = item.is_overdue === 1;

        return (
            <View style={styles.card}>
                {/* Card Header: Book & Student */}
                <View style={styles.cardHeader}>
                    <View style={{flex:1}}>
                        <Text style={styles.bookTitle}>{item.book_title}</Text>
                        <Text style={styles.studentInfo}>
                            👤 {item.full_name} ({item.roll_no})
                        </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: item.status === 'pending' ? '#FEF3C7' : '#DBEAFE' }]}>
                        <Text style={[styles.badgeTxt, { color: item.status === 'pending' ? '#D97706' : '#1E40AF' }]}>
                            {item.status.toUpperCase()}
                        </Text>
                    </View>
                </View>
                
                {/* Dates Section */}
                <View style={styles.datesContainer}>
                    <View style={styles.dateBox}>
                        <Text style={styles.dateLabel}>Borrowed</Text>
                        <Text style={styles.dateValue}>
                            {item.borrow_date ? item.borrow_date.split('T')[0] : '-'}
                        </Text>
                    </View>
                    <View style={styles.dateBox}>
                        <Text style={[styles.dateLabel, isOverdue && {color:'#EF4444'}]}>Due Date</Text>
                        <Text style={[styles.dateValue, isOverdue && {color:'#EF4444', fontWeight:'bold'}]}>
                            {item.expected_return_date ? item.expected_return_date.split('T')[0] : '-'}
                        </Text>
                    </View>
                </View>

                {/* Actions Section */}
                <View style={styles.actionRow}>
                    {item.status === 'pending' && (
                        <>
                            <TouchableOpacity 
                                style={[styles.btn, styles.btnApprove]} 
                                onPress={()=>handleAction(item.id, 'approved')}
                            >
                                <Text style={styles.btnTxt}>✅ Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.btn, styles.btnReject]} 
                                onPress={()=>handleAction(item.id, 'rejected')}
                            >
                                <Text style={styles.btnTxt}>❌ Reject</Text>
                            </TouchableOpacity>
                        </>
                    )}
                    
                    {item.status === 'approved' && (
                        <TouchableOpacity 
                            style={[styles.btn, styles.btnReturn]} 
                            onPress={()=>handleAction(item.id, 'returned')}
                        >
                            <Text style={styles.btnTxt}>📖 Mark Returned</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#FFF" barStyle="dark-content" />
            
            {/* --- HEADER SECTION --- */}
            <View style={styles.header}>
                <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 15}}>
                    <Text style={styles.headTitle}>Library Hub</Text>
                    
                    {/* Link to History Screen */}
                    <TouchableOpacity 
                        style={styles.historyBtn}
                        onPress={() => navigation.navigate('LibraryHistoryScreen')}
                    >
                        <Text style={styles.historyBtnTxt}>📜 History</Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchBox}>
                    <Text style={{marginRight: 8}}>🔍</Text>
                    <TextInput 
                        style={styles.input} 
                        placeholder="Search Student, ID, or Book..." 
                        value={searchText} 
                        onChangeText={setSearchText}
                    />
                </View>

                {/* Filter Tabs */}
                <View style={styles.statsRow}>
                    <StatCard label="Pending" count={stats.pending} type="PENDING" />
                    <StatCard label="Issued" count={stats.issued} type="ISSUED" />
                    <StatCard label="Overdue" count={stats.overdue} type="OVERDUE" />
                </View>
            </View>

            {/* --- LIST SECTION --- */}
            <FlatList 
                data={getProcessedData()} 
                renderItem={renderItem} 
                keyExtractor={i => i.id.toString()}
                contentContainerStyle={{padding:16}}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true); fetchData();}} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No {activeFilter.toLowerCase()} requests found.</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    
    // Header Styles
    header: { padding: 20, backgroundColor: '#FFF', elevation: 3, shadowColor:'#000', shadowOpacity:0.05, paddingBottom: 15 },
    headTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B' },
    historyBtn: { backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    historyBtnTxt: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
    
    searchBox: { flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 12, borderRadius: 10, marginBottom: 15, alignItems:'center' },
    input: { flex:1, fontSize: 14, color: '#334155', padding: 0 },
    
    statsRow: { flexDirection: 'row', gap: 10 },
    statCard: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFF' },
    statNum: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
    statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },

    // Card Styles
    card: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 1, borderColor: '#E2E8F0', borderWidth: 1 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    bookTitle: { fontWeight: 'bold', fontSize: 16, color: '#1E293B', marginBottom: 4 },
    studentInfo: { color: '#64748B', fontSize: 13, fontWeight: '500' },
    
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', height: 24, justifyContent:'center' },
    badgeTxt: { fontSize: 10, fontWeight: 'bold' },

    // Dates
    datesContainer: { flexDirection: 'row', marginBottom: 16, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10 },
    dateBox: { flex: 1 },
    dateLabel: { fontSize: 11, color: '#94A3B8', marginBottom: 2 },
    dateValue: { fontSize: 13, color: '#334155', fontWeight: '600' },

    // Action Buttons
    actionRow: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    btnApprove: { backgroundColor: '#10B981' }, // Green
    btnReject: { backgroundColor: '#EF4444' },  // Red
    btnReturn: { backgroundColor: '#3B82F6' },  // Blue
    btnTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },

    // Empty State
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: '#94A3B8', fontSize: 16 }
});

export default AdminActionScreen;