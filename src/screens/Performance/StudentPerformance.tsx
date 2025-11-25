/**
 * File: src/screens/report/StudentPerformance.tsx
 * Purpose: View class-wise student performance.
 * Logic: Calculates percentage based ONLY on completed exams (exams with entered marks).
 * Updated: Strict Color Logic (<60 Red, 60-90 Blue, >90 Green).
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    Alert, TouchableOpacity, Modal, ScrollView, Animated, Easing, Dimensions,
    Platform, UIManager, LayoutAnimation, RefreshControl
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

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

// Max marks per subject for each exam type
const EXAM_MAX_SCORES: any = {
    'AT1': 25, 'UT1': 25, 'AT2': 25, 'UT2': 25,
    'AT3': 25, 'UT3': 25, 'AT4': 25, 'UT4': 25,
    'SA1': 100, 'SA2': 100, 'Pre-Final': 100
};

// Map API exam names to short codes
const EXAM_NAME_TO_CODE: any = {
    'Assignment-1': 'AT1', 'Unitest-1': 'UT1', 
    'Assignment-2': 'AT2', 'Unitest-2': 'UT2',
    'Assignment-3': 'AT3', 'Unitest-3': 'UT3', 
    'Assignment-4': 'AT4', 'Unitest-4': 'UT4',
    'SA1': 'SA1', 'SA2': 'SA2', 'Pre-Final': 'Pre-Final',
    'AT1': 'AT1', 'UT1': 'UT1', 'AT2': 'AT2', 'UT2': 'UT2',
    'AT3': 'AT3', 'UT3': 'UT3', 'AT4': 'AT4', 'UT4': 'UT4'
};

// Strict Order for display
const EXAM_ORDER = ['AT1', 'UT1', 'AT2', 'UT2', 'SA1', 'AT3', 'UT3', 'AT4', 'UT4', 'Pre-Final', 'SA2'];

// --- COLORS ---
const COLORS = {
    primary: '#00897B',    // Teal
    background: '#F5F7FA', // Light Grey-Blue
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    
    // UPDATED STATUS COLORS
    success: '#43A047',    // Green (> 90%)
    average: '#1E88E5',    // Blue (60% - 90%)
    poor: '#E53935',       // Red (< 60%)
    
    track: '#ECEFF1',      // Light Grey
    border: '#CFD8DC'
};

// --- COMPONENT: ANIMATED BAR ---
const AnimatedBar = ({ percentage, marks, label, color, height = 200 }: any) => {
    const animatedHeight = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animatedHeight, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: false,
            easing: Easing.out(Easing.poly(4)),
        }).start();
    }, [percentage]);

    const heightStyle = animatedHeight.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', `${percentage}%`]
    });

    return (
        <View style={[styles.barWrapper, { height: height }]}>
            <Text style={[styles.barLabelTop, { color: COLORS.textMain }]}>{Math.round(percentage)}%</Text>
            <View style={styles.barBackground}>
                <Animated.View style={[styles.barFill, { height: heightStyle, backgroundColor: color }]} />
                <View style={styles.barTextContainer}>
                    <Text style={styles.barInnerText} numberOfLines={1}>{marks}</Text>
                </View>
            </View>
            <Text style={styles.barLabelBottom} numberOfLines={1}>{label}</Text>
        </View>
    );
};

const StudentPerformance = () => {
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const [classList, setClassList] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState('');
    
    // Raw Data
    const [students, setStudents] = useState<any[]>([]);
    const [marksData, setMarksData] = useState<any[]>([]);
    
    // Filter State
    const [sortBy, setSortBy] = useState('roll_no');

    // Modals
    const [isGraphVisible, setIsGraphVisible] = useState(false);
    const [graphData, setGraphData] = useState<any>(null);
    const [isCompareVisible, setIsCompareVisible] = useState(false);
    const [compareExam, setCompareExam] = useState('Overall');

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
        if (selectedClass) fetchClassData(selectedClass);
    }, [selectedClass]);

    const fetchClassData = async (classGroup: string) => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/reports/class-data/${classGroup}`);
            setStudents(response.data.students || []);
            setMarksData(response.data.marks || []);
            setExpandedId(null);
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

    const toggleExpand = (id: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(expandedId === id ? null : id);
    };

    const handleOpenGraph = (title: string, exams: any[]) => {
        setGraphData({ title, exams });
        setIsGraphVisible(true);
    };

    // --- 3. Process Data (UPDATED LOGIC) ---
    const processedData = useMemo(() => {
        if (!selectedClass || students.length === 0) return [];

        const subjects = CLASS_SUBJECTS[selectedClass] || [];
        const subjectCount = subjects.length;

        // 1. Map Marks: student_id -> exam_code -> subject -> marks
        const marksMap: any = {};
        marksData.forEach(mark => {
            if (!marksMap[mark.student_id]) marksMap[mark.student_id] = {};
            const code = EXAM_NAME_TO_CODE[mark.exam_type];
            if (code) {
                if (!marksMap[mark.student_id][code]) marksMap[mark.student_id][code] = {};
                marksMap[mark.student_id][code][mark.subject] = mark.marks_obtained;
            }
        });

        // 2. Build Student Objects
        let results = students.map(student => {
            let studentTotalObtained = 0;
            let studentMaxTotal = 0; 
            const examBreakdown: any[] = [];

            // Iterate through fixed exam order
            EXAM_ORDER.forEach(examCode => {
                let examObtained = 0;
                let hasExamData = false;
                
                subjects.forEach((subject: string) => {
                    const val = marksMap[student.id]?.[examCode]?.[subject];
                    if (val !== undefined && val !== null && val !== '' && !isNaN(parseFloat(val))) {
                        examObtained += parseFloat(val);
                        hasExamData = true;
                    }
                });

                if (hasExamData) {
                    const examMax = (EXAM_MAX_SCORES[examCode] || 0) * subjectCount;
                    studentTotalObtained += examObtained;
                    studentMaxTotal += examMax;

                    const examPerc = examMax > 0 ? (examObtained / examMax) * 100 : 0;
                    
                    examBreakdown.push({
                        exam_type: examCode,
                        total_obtained: examObtained,
                        total_possible: examMax,
                        percentage: examPerc.toFixed(2)
                    });
                }
            });

            const percentage = studentMaxTotal > 0 ? ((studentTotalObtained / studentMaxTotal) * 100).toFixed(2) : 0;

            return {
                ...student,
                id: student.id,
                totalObtained: studentTotalObtained,
                maxTotal: studentMaxTotal, 
                percentage: parseFloat(percentage as string),
                examBreakdown,
                performanceRank: 0
            };
        });

        // 3. Assign Ranks
        results.sort((a, b) => b.totalObtained - a.totalObtained);
        results = results.map((item, index) => ({ ...item, performanceRank: index + 1 }));

        // 4. Final Sort
        if (sortBy === 'desc') {
            // Already sorted
        } else if (sortBy === 'asc') {
            results.sort((a, b) => a.totalObtained - b.totalObtained);
        } else {
            // Roll No
            results.sort((a, b) => {
                const rA = parseInt(a.roll_no, 10);
                const rB = parseInt(b.roll_no, 10);
                if(!isNaN(rA) && !isNaN(rB)) return rA - rB;
                return (a.roll_no || '').localeCompare(b.roll_no || '');
            });
        }

        const activeExamsSet = new Set();
        results.forEach(s => s.examBreakdown.forEach((e: any) => activeExamsSet.add(e.exam_type)));
        const activeExams = EXAM_ORDER.filter(e => activeExamsSet.has(e));

        return { students: results, activeExams };

    }, [selectedClass, students, marksData, sortBy]);

    const studentList = processedData.students || [];
    const availableExams = ['Overall', ...(processedData.activeExams || [])];

    // --- Comparison Data Logic ---
    const getComparisonData = () => {
        if (studentList.length === 0) return [];

        return studentList.map(student => {
            let ob = 0; let max = 0; let perc = 0;

            if (compareExam === 'Overall') {
                ob = student.totalObtained;
                max = student.maxTotal;
                perc = student.percentage;
            } else {
                const examData = student.examBreakdown.find((e: any) => e.exam_type === compareExam);
                if (examData) {
                    ob = examData.total_obtained;
                    max = examData.total_possible;
                    perc = parseFloat(examData.percentage);
                }
            }

            return {
                name: student.full_name,
                roll: student.roll_no,
                total_obtained: ob,
                total_possible: max,
                percentage: perc
            };
        })
        .filter(item => item.total_possible > 0)
        .sort((a, b) => b.percentage - a.percentage);
    };

    // --- Helpers ---
    
    // For Rank Strip (Position only)
    const getColorForRank = (rank: number) => {
        if (rank === 1) return COLORS.success;
        if (rank === 2) return COLORS.primary;
        if (rank === 3) return COLORS.average;
        return COLORS.textSub;
    };

    // UPDATED: Strict Logic (<60 Red, 60-90 Blue, >90 Green)
    const getStatusColor = (perc: number | string) => {
        const val = parseFloat(perc as string);
        if (val > 90) return COLORS.success; // Green
        if (val >= 60) return COLORS.average; // Blue
        return COLORS.poor; // Red
    };

    // --- Render Item ---
    const renderStudentItem = ({ item }: any) => {
        // Keep rank strip color based on rank #
        const rankColor = getColorForRank(item.performanceRank);
        
        // Use Strict Color Logic for actual performance stats
        const performanceColor = getStatusColor(item.percentage);
        
        const isExpanded = expandedId === item.id;

        return (
            <View style={styles.card}>
                <TouchableOpacity 
                    style={styles.cardContent} 
                    onPress={() => toggleExpand(item.id)}
                    activeOpacity={0.8}
                >
                    {/* Rank Strip (Color by Position) */}
                    <View style={[styles.rankStrip, { backgroundColor: rankColor }]}>
                        <Text style={styles.rankText}>#{item.performanceRank}</Text>
                    </View>

                    <View style={styles.cardBody}>
                        <View style={styles.cardTopRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.studentName}>{item.full_name}</Text>
                                <Text style={styles.rollNo}>Roll No: {item.roll_no}</Text>
                            </View>
                            {/* Circle Badge (Color by Performance %) */}
                            <View style={[styles.circleBadge, { borderColor: performanceColor }]}>
                                <Text style={[styles.circleText, { color: performanceColor }]}>{Math.round(item.percentage)}%</Text>
                            </View>
                        </View>

                        <Text style={styles.marksLabel}>
                            Total Marks: <Text style={styles.marksValue}>{Math.round(item.totalObtained)} / {Math.round(item.maxTotal)}</Text>
                        </Text>

                        {/* Progress Bar (Color by Performance %) */}
                        <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${Math.min(item.percentage, 100)}%`, backgroundColor: performanceColor }]} />
                        </View>

                        <View style={styles.expandRow}>
                            <Text style={styles.perfLabel}>{item.examBreakdown.length} Exams Recorded</Text>
                            <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textSub} />
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Expanded Details */}
                {isExpanded && (
                    <View style={styles.expandedSection}>
                        <View style={styles.detailHeader}>
                            <Text style={styles.detailTitle}>Exam Breakdown</Text>
                            <TouchableOpacity 
                                style={styles.iconButton} 
                                onPress={() => handleOpenGraph(item.full_name, item.examBreakdown)}
                            >
                                <Icon name="chart-bar" size={16} color="#fff" />
                                <Text style={styles.btnText}>GRAPH</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Breakdown Table */}
                        <View style={styles.breakdownContainer}>
                            <View style={styles.bdHeader}>
                                <Text style={[styles.bdHeaderTxt, { flex: 1.5 }]}>Exam</Text>
                                <Text style={[styles.bdHeaderTxt, { flex: 2, textAlign: 'center' }]}>Marks</Text>
                                <Text style={[styles.bdHeaderTxt, { flex: 1.5, textAlign: 'right' }]}>%</Text>
                            </View>
                            {item.examBreakdown.length > 0 ? (
                                item.examBreakdown.map((exam: any, idx: number) => (
                                    <View key={idx} style={styles.bdRow}>
                                        <Text style={[styles.bdTxt, { flex: 1.5, fontWeight: '600' }]}>{exam.exam_type}</Text>
                                        <Text style={[styles.bdTxt, { flex: 2, textAlign: 'center' }]}>
                                            {Math.round(exam.total_obtained)} / {Math.round(exam.total_possible)}
                                        </Text>
                                        <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                                            <View style={[styles.percentagePill, { backgroundColor: getStatusColor(parseFloat(exam.percentage)) }]}>
                                                <Text style={styles.pillText}>{Math.round(exam.percentage)}%</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <Text style={styles.emptyText}>No exams recorded yet.</Text>
                            )}
                        </View>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerContainer}>
                <View style={styles.headerTitleRow}>
                    <Text style={styles.headerTitle}>Class Performance</Text>
                    <TouchableOpacity style={styles.compareBtn} onPress={() => setIsCompareVisible(true)}>
                        <Icon name="scale-balance" size={16} color="#fff" />
                        <Text style={styles.compareBtnText}>COMPARE</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.filterContainer}>
                    <View style={styles.filterBox}>
                        <Picker selectedValue={selectedClass} onValueChange={setSelectedClass} style={styles.picker}>
                            {classList.map(c => <Picker.Item key={c} label={c} value={c} />)}
                        </Picker>
                    </View>
                    <View style={styles.filterBox}>
                        <Picker selectedValue={sortBy} onValueChange={setSortBy} style={styles.picker}>
                            <Picker.Item label="Roll No" value="roll_no" />
                            <Picker.Item label="High to Low" value="desc" />
                            <Picker.Item label="Low to High" value="asc" />
                        </Picker>
                    </View>
                </View>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>
            ) : (
                <FlatList
                    data={studentList}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderStudentItem}
                    contentContainerStyle={styles.listPadding}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                    ListEmptyComponent={<Text style={styles.emptyText}>No student data found.</Text>}
                />
            )}

            {/* --- MODAL: INDIVIDUAL GRAPH --- */}
            <Modal visible={isGraphVisible} transparent={true} animationType="fade" onRequestClose={() => setIsGraphVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.graphModalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalHeaderTitle}>Performance Stats</Text>
                            <TouchableOpacity onPress={() => setIsGraphVisible(false)}>
                                <Icon name="close-circle-outline" size={28} color={COLORS.textSub} />
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={styles.graphSubTitle}>{graphData?.title}</Text>

                        <View style={styles.graphViewArea}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'flex-end' }}>
                                {graphData?.exams && graphData.exams.length > 0 ? graphData.exams.map((exam: any, idx: number) => (
                                    <AnimatedBar 
                                        key={idx} 
                                        percentage={parseFloat(exam.percentage)} 
                                        marks={`${Math.round(exam.total_obtained)}/${Math.round(exam.total_possible)}`}
                                        label={exam.exam_type} 
                                        color={getStatusColor(parseFloat(exam.percentage))}
                                        height={240}
                                    />
                                )) : <Text style={styles.noDataTxt}>No exams completed.</Text>}
                            </ScrollView>
                        </View>

                        {/* UPDATED LEGEND */}
                        <View style={styles.legendRow}>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.success}]} /><Text style={styles.legendTxt}>{">"} 90% (Good)</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.average}]} /><Text style={styles.legendTxt}>60% - 90% (Avg)</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.poor}]} /><Text style={styles.legendTxt}>{"<"} 60% (Poor)</Text></View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* --- MODAL: COMPARISON --- */}
            <Modal visible={isCompareVisible} animationType="slide" onRequestClose={() => setIsCompareVisible(false)}>
                <View style={styles.fullScreenContainer}>
                    <View style={styles.fsHeader}>
                        <Text style={styles.fsTitle}>Student Comparison</Text>
                        <TouchableOpacity onPress={() => setIsCompareVisible(false)} style={styles.closeFsBtn}>
                            <Icon name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.compareControls}>
                        <Text style={styles.controlLabel}>Select Comparison Criterion:</Text>
                        <View style={styles.controlPicker}>
                            <Picker selectedValue={compareExam} onValueChange={setCompareExam}>
                                {availableExams.map(t => <Picker.Item key={t} label={t} value={t} />)}
                            </Picker>
                        </View>
                    </View>

                    <View style={styles.compareGraphArea}>
                        <Text style={styles.compareGraphTitle}>Ranking by {compareExam}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, alignItems: 'flex-end' }}>
                            {getComparisonData().length > 0 ? (
                                getComparisonData().map((item, idx) => {
                                    const firstName = item.name.split(' ')[0];
                                    return (
                                        <AnimatedBar 
                                            key={idx}
                                            percentage={item.percentage}
                                            marks={`${Math.round(item.total_obtained)}/${Math.round(item.total_possible)}`}
                                            label={`${item.roll ? item.roll + '.' : ''} ${firstName}`}
                                            color={getStatusColor(item.percentage)}
                                            height={320}
                                        />
                                    );
                                })
                            ) : (
                                <View style={styles.noDataContainer}><Text style={styles.noDataTxt}>No data available for {compareExam}.</Text></View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    // Layout
    container: { flex: 1, backgroundColor: COLORS.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listPadding: { padding: 15, paddingBottom: 40 },
    emptyText: { textAlign: 'center', color: COLORS.textSub, marginTop: 30 },

    // Header
    headerContainer: { backgroundColor: '#FFF', padding: 15, paddingBottom: 10, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 4 },
    headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
    compareBtn: { flexDirection: 'row', backgroundColor: '#D81B60', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 25, alignItems: 'center', elevation: 3 },
    compareBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 11, marginLeft: 6 },
    
    filterContainer: { flexDirection: 'row', gap: 12 },
    filterBox: { flex: 1, backgroundColor: '#F0F2F5', borderRadius: 10, borderWidth: 1, borderColor: '#E0E0E0', height: 45, justifyContent: 'center' },
    picker: { width: '100%', color: COLORS.textMain },

    // Card
    card: { backgroundColor: COLORS.cardBg, borderRadius: 12, marginBottom: 15, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3, overflow: 'hidden' },
    cardContent: { flexDirection: 'row' },
    rankStrip: { width: 36, justifyContent: 'center', alignItems: 'center' },
    rankText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, transform: [{ rotate: '-90deg' }], width: 60, textAlign: 'center' },
    cardBody: { flex: 1, padding: 15 },
    
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
    studentName: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
    rollNo: { fontSize: 13, color: COLORS.textSub, marginTop: 2 },
    
    circleBadge: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
    circleText: { fontSize: 13, fontWeight: 'bold' },

    marksLabel: { fontSize: 12, color: COLORS.textSub, marginTop: 8, marginBottom: 4 },
    marksValue: { fontWeight: 'bold', color: COLORS.textMain },
    progressTrack: { height: 6, backgroundColor: COLORS.track, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
    progressFill: { height: '100%', borderRadius: 3 },
    
    expandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    perfLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSub },

    // Expanded
    expandedSection: { backgroundColor: '#FAFAFA', borderTopWidth: 1, borderTopColor: '#EEE', padding: 15 },
    detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    detailTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary },
    iconButton: { flexDirection: 'row', backgroundColor: '#FB8C00', padding: 6, borderRadius: 6, alignItems: 'center' },
    btnText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', marginLeft: 5 },

    breakdownContainer: { paddingHorizontal: 4 },
    bdHeader: { flexDirection: 'row', marginBottom: 6, backgroundColor: '#F9FAFB', paddingVertical: 6, borderRadius: 4 },
    bdHeaderTxt: { fontSize: 11, fontWeight: '700', color: COLORS.textSub },
    bdRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', alignItems: 'center' },
    bdTxt: { fontSize: 12, color: COLORS.textMain },
    percentagePill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10 },
    pillText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    graphModalCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 16, padding: 20, elevation: 10 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
    graphSubTitle: { textAlign: 'center', color: COLORS.textSub, marginBottom: 15, fontSize: 14, fontWeight: '500' },
    graphViewArea: { height: 250, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 10 },

    fullScreenContainer: { flex: 1, backgroundColor: COLORS.background },
    fsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', elevation: 3 },
    fsTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
    closeFsBtn: { padding: 4 },
    compareControls: { padding: 16, backgroundColor: '#FFF', marginBottom: 10 },
    controlLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSub, marginBottom: 6 },
    controlPicker: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: '#FAFAFA', height: 45, justifyContent: 'center' },
    compareGraphArea: { flex: 1, paddingVertical: 20 },
    compareGraphTitle: { textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: COLORS.primary, marginBottom: 20 },
    noDataContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', width: SCREEN_WIDTH },
    noDataTxt: { marginTop: 10, color: COLORS.textSub },

    // Animated Bar
    barWrapper: { width: 55, alignItems: 'center', justifyContent: 'flex-end', marginHorizontal: 8 },
    barLabelTop: { marginBottom: 4, fontSize: 12, fontWeight: 'bold', textAlign: 'center', color: COLORS.textMain },
    barBackground: { width: 30, height: '80%', backgroundColor: COLORS.track, borderRadius: 15, overflow: 'hidden', justifyContent: 'flex-end', position: 'relative' },
    barFill: { width: '100%', borderRadius: 15 },
    barTextContainer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    barInnerText: { fontSize: 10, fontWeight: 'bold', color: '#455A64', transform: [{ rotate: '-90deg' }], width: 120, textAlign: 'center' },
    barLabelBottom: { marginTop: 8, fontSize: 11, fontWeight: '600', color: COLORS.textMain, textAlign: 'center', width: '100%' },

    legendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 15 },
    legendItem: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
    legendTxt: { fontSize: 12, color: COLORS.textSub }
});

export default StudentPerformance;