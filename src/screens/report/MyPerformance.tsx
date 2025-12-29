/**
 * File: src/screens/report/MyPerformance.tsx
 * Purpose: Student view to compare performance.
 * Features: 
 *  1. Single Subject View: Topper vs Me.
 *  2. Overview Mode: All subjects side-by-side.
 *  3. Displays Rank, Marks, and Percentage.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
    ScrollView, Animated, Easing, RefreshControl, Dimensions
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';

// --- Constants ---
const SCREEN_WIDTH = Dimensions.get('window').width;

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
    background: '#F5F7FA',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    success: '#43A047',    // Green
    average: '#1976D2',    // Blue
    poor: '#E53935',       // Red
    barBase: '#ECEFF1',
    border: '#CFD8DC',
    selectedChip: '#1976D2', // Blue for selected subject
    overviewChip: '#292828ff'  // Red for Overview button
};

// --- HELPER: Calculate Stats for One Subject ---
const calculateStatsForSubject = (
    subject: string, 
    examType: string, 
    students: any[], 
    marks: any[], 
    myId: number, 
    isSeniorClass: boolean
) => {
    // 1. Calculate score for every student in this subject
    const classResults = students.map((student: any) => {
        let totalObtained = 0;
        let totalPossible = 0;
        const studentMarks = marks.filter((m: any) => m.student_id === student.id);

        if (subject === 'All Subjects') {
             // (Logic handled in main component for aggregation usually, but keeping structure safe)
        } else {
            if (examType === 'Overall') {
                EXAM_OPTIONS.slice(1).forEach(examName => {
                    const code = EXAM_NAME_TO_CODE[examName];
                    const entry = studentMarks.find((m: any) => m.subject === subject && EXAM_NAME_TO_CODE[m.exam_type] === code);
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
                const entry = studentMarks.find((m: any) => m.subject === subject && EXAM_NAME_TO_CODE[m.exam_type] === examType);
                if (entry && entry.marks_obtained) {
                     const val = parseFloat(entry.marks_obtained);
                     if(!isNaN(val)) {
                        totalObtained += val;
                        if(['SA1','SA2','Pre-Final'].includes(examType)) totalPossible += 100;
                        else totalPossible += (isSeniorClass ? 20 : 25);
                     }
                }
            }
        }

        const percentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;
        return {
            id: student.id,
            obtained: totalObtained,
            total: totalPossible,
            percentage: percentage
        };
    });

    // 2. Sort & Rank
    classResults.sort((a: any, b: any) => b.obtained - a.obtained);
    const rankedResults = classResults.map((item: any, index: number) => ({ ...item, rank: index + 1 }));

    // 3. Extract Topper & Me
    const topper = rankedResults[0] || { obtained: 0, percentage: 0, rank: '-', total: 0 };
    const me = rankedResults.find((r: any) => r.id === myId) || { obtained: 0, percentage: 0, rank: '-', total: 0 };

    return { topper, me };
};


// --- COMPONENT: ANIMATED BAR ---
const PerformanceBar = ({ data, label, color, showRank = true, slim = false }: any) => {
    const animatedHeight = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animatedHeight, {
            toValue: 1, duration: 1000, useNativeDriver: false, easing: Easing.out(Easing.back(1.5)), 
        }).start();
    }, [data.percentage]);

    const fillHeight = animatedHeight.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', `${Math.min(data.percentage, 100)}%`]
    });

    // Determine Color based on strict percentage logic for the TEXT
    let percentageColor = COLORS.poor;
    if (data.percentage >= 90) percentageColor = COLORS.success;
    else if (data.percentage >= 60) percentageColor = COLORS.average;

    const labelSize = slim ? 11 : 13;
    const marksSize = slim ? 14 : 18;

    return (
        <View style={slim ? styles.barWrapperSlim : styles.barWrapper}>
            {/* Header: Rank, Marks, Percentage */}
            <View style={styles.statsHeader}>
                {showRank && (
                    <View style={styles.rankBadge}>
                        <Text style={styles.rankText}>#{data.rank}</Text>
                    </View>
                )}
                
                {/* Marks */}
                <View style={styles.marksContainer}>
                    <Text style={[styles.marksText, { fontSize: marksSize }]}>{Math.round(data.obtained)}</Text>
                    <Text style={[styles.totalMarksText, { fontSize: slim ? 10 : 13 }]}>/{Math.round(data.total)}</Text>
                </View>

                {/* Percentage Display */}
                <Text style={[styles.percentageText, { color: percentageColor, fontSize: slim ? 10 : 12 }]}>
                    {Math.round(data.percentage)}%
                </Text>
            </View>

            {/* Track - UPDATED WIDTH HERE: slim uses 80% (of small container), normal uses 40% (slimmed down) */}
            <View style={[styles.barTrack, { height: slim ? '60%' : '65%', width: slim ? '80%' : '40%' }]}>
                <Animated.View style={[styles.barFill, { height: fillHeight, backgroundColor: color }]} />
            </View>

            {/* Label */}
            <Text style={[styles.barLabel, { fontSize: labelSize, color: label === 'My Marks' ? COLORS.average : COLORS.textSub }]} numberOfLines={1}>
                {label}
            </Text>
        </View>
    );
};

