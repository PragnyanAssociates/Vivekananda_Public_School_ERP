import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, RefreshControl, FlatList
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// Helper to generate academic years
const generateAcademicYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 5; i++) {
        const startYear = currentYear - i;
        years.push(`${startYear}-${startYear + 1}`);
    }
    return years;
};

const ACADEMIC_YEARS = generateAcademicYears();

const TeacherPerformanceScreen = () => {
    const { user } = useAuth();
    const userRole = user?.role || 'teacher';
    const userId = user?.id;

    const [performanceData, setPerformanceData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedYear, setSelectedYear] = useState(ACADEMIC_YEARS[0]);

    const fetchData = async () => {
        if (!userId || !selectedYear) return;
        setLoading(true);
        try {
            let response;
            if (userRole === 'admin') {
                response = await apiClient.get(`/performance/admin/all-teachers/${selectedYear}`);
            } else {
                response = await apiClient.get(`/performance/teacher/${userId}/${selectedYear}`);
            }
            setPerformanceData(response.data);
        } catch (error) {
            console.error('Error fetching performance data:', error);
            // Alert.alert('Error', 'Failed to load performance data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedYear, userId]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const renderAdminView = () => (
        <FlatList
            data={performanceData}
            keyExtractor={item => item.teacher_id.toString()}
            renderItem={({ item }) => (
                <View style={styles.teacherCard}>
                    <View style={styles.teacherHeader}>
                        <Text style={styles.teacherName}>{item.teacher_name}</Text>
                         <View style={styles.teacherStatsContainer}>
                            <Text style={styles.overallStat}>
                                Total: <Text style={styles.overallValue}>{item.overall_total}</Text>
                            </Text>
                            <Text style={styles.overallStat}>
                                Avg: <Text style={styles.overallValue}>{item.overall_average}%</Text>
                            </Text>
                        </View>
                    </View>

                    {item.detailed_performance.length > 0 ? (
                        <>
                            <View style={styles.detailHeaderRow}>
                                <Text style={[styles.detailHeaderText, styles.detailClassSubject]}>Class / Subject</Text>
                                <Text style={[styles.detailHeaderText, styles.detailTotal]}>Total Marks</Text>
                                <Text style={[styles.detailHeaderText, styles.detailAverage]}>Average</Text>
                            </View>
                            {item.detailed_performance.map((detail, index) => (
                                <View key={index} style={styles.detailRow}>
                                    <Text style={styles.detailClassSubject}>{`${detail.class_group} - ${detail.subject}`}</Text>
                                    <Text style={styles.detailTotal}>{detail.total_marks}</Text>
                                    <Text style={styles.detailAverage}>{parseFloat(detail.average_marks).toFixed(2)}%</Text>
                                </View>
                            ))}
                        </>
                    ) : (
                        <View style={styles.detailRow}>
                            <Text style={styles.noDataText}>No performance data available for this year.</Text>
                        </View>
                    )}
                </View>
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={{ paddingBottom: 20 }}
        />
    );

    const renderTeacherView = () => (
        <FlatList
            data={performanceData}
            keyExtractor={(item, index) => `${item.class_group}-${item.subject}-${index}`}
            ListHeaderComponent={() => (
                <View style={[styles.tableRow, styles.headerRow]}>
                    <Text style={[styles.headerText, { flex: 2.5 }]}>Class Group</Text>
                    <Text style={[styles.headerText, { flex: 2.5 }]}>Subject</Text>
                    <Text style={[styles.headerText, { flex: 2, textAlign: 'right' }]}>Total Marks</Text>
                    <Text style={[styles.headerText, { flex: 2, textAlign: 'right' }]}>Average</Text>
                </View>
            )}
            renderItem={({ item }) => (
                <View style={styles.tableRow}>
                    <Text style={[styles.cellText, { flex: 2.5 }]}>{item.class_group}</Text>
                    <Text style={[styles.cellText, { flex: 2.5 }]}>{item.subject}</Text>
                    <Text style={[styles.cellText, { flex: 2, textAlign: 'right' }]}>{item.total_marks}</Text>
                    <Text style={[styles.cellText, { flex: 2, textAlign: 'right', fontWeight: 'bold' }]}>
                        {parseFloat(item.average_marks).toFixed(2)}%
                    </Text>
                </View>
            )}
            ListEmptyComponent={() => (
                <View style={styles.noDataContainer}>
                    <Text style={styles.noDataText}>No performance data found for the selected year.</Text>
                </View>
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Teacher Performance</Text>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={selectedYear}
                        onValueChange={(itemValue) => setSelectedYear(itemValue)}
                    >
                        {ACADEMIC_YEARS.map(year => (
                            <Picker.Item key={year} label={`Year: ${year}`} value={year} />
                        ))}
                    </Picker>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#007bff" style={{ marginTop: 50 }} />
            ) : userRole === 'admin' ? (
                renderAdminView()
            ) : (
                renderTeacherView()
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f6f8',
    },
    header: {
        backgroundColor: '#ffffff',
        paddingHorizontal: 15,
        paddingTop: 15,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#dfe4ea',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 15,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#ced4da',
        borderRadius: 8,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
    },
    // Admin View Styles
    teacherCard: {
        backgroundColor: '#fff',
        marginHorizontal: 15,
        marginTop: 15,
        borderRadius: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        overflow: 'hidden',
    },
    teacherHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#34495e',
    },
    teacherName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#ffffff',
        flexShrink: 1,
    },
    teacherStatsContainer: {
       alignItems: 'flex-end',
    },
    overallStat: {
        fontSize: 14,
        color: '#ecf0f1',
    },
    overallValue: {
        fontWeight: 'bold',
        color: '#2ecc71',
    },
    detailHeaderRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 15,
        backgroundColor: '#ecf0f1',
        borderBottomWidth: 1,
        borderBottomColor: '#dfe4ea',
    },
    detailHeaderText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#34495e',
    },
    detailRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f2f5',
    },
    detailClassSubject: {
        flex: 3,
        fontSize: 15,
        color: '#34495e',
    },
    detailTotal: {
        flex: 2,
        fontSize: 15,
        color: '#2c3e50',
        textAlign: 'right',
    },
    detailAverage: {
        flex: 2,
        fontSize: 15,
        fontWeight: 'bold',
        color: '#2c3e50',
        textAlign: 'right',
    },
    // Teacher View & Shared Styles
    tableRow: {
        flexDirection: 'row',
        padding: 15,
        marginHorizontal: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#dfe4ea',
        alignItems: 'center',
    },
    headerRow: {
        backgroundColor: '#e9ecef',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        marginTop: 15,
        borderBottomWidth: 2,
        borderBottomColor: '#d1d8e0',
    },
    headerText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#495057',
    },
    cellText: {
        fontSize: 15,
        color: '#2c3e50',
    },
    noDataContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 50,
    },
    noDataText: {
        fontSize: 16,
        color: '#7f8c8d',
        textAlign: 'center',
        padding: 20,
    },
});

export default TeacherPerformanceScreen;