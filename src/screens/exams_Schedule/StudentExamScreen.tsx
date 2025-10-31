import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

const StudentExamScreen = () => {
    const { user } = useAuth();
    const [schedules, setSchedules] = useState<any[]>([]);
    const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
    const [showList, setShowList] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
            const data = response.data;

            if (Array.isArray(data)) {
                setSchedules(data);
                if (data.length > 0) {
                    setSelectedSchedule(data[0]);
                    setShowList(data.length > 1);
                } else {
                    throw new Error("No exam schedule has been published for your class yet.");
                }
            } else {
                 throw new Error("Received an unexpected data format.");
            }
        } catch (e: any) {
            const errorMessage = e.response?.status === 404
                ? "No exam schedule has been published for your class yet."
                : e.response?.data?.message || "Failed to fetch the exam schedule.";
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchSchedule();
    }, [fetchSchedule]);

    const renderTable = () => {
        if (!selectedSchedule || !selectedSchedule.schedule_data) return null;

        return (
            <View style={styles.table}>
                <View style={styles.tableHeader}>
                    <Text style={[styles.headerCell, styles.dateCol]}>Date</Text>
                    <Text style={[styles.headerCell, styles.subjectCol]}>Subject</Text>
                    <Text style={[styles.headerCell, styles.timeCol]}>Time</Text>
                    <Text style={[styles.headerCell, styles.blockCol]}>Block</Text>
                </View>
                {selectedSchedule.schedule_data.map((row: any, index: number) => {
                    if (row.type === 'special') {
                        return (
                            <View key={index} style={styles.specialRow}>
                                <Text style={styles.specialRowText}>{row.mainText}</Text>
                                {row.subText && <Text style={styles.specialRowSubText}>{row.subText}</Text>}
                            </View>
                        );
                    }
                    const rowStyle = index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd;
                    return (
                        <View key={index} style={[styles.tableRow, rowStyle]}>
                            <Text style={[styles.dataCell, styles.dateCol]}>{row.date}</Text>
                            <Text style={[styles.dataCell, styles.subjectCol]}>{row.subject}</Text>
                            <Text style={[styles.dataCell, styles.timeCol]}>{row.time}</Text>
                            <Text style={[styles.dataCell, styles.blockCol]}>{row.block}</Text>
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderScheduleSelector = () => {
        if (!showList || schedules.length <= 1) return null;

        return (
            <View style={styles.selectorContainer}>
                <Text style={styles.selectorLabel}>Select Schedule:</Text>
                {schedules.map((schedule, index) => (
                    <TouchableOpacity
                        key={schedule.id || index}
                        style={[
                            styles.selectorButton,
                            selectedSchedule?.id === schedule.id && styles.selectorButtonActive
                        ]}
                        onPress={() => setSelectedSchedule(schedule)}
                    >
                        <Text style={[
                            styles.selectorButtonText,
                            selectedSchedule?.id === schedule.id && styles.selectorButtonTextActive
                        ]}>
                            {schedule.title} {schedule.subtitle && `- ${schedule.subtitle}`}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchSchedule} colors={['#FF6347']} />}
        >
            <View style={styles.mainHeader}>
                <MaterialIcons name="event-note" size={30} color="#FF6347" />
                <Text style={styles.mainHeaderText}>Exam Schedule</Text>
            </View>

            {isLoading && !selectedSchedule && <ActivityIndicator size="large" color="#FF6347" style={{ marginTop: 50 }}/>}

            {error && (
                 <View style={styles.errorContainer}>
                    <MaterialIcons name="error-outline" size={24} color="#757575" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {selectedSchedule && (
                <View style={styles.scheduleContainer}>
                    <Text style={styles.scheduleTitle}>{selectedSchedule.title}</Text>
                    {/* ★ NEW: Display Exam Type */}
                    {selectedSchedule.exam_type && (
                        <Text style={styles.examTypeLabel}>{selectedSchedule.exam_type} Exam</Text>
                    )}
                    <Text style={styles.scheduleSubtitle}>{selectedSchedule.subtitle}</Text>
                    {renderScheduleSelector()}
                    {renderTable()}
                </View>
            )}
        </ScrollView>
    );
};

// ★ ADDED NEW STYLE
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f8' },
    scrollContent: { padding: 15, paddingBottom: 40 },
    mainHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    mainHeaderText: { fontSize: 24, fontWeight: 'bold', marginLeft: 10, color: '#263238' },
    errorContainer: { marginTop: 50, alignItems: 'center', padding: 20, backgroundColor: '#fff', borderRadius: 10 },
    errorText: { fontSize: 16, color: '#757575', textAlign: 'center', marginTop: 10 },
    scheduleContainer: { backgroundColor: '#ffffff', borderRadius: 12, padding: 15, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
    scheduleTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#212121' },
    // ★ NEW: Style for the exam type badge
    examTypeLabel: { textAlign: 'center', color: '#FF6347', fontSize: 14, fontWeight: 'bold', marginTop: 4, backgroundColor: '#ffebee', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 15, alignSelf: 'center' },
    scheduleSubtitle: { fontSize: 16, color: '#757575', textAlign: 'center', marginBottom: 20, marginTop: 4 },
    selectorContainer: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#e0e0e0', paddingBottom: 15 },
    selectorLabel: { fontSize: 16, fontWeight: 'bold', color: '#455a64', marginBottom: 10 },
    selectorButton: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e0e0e0' },
    selectorButtonActive: { backgroundColor: '#fff0eb', borderColor: '#FF6347' },
    selectorButtonText: { fontSize: 14, color: '#666', textAlign: 'center' },
    selectorButtonTextActive: { color: '#FF6347', fontWeight: 'bold' },
    table: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f7f9fc', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
    headerCell: { paddingVertical: 14, paddingHorizontal: 6, fontWeight: 'bold', textAlign: 'center', color: '#455a64', fontSize: 14 },
    tableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
    tableRowEven: { backgroundColor: '#ffffff' },
    tableRowOdd: { backgroundColor: '#f7f9fc' },
    dataCell: { paddingVertical: 16, paddingHorizontal: 6, textAlign: 'center', color: '#37474f', fontSize: 14 },
    dateCol: { flex: 2.5 },
    subjectCol: { flex: 3 },
    timeCol: { flex: 2 },
    blockCol: { flex: 1 },
    specialRow: { padding: 20, backgroundColor: '#e3f2fd', justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
    specialRowText: { fontWeight: 'bold', fontSize: 15, color: '#1e88e5' },
    specialRowSubText: { fontSize: 13, color: '#64b5f6', fontStyle: 'italic', marginTop: 4 },
});

export default StudentExamScreen;