import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, Image,
    TouchableOpacity, Modal, Pressable, Dimensions
} from 'react-native';
import apiClient from '../api/client';
import { SERVER_URL } from '../../apiConfig';

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
const MONTHS = ['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May'];


// --- Reusable Component for Timetable Grid ---
const StudentTimetable = ({ classGroup }) => {
    const [timetableData, setTimetableData] = useState<TimetableSlotFromAPI[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => { if (!classGroup) return; const fetchTimetable = async () => { setIsLoading(true); try { const response = await apiClient.get(`/timetable/${classGroup}`); setTimetableData(response.data); } catch (error) { console.error(`Failed to fetch timetable for ${classGroup}:`, error); } finally { setIsLoading(false); } }; fetchTimetable(); }, [classGroup]);
    const scheduleData = useMemo(() => { const timetableMap = new Map<string, TimetableSlotFromAPI>(); if (Array.isArray(timetableData)) { timetableData.forEach(slot => { const key = `${slot.day_of_week}-${slot.period_number}`; timetableMap.set(key, slot); }); } return PERIOD_DEFINITIONS.map(pDef => { const periods: RenderablePeriod[] = DAYS.map(day => { if (pDef.isBreak) return { subject: pDef.period === 3 ? 'Break' : 'Lunch', isBreak: true }; const key = `${day}-${pDef.period}`; const slotData = timetableMap.get(key); return { subject: slotData?.subject_name, teacher: slotData?.teacher_name }; }); return { time: pDef.time, periods }; }); }, [timetableData]);
    if (isLoading) return <ActivityIndicator size="large" color="#008080" style={{ marginVertical: 20 }} />;
    return (<View style={styles.ttContainer}><View style={styles.ttHeaderRow}>{tableHeaders.map(h => (<View key={h.name} style={[styles.ttHeaderCell, { backgroundColor: h.color, width: h.width }]}><Text style={[styles.ttHeaderText, { color: h.textColor }]}>{h.name}</Text></View>))}</View>{scheduleData.map((row, rowIndex) => (<View key={rowIndex} style={styles.ttRow}><View style={[styles.ttCell, styles.ttTimeCell, { width: tableHeaders[0].width }]}><Text style={styles.ttTimeText}>{row.time}</Text></View>{row.periods.map((period, periodIndex) => (<View key={periodIndex} style={[styles.ttCell, period.isBreak ? styles.ttBreakCell : { backgroundColor: getSubjectColor(period.subject) }, { width: tableHeaders[periodIndex + 1].width },]}>{period.isBreak ? (<Text style={styles.ttBreakTextSubject}>{period.subject}</Text>) : (<><Text style={styles.ttSubjectText} numberOfLines={2}>{period.subject || ''}</Text>{period.teacher && <Text style={styles.ttTeacherText} numberOfLines={1}>{period.teacher}</Text>}</>)}</View>))}</View>))}</View>);
};

