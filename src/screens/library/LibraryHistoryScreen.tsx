/**
 * File: src/screens/library/LibraryHistoryScreen.js
 * Purpose: Display a history of library transactions.
 * Updated: Added Phone Number, Handles Roles and Null Classes.
 */
import React, { useState, useCallback, useLayoutEffect } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    TextInput, Platform, ActivityIndicator, RefreshControl, 
    SafeAreaView, Dimensions, useColorScheme, StatusBar
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client'; 
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#cbd5e1',
    inputBg: '#FFFFFF',
    inputBorder: '#cbd5e1',
    iconBg: '#E0F2F1',
    textPlaceholder: '#94a3b8',
    success: '#43A047',
    danger: '#E53935',
    tableHeader: '#34495e',
    tableRowBorder: '#F1F5F9',
    white: '#ffffff'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212', 
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    inputBorder: '#555555',
    iconBg: '#333333',
    textPlaceholder: '#64748b',
    success: '#4CAF50',
    danger: '#EF5350',
    tableHeader: '#252525',
    tableRowBorder: '#333333',
    white: '#ffffff'
};

const LibraryHistoryScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const navigation = useNavigation(); 
    
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');

    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    useFocusEffect(
        useCallback(() => {
            fetchHistory();
        }, [])
    );

    React.useEffect(() => {
        applyFilters();
    }, [search, startDate, endDate, data]);

    const fetchHistory = async () => {
        try {
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
        if (search) {
            const lower = search.toLowerCase();
            result = result.filter(item => 
                (item.book_title && item.book_title.toLowerCase().includes(lower)) || 
                (item.full_name && item.full_name.toLowerCase().includes(lower)) ||
                (item.roll_no && item.roll_no.toLowerCase().includes(lower)) ||
                (item.mobile && item.mobile.includes(lower))
            );
        }
        if (startDate) {
            result = result.filter(item => new Date(item.actual_return_date) >= startDate);
        }
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59);
            result = result.filter(item => new Date(item.actual_return_date) <= endOfDay);
        }
        if (!search && !startDate && !endDate) {
            result = result.slice(0, 10);
        }
        setFilteredData(result);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const d = new Date(dateString);
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    };

    const renderHeader = () => (
        <View style={[styles.headerRow, { backgroundColor: theme.tableHeader }]}>
            <Text style={[styles.cell, styles.col1, styles.headText]}>Details</Text>
            <Text style={[styles.cell, styles.col2, styles.headText]}>Book</Text>
            <Text style={[styles.cell, styles.col3, styles.headText]}>Issued</Text>
            <Text style={[styles.cell, styles.col4, styles.headText]}>Returned</Text>
        </View>
    );

    const renderItem = ({ item }) => {
        const isStudent = item.user_role === 'student';
        return (
            <View style={[styles.row, { borderBottomColor: theme.tableRowBorder }]}>
                {/* Details Column: Name + Role + ID/Class + Phone */}
                <View style={[styles.cell, styles.col1]}>
                    <Text style={[styles.cellTextBold, { color: theme.textMain }]} numberOfLines={1}>{item.full_name}</Text>
                    <Text style={[styles.cellRoleText, { color: theme.primary }]}>{item.user_role ? item.user_role.toUpperCase() : 'USER'}</Text>
                    <Text style={[styles.cellSubText, { color: theme.textSub }]}>
                        {isStudent ? `ID: ${item.roll_no}` : `ID: ${item.roll_no}`}
                    </Text>
                    
                    {/* --- ADDED PHONE NUMBER HERE --- */}
                    <Text style={[styles.cellSubText, { color: theme.textSub }]}>
                         Ph: {item.mobile}
                    </Text>
                </View>
                
                {/* Book Column */}
                <View style={[styles.cell, styles.col2]}>
                    <Text style={[styles.cellText, { color: theme.textMain }]} numberOfLines={2}>{item.book_title}</Text>
                    <Text style={[styles.cellSubText, { color: theme.textSub }]}>{item.book_no}</Text>
                </View>
                
                {/* Dates */}
                <View style={[styles.cell, styles.col3]}>
                    <Text style={[styles.cellText, { color: theme.textMain }]}>{formatDate(item.borrow_date)}</Text>
                </View>
                <View style={[styles.cell, styles.col4]}>
                    <Text style={[styles.cellText, { color: theme.success, fontWeight: '700' }]}>{formatDate(item.actual_return_date)}</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            
            {/* Header Card */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={theme.textMain} />
                    </TouchableOpacity>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialCommunityIcons name="history" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>History</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Transaction Logs</Text>
                    </View>
                </View>
            </View>
            
            {/* Filters */}
            <View style={styles.filterContainer}>
                <View style={[styles.searchBox, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                    <MaterialIcons name="search" size={20} color={theme.textPlaceholder} style={styles.searchIcon} />
                    <TextInput 
                        style={[styles.searchInput, { color: theme.textMain }]}
                        placeholder="Search Name or Book..."
                        placeholderTextColor={theme.textPlaceholder}
                        value={search}
                        onChangeText={setSearchText} // Using wrapper for filter
                    />
                </View>
                <View style={styles.dateRow}>
                    <TouchableOpacity onPress={() => setShowStartPicker(true)} style={[styles.dateBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                        <Text style={[styles.dateBtnTxt, { color: theme.textMain }]}>{startDate ? formatDate(startDate.toISOString()) : 'Start Date'}</Text>
                        <MaterialIcons name="calendar-today" size={16} color={theme.primary} />
                    </TouchableOpacity>
                    <MaterialIcons name="arrow-right-alt" size={24} color={theme.textSub} style={{ marginHorizontal: 5 }} />
                    <TouchableOpacity onPress={() => setShowEndPicker(true)} style={[styles.dateBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                        <Text style={[styles.dateBtnTxt, { color: theme.textMain }]}>{endDate ? formatDate(endDate.toISOString()) : 'End Date'}</Text>
                        <MaterialIcons name="calendar-today" size={16} color={theme.primary} />
                    </TouchableOpacity>
                    {(startDate || endDate) && (
                        <TouchableOpacity onPress={() => {setStartDate(null); setEndDate(null)}} style={[styles.clearBtn, { backgroundColor: theme.danger }]}>
                            <MaterialIcons name="close" size={18} color={theme.white} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Pickers */}
            {showStartPicker && <DateTimePicker value={startDate || new Date()} mode="date" display="default" onChange={(e, d) => { setShowStartPicker(Platform.OS === 'ios'); if(d) setStartDate(d); }} />}
            {showEndPicker && <DateTimePicker value={endDate || new Date()} mode="date" display="default" minimumDate={startDate || undefined} onChange={(e, d) => { setShowEndPicker(Platform.OS === 'ios'); if(d) setEndDate(d); }} />}

            {/* List */}
            <View style={[styles.tableContainer, { backgroundColor: theme.cardBg }]}>
                {renderHeader()}
                {loading ? <ActivityIndicator style={{marginTop: 50}} color={theme.primary} size="large" /> : (
                    <FlatList
                        data={filteredData}
                        renderItem={renderItem}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true); fetchHistory()}} colors={[theme.primary]} tintColor={theme.primary}/>}
                        ListEmptyComponent={<View style={styles.emptyContainer}><Text style={[styles.emptyText, { color: theme.textSub }]}>No history found.</Text></View>}
                    />
                )}
            </View>
        </SafeAreaView>
    );

    // Filter Wrapper
    function setSearchText(text) { setSearch(text); }
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerCard: {
        paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10, borderRadius: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    backButton: { marginRight: 10, padding: 4 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13, marginTop: 2 },
    filterContainer: { paddingHorizontal: 15, marginBottom: 15 },
    searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 10, marginBottom: 10, borderWidth: 1, height: 45 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 15, padding: 0 },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dateBtn: { flex: 1, flexDirection: 'row', alignItems:'center', justifyContent:'space-between', padding: 10, borderRadius: 8, borderWidth: 1 },
    dateBtnTxt: { fontSize: 12, fontWeight: '600' },
    clearBtn: { padding: 8, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    tableContainer: { flex: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 5, overflow: 'hidden' },
    headerRow: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 10 },
    row: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 14, paddingHorizontal: 10, alignItems:'center' },
    col1: { flex: 3 }, col2: { flex: 3 }, col3: { flex: 2 }, col4: { flex: 2 },
    cell: { paddingRight: 5 },
    headText: { color: '#FFF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    cellText: { fontSize: 12, fontWeight: '500' },
    cellTextBold: { fontSize: 13, fontWeight: '700' },
    cellRoleText: { fontSize: 10, fontWeight: '700', marginTop: 2 },
    cellSubText: { fontSize: 10, marginTop: 1 },
    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { textAlign: 'center', fontSize: 16 }
});

export default LibraryHistoryScreen;