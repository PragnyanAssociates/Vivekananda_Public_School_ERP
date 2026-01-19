import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

// ★ Reusable Schedule Card component for the list
const ScheduleCard = ({ item }: { item: any }) => {
    const isExternal = item.exam_type === 'External';

    return (
        <View style={styles.scheduleContainer}>
            <Text style={styles.scheduleTitle}>{item.title}</Text>
            {item.exam_type && (
                <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{isExternal ? 'Govt Schedule' : 'School Exam'}</Text>
                </View>
            )}
            <Text style={styles.scheduleSubtitle}>{item.subtitle}</Text>
            <View style={styles.table}>
                <View style={styles.tableRow}>
                    {isExternal ? (
                        /* --- EXTERNAL (GOVT) HEADER --- */
                        <>
                            <View style={[styles.tableCell, styles.headerCell, { flex: 3 }]}>
                                <Text style={styles.headerCellText}>Exam Name</Text>
                            </View>
                            <View style={[styles.tableCell, styles.headerCell, { flex: 1.5 }]}>
                                <Text style={styles.headerCellText}>Class</Text>
                            </View>
                            <View style={[styles.tableCell, styles.headerCell, { flex: 2.5 }]}>
                                <Text style={styles.headerCellText}>From Date</Text>
                            </View>
                            <View style={[styles.tableCell, styles.headerCell, { flex: 2.5, borderRightWidth: 0 }]}>
                                <Text style={styles.headerCellText}>To Date</Text>
                            </View>
                        </>
                    ) : (
                        /* --- INTERNAL (SCHOOL) HEADER --- */
                        <>
                            <View style={[styles.tableCell, styles.headerCell, { flex: 2.5 }]}>
                                <Text style={styles.headerCellText}>Date</Text>
                            </View>
                            <View style={[styles.tableCell, styles.headerCell, { flex: 3 }]}>
                                <Text style={styles.headerCellText}>Subject</Text>
                            </View>
                            <View style={[styles.tableCell, styles.headerCell, { flex: 3.5 }]}>
                                <Text style={styles.headerCellText}>Time</Text>
                            </View>
                            <View style={[styles.tableCell, styles.headerCell, { flex: 1.5, borderRightWidth: 0 }]}>
                                <Text style={styles.headerCellText}>Block</Text>
                            </View>
                        </>
                    )}
                </View>
                
                {item.schedule_data.map((row: any, index: number) => {
                     if (row.type === 'special') {
                        return (
                            <View key={index} style={styles.specialRow}>
                                <Text style={styles.specialRowText}>{row.mainText}</Text>
                                {row.subText && <Text style={styles.specialRowSubText}>{row.subText}</Text>}
                            </View>
                        );
                    }
                    const isLastRow = index === item.schedule_data.length - 1;
                    
                    if (isExternal) {
                         return (
                            <View key={index} style={[styles.tableRow, isLastRow && { borderBottomWidth: 0 }]}>
                                <View style={[styles.tableCell, { flex: 3 }]}>
                                    <Text style={[styles.dataCellText, {fontWeight: 'bold'}]}>{row.examName || '-'}</Text>
                                </View>
                                <View style={[styles.tableCell, { flex: 1.5 }]}>
                                    <Text style={styles.dataCellText}>{item.class_group}</Text>
                                </View>
                                <View style={[styles.tableCell, { flex: 2.5 }]}>
                                    <Text style={styles.dataCellText}>{row.fromDate || '—'}</Text>
                                </View>
                                <View style={[styles.tableCell, { flex: 2.5, borderRightWidth: 0 }]}>
                                    <Text style={styles.dataCellText}>{row.toDate || '—'}</Text>
                                </View>
                            </View>
                        );
                    } else {
                        return (
                            <View key={index} style={[styles.tableRow, isLastRow && { borderBottomWidth: 0 }]}>
                                <View style={[styles.tableCell, { flex: 2.5 }]}><Text style={styles.dataCellText}>{row.date}</Text></View>
                                <View style={[styles.tableCell, { flex: 3 }]}><Text style={styles.dataCellText}>{row.subject}</Text></View>
                                <View style={[styles.tableCell, { flex: 3.5 }]}><Text style={styles.dataCellText}>{row.time}</Text></View>
                                <View style={[styles.tableCell, { flex: 1.5, borderRightWidth: 0 }]}><Text style={styles.dataCellText}>{row.block}</Text></View>
                            </View>
                        );
                    }
                })}
            </View>
        </View>
    );
};

