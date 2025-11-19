import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, Platform, LayoutAnimation, SafeAreaView } from 'react-native';
import apiClient from '../../api/client';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';

// --- Theme Constants ---
const PRIMARY_COLOR = '#008080';
const TEXT_COLOR_DARK = '#37474F';
const TEXT_COLOR_MEDIUM = '#566573';
const BORDER_COLOR = '#E0E0E0';
const GREEN = '#43A047';
const RED = '#E53935';
const BLUE = '#1E88E5';
const ORANGE = '#F57C00';
const GREY = '#9E9E9E';
const WHITE = '#FFFFFF';

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
    totalDays: number; // Working Days
  };
  detailedHistory: AttendanceRecord[];
}

// --- Reusable Sub-components ---

// 1. Summary Card (For Monthly/Yearly/Range Views)
const SummaryCard = ({ label, value, color, delay, width = '23%' }) => ( 
    <Animatable.View animation="zoomIn" duration={500} delay={delay} style={[styles.summaryBox, { width: width }]}>
        <Text style={[styles.summaryValue, { color }]}>{value}</Text>
        <Text style={styles.summaryLabel}>{label}</Text>
    </Animatable.View>
);

// 2. History Record List Item
const HistoryRecordCard = ({ item, index }) => {
    const isPresent = item.status === 'P';
    const statusText = item.status === 'P' ? 'Present' : (item.status === 'A' ? 'Absent' : 'Leave/Late');
    const statusColor = isPresent ? GREEN : RED;

    return (
        <Animatable.View animation="fadeInUp" duration={400} delay={index * 100} style={styles.historyRecordCard}>
            <View style={styles.historyRecordHeader}>
                <Text style={styles.historyDate}>{new Date(item.date).toDateString()}</Text>
                <Text style={[styles.historyStatus, { color: statusColor }]}>{statusText}</Text>
            </View>
        </Animatable.View>
    );
};

