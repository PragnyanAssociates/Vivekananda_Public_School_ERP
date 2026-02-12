import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator, FlatList, RefreshControl,
    TouchableOpacity, useColorScheme, SafeAreaView, StatusBar, Dimensions
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#E0E0E0',
    inputBg: '#FAFAFA',
    iconGrey: '#90A4AE',
    danger: '#E53935',
    success: '#43A047',
    blue: '#1E88E5',
    warning: '#F59E0B',
    headerIconBg: '#E0F2F1',
    tableHeaderBg: '#F8F9FA',
    specialRowBg: '#E3F2FD',
    specialRowText: '#1565C0'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    iconGrey: '#757575',
    danger: '#EF5350',
    success: '#66BB6A',
    blue: '#42A5F5',
    warning: '#FFCA28',
    headerIconBg: '#333333',
    tableHeaderBg: '#252525',
    specialRowBg: '#1A2733',
    specialRowText: '#64B5F6'
};

// --- Reusable Schedule Card Component ---
const ScheduleCard = ({ item, theme }: { item: any, theme: any }) => {
    const isExternal = item.exam_type === 'External';

    return (
        <View style={[styles.scheduleContainer, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
            <Text style={[styles.scheduleTitle, { color: theme.textMain }]}>{item.title}</Text>
            
            {item.exam_type && (
                <View style={[styles.badgeContainer, { backgroundColor: theme.headerIconBg }]}>
                    <Text style={[styles.badgeText, { color: theme.primary }]}>
                        {isExternal ? 'Govt Schedule' : 'School Exam'}
                    </Text>
                </View>
            )}

            {item.subtitle ? (
                <Text style={[styles.scheduleSubtitle, { color: theme.textSub }]}>{item.subtitle}</Text>
            ) : (
                <View style={{ marginBottom: 5 }} />
            )}

            <View style={[styles.table, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
                {/* Table Header */}
                <View style={[styles.tableRow, { backgroundColor: theme.tableHeaderBg, borderBottomColor: theme.border }]}>
                    {isExternal ? (
                        <>
                            <View style={[styles.tableCell, { flex: 2.2, borderRightColor: theme.border }]}><Text style={[styles.headerCellText, { color: theme.textSub }]}>Exam Name</Text></View>
                            <View style={[styles.tableCell, { flex: 1.2, borderRightColor: theme.border }]}><Text style={[styles.headerCellText, { color: theme.textSub }]}>Class</Text></View>
                            <View style={[styles.tableCell, { flex: 3.3, borderRightColor: theme.border }]}><Text style={[styles.headerCellText, { color: theme.textSub, textAlign: 'center' }]}>From Date</Text></View>
                            <View style={[styles.tableCell, { flex: 3.3, borderRightWidth: 0 }]}><Text style={[styles.headerCellText, { color: theme.textSub, textAlign: 'center' }]}>To Date</Text></View>
                        </>
                    ) : (
                        <>
                            <View style={[styles.tableCell, { flex: 2.5, borderRightColor: theme.border }]}><Text style={[styles.headerCellText, { color: theme.textSub }]}>Date</Text></View>
                            <View style={[styles.tableCell, { flex: 3, borderRightColor: theme.border }]}><Text style={[styles.headerCellText, { color: theme.textSub }]}>Subject</Text></View>
                            <View style={[styles.tableCell, { flex: 3.5, borderRightColor: theme.border }]}><Text style={[styles.headerCellText, { color: theme.textSub }]}>Time</Text></View>
                            <View style={[styles.tableCell, { flex: 1.5, borderRightWidth: 0 }]}><Text style={[styles.headerCellText, { color: theme.textSub }]}>Block</Text></View>
                        </>
                    )}
                </View>
                
                {/* Table Rows */}
                {item.schedule_data.map((row: any, index: number) => {
                     if (row.type === 'special') {
                        return (
                            <View key={index} style={[styles.specialRow, { backgroundColor: theme.specialRowBg }]}>
                                <Text style={[styles.specialRowText, { color: theme.specialRowText }]}>{row.mainText}</Text>
                                {row.subText && <Text style={[styles.specialRowSubText, { color: theme.textSub }]}>{row.subText}</Text>}
                            </View>
                        );
                    }
                    const isLastRow = index === item.schedule_data.length - 1;
                    
                    if (isExternal) {
                         return (
                            <View key={index} style={[styles.tableRow, isLastRow && { borderBottomWidth: 0 }, { borderBottomColor: theme.border }]}>
                                <View style={[styles.tableCell, { flex: 2.2, borderRightColor: theme.border }]}>
                                    <Text style={[styles.dataCellText, {fontWeight: 'bold', color: theme.textMain}]}>{row.examName || '-'}</Text>
                                </View>
                                <View style={[styles.tableCell, { flex: 1.2, borderRightColor: theme.border }]}>
                                    <Text style={[styles.dataCellText, { color: theme.textMain }]}>{item.class_group}</Text>
                                </View>
                                <View style={[styles.tableCell, { flex: 3.3, borderRightColor: theme.border }]}>
                                    <Text style={[styles.dataCellText, { textAlign: 'center', color: theme.textMain }]} numberOfLines={1} adjustsFontSizeToFit>{row.fromDate || '—'}</Text>
                                </View>
                                <View style={[styles.tableCell, { flex: 3.3, borderRightWidth: 0 }]}>
                                    <Text style={[styles.dataCellText, { textAlign: 'center', color: theme.textMain }]} numberOfLines={1} adjustsFontSizeToFit>{row.toDate || '—'}</Text>
                                </View>
                            </View>
                        );
                    } else {
                        return (
                            <View key={index} style={[styles.tableRow, isLastRow && { borderBottomWidth: 0 }, { borderBottomColor: theme.border }]}>
                                <View style={[styles.tableCell, { flex: 2.5, borderRightColor: theme.border }]}><Text style={[styles.dataCellText, { color: theme.textMain }]}>{row.date}</Text></View>
                                <View style={[styles.tableCell, { flex: 3, borderRightColor: theme.border }]}><Text style={[styles.dataCellText, { color: theme.textMain }]}>{row.subject}</Text></View>
                                <View style={[styles.tableCell, { flex: 3.5, borderRightColor: theme.border }]}><Text style={[styles.dataCellText, { color: theme.textMain }]}>{row.time}</Text></View>
                                <View style={[styles.tableCell, { flex: 1.5, borderRightWidth: 0 }]}><Text style={[styles.dataCellText, { color: theme.textMain }]}>{row.block}</Text></View>
                            </View>
                        );
                    }
                })}
            </View>
        </View>
    );
};

// --- Main Student Screen ---
const StudentExamScreen = () => {
    const { user } = useAuth();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const [schedules, setSchedules] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('Internal'); 

    const fetchSchedule = useCallback(async () => {
        if (!user || !user.class_group) {
            setError("You are not assigned to a class.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiClient.get(`/exam-schedules/class/${user.class_group}`);
            setSchedules(response.data || []);
        } catch (e: any) {
            const errorMessage = e.response?.status === 404
                ? "No exam schedule has been published for your class yet."
                : e.response?.data?.message || "Failed to fetch exam schedules.";
            setError(errorMessage);
            setSchedules([]); 
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchSchedule();
    }, [fetchSchedule]);

    const filteredSchedules = schedules.filter(
        schedule => schedule.exam_type === activeTab
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

            {/* Header */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerContentWrapper}>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.headerIconBg }]}>
                        <MaterialIcons name="event" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>My Exams</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>View upcoming exams</Text>
                    </View>
                </View>
            </View>

            {/* Tabs */}
            <View style={[styles.tabContainer, { backgroundColor: theme.background }]}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'Internal' && { borderBottomColor: theme.primary }]}
                    onPress={() => setActiveTab('Internal')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'Internal' ? theme.primary : theme.textSub }]}>Exams</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'External' && { borderBottomColor: theme.primary }]}
                    onPress={() => setActiveTab('External')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'External' ? theme.primary : theme.textSub }]}>Govt Schedule</Text>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={filteredSchedules}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => <ScheduleCard item={item} theme={theme} />}
                    ListEmptyComponent={
                        <View style={styles.errorContainer}>
                            <MaterialIcons name="error-outline" size={24} color={theme.iconGrey} />
                            <Text style={[styles.errorText, { color: theme.textSub }]}>
                                {error ? error : `No ${activeTab === 'Internal' ? 'exams' : 'govt schedules'} published yet.`}
                            </Text>
                        </View>
                    }
                    refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchSchedule} colors={[theme.primary]} tintColor={theme.primary} />}
                    contentContainerStyle={styles.listContentContainer}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    
    // Header
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
        elevation: 3,
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerContentWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13, marginTop: 1 },

    // Tabs
    tabContainer: { flexDirection: 'row', paddingHorizontal: 15, paddingTop: 5, marginBottom: 10 },
    tabButton: { flex: 1, paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent', alignItems: 'center' },
    tabText: { fontSize: 16, fontWeight: '600' },
    
    // List
    listContentContainer: { paddingBottom: 20 },
    errorContainer: { marginTop: 50, alignItems: 'center', padding: 20, marginHorizontal: 15 },
    errorText: { fontSize: 16, textAlign: 'center', marginTop: 10 },

    // Card
    scheduleContainer: {
        borderRadius: 12,
        marginHorizontal: 15,
        marginVertical: 10,
        padding: 20,
        elevation: 3,
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 }
    },
    scheduleTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    badgeContainer: { alignSelf: 'center', borderRadius: 16, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 8 },
    badgeText: { fontSize: 13, fontWeight: 'bold' },
    scheduleSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 12 },

    // Table
    table: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, alignItems: 'center', minHeight: 45 },
    tableCell: { paddingVertical: 12, paddingHorizontal: 4, borderRightWidth: 1, justifyContent: 'center', alignItems: 'center' },
    headerCellText: { fontSize: 12, fontWeight: 'bold', textAlign: 'left' },
    dataCellText: { fontSize: 12, textAlign: 'left' },
    
    specialRow: { padding: 15, justifyContent: 'center', alignItems: 'center', margin: 10, borderRadius: 8 },
    specialRowText: { fontWeight: 'bold', fontSize: 14 },
    specialRowSubText: { fontSize: 12, fontStyle: 'italic', marginTop: 4 },
});

export default StudentExamScreen;