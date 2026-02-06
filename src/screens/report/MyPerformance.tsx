/**
 * File: src/screens/report/MyPerformance.tsx
 * Purpose: Student view to compare performance.
 * Updated: Header Card Design Implementation.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
    ScrollView, Animated, Easing, RefreshControl, Dimensions, SafeAreaView
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

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

// --- COLORS ---
const COLORS = {
    primary: '#008080',    // Teal
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    
    success: '#43A047',    // Green (85% - 100%)
    average: '#1E88E5',    // Orange (50% - 85%)
    poor: '#E53935',       // Red (0% - 50%)
    
    noteBg: '#FFF8E1',     
    noteBorder: '#FFE0B2', 
    
    rankBg: '#ECEFF1',     
    rankText: '#37474F',   
    
    selectedChip: '#b278f5', // Updated to match Theme
    overviewChip: '#222323' 
};

// --- HELPER: CUSTOM ROUNDING ---
const getRoundedPercentage = (value: number | string): number => {
    const floatVal = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(floatVal)) return 0;
    const decimalPart = floatVal - Math.floor(floatVal);
    return decimalPart > 0.5 ? Math.ceil(floatVal) : Math.floor(floatVal);
};

// --- Helper: Get Color Based on Percentage ---
const getColorForPercentage = (percentage: number) => {
    if (percentage >= 85) return COLORS.success; 
    if (percentage >= 50) return COLORS.average; 
    return COLORS.poor;                          
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
    const classResults = students.map((student: any) => {
        let totalObtained = 0;
        let totalPossible = 0;
        const studentMarks = marks.filter((m: any) => m.student_id === student.id);

        if (subject === 'All Subjects') {
             // Logic handled in main component usually
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

        const rawPercentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;
        const percentage = getRoundedPercentage(rawPercentage);

        return {
            id: student.id,
            obtained: totalObtained,
            total: totalPossible,
            percentage: percentage
        };
    });

    classResults.sort((a: any, b: any) => b.obtained - a.obtained);
    const rankedResults = classResults.map((item: any, index: number) => ({ ...item, rank: index + 1 }));

    const topper = rankedResults[0] || { obtained: 0, percentage: 0, rank: '-', total: 0 };
    const me = rankedResults.find((r: any) => r.id === myId) || { obtained: 0, percentage: 0, rank: '-', total: 0 };

    return { topper, me };
};


// --- COMPONENT: ANIMATED BAR ---
const PerformanceBar = ({ data, label, showRank = true, slim = false }: any) => {
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

    const dynamicColor = getColorForPercentage(data.percentage);
    const labelSize = slim ? 11 : 13;
    const marksSize = slim ? 14 : 18;

    return (
        <View style={slim ? styles.barWrapperSlim : styles.barWrapper}>
            <View style={styles.statsHeader}>
                {showRank && (
                    <View style={styles.rankBadge}>
                        <Text style={styles.rankText} numberOfLines={1}>#{data.rank}</Text>
                    </View>
                )}
                
                <View style={styles.marksContainer}>
                    <Text style={[styles.marksText, { fontSize: marksSize }]}>{Math.round(data.obtained)}</Text>
                    <Text style={[styles.totalMarksText, { fontSize: slim ? 10 : 13 }]}>/{Math.round(data.total)}</Text>
                </View>

                <Text style={[styles.percentageText, { color: dynamicColor, fontSize: slim ? 10 : 12 }]}>
                    {data.percentage}%
                </Text>
            </View>

            <View style={[styles.barTrack, { height: slim ? '60%' : '65%', width: slim ? '80%' : '40%' }]}>
                <Animated.View style={[styles.barFill, { height: fillHeight, backgroundColor: dynamicColor }]} />
            </View>

            <Text style={[styles.barLabel, { fontSize: labelSize, color: label === 'My Marks' || label === 'Me' ? COLORS.textMain : COLORS.textSub }]} numberOfLines={1}>
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
                    
                    const rawPerc = totalPossible > 0 ? (totalObtained/totalPossible)*100 : 0;
                    const perc = getRoundedPercentage(rawPerc);
                    
                    return { id: student.id, obtained: totalObtained, total: totalPossible, percentage: perc };
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
        <SafeAreaView style={styles.container}>
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialCommunityIcons name="poll" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>My Performance</Text>
                        <Text style={styles.headerSubtitle}>Analytics</Text>
                    </View>
                </View>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
            ) : (
                <ScrollView 
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    <View style={styles.controlsSection}>
                        <Text style={styles.label}>Select Exam:</Text>
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

                        <Text style={[styles.label, { marginTop: 20 }]}>Select Subject:</Text>
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
                        
                        {/* --- DYNAMIC NOTE SECTION --- */}
                        <View style={styles.noteCard}>
                            <View style={styles.noteHeader}>
                                <Text style={styles.noteTitle}>Performance Guide :-</Text>
                            </View>

                            <View style={styles.noteGrid}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.colorBox, { backgroundColor: COLORS.success }]} />
                                    <Text style={styles.legendText}>&gt;85% (Excel)</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.colorBox, { backgroundColor: COLORS.average }]} />
                                    <Text style={styles.legendText}>50-85% (Avg)</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.colorBox, { backgroundColor: COLORS.poor }]} />
                                    <Text style={styles.legendText}>&lt;50% (Poor)</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={styles.miniRankBadge}>
                                        <Text style={styles.miniRankText}>#1</Text>
                                    </View>
                                    <Text style={styles.legendText}>Rank in Class</Text>
                                </View>
                            </View>
                        </View>

                        {!processedData ? (
                            <Text style={styles.noDataText}>Loading...</Text>
                        ) : processedData.mode === 'Single' ? (
                            <>
                                <View style={styles.singleGraphContainer}>
                                    <PerformanceBar 
                                        data={processedData.data.topper} 
                                        label="Topper" 
                                    />
                                    <PerformanceBar 
                                        data={processedData.data.me} 
                                        label="My Marks" 
                                    />
                                </View>
                            </>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={styles.overviewContainer}>
                                    {processedData.data.map((item: any, index: number) => (
                                        <View key={index} style={styles.overviewGroup}>
                                            <Text style={styles.overviewSubjectTitle}>{item.subject.substring(0,3).toUpperCase()}</Text>
                                            <View style={styles.overviewBarPair}>
                                                <PerformanceBar data={item.topper} label="Top" height={160} slim={true} />
                                                <PerformanceBar data={item.me} label="Me" height={160} slim={true} />
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        )}
                    </View>

                </ScrollView>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingBottom: 40 },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: COLORS.cardBg,
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 3,
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        backgroundColor: '#E0F2F1', // Teal bg
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
    headerSubtitle: { fontSize: 13, color: COLORS.textSub },

    controlsSection: { paddingHorizontal: 20, paddingTop: 10 },
    label: { fontSize: 14, fontWeight: '700', color: COLORS.textSub, marginBottom: 5, marginTop: 10, textTransform: 'uppercase' }, 
    
    pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, backgroundColor: COLORS.cardBg, height: 45, justifyContent: 'center', elevation: 1 },
    picker: { width: '100%', height: 48, color: COLORS.textMain },
    
    subjectsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
    subjectChip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#fff', minWidth: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
    
    subjectChipActive: { backgroundColor: COLORS.selectedChip, borderColor: COLORS.selectedChip, elevation: 2 },
    subjectText: { fontSize: 12, fontWeight: '700', color: COLORS.textSub },
    subjectTextActive: { color: '#FFF' },

    subjectChipOverview: { borderColor: COLORS.overviewChip }, 
    subjectTextOverview: { color: COLORS.overviewChip },

    graphCard: { backgroundColor: COLORS.cardBg, margin: 15, marginTop: 10, padding: 20, borderRadius: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, minHeight: 380 },
    
    // Note Styles
    noteCard: { backgroundColor: COLORS.noteBg, borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: COLORS.noteBorder },
    noteHeader: { marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#FFE0B2', paddingBottom: 5 },
    noteTitle: { fontSize: 14, fontWeight: '800', color: '#1E88E5', textTransform: 'uppercase' },
    
    noteGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    legendItem: { flexDirection: 'row', alignItems: 'center', width: '48%', marginBottom: 6 },
    colorBox: { width: 14, height: 14, borderRadius: 3, marginRight: 8 },
    
    miniRankBadge: { backgroundColor: '#ECEFF1', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6, borderWidth: 1, borderColor: '#B0BEC5', marginRight: 8, minWidth: 20, alignItems: 'center' },
    miniRankText: { fontSize: 9, fontWeight: 'bold', color: '#455A64' },
    
    legendText: { fontSize: 11, color: COLORS.textMain, fontWeight: '600' },
    noDataText: { textAlign: 'center', marginTop: 50, color: COLORS.textSub },

    singleGraphContainer: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-end', height: 320, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
    overviewContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 10 },
    overviewGroup: { marginRight: 20, alignItems: 'center', width: 110 }, 
    overviewSubjectTitle: { fontWeight: 'bold', fontSize: 14, marginBottom: 15, color: COLORS.textMain },
    overviewBarPair: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', height: 250, alignItems: 'flex-end', borderLeftWidth: 1, borderLeftColor: '#eee', paddingLeft: 5 },

    barWrapper: { alignItems: 'center', width: '35%', height: '100%', justifyContent: 'flex-end' },
    barWrapperSlim: { alignItems: 'center', width: '45%', height: '100%', justifyContent: 'flex-end' },
    statsHeader: { alignItems: 'center', marginBottom: 8, width: '100%', justifyContent: 'flex-end' },
    
    rankBadge: { backgroundColor: '#ECEFF1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: '#B0BEC5', minWidth: 30, alignItems: 'center', justifyContent: 'center' },
    rankText: { fontSize: 12, fontWeight: 'bold', color: '#455A64' },
    
    marksContainer: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 1 },
    marksText: { fontWeight: '800', color: COLORS.textMain },
    totalMarksText: { fontSize: 14, fontWeight: '600', color: COLORS.textSub },
    percentageText: { fontWeight: '700', marginBottom: 3 },
    barTrack: { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end', elevation: 1 },
    barFill: { width: '100%', borderRadius: 2 },
    barLabel: { marginTop: 12, textAlign: 'center', fontWeight: '600' },
});

export default MyPerformance;