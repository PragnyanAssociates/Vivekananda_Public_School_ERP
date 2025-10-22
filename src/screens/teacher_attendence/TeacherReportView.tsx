import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform, UIManager, LayoutAnimation, SafeAreaView } from 'react-native';
import apiClient from '../../api/client';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';

// --- Theme Constants (Mirroring your Attendance.tsx) ---
const PRIMARY_COLOR = '#008080';
const TEXT_COLOR_DARK = '#37474F';
const TEXT_COLOR_MEDIUM = '#566573';
const BORDER_COLOR = '#E0E0E0';
const GREEN = '#43A047';
const RED = '#E53935';
const BLUE = '#1E88E5';
const WHITE = '#FFFFFF';

// --- Local Interfaces ---
interface AttendanceRecord {
  date: string; // YYYY-MM-DD
  status: 'P' | 'A' | 'L';
}

interface AttendanceReport {
  stats: {
    overallPercentage: string;
    daysPresent: number;
    daysAbsent: number;
  };
  detailedHistory: AttendanceRecord[];
}
// --- End Local Interfaces ---

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutLayoutAnimationEnabledExperimental(true);
}

// --- Reusable Sub-components ---
const SummaryCard = ({ label, value, color, delay }) => ( 
    <Animatable.View animation="zoomIn" duration={500} delay={delay} style={styles.summaryBox}>
        <Text style={[styles.summaryValue, { color }]}>{value}</Text>
        <Text style={styles.summaryLabel}>{label}</Text>
    </Animatable.View>
);

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

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

// --- Main Component ---
interface TeacherReportViewProps {
    teacherId: string;
    headerTitle: string;
    onBack?: () => void; // Used by Admin view
}

const TeacherReportView: React.FC<TeacherReportViewProps> = ({ teacherId, headerTitle, onBack }) => {
    
    const [report, setReport] = useState<AttendanceReport | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'overall'>('overall');
    const [selectedDate, setSelectedDate] = useState(new Date()); 
    const [showDatePicker, setShowDatePicker] = useState(false);

    const API_BASE_URL = '/teacher-attendance';

    const apiParams = useMemo(() => {
        const params: { period: string; targetDate?: string; targetMonth?: string } = { period: viewMode };
        const dateString = selectedDate.toISOString().slice(0, 10);

        if (viewMode === 'daily') {
            params.targetDate = dateString;
        } else if (viewMode === 'monthly') {
            params.targetMonth = dateString.slice(0, 7); // YYYY-MM
        }
        return params;
    }, [viewMode, selectedDate]);

    const fetchReport = useCallback(async () => {
        if (!teacherId) return;
        setIsLoading(true);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        
        try {
            const response = await apiClient.get<AttendanceReport>(`${API_BASE_URL}/report/${teacherId}`, { params: apiParams });
            setReport(response.data);
        } catch (error: any) {
            console.error("Attendance Report Error:", error);
            Alert.alert("Error", error.response?.data?.message || "Failed to load attendance report.");
            setReport(null);
        } finally {
            setIsLoading(false);
        }
    }, [teacherId, apiParams]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const onDateChange = (event: any, date?: Date) => {
        setShowDatePicker(Platform.OS === 'ios'); 
        if (date) {
            setSelectedDate(date);
            if (viewMode !== 'daily') {
                setViewMode('daily'); 
            }
        }
    };
    
    const summary = report?.stats || { overallPercentage: '0.0', daysPresent: 0, daysAbsent: 0 };

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
                        {(viewMode === 'daily' || viewMode === 'monthly') && (
                            <Text style={styles.headerSubtitleSmall}>
                                {viewMode === 'daily' ? `Showing for: ${selectedDate.toDateString()}` : `Showing for: ${selectedDate.toISOString().slice(0, 7)}`}
                            </Text>
                        )}
                        {viewMode === 'overall' && (
                            <Text style={styles.headerSubtitleSmall}>Overall History</Text>
                        )}
                    </View>
                </View>
            </Animatable.View>

            <View style={styles.toggleContainer}>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'daily' && styles.toggleButtonActive]} onPress={() => setViewMode('daily')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'daily' && styles.toggleButtonTextActive]}>Daily</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'monthly' && styles.toggleButtonActive]} onPress={() => setViewMode('monthly')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'monthly' && styles.toggleButtonTextActive]}>Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'overall' && styles.toggleButtonActive]} onPress={() => setViewMode('overall')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'overall' && styles.toggleButtonTextActive]}>Overall</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.calendarButton} onPress={() => setShowDatePicker(true)}>
                    <Icon name="calendar" size={22} color={PRIMARY_COLOR} />
                </TouchableOpacity>
            </View>

            {showDatePicker && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                />
            )}

            {isLoading ? <ActivityIndicator style={styles.loaderContainer} size="large" color={PRIMARY_COLOR} /> : (
                <>
                    <View style={styles.summaryContainer}>
                        <SummaryCard label="Overall %" value={`${summary.overallPercentage}%`} color={BLUE} delay={100} />
                        <SummaryCard label="Days Present" value={summary.daysPresent || 0} color={GREEN} delay={200} />
                        <SummaryCard label="Days Absent" value={summary.daysAbsent || 0} color={RED} delay={300} />
                    </View>
                    <FlatList
                        data={report?.detailedHistory || []}
                        keyExtractor={(item) => item.date}
                        renderItem={({ item, index }) => <HistoryRecordCard item={item} index={index} />}
                        ListHeaderComponent={<Text style={styles.historyTitle}>Detailed History ({capitalize(viewMode)})</Text>}
                        ListEmptyComponent={<Text style={styles.noDataText}>No records found for this period.</Text>}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        scrollEnabled={false} 
                    />
                </>
            )}
        </SafeAreaView>
    );
};


