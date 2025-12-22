import React, { useState, useCallback } from 'react';
import { 
    View, Text, FlatList, StyleSheet, TouchableOpacity, 
    Alert, ActivityIndicator, RefreshControl, TextInput, StatusBar 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../../api/client'; 

const AdminActionScreen = () => {
    const [requests, setRequests] = useState([]);
    const [stats, setStats] = useState({ issued: 0, overdue: 0, pending: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Default filter is 'PENDING' so user sees requests immediately
    const [activeFilter, setActiveFilter] = useState('PENDING'); 
    const [searchText, setSearchText] = useState('');

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

    // --- 2. LOGIC: STRICT FILTERING ---
    const getProcessedData = () => {
        if (!requests) return [];
        
        let data = [...requests];

        // STRICT CATEGORY FILTERING
        // 1. PENDING: Only status 'pending'
        // 2. OVERDUE: Status 'approved' AND is_overdue = 1 (from DB)
        // 3. ISSUED:  Status 'approved' AND is_overdue = 0 (from DB)
        
        if (activeFilter === 'PENDING') {
            data = data.filter(item => item.status === 'pending');
        } else if (activeFilter === 'OVERDUE') {
            data = data.filter(item => item.status === 'approved' && item.is_overdue === 1);
        } else if (activeFilter === 'ISSUED') {
            data = data.filter(item => item.status === 'approved' && item.is_overdue === 0);
        }

        // Search Text Filter
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
            fetchData(); // Reload data immediately
        } catch (e) { 
            Alert.alert("Error", "Action failed."); 
        }
    };

    // --- 4. HELPER: DATE FORMATTER ---
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return dateString;
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    };

    // --- 5. RENDER COMPONENTS ---
    const StatCard = ({ label, count, type }) => {
        const isActive = activeFilter === type;
        // Color mapping based on type
        let activeColor = '#2563EB'; // Blue for Issued
        if (type === 'PENDING') activeColor = '#F59E0B'; // Orange
        if (type === 'OVERDUE') activeColor = '#EF4444'; // Red

        return (
            <TouchableOpacity 
                style={[styles.statCard, isActive && { borderColor: activeColor, backgroundColor: activeColor + '10' }]} 
                onPress={() => setActiveFilter(type)}
                activeOpacity={0.7}
            >
                <Text style={[styles.statNum, isActive && { color: activeColor }]}>
                    {count}
                </Text>
                <Text style={[styles.statLabel, isActive && { color: activeColor, fontWeight:'bold' }]}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderItem = ({ item }) => {
        // Visual logic
        const isOverdue = item.is_overdue === 1;
        const isPending = item.status === 'pending';

        return (
            <View style={[styles.card, isOverdue && styles.overdueBorder]}>
                
                {/* Header: Title & Status Badge */}
                <View style={styles.cardTop}>
                    <View style={{flex:1, marginRight: 10}}>
                        <Text style={styles.bookTitle} numberOfLines={1}>{item.book_title}</Text>
                        <Text style={styles.subText}>{item.full_name} ({item.class_name || 'N/A'})</Text>
                    </View>
                    <View style={[styles.badge, 
                        isPending ? styles.bgOrange : (isOverdue ? styles.bgRed : styles.bgBlue)
                    ]}>
                        <Text style={[styles.badgeText, isOverdue && {color:'#DC2626'}]}>
                            {isPending ? 'PENDING' : (isOverdue ? 'OVERDUE' : 'ISSUED')}
                        </Text>
                    </View>
                </View>

                {/* Details */}
                <View style={styles.infoGrid}>
                     <Text style={styles.infoText}>📖 {item.book_no}</Text>
                     <Text style={styles.infoText}>🆔 {item.roll_no || '-'}</Text>
                </View>

                {/* Dates */}
                <View style={styles.dateRow}>
                    <View style={styles.dateBox}>
                        <Text style={styles.dateLabel}>Borrowed</Text>
                        <Text style={styles.dateValue}>{formatDate(item.borrow_date)}</Text>
                    </View>
                    <View style={styles.vertLine} />
                    <View style={styles.dateBox}>
                        <Text style={[styles.dateLabel, isOverdue && {color:'#DC2626'}]}>
                            Return Due
                        </Text>
                        <Text style={[styles.dateValue, isOverdue && {color:'#DC2626'}]}>
                            {formatDate(item.expected_return_date)}
                        </Text>
                    </View>
                </View>

                {/* ACTION BUTTONS */}
                
                {/* 1. PENDING: Show Approve/Reject */}
                {isPending && (
                    <View style={styles.btnRow}>
                        <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={()=>handleAction(item.id, 'approved')}>
                            <Text style={styles.btnTxt}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={()=>handleAction(item.id, 'rejected')}>
                            <Text style={styles.btnTxt}>Reject</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* 2. ISSUED or OVERDUE: Show Return Button */}
                {(item.status === 'approved') && (
                    <TouchableOpacity style={[styles.btn, styles.btnReturn]} onPress={()=>handleAction(item.id, 'returned')}>
                        <Text style={styles.btnTxt}>Receive Book (Return)</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#F1F5F9" barStyle="dark-content" />
            
            {/* Header */}
            <View style={styles.headerContainer}>
                <Text style={styles.screenTitle}>Library Hub</Text>
                
                {/* Stats Row (Acts as Tabs) */}
                <View style={styles.statsRow}>
                    <StatCard label="Pending" count={stats.pending} type="PENDING" />
                    <StatCard label="Issued" count={stats.issued} type="ISSUED" />
                    <StatCard label="Overdue" count={stats.overdue} type="OVERDUE" />
                </View>

                {/* Search Bar */}
                <View style={styles.searchBar}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput 
                        style={styles.input}
                        placeholder={`Search in ${activeFilter}...`}
                        placeholderTextColor="#94A3B8"
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={()=>setSearchText('')} style={styles.clearBtn}>
                            <Text style={{color:'#64748B'}}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* List */}
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
                            <Text style={styles.emptyEmoji}>
                                {activeFilter === 'PENDING' ? '✅' : (activeFilter === 'OVERDUE' ? '🎉' : '📚')}
                            </Text>
                            <Text style={styles.emptyTitle}>No {activeFilter.toLowerCase()} items</Text>
                            <Text style={styles.emptySub}>
                                {activeFilter === 'PENDING' ? "No new requests to approve." : 
                                 activeFilter === 'OVERDUE' ? "Great! No books are overdue." : 
                                 "No books currently issued."}
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
    
    headerContainer: { backgroundColor: '#FFF', padding: 16, elevation: 3, zIndex: 10 },
    screenTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginBottom: 15 },
    
    // Stats / Tabs
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 15 },
    statCard: { flex: 1, backgroundColor: '#F8FAFC', paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    statNum: { fontSize: 18, fontWeight: '800', color: '#64748B', marginBottom: 2 },
    statLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },

    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 12, height: 42 },
    searchIcon: { fontSize: 14, color: '#64748B' },
    input: { flex: 1, marginLeft: 8, fontSize: 14, color: '#334155', height: '100%' },
    clearBtn: { padding: 4 },

    listContent: { padding: 16, paddingBottom: 50 },
    
    card: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05 },
    overdueBorder: { borderWidth: 1, borderColor: '#FECACA' },

    cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    bookTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
    subText: { fontSize: 12, color: '#64748B', marginTop: 2 },

    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, height: 24, justifyContent: 'center' },
    bgOrange: { backgroundColor: '#FFF7ED' },
    bgGreen: { backgroundColor: '#ECFDF5' }, // Issued Blue/Green
    bgBlue: { backgroundColor: '#EFF6FF' },
    bgRed: { backgroundColor: '#FEF2F2' },
    badgeText: { fontSize: 10, fontWeight: '800', color: '#334155' },

    infoGrid: { flexDirection: 'row', marginBottom: 12, gap: 15 },
    infoText: { fontSize: 12, color: '#64748B', fontWeight: '500' },

    dateRow: { flexDirection: 'row', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10 },
    dateBox: { flex: 1, alignItems: 'center' },
    vertLine: { width: 1, backgroundColor: '#E2E8F0' },
    dateLabel: { fontSize: 11, color: '#94A3B8', marginBottom: 4, fontWeight: '600' },
    dateValue: { fontSize: 13, fontWeight: '700', color: '#334155' },

    btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
    btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    btnApprove: { backgroundColor: '#10B981' },
    btnReject: { backgroundColor: '#EF4444' },
    btnReturn: { backgroundColor: '#3B82F6', marginTop: 16 },
    btnTxt: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },

    emptyContainer: { alignItems: 'center', marginTop: 60 },
    emptyEmoji: { fontSize: 35, marginBottom: 10 },
    emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#334155' },
    emptySub: { fontSize: 13, color: '#94A3B8', marginTop: 4 }
});

export default AdminActionScreen;