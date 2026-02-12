import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, Image,
    TouchableOpacity, Modal, Pressable, Dimensions, Platform, SafeAreaView, UIManager,
    Animated, Easing, useColorScheme, StatusBar
} from 'react-native';
import apiClient from '../api/client';
import { SERVER_URL } from '../../apiConfig';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';

// Enable Layout Animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F5F7FA',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    inputBg: '#FAFAFA',
    success: '#43A047',
    average: '#1E88E5',
    poor: '#E53935',
    track: '#ECEFF1',
    headerIconBg: '#E0F2F1',
    divider: '#f0f2f5',
    modalOverlay: 'rgba(0,0,0,0.8)'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    success: '#66BB6A',
    average: '#42A5F5',
    poor: '#EF5350',
    track: '#37474F',
    headerIconBg: '#333333',
    divider: '#2C2C2C',
    modalOverlay: 'rgba(255,255,255,0.1)'
};

// --- HELPERS ---
const getRoundedPercentage = (value) => {
    const floatVal = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(floatVal)) return 0;
    return Math.round(floatVal);
};

const getStatusColor = (perc, colors) => {
    const val = getRoundedPercentage(perc);
    if (val >= 85) return colors.success;
    if (val >= 50) return colors.average;
    return colors.poor;
};

const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

// --- COMPONENT: ANIMATED BAR ---
const AnimatedBar = ({ percentage, marks, label, color, height = 200, colors }) => {
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
        outputRange: ['0%', `${Math.min(displayPercentage, 100)}%`]
    });

    return (
        <View style={[barStyles.barWrapper, { height: height }]}>
            <Text style={[barStyles.barLabelTop, { color: colors.textMain }]}>{displayPercentage}%</Text>
            <View style={[barStyles.barBackground, { backgroundColor: colors.track }]}>
                <Animated.View style={[barStyles.barFill, { height: heightStyle, backgroundColor: color }]} />
                <View style={barStyles.barTextContainer}>
                    <Text style={barStyles.barInnerText} numberOfLines={1}>{marks}</Text>
                </View>
            </View>
            <Text style={[barStyles.barLabelBottom, { color: colors.textMain }]} numberOfLines={1}>{label}</Text>
        </View>
    );
};

// --- TIMETABLE CONSTANTS & COMPONENT ---
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIOD_DEFINITIONS = [
    { period: 1, time: '09:00-09:45' }, { period: 2, time: '09:45-10:30' },
    { period: 3, time: '10:30-10:45', isBreak: true },
    { period: 4, time: '10:45-11:30' }, { period: 5, time: '11:30-12:15' },
    { period: 6, time: '12:15-01:00' },
    { period: 7, time: '01:00-01:45', isBreak: true },
    { period: 8, time: '01:45-02:30' }, { period: 9, time: '02:30-03:15' },
    { period: 10, time: '03:15-04:00' },
];

const tableContentWidth = width - (15 * 2);
const timeColumnWidth = Math.floor(tableContentWidth * 0.22);
const dayColumnWidth = Math.floor((tableContentWidth * 0.78) / 6);

// Helper to get headers based on theme
const getTableHeaders = (isDark) => [
    { name: 'TIME', color: isDark ? '#263238' : '#EBEBEB', textColor: isDark ? '#B0BEC5' : '#343A40', width: timeColumnWidth },
    { name: 'MON', color: isDark ? '#1B5E20' : '#E0F7FA', textColor: isDark ? '#E0E0E0' : '#455A64', width: dayColumnWidth },
    { name: 'TUE', color: isDark ? '#F57F17' : '#FFFDE7', textColor: isDark ? '#E0E0E0' : '#455A64', width: dayColumnWidth },
    { name: 'WED', color: isDark ? '#880E4F' : '#FCE4EC', textColor: isDark ? '#E0E0E0' : '#455A64', width: dayColumnWidth },
    { name: 'THU', color: isDark ? '#311B92' : '#EDE7F6', textColor: isDark ? '#E0E0E0' : '#455A64', width: dayColumnWidth },
    { name: 'FRI', color: isDark ? '#0D47A1' : '#E8EAF6', textColor: isDark ? '#E0E0E0' : '#455A64', width: dayColumnWidth },
    { name: 'SAT', color: isDark ? '#33691E' : '#F1F8E9', textColor: isDark ? '#E0E0E0' : '#455A64', width: dayColumnWidth },
];

const subjectColorPalette = ['#B39DDB', '#80DEEA', '#FFAB91', '#A5D6A7', '#FFE082', '#F48FB1', '#C5CAE9', '#DCE775', '#FFCC80', '#B0BEC5'];
const subjectColorMap = new Map();
let colorIndex = 0;
const getSubjectColor = (subject) => {
    if (!subject) return 'transparent';
    if (subjectColorMap.has(subject)) return subjectColorMap.get(subject);
    const color = subjectColorPalette[colorIndex % subjectColorPalette.length];
    subjectColorMap.set(subject, color);
    colorIndex++;
    return color;
};

