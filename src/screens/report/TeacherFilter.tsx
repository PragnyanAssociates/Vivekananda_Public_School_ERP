/**
 * File: src/screens/report/TeacherFilter.tsx
 * Purpose: Filter Teachers by Performance (Class & Subject).
 * Updated: Added "All" Tab and Quick Access Navigation Button.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    TouchableOpacity, ScrollView, RefreshControl, StatusBar, SafeAreaView, Platform, UIManager, Image
} from 'react-native';
import { useNavigation } from '@react-navigation/native'; // Added for navigation
import apiClient from '../../api/client';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Enable Layout Animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- CONSTANTS ---
const COLORS = {
    primary: '#008080',      // Main Teal
    background: '#F2F5F8',   // Light Blue-Grey Background
    cardBg: '#FFFFFF',
    textMain: '#333333',
    textSub: '#666666',
    
    // Updated Status Colors
    success: '#00C853',      // Vibrant Green (> 85%)
    average: '#2979FF',      // Vibrant Blue (50% - 85%)
    poor: '#FF5252',         // Soft Red (< 50%)
    
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

// --- HELPER: CUSTOM ROUNDING ---
// Rule: 94.5% -> 94%, 94.6% -> 95%
const getRoundedPercentage = (value: number | string): number => {
    const floatVal = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(floatVal)) return 0;
    
    const decimalPart = floatVal - Math.floor(floatVal);
    
    if (decimalPart > 0.5) {
        return Math.ceil(floatVal);
    } else {
        return Math.floor(floatVal);
    }
};

const TeacherFilter = () => {
    // Navigation Hook
    const navigation = useNavigation();

    // --- State ---
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    
    // Data State
    const [classList, setClassList] = useState<string[]>([]);
    const [rawTeacherData, setRawTeacherData] = useState<any[]>([]);

    // Filters
    const [selectedClass, setSelectedClass] = useState('All Classes');
    const [selectedSubject, setSelectedSubject] = useState('All Subjects');
    
    // Tabs - Default 'All'
    const [activeTab, setActiveTab] = useState<'All' | 'Above Average' | 'Average' | 'Below Average'>('All');

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
    }, []);

    const fetchTeacherData = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/performance/admin/all-teachers`);
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
            let rawPercentage = 0;
            let displayLabel = 'Overall';
            let totalObtained = 0;
            let totalPossible = 0;

            // Logic to calculate percentage based on filters
            if (selectedClass === 'All Classes') {
                rawPercentage = parseFloat(teacher.overall_average) || 0;
                totalObtained = teacher.overall_total || 0;
                totalPossible = teacher.overall_possible || 0;
            } else {
                displayLabel = selectedClass;
                if (selectedSubject !== 'All Subjects') {
                    displayLabel += ` - ${selectedSubject}`;
                }

                if (teacher.detailed_performance) {
                    teacher.detailed_performance.forEach((detail: any) => {
                        if (detail.class_group !== selectedClass) return;
                        if (selectedSubject !== 'All Subjects' && detail.subject !== selectedSubject) return;

                        totalObtained += parseFloat(detail.total_marks) || 0;
                        totalPossible += parseFloat(detail.max_possible_marks) || 0;
                    });
                }

                if (totalPossible > 0) {
                    rawPercentage = (totalObtained / totalPossible) * 100;
                } else {
                    rawPercentage = -1; // Mark as invalid if no data
                }
            }

            // Apply custom rounding logic
            const percentage = rawPercentage >= 0 ? getRoundedPercentage(rawPercentage) : -1;

            return {
                id: teacher.teacher_id,
                full_name: teacher.teacher_name,
                percentage: percentage,
                obtained: totalObtained,
                max: totalPossible,
                displayLabel: displayLabel
            };
        });

        // Filter out those with no data (percentage = -1)
        calculatedTeachers = calculatedTeachers.filter(t => t.percentage >= 0 && t.max > 0);
        
        // Sort based on the rounded integer
        calculatedTeachers.sort((a, b) => b.percentage - a.percentage);
        calculatedTeachers = calculatedTeachers.map((t, index) => ({ ...t, rank: index + 1 }));

        return calculatedTeachers;
    }, [selectedClass, selectedSubject, rawTeacherData]);

    // --- 4. Tab Filtering Logic (Updated Ranges & All Tab) ---
    const filteredList = useMemo(() => {
        if (processedList.length === 0) return [];
        const list = [...processedList];

        if (activeTab === 'All') return list;

        // Above Average: 85% to 100%
        if (activeTab === 'Above Average') return list.filter(s => s.percentage >= 85);
        
        // Average: 50% to 85%
        if (activeTab === 'Average') return list.filter(s => s.percentage >= 50 && s.percentage < 85);
        
        // Below Average: 0% to 50%
        if (activeTab === 'Below Average') return list.filter(s => s.percentage < 50).sort((a, b) => a.percentage - b.percentage);

        return [];
    }, [activeTab, processedList]);

    // --- Helper for Colors (Updated Logic) ---
    const getStatusColor = (perc: number) => {
        // perc is already rounded integer
        if (perc >= 85) return COLORS.success;
        if (perc >= 50) return COLORS.average;
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

    const getListTitle = () => {
        switch(activeTab) {
            case 'All': return 'Teacher Performance';
            case 'Above Average': return 'Top Teachers';
            case 'Average': return 'Average Performers';
            case 'Below Average': return 'Need Attention';
            default: return 'Teachers';
        }
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
                        {/* Percentage is 0-100 integer */}
                        <View style={[styles.progressFill, { width: `${item.percentage}%`, backgroundColor: color }]} />
                    </View>
                </View>

                <View style={styles.scoreContainer}>
                    {/* Display integer directly */}
                    <Text style={[styles.percentage, { color: color }]}>{item.percentage}%</Text>
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
    const TABS = ['All', 'Above Average', 'Average', 'Below Average'];

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar backgroundColor="#F2F5F8" barStyle="dark-content" />
            
            {/* 1. Header Card with Quick Access */}
            <View style={styles.headerCard}>
                <View style={styles.headerIconContainer}>
                    <Icon name="chart-line" size={28} color={COLORS.primary} />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>Teacher Analytics</Text>
                    <Text style={styles.headerSubtitle}>Monitor staff performance</Text>
                </View>

                {/* --- QUICK ACCESS BUTTON --- */}
                <TouchableOpacity 
                    style={styles.quickAccessBtn} 
                    onPress={() => navigation.navigate('TeacherPerformanceScreen' as never)}
                    activeOpacity={0.7}
                >
                    <Image 
                        source={{ uri: 'https://cdn-icons-png.flaticon.com/128/3094/3094829.png' }} 
                        style={styles.quickAccessIcon}
                    />
                </TouchableOpacity>
            </View>

            <View style={styles.bodyContainer}>
                
                {/* 2. Filter Card */}
                <View style={styles.filterCard}>
                    
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

                {/* 3. Tabs */}
                <View style={styles.tabWrapper}>
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab;
                        let iconName = 'poll'; // Default for All
                        if(tab === 'Above Average') iconName = 'trophy-variant';
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
                                    size={16} 
                                    color={isActive ? '#FFF' : COLORS.textSub} 
                                />
                                <Text 
                                    style={[styles.tabText, isActive && styles.tabTextActive]}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.8}
                                >
                                    {tab}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* 4. List Content */}
                <View style={styles.contentArea}>
                    {loading ? (
                        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
                    ) : (
                        <>
                            <View style={styles.listHeader}>
                                <Text style={styles.listHeaderTitle}>
                                    {getListTitle()}
                                </Text>
                                <View style={styles.badgeCount}>
                                    <Text style={styles.badgeCountText}>
                                        {filteredList.length} / {processedList.length}
                                    </Text>
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
                                        <Text style={styles.emptySubText}>Try changing the class filters.</Text>
                                    </View>
                                }
                            />
                        </>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.background },

    // --- Header Card Style ---
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
    headerIconContainer: {
        backgroundColor: '#E0F2F1', // Light Teal Circle
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: {
        justifyContent: 'center',
        flex: 1,
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
    // Quick Access Button Styles
    quickAccessBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0F2F1', 
        paddingVertical: 6,
        paddingHorizontal: 8,
        marginLeft: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#80CBC4',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    quickAccessIcon: {
        width: 28,
        height: 28,
        resizeMode: 'contain',
    },

    // Main Body Container
    bodyContainer: {
        flex: 1,
        paddingHorizontal: 8,
    },

    // Filter Card
    filterCard: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 16,
        padding: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        marginBottom: 10,
        width: '96%',
        alignSelf: 'center'
    },
    
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
        marginBottom: 10,
        width: '96%',
        alignSelf: 'center',
        justifyContent: 'space-between',
    },
    tabButton: {
        flex: 1, 
        flexDirection: 'column', // Stack for space
        paddingVertical: 6,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        marginHorizontal: 2, 
    },
    tabButtonActive: {
        backgroundColor: COLORS.primary,
        elevation: 2,
    },
    tabText: { 
        fontSize: 10,
        fontWeight: '700', 
        color: COLORS.textSub,
        marginTop: 2,
        textAlign: 'center'
    },
    tabTextActive: { color: '#FFF' },

    // Content
    contentArea: { flex: 1, width: '96%', alignSelf: 'center' },
    listHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
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
        marginBottom: 10,
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