// --- Styles (Combined from your provided files) ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F4F6F8' },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    noDataText: { textAlign: 'center', marginTop: 20, color: TEXT_COLOR_MEDIUM, fontSize: 16 },
    header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: TEXT_COLOR_DARK, textAlign: 'center' },
    headerSubtitle: { fontSize: 16, color: TEXT_COLOR_MEDIUM, marginTop: 4, textAlign: 'center' },
    headerSubtitleSmall: { fontSize: 14, color: TEXT_COLOR_MEDIUM, marginTop: 2, textAlign: 'center' },
    backButton: { position: 'absolute', left: 15, zIndex: 1, padding: 5 },
    
    summaryContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
    summaryBox: { alignItems: 'center', flex: 1, paddingVertical: 10, paddingHorizontal: 5 },
    summaryValue: { fontSize: 26, fontWeight: 'bold' },
    summaryLabel: { fontSize: 14, color: TEXT_COLOR_MEDIUM, marginTop: 5, fontWeight: '500', textAlign: 'center' },
    
    toggleContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 5, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, alignItems: 'center' },
    toggleButton: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, marginHorizontal: 5, backgroundColor: '#E0E0E0' },
    toggleButtonActive: { backgroundColor: PRIMARY_COLOR },
    toggleButtonText: { color: TEXT_COLOR_DARK, fontWeight: '600' },
    toggleButtonTextActive: { color: WHITE },
    calendarButton: { padding: 8, marginLeft: 10, justifyContent: 'center', alignItems: 'center' },

    historyTitle: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 20, marginTop: 15, marginBottom: 10, color: TEXT_COLOR_DARK },
    historyRecordCard: { backgroundColor: WHITE, marginHorizontal: 15, marginVertical: 8, borderRadius: 8, elevation: 2, shadowColor: '#999', shadowOpacity: 0.1, shadowRadius: 5 },
    historyRecordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
    historyDate: { fontSize: 16, fontWeight: '600', color: TEXT_COLOR_DARK },
    historyStatus: { fontSize: 14, fontWeight: 'bold' },
    statusP: { color: GREEN },
    statusA: { color: RED },
});

export default TeacherReportView;