// 3. Daily Specific Status Card
const DailyStatusCard = ({ record, date }) => {
    const hasRecord = !!record;
    const status = hasRecord ? record.status : null;
    
    let bgColor = GREY;
    let iconName = "help-circle-outline";
    let statusText = "No Record";

    if (status === 'P') {
        bgColor = GREEN;
        iconName = "check-circle-outline";
        statusText = "Present";
    } else if (status === 'A') {
        bgColor = RED;
        iconName = "close-circle-outline";
        statusText = "Absent";
    } else if (status === 'L') {
        bgColor = ORANGE;
        iconName = "clock-alert-outline";
        statusText = "Late / Leave";
    }

    return (
        <Animatable.View animation="flipInX" duration={600} style={[styles.dailyCard, { backgroundColor: hasRecord ? bgColor : WHITE, borderColor: bgColor }]}>
            <Icon name={iconName} size={50} color={hasRecord ? WHITE : bgColor} />
            <Text style={[styles.dailyStatusText, { color: hasRecord ? WHITE : bgColor }]}>
                {statusText.toUpperCase()}
            </Text>
            <Text style={[styles.dailyDateText, { color: hasRecord ? 'rgba(255,255,255,0.9)' : TEXT_COLOR_MEDIUM }]}>
                {date.toDateString()}
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
    
    const [report, setReport] = useState<AttendanceReport | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    // Updated View Mode to include 'yearly'
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
            // NEW: Send the Year
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

    // Initial load
    useEffect(() => {
        fetchReport();
    }, [fetchReport]); 

    const onMainDateChange = (event: any, date?: Date) => {
        setShowMainPicker(Platform.OS === 'ios'); 
        if (date) {
            setSelectedDate(date);
        }
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

    return (
        <SafeAreaView style={styles.container}>
            <Animatable.View animation="fadeInDown" duration={500}>
                <View style={styles.header}>
                    {onBack && (
                        <TouchableOpacity onPress={onBack} style={styles.backButton}>
                            <Icon name="arrow-left" size={24} color={TEXT_COLOR_DARK} />
                        </TouchableOpacity>
                    )}
                    <View style={{flex: 1, alignItems: 'center', paddingRight: onBack ? 30 : 0 }}>
                        <Text style={styles.headerTitle}>{headerTitle}</Text>
                        
                        {/* Dynamic Subtitle */}
                        {viewMode === 'daily' && <Text style={styles.headerSubtitleSmall}>{selectedDate.toDateString()}</Text>}
                        {viewMode === 'monthly' && <Text style={styles.headerSubtitleSmall}>{selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>}
                        {viewMode === 'yearly' && <Text style={styles.headerSubtitleSmall}>Year: {selectedDate.getFullYear()}</Text>}
                        {viewMode === 'custom' && <Text style={styles.headerSubtitleSmall}>Custom Date Range</Text>}
                    </View>
                </View>
            </Animatable.View>

            {/* TABS - UPDATED to include YEARLY */}
            <View style={styles.toggleContainer}>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'daily' && styles.toggleButtonActive]} onPress={() => setViewMode('daily')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'daily' && styles.toggleButtonTextActive]}>Daily</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'monthly' && styles.toggleButtonActive]} onPress={() => setViewMode('monthly')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'monthly' && styles.toggleButtonTextActive]}>Monthly</Text>
                </TouchableOpacity>
                
                {/* NEW YEARLY BUTTON */}
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'yearly' && styles.toggleButtonActive]} onPress={() => setViewMode('yearly')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'yearly' && styles.toggleButtonTextActive]}>Yearly</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.toggleButton, viewMode === 'custom' && styles.toggleButtonActive]} onPress={() => setViewMode('custom')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'custom' && styles.toggleButtonTextActive]}>Range</Text>
                </TouchableOpacity>
                
                {/* Calendar Icon - Visible for Daily/Monthly/Yearly to change the anchor date */}
                {viewMode !== 'custom' && (
                    <TouchableOpacity style={styles.calendarButton} onPress={() => setShowMainPicker(true)}>
                        <Icon name="calendar" size={22} color={PRIMARY_COLOR} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Date Range Inputs (Visible ONLY in Custom Range Mode) */}
            {viewMode === 'custom' && (
                <Animatable.View animation="fadeIn" duration={300} style={styles.rangeContainer}>
                    <TouchableOpacity style={styles.dateInputBox} onPress={() => setShowFromPicker(true)}>
                        <Icon name="calendar-today" size={18} color={TEXT_COLOR_MEDIUM} style={{marginRight:5}}/>
                        <Text style={styles.dateInputText}>{fromDate.toLocaleDateString()}</Text>
                    </TouchableOpacity>
                    
                    <Icon name="arrow-right" size={20} color={TEXT_COLOR_MEDIUM} />

                    <TouchableOpacity style={styles.dateInputBox} onPress={() => setShowToPicker(true)}>
                        <Icon name="calendar-today" size={18} color={TEXT_COLOR_MEDIUM} style={{marginRight:5}}/>
                        <Text style={styles.dateInputText}>{toDate.toLocaleDateString()}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.goButton} onPress={fetchReport}>
                        <Text style={styles.goButtonText}>Go</Text>
                    </TouchableOpacity>
                </Animatable.View>
            )}

            {/* Date Pickers */}
            {showMainPicker && <DateTimePicker value={selectedDate} mode="date" onChange={onMainDateChange} />}
            {showFromPicker && <DateTimePicker value={fromDate} mode="date" onChange={onFromDateChange} />}
            {showToPicker && <DateTimePicker value={toDate} mode="date" onChange={onToDateChange} />}

            {isLoading ? <ActivityIndicator style={styles.loaderContainer} size="large" color={PRIMARY_COLOR} /> : (
                <>
                    {viewMode === 'daily' ? (
                        /* DAILY VIEW: Single Card */
                        <View style={styles.dailyContainer}>
                            <DailyStatusCard record={dailyRecord} date={selectedDate} />
                        </View>
                    ) : (
                        /* MONTHLY/YEARLY/RANGE VIEW: Aggregates */
                        <View style={styles.summaryContainer}>
                            <SummaryCard label="Overall %" value={`${summary.overallPercentage}%`} color={BLUE} delay={100} />
                            <SummaryCard label="Working Days" value={summary.totalDays || 0} color={ORANGE} delay={150} />
                            <SummaryCard label="Days Present" value={summary.daysPresent || 0} color={GREEN} delay={200} />
                            <SummaryCard label="Days Absent" value={summary.daysAbsent || 0} color={RED} delay={300} />
                        </View>
                    )}
                    
                    <FlatList
                        data={report?.detailedHistory || []}
                        keyExtractor={(item) => item.date}
                        renderItem={({ item, index }) => <HistoryRecordCard item={item} index={index} />}
                        ListHeaderComponent={
                            <Text style={styles.historyTitle}>
                                {viewMode === 'daily' ? 'Log Entry' : 'Detailed History'}
                            </Text>
                        }
                        ListEmptyComponent={<Text style={styles.noDataText}>No records found.</Text>}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                </>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F4F6F8' },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    noDataText: { textAlign: 'center', marginTop: 20, color: TEXT_COLOR_MEDIUM, fontSize: 16 },
    
    header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: TEXT_COLOR_DARK, textAlign: 'center' },
    headerSubtitleSmall: { fontSize: 14, color: TEXT_COLOR_MEDIUM, marginTop: 2, textAlign: 'center' },
    backButton: { position: 'absolute', left: 15, zIndex: 1, padding: 5 },
    
    // Tab Styling - Adjusted padding to fit 4 buttons
    toggleContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 2, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, alignItems: 'center', flexWrap: 'wrap' },
    toggleButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginHorizontal: 3, backgroundColor: '#E0E0E0', marginBottom: 5 },
    toggleButtonActive: { backgroundColor: PRIMARY_COLOR },
    toggleButtonText: { color: TEXT_COLOR_DARK, fontWeight: '600', fontSize: 13 },
    toggleButtonTextActive: { color: WHITE },
    calendarButton: { padding: 8, marginLeft: 5, justifyContent: 'center', alignItems: 'center' },

    rangeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, backgroundColor: '#f9f9f9', borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
    dateInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0E0E0', padding: 10, borderRadius: 6, marginHorizontal: 5, justifyContent: 'center' },
    dateInputText: { color: TEXT_COLOR_DARK, fontSize: 14, fontWeight: '500' },
    goButton: { backgroundColor: GREEN, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, marginLeft: 5 },
    goButtonText: { color: WHITE, fontWeight: 'bold' },

    summaryContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingVertical: 15, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
    summaryBox: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2 },
    summaryValue: { fontSize: 22, fontWeight: 'bold' },
    summaryLabel: { fontSize: 12, color: TEXT_COLOR_MEDIUM, marginTop: 5, fontWeight: '500', textAlign: 'center' },
    
    dailyContainer: { padding: 20, alignItems: 'center', backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
    dailyCard: { width: '90%', padding: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
    dailyStatusText: { fontSize: 24, fontWeight: 'bold', marginTop: 10 },
    dailyDateText: { fontSize: 16, marginTop: 5 },

    historyTitle: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 20, marginTop: 15, marginBottom: 10, color: TEXT_COLOR_DARK },
    historyRecordCard: { backgroundColor: WHITE, marginHorizontal: 15, marginVertical: 8, borderRadius: 8, elevation: 2, shadowColor: '#999', shadowOpacity: 0.1, shadowRadius: 5 },
    historyRecordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
    historyDate: { fontSize: 16, fontWeight: '600', color: TEXT_COLOR_DARK },
    historyStatus: { fontSize: 14, fontWeight: 'bold' },
});

export default TeacherReportView;