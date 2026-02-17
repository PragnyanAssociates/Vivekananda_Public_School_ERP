/**
 * File: src/screens/report/MarksEntryScreen.js
 * Purpose: Data Entry for Marks & Attendance with Smart Saving.
 * Updated: 
 * 1. Default state is now "View Mode" (Edit Button Visible) to ensure smooth scrolling.
 * 2. Saving marks (even with no changes) switches back to View Mode.
 * 3. Fixed Scrolling Issue on Inputs (pointerEvents wrapper).
 * 4. Responsive Table & Date Formatting (DD/MM/YYYY).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TextInput,
    TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Dimensions,
    useColorScheme, StatusBar, KeyboardAvoidingView, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Get Screen Dimensions for Responsive Design
const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#cbd5e1',
    inputBg: '#FFFFFF',
    inputBorder: '#90A4AE',
    inputBgDisabled: '#F1F5F9',
    tableHeaderBg: '#34495e',
    tableBorder: '#e2e8f0',
    successBg: '#e8f5e9',
    successBgDark: '#c8e6c9',
    iconBg: '#E0F2F1',
    textPlaceholder: '#94a3b8'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    inputBorder: '#555555',
    inputBgDisabled: '#252525',
    tableHeaderBg: '#252525',
    tableBorder: '#333333',
    successBg: '#1b3a24',
    successBgDark: '#0e2615',
    iconBg: '#333333',
    textPlaceholder: '#64748b'
};

// --- CONSTANTS ---
const CLASS_SUBJECTS = {
    'LKG': ['All Subjects'],
    'UKG': ['All Subjects'],
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

const EDITABLE_EXAM_TYPES = [
    'Assignment-1', 'Unitest-1',
    'Assignment-2', 'Unitest-2',
    'Assignment-3', 'Unitest-3',
    'Assignment-4', 'Unitest-4',
    'SA1', 'SA2'
];

const ALL_EXAM_OPTIONS = ['Overall', ...EDITABLE_EXAM_TYPES];

const EXAM_KEY_MAPPING = {
    'Assignment-1': 'AT1', 'Unitest-1': 'UT1', 'Assignment-2': 'AT2',
    'Unitest-2': 'UT2', 'Assignment-3': 'AT3', 'Unitest-3': 'UT3',
    'Assignment-4': 'AT4', 'Unitest-4': 'UT4', 'SA1': 'SA1', 'SA2': 'SA2',
    'Overall': 'Total'
};

const EXAM_DISPLAY_MAPPING = {
    'AT1': 'Assignment-1', 'UT1': 'Unitest-1', 'AT2': 'Assignment-2',
    'UT2': 'Unitest-2', 'AT3': 'Assignment-3', 'UT3': 'Unitest-3',
    'AT4': 'Assignment-4', 'UT4': 'Unitest-4', 'SA1': 'SA1', 'SA2': 'SA2',
    'Total': 'Overall'
};

const MONTHS = [
    'June', 'July', 'August', 'September', 'October', 'November',
    'December', 'January', 'February', 'March', 'April', 'May'
];

// --- HELPER FUNCTION: Date Format (DD/MM/YYYY) ---
const getFormattedDate = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // January is 0!
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

const MarksEntryScreen = ({ route, navigation }) => {
    const { classGroup } = route.params;
    const subjects = CLASS_SUBJECTS[classGroup] || [];

    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const { user } = useAuth();
    const userRole = user?.role || 'teacher';
    const userId = user?.id;

    const [students, setStudents] = useState([]);

    // Current Data (Editable)
    const [marksData, setMarksData] = useState({});
    const [attendanceData, setAttendanceData] = useState({});

    // Original Data Snapshots (For Differential Saving)
    const [originalMarksData, setOriginalMarksData] = useState({});
    const [originalAttendanceData, setOriginalAttendanceData] = useState({});

    const [teacherAssignments, setTeacherAssignments] = useState([]);

    const [selectedExam, setSelectedExam] = useState('Overall');
    const [viewMode, setViewMode] = useState('marks');
    const [sortOrder, setSortOrder] = useState('rollno');

    // Default to FALSE (Read-Only) to allow smooth scrolling initially
    const [isEditing, setIsEditing] = useState(false);
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchClassData();
    }, [classGroup]);

    // When changing Exam or Mode, Reset to Read-Only (Scroll Mode)
    useEffect(() => {
        setIsEditing(false);
    }, [selectedExam, viewMode]);

    const fetchClassData = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/reports/class-data/${classGroup}`);
            const { students, marks, attendance, assignments } = response.data;

            setStudents(students);
            setTeacherAssignments(assignments || []);

            // --- 1. Process Marks Data ---
            const marksMap = {};
            students.forEach(student => {
                marksMap[student.id] = {};
                subjects.forEach(subject => {
                    marksMap[student.id][subject] = {};
                    EDITABLE_EXAM_TYPES.forEach(exam => {
                        marksMap[student.id][subject][exam] = '';
                    });
                });
            });

            marks.forEach(mark => {
                if (marksMap[mark.student_id] && marksMap[mark.student_id][mark.subject]) {
                    const displayExamType = EXAM_DISPLAY_MAPPING[mark.exam_type];
                    if (displayExamType && EDITABLE_EXAM_TYPES.includes(displayExamType)) {
                        marksMap[mark.student_id][mark.subject][displayExamType] =
                            mark.marks_obtained !== null ? mark.marks_obtained.toString() : '';
                    }
                }
            });

            setMarksData(marksMap);
            setOriginalMarksData(JSON.parse(JSON.stringify(marksMap)));


            // --- 2. Process Attendance Data ---
            const attendanceMap = {};
            students.forEach(student => {
                attendanceMap[student.id] = {};
                MONTHS.forEach(month => {
                    attendanceMap[student.id][month] = { working_days: '', present_days: '' };
                });
            });

            attendance.forEach(att => {
                if (attendanceMap[att.student_id]) {
                    attendanceMap[att.student_id][att.month] = {
                        working_days: att.working_days !== null ? att.working_days.toString() : '',
                        present_days: att.present_days !== null ? att.present_days.toString() : ''
                    };
                }
            });

            setAttendanceData(attendanceMap);
            setOriginalAttendanceData(JSON.parse(JSON.stringify(attendanceMap)));

        } catch (error) {
            console.error('Error fetching class data:', error);
            Alert.alert('Error', 'Failed to load class data. Please check connection.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchClassData();
    }, [classGroup]);

    // Update Local State for Marks
    const updateMarks = (studentId, subject, examType, value) => {
        const cleanValue = value.replace(/[^0-9.]/g, '');
        setMarksData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [subject]: {
                    ...prev[studentId][subject],
                    [examType]: cleanValue
                }
            }
        }));
    };

    // Update Local State for Attendance
    const updateAttendance = (studentId, month, field, value) => {
        const cleanValue = value.replace(/[^0-9]/g, ''); // Numbers only
        setAttendanceData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [month]: {
                    ...prev[studentId][month],
                    [field]: cleanValue
                }
            }
        }));
    };

    const calculateOverallForSubject = (studentId, subject) => {
        const studentMarks = marksData[studentId]?.[subject] || {};
        let total = 0;
        EDITABLE_EXAM_TYPES.forEach(examType => {
            const marks = parseFloat(studentMarks[examType]) || 0;
            total += marks;
        });
        return total > 0 ? total : '';
    };

    const calculateStudentGrandTotal = (studentId) => {
        let total = 0;
        subjects.forEach(subject => {
            const overall = calculateOverallForSubject(studentId, subject);
            total += parseFloat(overall) || 0;
        });
        return total;
    };

    const getSortedStudents = () => {
        if (sortOrder === 'rollno') {
            return [...students].sort((a, b) => a.roll_no - b.roll_no);
        }
        const studentsWithTotals = students.map(student => ({
            ...student,
            totalMarks: calculateStudentGrandTotal(student.id)
        }));
        if (sortOrder === 'descending') {
            return studentsWithTotals.sort((a, b) => b.totalMarks - a.totalMarks);
        } else if (sortOrder === 'ascending') {
            return studentsWithTotals.sort((a, b) => a.totalMarks - b.totalMarks);
        }
        return studentsWithTotals;
    };

    const handleSave = async () => {
        if (viewMode === 'marks') {
            await saveMarks();
        } else {
            await saveAttendance();
        }
    };

    // --- SMART SAVE MARKS ---
    const saveMarks = async () => {
        setSaving(true);
        const marksPayload = [];

        students.forEach(student => {
            subjects.forEach(subject => {
                let subjectHasChange = false;

                EDITABLE_EXAM_TYPES.forEach(examDisplayType => {
                    const examKey = EXAM_KEY_MAPPING[examDisplayType];
                    const currentValue = marksData[student.id]?.[subject]?.[examDisplayType] || '';
                    const originalValue = originalMarksData[student.id]?.[subject]?.[examDisplayType] || '';

                    if (currentValue !== originalValue) {
                        subjectHasChange = true;
                        const marksValue = (currentValue.trim() === '') ? null : currentValue;
                        if (examKey) {
                            marksPayload.push({
                                student_id: student.id,
                                class_group: classGroup,
                                subject: subject,
                                exam_type: examKey,
                                marks_obtained: marksValue
                            });
                        }
                    }
                });

                if (subjectHasChange) {
                    const overallValue = calculateOverallForSubject(student.id, subject);
                    marksPayload.push({
                        student_id: student.id,
                        class_group: classGroup,
                        subject: subject,
                        exam_type: 'Total',
                        marks_obtained: overallValue === '' ? null : overallValue
                    });
                }
            });
        });

        if (marksPayload.length === 0) {
            Alert.alert("No Changes", "You haven't made any changes to save.");
            setSaving(false);
            setIsEditing(false); // Return to view mode even if no changes
            return;
        }

        try {
            await apiClient.post('/reports/marks/bulk', { marksPayload });
            setOriginalMarksData(JSON.parse(JSON.stringify(marksData)));
            Alert.alert('Success', 'Marks saved successfully!');
            setIsEditing(false); // Return to View Mode on success
        } catch (error) {
            console.error('Error saving marks:', error);
            const errMsg = error.response?.data?.message || 'Failed to save marks. Check internet connection.';
            Alert.alert('Save Failed', errMsg);
        } finally {
            setSaving(false);
        }
    };

    // --- SMART SAVE ATTENDANCE ---
    const saveAttendance = async () => {
        setSaving(true);
        const attendancePayload = [];

        students.forEach(student => {
            MONTHS.forEach(month => {
                const currentAtt = attendanceData[student.id]?.[month] || {};
                const originalAtt = originalAttendanceData[student.id]?.[month] || {};

                const currW = currentAtt.working_days !== null && currentAtt.working_days !== undefined ? String(currentAtt.working_days).trim() : '';
                const currP = currentAtt.present_days !== null && currentAtt.present_days !== undefined ? String(currentAtt.present_days).trim() : '';
                
                const origW = originalAtt.working_days !== null && originalAtt.working_days !== undefined ? String(originalAtt.working_days).trim() : '';
                const origP = originalAtt.present_days !== null && originalAtt.present_days !== undefined ? String(originalAtt.present_days).trim() : '';

                if (currW !== origW || currP !== origP) {
                    attendancePayload.push({
                        student_id: student.id,
                        month,
                        working_days: currW === '' ? null : currW,
                        present_days: currP === '' ? null : currP
                    });
                }
            });
        });

        if (attendancePayload.length === 0) {
            Alert.alert("No Changes", "No attendance changes detected.");
            setSaving(false);
            return;
        }

        try {
            await apiClient.post('/reports/attendance/bulk', { attendancePayload });
            setOriginalAttendanceData(JSON.parse(JSON.stringify(attendanceData)));
            Alert.alert('Success', 'Attendance updated successfully!');
        } catch (error) {
            console.error('Error saving attendance:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to save attendance');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <View style={[styles.loaderContainer, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
    }

    const sortedStudents = getSortedStudents();
    const isOverallView = selectedExam === 'Overall';
    const canEditScreen = !isOverallView && isEditing;
    const formattedDate = getFormattedDate(); // Date format DD/MM/YYYY

    return (
        <KeyboardAvoidingView 
            style={[styles.container, { backgroundColor: theme.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <Icon name="file-document-edit-outline" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>{classGroup}</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Date: {formattedDate}</Text>
                    </View>
                </View>

                {userRole === 'admin' && (
                    <TouchableOpacity
                        style={[styles.headerActionBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                        onPress={() => navigation.navigate('TeacherAssignment', { classGroup })}
                    >
                        <Icon name="account-plus" size={22} color={theme.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Mode Toggle Tabs */}
            <View style={[styles.tabContainer, { backgroundColor: theme.background }]}>
                <TouchableOpacity style={[styles.tabButton, viewMode === 'marks' && { borderBottomColor: theme.primary }]} onPress={() => setViewMode('marks')}>
                    <Text style={[styles.tabText, { color: viewMode === 'marks' ? theme.primary : theme.textSub }]}>Marks Entry</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabButton, viewMode === 'attendance' && { borderBottomColor: theme.primary }]} onPress={() => setViewMode('attendance')}>
                    <Text style={[styles.tabText, { color: viewMode === 'attendance' ? theme.primary : theme.textSub }]}>Attendance</Text>
                </TouchableOpacity>
            </View>

            {/* Filters for Marks (Visible only in Marks Mode) */}
            {viewMode === 'marks' && (
                <View style={styles.filterContainer}>
                    <View style={[styles.filterBox, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Picker
                            selectedValue={selectedExam}
                            onValueChange={setSelectedExam}
                            style={[styles.picker, { color: theme.textMain }]}
                            dropdownIconColor={theme.textMain}
                        >
                            {ALL_EXAM_OPTIONS.map(exam => <Picker.Item key={exam} label={exam} value={exam} color={theme.textMain} />)}
                        </Picker>
                    </View>
                    <View style={[styles.filterBox, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <Picker
                            selectedValue={sortOrder}
                            onValueChange={setSortOrder}
                            style={[styles.picker, { color: theme.textMain }]}
                            dropdownIconColor={theme.textMain}
                        >
                            <Picker.Item label="Roll No" value="rollno" color={theme.textMain} />
                            <Picker.Item label="High to Low" value="descending" color={theme.textMain} />
                            <Picker.Item label="Low to High" value="ascending" color={theme.textMain} />
                        </Picker>
                    </View>
                </View>
            )}

            {/* --- MAIN CONTENT AREA: BI-DIRECTIONAL SCROLL WRAPPER --- */}
            <View style={{ flex: 1, width: '100%' }}>
                
                {/* 1. VERTICAL SCROLL (Master) */}
                <ScrollView 
                    style={styles.verticalScroll} 
                    contentContainerStyle={styles.verticalScrollContent}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={true}
                    refreshControl={viewMode === 'attendance' ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} /> : null}
                >
                    {/* 2. HORIZONTAL SCROLL (Slave) - Wraps the Table */}
                    <ScrollView 
                        horizontal={true} 
                        style={styles.horizontalScroll}
                        contentContainerStyle={styles.horizontalScrollContent}
                        showsHorizontalScrollIndicator={true}
                        persistentScrollbar={true}
                        nestedScrollEnabled={true}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Table Wrapper ensures minimum width matches screen width */}
                        <View style={styles.tableWrapper}>

                            {/* --- TABLE HEADER --- */}
                            <View style={[styles.tableRow, styles.headerRow, { backgroundColor: theme.tableHeaderBg }]}>
                                <View style={[styles.cellHeader, styles.cellRollNo, { borderRightColor: theme.background }]}>
                                    <Text style={styles.headerText}>Roll</Text>
                                </View>
                                <View style={[styles.cellHeader, styles.cellName, { borderRightColor: theme.background }]}>
                                    <Text style={styles.headerText}>Name</Text>
                                </View>

                                {viewMode === 'marks' ? (
                                    <>
                                        {subjects.map(subject => (
                                            <View key={subject} style={[styles.cellHeader, styles.cellSubject, { borderRightColor: theme.background }]}>
                                                <Text style={styles.headerText}>{subject}</Text>
                                            </View>
                                        ))}
                                        <View style={[styles.cellHeader, styles.cellTotal, { borderRightColor: theme.background }]}>
                                            <Text style={styles.headerText}>Sub Tot</Text>
                                        </View>
                                        <View style={[styles.cellHeader, styles.cellTotal]}>
                                            <Text style={styles.headerText}>Grand Total</Text>
                                        </View>
                                    </>
                                ) : (
                                    <>
                                        {MONTHS.map(month => (
                                            <View key={month} style={[styles.cellHeader, styles.cellAttendance, { borderRightColor: theme.background }]}>
                                                <Text style={styles.headerText}>{month.substring(0, 3)}</Text>
                                                <Text style={styles.subHeaderText}>(Wrk / Pre)</Text>
                                            </View>
                                        ))}
                                    </>
                                )}
                            </View>

                            {/* --- TABLE BODY (DATA ROWS) --- */}
                            {sortedStudents.map(student => {
                                const studentGrandTotal = viewMode === 'marks' ? calculateStudentGrandTotal(student.id) : 0;
                                
                                return (
                                    <View key={student.id} style={[styles.tableRow, { borderBottomColor: theme.tableBorder }]}>
                                        
                                        {/* Fixed Columns: Roll No & Name */}
                                        <View style={[styles.cell, styles.cellRollNo, { backgroundColor: theme.cardBg, borderRightColor: theme.tableBorder }]}>
                                            <Text style={[styles.cellText, { color: theme.textMain }]}>{student.roll_no}</Text>
                                        </View>
                                        <View style={[styles.cell, styles.cellName, { backgroundColor: theme.cardBg, borderRightColor: theme.tableBorder }]}>
                                            <Text style={[styles.cellText, { color: theme.textMain }]} numberOfLines={2}>{student.full_name}</Text>
                                        </View>

                                        {/* Dynamic Columns: Marks */}
                                        {viewMode === 'marks' && subjects.map(subject => {
                                            const canUserEditSubject = () => {
                                                if (userRole === 'admin') return true;
                                                const assignment = teacherAssignments.find(a => a.subject === subject);
                                                if (assignment) return assignment.teacher_id === userId;
                                                return false;
                                            };

                                            // Only true if Global Edit Mode is ON AND user has permission
                                            const isEditable = canEditScreen && canUserEditSubject();
                                            
                                            const displayValue = isOverallView
                                                ? (calculateOverallForSubject(student.id, subject) || '').toString()
                                                : (marksData[student.id]?.[subject]?.[selectedExam] || '');

                                            return (
                                                <View key={subject} style={[styles.cell, styles.cellSubject, { backgroundColor: theme.cardBg, borderRightColor: theme.tableBorder }]}>
                                                    {/* 
                                                        POINTER EVENTS FIX:
                                                        When NOT editing (View Mode), disable touches on this wrapper.
                                                        This passes touches through to the ScrollView, ensuring smooth scrolling.
                                                    */}
                                                    <View style={styles.inputWrapper} pointerEvents={isEditable ? 'auto' : 'none'}>
                                                        <TextInput
                                                            style={[
                                                                styles.input,
                                                                { backgroundColor: theme.inputBg, color: theme.textMain },
                                                                !isEditable && { backgroundColor: theme.inputBgDisabled, color: theme.textPlaceholder },
                                                                // If in View Mode (Edit button visible), show text as bold/darker for readability
                                                                !isEditing && !isOverallView && { color: theme.textMain, fontWeight: '500' },
                                                                isOverallView && { backgroundColor: theme.inputBgDisabled, color: theme.textMain, fontWeight: 'bold' }
                                                            ]}
                                                            keyboardType="numeric"
                                                            maxLength={isOverallView ? 5 : 3}
                                                            value={displayValue}
                                                            onChangeText={(val) => updateMarks(student.id, subject, selectedExam, val)}
                                                            editable={isEditable}
                                                            placeholder={isEditable ? "-" : ""}
                                                            placeholderTextColor={theme.textPlaceholder}
                                                            selectTextOnFocus
                                                        />
                                                    </View>
                                                </View>
                                            );
                                        })}

                                        {/* Dynamic Columns: Marks Totals */}
                                        {viewMode === 'marks' && (
                                            <>
                                                <View style={[styles.cell, styles.cellTotal, { backgroundColor: theme.successBg, borderRightColor: theme.tableBorder }]}>
                                                    <Text style={[styles.cellText, styles.overallText]}>
                                                        {subjects.reduce((sum, subject) => {
                                                            const marks = isOverallView ? parseFloat(calculateOverallForSubject(student.id, subject)) || 0 : parseFloat(marksData[student.id]?.[subject]?.[selectedExam]) || 0;
                                                            return sum + marks;
                                                        }, 0) || '-'}
                                                    </Text>
                                                </View>
                                                <View style={[styles.cell, styles.cellTotal, { backgroundColor: theme.successBgDark }]}>
                                                    <Text style={[styles.cellText, styles.totalText]}>{studentGrandTotal || '-'}</Text>
                                                </View>
                                            </>
                                        )}

                                        {/* Dynamic Columns: Attendance */}
                                        {viewMode === 'attendance' && MONTHS.map(month => {
                                            const att = attendanceData[student.id]?.[month] || {};
                                            return (
                                                <View key={month} style={[styles.cell, styles.cellAttendance, { backgroundColor: theme.cardBg, borderRightColor: theme.tableBorder }]}>
                                                    <View style={styles.attendanceInputContainer}>
                                                        <TextInput
                                                            style={[
                                                                styles.attendanceInputBox, 
                                                                { backgroundColor: theme.inputBg, color: theme.textMain, borderColor: theme.inputBorder }
                                                            ]}
                                                            keyboardType="numeric"
                                                            maxLength={2}
                                                            placeholder="W"
                                                            placeholderTextColor={theme.textPlaceholder}
                                                            value={att.working_days}
                                                            onChangeText={(val) => updateAttendance(student.id, month, 'working_days', val)}
                                                            selectTextOnFocus
                                                        />
                                                        <Text style={[styles.attendanceSeparator, { color: theme.textSub }]}>/</Text>
                                                        <TextInput
                                                            style={[
                                                                styles.attendanceInputBox, 
                                                                { backgroundColor: theme.inputBg, color: theme.textMain, borderColor: theme.inputBorder }
                                                            ]}
                                                            keyboardType="numeric"
                                                            maxLength={2}
                                                            placeholder="P"
                                                            placeholderTextColor={theme.textPlaceholder}
                                                            value={att.present_days}
                                                            onChangeText={(val) => updateAttendance(student.id, month, 'present_days', val)}
                                                            selectTextOnFocus
                                                        />
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                </ScrollView>
            </View>

            {/* --- ACTION BUTTONS --- */}
            <View style={styles.actionButtonContainer}>
                {viewMode === 'attendance' ? (
                    <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primary }, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Attendance</Text>}
                    </TouchableOpacity>
                ) : viewMode === 'marks' && !isOverallView ? (
                    isEditing ? (
                        <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primary }, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Marks</Text>}
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
                            <Icon name="pencil" size={20} color="#fff" style={{ marginRight: 5 }} />
                            <Text style={styles.editButtonText}>Edit Marks</Text>
                        </TouchableOpacity>
                    )
                ) : null}
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // --- SCROLL CONTAINERS ---
    verticalScroll: { 
        flex: 1, 
        width: '100%',
    },
    verticalScrollContent: {
        flexGrow: 1,
        paddingBottom: 80, // Space for the save button
    },
    horizontalScroll: {
        width: '100%',
    },
    horizontalScrollContent: {
        flexGrow: 1,
    },
    
    // --- HEADER ---
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
        shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },
    headerActionBtn: { padding: 8, borderRadius: 8, borderWidth: 1 },

    // --- TABS ---
    tabContainer: { flexDirection: 'row', paddingHorizontal: 15, paddingTop: 5, marginBottom: 10 },
    tabButton: { flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', alignItems: 'center' },
    tabText: { fontSize: 16, fontWeight: '500' },

    // --- FILTERS ---
    filterContainer: { flexDirection: 'row', gap: 12, paddingHorizontal: 15, marginBottom: 10 },
    filterBox: { flex: 1, borderRadius: 10, overflow: 'hidden', borderWidth: 1, height: 45, justifyContent: 'center' },
    picker: { width: '100%' },

    // --- TABLE STRUCTURE ---
    tableWrapper: { 
        minWidth: width, // Ensures table spans at least full screen width
        paddingHorizontal: 10,
    },
    tableRow: { 
        flexDirection: 'row', 
        borderBottomWidth: 1, 
        alignItems: 'center', 
        minHeight: 60 
    },
    headerRow: {
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        overflow: 'hidden',
    },
    cellHeader: { 
        padding: 5, 
        justifyContent: 'center', 
        alignItems: 'center', 
        borderRightWidth: 1, 
        height: 60 
    },
    cell: { 
        padding: 0, 
        justifyContent: 'center', 
        alignItems: 'center', 
        borderRightWidth: 1, 
        height: 60 
    },

    // RESPONSIVE COLUMN WIDTHS
    cellRollNo: { width: 50 },
    cellName: { width: 140 }, // Fixed width for name to keep it readable
    cellSubject: { width: 75 },
    cellTotal: { width: 75 },
    cellAttendance: { width: 130 },

    headerText: { fontSize: 12, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
    subHeaderText: { fontSize: 10, color: '#ecf0f1', marginTop: 2, textAlign: 'center' },
    cellText: { fontSize: 12, textAlign: 'center', paddingHorizontal: 2 },
    overallText: { fontWeight: 'bold', color: '#1b5e20' },
    totalText: { fontWeight: 'bold', color: '#1b5e20', fontSize: 13 },

    // INPUTS & WRAPPERS
    inputWrapper: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    input: {
        borderWidth: 0,
        textAlign: 'center',
        fontSize: 14,
        width: '100%',
        height: '100%',
        padding: 0,
        margin: 0,
        textAlignVertical: 'center',
        includeFontPadding: false
    },

    // ATTENDANCE INPUTS
    attendanceInputContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        width: '100%', 
        height: '100%', 
        justifyContent: 'center',
        paddingHorizontal: 5
    },
    attendanceInputBox: { 
        flex: 1, 
        maxWidth: 40,
        height: 36, 
        textAlign: 'center', 
        borderWidth: 1, 
        borderRadius: 4, 
        fontSize: 14,
        padding: 0,
        textAlignVertical: 'center',
        includeFontPadding: false
    },
    attendanceSeparator: { fontSize: 18, marginHorizontal: 4 },

    // ACTION BUTTON CONTAINER
    actionButtonContainer: {
        width: '100%',
        alignItems: 'center',
        paddingBottom: 20,
    },
    saveButton: { width: '90%', padding: 14, borderRadius: 25, alignItems: 'center', elevation: 3 },
    saveButtonDisabled: { opacity: 0.6 },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    editButton: { backgroundColor: '#e67e22', width: '90%', padding: 14, borderRadius: 25, alignItems: 'center', elevation: 3, flexDirection: 'row', justifyContent: 'center' },
    editButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default MarksEntryScreen;