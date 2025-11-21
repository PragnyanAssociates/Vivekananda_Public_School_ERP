/**
 * File: src/screens/report/TeacherPerformanceScreen.js
 * Purpose: Analyze teacher performance with marks visible on the main card.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator,
    FlatList, TouchableOpacity, RefreshControl, LayoutAnimation, Platform, UIManager
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

// --- Helper: Generate Years ---
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
    const [expandedId, setExpandedId] = useState(null);

    // Filters
    const [selectedYear, setSelectedYear] = useState(ACADEMIC_YEARS[0]);
    const [sortBy, setSortBy] = useState('high-low');

    // --- Fetch Data ---
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
            setPerformanceData(response.data || []);
            setExpandedId(null);
        } catch (error) {
            console.error('Error fetching performance data:', error);
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

    const toggleExpand = (id) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(expandedId === id ? null : id);
    };

    // --- Logic: Sort & Rank ---
    const processedData = useMemo(() => {
        if (!performanceData || performanceData.length === 0) return [];

        let mappedData = [];

        if (userRole === 'admin') {
            mappedData = performanceData.map((teacher) => {
                return {
                    id: teacher.teacher_id,
                    uniqueKey: `teacher-${teacher.teacher_id}`,
                    name: teacher.teacher_name,
                    // Map the totals from the updated backend response
                    totalManaged: teacher.overall_total || 0,
                    maxPossible: teacher.overall_possible || 0, 
                    percentage: parseFloat(teacher.overall_average) || 0,
                    details: teacher.detailed_performance || [],
                    performanceRank: 0
                };
            });
        } else {
            mappedData = performanceData.map((item, index) => {
                return {
                    id: index,
                    uniqueKey: `class-${index}`,
                    name: item.class_group,
                    subName: item.subject,
                    totalManaged: item.total_marks,
                    maxPossible: item.max_possible_marks,
                    percentage: parseFloat(item.average_marks) || 0,
                    examBreakdown: item.exam_breakdown || [],
                    performanceRank: 0
                };
            });
        }

        mappedData.sort((a, b) => b.percentage - a.percentage);
        mappedData = mappedData.map((item, index) => ({
            ...item,
            performanceRank: index + 1
        }));

        if (sortBy === 'low-high') {
            mappedData.sort((a, b) => a.percentage - b.percentage);
        } else {
            mappedData.sort((a, b) => b.percentage - a.percentage);
        }

        return mappedData;
    }, [performanceData, sortBy, userRole]);

    const getColorForRank = (rank) => {
        if (rank === 1) return '#d32f2f';      // Red
        if (rank === 2) return '#2e7d32';    // Green
        if (rank === 3) return '#1565c0';     // Blue
        return '#795548';    // Brown
    };

    // --- Render Dropdown (Exam Details) ---
    const renderExamBreakdown = (exams) => {
        if (!exams || exams.length === 0) return <Text style={styles.noDataText}>No specific exam data yet.</Text>;

        return (
            <View style={styles.breakdownTable}>
                <View style={styles.breakdownHeader}>
                    <Text style={[styles.bdHeaderCell, { flex: 1.5 }]}>Exam</Text>
                    <Text style={[styles.bdHeaderCell, { flex: 2, textAlign: 'center' }]}>Obtained / Max</Text>
                    <Text style={[styles.bdHeaderCell, { flex: 1.5, textAlign: 'right' }]}>%</Text>
                </View>
                {exams.map((exam, idx) => (
                    <View key={idx} style={styles.breakdownRow}>
                        <Text style={[styles.bdCell, { flex: 1.5, fontWeight: 'bold' }]}>{exam.exam_type}</Text>
                        <Text style={[styles.bdCell, { flex: 2, textAlign: 'center' }]}>
                            {exam.total_obtained} / {exam.total_possible}
                        </Text>
                        <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                            <View style={[
                                styles.miniBadge, 
                                { backgroundColor: parseFloat(exam.percentage) < 50 ? '#e74c3c' : '#27ae60' }
                            ]}>
                                <Text style={styles.miniBadgeText}>{exam.percentage}%</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </View>
        );
    };

    // --- Render Main Card ---
    const renderItem = ({ item }) => {
        const totalItems = processedData.length;
        const itemColor = getColorForRank(item.performanceRank, totalItems);
        const isExpanded = expandedId === item.uniqueKey;

        return (
            <View style={styles.cardContainer}>
                <TouchableOpacity 
                    style={[styles.cardHeader, { borderLeftColor: itemColor }]} 
                    onPress={() => toggleExpand(item.uniqueKey)}
                    activeOpacity={0.9}
                >
                    {/* Rank Badge */}
                    <View style={styles.rankContainer}>
                        <Text style={styles.rankText}>#{item.performanceRank}</Text>
                    </View>

                    {/* Info Section */}
                    <View style={styles.infoContainer}>
                        <Text style={styles.titleText}>{item.name}</Text>
                        {item.subName && <Text style={styles.subSubjectText}>{item.subName}</Text>}
                        
                        {/* --- UPDATED: Marks Display on Main Card --- */}
                        <Text style={styles.subText}>
                            Marks: <Text style={styles.marksValue}>{Math.round(item.totalManaged)} / {Math.round(item.maxPossible)}</Text>
                        </Text>

                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBarFill, { width: `${Math.min(item.percentage, 100)}%`, backgroundColor: itemColor }]} />
                        </View>
                        <Text style={styles.avgText}>Performance: {item.percentage.toFixed(2)}%</Text>
                    </View>

                    {/* Percentage & Chevron */}
                    <View style={styles.rightSide}>
                         <View style={[styles.percentBadge, { borderColor: itemColor }]}>
                            <Text style={[styles.percentText, { color: itemColor }]}>
                                {Math.round(item.percentage)}%
                            </Text>
                        </View>
                        <Icon 
                            name={isExpanded ? "chevron-up" : "chevron-down"} 
                            size={24} 
                            color="#7f8c8d" 
                            style={{ marginTop: 5 }}
                        />
                    </View>
                </TouchableOpacity>

                {/* --- Expanded Section --- */}
                {isExpanded && (
                    <View style={styles.expandedContent}>
                        {userRole === 'admin' ? (
                            item.details && item.details.length > 0 ? (
                                item.details.map((detail, idx) => (
                                    <View key={idx} style={styles.adminDetailBlock}>
                                        <View style={styles.classHeaderRow}>
                                            <Text style={styles.adminClassTitle}>{detail.class_group} - {detail.subject}</Text>
                                            <Text style={styles.adminClassMarks}>
                                                {detail.total_marks} / {detail.max_possible_marks}
                                            </Text>
                                        </View>
                                        {renderExamBreakdown(detail.exam_breakdown)}
                                    </View>
                                ))
                            ) : <Text style={styles.noDataText}>No detailed records found.</Text>
                        ) : (
                            renderExamBreakdown(item.examBreakdown)
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.screenHeader}>
                <Text style={styles.screenTitle}>{userRole === 'admin' ? 'Teacher Performance' : 'Class Performance'}</Text>
                <View style={styles.controlsRow}>
                    <View style={styles.pickerWrapper}>
                        <View style={styles.pickerBox}>
                            <Picker selectedValue={selectedYear} onValueChange={(val) => setSelectedYear(val)} style={styles.picker}>
                                {ACADEMIC_YEARS.map(year => <Picker.Item key={year} label={year} value={year} />)}
                            </Picker>
                        </View>
                    </View>
                    <View style={styles.pickerWrapper}>
                        <View style={styles.pickerBox}>
                            <Picker selectedValue={sortBy} onValueChange={(val) => setSortBy(val)} style={styles.picker}>
                                <Picker.Item label="High to Low" value="high-low" />
                                <Picker.Item label="Low to High" value="low-high" />
                            </Picker>
                        </View>
                    </View>
                </View>
            </View>

            {loading ? (
                <View style={styles.centerContainer}><ActivityIndicator size="large" color="#008080" /></View>
            ) : (
                <FlatList
                    data={processedData}
                    keyExtractor={(item) => item.uniqueKey}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={<Text style={styles.emptyText}>No records found.</Text>}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f2f2f2' },
    screenHeader: { backgroundColor: '#fff', padding: 15, elevation: 2 },
    screenTitle: { fontSize: 20, fontWeight: 'bold', color: '#008080', marginBottom: 10 },
    controlsRow: { flexDirection: 'row', gap: 10 },
    pickerWrapper: { flex: 1 },
    pickerBox: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, height: 45, justifyContent: 'center', backgroundColor: '#fafafa' },
    picker: { width: '100%', color: '#333' },
    listContent: { padding: 15 },
    
    cardContainer: { backgroundColor: '#fff', borderRadius: 10, marginBottom: 12, elevation: 2, overflow: 'hidden' },
    cardHeader: { flexDirection: 'row', padding: 15, alignItems: 'center', borderLeftWidth: 5 },
    rankContainer: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    rankText: { fontWeight: 'bold', color: '#555' },
    infoContainer: { flex: 1 },
    titleText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    subSubjectText: { fontSize: 13, color: '#666' },
    
    subText: { fontSize: 12, color: '#7f8c8d', marginTop: 4 },
    marksValue: { fontWeight: 'bold', color: '#333' }, // Style for the marks numbers

    progressBarContainer: { height: 5, backgroundColor: '#f0f0f0', borderRadius: 3, marginTop: 5, width: '90%' },
    progressBarFill: { height: '100%', borderRadius: 3 },
    avgText: { fontSize: 11, color: '#888', marginTop: 3 },
    rightSide: { alignItems: 'center' },
    percentBadge: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    percentText: { fontSize: 13, fontWeight: 'bold' },

    expandedContent: { backgroundColor: '#f9f9f9', padding: 15, borderTopWidth: 1, borderTopColor: '#eee' },
    adminDetailBlock: { marginBottom: 15 },
    classHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    adminClassTitle: { fontSize: 14, fontWeight: 'bold', color: '#008080' },
    adminClassMarks: { fontSize: 12, fontWeight: '600', color: '#555' },

    breakdownTable: { borderWidth: 1, borderColor: '#eee', borderRadius: 5, backgroundColor: '#fff' },
    breakdownHeader: { flexDirection: 'row', backgroundColor: '#f0f0f0', padding: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
    breakdownRow: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#f9f9f9', alignItems: 'center' },
    bdHeaderCell: { fontSize: 11, fontWeight: 'bold', color: '#666' },
    bdCell: { fontSize: 12, color: '#333' },
    miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    miniBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { textAlign: 'center', marginTop: 30, color: '#999' },
    noDataText: { fontStyle: 'italic', color: '#999', fontSize: 12 },
});

export default TeacherPerformanceScreen;