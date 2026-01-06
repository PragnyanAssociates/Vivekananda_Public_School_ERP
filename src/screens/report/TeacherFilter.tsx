/**
 * File: src/screens/report/TeacherFilter.tsx
 * Purpose: Filter Teachers by Performance (Year, Class & Subject).
 * Design: Based on PerformanceFilter.tsx but adapted for Teachers.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    TouchableOpacity, ScrollView, RefreshControl, StatusBar
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// --- CONSTANTS ---
const COLORS = {
    primary: '#00897B',      // Main Teal
    primaryDark: '#00695C',  // Darker Teal for Header
    background: '#F0F4F8',   // Very light grey/blue background
    cardBg: '#FFFFFF',
    textMain: '#102027',
    textSub: '#546E7A',
    
    // Status Colors
    success: '#00C853',      // Vibrant Green (> 90%)
    average: '#2979FF',      // Vibrant Blue (60% - 90%)
    poor: '#FF5252',         // Soft Red (< 60%)
    
    // Rank Colors
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
    
    border: '#E0E0E0',
};

const CLASS_SUBJECTS: any = {
    'LKG': ['All Subjects'], 'UKG': ['All Subjects'], 
    'Class 1': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 2': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 
    'Class 3': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 4': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 
    'Class 5': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 6': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 
    'Class 7': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 8': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 
    'Class 9': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 10': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social']
};

// Generate last 5 academic years
const ACADEMIC_YEARS = (() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 5; i++) {
        const startYear = currentYear - i;
        years.push(`${startYear}-${startYear + 1}`);
    }
    return years;
})();

const TeacherFilter = () => {
    // --- State ---
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    
    // Data State
    const [classList, setClassList] = useState<string[]>([]);
    const [rawTeacherData, setRawTeacherData] = useState<any[]>([]);

    // Filters
    const [selectedYear, setSelectedYear] = useState(ACADEMIC_YEARS[0]);
    const [selectedClass, setSelectedClass] = useState('All Classes');
    const [selectedSubject, setSelectedSubject] = useState('All Subjects');
    
    // Tabs
    const [activeTab, setActiveTab] = useState<'Above Average' | 'Average' | 'Below Average'>('Above Average');

    // --- 1. Fetch Classes ---
    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const response = await apiClient.get('/reports/classes');
                const classes = response.data || [];
                // Add "All Classes" option
                setClassList(['All Classes', ...classes]);
            } catch (error) {
                console.error('Error fetching classes:', error);
            }
        };
        fetchClasses();
    }, []);

    // --- 2. Fetch Teacher Data ---
    useEffect(() => {
        fetchTeacherData();
    }, [selectedYear]);

    const fetchTeacherData = async () => {
        setLoading(true);
        try {
            // Using the endpoint from TeacherPerformanceScreen.js
            const response = await apiClient.get(`/performance/admin/all-teachers/${selectedYear}`);
            setRawTeacherData(response.data || []);
        } catch (error) {
            console.error('Error fetching teacher data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchTeacherData();
    };

    // --- 3. Calculation & Filtering Logic ---
    const processedList = useMemo(() => {
        if (!rawTeacherData || rawTeacherData.length === 0) return [];

        let calculatedTeachers = rawTeacherData.map(teacher => {
            let percentage = 0;
            let displayLabel = 'Overall';
            let totalObtained = 0;
            let totalPossible = 0;

            // Logic to calculate percentage based on filters
            if (selectedClass === 'All Classes') {
                // Use Overall Data from API
                percentage = parseFloat(teacher.overall_average) || 0;
                totalObtained = teacher.overall_total || 0;
                totalPossible = teacher.overall_possible || 0;
            } else {
                // Filter specifically for Class & Subject
                displayLabel = selectedClass;
                if (selectedSubject !== 'All Subjects') {
                    displayLabel += ` - ${selectedSubject}`;
                }

                if (teacher.detailed_performance) {
                    teacher.detailed_performance.forEach((detail: any) => {
                        // Check Class Match
                        if (detail.class_group !== selectedClass) return;

                        // Check Subject Match (if specific subject selected)
                        if (selectedSubject !== 'All Subjects' && detail.subject !== selectedSubject) return;

                        totalObtained += parseFloat(detail.total_marks) || 0;
                        totalPossible += parseFloat(detail.max_possible_marks) || 0;
                    });
                }

                if (totalPossible > 0) {
                    percentage = (totalObtained / totalPossible) * 100;
                } else {
                    percentage = -1; // Mark as no data for this specific filter
                }
            }

            return {
                id: teacher.teacher_id,
                full_name: teacher.teacher_name,
                percentage: percentage,
                obtained: totalObtained,
                max: totalPossible,
                displayLabel: displayLabel
            };
        });

        // Filter out teachers who don't have data for the selected filters (percentage -1)
        calculatedTeachers = calculatedTeachers.filter(t => t.percentage >= 0 && t.max > 0);

        // Sort by Percentage High to Low
        calculatedTeachers.sort((a, b) => b.percentage - a.percentage);

        // Assign Rank
        calculatedTeachers = calculatedTeachers.map((t, index) => ({ ...t, rank: index + 1 }));

        return calculatedTeachers;
    }, [selectedYear, selectedClass, selectedSubject, rawTeacherData]);

    // --- 4. Tab Filtering Logic ---
    const filteredList = useMemo(() => {
        if (processedList.length === 0) return [];
        const list = [...processedList];

        if (activeTab === 'Above Average') return list.filter(s => s.percentage >= 90);
        if (activeTab === 'Average') return list.filter(s => s.percentage >= 60 && s.percentage < 90);
        if (activeTab === 'Below Average') return list.filter(s => s.percentage < 60).sort((a, b) => a.percentage - b.percentage); // Sort lowest first for attention

        return [];
    }, [activeTab, processedList]);

    const getStatusColor = (perc: number) => {
        if (perc >= 90) return COLORS.success;
        if (perc >= 60) return COLORS.average;
        return COLORS.poor;
    };

    const getRankColor = (rank: number) => {
        if (rank === 1) return COLORS.gold;
        if (rank === 2) return COLORS.silver;
        if (rank === 3) return COLORS.bronze;
        return '#B0BEC5';
    };

    const getInitials = (name: string) => {
        if (!name) return 'T';
        return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
    };

    // --- RENDER ITEM ---
    const renderTeacherItem = ({ item }: any) => {
        const color = getStatusColor(item.percentage);
        const rankColor = getRankColor(item.rank);
        
        return (
            <View style={styles.card}>
                <View style={styles.rankContainer}>
                    <View style={[styles.rankBadge, { borderColor: rankColor }]}>
                        <Text style={[styles.rankText, { color: rankColor }]}>#{item.rank}</Text>
                    </View>
                </View>

                <View style={styles.infoContainer}>
                    <View style={styles.headerRow}>
                        <View style={[styles.avatar, { backgroundColor: color + '20' }]}>
                            <Text style={[styles.avatarText, { color: color }]}>{getInitials(item.full_name)}</Text>
                        </View>
                        <View style={styles.textColumn}>
                            <Text style={styles.name} numberOfLines={1}>{item.full_name}</Text>
                            <Text style={styles.subText}>{item.displayLabel}</Text>
                        </View>
                    </View>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${item.percentage}%`, backgroundColor: color }]} />
                    </View>
                </View>

                <View style={styles.scoreContainer}>
                    <Text style={[styles.percentage, { color: color }]}>{item.percentage.toFixed(1)}%</Text>
                    <Text style={styles.marks}>{Math.round(item.obtained)}/{Math.round(item.max)}</Text>
                </View>
            </View>
        );
    };

    // Calculate available subjects for current class selection
    const currentSubjects = selectedClass === 'All Classes' 
        ? ['All Subjects'] 
        : ['All Subjects', ...(CLASS_SUBJECTS[selectedClass] || [])];

    // Tab Titles
    const TABS = ['Above Average', 'Average', 'Below Average'];

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor={COLORS.primaryDark} barStyle="light-content" />
            
            {/* Header Background */}
            <View style={styles.headerBackground}>
                <Text style={styles.headerTitle}>Teacher Analytics</Text>
            </View>

            {/* Content Body Container */}
            <View style={styles.bodyContainer}>
                
                {/* 1. Filter Card */}
                <View style={styles.filterCard}>
                    
                    {/* Academic Year Picker */}
                    <View style={styles.pickerRow}>
                        <Icon name="calendar-range" size={20} color={COLORS.primary} style={{marginRight: 8}} />
                        <View style={styles.pickerWrapper}>
                            <Picker
                                selectedValue={selectedYear}
                                onValueChange={setSelectedYear}
                                style={styles.picker}
                                dropdownIconColor={COLORS.textSub}
                                mode="dropdown"
                            >
                                {ACADEMIC_YEARS.map(y => <Picker.Item key={y} label={`Academic Year: ${y}`} value={y} style={{fontSize: 14}} />)}
                            </Picker>
                        </View>
                    </View>

                    {/* Class Pills */}
                    <View style={styles.pillContainer}>
                        <Text style={styles.pillLabel}>Class:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingVertical: 5}}>
                            {classList.map((cls) => {
                                const isActive = selectedClass === cls;
                                return (
                                    <TouchableOpacity 
                                        key={cls} 
                                        style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}
                                        onPress={() => {
                                            setSelectedClass(cls);
                                            setSelectedSubject('All Subjects'); // Reset subject on class change
                                        }}
                                    >
                                        <Text style={[styles.pillText, isActive ? styles.pillTextActive : styles.pillTextInactive]}>{cls}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Subject Pills (Only if specific class selected) */}
                    <View style={styles.pillContainer}>
                         <Text style={styles.pillLabel}>Subject:</Text>
                         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingVertical: 5}}>
                            {currentSubjects.map((sub) => {
                                const isActive = selectedSubject === sub;
                                return (
                                    <TouchableOpacity 
                                        key={sub} 
                                        style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}
                                        onPress={() => setSelectedSubject(sub)}
                                        disabled={selectedClass === 'All Classes' && sub !== 'All Subjects'}
                                    >
                                        <Text style={[styles.pillText, isActive ? styles.pillTextActive : styles.pillTextInactive]}>{sub}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>

                {/* 2. Tabs */}
                <View style={styles.tabWrapper}>
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab;
                        let iconName = 'trophy-variant';
                        if(tab === 'Average') iconName = 'scale-balance';
                        if(tab === 'Below Average') iconName = 'arrow-down-circle-outline';

                        return (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                                onPress={() => setActiveTab(tab as any)}
                            >
                                <Icon 
                                    name={iconName} 
                                    size={18} 
                                    color={isActive ? '#FFF' : COLORS.textSub} 
                                />
                                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* 3. List Content */}
                <View style={styles.contentArea}>
                    {loading ? (
                        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
                    ) : (
                        <>
                            <View style={styles.listHeader}>
                                <Text style={styles.listHeaderTitle}>
                                    {activeTab === 'Above Average' ? 'Top Teachers' : activeTab === 'Below Average' ? 'Need Attention' : 'Average Performers'}
                                </Text>
                                <View style={styles.badgeCount}>
                                    <Text style={styles.badgeCountText}>{filteredList.length}</Text>
                                </View>
                            </View>

                            <FlatList
                                data={filteredList}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={renderTeacherItem}
                                contentContainerStyle={styles.listContent}
                                showsVerticalScrollIndicator={false}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                                ListEmptyComponent={
                                    <View style={styles.emptyContainer}>
                                        <Icon name="clipboard-text-off-outline" size={60} color="#CFD8DC" />
                                        <Text style={styles.emptyText}>No Teachers Found</Text>
                                        <Text style={styles.emptySubText}>Try changing the year or class filters.</Text>
                                    </View>
                                }
                            />
                        </>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    // Header Background
    headerBackground: {
        backgroundColor: COLORS.primary,
        height: 120, 
        paddingHorizontal: 20,
        paddingTop: 15,
        borderBottomRightRadius: 30,
        borderBottomLeftRadius: 30,
        zIndex: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFF',
    },

    // Main Body Container
    bodyContainer: {
        flex: 1,
        marginTop: -60,
        paddingHorizontal: 15,
        zIndex: 2,
    },

    // Filter Card
    filterCard: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 20,
        padding: 15,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        marginBottom: 15,
    },
    pickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F7FA',
        borderRadius: 12,
        paddingHorizontal: 10,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    pickerWrapper: { flex: 1, height: 45, justifyContent: 'center' },
    picker: { width: '100%', color: COLORS.textMain },
    
    // Pills
    pillContainer: { marginBottom: 8 },
    pillLabel: { fontSize: 11, color: COLORS.textSub, fontWeight: 'bold', marginBottom: 4, marginLeft: 2 },
    pill: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
    },
    pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    pillInactive: { backgroundColor: '#F5F7FA', borderColor: '#E0E0E0' },
    pillText: { fontSize: 12, fontWeight: '600' },
    pillTextActive: { color: '#FFF' },
    pillTextInactive: { color: COLORS.textSub },

    // Tabs
    tabWrapper: {
        flexDirection: 'row',
        backgroundColor: '#E0E7FF',
        borderRadius: 15,
        padding: 4,
        marginBottom: 15,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        gap: 6
    },
    tabButtonActive: {
        backgroundColor: COLORS.primary,
        elevation: 3,
    },
    tabText: { fontSize: 11, fontWeight: '700', color: COLORS.textSub },
    tabTextActive: { color: '#FFF' },

    // Content
    contentArea: { flex: 1 },
    listHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    listHeaderTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.textMain,
    },
    badgeCount: {
        backgroundColor: '#E0E0E0',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 8,
    },
    badgeCountText: { fontSize: 11, fontWeight: 'bold', color: COLORS.textMain },
    listContent: { paddingBottom: 20 },

    // Teacher Card
    card: {
        flexDirection: 'row',
        backgroundColor: COLORS.cardBg,
        borderRadius: 16,
        marginBottom: 12,
        padding: 12,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    rankContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    rankBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FAFAFA'
    },
    rankText: { fontSize: 12, fontWeight: '900' },
    infoContainer: { flex: 1, justifyContent: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    avatarText: { fontSize: 12, fontWeight: 'bold' },
    textColumn: { flex: 1 },
    name: { fontSize: 14, fontWeight: 'bold', color: COLORS.textMain },
    subText: { fontSize: 11, color: COLORS.textSub },
    progressTrack: {
        height: 5,
        backgroundColor: '#ECEFF1',
        borderRadius: 3,
        overflow: 'hidden',
        width: '90%',
    },
    progressFill: { height: '100%', borderRadius: 3 },
    scoreContainer: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        minWidth: 50,
    },
    percentage: { fontSize: 16, fontWeight: 'bold' },
    marks: { fontSize: 10, color: COLORS.textSub, marginTop: 2 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 50 },
    emptyText: { marginTop: 15, color: COLORS.textMain, fontSize: 16, fontWeight: 'bold' },
    emptySubText: { marginTop: 5, color: COLORS.textSub, fontSize: 13, textAlign: 'center' }
});

export default TeacherFilter;