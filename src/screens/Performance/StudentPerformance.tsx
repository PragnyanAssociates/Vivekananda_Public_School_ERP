/**
 * File: src/screens/report/StudentPerformance.tsx
 * Purpose: View class-wise student performance.
 * Updated: Responsive Design & Dark/Light Mode Support.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    TouchableOpacity, Modal, ScrollView, Animated, Easing, Dimensions,
    Platform, UIManager, LayoutAnimation, RefreshControl, StatusBar, useColorScheme
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
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
const SCREEN_HEIGHT = Dimensions.get('window').height;

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
    'AT3': 'AT3', 'UT3': 'UT3', 'AT4': 'AT4', 'UT4': 'UT4'
};

const EXAM_ORDER = ['AT1', 'UT1', 'AT2', 'UT2', 'SA1', 'AT3', 'UT3', 'AT4', 'UT4', 'Pre-Final', 'SA2'];

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',    
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    
    success: '#43A047',    
    average: '#1E88E5',    
    poor: '#E53935',       
    
    graphIcon: '#D32F2F',  
    border: '#CFD8DC',
    inputBg: '#FAFAFA',
    track: '#EDF2F7',
    modalOverlay: 'rgba(0,0,0,0.6)',
    headerIconBg: '#E0F2F1',
    tableHeader: '#008080',
    tableRowAlt: '#F9FAFB',
    expandedBg: '#FAFAFA',
    detailBorder: '#F0F0F0',
    bdHeaderBg: '#F9FAFB',
    summaryBg: '#fefefd',
    summaryBorder: '#8675e7'
};

const DarkColors = {
    primary: '#008080',    
    background: '#121212', 
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    
    success: '#43A047',    
    average: '#1E88E5',    
    poor: '#E53935',       
    
    graphIcon: '#EF5350',  
    border: '#333333',
    inputBg: '#2C2C2C',
    track: '#333333',
    modalOverlay: 'rgba(255,255,255,0.1)',
    headerIconBg: '#333333',
    tableHeader: '#004D40',
    tableRowAlt: '#2C2C2C',
    expandedBg: '#252525',
    detailBorder: '#333333',
    bdHeaderBg: '#2C2C2C',
    summaryBg: '#2C2C2C',
    summaryBorder: '#5E35B1'
};

// --- HELPER ---
const getRoundedPercentage = (value: number | string): number => {
    const floatVal = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(floatVal)) return 0;
    const decimalPart = floatVal - Math.floor(floatVal);
    return decimalPart > 0.5 ? Math.ceil(floatVal) : Math.floor(floatVal);
};

const getStatusColor = (perc: number | string, colors: any) => {
    const val = getRoundedPercentage(perc);
    if (val >= 85) return colors.success; 
    if (val >= 50) return colors.average;
    return colors.poor; 
};

// --- COMPONENT: ANIMATED BAR ---
const AnimatedBar = ({ percentage, marks, label, color, height = 220, colors }: any) => {
    const animatedHeight = useRef(new Animated.Value(0)).current;
    const displayPercentage = getRoundedPercentage(percentage);

    useEffect(() => {
        Animated.timing(animatedHeight, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
            easing: Easing.out(Easing.poly(4)),
        }).start();
    }, [percentage]);

    const heightStyle = animatedHeight.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', `${displayPercentage}%`]
    });

    return (
        <View style={[styles.barWrapper, { height: height }]}>
            <Text style={[styles.barLabelTop, { color: colors.textMain }]}>{displayPercentage}%</Text>
            <View style={[styles.barBackground, { backgroundColor: colors.track }]}>
                <Animated.View style={[styles.barFill, { height: heightStyle, backgroundColor: color }]} />
                <View style={styles.barTextContainer}>
                    <Text style={[styles.barInnerText, { color: colors.textMain }]} numberOfLines={1}>{marks}</Text>
                </View>
            </View>
            <Text style={[styles.barLabelBottom, { color: colors.textMain }]} numberOfLines={1}>{label}</Text>
        </View>
    );
};

const StudentPerformance = () => {
    // Theme Hook
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    // Navigation Hook
    const navigation = useNavigation();

    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    // View State
    const [isTableView, setIsTableView] = useState(false);

    const [classList, setClassList] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState('');
    
    // Data
    const [students, setStudents] = useState<any[]>([]);
    const [marksData, setMarksData] = useState<any[]>([]);
    const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]); 
    const [attendanceMap, setAttendanceMap] = useState<any>({}); 

    // Specific Student Attendance Data (for graph)
    const [studentMonthlyAtt, setStudentMonthlyAtt] = useState<any[]>([]);
    const [loadingAttGraph, setLoadingAttGraph] = useState(false);
    
    // Main View Filter State
    const [sortBy, setSortBy] = useState('roll_no');

    // Modals
    const [isGraphVisible, setIsGraphVisible] = useState(false); // For Exams
    const [graphData, setGraphData] = useState<any>(null);
    
    const [isAttGraphVisible, setIsAttGraphVisible] = useState(false); // For Attendance
    const [attGraphData, setAttGraphData] = useState<any>(null);

    const [isCompareVisible, setIsCompareVisible] = useState(false);
    
    // Comparison State
    const [compareExam, setCompareExam] = useState('Overall');
    const [compareSubject, setCompareSubject] = useState('All Subjects');
    const [compareSortBy, setCompareSortBy] = useState('desc'); // 'desc' = High to Low, 'asc' = Low to High, 'roll' = Roll No

    // --- FETCH DATA ---
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

    useEffect(() => {
        if (selectedClass) {
            fetchAllData(selectedClass);
            setCompareSubject('All Subjects');
        }
    }, [selectedClass]);

    const fetchAllData = async (classGroup: string) => {
        setLoading(true);
        try {
            await Promise.all([
                fetchClassPerformanceData(classGroup),
                fetchAttendanceData(classGroup)
            ]);
            setExpandedId(null);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchClassPerformanceData = async (classGroup: string) => {
        try {
            const response = await apiClient.get(`/reports/class-data/${classGroup}`);
            setStudents(response.data.students || []);
            setMarksData(response.data.marks || []);
            setTeacherAssignments(response.data.assignments || []);
        } catch (error) {
            console.error('Error fetching marks:', error);
        }
    };

    const fetchAttendanceData = async (classGroup: string) => {
        try {
            const response = await apiClient.get(`/attendance/admin-summary`, {
                params: { classGroup: classGroup, viewMode: 'overall' }
            });
            const attData = response.data?.studentDetails || [];
            const attMap: any = {};
            attData.forEach((item: any) => {
                const total = item.total_days || 0;
                const present = item.present_days || 0;
                const percentage = total > 0 ? (present / total) * 100 : 0;
                attMap[item.student_id] = getRoundedPercentage(percentage);
            });
            setAttendanceMap(attMap);
        } catch (error) {
            console.error('Error fetching attendance:', error);
            setAttendanceMap({});
        }
    };

    const fetchStudentAttendanceHistory = async (studentId: number) => {
        setLoadingAttGraph(true);
        try {
            const now = new Date();
            const currentMonth = now.getMonth(); 
            const currentYear = now.getFullYear();
            
            const startYear = currentMonth < 5 ? currentYear - 1 : currentYear;
            
            const startDate = `${startYear}-06-01`; 
            const endDate = now.toISOString().split('T')[0]; 

            const response = await apiClient.get(`/attendance/student-history-admin/${studentId}`, {
                params: { 
                    viewMode: 'custom', 
                    startDate: startDate,
                    endDate: endDate
                }
            });
            
            const history = response.data.history || [];
            const monthsData: any = {};
            
            history.forEach((record: any) => {
                const dateObj = new Date(record.attendance_date);
                const monthIndex = dateObj.getMonth();
                const monthName = dateObj.toLocaleString('default', { month: 'short' });
                const year = dateObj.getFullYear();
                const key = `${year}-${monthIndex}`;
                
                if (!monthsData[key]) {
                    monthsData[key] = {
                        name: monthName,
                        total: 0,
                        present: 0,
                        sortTime: dateObj.getTime()
                    };
                }
                monthsData[key].total += 1;
                if (record.status === 'Present') {
                    monthsData[key].present += 1;
                }
            });

            const processedArr = Object.values(monthsData)
                .sort((a: any, b: any) => a.sortTime - b.sortTime)
                .map((m: any) => ({
                    month: m.name,
                    percentage: (m.present / m.total) * 100,
                    present: m.present,
                    total: m.total
                }));

            setStudentMonthlyAtt(processedArr);

        } catch (error) {
            console.error("Error fetching student history", error);
            setStudentMonthlyAtt([]);
        } finally {
            setLoadingAttGraph(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        if (selectedClass) fetchAllData(selectedClass);
    };

    const toggleExpand = (id: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (expandedId === id) {
            setExpandedId(null);
            setStudentMonthlyAtt([]);
        } else {
            setExpandedId(id);
            fetchStudentAttendanceHistory(id);
        }
    };

    // Open Exam Graph
    const handleOpenGraph = (studentName: string, exams: any[]) => {
        setGraphData({ title: studentName.toUpperCase(), exams });
        setIsGraphVisible(true);
    };

    // Open Attendance Graph
    const handleOpenAttGraph = (studentName: string) => {
        const stud = students.find(s => s.full_name === studentName);
        if(stud) {
             setAttGraphData({ title: studentName.toUpperCase() });
             fetchStudentAttendanceHistory(stud.id).then(() => {
                 setIsAttGraphVisible(true);
             });
        }
    };

    useEffect(() => {
        if(isAttGraphVisible && attGraphData) {
            setAttGraphData(prev => ({ ...prev, data: studentMonthlyAtt }));
        }
    }, [studentMonthlyAtt]);


    // --- PROCESS DATA ---
    const processedData = useMemo(() => {
        if (!selectedClass || students.length === 0) return [];

        const subjects = CLASS_SUBJECTS[selectedClass] || [];
        const subjectCount = subjects.length;
        const isSeniorClass = SENIOR_CLASSES.includes(selectedClass);

        const marksMap: any = {};
        marksData.forEach(mark => {
            if (!marksMap[mark.student_id]) marksMap[mark.student_id] = {};
            const code = EXAM_NAME_TO_CODE[mark.exam_type];
            if (code) {
                if (!marksMap[mark.student_id][code]) marksMap[mark.student_id][code] = {};
                marksMap[mark.student_id][code][mark.subject] = mark.marks_obtained;
            }
        });

        let results = students.map(student => {
            let studentTotalObtained = 0;
            let studentMaxTotal = 0; 
            const examBreakdown: any[] = [];

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
                    let maxMarksPerSubject = 0;
                    if (['SA1', 'SA2', 'Pre-Final'].includes(examCode)) {
                        maxMarksPerSubject = 100;
                    } else {
                        maxMarksPerSubject = isSeniorClass ? 20 : 25;
                    }

                    const examMax = maxMarksPerSubject * subjectCount;
                    studentTotalObtained += examObtained;
                    studentMaxTotal += examMax;

                    const rawPerc = examMax > 0 ? (examObtained / examMax) * 100 : 0;
                    examBreakdown.push({
                        exam_type: examCode,
                        total_obtained: examObtained,
                        total_possible: examMax,
                        percentage: getRoundedPercentage(rawPerc)
                    });
                }
            });

            const rawOverallPerc = studentMaxTotal > 0 ? (studentTotalObtained / studentMaxTotal) * 100 : 0;
            const roundedOverallPerc = getRoundedPercentage(rawOverallPerc);
            const attendancePct = attendanceMap[student.id] !== undefined ? attendanceMap[student.id] : 0;

            return {
                ...student,
                id: student.id,
                totalObtained: studentTotalObtained,
                maxTotal: studentMaxTotal, 
                percentage: roundedOverallPerc,
                attendancePercentage: attendancePct,
                examBreakdown,
                performanceRank: 0
            };
        });

        results.sort((a, b) => b.totalObtained - a.totalObtained);
        results = results.map((item, index) => ({ ...item, performanceRank: index + 1 }));

        if (sortBy === 'desc') {
            // Already sorted
        } else if (sortBy === 'asc') {
            results.sort((a, b) => a.totalObtained - b.totalObtained);
        } else {
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

    }, [selectedClass, students, marksData, attendanceMap, sortBy]);

    const studentList = processedData.students || [];
    const availableExams = ['Overall', ...(processedData.activeExams || [])];

    // --- COMPARISON LOGIC ---
    const getComparisonData = () => {
        if (studentList.length === 0) return [];
        const isSeniorClass = SENIOR_CLASSES.includes(selectedClass);

        let data = studentList.map(student => {
            let ob = 0; let max = 0; let rawPerc = 0;

            if (compareSubject === 'All Subjects') {
                if (compareExam === 'Overall') {
                    ob = student.totalObtained;
                    max = student.maxTotal;
                } else {
                    const examData = student.examBreakdown.find((e: any) => e.exam_type === compareExam);
                    if (examData) {
                        ob = examData.total_obtained;
                        max = examData.total_possible;
                    }
                }
            } else {
                const studentMarks = marksData.filter(m => m.student_id === student.id && m.subject === compareSubject);
                if (compareExam === 'Overall') {
                    EXAM_ORDER.forEach(examCode => {
                        const markEntry = studentMarks.find(m => EXAM_NAME_TO_CODE[m.exam_type] === examCode);
                        if (markEntry && markEntry.marks_obtained) {
                             const val = parseFloat(markEntry.marks_obtained);
                             if (!isNaN(val)) {
                                 ob += val;
                                 if (['SA1', 'SA2', 'Pre-Final'].includes(examCode)) max += 100;
                                 else max += isSeniorClass ? 20 : 25;
                             }
                        }
                    });
                } else {
                    const markEntry = studentMarks.find(m => EXAM_NAME_TO_CODE[m.exam_type] === compareExam);
                    if (markEntry && markEntry.marks_obtained) {
                        const val = parseFloat(markEntry.marks_obtained);
                         if (!isNaN(val)) {
                             ob = val;
                             if (['SA1', 'SA2', 'Pre-Final'].includes(compareExam)) max = 100;
                             else max = isSeniorClass ? 20 : 25;
                         }
                    }
                }
            }

            rawPerc = max > 0 ? (ob / max) * 100 : 0;
            return {
                name: student.full_name,
                roll: student.roll_no,
                total_obtained: ob,
                total_possible: max,
                percentage: getRoundedPercentage(rawPerc)
            };
        }).filter(item => item.total_possible > 0);

        data.sort((a, b) => {
            if (compareSortBy === 'asc') {
                return a.percentage - b.percentage;
            } else if (compareSortBy === 'roll') {
                const rA = parseInt(a.roll, 10);
                const rB = parseInt(b.roll, 10);
                if (!isNaN(rA) && !isNaN(rB)) return rA - rB;
                return (a.roll || '').localeCompare(b.roll || '');
            } else {
                return b.percentage - a.percentage;
            }
        });

        return data;
    };

    // --- Helper to get Teacher Info & Class Subject Stats ---
    const getComparisonSummary = () => {
        if (compareSubject === 'All Subjects' || studentList.length === 0) return null;

        const assignment = teacherAssignments.find(a => a.subject === compareSubject);
        const teacherName = assignment ? assignment.teacher_name : 'Not Assigned';

        const comparisonList = getComparisonData();
        let totalObtained = 0;
        let totalPossible = 0;

        comparisonList.forEach(item => {
            totalObtained += item.total_obtained;
            totalPossible += item.total_possible;
        });

        const classAverage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;

        return {
            teacherName,
            classTotal: Math.round(totalObtained),
            classMax: Math.round(totalPossible),
            classAverage: getRoundedPercentage(classAverage)
        };
    };

    const getColorForRank = (rank: number) => {
        if (rank === 1) return COLORS.success;
        if (rank === 2) return COLORS.primary;
        if (rank === 3) return COLORS.average;
        return COLORS.textSub;
    };

    // --- RENDER TABLE ---
    const renderTableView = () => {
        const COL_WIDTHS = { rank: 45, name: 130, roll: 60, marks: 90, perf: 70, att: 100 };

        return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15 }}>
                <View style={[styles.tableContainer, { backgroundColor: COLORS.cardBg }]}>
                    <View style={[styles.tableHeaderRow, { backgroundColor: COLORS.tableHeader }]}>
                        <Text style={[styles.tableHeaderCell, { width: COL_WIDTHS.rank }]}>Rank</Text>
                        <Text style={[styles.tableHeaderCell, { width: COL_WIDTHS.name, textAlign: 'left', paddingLeft: 5 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { width: COL_WIDTHS.roll }]}>Roll No</Text>
                        <Text style={[styles.tableHeaderCell, { width: COL_WIDTHS.marks }]}>Marks</Text>
                        <Text style={[styles.tableHeaderCell, { width: COL_WIDTHS.perf }]}>Perf %</Text>
                        <Text style={[styles.tableHeaderCell, { width: COL_WIDTHS.att }]}>Attend %</Text>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {studentList.map((item, index) => {
                            const performanceColor = getStatusColor(item.percentage, COLORS);
                            const attendanceColor = getStatusColor(item.attendancePercentage, COLORS);

                            return (
                                <View key={item.id} style={[
                                    styles.tableRow, 
                                    { backgroundColor: COLORS.cardBg, borderBottomColor: COLORS.border },
                                    index % 2 === 1 && { backgroundColor: COLORS.tableRowAlt }
                                ]}>
                                    <View style={{ width: COL_WIDTHS.rank, justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={[styles.tableCell, { fontWeight: 'bold', color: COLORS.textMain }]}>{item.performanceRank}</Text>
                                    </View>
                                    <View style={{ width: COL_WIDTHS.name, justifyContent: 'center', paddingLeft: 5 }}>
                                        <Text style={[styles.tableCell, { fontWeight: 'bold', color: COLORS.textMain }]} numberOfLines={2}>
                                            {item.full_name}
                                        </Text>
                                    </View>
                                    <View style={{ width: COL_WIDTHS.roll, justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={[styles.tableCell, { color: COLORS.textMain }]}>{item.roll_no}</Text>
                                    </View>
                                    <View style={{ width: COL_WIDTHS.marks, justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={[styles.tableCell, { color: COLORS.textMain }]}>
                                            {Math.round(item.totalObtained)} / {Math.round(item.maxTotal)}
                                        </Text>
                                    </View>
                                    <View style={{ width: COL_WIDTHS.perf, justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={{ fontWeight: 'bold', color: performanceColor, fontSize: 12 }}>
                                            {item.percentage}%
                                        </Text>
                                    </View>
                                    <View style={{ width: COL_WIDTHS.att, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={{ fontWeight: 'bold', color: attendanceColor, fontSize: 12, marginRight: 8 }}>
                                            {item.attendancePercentage}%
                                        </Text>
                                        <TouchableOpacity onPress={() => handleOpenAttGraph(item.full_name)} style={styles.tableIconBtn}>
                                            <Icon name="chart-bar" size={16} color={COLORS.graphIcon} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                        {studentList.length === 0 && (
                            <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No data found for this class.</Text>
                        )}
                    </ScrollView>
                </View>
            </ScrollView>
        );
    };

    // --- RENDER CARD ---
    const renderStudentItem = ({ item }: any) => {
        const rankColor = getColorForRank(item.performanceRank);
        const performanceColor = getStatusColor(item.percentage, COLORS);
        const attendanceColor = getStatusColor(item.attendancePercentage, COLORS);
        const isExpanded = expandedId === item.id;

        return (
            <View style={[styles.card, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                <TouchableOpacity style={styles.cardContent} onPress={() => toggleExpand(item.id)} activeOpacity={0.8}>
                    <View style={[styles.rankStrip, { backgroundColor: rankColor }]}>
                        <Text style={styles.rankText}>#{item.performanceRank}</Text>
                    </View>
                    <View style={styles.cardBody}>
                        <View style={styles.cardTopRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.studentName, { color: COLORS.textMain }]}>{item.full_name}</Text>
                                <Text style={[styles.rollNo, { color: COLORS.textSub }]}>Roll No: {item.roll_no}</Text>
                            </View>
                            <View style={[styles.circleBadge, { borderColor: performanceColor }]}>
                                <Text style={[styles.circleText, { color: performanceColor }]}>{item.percentage}%</Text>
                            </View>
                        </View>
                        <Text style={[styles.marksLabel, { color: COLORS.textSub }]}>Total Marks: <Text style={[styles.marksValue, { color: COLORS.textMain }]}>{Math.round(item.totalObtained)} / {Math.round(item.maxTotal)}</Text></Text>
                        <View style={[styles.progressTrack, { backgroundColor: COLORS.track }]}>
                            <View style={[styles.progressFill, { width: `${Math.min(item.percentage, 100)}%`, backgroundColor: performanceColor }]} />
                        </View>
                        <View style={styles.expandRow}>
                            <Text style={[styles.perfLabel, { color: COLORS.textSub }]}>{item.examBreakdown.length} Exams Recorded</Text>
                            <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textSub} />
                        </View>
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={[styles.expandedSection, { backgroundColor: COLORS.expandedBg, borderTopColor: COLORS.border }]}>
                        <View style={[styles.attRow, { borderBottomColor: COLORS.border }]}>
                             <Text style={[styles.attLabel, { color: COLORS.textMain }]}>Overall Attendance:</Text>
                             <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                <Text style={[styles.attValue, { color: attendanceColor, marginRight: 10 }]}>{item.attendancePercentage}%</Text>
                                <TouchableOpacity 
                                    style={styles.iconButton} 
                                    onPress={() => handleOpenAttGraph(item.full_name)}
                                    disabled={loadingAttGraph}
                                >
                                    {loadingAttGraph ? <ActivityIndicator size="small" color="#fff"/> : <Icon name="chart-bar" size={16} color="#fff" />}
                                    <Text style={styles.btnText}>GRAPH</Text>
                                </TouchableOpacity>
                             </View>
                        </View>

                        <View style={styles.detailHeader}>
                            <Text style={[styles.detailTitle, { color: COLORS.primary }]}>Exam Breakdown</Text>
                            <TouchableOpacity style={styles.iconButton} onPress={() => handleOpenGraph(item.full_name, item.examBreakdown)}>
                                <Icon name="chart-bar" size={16} color="#fff" />
                                <Text style={styles.btnText}>GRAPH</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.breakdownContainer}>
                            <View style={[styles.bdHeader, { backgroundColor: COLORS.bdHeaderBg }]}>
                                <Text style={[styles.bdHeaderTxt, { flex: 1.5, color: COLORS.textSub }]}>Exam</Text>
                                <Text style={[styles.bdHeaderTxt, { flex: 2, textAlign: 'center', color: COLORS.textSub }]}>Marks</Text>
                                <Text style={[styles.bdHeaderTxt, { flex: 1.5, textAlign: 'right', color: COLORS.textSub }]}>%</Text>
                            </View>
                            {item.examBreakdown.length > 0 ? (
                                item.examBreakdown.map((exam: any, idx: number) => (
                                    <View key={idx} style={[styles.bdRow, { borderBottomColor: COLORS.detailBorder }]}>
                                        <Text style={[styles.bdTxt, { flex: 1.5, fontWeight: '600', color: COLORS.textMain }]}>{exam.exam_type}</Text>
                                        <Text style={[styles.bdTxt, { flex: 2, textAlign: 'center', color: COLORS.textMain }]}>{Math.round(exam.total_obtained)} / {Math.round(exam.total_possible)}</Text>
                                        <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                                            <View style={[styles.percentagePill, { backgroundColor: getStatusColor(exam.percentage, COLORS) }]}>
                                                <Text style={styles.pillText}>{exam.percentage}%</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No exams recorded yet.</Text>
                            )}
                        </View>
                    </View>
                )}
            </View>
        );
    };

    const stats = getComparisonSummary();

    return (
        <View style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar backgroundColor={COLORS.background} barStyle={isDark ? "light-content" : "dark-content"} />
            
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity 
                        style={styles.backButton} 
                        onPress={() => navigation.goBack()}
                    >
                        <Icon name="arrow-left" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>

                    <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                        <Icon name="poll" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Class Performance</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Analytics & Reports</Text>
                    </View>
                </View>
                <View style={{flexDirection: 'row', gap: 10}}>
                     <TouchableOpacity style={[styles.headerActionBtn, { backgroundColor: isDark ? '#333' : '#f0fdfa', borderColor: isDark ? '#444' : '#ccfbf1' }]} onPress={() => setIsTableView(!isTableView)}>
                        <Icon name={isTableView ? "card-bulleted-outline" : "table-large"} size={22} color={COLORS.primary} />
                     </TouchableOpacity>
                     <TouchableOpacity style={[styles.headerActionBtn, { backgroundColor: isDark ? '#333' : '#f0fdfa', borderColor: isDark ? '#444' : '#ccfbf1' }]} onPress={() => setIsCompareVisible(true)}>
                        <Icon name="scale-balance" size={22} color={COLORS.primary} />
                     </TouchableOpacity>
                </View>
            </View>

            <View style={styles.filterContainer}>
                <View style={[styles.filterBox, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                    <Picker 
                        selectedValue={selectedClass} 
                        onValueChange={setSelectedClass} 
                        style={[styles.picker, { color: COLORS.textMain }]}
                        dropdownIconColor={COLORS.textMain}
                    >
                        {classList.map(c => <Picker.Item key={c} label={c} value={c} style={{fontSize: 14}} />)}
                    </Picker>
                </View>
                <View style={[styles.filterBox, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                    <Picker 
                        selectedValue={sortBy} 
                        onValueChange={setSortBy} 
                        style={[styles.picker, { color: COLORS.textMain }]}
                        dropdownIconColor={COLORS.textMain}
                    >
                        <Picker.Item label="Roll No" value="roll_no" style={{fontSize: 14}} />
                        <Picker.Item label="High to Low" value="desc" style={{fontSize: 14}} />
                        <Picker.Item label="Low to High" value="asc" style={{fontSize: 14}} />
                    </Picker>
                </View>
            </View>

            <View style={[styles.noteContainer, { backgroundColor: isDark ? '#333' : '#FFF8E1', borderColor: isDark ? '#444' : '#FFE0B2' }]}>
                <Text style={[styles.noteText, { color: isDark ? '#FFB74D' : '#F57C00' }]}>
                    Note: Performance ranking based on total marks obtained across all exams.
                </Text>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>
            ) : (
                isTableView ? (
                    <View style={{ flex: 1 }}>{renderTableView()}</View>
                ) : (
                    <FlatList
                        data={studentList}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderStudentItem}
                        contentContainerStyle={styles.listPadding}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
                        ListEmptyComponent={<Text style={[styles.emptyText, { color: COLORS.textSub }]}>No student data found.</Text>}
                    />
                )
            )}

            {/* --- MODAL: EXAM GRAPH --- */}
            <Modal visible={isGraphVisible} transparent={true} animationType="fade" onRequestClose={() => setIsGraphVisible(false)}>
                <View style={[styles.modalOverlay, { backgroundColor: COLORS.modalOverlay }]}>
                    <View style={[styles.graphModalCard, { backgroundColor: COLORS.cardBg }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalHeaderTitle, { color: COLORS.textMain }]}>Performance Stats</Text>
                            <TouchableOpacity onPress={() => setIsGraphVisible(false)}>
                                <Icon name="close-circle-outline" size={26} color={COLORS.textSub} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.graphSubTitle, { color: COLORS.textSub }]}>{graphData?.title}</Text>
                        <View style={[styles.graphViewArea, { borderBottomColor: COLORS.border }]}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'flex-end' }}>
                                {graphData?.exams && graphData.exams.length > 0 ? graphData.exams.map((exam: any, idx: number) => (
                                    <AnimatedBar 
                                        key={idx} 
                                        percentage={exam.percentage} 
                                        marks={`${Math.round(exam.total_obtained)}/${Math.round(exam.total_possible)}`}
                                        label={exam.exam_type} 
                                        color={getStatusColor(exam.percentage, COLORS)}
                                        height={260}
                                        colors={COLORS}
                                    />
                                )) : <Text style={[styles.noDataTxt, { color: COLORS.textSub }]}>No exams completed.</Text>}
                            </ScrollView>
                        </View>
                        <View style={styles.legendRow}>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.success}]} /><Text style={[styles.legendTxt, {color: COLORS.textSub}]}>85-100%</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.average}]} /><Text style={[styles.legendTxt, {color: COLORS.textSub}]}>50-85%</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.poor}]} /><Text style={[styles.legendTxt, {color: COLORS.textSub}]}>0-50%</Text></View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* --- MODAL: ATTENDANCE GRAPH --- */}
            <Modal visible={isAttGraphVisible} transparent={true} animationType="fade" onRequestClose={() => setIsAttGraphVisible(false)}>
                <View style={[styles.modalOverlay, { backgroundColor: COLORS.modalOverlay }]}>
                    <View style={[styles.graphModalCard, { backgroundColor: COLORS.cardBg }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalHeaderTitle, { color: COLORS.textMain }]}>Attendance Stats</Text>
                            <TouchableOpacity onPress={() => setIsAttGraphVisible(false)}>
                                <Icon name="close-circle-outline" size={26} color={COLORS.textSub} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.graphSubTitle, { color: COLORS.textSub }]}>{attGraphData?.title}</Text>
                        <View style={[styles.graphViewArea, { borderBottomColor: COLORS.border }]}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'flex-end' }}>
                                {attGraphData?.data && attGraphData.data.length > 0 ? attGraphData.data.map((att: any, idx: number) => (
                                    <AnimatedBar 
                                        key={idx} 
                                        percentage={att.percentage} 
                                        marks={`${att.present}/${att.total}`}
                                        label={att.month} 
                                        color={getStatusColor(att.percentage, COLORS)}
                                        height={260}
                                        colors={COLORS}
                                    />
                                )) : <Text style={[styles.noDataTxt, { color: COLORS.textSub }]}>Loading history...</Text>}
                            </ScrollView>
                        </View>
                        <View style={styles.legendRow}>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.success}]} /><Text style={[styles.legendTxt, {color: COLORS.textSub}]}>85-100%</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.average}]} /><Text style={[styles.legendTxt, {color: COLORS.textSub}]}>50-85%</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.poor}]} /><Text style={[styles.legendTxt, {color: COLORS.textSub}]}>0-50%</Text></View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* --- MODAL: COMPARISON --- */}
            <Modal visible={isCompareVisible} animationType="slide" onRequestClose={() => setIsCompareVisible(false)}>
                <View style={[styles.fullScreenContainer, { backgroundColor: COLORS.background }]}>
                    <View style={[styles.fsHeader, { backgroundColor: COLORS.cardBg }]}>
                        <Text style={[styles.fsTitle, { color: COLORS.textMain }]}>Student Comparison</Text>
                        <TouchableOpacity onPress={() => setIsCompareVisible(false)} style={styles.closeFsBtn}>
                            <Icon name="close" size={24} color={COLORS.textMain} />
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.compareControls, { backgroundColor: COLORS.cardBg }]}>
                        {/* Added Class Filter in Modal */}
                        <Text style={[styles.controlLabel, { color: COLORS.textSub }]}>Select Class:</Text>
                        <View style={[styles.controlPicker, { marginBottom: 10, backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                            <Picker 
                                selectedValue={selectedClass} 
                                onValueChange={setSelectedClass}
                                style={{color: COLORS.textMain}}
                                dropdownIconColor={COLORS.textMain}
                            >
                                {classList.map(c => <Picker.Item key={c} label={c} value={c} style={{fontSize: 14}} />)}
                            </Picker>
                        </View>

                        <Text style={[styles.controlLabel, { color: COLORS.textSub }]}>Select Comparison Criterion:</Text>
                        <View style={[styles.controlPicker, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                            <Picker 
                                selectedValue={compareExam} 
                                onValueChange={setCompareExam}
                                style={{color: COLORS.textMain}}
                                dropdownIconColor={COLORS.textMain}
                            >
                                {availableExams.map(t => <Picker.Item key={t} label={t} value={t} style={{fontSize: 14}} />)}
                            </Picker>
                        </View>
                        
                        <View style={styles.controlRow}>
                             <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={[styles.controlLabel, { color: COLORS.textSub }]}>Select Subject:</Text>
                                <View style={[styles.controlPicker, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                                    <Picker 
                                        selectedValue={compareSubject} 
                                        onValueChange={setCompareSubject}
                                        style={{color: COLORS.textMain}}
                                        dropdownIconColor={COLORS.textMain}
                                    >
                                        <Picker.Item label="All Subjects" value="All Subjects" style={{fontSize: 14}} />
                                        {(CLASS_SUBJECTS[selectedClass] || []).map((s: string) => (
                                            <Picker.Item key={s} label={s} value={s} style={{fontSize: 14}} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>
                            
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.controlLabel, { color: COLORS.textSub }]}>Sort Order:</Text>
                                <View style={[styles.controlPicker, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                                    <Picker 
                                        selectedValue={compareSortBy} 
                                        onValueChange={setCompareSortBy}
                                        style={{color: COLORS.textMain}}
                                        dropdownIconColor={COLORS.textMain}
                                    >
                                        <Picker.Item label="High to Low" value="desc" style={{fontSize: 14}} />
                                        <Picker.Item label="Low to High" value="asc" style={{fontSize: 14}} />
                                        <Picker.Item label="Roll No" value="roll" style={{fontSize: 14}} />
                                    </Picker>
                                </View>
                            </View>
                        </View>

                    </View>
                    <View style={styles.compareGraphArea}>
                        {/* --- SUMMARY CARD FOR SPECIFIC SUBJECT --- */}
                        {stats && (
                            <View style={[styles.summaryCard, { backgroundColor: COLORS.summaryBg, borderColor: COLORS.summaryBorder }]}>
                                <View style={styles.summaryRow}>
                                    <View style={styles.summaryItem}>
                                        <Icon name="account-tie" size={18} color={COLORS.primary} />
                                        <Text style={[styles.summaryLabel, { color: COLORS.textSub }]}>Teacher:</Text>
                                        <Text style={[styles.summaryValue, { color: COLORS.textMain }]} numberOfLines={1}>{stats.teacherName}</Text>
                                    </View>
                                </View>
                                <View style={[styles.summaryRow, { marginTop: 8 }]}>
                                    <View style={styles.summaryItem}>
                                        <Icon name="chart-box-outline" size={18} color={COLORS.textSub} />
                                        <Text style={[styles.summaryLabel, { color: COLORS.textSub }]}>Total Marks:</Text>
                                        <Text style={[styles.summaryValue, { color: COLORS.textMain }]}>{stats.classTotal} / {stats.classMax}</Text>
                                    </View>
                                    <View style={styles.summaryItem}>
                                        <Icon name="percent" size={16} color={COLORS.textSub} />
                                        <Text style={[styles.summaryLabel, { color: COLORS.textSub }]}>Average:</Text>
                                        <Text style={[styles.summaryValue, { color: getStatusColor(stats.classAverage, COLORS) }]}>
                                            {stats.classAverage}%
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        <Text style={[styles.compareGraphTitle, { color: COLORS.primary }]}>Ranking by {compareExam} ({compareSubject})</Text>
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
                                            color={getStatusColor(item.percentage, COLORS)}
                                            height={320}
                                            colors={COLORS}
                                        />
                                    );
                                })
                            ) : (
                                <View style={styles.noDataContainer}><Text style={[styles.noDataTxt, { color: COLORS.textSub }]}>No data available for {compareExam} in {compareSubject}.</Text></View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listPadding: { paddingHorizontal: 15, paddingBottom: 40 },
    emptyText: { textAlign: 'center', marginTop: 30, fontStyle: 'italic' },

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
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    backButton: { marginRight: 10, padding: 5 },
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
    headerActionBtn: {
        padding: 5,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },

    // --- FILTERS & NOTE ---
    filterContainer: { flexDirection: 'row', gap: 12, paddingHorizontal: 15, marginBottom: 5 },
    filterBox: { flex: 1, borderRadius: 10, overflow: 'hidden', borderWidth: 1, height: 45, justifyContent: 'center' },
    picker: { width: '100%' },
    
    noteContainer: {
        marginHorizontal: 15,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 10
    },
    noteText: { fontSize: 11, fontWeight: 'bold', textAlign: 'center' },

    // --- TABLE STYLES ---
    tableContainer: { borderRadius: 8, overflow: 'hidden', elevation: 2, marginBottom: 20 },
    tableHeaderRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 5 },
    tableHeaderCell: { color: '#FFF', fontWeight: 'bold', fontSize: 11, textAlign: 'center' },
    tableRow: { flexDirection: 'row', paddingVertical: 0, paddingHorizontal: 5, borderBottomWidth: 1, alignItems: 'center', minHeight: 50 },
    tableCell: { fontSize: 12, textAlign: 'center' },
    tableIconBtn: { padding: 4, borderWidth: 1, borderColor: '#FFEBEE', borderRadius: 4, backgroundColor: '#FFEBEE' },

    // Card
    card: { borderRadius: 12, marginBottom: 15, elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3, overflow: 'hidden' },
    cardContent: { flexDirection: 'row' },
    rankStrip: { width: 36, justifyContent: 'center', alignItems: 'center' },
    rankText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, transform: [{ rotate: '-90deg' }], width: 60, textAlign: 'center' },
    cardBody: { flex: 1, padding: 15 },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
    studentName: { fontSize: 16, fontWeight: '700' },
    rollNo: { fontSize: 13, marginTop: 2 },
    circleBadge: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
    circleText: { fontSize: 13, fontWeight: 'bold' },
    marksLabel: { fontSize: 12, marginTop: 8, marginBottom: 4 },
    marksValue: { fontWeight: 'bold' },
    progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
    progressFill: { height: '100%', borderRadius: 3 },
    expandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    perfLabel: { fontSize: 11, fontWeight: '600' },

    // Expanded
    expandedSection: { borderTopWidth: 1, padding: 15 },
    detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    detailTitle: { fontSize: 14, fontWeight: 'bold' },
    iconButton: { flexDirection: 'row', backgroundColor: '#FB8C00', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, alignItems: 'center' },
    btnText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', marginLeft: 5 },
    breakdownContainer: { paddingHorizontal: 4 },
    bdHeader: { flexDirection: 'row', marginBottom: 6, paddingVertical: 6, borderRadius: 4 },
    bdHeaderTxt: { fontSize: 11, fontWeight: '700' },
    bdRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, alignItems: 'center' },
    bdTxt: { fontSize: 12 },
    percentagePill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10 },
    pillText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

    // Attendance Row
    attRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 10, borderBottomWidth: 1 },
    attLabel: { fontSize: 14, fontWeight: '600' },
    attValue: { fontSize: 16, fontWeight: 'bold' },

    // Modals
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    graphModalCard: { width: '90%', borderRadius: 16, padding: 20, elevation: 15, maxHeight: SCREEN_HEIGHT * 0.8 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    modalHeaderTitle: { fontSize: 18, fontWeight: 'bold' },
    graphSubTitle: { textAlign: 'center', marginBottom: 25, fontSize: 14, fontWeight: '600', textTransform: 'uppercase' },
    graphViewArea: { height: 300, borderBottomWidth: 1, paddingBottom: 10 },
    
    // Bar Graph
    barWrapper: { width: 45, alignItems: 'center', justifyContent: 'flex-end', marginHorizontal: 12 },
    barLabelTop: { marginBottom: 6, fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
    barBackground: { width: 34, height: '80%', borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end', position: 'relative' },
    barFill: { width: '100%', borderRadius: 6 },
    barTextContainer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    barInnerText: { fontSize: 10, fontWeight: 'bold', transform: [{ rotate: '-90deg' }], width: 200, textAlign: 'center' },
    barLabelBottom: { marginTop: 10, fontSize: 12, fontWeight: 'bold', textAlign: 'center' },

    // Legend
    legendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 15 },
    legendItem: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
    legendTxt: { fontSize: 12, fontWeight: '500' },

    // Full Screen Compare
    fullScreenContainer: { flex: 1 },
    fsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, elevation: 3 },
    fsTitle: { fontSize: 18, fontWeight: 'bold' },
    closeFsBtn: { padding: 4 },
    compareControls: { padding: 16, marginBottom: 10 },
    controlRow: { flexDirection: 'row', marginTop: 15, justifyContent: 'space-between' },
    controlLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
    controlPicker: { borderWidth: 1, borderRadius: 8, height: 45, justifyContent: 'center' },
    compareGraphArea: { flex: 1, paddingVertical: 20 },
    compareGraphTitle: { textAlign: 'center', fontSize: 16, fontWeight: 'bold', marginBottom: 20 },
    noDataContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', width: SCREEN_WIDTH },
    noDataTxt: { marginTop: 10 },

    // --- SUMMARY CARD STYLES ---
    summaryCard: {
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    summaryItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
        marginRight: 4
    },
    summaryValue: {
        fontSize: 13,
        fontWeight: 'bold',
    }
});

export default StudentPerformance;