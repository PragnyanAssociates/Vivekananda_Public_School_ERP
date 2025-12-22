import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    TextInput, Platform, ActivityIndicator 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import apiClient from '../../api/client'; // Update path as needed

const LibraryHistoryScreen = () => {
    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Date Filters
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    useEffect(() => {
        fetchHistory();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [search, startDate, endDate, data]);

    const fetchHistory = async () => {
        try {
            const res = await apiClient.get('/api/library/admin/history');
            setData(res.data);
            setFilteredData(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let result = data;

        // 1. Text Search
        if (search) {
            const lower = search.toLowerCase();
            result = result.filter(item => 
                item.book_title?.toLowerCase().includes(lower) || 
                item.full_name?.toLowerCase().includes(lower) ||
                item.roll_no?.toLowerCase().includes(lower)
            );
        }

        // 2. Date Filter (Based on Actual Return Date)
        if (startDate) {
            result = result.filter(item => new Date(item.actual_return_date) >= startDate);
        }
        if (endDate) {
            // Set end date to end of day
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59);
            result = result.filter(item => new Date(item.actual_return_date) <= endOfDay);
        }

        setFilteredData(result);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const d = new Date(dateString);
        return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
    };

    const renderHeader = () => (
        <View style={styles.headerRow}>
            <Text style={[styles.cell, styles.col1, styles.headText]}>Student</Text>
            <Text style={[styles.cell, styles.col2, styles.headText]}>Book</Text>
            <Text style={[styles.cell, styles.col3, styles.headText]}>Issued</Text>
            <Text style={[styles.cell, styles.col4, styles.headText]}>Returned</Text>
        </View>
    );

    const renderItem = ({ item }) => (
        <View style={styles.row}>
            <View style={[styles.cell, styles.col1]}>
                <Text style={styles.cellTextBold}>{item.full_name}</Text>
                <Text style={styles.cellSubText}>{item.roll_no}</Text>
            </View>
            <View style={[styles.cell, styles.col2]}>
                <Text style={styles.cellText}>{item.book_title}</Text>
                <Text style={styles.cellSubText}>{item.book_no}</Text>
            </View>
            <View style={[styles.cell, styles.col3]}>
                <Text style={styles.cellText}>{formatDate(item.borrow_date)}</Text>
            </View>
            <View style={[styles.cell, styles.col4]}>
                <Text style={[styles.cellText, {color:'green', fontWeight:'bold'}]}>
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
                    value={search}
                    onChangeText={setSearch}
                />
                
                <View style={styles.dateRow}>
                    <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateBtn}>
                        <Text style={styles.dateBtnTxt}>{startDate ? formatDate(startDate) : 'Start Date'}</Text>
                    </TouchableOpacity>
                    <Text>-</Text>
                    <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateBtn}>
                        <Text style={styles.dateBtnTxt}>{endDate ? formatDate(endDate) : 'End Date'}</Text>
                    </TouchableOpacity>
                    
                    {(startDate || endDate) && (
                        <TouchableOpacity onPress={() => {setStartDate(null); setEndDate(null)}} style={styles.clearBtn}>
                            <Text style={{color:'#FFF'}}>✕</Text>
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
                {loading ? <ActivityIndicator style={{marginTop: 20}} color="#2563EB" /> : (
                    <FlatList
                        data={filteredData}
                        renderItem={renderItem}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        ListEmptyComponent={<Text style={styles.emptyText}>No history found.</Text>}
                    />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
    screenTitle: { fontSize: 22, fontWeight: 'bold', color: '#1E293B', marginBottom: 16 },
    
    // Filters
    filterContainer: { backgroundColor: '#FFF', padding: 12, borderRadius: 8, marginBottom: 16, elevation: 2 },
    searchInput: { backgroundColor: '#F1F5F9', padding: 10, borderRadius: 6, marginBottom: 10 },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dateBtn: { backgroundColor: '#E2E8F0', padding: 8, borderRadius: 6, width: '40%', alignItems: 'center' },
    dateBtnTxt: { fontSize: 12, fontWeight: '600' },
    clearBtn: { backgroundColor: '#EF4444', padding: 8, borderRadius: 6 },

    // Table
    tableContainer: { flex: 1, backgroundColor: '#FFF', borderRadius: 8, elevation: 2, overflow: 'hidden' },
    headerRow: { flexDirection: 'row', backgroundColor: '#334155', paddingVertical: 12, paddingHorizontal: 8 },
    row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 12, paddingHorizontal: 8, alignItems:'center' },
    
    // Columns
    col1: { flex: 2.5 }, // Student
    col2: { flex: 2.5 }, // Book
    col3: { flex: 1.5 }, // Issued
    col4: { flex: 1.5 }, // Returned
    
    cell: { paddingRight: 4 },
    headText: { color: '#FFF', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
    cellText: { fontSize: 12, color: '#334155' },
    cellTextBold: { fontSize: 12, color: '#1E293B', fontWeight: 'bold' },
    cellSubText: { fontSize: 10, color: '#64748B' },
    emptyText: { textAlign: 'center', marginTop: 20, color: '#94A3B8' }
});

export default LibraryHistoryScreen;