const StudentExamScreen = () => {
    const { user } = useAuth();
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

    // Filter schedules based on the active tab
    const filteredSchedules = schedules.filter(
        schedule => schedule.exam_type === activeTab
    );

    return (
        <View style={styles.container}>
            {/* --- Header Card --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerContentWrapper}>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="event" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>My Exams</Text>
                        <Text style={styles.headerSubtitle}>View upcoming exams</Text>
                    </View>
                </View>
            </View>

            {/* --- UPDATED TABS --- */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'Internal' && styles.tabButtonActive]}
                    onPress={() => setActiveTab('Internal')}
                >
                    <Text style={[styles.tabText, activeTab === 'Internal' && styles.tabTextActive]}>Exams</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'External' && styles.tabButtonActive]}
                    onPress={() => setActiveTab('External')}
                >
                    <Text style={[styles.tabText, activeTab === 'External' && styles.tabTextActive]}>Govt Schedule</Text>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <ActivityIndicator size="large" color="#FF6347" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={filteredSchedules}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => <ScheduleCard item={item} />}
                    ListEmptyComponent={
                        <View style={styles.errorContainer}>
                            <MaterialIcons name="error-outline" size={24} color="#757575" />
                            <Text style={styles.errorText}>
                                {error ? error : `No ${activeTab === 'Internal' ? 'exams' : 'govt schedules'} published yet.`}
                            </Text>
                        </View>
                    }
                    refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchSchedule} colors={['#FF6347']} />}
                    contentContainerStyle={styles.listContentContainer}
                />
            )}
        </View>
    );
};

// Styles for Student Screen
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F5F8' }, // Matching background
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 15,
        paddingVertical: 10,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerContentWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    headerIconContainer: {
        backgroundColor: '#E0F2F1', // Teal bg
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: {
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333333',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666666',
        marginTop: 1,
    },
    // ----------------------------

    tabContainer: { flexDirection: 'row', paddingHorizontal: 15, paddingTop: 15, backgroundColor: '#F2F5F8' },
    tabButton: { flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', alignItems: 'center' },
    tabButtonActive: { borderBottomColor: '#47ffe0ff' },
    tabText: { fontSize: 16, color: '#546e7a', fontWeight: '500' },
    tabTextActive: { color: '#4e2eceff', fontWeight: 'bold' },
    
    listContentContainer: { paddingBottom: 20 },
    errorContainer: { marginTop: 50, alignItems: 'center', padding: 20, marginHorizontal: 15 },
    errorText: { fontSize: 16, color: '#757575', textAlign: 'center', marginTop: 10 },
    scheduleContainer: { backgroundColor: '#ffffff', borderRadius: 24, marginHorizontal: 15, marginVertical: 10, padding: 20, elevation: 4, shadowColor: '#999', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }},
    scheduleTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#111', marginBottom: 8 },
    badgeContainer: { alignSelf: 'center', backgroundColor: '#FEF1F2', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 16, marginBottom: 8 },
    badgeText: { color: '#E53E3E', fontSize: 12, fontWeight: 'bold' },
    scheduleSubtitle: { fontSize: 15, color: '#6c757d', textAlign: 'center', marginBottom: 20 },
    table: { backgroundColor: '#f8f9fa', borderRadius: 16, borderWidth: 1, borderColor: '#e9ecef', overflow: 'hidden' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e9ecef' },
    tableCell: { paddingVertical: 14, paddingHorizontal: 10, borderRightWidth: 1, borderRightColor: '#e9ecef', justifyContent: 'center' },
    headerCell: { backgroundColor: '#f8f9fa' },
    headerCellText: { color: '#6c757d', fontSize: 13, fontWeight: '500', textAlign: 'left' },
    dataCellText: { color: '#212121', fontSize: 13, textAlign: 'left' },
    specialRow: { padding: 20, backgroundColor: '#e3f2fd', justifyContent: 'center', alignItems: 'center', margin: 10, borderRadius: 16 },
    specialRowText: { fontWeight: 'bold', fontSize: 15, color: '#1e88e5' },
    specialRowSubText: { fontSize: 13, color: '#64b5f6', fontStyle: 'italic', marginTop: 4 },
});

export default StudentExamScreen;