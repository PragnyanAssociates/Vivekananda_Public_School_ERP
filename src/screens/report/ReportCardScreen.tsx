import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView,
    TouchableOpacity, ActivityIndicator, Alert, TextInput, Dimensions, Image
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// --- Constants ---
const PRIMARY_COLOR = '#673AB7'; // Deep Purple
const ACCENT_COLOR = '#FFC107'; // Amber for alerts/highlights
const BORDER_COLOR = '#E0E0E0';
const HEADER_COLOR = '#F5F5F5';
const TEXT_COLOR_DARK = '#212121';
const TEXT_COLOR_MEDIUM = '#616161';
const CLASS_GROUPS = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
const { width } = Dimensions.get('window');
const SUBJECT_COLUMN_WIDTH = 80;

// All 10 discrete exam types
const ALL_EXAM_TYPES = [
    'Assignment 1', 'Assignment 2', 'Assignment 3', 'Assignment 4',
    'Unit Test 1', 'Unit Test 2', 'Unit Test 3', 'Unit Test 4',
    'SA 1', 'SA 2'
];

// --- Type Definitions ---
interface StudentMark {
    student_id: number;
    full_name: string;
    roll_no: string;
    marks: { [subject: string]: number | undefined }; // Current exam marks (editable)
    totalMarks?: { [subject: string]: { [exam: string]: number } }; // Detailed history (read-only for overall calc)
}

interface ExamConfig {
    subjects: string[];
    examTypes: string[];
}


// --- Report Card View Component (Student Only) ---

