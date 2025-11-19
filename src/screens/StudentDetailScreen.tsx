import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, Image,
    TouchableOpacity, Modal, Pressable, Dimensions, FlatList, Platform, SafeAreaView
} from 'react-native';
import apiClient from '../api/client';
import { SERVER_URL } from '../../apiConfig';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';

// --- Timetable Constants ---
type Day = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
interface TimetableSlotFromAPI { id?: number; class_group: string; day_of_week: Day; period_number: number; subject_name: string; teacher_id: number; teacher_name: string; }
interface PeriodDefinition { period: number; time: string; isBreak?: boolean; }
interface RenderablePeriod { subject?: string; teacher?: string; isBreak?: boolean; }

const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIOD_DEFINITIONS: PeriodDefinition[] = [ { period: 1, time: '09:00-09:45' }, { period: 2, time: '09:45-10:30' }, { period: 3, time: '10:30-10:45', isBreak: true }, { period: 4, time: '10:45-11:30' }, { period: 5, time: '11:30-12:15' }, { period: 6, time: '12:15-01:00', }, { period: 7, time: '01:00-01:45', isBreak: true }, { period: 8, time: '01:45-02:30' }, { period: 9, time: '02:30-03:15' }, { period: 10, time: '03:15-04:00' }, ];
const { width } = Dimensions.get('window');
const tableContentWidth = width - (15 * 2); 
const timeColumnWidth = Math.floor(tableContentWidth * 0.20);
const dayColumnWidth = Math.floor((tableContentWidth * 0.80) / 6);
const headerTextColor = '#455A64';
const tableHeaders = [ { name: 'TIME', color: '#EBEBEB', textColor: '#343A40', width: timeColumnWidth }, { name: 'MON', color: '#E0F7FA', textColor: headerTextColor, width: dayColumnWidth }, { name: 'TUE', color: '#FFFDE7', textColor: headerTextColor, width: dayColumnWidth }, { name: 'WED', color: '#FCE4EC', textColor: headerTextColor, width: dayColumnWidth }, { name: 'THU', color: '#EDE7F6', textColor: headerTextColor, width: dayColumnWidth }, { name: 'FRI', color: '#E8EAF6', textColor: headerTextColor, width: dayColumnWidth }, { name: 'SAT', color: '#F1F8E9', textColor: headerTextColor, width: dayColumnWidth }, ];
const subjectColorPalette = [ '#B39DDB', '#80DEEA', '#FFAB91', '#A5D6A7', '#FFE082', '#F48FB1', '#C5CAE9', '#DCE775', '#FFCC80', '#B0BEC5', ];
const subjectColorMap = new Map<string, string>();
let colorIndex = 0;
const getSubjectColor = (subject?: string): string => { if (!subject) return '#FFFFFF'; if (subjectColorMap.has(subject)) { return subjectColorMap.get(subject)!; } const color = subjectColorPalette[colorIndex % subjectColorPalette.length]; subjectColorMap.set(subject, color); colorIndex++; return color; };