const StudentTimetable = ({ classGroup }) => {
    const isDark = useColorScheme() === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;
    const tableHeaders = getTableHeaders(isDark);

    const [timetableData, setTimetableData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!classGroup) return;
        const fetchTimetable = async () => {
            setIsLoading(true);
            try {
                const response = await apiClient.get(`/timetable/${classGroup}`);
                setTimetableData(response.data);
            } catch (error) {
                console.error(`Failed to fetch timetable for ${classGroup}:`, error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTimetable();
    }, [classGroup]);

    const scheduleData = useMemo(() => {
        const timetableMap = new Map();
        if (Array.isArray(timetableData)) {
            timetableData.forEach(slot => {
                const key = `${slot.day_of_week}-${slot.period_number}`;
                timetableMap.set(key, slot);
            });
        }
        return PERIOD_DEFINITIONS.map(pDef => {
            const periods = DAYS.map(day => {
                if (pDef.isBreak) return { subject: pDef.period === 3 ? 'Break' : 'Lunch', isBreak: true };
                const key = `${day}-${pDef.period}`;
                const slotData = timetableMap.get(key);
                return { subject: slotData?.subject_name, teacher: slotData?.teacher_name };
            });
            return { time: pDef.time, periods };
        });
    }, [timetableData]);

    if (isLoading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 20 }} />;

    return (
        <View style={[styles.ttContainer, { backgroundColor: COLORS.cardBg }]}>
            <View style={[styles.ttHeaderRow, { borderBottomColor: COLORS.border }]}>
                {tableHeaders.map(h => (
                    <View key={h.name} style={[styles.ttHeaderCell, { backgroundColor: h.color, width: h.width, borderRightColor: COLORS.border }]}>
                        <Text style={[styles.ttHeaderText, { color: h.textColor }]}>{h.name}</Text>
                    </View>
                ))}
            </View>
            {scheduleData.map((row, rowIndex) => (
                <View key={rowIndex} style={[styles.ttRow, { borderBottomColor: COLORS.border }]}>
                    <View style={[styles.ttCell, styles.ttTimeCell, { width: tableHeaders[0].width, backgroundColor: isDark ? COLORS.inputBg : '#F8F9FA', borderRightColor: COLORS.border }]}>
                        <Text style={[styles.ttTimeText, { color: COLORS.textMain }]}>{row.time}</Text>
                    </View>
                    {row.periods.map((period, periodIndex) => (
                        <View key={periodIndex} style={[styles.ttCell, period.isBreak ? { backgroundColor: isDark ? '#424242' : '#EAECEE' } : { backgroundColor: getSubjectColor(period.subject) }, { width: tableHeaders[periodIndex + 1].width, borderRightColor: COLORS.border }]}>
                            {period.isBreak ? (
                                <Text style={[styles.ttBreakTextSubject, { color: isDark ? '#BBB' : '#546E7A' }]}>{period.subject}</Text>
                            ) : (
                                <>
                                    <Text style={styles.ttSubjectText} numberOfLines={2}>{period.subject || ''}</Text>
                                    {period.teacher && <Text style={styles.ttTeacherText} numberOfLines={1}>{period.teacher}</Text>}
                                </>
                            )}
                        </View>
                    ))}
                </View>
            ))}
        </View>
    );
};

