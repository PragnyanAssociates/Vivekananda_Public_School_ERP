/**
 * File: src/screens/report/PerformanceFilter.tsx
 * Purpose: Filter students by Class, Exam & Subject.
 * Updated: Fixed Ranking & Sorting Logic to use Exact Scores instead of Rounded Percentages.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    TouchableOpacity, ScrollView, RefreshControl, StatusBar, SafeAreaView, Platform, UIManager, Image
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
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

// --- HELPER: CUSTOM ROUNDING ---
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

const PerformanceFilter = () => {
    // Navigation Hook
    const navigation = useNavigation();

    // --- State ---
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    
    // Data State
    const [classList, setClassList] = useState<string[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [marksData, setMarksData] = useState<any[]>([]);
    
    // Teacher Assignments State
    const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);

    // Filters
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedExam, setSelectedExam] = useState('Overall');
    const [selectedSubject, setSelectedSubject] = useState('All Subjects');
    
    // Active Tab State Name - DEFAULT 'All'
    const [activeTab, setActiveTab] = useState<'All' | 'Above Average' | 'Average' | 'Below Average'>('All');

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
            const { students, marks, assignments } = response.data;
            
            setStudents(students || []);
            setMarksData(marks || []);
            setTeacherAssignments(assignments || []);
            
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

            const rawPercentage = max > 0 ? (obtained / max) * 100 : 0;
            // Use rounded percentage for Display & Filter Groups
            const percentage = getRoundedPercentage(rawPercentage);

            // Pass rawPercentage for Sorting
            return { ...student, obtained, max, percentage, rawPercentage };
        });

        calculatedStudents = calculatedStudents.filter(s => s.max > 0);
        
        // FIX: Sort based on Exact Percentage (Raw) to ensure proper Ranking
        calculatedStudents.sort((a, b) => b.rawPercentage - a.rawPercentage); 
        
        calculatedStudents = calculatedStudents.map((s, index) => ({ ...s, rank: index + 1 }));

        return calculatedStudents;
    }, [selectedClass, selectedExam, selectedSubject, students, marksData]);

    // --- 4. Filtering Logic ---
    const filteredList = useMemo(() => {
        if (processedList.length === 0) return [];
        const list = [...processedList];

        if (activeTab === 'All') return list;
        
        // Above Average: 85% to 100%
        if (activeTab === 'Above Average') return list.filter(s => s.percentage >= 85);
        
        // Average: 50% to 85%
        if (activeTab === 'Average') return list.filter(s => s.percentage >= 50 && s.percentage < 85);
        
        // Below Average: 0% to 50%
        if (activeTab === 'Below Average') {
            return list
                .filter(s => s.percentage < 50)
                // FIX: Sort by Raw Percentage ASCENDING (Low to High) so Rank 30 comes before Rank 29
                .sort((a, b) => a.rawPercentage - b.rawPercentage);
        }

        return [];
    }, [activeTab, processedList]);

    // --- Helper to get Teacher Name ---
    const currentTeacherName = useMemo(() => {
        if (selectedSubject === 'All Subjects') return null;
        const assignment = teacherAssignments.find(a => a.subject === selectedSubject);
        return assignment ? assignment.teacher_name : 'Not Assigned';
    }, [selectedSubject, teacherAssignments]);

    const getStatusColor = (perc: number) => {
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
        return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
    };

    const getListTitle = () => {
        switch(activeTab) {
            case 'All': return 'Class Performance';
            case 'Above Average': return 'Top Performers';
            case 'Average': return 'Average Performers';
            case 'Below Average': return 'Need Attention';
            default: return 'Students';
        }
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
                    <Text style={[styles.percentage, { color: color }]}>{item.percentage}%</Text>
                    <Text style={styles.marks}>{Math.round(item.obtained)}/{Math.round(item.max)}</Text>
                </View>
            </View>
        );
    };

    const currentSubjects = ['All Subjects', ...(CLASS_SUBJECTS[selectedClass] || [])];
    const TABS = ['All', 'Above Average', 'Average', 'Below Average'];

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar backgroundColor="#F2F5F8" barStyle="dark-content" />
            
            {/* 1. Header Card (Updated Button Style) */}
            <View style={styles.headerCard}>
                <View style={styles.headerIconContainer}>
                    <Icon name="chart-box-outline" size={28} color={COLORS.primary} />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>Student Reports</Text>
                    <Text style={styles.headerSubtitle}>Analyze class performance</Text>
                </View>

                {/* --- QUICK ACCESS BUTTON --- */}
                <TouchableOpacity 
                    style={styles.quickAccessBtn} 
                    onPress={() => navigation.navigate('StudentPerformance' as never)}
                    activeOpacity={0.7}
                >
                    <Image 
                        source={{ uri: 'https://cdn-icons-png.flaticon.com/128/12489/12489385.png' }} 
                        style={styles.quickAccessIcon}
                    />
                </TouchableOpacity>
            </View>

            <View style={styles.bodyContainer}>
                
                {/* 2. Filter Card */}
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

                {/* 3. Tabs */}
                <View style={styles.tabWrapper}>
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab;
                        let iconName = 'poll';
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
                                <View style={styles.listHeaderLeft}>
                                    <Text style={styles.listHeaderTitle}>
                                        {getListTitle()}
                                    </Text>
                                    <View style={styles.badgeCount}>
                                        <Text style={styles.badgeCountText}>
                                            {filteredList.length} / {processedList.length}
                                        </Text>
                                    </View>
                                </View>

                                {/* TEACHER NAME SECTION */}
                                {selectedSubject !== 'All Subjects' && currentTeacherName && (
                                    <View style={styles.teacherBadge}>
                                        <Icon name="account-tie" size={16} color="#EF6C00" />
                                        <Text style={styles.teacherText} numberOfLines={1}>
                                            {currentTeacherName}
                                        </Text>
                                    </View>
                                )}
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
    // Updated Quick Access Button Styles
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
    pickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F7FA',
        borderRadius: 12,
        paddingHorizontal: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    pickerWrapper: { flex: 1, height: 45, justifyContent: 'center' },
    picker: { width: '100%', color: COLORS.textMain },
    
    // Pills
    pillContainer: { marginBottom: 6 },
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
        flexDirection: 'column', 
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
    
    // Header Row
    listHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    listHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
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
    
    // Teacher Badge
    teacherBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF3E0', 
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#FFE0B2', 
        maxWidth: '45%',
        justifyContent: 'flex-end'
    },
    teacherText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#E65100', 
        marginLeft: 4,
        flexShrink: 1
    },

    listContent: { paddingBottom: 20 },

    // Student Card
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