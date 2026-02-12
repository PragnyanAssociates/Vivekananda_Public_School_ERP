/**
 * File: src/screens/report/StudentReportCardScreen.js
 * Purpose: A visually appealing, downloadable A4-style report card for students.
 * Updated: Responsive Design, Dark Mode Support & Smart Capture.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, ScrollView, StyleSheet, ActivityIndicator, Image,
    TouchableOpacity, Alert, PermissionsAndroid, Platform, Dimensions,
    useColorScheme, StatusBar
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import Feather from 'react-native-vector-icons/Feather';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/client';

// --- CONSTANTS ---
const CLASS_SUBJECTS = {
    'LKG': ['All Subjects'], 'UKG': ['All Subjects'], 'Class 1': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 2': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 'Class 3': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 4': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 'Class 5': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 6': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 'Class 7': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 8': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 'Class 9': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 10': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social']
};

const EXAM_MAPPING = {
    'AT1': 'Assignment-1', 'UT1': 'Unitest-1', 'AT2': 'Assignment-2', 'UT2': 'Unitest-2',
    'AT3': 'Assignment-3', 'UT3': 'Unitest-3', 'AT4': 'Assignment-4', 'UT4': 'Unitest-4',
    'SA1': 'SA1', 'SA2': 'SA2', 'Total': 'Overall'
};

const DISPLAY_EXAM_ORDER = ['AT1', 'UT1', 'AT2', 'UT2', 'AT3', 'UT3', 'AT4', 'UT4', 'SA1', 'SA2', 'Total'];
const MONTHS = ['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May'];
const SENIOR_CLASSES = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#E0E0E0',
    iconBg: '#E0F2F1',
    tableHeaderBg: '#F8F9FA',
    tableBorder: '#dfe4ea',
    infoBoxBg: '#f8f9fa',
    schoolText: '#1a252f'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    iconBg: '#333333',
    tableHeaderBg: '#2C2C2C',
    tableBorder: '#333333',
    infoBoxBg: '#252525',
    schoolText: '#FFFFFF'
};

// --- REPORT CARD CONTENT COMPONENT ---
// This component handles the layout for both the Screen View (Theme aware) and Capture View (Fixed White)
const ReportCardContent = ({ studentInfo, academicYear, marksData, attendanceData, isForCapture = false, theme }) => {
    const subjects = CLASS_SUBJECTS[studentInfo.class_group] || [];
    const formatMonthForDisplay = (month) => { if (month === 'September') return 'Sept'; return month.substring(0, 3); };
    const isSeniorClass = SENIOR_CLASSES.includes(studentInfo.class_group);
    
    // Select styles: If capturing, use Print Styles (White), else use Theme Styles (Dark/Light)
    const s = isForCapture ? printStyles : styles;
    
    // Dynamic Colors based on mode
    const textMain = isForCapture ? '#000' : theme.textMain;
    const textSub = isForCapture ? '#546E7A' : theme.textSub;
    const cardBg = isForCapture ? '#FFF' : theme.cardBg;
    const tableHeaderBg = isForCapture ? '#f8f9fa' : theme.tableHeaderBg;
    const infoBoxBg = isForCapture ? '#f8f9fa' : theme.infoBoxBg;
    const borderColor = isForCapture ? '#dfe4ea' : theme.tableBorder;

    return (
        <View style={[s.card, { backgroundColor: cardBg }]}>
            {/* School Header */}
            <View style={[s.schoolHeader, { borderBottomColor: borderColor }]}>
                {/* Logo wrapper to ensure visibility in dark mode if logo is transparent black */}
                <View style={{ backgroundColor: '#fff', padding: 5, borderRadius: 4 }}>
                     <Image source={require('../../assets/logo.png')} style={s.logo} />
                </View>
                <Text style={[s.schoolName, { color: isForCapture ? '#1a252f' : theme.schoolText }]}>VIVEKANANDA PUBLIC SCHOOL</Text>
                <Text style={[s.schoolSub, { color: textSub }]}>ENGLISH MEDIUM</Text>
                <Text style={[s.schoolContact, { color: textSub }]}>vivekanandaschoolhyd@gmail.com</Text>
                <Text style={[s.schoolAddress, { color: textSub }]}>H.No:8-3-1100/A & A1.Plot No.112(Near Drishti Hospital), Srinagar Colony, Hyderabad: 500016</Text>
            </View>

            {/* Student Info */}
            <View style={[s.studentInfoContainer, { backgroundColor: infoBoxBg, borderColor: borderColor }]}>
                <View style={s.infoRow}><Text style={[s.infoLabel, { color: textSub }]}>Name:</Text><Text style={[s.infoValue, { color: textMain }]}>{studentInfo.full_name}</Text></View>
                <View style={s.infoRow}><Text style={[s.infoLabel, { color: textSub }]}>Roll No:</Text><Text style={[s.infoValue, { color: textMain }]}>{studentInfo.roll_no}</Text></View>
                <View style={s.infoRow}><Text style={[s.infoLabel, { color: textSub }]}>Class:</Text><Text style={[s.infoValue, { color: textMain }]}>{studentInfo.class_group}</Text></View>
                <View style={s.infoRow}><Text style={[s.infoLabel, { color: textSub }]}>Year:</Text><Text style={[s.infoValue, { color: textMain }]}>{academicYear}</Text></View>
            </View>

            <Text style={[s.sectionTitle, { color: textMain }]}>PROGRESS CARD</Text>
            
            {/* Marks Table */}
            <ScrollView horizontal={!isForCapture} showsHorizontalScrollIndicator={false}>
                <View style={[s.table, { borderColor: borderColor }]}>
                    <View style={[s.tableRow, { borderBottomColor: borderColor }]}>
                        <Text style={[s.tableHeader, s.subjectCol, { backgroundColor: tableHeaderBg, color: textMain, borderRightColor: borderColor }]}>Subjects</Text>
                        {DISPLAY_EXAM_ORDER.map(exam => {
                            let label = exam;
                            if (exam.startsWith('AT') || exam.startsWith('UT')) {
                                const maxMarks = isSeniorClass ? '20' : '25';
                                label = `${exam}\n(${maxMarks})`;
                            } else if (exam.startsWith('SA')) {
                                label = `${exam}\n(100)`;
                            }
                            return <Text key={exam} style={[s.tableHeader, s.markCol, { backgroundColor: tableHeaderBg, color: textMain, borderRightColor: borderColor }]}>{label}</Text>;
                        })}
                    </View>
                    
                    {subjects.map(subject => (
                        <View key={subject} style={[s.tableRow, { borderBottomColor: borderColor }]}>
                            <Text style={[s.tableCell, s.subjectCol, { color: textMain, borderRightColor: borderColor }]}>{subject}</Text>
                            {DISPLAY_EXAM_ORDER.map(exam => <Text key={exam} style={[s.tableCell, s.markCol, { color: textMain, borderRightColor: borderColor }]}>{marksData[subject]?.[EXAM_MAPPING[exam]] ?? '-'}</Text>)}
                        </View>
                    ))}
                    <View style={[s.tableRow, s.totalRow, { backgroundColor: isForCapture ? '#f1f3f5' : theme.background }]}>
                        <Text style={[s.tableHeader, s.subjectCol, { backgroundColor: 'transparent', color: textMain, borderRightColor: borderColor }]}>Total</Text>
                        {DISPLAY_EXAM_ORDER.map(exam => {
                            const total = subjects.reduce((sum, subject) => {
                                const mark = parseFloat(marksData[subject]?.[EXAM_MAPPING[exam]]);
                                return sum + (isNaN(mark) ? 0 : mark);
                            }, 0);
                            return <Text key={exam} style={[s.tableHeader, s.markCol, { backgroundColor: 'transparent', color: textMain, borderRightColor: borderColor }]}>{total > 0 ? total : '-'}</Text>;
                        })}
                    </View>
                </View>
            </ScrollView>

            <Text style={[s.sectionTitle, { color: textMain }]}>ATTENDANCE PARTICULARS</Text>
            
            {/* Attendance Table */}
            <ScrollView horizontal={!isForCapture} showsHorizontalScrollIndicator={false}>
                <View style={[s.table, { borderColor: borderColor }]}>
                    <View style={[s.tableRow, { borderBottomColor: borderColor }]}>
                        <Text style={[s.tableHeader, s.attendanceHeaderCol, { backgroundColor: tableHeaderBg, color: textMain, borderRightColor: borderColor }]}>Month</Text>
                        {MONTHS.map(month => <Text key={month} style={[s.tableHeader, s.attendanceDataCol, { backgroundColor: tableHeaderBg, color: textMain, borderRightColor: borderColor }]}>{formatMonthForDisplay(month)}</Text>)}
                    </View>
                    <View style={[s.tableRow, { borderBottomColor: borderColor }]}>
                        <Text style={[s.tableCell, s.attendanceHeaderCol, { color: textMain, borderRightColor: borderColor }]}>Working Days</Text>
                        {MONTHS.map(month => <Text key={month} style={[s.tableCell, s.attendanceDataCol, { color: textMain, borderRightColor: borderColor }]}>{attendanceData[month]?.workingDays ?? '-'}</Text>)}
                    </View>
                    <View style={s.tableRow}>
                        <Text style={[s.tableCell, s.attendanceHeaderCol, { color: textMain, borderRightColor: borderColor }]}>Present Days</Text>
                        {MONTHS.map(month => <Text key={month} style={[s.tableCell, s.attendanceDataCol, { color: textMain, borderRightColor: borderColor }]}>{attendanceData[month]?.presentDays ?? '-'}</Text>)}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};


const StudentReportCardScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const captureRef = useRef();

    const [loading, setLoading] = useState(true);
    const [studentInfo, setStudentInfo] = useState(null);
    const [marksData, setMarksData] = useState({});
    const [attendanceData, setAttendanceData] = useState({});
    const [academicYear, setAcademicYear] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchReportCard();
    }, []);

    const fetchReportCard = async () => {
        try {
            const response = await apiClient.get('/reports/my-report-card');
            const { studentInfo, marks, attendance, academicYear } = response.data;
            if (!studentInfo || !studentInfo.class_group) { throw new Error("Student data is incomplete."); }
            setStudentInfo(studentInfo); setAcademicYear(academicYear);
            const subjects = CLASS_SUBJECTS[studentInfo.class_group] || [];
            const marksMap = {};
            subjects.forEach(subject => { marksMap[subject] = {}; Object.values(EXAM_MAPPING).forEach(examKey => { marksMap[subject][examKey] = '-'; }); });
            marks.forEach(mark => { const displayExamType = EXAM_MAPPING[mark.exam_type]; if (marksMap[mark.subject] && displayExamType) { marksMap[mark.subject][displayExamType] = mark.marks_obtained !== null ? mark.marks_obtained.toString() : '-'; } });
            setMarksData(marksMap);
            const attendanceMap = {};
            attendance.forEach(att => { if (att.month) { attendanceMap[att.month] = { workingDays: att.working_days ?? '-', presentDays: att.present_days ?? '-' }; } });
            setAttendanceData(attendanceMap);
        } catch (err) { console.error('Error fetching report card:', err); setError('Could not load report card data. Please try again later.'); } finally { setLoading(false); }
    };

    const hasPermission = async () => {
        if (Platform.OS === 'ios') return true;
        const permission = Platform.Version >= 33
            ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
            : PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
        const hasPermission = await PermissionsAndroid.check(permission);
        if (hasPermission) return true;
        const status = await PermissionsAndroid.request(permission, {
            title: 'Storage Permission Required',
            message: 'This app needs access to your storage to download the report card.',
            buttonPositive: 'OK',
        });
        return status === PermissionsAndroid.RESULTS.GRANTED;
    };

    const handleDownload = async () => {
        if (Platform.OS === 'android' && !(await hasPermission())) {
            Alert.alert('Permission Denied', 'Storage permission is required to save the image.');
            return;
        }
        try {
            if (!captureRef.current) {
                Alert.alert('Error', 'Cannot capture the report card right now. Please try again.');
                return;
            }
            const uri = await captureRef.current.capture();
            await CameraRoll.save(uri, { type: 'photo', album: 'Vivekananda School' });
            Alert.alert('Success', 'Report card saved to your photo gallery!');
        } catch (error) {
            console.error('Failed to save report card:', error);
            Alert.alert('Error', `Failed to save the report card. Please try again.\n\nError details: ${error.message}`);
        }
    };

    if (loading) { return <View style={[styles.loaderContainer, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>; }
    if (error || !studentInfo) { return <View style={[styles.loaderContainer, { backgroundColor: theme.background }]}><Text style={[styles.errorText, { color: theme.textMain }]}>{error || 'No report card data available.'}</Text></View>; }

    const reportCardProps = { studentInfo, academicYear, marksData, attendanceData, theme };

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.textMain }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialIcons name="assessment" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Report Card</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Academic Performance</Text>
                    </View>
                </View>
            </View>

            {/* 1. HIDDEN VIEW FOR A4 CAPTURE (Always White/Light for Printing) */}
            <View style={styles.hiddenContainer}>
                <ViewShot ref={captureRef} options={{ format: 'png', quality: 1.0 }}>
                    <ReportCardContent {...reportCardProps} isForCapture={true} />
                </ViewShot>
            </View>

            {/* 2. VISIBLE VIEW FOR USER INTERACTION (Adapts to Theme) */}
            <ScrollView contentContainerStyle={styles.container}>
                <ReportCardContent {...reportCardProps} isForCapture={false} />
            </ScrollView>

            {/* 3. DOWNLOAD BUTTON */}
            <TouchableOpacity style={[styles.downloadButton, { backgroundColor: theme.primary }]} onPress={handleDownload}>
                <Feather name="download" size={24} color="#fff" />
                <Text style={styles.downloadButtonText}>Download Report</Text>
            </TouchableOpacity>
        </View>
    );
};

