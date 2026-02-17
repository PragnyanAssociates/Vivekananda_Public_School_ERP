/**
 * File: src/screens/report/MyPerformance.tsx
 * Purpose: Student view to compare performance.
 * Updated: Responsive Design & Dark/Light Mode Support.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
    ScrollView, Animated, Easing, RefreshControl, Dimensions, SafeAreaView,
    useColorScheme, StatusBar
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// --- Constants ---
const { width } = Dimensions.get('window');

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

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#E0E0E0',
    iconBg: '#E0F2F1',
    
    // Performance Specific
    success: '#43A047',
    average: '#1E88E5',
    poor: '#E53935',
    
    noteBg: '#FFF8E1',     
    noteBorder: '#FFE0B2', 
    noteTitle: '#1E88E5',
    
    rankBg: '#ECEFF1',     
    rankText: '#37474F',   
    
    barTrack: '#FAFAFA',
    barTrackBorder: '#E0E0E0',

    chipBg: '#FFFFFF',
    chipBorder: '#ccc',
    selectedChip: '#3d72f8',
    selectedChipText: '#FFF',
    
    inputBg: '#FFFFFF'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212', 
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    iconBg: '#333333',
    
    // Performance Specific
    success: '#66BB6A',
    average: '#42A5F5',
    poor: '#EF5350',
    
    noteBg: '#2C2C2C',     
    noteBorder: '#444', 
    noteTitle: '#64B5F6',
    
    rankBg: '#333333',     
    rankText: '#B0B0B0',   
    
    barTrack: '#2C2C2C',
    barTrackBorder: '#444444',

    chipBg: '#2C2C2C',
    chipBorder: '#444444',
    selectedChip: '#b278f5',
    selectedChipText: '#FFF',

    inputBg: '#2C2C2C'
};

// --- HELPER: CUSTOM ROUNDING ---
const getRoundedPercentage = (value: number | string): number => {
    const floatVal = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(floatVal)) return 0;
    const decimalPart = floatVal - Math.floor(floatVal);
    return decimalPart > 0.5 ? Math.ceil(floatVal) : Math.floor(floatVal);
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
const PerformanceBar = ({ data, label, theme, showRank = true, slim = false }: any) => {
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

    // Helper to get color based on percentage
    const getColorForPercentage = (percentage: number) => {
        if (percentage >= 85) return theme.success; 
        if (percentage >= 50) return theme.average; 
        return theme.poor;                          
    };

    const dynamicColor = getColorForPercentage(data.percentage);
    const labelSize = slim ? 11 : 13;
    const marksSize = slim ? 14 : 18;

    return (
        <View style={slim ? styles.barWrapperSlim : styles.barWrapper}>
            <View style={styles.statsHeader}>
                {showRank && (
                    <View style={[styles.rankBadge, { backgroundColor: theme.rankBg, borderColor: theme.border }]}>
                        <Text style={[styles.rankText, { color: theme.rankText }]} numberOfLines={1}>#{data.rank}</Text>
                    </View>
                )}
                
                <View style={styles.marksContainer}>
                    <Text style={[styles.marksText, { fontSize: marksSize, color: theme.textMain }]}>{Math.round(data.obtained)}</Text>
                    <Text style={[styles.totalMarksText, { fontSize: slim ? 10 : 13, color: theme.textSub }]}>/{Math.round(data.total)}</Text>
                </View>

                <Text style={[styles.percentageText, { color: dynamicColor, fontSize: slim ? 10 : 12 }]}>
                    {data.percentage}%
                </Text>
            </View>

            <View style={[styles.barTrack, { height: slim ? '60%' : '65%', width: slim ? '80%' : '40%', backgroundColor: theme.barTrack, borderColor: theme.barTrackBorder }]}>
                <Animated.View style={[styles.barFill, { height: fillHeight, backgroundColor: dynamicColor }]} />
            </View>

            <Text style={[styles.barLabel, { fontSize: labelSize, color: label === 'My Marks' || label === 'Me' ? theme.textMain : theme.textSub }]} numberOfLines={1}>
                {label}
            </Text>
        </View>
    );
};

const MyPerformance = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

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
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.textMain }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialCommunityIcons name="poll" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>My Performance</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Analytics</Text>
                    </View>
                </View>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
            ) : (
                <ScrollView 
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
                >
                    <View style={styles.controlsSection}>
                        <Text style={[styles.label, { color: theme.textSub }]}>Select Exam:</Text>
                        <View style={[styles.pickerContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                            <Picker
                                selectedValue={selectedExam}
                                onValueChange={setSelectedExam}
                                style={[styles.picker, { color: theme.textMain }]}
                                dropdownIconColor={theme.textMain}
                            >
                                {EXAM_OPTIONS.map(exam => <Picker.Item key={exam} label={exam} value={exam} style={{fontSize: 14, color: theme.textMain}} />)}
                            </Picker>
                        </View>

                        <Text style={[styles.label, { marginTop: 20, color: theme.textSub }]}>Select Subject:</Text>
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
                                            { backgroundColor: theme.chipBg, borderColor: theme.chipBorder },
                                            isSelected && { backgroundColor: theme.selectedChip, borderColor: theme.selectedChip },
                                            isOverview && { borderColor: theme.textMain }
                                        ]}
                                        onPress={() => setSelectedSubject(subject)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[
                                            styles.subjectText, 
                                            { color: theme.textSub },
                                            isSelected && { color: theme.selectedChipText },
                                            isOverview && { color: theme.textMain }
                                        ]}>
                                            {shortName}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    <View style={[styles.graphCard, { backgroundColor: theme.cardBg }]}>
                        
                        {/* --- DYNAMIC NOTE SECTION --- */}
                        <View style={[styles.noteCard, { backgroundColor: theme.noteBg, borderColor: theme.noteBorder }]}>
                            <View style={[styles.noteHeader, { borderBottomColor: theme.noteBorder }]}>
                                <Text style={[styles.noteTitle, { color: theme.noteTitle }]}>Performance Guide :-</Text>
                            </View>

                            <View style={styles.noteGrid}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.colorBox, { backgroundColor: theme.success }]} />
                                    <Text style={[styles.legendText, { color: theme.textMain }]}>&gt;85% (Excel)</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.colorBox, { backgroundColor: theme.average }]} />
                                    <Text style={[styles.legendText, { color: theme.textMain }]}>50-85% (Avg)</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.colorBox, { backgroundColor: theme.poor }]} />
                                    <Text style={[styles.legendText, { color: theme.textMain }]}>&lt;50% (Poor)</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.miniRankBadge, { backgroundColor: theme.rankBg, borderColor: theme.border }]}>
                                        <Text style={[styles.miniRankText, { color: theme.rankText }]}>#1</Text>
                                    </View>
                                    <Text style={[styles.legendText, { color: theme.textMain }]}>Rank</Text>
                                </View>
                            </View>
                        </View>

                        {!processedData ? (
                            <Text style={[styles.noDataText, { color: theme.textSub }]}>Loading...</Text>
                        ) : processedData.mode === 'Single' ? (
                            <>
                                <View style={[styles.singleGraphContainer, { borderBottomColor: theme.border }]}>
                                    <PerformanceBar 
                                        data={processedData.data.topper} 
                                        label="Topper" 
                                        theme={theme}
                                    />
                                    <PerformanceBar 
                                        data={processedData.data.me} 
                                        label="My Marks" 
                                        theme={theme}
                                    />
                                </View>
                            </>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={styles.overviewContainer}>
                                    {processedData.data.map((item: any, index: number) => (
                                        <View key={index} style={styles.overviewGroup}>
                                            <Text style={[styles.overviewSubjectTitle, { color: theme.textMain }]}>{item.subject.substring(0,3).toUpperCase()}</Text>
                                            <View style={[styles.overviewBarPair, { borderLeftColor: theme.border }]}>
                                                <PerformanceBar data={item.topper} label="Top" height={160} slim={true} theme={theme} />
                                                <PerformanceBar data={item.me} label="Me" height={160} slim={true} theme={theme} />
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
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingBottom: 40 },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
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
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },

    controlsSection: { paddingHorizontal: 20, paddingTop: 10 },
    label: { fontSize: 14, fontWeight: '700', marginBottom: 5, marginTop: 10, textTransform: 'uppercase' }, 
    
    pickerContainer: { borderWidth: 1, borderRadius: 8, height: 45, justifyContent: 'center', elevation: 1 },
    picker: { width: '100%', height: 48 },
    
    subjectsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
    subjectChip: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, minWidth: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
    
    subjectText: { fontSize: 12, fontWeight: '700' },

    graphCard: { margin: 15, marginTop: 10, padding: 20, borderRadius: 20, elevation: 5, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, minHeight: 380 },
    
    // Note Styles
    noteCard: { borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1 },
    noteHeader: { marginBottom: 8, borderBottomWidth: 1, paddingBottom: 5 },
    noteTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase' },
    
    noteGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    legendItem: { flexDirection: 'row', alignItems: 'center', width: '48%', marginBottom: 6 },
    colorBox: { width: 14, height: 14, borderRadius: 3, marginRight: 8 },
    
    miniRankBadge: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6, borderWidth: 1, marginRight: 8, minWidth: 20, alignItems: 'center' },
    miniRankText: { fontSize: 9, fontWeight: 'bold' },
    
    legendText: { fontSize: 11, fontWeight: '600' },
    noDataText: { textAlign: 'center', marginTop: 50 },

    singleGraphContainer: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-end', height: 320, paddingBottom: 10, borderBottomWidth: 1 },
    overviewContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 10 },
    overviewGroup: { marginRight: 20, alignItems: 'center', width: 110 }, 
    overviewSubjectTitle: { fontWeight: 'bold', fontSize: 14, marginBottom: 15 },
    overviewBarPair: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', height: 250, alignItems: 'flex-end', borderLeftWidth: 1, paddingLeft: 5 },

    barWrapper: { alignItems: 'center', width: '35%', height: '100%', justifyContent: 'flex-end' },
    barWrapperSlim: { alignItems: 'center', width: '45%', height: '100%', justifyContent: 'flex-end' },
    statsHeader: { alignItems: 'center', marginBottom: 8, width: '100%', justifyContent: 'flex-end' },
    
    rankBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, marginBottom: 6, borderWidth: 1, minWidth: 30, alignItems: 'center', justifyContent: 'center' },
    rankText: { fontSize: 12, fontWeight: 'bold' },
    
    marksContainer: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 1 },
    marksText: { fontWeight: '800' },
    totalMarksText: { fontSize: 14, fontWeight: '600' },
    percentageText: { fontWeight: '700', marginBottom: 3 },
    barTrack: { borderWidth: 1, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end', elevation: 1 },
    barFill: { width: '100%', borderRadius: 2 },
    barLabel: { marginTop: 12, textAlign: 'center', fontWeight: '600' },
});

export default MyPerformance;