// --- ★★★ NEW: Reusable Component for Embedded Report Card ★★★ ---
const EmbeddedReportCard = ({ studentInfo, academicYear, marksData, attendanceData }) => {
    const subjects = CLASS_SUBJECTS[studentInfo.class_group] || [];
    const formatMonthForDisplay = (month) => { if (month === 'September') return 'Sept'; return month.substring(0, 3); };

    return (
        <View style={rcStyles.card}>
            {/* School header is removed as requested */}
            <View style={rcStyles.studentInfoContainer}>
                <View style={rcStyles.infoRow}><Text style={rcStyles.infoLabel}>Name:</Text><Text style={rcStyles.infoValue}>{studentInfo.full_name}</Text></View>
                <View style={rcStyles.infoRow}><Text style={rcStyles.infoLabel}>Roll No:</Text><Text style={rcStyles.infoValue}>{studentInfo.roll_no}</Text></View>
                <View style={rcStyles.infoRow}><Text style={rcStyles.infoLabel}>Class:</Text><Text style={rcStyles.infoValue}>{studentInfo.class_group}</Text></View>
                <View style={rcStyles.infoRow}><Text style={rcStyles.infoLabel}>Year:</Text><Text style={rcStyles.infoValue}>{academicYear}</Text></View>
            </View>

            <Text style={rcStyles.sectionTitle}>PROGRESS CARD</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={rcStyles.table}>
                    <View style={rcStyles.tableRow}><Text style={[rcStyles.tableHeader, rcStyles.subjectCol]}>Subjects</Text>{DISPLAY_EXAM_ORDER.map(exam => <Text key={exam} style={[rcStyles.tableHeader, rcStyles.markCol]}>{exam}</Text>)}</View>
                    {subjects.map(subject => (<View key={subject} style={rcStyles.tableRow}><Text style={[rcStyles.tableCell, rcStyles.subjectCol]}>{subject}</Text>{DISPLAY_EXAM_ORDER.map(exam => <Text key={exam} style={[rcStyles.tableCell, rcStyles.markCol]}>{marksData[subject]?.[EXAM_MAPPING[exam]] ?? '-'}</Text>)}</View>))}
                    <View style={[rcStyles.tableRow, rcStyles.totalRow]}><Text style={[rcStyles.tableHeader, rcStyles.subjectCol]}>Total</Text>{DISPLAY_EXAM_ORDER.map(exam => { const total = subjects.reduce((sum, subject) => { const mark = parseFloat(marksData[subject]?.[EXAM_MAPPING[exam]]); return sum + (isNaN(mark) ? 0 : mark); }, 0); return <Text key={exam} style={[rcStyles.tableHeader, rcStyles.markCol]}>{total > 0 ? total : '-'}</Text>; })}</View>
                </View>
            </ScrollView>

            <Text style={rcStyles.sectionTitle}>ATTENDANCE PARTICULARS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={rcStyles.table}>
                    <View style={rcStyles.tableRow}><Text style={[rcStyles.tableHeader, rcStyles.attendanceHeaderCol]}>Month</Text>{MONTHS.map(month => <Text key={month} style={[rcStyles.tableHeader, rcStyles.attendanceDataCol]}>{formatMonthForDisplay(month)}</Text>)}</View>
                    <View style={rcStyles.tableRow}><Text style={[rcStyles.tableCell, rcStyles.attendanceHeaderCol]}>Working Days</Text>{MONTHS.map(month => <Text key={month} style={[rcStyles.tableCell, rcStyles.attendanceDataCol]}>{attendanceData[month]?.workingDays ?? '-'}</Text>)}</View>
                    <View style={rcStyles.tableRow}><Text style={[rcStyles.tableCell, rcStyles.attendanceHeaderCol]}>Present Days</Text>{MONTHS.map(month => <Text key={month} style={[rcStyles.tableCell, rcStyles.attendanceDataCol]}>{attendanceData[month]?.presentDays ?? '-'}</Text>)}</View>
                </View>
            </ScrollView>
        </View>
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
    const [reportCardData, setReportCardData] = useState(null);
    const [reportCardLoading, setReportCardLoading] = useState(false);
    
    const scrollViewRef = useRef(null);

    useEffect(() => { if (studentId) { const fetchDetails = async () => { setLoading(true); try { const response = await apiClient.get(`/students/${studentId}`); setStudentDetails(response.data); } catch (error) { console.error('Error fetching student details:', error); } finally { setLoading(false); } }; fetchDetails(); } }, [studentId]);
    
    const scrollToBottom = () => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
    const handleAcademicToggle = () => { if (!isAcademicExpanded) scrollToBottom(); setIsAcademicExpanded(prevState => !prevState); };
    const handleTimetableToggle = () => { if (!isTimetableExpanded) scrollToBottom(); setIsTimetableExpanded(prevState => !prevState); };

    // Handler for Consolidated Report Card
    const handleReportCardToggle = async () => {
        if (!isReportCardExpanded) {
            if (!reportCardData) {
                setReportCardLoading(true);
                try {
                    const response = await apiClient.get(`/api/reports/student/${studentId}`);
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
            scrollToBottom();
        }
        setIsReportCardExpanded(prevState => !prevState);
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

                {/* ★★★ CORRECTED PROGRESS REPORT SECTION ★★★ */}
                <View style={styles.collapsibleCard}>
                    <TouchableOpacity style={styles.collapsibleHeader} onPress={handleReportCardToggle} activeOpacity={0.8}><Text style={styles.collapsibleTitle}>Progress Report</Text><Text style={styles.arrowIcon}>{isReportCardExpanded ? '▲' : '▼'}</Text></TouchableOpacity>
                    {isReportCardExpanded && ( reportCardLoading ? <ActivityIndicator size="large" color="#008080" style={{ marginVertical: 20 }} /> : reportCardData ? <EmbeddedReportCard {...reportCardData} /> : <Text style={styles.errorText}>No report data available.</Text> )}
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

// --- ★★★ NEW: Styles for the embedded Report Card ★★★ ---
const rcStyles = StyleSheet.create({
    card: { backgroundColor: '#ffffff', paddingVertical: 10, paddingHorizontal: 5 },
    studentInfoContainer: { backgroundColor: '#f8f9fa', borderRadius: 8, padding: 15, margin: 5, marginBottom: 20, borderWidth: 1, borderColor: '#e9ecef' },
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
    infoLabel: { fontSize: 14, fontWeight: '600', color: '#495057', width: 80 },
    infoValue: { fontSize: 14, color: '#212529', flex: 1 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#343a40', textAlign: 'center', marginVertical: 15, marginTop: 10 },
    table: { borderWidth: 1, borderColor: '#dfe4ea', borderRadius: 8, overflow: 'hidden', marginHorizontal: 5 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#dfe4ea' },
    tableHeader: { padding: 10, fontWeight: 'bold', textAlign: 'center', backgroundColor: '#f8f9fa', color: '#495057', fontSize: 12, borderRightWidth: 1, borderRightColor: '#dfe4ea' },
    tableCell: { padding: 10, textAlign: 'center', color: '#212529', fontSize: 13, borderRightWidth: 1, borderRightColor: '#dfe4ea' },
    subjectCol: { width: 90, textAlign: 'left', fontWeight: '600' },
    markCol: { width: 55 },
    totalRow: { backgroundColor: '#f1f3f5' },
    attendanceHeaderCol: { width: 110, textAlign: 'left', fontWeight: '600'},
    attendanceDataCol: { width: 60 },
});

export default StudentDetailScreen;