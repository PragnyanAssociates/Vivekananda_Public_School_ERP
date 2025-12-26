/**
 * File: src/screens/report/MyPerformance.tsx
 * Purpose: Student view to compare their performance against Class Topper and Least scorer.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
    ScrollView, Animated, Easing, RefreshControl
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';

// --- Constants ---
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

const SENIOR_CLASSES = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

const EXAM_NAME_TO_CODE: any = {
    'Assignment-1': 'AT1', 'Unitest-1': 'UT1',
    'Assignment-2': 'AT2', 'Unitest-2': 'UT2',
    'Assignment-3': 'AT3', 'Unitest-3': 'UT3',
    'Assignment-4': 'AT4', 'Unitest-4': 'UT4',
    'SA1': 'SA1', 'SA2': 'SA2', 'Pre-Final': 'Pre-Final',
    'AT1': 'AT1', 'UT1': 'UT1', 'AT2': 'AT2', 'UT2': 'UT2',
    'AT3': 'AT3', 'UT3': 'UT3', 'AT4': 'AT4', 'UT4': 'UT4',
    'Overall': 'Overall'
};

const EXAM_OPTIONS = ['Overall', 'AT1', 'UT1', 'AT2', 'UT2', 'SA1', 'AT3', 'UT3', 'AT4', 'UT4', 'SA2'];

const COLORS = {
    primary: '#00897B',
    background: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    success: '#43A047',    // > 90%
    average: '#1E88E5',    // 60-90%
    poor: '#E53935',       // < 60%
    barBase: '#ECEFF1',
    border: '#CFD8DC'
};

// --- ANIMATED BAR COMPONENT ---
const PerformanceBar = ({ data, label, height = 250, isMe = false }: any) => {
    const animatedHeight = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animatedHeight, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
            easing: Easing.out(Easing.exp),
        }).start();
    }, [data.percentage]);

    // Color Logic
    let barColor = COLORS.poor;
    if (data.percentage >= 90) barColor = COLORS.success;
    else if (data.percentage >= 60) barColor = COLORS.average;

    const fillHeight = animatedHeight.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', `${data.percentage}%`]
    });

    return (
        <View style={styles.barContainer}>
            {/* Stats Header above bar */}
            <View style={styles.statsContainer}>
                <Text style={styles.statLabel}>Rank</Text>
                <Text style={styles.statValue}>#{data.rank}</Text>
                
                <Text style={[styles.statLabel, { marginTop: 4 }]}>Marks</Text>
                <Text style={styles.statValue}>{Math.round(data.obtained)}</Text>
                
                <Text style={[styles.statLabel, { marginTop: 4 }]}>%</Text>
                <Text style={[styles.statValue, { color: barColor }]}>{Math.round(data.percentage)}%</Text>
            </View>

            {/* The Bar */}
            <View style={[styles.barTrack, { height: height }]}>
                <Animated.View style={[styles.barFill, { height: fillHeight, backgroundColor: barColor }]} />
            </View>

            {/* Label (Who is this?) */}
            <Text style={[styles.barLabel, isMe && styles.barLabelMe]} numberOfLines={2}>
                {label}
            </Text>
        </View>
    );
};