// --- REPORT CARD COMPONENT ---
const CLASS_SUBJECTS = { 'LKG': ['All Subjects'], 'UKG': ['All Subjects'], 'Class 1': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 'Class 2': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 'Class 3': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 'Class 4': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 'Class 5': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 'Class 6': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 'Class 7': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 'Class 8': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 'Class 9': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 'Class 10': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'] };
const EXAM_MAPPING = { 'AT1': 'Assignment-1', 'UT1': 'Unitest-1', 'AT2': 'Assignment-2', 'UT2': 'Unitest-2', 'AT3': 'Assignment-3', 'UT3': 'Unitest-3', 'AT4': 'Assignment-4', 'UT4': 'Unitest-4', 'SA1': 'SA1', 'SA2': 'SA2', 'Total': 'Overall' };
const DISPLAY_EXAM_ORDER = ['AT1', 'UT1', 'AT2', 'UT2', 'AT3', 'UT3', 'AT4', 'UT4', 'SA1', 'SA2', 'Total'];
const GRAPH_EXAMS = ['AT1', 'UT1', 'AT2', 'UT2', 'AT3', 'UT3', 'AT4', 'UT4', 'SA1', 'SA2'];
const SENIOR_CLASSES = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

const EmbeddedReportCard = ({ studentInfo, academicYear, marksData, attendanceData }) => {
    const isDark = useColorScheme() === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;
    const subjects = CLASS_SUBJECTS[studentInfo.class_group] || [];
    const isSeniorClass = SENIOR_CLASSES.includes(studentInfo.class_group);
    const [viewMode, setViewMode] = useState('card');

    const overallGraphData = useMemo(() => {
        return GRAPH_EXAMS.map(examCode => {
            let totalObtained = 0;
            let totalMax = 0;
            let hasData = false;
            subjects.forEach(subject => {
                const apiExamName = EXAM_MAPPING[examCode];
                const rawMark = marksData[subject]?.[apiExamName];
                if (rawMark !== undefined && rawMark !== '-' && rawMark !== null) {
                    const parsedMark = parseFloat(rawMark);
                    if (!isNaN(parsedMark)) {
                        totalObtained += parsedMark;
                        hasData = true;
                        if (['SA1', 'SA2', 'Pre-Final'].includes(examCode)) {
                            totalMax += 100;
                        } else {
                            totalMax += isSeniorClass ? 20 : 25;
                        }
                    }
                }
            });
            if (!hasData) return null;
            const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
            return { exam: examCode, totalObtained, totalMax, percentage };
        }).filter(item => item !== null);
    }, [marksData, subjects, isSeniorClass]);

    return (
        <View style={[rcStyles.container, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
            <View style={[rcStyles.toggleContainer, { backgroundColor: isDark ? COLORS.inputBg : '#f8f9fa', borderColor: COLORS.border }]}>
                <TouchableOpacity
                    style={[rcStyles.toggleBtn, viewMode === 'card' && rcStyles.toggleBtnActive, { borderColor: COLORS.primary, backgroundColor: viewMode === 'card' ? COLORS.primary : COLORS.cardBg }]}
                    onPress={() => setViewMode('card')}
                >
                    <Icon name="table-large" size={20} color={viewMode === 'card' ? '#FFF' : COLORS.primary} />
                    <Text style={[rcStyles.toggleText, viewMode === 'card' && rcStyles.toggleTextActive, { color: viewMode === 'card' ? '#FFF' : COLORS.primary }]}>Card View</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[rcStyles.toggleBtn, viewMode === 'graph' && rcStyles.toggleBtnActive, { borderColor: COLORS.primary, backgroundColor: viewMode === 'graph' ? COLORS.primary : COLORS.cardBg }]}
                    onPress={() => setViewMode('graph')}
                >
                    <Icon name="chart-bar" size={20} color={viewMode === 'graph' ? '#FFF' : COLORS.primary} />
                    <Text style={[rcStyles.toggleText, viewMode === 'graph' && rcStyles.toggleTextActive, { color: viewMode === 'graph' ? '#FFF' : COLORS.primary }]}>Graph View</Text>
                </TouchableOpacity>
            </View>

            {viewMode === 'card' ? (
                <View style={[rcStyles.card, { backgroundColor: COLORS.cardBg }]}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={[rcStyles.table, { borderColor: COLORS.border }]}>
                            <View style={[rcStyles.tableRow, { borderBottomColor: COLORS.border }]}>
                                <Text style={[rcStyles.tableHeader, rcStyles.subjectCol, { backgroundColor: isDark ? COLORS.inputBg : '#f8f9fa', color: COLORS.textMain, borderRightColor: COLORS.border }]}>Subjects</Text>
                                {DISPLAY_EXAM_ORDER.map(exam => {
                                    let label = exam;
                                    if (exam.startsWith('AT') || exam.startsWith('UT')) {
                                        const maxMarks = isSeniorClass ? '20' : '25';
                                        label = `${exam}\n(${maxMarks})`;
                                    } else if (exam.startsWith('SA')) {
                                        label = `${exam}\n(100)`;
                                    }
                                    return <Text key={exam} style={[rcStyles.tableHeader, rcStyles.markCol, { backgroundColor: isDark ? COLORS.inputBg : '#f8f9fa', color: COLORS.textMain, borderRightColor: COLORS.border }]}>{label}</Text>;
                                })}
                            </View>
                            {subjects.map(subject => (
                                <View key={subject} style={[rcStyles.tableRow, { borderBottomColor: COLORS.border }]}>
                                    <Text style={[rcStyles.tableCell, rcStyles.subjectCol, { color: COLORS.textMain, borderRightColor: COLORS.border }]}>{subject}</Text>
                                    {DISPLAY_EXAM_ORDER.map(exam => <Text key={exam} style={[rcStyles.tableCell, rcStyles.markCol, { color: COLORS.textMain, borderRightColor: COLORS.border }]}>{marksData[subject]?.[EXAM_MAPPING[exam]] ?? '-'}</Text>)}
                                </View>
                            ))}
                            <View style={[rcStyles.tableRow, rcStyles.totalRow, { backgroundColor: isDark ? COLORS.inputBg : '#f1f3f5' }]}>
                                <Text style={[rcStyles.tableHeader, rcStyles.subjectCol, { backgroundColor: 'transparent', color: COLORS.textMain, borderRightColor: COLORS.border }]}>Total</Text>
                                {DISPLAY_EXAM_ORDER.map(exam => {
                                    const total = subjects.reduce((sum, subject) => {
                                        const mark = parseFloat(marksData[subject]?.[EXAM_MAPPING[exam]]);
                                        return sum + (isNaN(mark) ? 0 : mark);
                                    }, 0);
                                    return <Text key={exam} style={[rcStyles.tableHeader, rcStyles.markCol, { backgroundColor: 'transparent', color: COLORS.textMain, borderRightColor: COLORS.border }]}>{total > 0 ? total : '-'}</Text>;
                                })}
                            </View>
                        </View>
                    </ScrollView>
                </View>
            ) : (
                <View style={rcStyles.graphContainer}>
                    <Text style={[rcStyles.graphTitle, { color: COLORS.textSub }]}>{studentInfo.full_name}</Text>
                    <View style={{ height: 260, marginTop: 10 }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'flex-end' }}>
                            {overallGraphData.length > 0 ? (
                                overallGraphData.map((item) => (
                                    <AnimatedBar
                                        key={item.exam}
                                        percentage={item.percentage}
                                        marks={`${Math.round(item.totalObtained)}/${Math.round(item.totalMax)}`}
                                        label={item.exam}
                                        color={getStatusColor(item.percentage, COLORS)}
                                        colors={COLORS}
                                        height={220}
                                    />
                                ))
                            ) : (
                                <View style={{ width: width - 40, alignItems: 'center', justifyContent: 'center', height: 200 }}>
                                    <Text style={{ color: COLORS.textSub }}>No marks data available for graphing.</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                    <View style={rcStyles.legendRow}>
                        <View style={rcStyles.legendItem}><View style={[rcStyles.dot, { backgroundColor: COLORS.success }]} /><Text style={[rcStyles.legendTxt, { color: COLORS.textSub }]}>85-100% (Topper)</Text></View>
                        <View style={rcStyles.legendItem}><View style={[rcStyles.dot, { backgroundColor: COLORS.average }]} /><Text style={[rcStyles.legendTxt, { color: COLORS.textSub }]}>50-85% (Avg)</Text></View>
                        <View style={rcStyles.legendItem}><View style={[rcStyles.dot, { backgroundColor: COLORS.poor }]} /><Text style={[rcStyles.legendTxt, { color: COLORS.textSub }]}>0-50% (Least)</Text></View>
                    </View>
                </View>
            )}
        </View>
    );
};

// --- ATTENDANCE COMPONENT ---
const SummaryCard = ({ label, value, color, width = '23%', colors }) => (
    <Animatable.View animation="zoomIn" duration={500} style={[attStyles.summaryBox, { width: width }]}>
        <Text style={[attStyles.summaryValue, { color }]}>{value}</Text>
        <Text style={[attStyles.summaryLabel, { color: colors.textSub }]}>{label}</Text>
    </Animatable.View>
);

const DailyStatusCard = ({ record, date, colors }) => {
    const hasRecord = !!record;
    const status = hasRecord ? record.status : null;
    let bgColor = colors.iconGrey || '#9E9E9E';
    let iconName = "help-circle-outline";
    let statusText = "No Record";
    if (status === 'Present') { bgColor = colors.success; iconName = "check-circle-outline"; statusText = "Present"; }
    else if (status === 'Absent') { bgColor = colors.poor; iconName = "close-circle-outline"; statusText = "Absent"; }

    return (
        <Animatable.View animation="flipInX" duration={600} style={[attStyles.dailyCard, { backgroundColor: hasRecord ? bgColor : colors.cardBg, borderColor: bgColor, borderWidth: 1 }]}>
            <Icon name={iconName} size={50} color={hasRecord ? '#FFF' : bgColor} />
            <Text style={[attStyles.dailyStatusText, { color: hasRecord ? '#FFF' : bgColor }]}>{statusText.toUpperCase()}</Text>
            <Text style={[attStyles.dailyDateText, { color: hasRecord ? 'rgba(255,255,255,0.9)' : colors.textSub }]}>{formatDate(date)}</Text>
        </Animatable.View>
    );
};

const EmbeddedAttendanceView = ({ studentId }) => {
    const isDark = useColorScheme() === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;
    const [viewMode, setViewMode] = useState('daily');
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [fromDate, setFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)));
    const [toDate, setToDate] = useState(new Date());
    const [showMainPicker, setShowMainPicker] = useState(false);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);

    const fetchHistory = useCallback(async () => {
        if (!studentId) return;
        setIsLoading(true);
        try {
            let url = `/attendance/student-history-admin/${studentId}?viewMode=${viewMode}`;
            if (viewMode === 'daily') url += `&date=${selectedDate.toISOString().split('T')[0]}`;
            else if (viewMode === 'monthly') url += `&date=${selectedDate.toISOString().slice(0, 7)}`;
            else if (viewMode === 'yearly') url += `&targetYear=${selectedDate.getFullYear()}`;
            else if (viewMode === 'custom') url += `&startDate=${fromDate.toISOString().split('T')[0]}&endDate=${toDate.toISOString().split('T')[0]}`;
            const response = await apiClient.get(url);
            setData(response.data);
        } catch (error) {
            console.error("Failed to fetch student attendance:", error);
            setData(null);
        } finally {
            setIsLoading(false);
        }
    }, [studentId, viewMode, selectedDate, fromDate, toDate]);

    useEffect(() => { if (viewMode !== 'custom') fetchHistory(); }, [fetchHistory, viewMode, selectedDate]);
    const onMainDateChange = (event, date) => { setShowMainPicker(Platform.OS === 'ios'); if (date) setSelectedDate(date); };
    const onFromDateChange = (event, date) => { setShowFromPicker(Platform.OS === 'ios'); if (date) setFromDate(date); };
    const onToDateChange = (event, date) => { setShowToPicker(Platform.OS === 'ios'); if (date) setToDate(date); };

    const summary = data?.summary || { total_days: 0, present_days: 0, absent_days: 0 };
    const percentage = summary.total_days > 0 ? ((summary.present_days / summary.total_days) * 100).toFixed(1) : '0.0';
    const dailyRecord = (viewMode === 'daily' && data?.history?.length) ? data.history.find(r => r.attendance_date.startsWith(selectedDate.toISOString().split('T')[0])) || data.history[0] : null;

    return (
        <View style={[attStyles.container, { backgroundColor: COLORS.cardBg }]}>
            <View style={[attStyles.toggleContainer, { backgroundColor: COLORS.cardBg, borderBottomColor: COLORS.border }]}>
                {['daily', 'monthly', 'yearly', 'custom'].map(m => (
                    <TouchableOpacity key={m} style={[attStyles.toggleButton, viewMode === m && attStyles.toggleButtonActive, { backgroundColor: viewMode === m ? COLORS.primary : COLORS.inputBg }]} onPress={() => setViewMode(m)}>
                        <Text style={[attStyles.toggleButtonText, viewMode === m && attStyles.toggleButtonTextActive, { color: viewMode === m ? '#FFF' : COLORS.textMain }]}>{m.charAt(0).toUpperCase() + m.slice(1)}</Text>
                    </TouchableOpacity>
                ))}
                {viewMode !== 'custom' && (<TouchableOpacity style={attStyles.calendarButton} onPress={() => setShowMainPicker(true)}><Icon name="calendar" size={22} color={COLORS.primary} /></TouchableOpacity>)}
            </View>
            <View style={attStyles.subtitleContainer}>
                {viewMode === 'daily' && <Text style={[attStyles.subtitle, { color: COLORS.textSub }]}>Date: {formatDate(selectedDate)}</Text>}
                {viewMode === 'monthly' && <Text style={[attStyles.subtitle, { color: COLORS.textSub }]}>Month: {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>}
                {viewMode === 'yearly' && <Text style={[attStyles.subtitle, { color: COLORS.textSub }]}>Year: {selectedDate.getFullYear()}</Text>}
                {viewMode === 'custom' && <Text style={[attStyles.subtitle, { color: COLORS.textSub }]}>Custom Range</Text>}
            </View>
            {viewMode === 'custom' && (
                <Animatable.View animation="fadeIn" duration={300} style={[attStyles.rangeContainer, { backgroundColor: isDark ? COLORS.inputBg : '#f9f9f9', borderBottomColor: COLORS.border }]}>
                    <TouchableOpacity style={[attStyles.dateInputBox, { backgroundColor: COLORS.cardBg }]} onPress={() => setShowFromPicker(true)}>
                        <Icon name="calendar-today" size={18} color={COLORS.textSub} style={{ marginRight: 5 }} />
                        <Text style={[attStyles.dateInputText, { color: COLORS.textMain }]}>{formatDate(fromDate)}</Text>
                    </TouchableOpacity>
                    <Icon name="arrow-right" size={20} color={COLORS.textSub} />
                    <TouchableOpacity style={[attStyles.dateInputBox, { backgroundColor: COLORS.cardBg }]} onPress={() => setShowToPicker(true)}>
                        <Icon name="calendar-today" size={18} color={COLORS.textSub} style={{ marginRight: 5 }} />
                        <Text style={[attStyles.dateInputText, { color: COLORS.textMain }]}>{formatDate(toDate)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[attStyles.goButton, { backgroundColor: COLORS.success }]} onPress={fetchHistory}><Text style={attStyles.goButtonText}>Go</Text></TouchableOpacity>
                </Animatable.View>
            )}
            {showMainPicker && <DateTimePicker value={selectedDate} mode="date" onChange={onMainDateChange} />}
            {showFromPicker && <DateTimePicker value={fromDate} mode="date" onChange={onFromDateChange} />}
            {showToPicker && <DateTimePicker value={toDate} mode="date" onChange={onToDateChange} />}
            {isLoading ? <ActivityIndicator style={{ marginVertical: 30 }} size="large" color={COLORS.primary} /> : (
                <>
                    {viewMode === 'daily' ? (<View style={{ padding: 20, alignItems: 'center' }}><DailyStatusCard record={dailyRecord} date={selectedDate} colors={COLORS} /></View>) : (
                        <View style={[attStyles.summaryContainer, { backgroundColor: COLORS.cardBg }]}>
                            <SummaryCard label="Overall %" value={`${percentage}%`} color={COLORS.average} colors={COLORS} delay={100} />
                            <SummaryCard label="Working Days" value={summary.total_days || 0} color={COLORS.textMain} colors={COLORS} delay={150} />
                            <SummaryCard label="Present" value={summary.present_days || 0} color={COLORS.success} colors={COLORS} delay={200} />
                            <SummaryCard label="Absent" value={summary.absent_days || 0} color={COLORS.poor} colors={COLORS} delay={300} />
                        </View>
                    )}
                </>
            )}
        </View>
    );
};

// --- MAIN SCREEN ---
const StudentDetailScreen = ({ route, navigation }) => {
    const { studentId } = route.params;
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const [studentDetails, setStudentDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isViewerVisible, setViewerVisible] = useState(false);
    const [isAcademicExpanded, setIsAcademicExpanded] = useState(false);
    const [isTimetableExpanded, setIsTimetableExpanded] = useState(false);
    const [isReportCardExpanded, setIsReportCardExpanded] = useState(false);
    const [isAttendanceExpanded, setIsAttendanceExpanded] = useState(false);
    const [reportCardData, setReportCardData] = useState(null);
    const [reportCardLoading, setReportCardLoading] = useState(false);

    const scrollViewRef = useRef(null);

    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    useEffect(() => {
        if (studentId) {
            const fetchDetails = async () => {
                setLoading(true);
                try {
                    const response = await apiClient.get(`/students/${studentId}`);
                    setStudentDetails(response.data);
                } catch (error) {
                    console.error('Error fetching student details:', error);
                } finally {
                    setLoading(false);
                }
            };
            fetchDetails();
        }
    }, [studentId]);

    const scrollToBottom = () => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
    const handleAcademicToggle = () => { if (!isAcademicExpanded) scrollToBottom(); setIsAcademicExpanded(prevState => !prevState); };
    const handleTimetableToggle = () => { if (!isTimetableExpanded) scrollToBottom(); setIsTimetableExpanded(prevState => !prevState); };
    const handleAttendanceToggle = () => { if (!isAttendanceExpanded) scrollToBottom(); setIsAttendanceExpanded(prevState => !prevState); };
    const handleReportCardToggle = async () => {
        if (!studentDetails || !studentDetails.id) return;
        if (!isReportCardExpanded && !reportCardData) {
            setReportCardLoading(true);
            try {
                const response = await apiClient.get(`/reports/student/${studentDetails.id}`);
                if (!response.data || !response.data.studentInfo) throw new Error("Invalid report card data.");
                const { studentInfo, marks, attendance, academicYear } = response.data;
                const subjects = CLASS_SUBJECTS[studentInfo.class_group] || [];
                const marksMap = {};
                subjects.forEach(subject => { marksMap[subject] = {}; });
                marks.forEach(mark => { const displayExamType = EXAM_MAPPING[mark.exam_type]; if (marksMap[mark.subject] && displayExamType) { marksMap[mark.subject][displayExamType] = mark.marks_obtained !== null ? mark.marks_obtained.toString() : '-'; } });
                const attendanceMap = {};
                attendance.forEach(att => { if (att.month) { attendanceMap[att.month] = { workingDays: att.working_days ?? '-', presentDays: att.present_days ?? '-' }; } });
                setReportCardData({ studentInfo, academicYear, marksData: marksMap, attendanceData: attendanceMap });
            } catch (err) {
                console.error('Error fetching report card:', err);
                setReportCardData(null);
            } finally {
                setReportCardLoading(false);
            }
        }
        setIsReportCardExpanded(prevState => !prevState);
        if (!isReportCardExpanded) scrollToBottom();
    };

    const DetailRow = ({ label, value }) => (
        <View style={[styles.detailRow, { borderBottomColor: COLORS.divider }]}>
            <Text style={[styles.detailLabel, { color: COLORS.textSub }]}>{label}</Text>
            <Text style={[styles.detailValue, { color: COLORS.textMain }]}>{value || 'Not Provided'}</Text>
        </View>
    );

    if (loading) return <View style={[styles.loaderContainer, { backgroundColor: COLORS.background }]}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    if (!studentDetails) return <View style={[styles.loaderContainer, { backgroundColor: COLORS.background }]}><Text style={{ color: COLORS.textMain }}>Could not load student details.</Text></View>;

    const imageUrl = studentDetails.profile_image_url ? `${SERVER_URL}${studentDetails.profile_image_url}` : null;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
            
            <Modal visible={isViewerVisible} transparent={true} onRequestClose={() => setViewerVisible(false)} animationType="fade">
                <Pressable style={styles.modalBackdrop} onPress={() => setViewerVisible(false)}>
                    <View style={styles.modalContent}>
                        <Image source={imageUrl ? { uri: imageUrl } : require('../assets/default_avatar.png')} style={styles.enlargedAvatar} resizeMode="contain" />
                        <TouchableOpacity style={[styles.closeButton, { backgroundColor: COLORS.cardBg }]} onPress={() => setViewerVisible(false)}>
                            <Text style={[styles.closeButtonText, { color: COLORS.textMain }]}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            {/* Header */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.6}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                </TouchableOpacity>
                <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                    <MaterialIcons name="person" size={28} color={COLORS.primary} />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Student Profile</Text>
                    <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>View detailed information</Text>
                </View>
            </View>

            <ScrollView ref={scrollViewRef} style={styles.scrollContainer} contentContainerStyle={styles.scrollContentContainer}>
                {/* Profile Card */}
                <View style={[styles.profileCard, { backgroundColor: COLORS.primary }]}>
                    <TouchableOpacity onPress={() => setViewerVisible(true)} style={styles.avatarWrapper}>
                        <Image source={imageUrl ? { uri: imageUrl } : require('../assets/default_avatar.png')} style={styles.avatar} fadeDuration={0} />
                    </TouchableOpacity>
                    <Text style={styles.fullName}>{studentDetails.full_name}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{studentDetails.class_group}</Text>
                    </View>
                </View>

                {/* Personal Details */}
                <View style={[styles.card, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                    <Text style={[styles.cardTitle, { color: COLORS.primary, borderBottomColor: COLORS.divider }]}>Personal Details</Text>
                    <DetailRow label="Full Name" value={studentDetails.full_name} />
                    <DetailRow label="Username" value={studentDetails.username} />
                    <DetailRow label="Date of Birth" value={formatDate(studentDetails.dob)} />
                    <DetailRow label="Gender" value={studentDetails.gender} />
                </View>

                {/* Contact Details */}
                <View style={[styles.card, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                    <Text style={[styles.cardTitle, { color: COLORS.primary, borderBottomColor: COLORS.divider }]}>Contact Details</Text>
                    <DetailRow label="Mobile No" value={studentDetails.phone} />
                    <DetailRow label="Email Address" value={studentDetails.email} />
                    <DetailRow label="Address" value={studentDetails.address} />
                </View>

                {/* Academic (Collapsible) */}
                <View style={[styles.collapsibleCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                    <TouchableOpacity style={styles.collapsibleHeader} onPress={handleAcademicToggle} activeOpacity={0.8}>
                        <Text style={[styles.collapsibleTitle, { color: COLORS.primary }]}>Academic Details</Text>
                        <Text style={[styles.arrowIcon, { color: COLORS.primary }]}>{isAcademicExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {isAcademicExpanded && (
                        <View style={styles.cardContent}>
                            <DetailRow label="Class" value={studentDetails.class_group} />
                            <DetailRow label="Roll No." value={studentDetails.roll_no} />
                            <DetailRow label="Admission No." value={studentDetails.admission_no} />
                            <DetailRow label="Parent Name" value={studentDetails.parent_name} />
                            <DetailRow label="Aadhar No." value={studentDetails.aadhar_no} />
                            <DetailRow label="PEN No." value={studentDetails.pen_no} />
                            <DetailRow label="Admission Date" value={formatDate(studentDetails.admission_date)} />
                        </View>
                    )}
                </View>

                {/* Timetable (Collapsible) */}
                <View style={[styles.collapsibleCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                    <TouchableOpacity style={styles.collapsibleHeader} onPress={handleTimetableToggle} activeOpacity={0.8}>
                        <Text style={[styles.collapsibleTitle, { color: COLORS.primary }]}>Timetable</Text>
                        <Text style={[styles.arrowIcon, { color: COLORS.primary }]}>{isTimetableExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {isTimetableExpanded && <StudentTimetable classGroup={studentDetails.class_group} />}
                </View>

                {/* Attendance (Collapsible) */}
                <View style={[styles.collapsibleCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                    <TouchableOpacity style={styles.collapsibleHeader} onPress={handleAttendanceToggle} activeOpacity={0.8}>
                        <Text style={[styles.collapsibleTitle, { color: COLORS.primary }]}>Attendance</Text>
                        <Text style={[styles.arrowIcon, { color: COLORS.primary }]}>{isAttendanceExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {isAttendanceExpanded && <EmbeddedAttendanceView studentId={studentDetails.id} />}
                </View>

                {/* Report Card (Collapsible) */}
                <View style={[styles.collapsibleCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                    <TouchableOpacity style={styles.collapsibleHeader} onPress={handleReportCardToggle} activeOpacity={0.8}>
                        <Text style={[styles.collapsibleTitle, { color: COLORS.primary }]}>Progress Report</Text>
                        <Text style={[styles.arrowIcon, { color: COLORS.primary }]}>{isReportCardExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {isReportCardExpanded && (
                        reportCardLoading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 20 }} /> :
                            reportCardData ? <EmbeddedReportCard {...reportCardData} /> : <Text style={[styles.errorText, { color: COLORS.poor }]}>No report data available.</Text>
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

// --- STYLES ---
const barStyles = StyleSheet.create({
    barWrapper: { width: 55, alignItems: 'center', justifyContent: 'flex-end', marginHorizontal: 8 },
    barLabelTop: { marginBottom: 4, fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
    barBackground: { width: 30, height: '80%', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end', position: 'relative' },
    barFill: { width: '100%', borderRadius: 4 },
    barTextContainer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    barInnerText: { fontSize: 10, fontWeight: 'bold', color: '#000', transform: [{ rotate: '-90deg' }], width: 120, textAlign: 'center' },
    barLabelBottom: { marginTop: 8, fontSize: 11, fontWeight: '600', textAlign: 'center', width: '100%' },
});

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContainer: { flex: 1 },
    scrollContentContainer: { paddingBottom: 30 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    headerCard: {
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
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    backButton: { marginRight: 8, padding: 8, justifyContent: 'center', alignItems: 'center' },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 12, marginTop: 1 },

    // Profile
    profileCard: {
        alignItems: 'center',
        marginHorizontal: 15,
        borderRadius: 16,
        paddingVertical: 25,
        marginBottom: 10,
        elevation: 4,
        shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5,
    },
    avatarWrapper: { borderRadius: 65, borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)', padding: 4, marginBottom: 10 },
    avatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#bdc3c7' },
    fullName: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', textAlign: 'center', marginBottom: 5 },
    badge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
    badgeText: { color: '#fff', fontWeight: '600', fontSize: 14 },

    // Generic Cards
    card: { borderRadius: 12, marginHorizontal: 15, marginTop: 15, paddingHorizontal: 15, paddingBottom: 5, elevation: 2, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', paddingVertical: 15, borderBottomWidth: 1, marginBottom: 5 },
    cardContent: { paddingHorizontal: 15, paddingBottom: 5 },
    detailRow: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, alignItems: 'center' },
    detailLabel: { fontSize: 15, flex: 2 },
    detailValue: { fontSize: 15, flex: 3, fontWeight: '500', textAlign: 'right' },
    errorText: { fontSize: 16, textAlign: 'center', padding: 20 },

    // Collapsible
    collapsibleCard: { borderRadius: 12, marginHorizontal: 15, marginTop: 15, elevation: 2, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, overflow: 'hidden' },
    collapsibleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
    collapsibleTitle: { fontSize: 18, fontWeight: 'bold' },
    arrowIcon: { fontSize: 20 },

    // Modal
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', height: '70%', justifyContent: 'center', alignItems: 'center' },
    enlargedAvatar: { width: '100%', height: '100%', borderRadius: 10 },
    closeButton: { position: 'absolute', bottom: 20, paddingVertical: 12, paddingHorizontal: 35, borderRadius: 25 },
    closeButtonText: { fontSize: 16, fontWeight: 'bold' },

    // Timetable
    ttContainer: { overflow: 'hidden' },
    ttHeaderRow: { flexDirection: 'row', borderBottomWidth: 1 },
    ttHeaderCell: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1 },
    ttHeaderText: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' },
    ttRow: { flexDirection: 'row', borderBottomWidth: 1 },
    ttCell: { paddingVertical: 12, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, minHeight: 70 },
    ttTimeCell: { alignItems: 'center', borderRightWidth: 1 },
    ttTimeText: { fontSize: 11, fontWeight: '600' },
    ttSubjectText: { fontSize: 13, fontWeight: '800', color: '#37474F', marginBottom: 3, textAlign: 'center' },
    ttTeacherText: { fontSize: 10, color: '#424242', textAlign: 'center', marginTop: 2, fontWeight: '500' },
    ttBreakTextSubject: { fontSize: 12, fontWeight: '600', transform: [{ rotate: '-90deg' }] },
});

const rcStyles = StyleSheet.create({
    container: { borderTopWidth: 1 },
    toggleContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    toggleBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, marginHorizontal: 8, borderWidth: 1 },
    toggleBtnActive: {},
    toggleText: { marginLeft: 6, fontWeight: '600', fontSize: 14 },
    toggleTextActive: {},
    card: { paddingVertical: 15, paddingHorizontal: 5 },
    table: { borderWidth: 1, borderRadius: 8, overflow: 'hidden', marginHorizontal: 5 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1 },
    tableHeader: { padding: 10, fontWeight: 'bold', textAlign: 'center', fontSize: 12, borderRightWidth: 1 },
    tableCell: { padding: 10, textAlign: 'center', fontSize: 13, borderRightWidth: 1 },
    subjectCol: { width: 90, textAlign: 'left', fontWeight: '600' },
    markCol: { width: 55 },
    totalRow: {},
    graphContainer: { padding: 10, alignItems: 'center' },
    graphTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5, textAlign: 'center', textTransform: 'uppercase' },
    legendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 15, gap: 12, flexWrap: 'wrap' },
    legendItem: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
    legendTxt: { fontSize: 11 }
});

const attStyles = StyleSheet.create({
    container: { flex: 1 },
    toggleContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 5, borderBottomWidth: 1, alignItems: 'center', flexWrap: 'wrap' },
    toggleButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginHorizontal: 3, marginBottom: 5 },
    toggleButtonActive: {},
    toggleButtonText: { fontWeight: '600', fontSize: 13 },
    toggleButtonTextActive: {},
    calendarButton: { padding: 8, marginLeft: 5 },
    subtitleContainer: { alignItems: 'center', paddingVertical: 5 },
    subtitle: { fontSize: 14 },
    rangeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1 },
    dateInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 6, marginHorizontal: 5, justifyContent: 'center' },
    dateInputText: { fontSize: 13, fontWeight: '500' },
    goButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, marginLeft: 5 },
    goButtonText: { color: '#FFF', fontWeight: 'bold' },
    summaryContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingVertical: 15 },
    summaryBox: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2 },
    summaryValue: { fontSize: 20, fontWeight: 'bold' },
    summaryLabel: { fontSize: 12, marginTop: 5, textAlign: 'center' },
    dailyCard: { width: '100%', padding: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center', elevation: 2 },
    dailyStatusText: { fontSize: 24, fontWeight: 'bold', marginTop: 10 },
    dailyDateText: { fontSize: 16, marginTop: 5 },
});

export default StudentDetailScreen;