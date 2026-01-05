/**
 * File: src/screens/report/PerformanceFilter.tsx
 * Purpose: Filter students by Class, Exam & Subject.
 * Design: Modern UI with floating cards, avatars, and dynamic styling.
 * Fixes: Resolved layout collision between Filter Card and Tabs using Flexbox flow.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    TouchableOpacity, ScrollView, RefreshControl, Dimensions, StatusBar
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

// Classes where AT/UT max marks are 20 (otherwise 25)
const SENIOR_CLASSES = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

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

const EXAM_TYPES_DISPLAY = ['Overall', 'AT1', 'UT1', 'AT2', 'UT2', 'SA1', 'AT3', 'UT3', 'AT4', 'UT4', 'SA2'];

const EXAM_NAME_TO_CODE: any = {
    'Assignment-1': 'AT1', 'Unitest-1': 'UT1', 
    'Assignment-2': 'AT2', 'Unitest-2': 'UT2',
    'Assignment-3': 'AT3', 'Unitest-3': 'UT3', 
    'Assignment-4': 'AT4', 'Unitest-4': 'UT4',
    'SA1': 'SA1', 'SA2': 'SA2', 
    'AT1': 'AT1', 'UT1': 'UT1', 'AT2': 'AT2', 'UT2': 'UT2',
    'AT3': 'AT3', 'UT3': 'UT3', 'AT4': 'AT4', 'UT4': 'UT4'
};

const PerformanceFilter = () => {
    // --- State ---
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    
    // Data State
    const [classList, setClassList] = useState<string[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [marksData, setMarksData] = useState<any[]>([]);

    // Filters
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedExam, setSelectedExam] = useState('Overall');
    const [selectedSubject, setSelectedSubject] = useState('All Subjects');
    const [activeTab, setActiveTab] = useState<'Toppers' | 'Average' | 'Least'>('Toppers');

    // --- 1. Fetch Classes ---
    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const response = await apiClient.get('/reports/classes');
                const classes = response.data || [];
                setClassList(classes);
                if (classes.length > 0) setSelectedClass(classes[0]); 
            } catch (error) {
                console.error('Error fetching classes:', error);
            }
        };
        fetchClasses();
    }, []);

    // --- 2. Fetch Data ---
    useEffect(() => {
        if (selectedClass) {
            fetchClassData(selectedClass);
            setSelectedSubject('All Subjects');
        }
    }, [selectedClass]);

    const fetchClassData = async (classGroup: string) => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/reports/class-data/${classGroup}`);
            setStudents(response.data.students || []);
            setMarksData(response.data.marks || []);
        } catch (error) {
            console.error('Error fetching class data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        if (selectedClass) fetchClassData(selectedClass);
    };

    // --- 3. Calculation Logic ---
    const processedList = useMemo(() => {
        if (!selectedClass || students.length === 0) return [];

        const availableSubjects = CLASS_SUBJECTS[selectedClass] || [];
        const isSeniorClass = SENIOR_CLASSES.includes(selectedClass);
        const subjectsToProcess = selectedSubject === 'All Subjects' ? availableSubjects : [selectedSubject];

        // Create Marks Map
        const marksMap: any = {};
        marksData.forEach(mark => {
            if (!marksMap[mark.student_id]) marksMap[mark.student_id] = {};
            const code = EXAM_NAME_TO_CODE[mark.exam_type];
            if (code) {
                if (!marksMap[mark.student_id][code]) marksMap[mark.student_id][code] = {};
                marksMap[mark.student_id][code][mark.subject] = mark.marks_obtained;
            }
        });

        let calculatedStudents = students.map(student => {
            let obtained = 0;
            let max = 0;

            const calculateExamScore = (examCode: string) => {
                let examObtained = 0;
                let hasData = false;
                
                subjectsToProcess.forEach((subject: string) => {
                    const val = marksMap[student.id]?.[examCode]?.[subject];
                    if (val !== undefined && val !== null && val !== '' && !isNaN(parseFloat(val))) {
                        examObtained += parseFloat(val);
                        hasData = true;
                        
                        let maxPerSubject = 0;
                        if (['SA1', 'SA2'].includes(examCode)) maxPerSubject = 100;
                        else maxPerSubject = isSeniorClass ? 20 : 25;
                        max += maxPerSubject;
                    }
                });
                if (hasData) obtained += examObtained;
            };

            if (selectedExam === 'Overall') {
                EXAM_TYPES_DISPLAY.forEach(exam => { if (exam !== 'Overall') calculateExamScore(exam); });
            } else {
                calculateExamScore(selectedExam);
            }

            const percentage = max > 0 ? (obtained / max) * 100 : 0;
            return { ...student, obtained, max, percentage };
        });

        calculatedStudents = calculatedStudents.filter(s => s.max > 0);
        calculatedStudents.sort((a, b) => b.percentage - a.percentage); 
        calculatedStudents = calculatedStudents.map((s, index) => ({ ...s, rank: index + 1 }));

        return calculatedStudents;
    }, [selectedClass, selectedExam, selectedSubject, students, marksData]);

    // --- 4. Filtering Logic ---
    const filteredList = useMemo(() => {
        if (processedList.length === 0) return [];
        const list = [...processedList];

        if (activeTab === 'Toppers') return list.filter(s => s.percentage >= 90);
        if (activeTab === 'Average') return list.filter(s => s.percentage >= 60 && s.percentage < 90);
        if (activeTab === 'Least') return list.filter(s => s.percentage < 60).sort((a, b) => a.percentage - b.percentage);

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
        return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
    };

    // --- RENDER ITEM ---
    const renderStudentItem = ({ item }: any) => {
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
                            <Text style={styles.roll}>Roll No: {item.roll_no}</Text>
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

    const currentSubjects = ['All Subjects', ...(CLASS_SUBJECTS[selectedClass] || [])];

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor={COLORS.primaryDark} barStyle="light-content" />
            
            {/* Header Background */}
            <View style={styles.headerBackground}>
                <Text style={styles.headerTitle}>Analytics</Text>
            </View>

            {/* Content Body Container (Flows naturally) */}
            <View style={styles.bodyContainer}>
                
                {/* 1. Filter Card */}
                <View style={styles.filterCard}>
                    {/* Class Picker */}
                    <View style={styles.pickerRow}>
                        <Icon name="school-outline" size={20} color={COLORS.primary} style={{marginRight: 8}} />
                        <View style={styles.pickerWrapper}>
                            <Picker
                                selectedValue={selectedClass}
                                onValueChange={setSelectedClass}
                                style={styles.picker}
                                dropdownIconColor={COLORS.textSub}
                                mode="dropdown"
                            >
                                {classList.map(c => <Picker.Item key={c} label={c} value={c} style={{fontSize: 14}} />)}
                            </Picker>
                        </View>
                    </View>

                    {/* Exam Pills */}
                    <View style={styles.pillContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingVertical: 5}}>
                            {EXAM_TYPES_DISPLAY.map((exam) => {
                                const isActive = selectedExam === exam;
                                return (
                                    <TouchableOpacity 
                                        key={exam} 
                                        style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}
                                        onPress={() => setSelectedExam(exam)}
                                    >
                                        <Text style={[styles.pillText, isActive ? styles.pillTextActive : styles.pillTextInactive]}>{exam}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Subject Pills */}
                    <View style={styles.pillContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingVertical: 5}}>
                            {currentSubjects.map((sub) => {
                                const isActive = selectedSubject === sub;
                                return (
                                    <TouchableOpacity 
                                        key={sub} 
                                        style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}
                                        onPress={() => setSelectedSubject(sub)}
                                    >
                                        <Text style={[styles.pillText, isActive ? styles.pillTextActive : styles.pillTextInactive]}>{sub}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>

                {/* 2. Tabs (Now in normal flow below card) */}
                <View style={styles.tabWrapper}>
                    {['Toppers', 'Average', 'Least'].map((tab) => {
                        const isActive = activeTab === tab;
                        let iconName = 'trophy-variant';
                        if(tab === 'Average') iconName = 'scale-balance';
                        if(tab === 'Least') iconName = 'arrow-down-circle-outline';

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
                                    {activeTab === 'Toppers' ? 'Top Performers' : activeTab === 'Least' ? 'Need Attention' : 'Average Performers'}
                                </Text>
                                <View style={styles.badgeCount}>
                                    <Text style={styles.badgeCountText}>{filteredList.length}</Text>
                                </View>
                            </View>

                            <FlatList
                                data={filteredList}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={renderStudentItem}
                                contentContainerStyle={styles.listContent}
                                showsVerticalScrollIndicator={false}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                                ListEmptyComponent={
                                    <View style={styles.emptyContainer}>
                                        <Icon name="clipboard-text-off-outline" size={60} color="#CFD8DC" />
                                        <Text style={styles.emptyText}>No Result Found</Text>
                                        <Text style={styles.emptySubText}>Try changing the filters.</Text>
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
        height: 120, // Reduced height
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
        marginTop: -60, // Pulls content up over the header
        paddingHorizontal: 15,
        zIndex: 2,
    },

    // Filter Card (Normal Flow)
    filterCard: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 20,
        padding: 15,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        marginBottom: 15, // Space between Card and Tabs
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
        marginBottom: 15, // Space between Tabs and List
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
    tabText: { fontSize: 12, fontWeight: '700', color: COLORS.textSub },
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

    // Student Card
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
    roll: { fontSize: 11, color: COLORS.textSub },
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

export default PerformanceFilter;