// --- Progress Report Constants ---
const CLASS_SUBJECTS = { 'LKG': ['All Subjects'], 'UKG': ['All Subjects'], 'Class 1': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 'Class 2': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 'Class 3': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 'Class 4': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 'Class 5': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 'Class 6': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 'Class 7': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 'Class 8': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 'Class 9': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 'Class 10': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'] };
const EXAM_MAPPING = { 'AT1': 'Assignment-1', 'UT1': 'Unitest-1', 'AT2': 'Assignment-2', 'UT2': 'Unitest-2', 'AT3': 'Assignment-3', 'UT3': 'Unitest-3', 'AT4': 'Assignment-4', 'UT4': 'Unitest-4', 'SA1': 'SA1', 'SA2': 'SA2', 'Total': 'Overall' };
const DISPLAY_EXAM_ORDER = ['AT1', 'UT1', 'AT2', 'UT2', 'AT3', 'UT3', 'AT4', 'UT4','SA1', 'SA2', 'Total'];

// --- Helper: Date Formatter (DD/MM/YYYY) ---
const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

// --- ★★★ NEW: Attendance Constants & Components ★★★ ---
const PRIMARY_COLOR = '#008080'; 
const GREEN = '#43A047';
const RED = '#E53935';
const BLUE = '#1E88E5';
const ORANGE = '#F57C00';
const GREY = '#9E9E9E';
const WHITE = '#FFFFFF';

// Reusable Component for Timetable Grid
const StudentTimetable = ({ classGroup }) => {
    const [timetableData, setTimetableData] = useState<TimetableSlotFromAPI[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => { if (!classGroup) return; const fetchTimetable = async () => { setIsLoading(true); try { const response = await apiClient.get(`/timetable/${classGroup}`); setTimetableData(response.data); } catch (error) { console.error(`Failed to fetch timetable for ${classGroup}:`, error); } finally { setIsLoading(false); } }; fetchTimetable(); }, [classGroup]);
    const scheduleData = useMemo(() => { const timetableMap = new Map<string, TimetableSlotFromAPI>(); if (Array.isArray(timetableData)) { timetableData.forEach(slot => { const key = `${slot.day_of_week}-${slot.period_number}`; timetableMap.set(key, slot); }); } return PERIOD_DEFINITIONS.map(pDef => { const periods: RenderablePeriod[] = DAYS.map(day => { if (pDef.isBreak) return { subject: pDef.period === 3 ? 'Break' : 'Lunch', isBreak: true }; const key = `${day}-${pDef.period}`; const slotData = timetableMap.get(key); return { subject: slotData?.subject_name, teacher: slotData?.teacher_name }; }); return { time: pDef.time, periods }; }); }, [timetableData]);
    if (isLoading) return <ActivityIndicator size="large" color="#008080" style={{ marginVertical: 20 }} />;
    return (<View style={styles.ttContainer}><View style={styles.ttHeaderRow}>{tableHeaders.map(h => (<View key={h.name} style={[styles.ttHeaderCell, { backgroundColor: h.color, width: h.width }]}><Text style={[styles.ttHeaderText, { color: h.textColor }]}>{h.name}</Text></View>))}</View>{scheduleData.map((row, rowIndex) => (<View key={rowIndex} style={styles.ttRow}><View style={[styles.ttCell, styles.ttTimeCell, { width: tableHeaders[0].width }]}><Text style={styles.ttTimeText}>{row.time}</Text></View>{row.periods.map((period, periodIndex) => (<View key={periodIndex} style={[styles.ttCell, period.isBreak ? styles.ttBreakCell : { backgroundColor: getSubjectColor(period.subject) }, { width: tableHeaders[periodIndex + 1].width },]}>{period.isBreak ? (<Text style={styles.ttBreakTextSubject}>{period.subject}</Text>) : (<><Text style={styles.ttSubjectText} numberOfLines={2}>{period.subject || ''}</Text>{period.teacher && <Text style={styles.ttTeacherText} numberOfLines={1}>{period.teacher}</Text>}</>)}</View>))}</View>))}</View>);
};

// Embedded Report Card Component - UPDATED WITH MAX MARKS
const EmbeddedReportCard = ({ studentInfo, academicYear, marksData, attendanceData }) => {
    const subjects = CLASS_SUBJECTS[studentInfo.class_group] || [];
    return (
        <View style={rcStyles.card}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={rcStyles.table}>
                    {/* Header Row with Max Marks Calculation */}
                    <View style={rcStyles.tableRow}>
                        <Text style={[rcStyles.tableHeader, rcStyles.subjectCol]}>Subjects</Text>
                        {DISPLAY_EXAM_ORDER.map(exam => {
                            let label = exam;
                            if (exam.startsWith('AT') || exam.startsWith('UT')) {
                                label = `${exam}\n(25)`;
                            } else if (exam.startsWith('SA')) {
                                label = `${exam}\n(100)`;
                            }
                            return <Text key={exam} style={[rcStyles.tableHeader, rcStyles.markCol]}>{label}</Text>;
                        })}
                    </View>
                    
                    {/* Data Rows */}
                    {subjects.map(subject => (
                        <View key={subject} style={rcStyles.tableRow}>
                            <Text style={[rcStyles.tableCell, rcStyles.subjectCol]}>{subject}</Text>
                            {DISPLAY_EXAM_ORDER.map(exam => <Text key={exam} style={[rcStyles.tableCell, rcStyles.markCol]}>{marksData[subject]?.[EXAM_MAPPING[exam]] ?? '-'}</Text>)}
                        </View>
                    ))}
                    
                    {/* Total Row */}
                    <View style={[rcStyles.tableRow, rcStyles.totalRow]}>
                        <Text style={[rcStyles.tableHeader, rcStyles.subjectCol]}>Total</Text>
                        {DISPLAY_EXAM_ORDER.map(exam => {
                            const total = subjects.reduce((sum, subject) => {
                                const mark = parseFloat(marksData[subject]?.[EXAM_MAPPING[exam]]);
                                return sum + (isNaN(mark) ? 0 : mark);
                            }, 0);
                            return <Text key={exam} style={[rcStyles.tableHeader, rcStyles.markCol]}>{total > 0 ? total : '-'}</Text>;
                        })}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

// --- ATTENDANCE SUB-COMPONENTS ---

const SummaryCard = ({ label, value, color, width = '23%' }) => (
    <Animatable.View animation="zoomIn" duration={500} style={[attStyles.summaryBox, { width: width }]}>
        <Text style={[attStyles.summaryValue, { color }]}>{value}</Text>
        <Text style={attStyles.summaryLabel}>{label}</Text>
    </Animatable.View>
);

const DailyStatusCard = ({ record, date }) => {
    const hasRecord = !!record;
    const status = hasRecord ? record.status : null;
    
    let bgColor = GREY;
    let iconName = "help-circle-outline";
    let statusText = "No Record";

    if (status === 'Present') {
        bgColor = GREEN;
        iconName = "check-circle-outline";
        statusText = "Present";
    } else if (status === 'Absent') {
        bgColor = RED;
        iconName = "close-circle-outline";
        statusText = "Absent";
    }

    return (
        <Animatable.View animation="flipInX" duration={600} style={[attStyles.dailyCard, { backgroundColor: hasRecord ? bgColor : WHITE, borderColor: bgColor }]}>
            <Icon name={iconName} size={50} color={hasRecord ? WHITE : bgColor} />
            <Text style={[attStyles.dailyStatusText, { color: hasRecord ? WHITE : bgColor }]}>
                {statusText.toUpperCase()}
            </Text>
            <Text style={[attStyles.dailyDateText, { color: hasRecord ? 'rgba(255,255,255,0.9)' : '#566573' }]}>
                {formatDate(date)}
            </Text>
        </Animatable.View>
    );
};

// --- EMBEDDED ATTENDANCE VIEW (UPDATED) ---
const EmbeddedAttendanceView = ({ studentId }) => {
    const [viewMode, setViewMode] = useState('daily'); // Default to Daily
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    
    // Dates
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [fromDate, setFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)));
    const [toDate, setToDate] = useState(new Date());
    
    // Pickers
    const [showMainPicker, setShowMainPicker] = useState(false);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);

    const fetchHistory = useCallback(async () => {
        if (!studentId) return;
        setIsLoading(true);
        try {
            let url = `/attendance/student-history-admin/${studentId}?viewMode=${viewMode}`;
            
            if (viewMode === 'daily') {
                url += `&date=${selectedDate.toISOString().split('T')[0]}`;
            } else if (viewMode === 'monthly') {
                url += `&date=${selectedDate.toISOString().slice(0, 7)}`;
            } else if (viewMode === 'yearly') {
                url += `&targetYear=${selectedDate.getFullYear()}`;
            } else if (viewMode === 'custom') {
                url += `&startDate=${fromDate.toISOString().split('T')[0]}&endDate=${toDate.toISOString().split('T')[0]}`;
            }

            const response = await apiClient.get(url);
            setData(response.data);
        } catch (error: any) {
            console.error("Failed to fetch student attendance:", error.response?.data?.message || error.message);
            setData(null);
        } finally {
            setIsLoading(false);
        }
    }, [studentId, viewMode, selectedDate, fromDate, toDate]);

    // Auto fetch when mode or date changes (except custom range)
    useEffect(() => {
        if (viewMode !== 'custom') fetchHistory();
    }, [fetchHistory, viewMode, selectedDate]);

    const onMainDateChange = (event, date) => {
        setShowMainPicker(Platform.OS === 'ios');
        if (date) setSelectedDate(date);
    };

    const onFromDateChange = (event, date) => {
        setShowFromPicker(Platform.OS === 'ios');
        if (date) setFromDate(date);
    };

    const onToDateChange = (event, date) => {
        setShowToPicker(Platform.OS === 'ios');
        if (date) setToDate(date);
    };

    // Stats Calculation
    const summary = data?.summary || { total_days: 0, present_days: 0, absent_days: 0 };
    const percentage = summary.total_days > 0 ? ((summary.present_days / summary.total_days) * 100).toFixed(1) : '0.0';
    
    // Daily Record logic (find the record matching selected date)
    const dailyRecord = (viewMode === 'daily' && data?.history?.length) 
        ? data.history.find(r => r.attendance_date.startsWith(selectedDate.toISOString().split('T')[0])) || data.history[0]
        : null;

    return (
        <SafeAreaView style={attStyles.container}>
            {/* TABS */}
            <View style={attStyles.toggleContainer}>
                <TouchableOpacity style={[attStyles.toggleButton, viewMode === 'daily' && attStyles.toggleButtonActive]} onPress={() => setViewMode('daily')}>
                    <Text style={[attStyles.toggleButtonText, viewMode === 'daily' && attStyles.toggleButtonTextActive]}>Daily</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[attStyles.toggleButton, viewMode === 'monthly' && attStyles.toggleButtonActive]} onPress={() => setViewMode('monthly')}>
                    <Text style={[attStyles.toggleButtonText, viewMode === 'monthly' && attStyles.toggleButtonTextActive]}>Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[attStyles.toggleButton, viewMode === 'yearly' && attStyles.toggleButtonActive]} onPress={() => setViewMode('yearly')}>
                    <Text style={[attStyles.toggleButtonText, viewMode === 'yearly' && attStyles.toggleButtonTextActive]}>Yearly</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[attStyles.toggleButton, viewMode === 'custom' && attStyles.toggleButtonActive]} onPress={() => setViewMode('custom')}>
                    <Text style={[attStyles.toggleButtonText, viewMode === 'custom' && attStyles.toggleButtonTextActive]}>Range</Text>
                </TouchableOpacity>
                
                {viewMode !== 'custom' && (
                    <TouchableOpacity style={attStyles.calendarButton} onPress={() => setShowMainPicker(true)}>
                        <Icon name="calendar" size={22} color={PRIMARY_COLOR} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Subtitle */}
            <View style={attStyles.subtitleContainer}>
                 {viewMode === 'daily' && <Text style={attStyles.subtitle}>Date: {formatDate(selectedDate)}</Text>}
                 {viewMode === 'monthly' && <Text style={attStyles.subtitle}>Month: {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>}
                 {viewMode === 'yearly' && <Text style={attStyles.subtitle}>Year: {selectedDate.getFullYear()}</Text>}
                 {viewMode === 'custom' && <Text style={attStyles.subtitle}>Custom Range</Text>}
            </View>

            {/* Range Inputs */}
            {viewMode === 'custom' && (
                <Animatable.View animation="fadeIn" duration={300} style={attStyles.rangeContainer}>
                    <TouchableOpacity style={attStyles.dateInputBox} onPress={() => setShowFromPicker(true)}>
                        <Icon name="calendar-today" size={18} color="#566573" style={{marginRight:5}}/>
                        <Text style={attStyles.dateInputText}>{formatDate(fromDate)}</Text>
                    </TouchableOpacity>
                    <Icon name="arrow-right" size={20} color="#566573" />
                    <TouchableOpacity style={attStyles.dateInputBox} onPress={() => setShowToPicker(true)}>
                        <Icon name="calendar-today" size={18} color="#566573" style={{marginRight:5}}/>
                        <Text style={attStyles.dateInputText}>{formatDate(toDate)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={attStyles.goButton} onPress={fetchHistory}>
                        <Text style={attStyles.goButtonText}>Go</Text>
                    </TouchableOpacity>
                </Animatable.View>
            )}

            {showMainPicker && <DateTimePicker value={selectedDate} mode="date" onChange={onMainDateChange} />}
            {showFromPicker && <DateTimePicker value={fromDate} mode="date" onChange={onFromDateChange} />}
            {showToPicker && <DateTimePicker value={toDate} mode="date" onChange={onToDateChange} />}

            {isLoading ? <ActivityIndicator style={{ marginVertical: 30 }} size="large" color={PRIMARY_COLOR} /> : (
                <>
                    {viewMode === 'daily' ? (
                         <View style={{ padding: 20, alignItems: 'center' }}>
                            <DailyStatusCard record={dailyRecord} date={selectedDate} />
                        </View>
                    ) : (
                        <View style={attStyles.summaryContainer}>
                            <SummaryCard label="Overall %" value={`${percentage}%`} color={BLUE} delay={100} />
                            <SummaryCard label="Working Days" value={summary.total_days || 0} color={ORANGE} delay={150} />
                            <SummaryCard label="Days Present" value={summary.present_days || 0} color={GREEN} delay={200} />
                            <SummaryCard label="Days Absent" value={summary.absent_days || 0} color={RED} delay={300} />
                        </View>
                    )}
                    
                    {/* No Detailed History List here, as requested */}
                </>
            )}
        </SafeAreaView>
    );
};


const StudentDetailScreen = ({ route }) => {
    const { studentId } = route.params;
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
    
    const handleAttendanceToggle = () => {
        if (!isAttendanceExpanded) scrollToBottom(); 
        setIsAttendanceExpanded(prevState => !prevState); 
    }; 

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
                console.error('Error fetching report card:', err.response?.data || err.message);
                setReportCardData(null);
            } finally {
                setReportCardLoading(false);
            }
        }
        setIsReportCardExpanded(prevState => !prevState);
        if (!isReportCardExpanded) scrollToBottom();
    };

    const DetailRow = ({ label, value }) => (<View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || 'Not Provided'}</Text></View>);
    if (loading) return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#008080" /></View>;
    if (!studentDetails) return <View style={styles.loaderContainer}><Text>Could not load student details.</Text></View>;
    const imageUrl = studentDetails.profile_image_url ? `${SERVER_URL}${studentDetails.profile_image_url}` : null;

    return (
        <View style={{ flex: 1 }}>
            <Modal visible={isViewerVisible} transparent={true} onRequestClose={() => setViewerVisible(false)} animationType="fade"><Pressable style={styles.modalBackdrop} onPress={() => setViewerVisible(false)}><View style={styles.modalContent}><Image source={imageUrl ? { uri: imageUrl } : require('../assets/default_avatar.png')} style={styles.enlargedAvatar} resizeMode="contain" /><TouchableOpacity style={styles.closeButton} onPress={() => setViewerVisible(false)}><Text style={styles.closeButtonText}>Close</Text></TouchableOpacity></View></Pressable></Modal>
            <ScrollView ref={scrollViewRef} style={styles.container} contentContainerStyle={styles.scrollContentContainer}>
                <View style={styles.profileHeader}><TouchableOpacity onPress={() => setViewerVisible(true)}><Image source={imageUrl ? { uri: imageUrl } : require('../assets/default_avatar.png')} style={styles.avatar} /></TouchableOpacity><Text style={styles.fullName}>{studentDetails.full_name}</Text><Text style={styles.role}>{studentDetails.class_group}</Text></View>
                <View style={styles.card}><Text style={styles.cardTitle}>Personal Details</Text><DetailRow label="Full Name" value={studentDetails.full_name} /><DetailRow label="Username" value={studentDetails.username} /><DetailRow label="Date of Birth" value={studentDetails.dob} /><DetailRow label="Gender" value={studentDetails.gender} /></View>
                <View style={styles.card}><Text style={styles.cardTitle}>Contact Details</Text><DetailRow label="Mobile No" value={studentDetails.phone} /><DetailRow label="Email Address" value={studentDetails.email} /><DetailRow label="Address" value={studentDetails.address} /></View>
                <View style={styles.collapsibleCard}><TouchableOpacity style={styles.collapsibleHeader} onPress={handleAcademicToggle} activeOpacity={0.8}><Text style={styles.collapsibleTitle}>Academic Details</Text><Text style={styles.arrowIcon}>{isAcademicExpanded ? '▲' : '▼'}</Text></TouchableOpacity>{isAcademicExpanded && (<View style={styles.cardContent}><DetailRow label="Class" value={studentDetails.class_group} /><DetailRow label="Roll No." value={studentDetails.roll_no} /><DetailRow label="Admission No." value={studentDetails.admission_no} /><DetailRow label="Parent Name" value={studentDetails.parent_name} /><DetailRow label="Aadhar No." value={studentDetails.aadhar_no} /><DetailRow label="PEN No." value={studentDetails.pen_no} /><DetailRow label="Admission Date" value={studentDetails.admission_date} /></View>)}</View>
                <View style={styles.collapsibleCard}><TouchableOpacity style={styles.collapsibleHeader} onPress={handleTimetableToggle} activeOpacity={0.8}><Text style={styles.collapsibleTitle}>Timetable</Text><Text style={styles.arrowIcon}>{isTimetableExpanded ? '▲' : '▼'}</Text></TouchableOpacity>{isTimetableExpanded && <StudentTimetable classGroup={studentDetails.class_group} />}</View>

                {/* ATTENDANCE SECTION */}
                <View style={styles.collapsibleCard}>
                    <TouchableOpacity style={styles.collapsibleHeader} onPress={handleAttendanceToggle} activeOpacity={0.8}>
                        <Text style={styles.collapsibleTitle}>Attendance</Text>
                        <Text style={styles.arrowIcon}>{isAttendanceExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {isAttendanceExpanded && <EmbeddedAttendanceView studentId={studentDetails.id} />}
                </View>

                <View style={styles.collapsibleCard}>
                    <TouchableOpacity style={styles.collapsibleHeader} onPress={handleReportCardToggle} activeOpacity={0.8}><Text style={styles.collapsibleTitle}>Progress Report</Text><Text style={styles.arrowIcon}>{isReportCardExpanded ? '▲' : '▼'}</Text></TouchableOpacity>
                    {isReportCardExpanded && (reportCardLoading ? <ActivityIndicator size="large" color="#008080" style={{ marginVertical: 20 }} /> : reportCardData ? <EmbeddedReportCard {...reportCardData} /> : <Text style={styles.errorText}>No report data available.</Text>)}
                </View>
            </ScrollView>
        </View>
    );
};

