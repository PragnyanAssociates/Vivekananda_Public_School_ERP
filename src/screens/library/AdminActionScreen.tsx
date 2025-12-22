import React, { useState, useCallback } from 'react';
import { 
    View, Text, FlatList, StyleSheet, TouchableOpacity, 
    Alert, ActivityIndicator, RefreshControl, TextInput, StatusBar, Image 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../../api/client'; 

const AdminActionScreen = () => {
    const [requests, setRequests] = useState([]);
    const [stats, setStats] = useState({ issued: 0, overdue: 0, pending: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Filters
    const [searchText, setSearchText] = useState('');
    const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL', 'ISSUED', 'OVERDUE', 'PENDING'

    // --- 1. FETCH DATA ---
    const fetchData = async () => {
        try {
            const [reqRes, statRes] = await Promise.all([
                apiClient.get('/library/admin/requests'),
                apiClient.get('/api/library/stats')
            ]);
            setRequests(reqRes.data || []);
            setStats(statRes.data || { issued: 0, overdue: 0, pending: 0 });
        } catch (e) { 
            console.log("Error fetching data:", e);
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

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // --- 2. LOGIC: FILTER & SORT ---
    const getProcessedData = () => {
        if (!requests) return [];
        
        let data = [...requests];

        // A. Filter by Status Card
        if (activeFilter !== 'ALL') {
            if (activeFilter === 'PENDING') {
                data = data.filter(item => item.status === 'pending');
            } else if (activeFilter === 'ISSUED') {
                data = data.filter(item => item.status === 'approved');
            } else if (activeFilter === 'OVERDUE') {
                const today = new Date();
                today.setHours(0,0,0,0);
                data = data.filter(item => {
                    const returnDate = new Date(item.expected_return_date);
                    return item.status === 'approved' && returnDate < today;
                });
            }
        }

        // B. Search Text
        if (searchText) {
            const lower = searchText.toLowerCase();
            data = data.filter(item => 
                (item.book_title && item.book_title.toLowerCase().includes(lower)) ||
                (item.full_name && item.full_name.toLowerCase().includes(lower)) ||
                (item.roll_no && item.roll_no.toLowerCase().includes(lower))
            );
        }

        // C. Sort (Overdue/Pending first)
        data.sort((a, b) => {
            // Priority: Pending > Overdue > Others
            // This sort ensures action items are at the top
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            
            const dateA = new Date(a.expected_return_date);
            const dateB = new Date(b.expected_return_date);
            return dateA - dateB; 
        });

        return data;
    };

    // --- 3. ACTIONS ---
    const handleAction = async (id, action) => {
        try {
            if (action === 'returned') {
                await apiClient.put(`/library/return/${id}`);
                Alert.alert("Success", "Book returned.");
            } else {
                await apiClient.put(`/library/admin/request-action/${id}`, { action });
                Alert.alert("Success", `Request ${action}.`);
            }
            fetchData(); 
        } catch (e) { 
            Alert.alert("Error", "Action failed."); 
        }
    };

    // --- 4. RENDER HELPERS ---
    const StatCard = ({ label, count, type, isActive }) => (
        <TouchableOpacity 
            style={[styles.statCard, isActive && styles.activeCard]} 
            onPress={() => setActiveFilter(isActive ? 'ALL' : type)}
            activeOpacity={0.7}
        >
            <Text style={[styles.statNum, type === 'OVERDUE' && { color: '#EF4444' }]}>
                {count}
            </Text>
            <Text style={[styles.statLabel, isActive && { color: '#2563EB', fontWeight:'bold' }]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return dateString;
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    };

    const isOverdue = (dateStr) => {
        const d = new Date(dateStr);
        const today = new Date();
        today.setHours(0,0,0,0);
        return d < today;
    };

    const renderItem = ({ item }) => {
        const itemIsOverdue = item.status === 'approved' && isOverdue(item.expected_return_date);
        
        return (
            <View style={[styles.card, itemIsOverdue && styles.overdueBorder]}>
                <View style={styles.cardTop}>
                    <View style={{flex:1, marginRight: 10}}>
                        <Text style={styles.bookTitle} numberOfLines={1}>{item.book_title}</Text>
                        <Text style={styles.subText}>{item.full_name} ({item.class_name || 'N/A'})</Text>
                    </View>
                    <View style={[styles.badge, 
                        item.status === 'pending' ? styles.bgOrange : 
                        item.status === 'approved' ? styles.bgGreen : styles.bgBlue
                    ]}>
                        <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
                    </View>
                </View>

                <View style={styles.infoGrid}>
                     <Text style={styles.infoText}>📖 {item.book_no}</Text>
                     <Text style={styles.infoText}>🆔 {item.roll_no || '-'}</Text>
                </View>

                <View style={styles.dateRow}>
                    <View style={styles.dateBox}>
                        <Text style={styles.dateLabel}>Borrowed</Text>
                        <Text style={styles.dateValue}>{formatDate(item.borrow_date)}</Text>
                    </View>
                    <View style={styles.vertLine} />
                    <View style={styles.dateBox}>
                        <Text style={[styles.dateLabel, itemIsOverdue && {color:'#DC2626'}]}>
                            {item.status === 'returned' ? 'Returned On' : 'Return Due'}
                        </Text>
                        <Text style={[styles.dateValue, itemIsOverdue && {color:'#DC2626'}]}>
                            {item.status === 'returned' ? formatDate(item.actual_return_date) : formatDate(item.expected_return_date)}
                        </Text>
                    </View>
                </View>

                {/* Buttons */}
                {item.status === 'pending' && (
                    <View style={styles.btnRow}>
                        <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={()=>handleAction(item.id, 'approved')}>
                            <Text style={styles.btnTxt}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={()=>handleAction(item.id, 'rejected')}>
                            <Text style={styles.btnTxt}>Reject</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {item.status === 'approved' && (
                    <TouchableOpacity style={[styles.btn, styles.btnReturn]} onPress={()=>handleAction(item.id, 'returned')}>
                        <Text style={styles.btnTxt}>Mark as Returned</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#F1F5F9" barStyle="dark-content" />
            
            {/* Header Section */}
            <View style={styles.headerContainer}>
                <Text style={styles.screenTitle}>Library Hub</Text>
                
                {/* Search */}
                <View style={styles.searchBar}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput 
                        style={styles.input}
                        placeholder="Search Student, Book..."
                        placeholderTextColor="#94A3B8"
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={()=>setSearchText('')} style={styles.clearBtn}>
                            <Text style={{color:'#64748B', fontWeight:'bold'}}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Stats */}
                <View style={styles.statsRow}>
                    <StatCard label="Issued" count={stats.issued} type="ISSUED" isActive={activeFilter === 'ISSUED'} />
                    <StatCard label="Overdue" count={stats.overdue} type="OVERDUE" isActive={activeFilter === 'OVERDUE'} />
                    <StatCard label="Pending" count={stats.pending} type="PENDING" isActive={activeFilter === 'PENDING'} />
                </View>

                {activeFilter !== 'ALL' && (
                    <View style={styles.filterTag}>
                        <Text style={styles.filterTagText}>Filter: {activeFilter}</Text>
                        <TouchableOpacity onPress={() => setActiveFilter('ALL')}>
                            <Text style={styles.clearFilterText}>Clear</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* List Section */}
            {loading ? (
                <ActivityIndicator size="large" color="#2563EB" style={{marginTop: 50}} />
            ) : (
                <FlatList
                    data={getProcessedData()}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyEmoji}>📭</Text>
                            <Text style={styles.emptyTitle}>No records found</Text>
                            <Text style={styles.emptySub}>
                                {searchText ? "Try adjusting your search terms" : "There are no requests in this category"}
                            </Text>
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
    headerContainer: { backgroundColor: '#FFF', padding: 20, paddingBottom: 15, elevation: 3, zIndex: 10 },
    screenTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginBottom: 15 },
    
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 12, height: 46, marginBottom: 15 },
    searchIcon: { fontSize: 16, color: '#64748B' },
    input: { flex: 1, marginLeft: 10, fontSize: 15, color: '#334155', height: '100%' },
    clearBtn: { padding: 5 },

    // Stats
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    statCard: { flex: 1, backgroundColor: '#F8FAFC', paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    activeCard: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
    statNum: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 2 },
    statLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
    
    filterTag: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, backgroundColor: '#F1F5F9', padding: 8, borderRadius: 8 },
    filterTagText: { fontSize: 12, fontWeight: 'bold', color: '#334155' },
    clearFilterText: { fontSize: 12, color: '#2563EB', fontWeight: 'bold' },

    // List
    listContent: { padding: 16, paddingBottom: 50 },
    card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05 },
    overdueBorder: { borderWidth: 1, borderColor: '#FECACA' },

    cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    bookTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
    subText: { fontSize: 13, color: '#64748B', marginTop: 2 },

    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, height: 26, justifyContent: 'center' },
    bgOrange: { backgroundColor: '#FFF7ED' },
    bgGreen: { backgroundColor: '#ECFDF5' },
    bgBlue: { backgroundColor: '#EFF6FF' },
    badgeText: { fontSize: 11, fontWeight: '800', color: '#334155' },

    infoGrid: { flexDirection: 'row', marginBottom: 12, gap: 15 },
    infoText: { fontSize: 12, color: '#64748B', fontWeight: '500' },

    dateRow: { flexDirection: 'row', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10 },
    dateBox: { flex: 1, alignItems: 'center' },
    vertLine: { width: 1, backgroundColor: '#E2E8F0' },
    dateLabel: { fontSize: 11, color: '#94A3B8', marginBottom: 4, fontWeight: '600', textTransform: 'uppercase' },
    dateValue: { fontSize: 14, fontWeight: '700', color: '#334155' },

    btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
    btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    btnApprove: { backgroundColor: '#10B981' },
    btnReject: { backgroundColor: '#EF4444' },
    btnReturn: { backgroundColor: '#3B82F6', marginTop: 16 },
    btnTxt: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

    emptyContainer: { alignItems: 'center', marginTop: 60 },
    emptyEmoji: { fontSize: 40, marginBottom: 10 },
    emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
    emptySub: { fontSize: 14, color: '#94A3B8', marginTop: 4 }
});

export default AdminActionScreen;