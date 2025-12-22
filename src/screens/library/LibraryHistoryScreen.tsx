import React, { useState, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    TextInput, Platform, ActivityIndicator, RefreshControl 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../../api/client'; 

const LibraryHistoryScreen = () => {
    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');

    // Date Filters
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    // --- 1. Auto-Fetch when screen is focused ---
    useFocusEffect(
        useCallback(() => {
            fetchHistory();
        }, [])
    );

    // --- 2. Filter Logic (Triggered on any change) ---
    React.useEffect(() => {
        applyFilters();
    }, [search, startDate, endDate, data]);

    const fetchHistory = async () => {
        try {
            // FIXED URL: Removed '/api' prefix to match your client config
            const res = await apiClient.get('/library/admin/history');
            setData(res.data || []);
        } catch (error) {
            console.error("History Fetch Error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const applyFilters = () => {
        let result = [...data];

        // 1. Text Search
        if (search) {
            const lower = search.toLowerCase();
            result = result.filter(item => 
                (item.book_title && item.book_title.toLowerCase().includes(lower)) || 
                (item.full_name && item.full_name.toLowerCase().includes(lower)) ||
                (item.roll_no && item.roll_no.toLowerCase().includes(lower))
            );
        }

        // 2. Date Filter
        if (startDate) {
            result = result.filter(item => new Date(item.actual_return_date) >= startDate);
        }
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59);
            result = result.filter(item => new Date(item.actual_return_date) <= endOfDay);
        }

        // 3. "Latest 10" Logic for Initial View
        // If no filters are active, limit to 10. If searching/filtering, show all matches.
        if (!search && !startDate && !endDate) {
            result = result.slice(0, 10);
        }

        setFilteredData(result);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const d = new Date(dateString);
        // Format: DD/MM/YYYY
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    };

    // --- Render Header ---
    const renderHeader = () => (
        <View style={styles.headerRow}>
            <Text style={[styles.cell, styles.col1, styles.headText]}>Student</Text>
            <Text style={[styles.cell, styles.col2, styles.headText]}>Book</Text>
            <Text style={[styles.cell, styles.col3, styles.headText]}>Issued</Text>
            <Text style={[styles.cell, styles.col4, styles.headText]}>Returned</Text>
        </View>
    );

    // --- Render Row ---
    const renderItem = ({ item }) => (
        <View style={styles.row}>
            {/* Student Column */}
            <View style={[styles.cell, styles.col1]}>
                <Text style={styles.cellTextBold} numberOfLines={1}>{item.full_name}</Text>
                <Text style={styles.cellSubText}>{item.roll_no}</Text>
            </View>
            
            {/* Book Column */}
            <View style={[styles.cell, styles.col2]}>
                <Text style={styles.cellText} numberOfLines={1}>{item.book_title}</Text>
                <Text style={styles.cellSubText}>{item.book_no}</Text>
            </View>
            
            {/* Issued Date */}
            <View style={[styles.cell, styles.col3]}>
                <Text style={styles.cellText}>{formatDate(item.borrow_date)}</Text>
            </View>
            
            {/* Returned Date */}
            <View style={[styles.cell, styles.col4]}>
                <Text style={[styles.cellText, styles.greenText]}>
                    {formatDate(item.actual_return_date)}
                </Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.screenTitle}>📜 Transaction History</Text>
            
            {/* --- Filters Section --- */}
            <View style={styles.filterContainer}>
                <TextInput 
                    style={styles.searchInput}
                    placeholder="Search Student or Book..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={setSearch}
                />
                
                <View style={styles.dateRow}>
                    <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateBtn}>
                        <Text style={styles.dateBtnTxt}>
                            {startDate ? formatDate(startDate.toISOString()) : 'Start Date'}
                        </Text>
                        <Text>📅</Text>
                    </TouchableOpacity>
                    
                    <Text style={{color: '#94A3B8'}}>-</Text>
                    
                    <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateBtn}>
                        <Text style={styles.dateBtnTxt}>
                            {endDate ? formatDate(endDate.toISOString()) : 'End Date'}
                        </Text>
                        <Text>📅</Text>
                    </TouchableOpacity>
                    
                    {(startDate || endDate) && (
                        <TouchableOpacity 
                            onPress={() => {setStartDate(null); setEndDate(null)}} 
                            style={styles.clearBtn}
                        >
                            <Text style={{color:'#FFF', fontWeight:'bold'}}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* --- Date Pickers --- */}
            {showStartPicker && (
                <DateTimePicker value={startDate || new Date()} mode="date" 
                    onChange={(e, d) => { setShowStartPicker(Platform.OS === 'ios'); if(d) setStartDate(d); }} 
                />
            )}
            {showEndPicker && (
                <DateTimePicker value={endDate || new Date()} mode="date" 
                    onChange={(e, d) => { setShowEndPicker(Platform.OS === 'ios'); if(d) setEndDate(d); }} 
                />
            )}

            {/* --- Table --- */}
            <View style={styles.tableContainer}>
                {renderHeader()}
                {loading ? <ActivityIndicator style={{marginTop: 50}} color="#2563EB" /> : (
                    <FlatList
                        data={filteredData}
                        renderItem={renderItem}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true); fetchHistory()}} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No history found.</Text>
                            </View>
                        }
                    />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
    screenTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginBottom: 16 },
    
    // Filters
    filterContainer: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 16, elevation: 2 },
    searchInput: { backgroundColor: '#F1F5F9', padding: 12, borderRadius: 8, marginBottom: 12, color: '#1E293B' },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dateBtn: { flexDirection: 'row', alignItems:'center', justifyContent:'space-between', backgroundColor: '#F1F5F9', padding: 10, borderRadius: 8, width: '40%' },
    dateBtnTxt: { fontSize: 12, fontWeight: '600', color: '#334155' },
    clearBtn: { backgroundColor: '#EF4444', padding: 10, borderRadius: 8 },

    // Table
    tableContainer: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, elevation: 3, overflow: 'hidden' },
    headerRow: { flexDirection: 'row', backgroundColor: '#334155', paddingVertical: 14, paddingHorizontal: 10 },
    row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 14, paddingHorizontal: 10, alignItems:'center' },
    
    // Grid System
    col1: { flex: 3 },   // Student Name (Wider)
    col2: { flex: 3 },   // Book Title (Wider)
    col3: { flex: 2 },   // Issue Date
    col4: { flex: 2 },   // Return Date
    
    cell: { paddingRight: 5 },
    headText: { color: '#FFF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    cellText: { fontSize: 12, color: '#334155', fontWeight: '500' },
    cellTextBold: { fontSize: 13, color: '#1E293B', fontWeight: '700' },
    cellSubText: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
    greenText: { color: '#10B981', fontWeight: '700' },
    
    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 16 }
});

export default LibraryHistoryScreen;