import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, 
    Alert, Platform, LayoutAnimation, SafeAreaView, useColorScheme, StatusBar, Dimensions 
} from 'react-native';
import apiClient from '../../api/client';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'; 
import * as Animatable from 'react-native-animatable';

const { width } = Dimensions.get('window');

// --- THEME DEFINITIONS ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    inputBg: '#FFFFFF',
    success: '#43A047',
    danger: '#E53935',
    blue: '#1E88E5',
    orange: '#F57C00',
    grey: '#9E9E9E',
    white: '#FFFFFF',
    headerIconBg: '#E0F2F1',
    tabActiveBg: '#F0FDF4',
    placeholder: '#90A4AE',
    iconColor: '#546E7A'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    success: '#66BB6A',
    danger: '#EF5350',
    blue: '#42A5F5',
    orange: '#FFA726',
    grey: '#757575',
    white: '#FFFFFF',
    headerIconBg: '#333333',
    tabActiveBg: '#1A2733',
    placeholder: '#757575',
    iconColor: '#B0B0B0'
};

// --- Local Interfaces ---
interface AttendanceRecord {
  date: string; 
  status: 'P' | 'A' | 'L';
}

interface AttendanceReport {
  stats: {
    overallPercentage: string;
    daysPresent: number;
    daysAbsent: number;
    totalDays: number; 
  };
  detailedHistory: AttendanceRecord[];
}

// --- DATE FORMATTER HELPER (DD/MM/YYYY) ---
const formatDate = (date: Date | string) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

// --- Reusable Sub-components ---