// --- STYLES (Layout Only - Colors handled in Component) ---
const styles = StyleSheet.create({
    hiddenContainer: { position: 'absolute', top: -10000, left: 0, zIndex: -1 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { fontSize: 16, textAlign: 'center' },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 0,
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

    // Content Container
    container: {
        padding: 15,
        paddingBottom: 100,
    },
    card: {
        borderRadius: 12,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    
    // Report Card Internals
    schoolHeader: { alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, paddingBottom: 20 },
    logo: { width: 400, height: 130, resizeMode: 'contain', marginBottom: -10 },
    schoolName: { fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
    schoolSub: { fontSize: 16, marginTop: 2, textAlign: 'center' },
    schoolContact: { fontSize: 14, marginTop: 8, textAlign: 'center' },
    schoolAddress: { fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 18 },
    studentInfoContainer: { borderRadius: 8, padding: 15, marginBottom: 25, borderWidth: 1 },
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
    infoLabel: { fontSize: 15, fontWeight: '600', width: 80 },
    infoValue: { fontSize: 15, flex: 1 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginVertical: 20, marginTop: 25 },
    table: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1 },
    tableHeader: { padding: 12, fontWeight: 'bold', textAlign: 'center', fontSize: 12, borderRightWidth: 1 },
    tableCell: { padding: 12, textAlign: 'center', fontSize: 14, borderRightWidth: 1 },
    subjectCol: { width: 90, textAlign: 'left', fontWeight: '600' },
    markCol: { width: 55 },
    totalRow: { },
    attendanceHeaderCol: { width: 120, textAlign: 'left', fontWeight: '600'},
    attendanceDataCol: { width: 70 },
    downloadButton: { position: 'absolute', bottom: 20, left: 20, right: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 15, borderRadius: 10, elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, },
    downloadButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10, },
});

// --- PRINT STYLES (Fixed White/Black for Capture) ---
const printStyles = StyleSheet.create({
    card: { backgroundColor: '#ffffff', padding: 30, width: 840 },
    schoolHeader: { alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 20 },
    logo: { width: 300, height: 100, resizeMode: 'contain', marginBottom: -5 },
    schoolName: { fontSize: 24, fontWeight: 'bold', color: '#000', textAlign: 'center' },
    schoolSub: { fontSize: 18, color: '#333', marginTop: 2, textAlign: 'center' },
    schoolContact: { fontSize: 16, color: '#333', marginTop: 8, textAlign: 'center' },
    schoolAddress: { fontSize: 14, color: '#333', textAlign: 'center', marginTop: 4, lineHeight: 20 },
    studentInfoContainer: { backgroundColor: '#fff', borderRadius: 8, padding: 20, marginBottom: 25, borderWidth: 1, borderColor: '#000' },
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    infoLabel: { fontSize: 16, fontWeight: '600', color: '#000', width: 80 },
    infoValue: { fontSize: 16, color: '#000', flex: 1 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#000', textAlign: 'center', marginVertical: 20, marginTop: 25 },
    table: { borderWidth: 1, borderColor: '#000', borderRadius: 8, overflow: 'hidden' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000' },
    tableHeader: { padding: 12, fontWeight: 'bold', textAlign: 'center', backgroundColor: '#f0f0f0', color: '#000', fontSize: 14, borderRightWidth: 1, borderRightColor: '#000' },
    tableCell: { padding: 12, textAlign: 'center', color: '#000', fontSize: 14, borderRightWidth: 1, borderRightColor: '#000' },
    subjectCol: { width: 120, textAlign: 'left', fontWeight: '600' },
    markCol: { width: 60 },
    totalRow: { backgroundColor: '#f0f0f0' },
    attendanceHeaderCol: { width: 150, textAlign: 'left', fontWeight: '600' },
    attendanceDataCol: { width: 60 },
});

export default StudentReportCardScreen;