const MyPerformance = () => {
    
    // State
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // User Data
    const [myInfo, setMyInfo] = useState<any>(null); // Stores ID and Class info
    const [classData, setClassData] = useState<any>(null); // Stores Raw Class Data
    
    // Filters
    const [selectedExam, setSelectedExam] = useState('Overall');
    const [selectedSubject, setSelectedSubject] = useState('All Subjects');

    // --- 1. Fetch Data ---
    const fetchData = async () => {
        setLoading(true);
        try {
            // ★★★ UPDATED: Fetch from the new Student-Specific Endpoint ★★★
            const response = await apiClient.get('/reports/student-class-performance');
            
            // The new API returns { students, marks, currentUserClass }
            setClassData(response.data);

            // We also need to know "Who am I?" (My ID) to find myself in the list.
            // We can get this from a separate call, OR you can store user ID in global context.
            // For safety, let's just get the basic profile again or rely on the fact 
            // that we need to identify the current user ID. 
            // Let's call my-report-card just to get the ID safely if not in context.
            const profileRes = await apiClient.get('/reports/my-report-card');
            setMyInfo(profileRes.data.studentInfo);

        } catch (error) {
            console.error('Error fetching performance data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // --- 2. Calculation Logic ---
    const graphData = useMemo(() => {
        if (!myInfo || !classData || !classData.students) return null;

        const { students, marks, currentUserClass } = classData;
        const myId = myInfo.id;
        
        // Use the class from API or fallback to profile
        const currentClassGroup = currentUserClass || myInfo.class_group;
        const isSeniorClass = SENIOR_CLASSES.includes(currentClassGroup);

        // Helper: Calculate stats for a single student based on current filters
        const calculateStudentStats = (studentId: number) => {
            let totalObtained = 0;
            let totalPossible = 0;

            const studentMarks = marks.filter((m: any) => m.student_id === studentId);

            if (selectedSubject === 'All Subjects') {
                const relevantSubjects = CLASS_SUBJECTS[currentClassGroup] || [];
                
                if (selectedExam === 'Overall') {
                    relevantSubjects.forEach((subj: string) => {
                         EXAM_OPTIONS.slice(1).forEach(examName => { 
                             const code = EXAM_NAME_TO_CODE[examName];
                             const entry = studentMarks.find((m: any) => m.subject === subj && EXAM_NAME_TO_CODE[m.exam_type] === code);
                             
                             if (entry && entry.marks_obtained) {
                                 const val = parseFloat(entry.marks_obtained);
                                 if(!isNaN(val)) {
                                    totalObtained += val;
                                    if(['SA1','SA2','Pre-Final'].includes(code)) totalPossible += 100;
                                    else totalPossible += (isSeniorClass ? 20 : 25);
                                 }
                             }
                         });
                    });
                } else {
                    relevantSubjects.forEach((subj: string) => {
                        const entry = studentMarks.find((m: any) => m.subject === subj && EXAM_NAME_TO_CODE[m.exam_type] === selectedExam);
                        if (entry && entry.marks_obtained) {
                             const val = parseFloat(entry.marks_obtained);
                             if(!isNaN(val)) {
                                totalObtained += val;
                                if(['SA1','SA2','Pre-Final'].includes(selectedExam)) totalPossible += 100;
                                else totalPossible += (isSeniorClass ? 20 : 25);
                             }
                        }
                    });
                }
            } else {
                if (selectedExam === 'Overall') {
                    EXAM_OPTIONS.slice(1).forEach(examName => {
                        const code = EXAM_NAME_TO_CODE[examName];
                        const entry = studentMarks.find((m: any) => m.subject === selectedSubject && EXAM_NAME_TO_CODE[m.exam_type] === code);
                        if (entry && entry.marks_obtained) {
                             const val = parseFloat(entry.marks_obtained);
                             if(!isNaN(val)) {
                                totalObtained += val;
                                if(['SA1','SA2','Pre-Final'].includes(code)) totalPossible += 100;
                                else totalPossible += (isSeniorClass ? 20 : 25);
                             }
                        }
                    });
                } else {
                    const entry = studentMarks.find((m: any) => m.subject === selectedSubject && EXAM_NAME_TO_CODE[m.exam_type] === selectedExam);
                    if (entry && entry.marks_obtained) {
                         const val = parseFloat(entry.marks_obtained);
                         if(!isNaN(val)) {
                            totalObtained += val;
                            if(['SA1','SA2','Pre-Final'].includes(selectedExam)) totalPossible += 100;
                            else totalPossible += (isSeniorClass ? 20 : 25);
                         }
                    }
                }
            }

            const percentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;
            return {
                id: studentId,
                obtained: totalObtained,
                total: totalPossible,
                percentage: percentage
            };
        };

        const classResults = students.map((s: any) => {
            const stats = calculateStudentStats(s.id);
            return { ...stats, name: s.full_name };
        });

        // Sort Highest to Lowest
        classResults.sort((a: any, b: any) => b.obtained - a.obtained);

        // Assign Ranks
        const rankedResults = classResults.map((item: any, index: number) => ({
            ...item,
            rank: index + 1
        }));

        const topper = rankedResults[0] || { obtained: 0, percentage: 0, rank: '-' };
        const me = rankedResults.find((r: any) => r.id === myId) || { obtained: 0, percentage: 0, rank: '-' };
        const least = rankedResults[rankedResults.length - 1] || { obtained: 0, percentage: 0, rank: '-' };

        return { topper, me, least };

    }, [myInfo, classData, selectedExam, selectedSubject]);


    // --- 3. Render ---
    // Safely derive subjects based on the class info we have
    const currentClass = myInfo?.class_group || classData?.currentUserClass;
    const subjectsList = currentClass ? ['All Subjects', ...(CLASS_SUBJECTS[currentClass] || [])] : [];

    return (
        <View style={styles.container}>
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
            ) : (
                <ScrollView 
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    
                    {/* Controls Container */}
                    <View style={styles.controlsContainer}>
                        
                        {/* Exam Type Selector */}
                        <Text style={styles.label}>Select Exam Type :-</Text>
                        <View style={styles.pickerWrapper}>
                            <Picker
                                selectedValue={selectedExam}
                                onValueChange={(itemValue) => setSelectedExam(itemValue)}
                                style={styles.picker}
                                dropdownIconColor={COLORS.primary}
                            >
                                {EXAM_OPTIONS.map(exam => (
                                    <Picker.Item key={exam} label={exam} value={exam} style={{fontSize: 14}} />
                                ))}
                            </Picker>
                        </View>

                        {/* Subject Selector */}
                        <Text style={[styles.label, { marginTop: 20 }]}>Select Subject :-</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectScroll}>
                            {subjectsList.map((subject) => {
                                const isSelected = selectedSubject === subject;
                                return (
                                    <TouchableOpacity
                                        key={subject}
                                        style={[styles.subjectChip, isSelected && styles.subjectChipActive]}
                                        onPress={() => setSelectedSubject(subject)}
                                    >
                                        <Text style={[styles.subjectText, isSelected && styles.subjectTextActive]}>
                                            {subject === 'All Subjects' ? 'All' : subject.substring(0, 3).toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Graph Area */}
                    <View style={styles.graphCard}>
                        {graphData && (graphData.topper.obtained > 0 || graphData.me.obtained > 0) ? (
                            <View style={styles.graphRow}>
                                {/* 1. Topper */}
                                <PerformanceBar 
                                    data={graphData.topper} 
                                    label="Topper" 
                                />

                                {/* 2. Me */}
                                <PerformanceBar 
                                    data={graphData.me} 
                                    label="My Performance"
                                    isMe={true} 
                                />

                                {/* 3. Least */}
                                <PerformanceBar 
                                    data={graphData.least} 
                                    label="Least Marks" 
                                />
                            </View>
                        ) : (
                            <Text style={styles.noData}>No Data Available</Text>
                        )}
                        
                        {/* Legend */}
                        <View style={styles.legendContainer}>
                             <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.success}]}/><Text style={styles.legendText}>Excellent (&gt;90%)</Text></View>
                             <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.average}]}/><Text style={styles.legendText}>Average (60-90%)</Text></View>
                             <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.poor}]}/><Text style={styles.legendText}>Poor (&lt;60%)</Text></View>
                        </View>
                    </View>

                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingBottom: 40 },
    
    // Controls
    controlsContainer: { padding: 20, paddingTop: 30 },
    label: { fontSize: 18, fontWeight: '600', color: '#000', marginBottom: 10 }, 
    
    pickerWrapper: {
        borderWidth: 1.5,
        borderColor: COLORS.textMain,
        borderRadius: 8,
        backgroundColor: '#FFF',
        overflow: 'hidden',
        height: 55,
        justifyContent: 'center'
    },
    picker: { width: '100%', height: 55, color: COLORS.textMain },
    
    subjectScroll: { flexDirection: 'row', marginTop: 5 },
    subjectChip: {
        borderWidth: 1.5,
        borderColor: COLORS.textMain,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 15,
        marginRight: 12,
        backgroundColor: '#FFF',
        minWidth: 60,
        alignItems: 'center'
    },
    subjectChipActive: {
        backgroundColor: COLORS.textMain, 
        borderColor: COLORS.textMain,
    },
    subjectText: { fontSize: 16, fontWeight: '600', color: COLORS.textMain },
    subjectTextActive: { color: '#FFF' },

    // Graph Area
    graphCard: {
        margin: 20,
        marginTop: 10,
        padding: 20,
        backgroundColor: '#FFF',
        borderRadius: 15,
        borderWidth: 1.5,
        borderColor: COLORS.textMain,
        minHeight: 400
    },
    graphRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        height: 320,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc'
    },
    noData: { textAlign: 'center', fontSize: 16, color: COLORS.textSub, marginTop: 100 },

    // Bar Components
    barContainer: { alignItems: 'center', width: '30%', justifyContent: 'flex-end', height: '100%' },
    
    statsContainer: { alignItems: 'center', marginBottom: 5 },
    statLabel: { fontSize: 10, color: COLORS.textSub, textTransform: 'uppercase' },
    statValue: { fontSize: 14, fontWeight: 'bold', color: COLORS.textMain },
    
    barTrack: {
        width: 45,
        backgroundColor: '#F0F0F0',
        borderWidth: 1,
        borderColor: '#000',
        justifyContent: 'flex-end'
    },
    barFill: { width: '100%' },
    
    barLabel: { 
        marginTop: 10, 
        textAlign: 'center', 
        fontSize: 14, 
        fontWeight: '600', 
        color: COLORS.textMain,
    },
    barLabelMe: {
        color: COLORS.primary,
        fontWeight: 'bold',
        textDecorationLine: 'underline'
    },

    // Legend
    legendContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: 5 },
    legendText: { fontSize: 10, color: COLORS.textSub }
});

export default MyPerformance;