// --- General Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f8' }, scrollContentContainer: { paddingBottom: 20 }, loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' }, errorText: { fontSize: 16, color: '#d32f2f', textAlign: 'center', padding: 20 }, profileHeader: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 15, backgroundColor: '#008080' }, avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: '#ffffff', marginBottom: 15, backgroundColor: '#bdc3c7' }, fullName: { fontSize: 24, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' }, role: { fontSize: 16, color: '#ecf0f1', marginTop: 5, backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 15 }, card: { backgroundColor: '#ffffff', borderRadius: 8, marginHorizontal: 15, marginTop: 15, paddingHorizontal: 15, paddingBottom: 5, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }, cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#008080', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f2f5', marginBottom: 5 }, cardContent: { paddingHorizontal: 15, paddingBottom: 5 }, detailRow: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f2f5', alignItems: 'center' }, detailLabel: { fontSize: 15, color: '#7f8c8d', flex: 2 }, detailValue: { fontSize: 15, color: '#2c3e50', flex: 3, fontWeight: '500', textAlign: 'right' }, collapsibleCard: { backgroundColor: '#ffffff', borderRadius: 8, marginHorizontal: 15, marginTop: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, overflow: 'hidden' }, collapsibleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 }, collapsibleTitle: { fontSize: 18, fontWeight: 'bold', color: '#008080' }, arrowIcon: { fontSize: 20, color: '#008080' }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center' }, modalContent: { width: '90%', height: '70%', justifyContent: 'center', alignItems: 'center' }, enlargedAvatar: { width: '100%', height: '100%', borderRadius: 10 }, closeButton: { position: 'absolute', bottom: 20, backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 35, borderRadius: 25 }, closeButtonText: { color: '#2c3e50', fontSize: 16, fontWeight: 'bold' },
    ttContainer: { backgroundColor: '#FFFFFF', overflow: 'hidden' }, ttHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#CFD8DC' }, ttHeaderCell: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#ECEFF1' }, ttHeaderText: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' }, ttRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F3F4' }, ttCell: { paddingVertical: 12, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#F1F3F4', minHeight: 70 }, ttTimeCell: { alignItems: 'center', backgroundColor: '#F8F9FA' }, ttTimeText: { fontSize: 11, color: '#495057', fontWeight: '600' }, ttSubjectText: { fontSize: 13, fontWeight: '800', color: '#37474F', marginBottom: 3, textAlign: 'center' }, ttTeacherText: { fontSize: 10, color: '#78909C', textAlign: 'center', marginTop: 2, fontWeight: '500' }, ttBreakCell: { alignItems: 'center', backgroundColor: '#EAECEE' }, ttBreakTextSubject: { fontSize: 12, fontWeight: '600', color: '#546E7A' },
});