const MyPerformance = () => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    const [myInfo, setMyInfo] = useState<any>(null); 
    const [classData, setClassData] = useState<any>(null); 
    
    const [selectedExam, setSelectedExam] = useState('Overall');
    const [selectedSubject, setSelectedSubject] = useState('All Subjects');

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/reports/student-class-performance');
            setClassData(response.data);
            const profileRes = await apiClient.get('/reports/my-report-card');
            setMyInfo(profileRes.data.studentInfo);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchData(); }, []);
    const onRefresh = () => { setRefreshing(true); fetchData(); };

    const processedData = useMemo(() => {
        if (!myInfo || !classData || !classData.students) return null;

        const { students, marks, currentUserClass } = classData;
        const myId = myInfo.id;
        const currentClassGroup = currentUserClass || myInfo.class_group;
        const isSeniorClass = SENIOR_CLASSES.includes(currentClassGroup);
        const subjectsList = CLASS_SUBJECTS[currentClassGroup] || [];

        if (selectedSubject === 'Overview') {
            const overviewResults = subjectsList.map((subj: string) => {
                if (subj === 'All Subjects') return null;
                const stats = calculateStatsForSubject(subj, selectedExam, students, marks, myId, isSeniorClass);
                return { subject: subj, ...stats };
            }).filter(Boolean);
            return { mode: 'Overview', data: overviewResults };
        } else {
            if (selectedSubject === 'All Subjects') {
                const classResults = students.map((student: any) => {
                    let totalObtained = 0;
                    let totalPossible = 0;
                    const studentMarks = marks.filter((m: any) => m.student_id === student.id);

                    subjectsList.forEach((s: string) => {
                         if (s === 'All Subjects') return;
                         if (selectedExam === 'Overall') {
                            EXAM_OPTIONS.slice(1).forEach(examName => {
                                const code = EXAM_NAME_TO_CODE[examName];
                                const entry = studentMarks.find((m: any) => m.subject === s && EXAM_NAME_TO_CODE[m.exam_type] === code);
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
                            const entry = studentMarks.find((m: any) => m.subject === s && EXAM_NAME_TO_CODE[m.exam_type] === selectedExam);
                            if (entry && entry.marks_obtained) {
                                 const val = parseFloat(entry.marks_obtained);
                                 if(!isNaN(val)) {
                                    totalObtained += val;
                                    if(['SA1','SA2','Pre-Final'].includes(selectedExam)) totalPossible += 100;
                                    else totalPossible += (isSeniorClass ? 20 : 25);
                                 }
                            }
                         }
                    });
                    return { id: student.id, obtained: totalObtained, total: totalPossible, percentage: totalPossible > 0 ? (totalObtained/totalPossible)*100 : 0 };
                });
                classResults.sort((a: any, b: any) => b.obtained - a.obtained);
                const ranked = classResults.map((item: any, idx: number) => ({ ...item, rank: idx + 1 }));
                const topper = ranked[0] || { obtained: 0, percentage: 0, rank: '-', total: 0 };
                const me = ranked.find((r: any) => r.id === myId) || { obtained: 0, percentage: 0, rank: '-', total: 0 };
                return { mode: 'Single', data: { topper, me } };
            } else {
                const stats = calculateStatsForSubject(selectedSubject, selectedExam, students, marks, myId, isSeniorClass);
                return { mode: 'Single', data: stats };
            }
        }
    }, [myInfo, classData, selectedExam, selectedSubject]);

    const currentClass = myInfo?.class_group || classData?.currentUserClass;
    const rawSubjects = currentClass ? CLASS_SUBJECTS[currentClass] || [] : [];
    const subjectsToRender = ['All Subjects', ...rawSubjects.filter((s: string) => s !== 'All Subjects'), 'Overview'];

    return (
        <View style={styles.container}>
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
            ) : (
                <ScrollView 
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    <View style={styles.controlsSection}>
                        <Text style={styles.label}>Select Exam Type :-</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={selectedExam}
                                onValueChange={setSelectedExam}
                                style={styles.picker}
                                dropdownIconColor={COLORS.textMain}
                            >
                                {EXAM_OPTIONS.map(exam => <Picker.Item key={exam} label={exam} value={exam} style={{fontSize: 14}} />)}
                            </Picker>
                        </View>

                        <Text style={[styles.label, { marginTop: 20 }]}>Select Subject :-</Text>
                        <View style={styles.subjectsGrid}>
                            {subjectsToRender.map((subject) => {
                                const isSelected = selectedSubject === subject;
                                const isOverview = subject === 'Overview';
                                let shortName = subject;
                                if (subject === 'All Subjects') shortName = 'All';
                                else if (subject !== 'Overview') shortName = subject.substring(0, 3).toUpperCase();
                                
                                return (
                                    <TouchableOpacity
                                        key={subject}
                                        style={[
                                            styles.subjectChip, 
                                            isSelected && styles.subjectChipActive,
                                            isOverview && styles.subjectChipOverview
                                        ]}
                                        onPress={() => setSelectedSubject(subject)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[
                                            styles.subjectText, 
                                            isSelected && styles.subjectTextActive,
                                            isOverview && styles.subjectTextOverview
                                        ]}>
                                            {shortName}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.graphCard}>
                        {!processedData ? (
                            <Text style={styles.noDataText}>Loading...</Text>
                        ) : processedData.mode === 'Single' ? (
                            <>
                                <View style={styles.singleGraphContainer}>
                                    <PerformanceBar 
                                        data={processedData.data.topper} 
                                        label="Topper" 
                                        color={COLORS.success} 
                                    />
                                    <PerformanceBar 
                                        data={processedData.data.me} 
                                        label="My Marks" 
                                        color={COLORS.average} 
                                        isMe={true} 
                                    />
                                </View>
                                <View style={styles.legendContainer}>
                                     <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.success}]}/><Text style={styles.legendText}>&gt;90%</Text></View>
                                     <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.average}]}/><Text style={styles.legendText}>60-90%</Text></View>
                                     <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.poor}]}/><Text style={styles.legendText}>&lt;60%</Text></View>
                                </View>
                            </>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={styles.overviewContainer}>
                                    {processedData.data.map((item: any, index: number) => (
                                        <View key={index} style={styles.overviewGroup}>
                                            <Text style={styles.overviewSubjectTitle}>{item.subject.substring(0,3).toUpperCase()}</Text>
                                            <View style={styles.overviewBarPair}>
                                                <PerformanceBar 
                                                    data={item.topper} 
                                                    label="Top" 
                                                    color={COLORS.success} 
                                                    height={160} 
                                                    slim={true}
                                                />
                                                <PerformanceBar 
                                                    data={item.me} 
                                                    label="Me" 
                                                    color={COLORS.average} 
                                                    height={160} 
                                                    slim={true}
                                                    isMe={true}
                                                />
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        )}
                    </View>

                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingBottom: 40 },
    
    controlsSection: { padding: 20, paddingTop: 10 },
    label: { fontSize: 16, fontWeight: '700', color: COLORS.textMain, marginBottom: 8, marginTop: 10 }, 
    pickerContainer: { borderWidth: 1, borderColor: COLORS.textMain, borderRadius: 8, backgroundColor: COLORS.cardBg, height: 50, justifyContent: 'center', elevation: 2 },
    picker: { width: '100%', height: 50, color: COLORS.textMain },
    
    subjectsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
    subjectChip: { borderWidth: 1.5, borderColor: COLORS.textMain, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: COLORS.cardBg, minWidth: 70, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
    
    subjectChipActive: { backgroundColor: COLORS.selectedChip, borderColor: COLORS.selectedChip, elevation: 3 },
    subjectText: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
    subjectTextActive: { color: '#FFF' },

    subjectChipOverview: { borderColor: COLORS.overviewChip }, 
    subjectTextOverview: { color: COLORS.overviewChip },

    graphCard: { backgroundColor: COLORS.cardBg, margin: 15, marginTop: 30, padding: 20, paddingTop: 30, borderRadius: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, borderWidth: 1, borderColor: '#EEEEEE', minHeight: 380 },
    
    noDataText: { textAlign: 'center', marginTop: 50, color: COLORS.textSub },

    singleGraphContainer: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-end', height: 320, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },

    overviewContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 10 },
    overviewGroup: { marginRight: 25, alignItems: 'center', width: 100 }, 
    overviewSubjectTitle: { fontWeight: 'bold', fontSize: 14, marginBottom: 15, color: COLORS.textMain },
    overviewBarPair: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', height: 250, alignItems: 'flex-end', borderLeftWidth: 1, borderLeftColor: '#eee', paddingLeft: 5 },

    barWrapper: { alignItems: 'center', width: '35%', height: '100%', justifyContent: 'flex-end' },
    barWrapperSlim: { alignItems: 'center', width: '45%', height: '100%', justifyContent: 'flex-end' },

    statsHeader: { alignItems: 'center', marginBottom: 8, width: '100%', justifyContent: 'flex-end' },
    rankBadge: { backgroundColor: '#ECEFF1', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginBottom: 4 },
    rankText: { fontSize: 10, fontWeight: 'bold', color: '#455A64' },
    
    marksContainer: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 1 },
    marksText: { fontWeight: '800', color: COLORS.textMain },
    totalMarksText: { fontSize: 14, fontWeight: '600', color: COLORS.textSub },

    percentageText: { fontWeight: '700', marginBottom: 3 },

    // REMOVED 'width' from here to let the inline style control it dynamically
    barTrack: { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end', elevation: 1 },
    barFill: { width: '100%', borderRadius: 2 },
    
    barLabel: { marginTop: 12, textAlign: 'center', fontWeight: '600' },
    barLabelMe: { fontWeight: 'bold', textDecorationLine: 'underline' },

    legendContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 15 },
    legendItem: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    legendText: { fontSize: 11, color: COLORS.textSub, fontWeight: '500' }
});

export default MyPerformance;