// 1. Summary Card
const SummaryCard = ({ label, value, color, delay, width = '23%', colors }) => ( 
    <Animatable.View animation="zoomIn" duration={500} delay={delay} style={[styles.summaryBox, { width: width, backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <Text style={[styles.summaryValue, { color }]}>{value}</Text>
        <Text style={[styles.summaryLabel, { color: colors.textSub }]}>{label}</Text>
    </Animatable.View>
);

// 2. History Record List Item
const HistoryRecordCard = ({ item, index, colors }) => {
    const isPresent = item.status === 'P';
    const statusText = item.status === 'P' ? 'Present' : (item.status === 'A' ? 'Absent' : 'Leave/Late');
    const statusColor = isPresent ? colors.success : colors.danger;

    return (
        <Animatable.View animation="fadeInUp" duration={400} delay={index * 50} style={[styles.historyRecordCard, { backgroundColor: colors.cardBg }]}>
            <View style={styles.historyRecordHeader}>
                <View style={{flexDirection:'row', alignItems:'center'}}>
                    <Icon name="calendar-month" size={20} color={colors.textSub} style={{marginRight: 8}} />
                    <Text style={[styles.historyDate, { color: colors.textMain }]}>{formatDate(item.date)}</Text>
                </View>
                <View style={[styles.statusBadge, {borderColor: statusColor, backgroundColor: colors.background}]}>
                    <Text style={[styles.historyStatus, { color: statusColor }]}>{statusText}</Text>
                </View>
            </View>
        </Animatable.View>
    );
};

// 3. Daily Specific Status Card
const DailyStatusCard = ({ record, date, colors }) => {
    const hasRecord = !!record;
    const status = hasRecord ? record.status : null;
    
    let bgColor = colors.grey;
    let iconName = "help-circle-outline";
    let statusText = "No Record";

    if (status === 'P') {
        bgColor = colors.success;
        iconName = "check-circle-outline";
        statusText = "Present";
    } else if (status === 'A') {
        bgColor = colors.danger;
        iconName = "close-circle-outline";
        statusText = "Absent";
    } else if (status === 'L') {
        bgColor = colors.orange;
        iconName = "clock-alert-outline";
        statusText = "Late / Leave";
    }

    return (
        <Animatable.View animation="flipInX" duration={600} style={[styles.dailyCard, { backgroundColor: hasRecord ? bgColor : colors.cardBg, borderColor: bgColor }]}>
            <Icon name={iconName} size={50} color={hasRecord ? colors.white : bgColor} />
            <Text style={[styles.dailyStatusText, { color: hasRecord ? colors.white : bgColor }]}>
                {statusText.toUpperCase()}
            </Text>
            <Text style={[styles.dailyDateText, { color: hasRecord ? 'rgba(255,255,255,0.9)' : colors.textSub }]}>
                {formatDate(date)}
            </Text>
        </Animatable.View>
    );
};

// --- Main Component ---
interface TeacherReportViewProps {
    teacherId: string;
    headerTitle: string;
    onBack?: () => void; 
}

const TeacherReportView: React.FC<TeacherReportViewProps> = ({ teacherId, headerTitle, onBack }) => {
    
    // Theme Hook
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const [report, setReport] = useState<AttendanceReport | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'yearly' | 'custom'>('daily'); 
    
    // Date States
    const [selectedDate, setSelectedDate] = useState(new Date()); 
    const [fromDate, setFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30))); 
    const [toDate, setToDate] = useState(new Date());
    
    // Picker Visibility
    const [showMainPicker, setShowMainPicker] = useState(false);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);

    const API_BASE_URL = '/teacher-attendance';

    const fetchReport = useCallback(async () => {
        if (!teacherId) return;
        setIsLoading(true);
        
        const params: any = { period: viewMode };
        if (viewMode === 'daily') {
            params.targetDate = selectedDate.toISOString().slice(0, 10);
        } else if (viewMode === 'monthly') {
            params.targetMonth = selectedDate.toISOString().slice(0, 7);
        } else if (viewMode === 'yearly') {
            params.targetYear = selectedDate.getFullYear().toString();
        } else if (viewMode === 'custom') {
            params.startDate = fromDate.toISOString().slice(0, 10);
            params.endDate = toDate.toISOString().slice(0, 10);
        }

        try {
            const response = await apiClient.get<AttendanceReport>(`${API_BASE_URL}/report/${teacherId}`, { params });
            setReport(response.data);
        } catch (error: any) {
            console.error("Attendance Report Error:", error);
            Alert.alert("Error", error.response?.data?.message || "Failed to load attendance report.");
            setReport(null);
        } finally {
            setIsLoading(false);
        }
    }, [teacherId, viewMode, selectedDate, fromDate, toDate]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]); 

    const onMainDateChange = (event: any, date?: Date) => {
        setShowMainPicker(Platform.OS === 'ios'); 
        if (date) setSelectedDate(date);
    };

    const onFromDateChange = (event: any, date?: Date) => {
        setShowFromPicker(Platform.OS === 'ios');
        if (date) setFromDate(date);
    };

    const onToDateChange = (event: any, date?: Date) => {
        setShowToPicker(Platform.OS === 'ios');
        if (date) setToDate(date);
    };
    
    const summary = report?.stats || { overallPercentage: '0.0', daysPresent: 0, daysAbsent: 0, totalDays: 0 };
    
    const dailyRecord = (viewMode === 'daily' && report?.detailedHistory?.length) 
        ? report.detailedHistory.find(r => r.date === selectedDate.toISOString().slice(0, 10)) || report.detailedHistory[0] 
        : null;

    // Logic for dynamic subtitle
    let subTitle = '';
    if (viewMode === 'daily') subTitle = `Date: ${formatDate(selectedDate)}`;
    else if (viewMode === 'monthly') subTitle = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    else if (viewMode === 'yearly') subTitle = `Year: ${selectedDate.getFullYear()}`;
    else subTitle = 'Custom Range';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#888' }]}>
                <View style={styles.headerLeft}>
                    {onBack && (
                        <TouchableOpacity onPress={onBack} style={{marginRight: 10, padding: 4}}>
                            <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                        </TouchableOpacity>
                    )}
                    <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                        <MaterialIcons name="history" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>{headerTitle}</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>{subTitle}</Text>
                    </View>
                </View>
                
                {/* Date Picker Button in Header */}
                {viewMode !== 'custom' && (
                    <TouchableOpacity style={[styles.headerActionBtn, { backgroundColor: COLORS.tabActiveBg, borderColor: COLORS.border }]} onPress={() => setShowMainPicker(true)}>
                        <MaterialIcons name="calendar-today" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* View Mode Tabs */}
            <View style={styles.toggleContainer}>
                {['daily', 'monthly', 'yearly', 'custom'].map((mode) => (
                    <TouchableOpacity 
                        key={mode}
                        style={[
                            styles.toggleButton, 
                            { backgroundColor: COLORS.inputBg },
                            viewMode === mode && { backgroundColor: COLORS.primary }
                        ]} 
                        onPress={() => setViewMode(mode as any)}
                    >
                        <Text style={[
                            styles.toggleButtonText, 
                            { color: COLORS.textMain },
                            viewMode === mode && { color: COLORS.white }
                        ]}>
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Custom Range Inputs */}
            {viewMode === 'custom' && (
                <Animatable.View animation="fadeIn" duration={300} style={[styles.rangeContainer, { backgroundColor: COLORS.background }]}>
                    <TouchableOpacity style={[styles.dateInputBox, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]} onPress={() => setShowFromPicker(true)}>
                        <Text style={[styles.dateInputText, { color: COLORS.textMain }]}>{formatDate(fromDate)}</Text>
                    </TouchableOpacity>
                    <Icon name="arrow-right" size={20} color={COLORS.textSub} />
                    <TouchableOpacity style={[styles.dateInputBox, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]} onPress={() => setShowToPicker(true)}>
                        <Text style={[styles.dateInputText, { color: COLORS.textMain }]}>{formatDate(toDate)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.goButton, { backgroundColor: COLORS.success }]} onPress={fetchReport}>
                        <Text style={styles.goButtonText}>Go</Text>
                    </TouchableOpacity>
                </Animatable.View>
            )}

            {showMainPicker && <DateTimePicker value={selectedDate} mode="date" onChange={onMainDateChange} />}
            {showFromPicker && <DateTimePicker value={fromDate} mode="date" onChange={onFromDateChange} />}
            {showToPicker && <DateTimePicker value={toDate} mode="date" onChange={onToDateChange} />}

            {isLoading ? <ActivityIndicator style={styles.loaderContainer} size="large" color={COLORS.primary} /> : (
                <>
                    {viewMode === 'daily' ? (
                        <View style={styles.dailyContainer}>
                            <DailyStatusCard record={dailyRecord} date={selectedDate} colors={COLORS} />
                        </View>
                    ) : (
                        <View style={[styles.summaryContainer, { backgroundColor: COLORS.cardBg }]}>
                            <SummaryCard label="Overall %" value={`${summary.overallPercentage}%`} color={COLORS.blue} delay={100} colors={COLORS} />
                            <SummaryCard label="Working Days" value={summary.totalDays || 0} color={COLORS.orange} delay={150} colors={COLORS} />
                            <SummaryCard label="Days Present" value={summary.daysPresent || 0} color={COLORS.success} delay={200} colors={COLORS} />
                            <SummaryCard label="Days Absent" value={summary.daysAbsent || 0} color={COLORS.danger} delay={300} colors={COLORS} />
                        </View>
                    )}
                    
                    <FlatList
                        data={report?.detailedHistory || []}
                        keyExtractor={(item) => item.date}
                        renderItem={({ item, index }) => <HistoryRecordCard item={item} index={index} colors={COLORS} />}
                        ListHeaderComponent={
                            <View style={styles.listHeaderContainer}>
                                <Text style={[styles.historyTitle, { color: COLORS.textMain }]}>
                                    {viewMode === 'daily' ? 'Log Entry' : 'Detailed History'}
                                </Text>
                            </View>
                        }
                        ListEmptyComponent={<Text style={[styles.noDataText, { color: COLORS.textSub }]}>No records found.</Text>}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                </>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 3,
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },
    headerSubtitleSmall: { fontSize: 12, fontWeight: '500' },
    headerActionBtn: { padding: 8, borderRadius: 8, borderWidth: 1 },

    // Tabs
    toggleContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 5, marginBottom: 10 },
    toggleButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginHorizontal: 4 },
    toggleButtonText: { fontWeight: '600', fontSize: 12 },

    // Range Inputs
    rangeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, marginBottom: 10 },
    dateInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 6, marginHorizontal: 5, borderWidth: 1, justifyContent: 'center' },
    dateInputText: { fontSize: 12, fontWeight: '500' },
    goButton: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 6, marginLeft: 5 },
    goButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },

    // Summary Cards
    summaryContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingVertical: 15, marginHorizontal: 15, marginBottom: 10, borderRadius: 12, elevation: 2 },
    summaryBox: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2, borderWidth: 1, borderRadius: 8 },
    summaryValue: { fontSize: 20, fontWeight: 'bold' },
    summaryLabel: { fontSize: 11, marginTop: 4, fontWeight: '500', textAlign: 'center' },
    
    // Daily Card
    dailyContainer: { padding: 20, alignItems: 'center' },
    dailyCard: { width: '90%', padding: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
    dailyStatusText: { fontSize: 24, fontWeight: 'bold', marginTop: 10 },
    dailyDateText: { fontSize: 16, marginTop: 5 },

    // History List
    listHeaderContainer: { paddingHorizontal: 20, marginTop: 10, marginBottom: 10 },
    historyTitle: { fontSize: 16, fontWeight: 'bold' },
    historyRecordCard: { marginHorizontal: 15, marginVertical: 6, borderRadius: 10, elevation: 1, shadowColor: '#999', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    historyRecordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
    historyDate: { fontSize: 15, fontWeight: '600' },
    historyStatus: { fontSize: 13, fontWeight: 'bold' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
    noDataText: { textAlign: 'center', marginTop: 20, fontSize: 16 },
});

export default TeacherReportView;