// --- Report Card Styles ---
const rcStyles = StyleSheet.create({
    card: { backgroundColor: '#ffffff', paddingVertical: 15, paddingHorizontal: 5 },
    table: { borderWidth: 1, borderColor: '#dfe4ea', borderRadius: 8, overflow: 'hidden', marginHorizontal: 5 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#dfe4ea' },
    tableHeader: { padding: 10, fontWeight: 'bold', textAlign: 'center', backgroundColor: '#f8f9fa', color: '#495057', fontSize: 12, borderRightWidth: 1, borderRightColor: '#dfe4ea' },
    tableCell: { padding: 10, textAlign: 'center', color: '#212529', fontSize: 13, borderRightWidth: 1, borderRightColor: '#dfe4ea' },
    subjectCol: { width: 90, textAlign: 'left', fontWeight: '600' },
    markCol: { width: 55 },
    totalRow: { backgroundColor: '#f1f3f5' },
});

// --- ★★★ NEW: Attendance Styles ★★★ ---
const attStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: WHITE },
    noDataText: { textAlign: 'center', marginTop: 20, color: '#566573', fontSize: 16 },
    
    toggleContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 5, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: '#E0E0E0', alignItems: 'center', flexWrap: 'wrap' },
    toggleButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginHorizontal: 3, backgroundColor: '#E0E0E0', marginBottom: 5 },
    toggleButtonActive: { backgroundColor: PRIMARY_COLOR },
    toggleButtonText: { color: '#37474F', fontWeight: '600', fontSize: 13 },
    toggleButtonTextActive: { color: WHITE },
    calendarButton: { padding: 8, marginLeft: 5 },
    
    subtitleContainer: { alignItems: 'center', paddingVertical: 5 },
    subtitle: { fontSize: 14, color: '#566573' },
    
    rangeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, backgroundColor: '#f9f9f9', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
    dateInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0E0E0', padding: 10, borderRadius: 6, marginHorizontal: 5, justifyContent: 'center' },
    dateInputText: { color: '#37474F', fontSize: 13, fontWeight: '500' },
    goButton: { backgroundColor: GREEN, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, marginLeft: 5 },
    goButtonText: { color: WHITE, fontWeight: 'bold' },

    summaryContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingVertical: 15, backgroundColor: WHITE },
    summaryBox: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2 },
    summaryValue: { fontSize: 20, fontWeight: 'bold' },
    summaryLabel: { fontSize: 12, color: '#566573', marginTop: 5, textAlign: 'center' },
    
    // History Styles (Only used for Card now if needed, or kept for future ref)
    historyDayCard: { backgroundColor: WHITE, marginHorizontal: 15, marginVertical: 8, borderRadius: 8, elevation: 2, shadowColor: '#999', shadowOpacity: 0.1, shadowRadius: 5 },
    historyDayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
    historyDate: { fontSize: 16, fontWeight: '600', color: '#37474F' },
    historyStatus: { fontSize: 14, fontWeight: 'bold' },

    dailyCard: { width: '100%', padding: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, elevation: 2 },
    dailyStatusText: { fontSize: 24, fontWeight: 'bold', marginTop: 10 },
    dailyDateText: { fontSize: 16, marginTop: 5 },
});

export default StudentDetailScreen;