const ProgressCardView = ({ studentId }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchProgressCard = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/reportcard/progresscard/${studentId}`);
            setData(response.data);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to fetch report card.');
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProgressCard();
    }, [studentId]);

    if (loading) return <ActivityIndicator size="large" color={PRIMARY_COLOR} style={{ marginTop: 50 }} />;
    if (!data) return <Text style={styles.noDataText}>Report card data not found.</Text>;

    const { studentDetails, marks, attendance, overallTotals } = data;

    const getMarkDisplay = (subject, examType) => {
        return marks[subject] && marks[subject][examType] !== undefined
            ? marks[subject][examType]
            : '-';
    };

    const getMonthName = (monthYear) => {
        if (!monthYear) return '';
        const date = new Date(monthYear + '-01');
        return date.toLocaleString('en-US', { month: 'short' });
    };

    const totalWorkingDays = attendance.reduce((sum, att) => sum + att.total_working_days, 0);
    const totalDaysPresent = attendance.reduce((sum, att) => sum + att.days_present, 0);

    return (
        <ScrollView contentContainerStyle={styles.cardScrollView}>
            <View style={styles.cardContainer}>
                
                {/* --- FRONT SIDE (Image 4) --- */}
                <View style={[styles.cardSection, styles.cardFront]}>
                    <View style={styles.cardHeader}>
                        {/* Sample School Logo */}
                        <Image
                            source={{ uri: 'https://cdn-icons-png.flaticon.com/128/992/992683.png' }} 
                            style={styles.logo}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.schoolName}>Modern School Management</Text>
                            <Text style={styles.reportTitle}>PROGRESS CARD (2023-2024)</Text>
                            <Text style={styles.reportSubtitle}>Class: {studentDetails.class_group}</Text>
                        </View>
                        {/* Profile Picture */}
                        <Image 
                            source={{ uri: studentDetails.profile_image_url || 'https://cdn-icons-png.flaticon.com/128/3135/3135715.png' }}
                            style={styles.profileImage}
                        />
                    </View>

                    <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Student Information</Text>
                    <View style={styles.detailsBox}>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Student Name:</Text>
                            <Text style={styles.detailValue}>{studentDetails.full_name}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Roll No:</Text>
                            <Text style={styles.detailValue}>{studentDetails.roll_no}</Text>
                        </View>
                         <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Date of Birth:</Text>
                            <Text style={styles.detailValue}>{studentDetails.dob || 'N/A'}</Text>
                        </View>
                         <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Parent Name:</Text>
                            <Text style={styles.detailValue}>{studentDetails.parent_name || 'N/A'}</Text>
                        </View>
                    </View>


                    <Text style={[styles.sectionTitle, { marginTop: 25 }]}>Attendance Particulars</Text>
                    <View style={styles.attendanceTable}>
                        <View style={styles.attendanceRowHeader}>
                            <Text style={[styles.attendanceCellHeader, { width: 80 }]}>Month</Text>
                            <Text style={styles.attendanceCellHeader}>Working Days</Text>
                            <Text style={styles.attendanceCellHeader}>Days Present</Text>
                        </View>
                        {attendance.map((att, index) => (
                            <View key={index} style={styles.attendanceRow}>
                                <Text style={[styles.attendanceCell, { width: 80, fontWeight: 'bold' }]}>{getMonthName(att.month)}</Text>
                                <Text style={styles.attendanceCell}>{att.total_working_days}</Text>
                                <Text style={styles.attendanceCell}>{att.days_present}</Text>
                            </View>
                        ))}
                        <View style={[styles.attendanceRow, styles.attendanceFooter]}>
                            <Text style={[styles.attendanceCell, { width: 80, fontWeight: '900', color: PRIMARY_COLOR }]}>Total</Text>
                            <Text style={[styles.attendanceCell, { fontWeight: '900', color: PRIMARY_COLOR }]}>{totalWorkingDays}</Text>
                            <Text style={[styles.attendanceCell, { fontWeight: '900', color: PRIMARY_COLOR }]}>{totalDaysPresent}</Text>
                        </View>
                    </View>
                </View>

                {/* --- BACK SIDE (Image 5) --- */}
                <View style={[styles.cardSection, styles.cardBack]}>
                    <Text style={[styles.sectionTitle, { marginBottom: 15 }]}>Academic Assessment (Marks Out of Max.)</Text>
                    
                    {/* Marks Table */}
                    <ScrollView horizontal>
                        <View>
                            <View style={styles.marksTableHeader}>
                                <Text style={[styles.marksCellHeader, { width: 80, backgroundColor: PRIMARY_COLOR }]}>Subjects</Text>
                                {ALL_EXAM_TYPES.map(exam => (
                                    <Text key={exam} style={styles.marksCellHeader}>{exam.replace('Assignment', 'Asg').replace('Unit Test', 'UT').replace(' ', '\n')}</Text>
                                ))}
                                <Text style={[styles.marksCellHeader, { width: 60, backgroundColor: ACCENT_COLOR, color: TEXT_COLOR_DARK }]}>OVERALL</Text>
                            </View>
                            
                            {Object.keys(marks).map(subject => (
                                <View key={subject} style={styles.marksTableRow}>
                                    <Text style={[styles.marksCell, { width: 80, fontWeight: 'bold' }]}>{subject}</Text>
                                    {ALL_EXAM_TYPES.map(exam => (
                                        <Text key={exam} style={styles.marksCell}>
                                            {getMarkDisplay(subject, exam)}
                                        </Text>
                                    ))}
                                    <Text style={[styles.marksCell, { width: 60, fontWeight: 'bold', backgroundColor: '#FFF9C4' }]}>
                                        {overallTotals[subject] || 0}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    <View style={styles.signatureContainer}>
                        <Text style={styles.signatureText}>Parent Signature: _________________________</Text>
                        <Text style={styles.signatureText}>Class Teacher Signature: _________________________</Text>
                    </View>
                    
                </View>
            </View>
        </ScrollView>
    );
};


// --- Mark Input Grid Component (Admin/Teacher) ---

const MarkInputGrid = ({ classGroup, config }) => {
    const { user } = useAuth();
    const [marksData, setMarksData] = useState<StudentMark[]>([]);
    const [selectedExam, setSelectedExam] = useState('Overall'); // Default to Overall view
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [allExamMarks, setAllExamMarks] = useState<StudentMark[]>([]); // Data for "Overall" calculation
    
    const isOverallView = selectedExam === 'Overall';
    
    // Authorization check: Admin can edit any column. Teacher can only edit subjects they teach.
    const teacherSubjects = useMemo(() => {
        if (user?.role === 'admin') return config.subjects; 
        try {
            const parsedSubjects = JSON.parse(user?.subjects_taught || '[]');
            return Array.isArray(parsedSubjects) ? parsedSubjects : [];
        } catch {
            return [];
        }
    }, [user, config.subjects]);
    
    // 1. Fetch ALL marks for overall calculation
    const fetchAllMarks = useCallback(async () => {
        if (!classGroup || !config.examTypes.length) {
            setLoading(false);
            return;
        }
        
        const marksPromises = config.examTypes.map(examType =>
             apiClient.get(`/reportcard/marks/${classGroup}/${examType}`)
        );

        try {
            const results = await Promise.all(marksPromises);
            
            const studentBaseMap = {};
            
            // 1. Collect the list of unique students
            results.forEach(response => {
                 response.data.forEach(student => {
                    if (!studentBaseMap[student.student_id]) {
                        studentBaseMap[student.student_id] = {
                            student_id: student.student_id,
                            full_name: student.full_name,
                            roll_no: student.roll_no,
                            totalMarks: {} 
                        };
                        // Initialize totalMarks structure
                        config.subjects.forEach(subject => {
                            studentBaseMap[student.student_id].totalMarks[subject] = {};
                        });
                    }
                 });
            });

            // 2. Populate the detailed marks map (TotalMarks)
            results.forEach((response, index) => {
                const examType = config.examTypes[index];
                
                response.data.forEach(student => {
                    const studentId = student.student_id;
                    if (studentBaseMap[studentId]) { 
                        config.subjects.forEach(subject => {
                             const mark = student.marks[subject];
                             // Store mark only if it exists (not undefined/null)
                             if (mark !== undefined && mark !== null) {
                                studentBaseMap[studentId].totalMarks[subject][examType] = mark;
                             }
                        });
                    }
                });
            });
            
            setAllExamMarks(Object.values(studentBaseMap));
            
            // If currently in 'Overall' view, update the main marksData array
            if (selectedExam === 'Overall') {
                 setMarksData(Object.values(studentBaseMap).map(s => ({
                    student_id: s.student_id,
                    full_name: s.full_name,
                    roll_no: s.roll_no,
                    marks: {} // This is empty in Overall view as marks are calculated
                 })));
            }

        } catch (error) {
            console.error("Failed to fetch all marks:", error);
        } finally {
            setLoading(false);
        }
    }, [classGroup, config.examTypes, config.subjects, selectedExam]);


    // 2. Fetch marks for a single, specific exam type
    const fetchSpecificMarks = useCallback(async () => {
        if (!classGroup || !selectedExam || isOverallView) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const response = await apiClient.get(`/reportcard/marks/${classGroup}/${selectedExam}`);
            setMarksData(response.data); 
        } catch (error) {
            Alert.alert('Error', 'Failed to load marks data for the selected exam.');
            setMarksData([]);
        } finally {
            setLoading(false);
        }
    }, [classGroup, selectedExam, isOverallView]);
    
    
    useEffect(() => {
        fetchAllMarks(); // Always fetch all marks to keep overall data current
    }, [fetchAllMarks]);
    
    useEffect(() => {
        if (!isOverallView) {
            fetchSpecificMarks();
        } else {
            // Re-map the comprehensive student list for the Overall view display
            setMarksData(allExamMarks.map(s => ({
                student_id: s.student_id,
                full_name: s.full_name,
                roll_no: s.roll_no,
                marks: {} 
            })));
        }
    }, [isOverallView, fetchSpecificMarks, allExamMarks]);


    const handleExamTypeChange = (itemValue) => {
        setSelectedExam(itemValue);
        // Loading status will be set in useEffect triggered by selectedExam change
    };

    const handleMarkChange = (student_id: number, subject: string, value: string) => {
        if (isOverallView) return; 
        
        // Treat empty string as undefined/null for database upsert
        const mark = value === '' ? undefined : parseInt(value, 10);
        
        setMarksData(prevData =>
            prevData.map(student => {
                if (student.student_id === student_id) {
                    return {
                        ...student,
                        marks: {
                            ...student.marks,
                            [subject]: mark,
                        },
                    };
                }
                return student;
            })
        );
    };
    
    /**
     * Calculates total marks for a subject column OR overall total based on the view
     * @param studentId The ID of the student
     * @param subject The subject name (ignored if calculateRowTotal is true)
     * @param calculateRowTotal If true, calculates the row's total across all subjects.
     */
    const calculateMark = (studentId: number, subject: string, calculateRowTotal: boolean): number => {
        const student = (isOverallView ? allExamMarks : marksData).find(s => s.student_id === studentId);
        if (!student) return 0;

        if (isOverallView) {
            // Overall View Logic
            
            // 1. Calculate GRAND ROW TOTAL (Sum of all subject overall totals)
            if (calculateRowTotal) {
                return config.subjects.reduce((sum, subj) => sum + calculateMark(studentId, subj, false), 0);
            }
            
            // 2. Calculate SUBJECT TOTAL (Sum of all recorded exam marks for this subject)
            if (!student.totalMarks?.[subject]) return 0;
            return Object.values(student.totalMarks[subject]).reduce((sum, mark) => sum + (mark || 0), 0);

        } else {
            // Single Exam View Logic
            
            // 1. Calculate ROW TOTAL (Sum of subjects for the current single exam)
            if (calculateRowTotal) {
                return config.subjects.reduce((sum, subj) => {
                    const mark = student.marks[subj];
                    return sum + (typeof mark === 'number' && !isNaN(mark) ? mark : 0);
                }, 0);
            } else {
                // 2. Individual subject mark
                 const mark = student.marks[subject];
                 return (typeof mark === 'number' && !isNaN(mark) ? mark : 0);
            }
        }
    };


    const handleSave = async () => {
        if (isOverallView) {
            Alert.alert('Read Only', 'Overall view cannot be saved. Marks are calculated automatically.');
            return;
        }
        if (isSaving) return;
        
        // Prepare data for API
        const marksToSave = marksData.map(student => {
            const filteredMarks = {};
            Object.entries(student.marks).forEach(([subject, mark]) => {
                // Check permissions (Admin can edit, Teacher needs subject permission)
                if ((user?.role === 'admin' || teacherSubjects.includes(subject))) {
                    // Only include marks that are explicitly set (number) OR undefined (empty input)
                    // Null values are filtered by API logic
                    filteredMarks[subject] = mark; 
                }
            });
            return { student_id: student.student_id, marks: filteredMarks };
        });

        setIsSaving(true);
        try {
            await apiClient.post('/reportcard/marks', {
                classGroup,
                examType: selectedExam,
                marksData: marksToSave,
                teacherId: user.id
            });
            Alert.alert('Success', `${selectedExam} marks saved successfully.`);
            // Refetch all marks to ensure overall totals are updated immediately
            fetchAllMarks(); 
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to save marks.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!user || loading) {
        return <ActivityIndicator size="large" color={PRIMARY_COLOR} style={{ marginTop: 50 }} />;
    }
    
    const studentsToDisplay = marksData; 

    if (studentsToDisplay.length === 0) {
        return <Text style={styles.noDataText}>No students found in this class.</Text>;
    }
    
    // Calculate total width needed for horizontal scrolling
    const fixedWidth = 50 + 150; // Roll No + Name
    const subjectsWidth = config.subjects.length * SUBJECT_COLUMN_WIDTH;
    const totalColumnWidth = fixedWidth + subjectsWidth + 60; 
    
    // Display the current teacher's subject assignment
    const teacherAssignmentInfo = teacherSubjects.length === config.subjects.length && user?.role === 'admin' 
        ? 'Admin (All Subjects)'
        : teacherSubjects.join(', ') || 'None Assigned';


    return (
        <View style={styles.gridContainer}>
            
            <View style={styles.teacherInfoBox}>
                <Text style={styles.teacherInfoLabel}>Assigned Subject(s):</Text>
                <Text style={styles.teacherInfoValue}>{teacherAssignmentInfo}</Text>
            </View>
            
            <View style={styles.pickerWrapperHorizontal}>
                <Text style={styles.pickerLabel}>Exam Type:</Text>
                <View style={styles.pickerStyle}>
                    <Picker
                        selectedValue={selectedExam}
                        onValueChange={handleExamTypeChange}
                        style={styles.picker}
                    >
                        <Picker.Item key='Overall' label='Overall Marks (Total)' value='Overall' />
                        {config.examTypes.map(type => (
                            <Picker.Item key={type} label={type} value={type} />
                        ))}
                    </Picker>
                </View>
            </View>
            
            
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View style={{ width: totalColumnWidth }}>
                    {/* Header Row */}
                    <View style={styles.marksInputHeader}>
                        <Text style={[styles.marksInputCell, styles.headerCell, { width: 50 }]}>Roll No</Text>
                        <Text style={[styles.marksInputCell, styles.headerCell, { width: 150 }]}>Name</Text>
                        
                        {config.subjects.map(subject => (
                            <Text 
                                key={subject} 
                                style={[styles.marksInputCell, styles.headerCell, { width: SUBJECT_COLUMN_WIDTH, backgroundColor: teacherSubjects.includes(subject) || user?.role === 'admin' ? PRIMARY_COLOR : TEXT_COLOR_MEDIUM }]}
                            >
                                {subject}
                            </Text>
                        ))}
                        
                        <Text style={[styles.marksInputCell, styles.headerCell, { width: 60, backgroundColor: ACCENT_COLOR, color: TEXT_COLOR_DARK }]}>Total</Text>
                    </View>
                    
                    {/* Data Rows */}
                    {studentsToDisplay.map((student, index) => (
                        <View key={student.student_id} style={[styles.marksInputRow, index % 2 !== 0 && {backgroundColor: HEADER_COLOR}]}>
                            <Text style={[styles.marksInputCell, { width: 50, fontWeight: 'bold' }]}>{student.roll_no}</Text>
                            <Text style={[styles.marksInputCell, { width: 150, textAlign: 'left' }]} numberOfLines={2}>{student.full_name}</Text>
                            
                            {config.subjects.map(subject => {
                                const isEditable = !isOverallView && (user?.role === 'admin' || teacherSubjects.includes(subject));
                                
                                const displayMark = isOverallView 
                                    ? calculateMark(student.student_id, subject, false) // Subject total
                                    : (student.marks[subject]?.toString() ?? '');
                                
                                return (
                                    <View 
                                        key={subject} 
                                        style={[styles.marksInputCell, { width: SUBJECT_COLUMN_WIDTH, padding: 0 }]}
                                    >
                                        <TextInput
                                            style={[
                                                styles.marksInputField, 
                                                !isEditable && styles.marksInputDisabled
                                            ]}
                                            keyboardType="numeric"
                                            value={displayMark.toString()}
                                            onChangeText={(text) => handleMarkChange(student.student_id, subject, text)}
                                            editable={isEditable}
                                            placeholder={isEditable ? '...' : '-'}
                                        />
                                    </View>
                                );
                            })}
                            
                            <Text style={[styles.marksInputCell, { width: 60, fontWeight: 'bold', backgroundColor: '#FFD54F' }]}>
                                {calculateMark(student.student_id, '', true)}
                            </Text>
                        </View>
                    ))}
                    
                    {/* Total Row (Column Sums) */}
                     <View style={[styles.marksInputRow, styles.totalRow]}>
                        <Text style={[styles.marksInputCell, { width: 50, fontWeight: 'bold' }]}>SUM</Text>
                        <Text style={[styles.marksInputCell, { width: 150 }]}></Text>
                        
                        {config.subjects.map(subject => {
                             // Calculate overall total for this subject across all displayed students
                             const subjectColumnTotal = studentsToDisplay.reduce((sum, student) => {
                                 const markValue = isOverallView 
                                    ? calculateMark(student.student_id, subject, false) // Sum of overall marks
                                    : calculateMark(student.student_id, subject, false); // Sum of marks for the single exam
                                 return sum + markValue;
                             }, 0);

                            return (
                                <Text 
                                    key={subject} 
                                    style={[styles.marksInputCell, styles.totalCell, { width: SUBJECT_COLUMN_WIDTH }]}
                                >
                                    {subjectColumnTotal}
                                </Text>
                            );
                        })}
                        
                        {/* Grand Total Column */}
                        <Text style={[styles.marksInputCell, styles.totalCell, { width: 60, backgroundColor: PRIMARY_COLOR, color: 'white' }]}>
                             {studentsToDisplay.reduce((grandTotal, student) => {
                                 return grandTotal + calculateMark(student.student_id, '', true);
                             }, 0)}
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {!isOverallView && (
                <TouchableOpacity 
                    style={styles.saveButton} 
                    onPress={handleSave} 
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color='white' />
                    ) : (
                        <Text style={styles.saveButtonText}>SAVE MARKS</Text>
                    )}
                </TouchableOpacity>
            )}
            
            {isOverallView && (
                 <View style={styles.overallInfoContainer}>
                    <Text style={styles.overallInfoText}>
                        <Icon name="information-outline" size={16} color={PRIMARY_COLOR} /> This view displays the calculated sum of all entered marks (Read Only).
                    </Text>
                 </View>
            )}
        </View>
    );
};


// --- Main Report Card Router ---

const ReportCardScreen = () => {
    const { user } = useAuth();
    
    // Default selected class should be the user's class if student, or Class 10 if Admin/Teacher
    const defaultClass = user?.role === 'student' ? user.class_group : CLASS_GROUPS[CLASS_GROUPS.length - 1];
    
    const [selectedClass, setSelectedClass] = useState(defaultClass || CLASS_GROUPS[0]);
    const [examConfig, setExamConfig] = useState<ExamConfig | null>(null);
    const [loadingConfig, setLoadingConfig] = useState(true);
    
    const isStudent = user?.role === 'student';

    useEffect(() => {
        // Ensure student uses their assigned class
        if (isStudent && user?.class_group) {
            setSelectedClass(user.class_group);
        }
    }, [user, isStudent]);

    useEffect(() => {
        const fetchConfig = async () => {
            if (!selectedClass) return;
            setLoadingConfig(true);
            try {
                const response = await apiClient.get(`/reportcard/config/${selectedClass}`);
                setExamConfig(response.data);
            } catch (error: any) {
                Alert.alert('Error', error.response?.data?.message || 'Failed to load class configuration.');
                setExamConfig(null);
            } finally {
                setLoadingConfig(false);
            }
        };
        fetchConfig();
    }, [selectedClass]);


    if (!user) return <Text style={styles.noDataText}>Please log in.</Text>;

    if (isStudent) {
        // Student sees their own Progress Card (View Only)
        return <ProgressCardView studentId={user.id} />;
    }
    
    // Teacher/Admin interface
    if (loadingConfig) {
        return <ActivityIndicator size="large" color={PRIMARY_COLOR} style={{ marginTop: 50 }} />;
    }
    
    if (!examConfig) {
         return <Text style={styles.noDataText}>Configuration failed for selected class. Check backend constants.</Text>;
    }


    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Report Card Management</Text>
                </View>
                
                <View style={styles.pickerContainerWrapper}>
                    <View style={styles.pickerContainer}>
                        <Text style={styles.pickerLabel}>Select Class:</Text>
                        <View style={styles.pickerStyle}>
                            <Picker
                                selectedValue={selectedClass}
                                onValueChange={(itemValue) => setSelectedClass(itemValue)}
                                style={styles.picker}
                            >
                                {CLASS_GROUPS.map(c => (
                                    <Picker.Item key={c} label={c} value={c} />
                                ))}
                            </Picker>
                        </View>
                    </View>
                </View>
                
                {/* Exam Type Picker is now inside MarkInputGrid */}
                
                {examConfig && (
                    <MarkInputGrid 
                        classGroup={selectedClass} 
                        config={examConfig} 
                    />
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

// --- Updated Dynamic Styles ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F4F6F8' },
    header: { padding: 15, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, backgroundColor: 'white', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: TEXT_COLOR_DARK },
    
    // Picker/Controls Styles
    pickerContainerWrapper: { backgroundColor: 'white', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, marginHorizontal: 10, marginTop: 10, borderRadius: 10 },
    pickerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    pickerLabel: { fontSize: 15, color: TEXT_COLOR_MEDIUM, marginRight: 10, fontWeight: '600' },
    pickerStyle: { flex: 1, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 6, height: 40, justifyContent: 'center', backgroundColor: HEADER_COLOR },
    picker: { height: 40, width: '100%', color: TEXT_COLOR_DARK },
    
    // Teacher/Admin Grid Styles
    gridContainer: { flex: 1, padding: 15, backgroundColor: 'white', marginTop: 10, marginHorizontal: 10, borderRadius: 10, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, marginBottom: 20 },
    pickerWrapperHorizontal: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, marginTop: 10 },
    
    // Grid structure
    marksInputHeader: { flexDirection: 'row', backgroundColor: PRIMARY_COLOR, borderTopLeftRadius: 8, borderTopRightRadius: 8, minWidth: '100%' },
    marksInputRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: HEADER_COLOR, backgroundColor: 'white' },
    
    marksInputCell: { paddingVertical: 8, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: BORDER_COLOR, fontSize: 13, color: TEXT_COLOR_DARK, minHeight: 45 },
    headerCell: { fontWeight: 'bold', color: 'white', textAlign: 'center', fontSize: 12 },
    
    // Total Row Style
    totalRow: { backgroundColor: '#E0E0E0', borderTopWidth: 2, borderTopColor: ACCENT_COLOR },
    totalCell: { fontWeight: '900', color: TEXT_COLOR_DARK, fontSize: 14 },

    // Input Field
    marksInputField: { 
        width: '100%', 
        height: '100%', 
        paddingHorizontal: 3, 
        paddingVertical: 4, 
        textAlign: 'center', 
        backgroundColor: 'white', 
        fontSize: 14, 
        color: PRIMARY_COLOR,
        fontWeight: 'bold',
    },
    marksInputDisabled: { 
        backgroundColor: '#EEEEEE', 
        color: TEXT_COLOR_MEDIUM, 
        opacity: 1, 
        justifyContent: 'center',
        textAlign: 'center',
        fontWeight: 'normal',
    },

    saveButton: { backgroundColor: PRIMARY_COLOR, padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20, marginHorizontal: 5, elevation: 3 },
    saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    
    overallInfoContainer: { padding: 10, backgroundColor: '#E1F5FE', borderRadius: 8, marginTop: 15, borderWidth: 1, borderColor: PRIMARY_COLOR },
    overallInfoText: { fontSize: 13, color: TEXT_COLOR_MEDIUM, textAlign: 'center', fontWeight: '500' },
    
    teacherInfoBox: { paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: HEADER_COLOR, marginBottom: 5 },
    teacherInfoLabel: { fontSize: 12, color: TEXT_COLOR_MEDIUM },
    teacherInfoValue: { fontSize: 14, fontWeight: 'bold', color: PRIMARY_COLOR },
    
    noDataText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: TEXT_COLOR_MEDIUM },
    
    // --- Progress Card Styles (Student View) ---
    cardScrollView: { padding: 10 },
    cardContainer: { backgroundColor: 'white', borderRadius: 15, elevation: 10, shadowColor: PRIMARY_COLOR, shadowOpacity: 0.1, shadowRadius: 10, marginBottom: 20, overflow: 'hidden' },
    cardSection: { padding: 20, margin: 5, borderRadius: 10 },
    cardFront: { backgroundColor: '#F9F9FF' }, 
    cardBack: { backgroundColor: '#FFFFFF' },
    
    cardHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: ACCENT_COLOR, paddingBottom: 15, marginBottom: 15 },
    logo: { width: 50, height: 50, resizeMode: 'contain', marginRight: 15 },
    schoolName: { fontSize: 18, fontWeight: 'bold', color: PRIMARY_COLOR },
    reportTitle: { fontSize: 24, fontWeight: '900', color: TEXT_COLOR_DARK, marginVertical: 4 },
    reportSubtitle: { fontSize: 14, color: TEXT_COLOR_MEDIUM },
    profileImage: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: PRIMARY_COLOR, marginLeft: 10 },
    
    detailsBox: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 10, marginTop: 5 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    detailLabel: { fontSize: 14, color: TEXT_COLOR_MEDIUM, fontWeight: '500' },
    detailValue: { fontSize: 14, color: TEXT_COLOR_DARK, fontWeight: '700' },
    
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: PRIMARY_COLOR, marginTop: 10, borderLeftWidth: 4, borderColor: ACCENT_COLOR, paddingLeft: 10, marginBottom: 5 },

    // Attendance Table Styles
    attendanceTable: { marginTop: 10, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 8, overflow: 'hidden' },
    attendanceRowHeader: { flexDirection: 'row', backgroundColor: PRIMARY_COLOR, },
    attendanceCellHeader: { flex: 1, padding: 10, textAlign: 'center', color: 'white', fontWeight: 'bold', fontSize: 12, borderRightWidth: 1, borderRightColor: '#532C9E' },
    attendanceRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, backgroundColor: '#FFF' },
    attendanceCell: { flex: 1, padding: 10, textAlign: 'center', fontSize: 13, color: TEXT_COLOR_DARK, borderRightWidth: 1, borderRightColor: BORDER_COLOR },
    attendanceFooter: { backgroundColor: '#E8EAF6', borderTopWidth: 2, borderTopColor: PRIMARY_COLOR },

    // Marks Table Styles (Student View)
    marksTableHeader: { flexDirection: 'row', backgroundColor: '#9575CD', height: 60 },
    marksCellHeader: { width: 50, padding: 5, textAlign: 'center', color: 'white', fontWeight: 'bold', fontSize: 10, borderRightWidth: 1, borderRightColor: '#532C9E', justifyContent: 'center', alignItems: 'center' },
    marksTableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, backgroundColor: '#FFF' },
    marksCell: { width: 50, padding: 8, textAlign: 'center', fontSize: 12, color: TEXT_COLOR_DARK, borderRightWidth: 1, borderRightColor: BORDER_COLOR },

    signatureContainer: { marginTop: 30, padding: 10, backgroundColor: HEADER_COLOR, borderRadius: 8 },
    signatureText: { fontSize: 14, color: TEXT_COLOR_MEDIUM, marginBottom: 10, fontWeight: '500' },
});

export default ReportCardScreen;