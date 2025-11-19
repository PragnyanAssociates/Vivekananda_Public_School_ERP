/**
 * File: src/screens/report/TeacherPerformanceScreen.js
 * Purpose: Analyze teacher performance with accurate percentage calculations
 * derived from backend, consistent rank-based coloring, and detailed breakdowns.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator,
    FlatList, Alert, RefreshControl
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

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
    
    // Filters
    const [selectedYear, setSelectedYear] = useState(ACADEMIC_YEARS[0]);
    const [sortBy, setSortBy] = useState('high-low'); // 'high-low', 'low-high'

    // --- Fetch Data ---
    const fetchData = async () => {
        if (!userId || !selectedYear) return;
        setLoading(true);
        try {
            let response;
            // The backend now returns accurate weighted percentages
            if (userRole === 'admin') {
                response = await apiClient.get(`/performance/admin/all-teachers/${selectedYear}`);
            } else {
                response = await apiClient.get(`/performance/teacher/${userId}/${selectedYear}`);
            }
            setPerformanceData(response.data || []);
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

    // --- Logic: Sort & Rank ---
    const processedData = useMemo(() => {
        if (!performanceData || performanceData.length === 0) return [];

        let mappedData = [];

        if (userRole === 'admin') {
            // Admin View: List of Teachers
            mappedData = performanceData.map((teacher) => {
                // The backend already calculates the weighted overall average
                const percentage = parseFloat(teacher.overall_average) || 0;
                const totalObtained = teacher.overall_total || 0;

                return {
                    id: teacher.teacher_id,
                    name: teacher.teacher_name,
                    totalManaged: totalObtained,
                    percentage: percentage,
                    details: teacher.detailed_performance || [],
                    performanceRank: 0 // Placeholder
                };
            });
        } else {
            // Teacher View: List of Classes
            // Treat each class as an item to be ranked
            mappedData = performanceData.map((item, index) => {
                // Backend sends 'average_marks' which is now the correct percentage
                const percentage = parseFloat(item.average_marks) || 0;
                return {
                    id: index,
                    name: `${item.class_group}`,
                    subName: item.subject,
                    totalManaged: item.total_marks,
                    maxPossible: item.max_possible_marks, // Use this if you want to show "280/300"
                    percentage: percentage,
                    details: [], 
                    performanceRank: 0
                };
            });
        }

        // 1. Assign Ranks based on Percentage (High to Low always for Ranking)
        mappedData.sort((a, b) => b.percentage - a.percentage);
        mappedData = mappedData.map((item, index) => ({
            ...item,
            performanceRank: index + 1
        }));

        // 2. Apply Display Sort
        if (sortBy === 'low-high') {
            mappedData.sort((a, b) => a.percentage - b.percentage);
        } else {
            // Default High-Low
            mappedData.sort((a, b) => b.percentage - a.percentage);
        }

        return mappedData;
    }, [performanceData, sortBy, userRole]);


    // --- Helper: Get Color based on Rank ---
    const getColorForRank = (rank, totalItems) => {
        const RED = '#d32f2f';      // Rank 1
        const GREEN = '#2e7d32';    // Rank 2
        const BLUE = '#1565c0';     // Rank 3
        const BLACK = '#000000';    // Bottom 3
        const BROWN = '#795548';    // Others

        if (rank === 1) return RED;
        if (rank === 2) return GREEN;
        if (rank === 3) return BLUE;
        
        // If rank is one of the last 3 (and there are at least 3 items)
        if (rank > totalItems - 3 && totalItems >= 3) return BLACK;

        return BROWN;
    };

    // --- Render Item ---
    const renderItem = ({ item }) => {
        const totalItems = processedData.length;
        const itemColor = getColorForRank(item.performanceRank, totalItems);

        return (
            <View style={styles.cardContainer}>
                {/* MAIN CARD HEADER */}
                <View style={[styles.cardHeader, { borderLeftColor: itemColor }]}>
                    {/* Rank Badge */}
                    <View style={styles.rankContainer}>
                        <Text style={styles.rankText}>#{item.performanceRank}</Text>
                    </View>

                    {/* Info Section */}
                    <View style={styles.infoContainer}>
                        <Text style={styles.titleText}>{item.name}</Text>
                        {item.subName && <Text style={styles.subSubjectText}>{item.subName}</Text>}
                        
                        <View style={styles.statsRow}>
                            <Text style={styles.subText}>
                                Marks: <Text style={{ color: '#2c3e50', fontWeight: '600' }}>
                                    {Math.round(item.totalManaged)} 
                                    {/* Optional: Show Denominator for Teacher View */}
                                    {userRole !== 'admin' && item.maxPossible ? ` / ${item.maxPossible}` : ''}
                                </Text>
                            </Text>
                        </View>
                        
                        <View style={styles.progressBarContainer}>
                            <View 
                                style={[
                                    styles.progressBarFill, 
                                    { width: `${Math.min(item.percentage, 100)}%`, backgroundColor: itemColor }
                                ]} 
                            />
                        </View>
                        <Text style={styles.avgText}>
                           Performance: {item.percentage.toFixed(2)}%
                        </Text>
                    </View>

                    {/* Percentage Circle */}
                    <View style={[styles.percentBadge, { borderColor: itemColor }]}>
                        <Text style={[styles.percentText, { color: itemColor }]}>
                            {Math.round(item.percentage)}%
                        </Text>
                    </View>
                </View>

                {/* DETAILED CLASS BREAKDOWN (Admin Only) */}
                {userRole === 'admin' && item.details && item.details.length > 0 && (
                    <View style={styles.detailsContainer}>
                        <View style={styles.detailHeaderRow}>
                            <Text style={[styles.detailHeaderLabel, { flex: 3 }]}>Class / Subject</Text>
                            <Text style={[styles.detailHeaderLabel, { flex: 2, textAlign: 'center' }]}>Score</Text>
                            <Text style={[styles.detailHeaderLabel, { flex: 2, textAlign: 'right' }]}>Perf %</Text>
                        </View>
                        
                        {item.details.map((detail, idx) => (
                            <View key={idx} style={styles.detailRow}>
                                <Text style={[styles.detailText, { flex: 3, color: '#546E7A' }]}>
                                    {detail.class_group} - {detail.subject}
                                </Text>
                                <Text style={[styles.detailText, { flex: 2, textAlign: 'center' }]}>
                                    {/* Show Obtained / Max */}
                                    {detail.total_marks}/{detail.max_possible_marks}
                                </Text>
                                <Text style={[styles.detailText, { flex: 2, textAlign: 'right', fontWeight: 'bold', color: '#2c3e50' }]}>
                                    {parseFloat(detail.average_marks).toFixed(2)}%
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Screen Header */}
            <View style={styles.screenHeader}>
                <Text style={styles.screenTitle}>
                    {userRole === 'admin' ? 'Teacher Performance' : 'My Class Performance'}
                </Text>
                
                <View style={styles.controlsRow}>
                    {/* Year Selector */}
                    <View style={styles.pickerWrapper}>
                        <Text style={styles.pickerLabel}>Academic Year</Text>
                        <View style={styles.pickerBox}>
                            <Picker
                                selectedValue={selectedYear}
                                onValueChange={(val) => setSelectedYear(val)}
                                style={styles.picker}
                                dropdownIconColor="#34495e"
                            >
                                {ACADEMIC_YEARS.map(year => (
                                    <Picker.Item key={year} label={year} value={year} />
                                ))}
                            </Picker>
                        </View>
                    </View>

                    {/* Sort Selector */}
                    <View style={styles.pickerWrapper}>
                        <Text style={styles.pickerLabel}>Sort By</Text>
                        <View style={styles.pickerBox}>
                            <Picker
                                selectedValue={sortBy}
                                onValueChange={(val) => setSortBy(val)}
                                style={styles.picker}
                                dropdownIconColor="#34495e"
                            >
                                <Picker.Item label="High to Low" value="high-low" />
                                <Picker.Item label="Low to High" value="low-high" />
                            </Picker>
                        </View>
                    </View>
                </View>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#008080" />
                    <Text style={styles.loadingText}>Calculating Performance...</Text>
                </View>
            ) : (
                <FlatList
                    data={processedData}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.centerContainer}>
                            <Icon name="chart-bar-stacked" size={50} color="#bdc3c7" />
                            <Text style={styles.emptyText}>No performance records found.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5',
    },
    screenHeader: {
        backgroundColor: '#fff',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    screenTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#008080',
        marginBottom: 15,
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    pickerWrapper: {
        flex: 1,
    },
    pickerLabel: {
        fontSize: 12,
        color: '#7f8c8d',
        marginBottom: 4,
        fontWeight: '600',
    },
    pickerBox: {
        borderWidth: 1,
        borderColor: '#bdc3c7',
        borderRadius: 8,
        backgroundColor: '#f8f9fa',
        height: 45,
        justifyContent: 'center',
    },
    picker: {
        width: '100%',
        color: '#2c3e50',
    },
    listContent: {
        padding: 15,
        paddingBottom: 30,
    },
    
    // --- Main Card Styles ---
    cardContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 15,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        padding: 15,
        alignItems: 'center',
        borderLeftWidth: 5, // Color indicator on left
    },
    rankContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f0f2f5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    rankText: {
        fontWeight: 'bold',
        color: '#546E7A',
        fontSize: 14,
    },
    infoContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    titleText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2c3e50',
        textTransform: 'uppercase',
    },
    subSubjectText: {
        fontSize: 14,
        color: '#34495e',
        fontWeight: '500',
    },
    subText: {
        fontSize: 12,
        color: '#7f8c8d',
        marginTop: 2,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: '#ecf0f1',
        borderRadius: 3,
        marginTop: 6,
        width: '95%',
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    avgText: {
        fontSize: 11,
        color: '#34495e',
        marginTop: 3,
        fontWeight: '600',
    },
    percentBadge: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    percentText: {
        fontSize: 14,
        fontWeight: 'bold',
    },

    // --- Detailed Table Styles ---
    detailsContainer: {
        backgroundColor: '#f8f9fa',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingVertical: 10,
        paddingHorizontal: 15,
    },
    detailHeaderRow: {
        flexDirection: 'row',
        marginBottom: 8,
        paddingBottom: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    detailHeaderLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#546E7A',
    },
    detailRow: {
        flexDirection: 'row',
        paddingVertical: 4,
    },
    detailText: {
        fontSize: 13,
        color: '#37474F',
    },

    // --- States ---
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 50,
    },
    loadingText: {
        marginTop: 10,
        color: '#008080',
        fontWeight: '500',
    },
    emptyText: {
        marginTop: 10,
        color: '#95a5a6',
        fontSize: 16,
    },
});

export default TeacherPerformanceScreen;