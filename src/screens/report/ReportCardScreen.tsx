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
const PRIMARY_COLOR = '#8E24AA'; // Purple accent color for a 'classic' look
const BORDER_COLOR = '#E0E0E0';
const HEADER_COLOR = '#F5F5F5';
const TEXT_COLOR_DARK = '#37474F';
const TEXT_COLOR_MEDIUM = '#566573';
const CLASS_GROUPS = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
const { width } = Dimensions.get('window');

// --- Type Definitions ---
interface StudentMark {
    student_id: number;
    full_name: string;
    roll_no: string;
    marks: { [subject: string]: number | undefined };
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

    const { studentDetails, marks, attendance } = data;

    // Helper to format marks for display (back side)
    const getMarkDisplay = (subject, examType) => {
        return marks[subject] && marks[subject][examType] !== undefined
            ? marks[subject][examType]
            : '-';
    };

    // Helper to extract month names for attendance table (Jan, Feb, Mar...)
    const getMonthName = (monthYear) => {
        if (!monthYear) return '';
        const date = new Date(monthYear + '-01');
        return date.toLocaleString('en-US', { month: 'short' });
    };

    return (
        <ScrollView contentContainerStyle={styles.cardScrollView}>
            <View style={styles.cardContainer}>
                
                {/* --- FRONT SIDE --- */}
                <View style={[styles.cardSection, styles.cardFront]}>
                    <View style={styles.cardHeader}>
                        <Image
                            source={{ uri: 'https://cdn-icons-png.flaticon.com/128/992/992683.png' }} 
                            style={styles.logo}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.schoolName}>Vivekananda Public School</Text>
                            <Text style={styles.reportTitle}>PROGRESS CARD (2023-2024)</Text>
                            <Text style={styles.reportSubtitle}>Medium: English</Text>
                        </View>
                        <Image 
                            source={{ uri: studentDetails.profile_image_url || 'https://cdn-icons-png.flaticon.com/128/3135/3135715.png' }}
                            style={styles.profileImage}
                        />
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Student Name:</Text>
                        <Text style={styles.detailValue}>{studentDetails.full_name}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Class/Group:</Text>
                        <Text style={styles.detailValue}>{studentDetails.class_group}</Text>
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

                    <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Attendance Particulars</Text>
                    <View style={styles.attendanceTable}>
                        <View style={styles.attendanceRowHeader}>
                            <Text style={[styles.attendanceCellHeader, { width: 50 }]}>Month</Text>
                            <Text style={styles.attendanceCellHeader}>Working Days</Text>
                            <Text style={styles.attendanceCellHeader}>Days Present</Text>
                        </View>
                        {attendance.map((att, index) => (
                            <View key={index} style={styles.attendanceRow}>
                                <Text style={[styles.attendanceCell, { width: 50, fontWeight: 'bold' }]}>{getMonthName(att.month)}</Text>
                                <Text style={styles.attendanceCell}>{att.total_days_in_month}</Text>
                                <Text style={styles.attendanceCell}>{att.days_present}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* --- BACK SIDE --- */}
                <View style={[styles.cardSection, styles.cardBack]}>
                    <Text style={[styles.sectionTitle, { marginBottom: 15 }]}>Academic Assessment</Text>
                    
                    {/* Marks Table */}
                    <ScrollView horizontal>
                        <View>
                            <View style={styles.marksTableHeader}>
                                <Text style={[styles.marksCellHeader, { width: 80 }]}>Subjects</Text>
                                {EXAM_TYPES.map(exam => (
                                    <Text key={exam} style={styles.marksCellHeader}>{exam.replace('Assignment', 'Asg').replace('Unit Test', 'UT')}</Text>
                                ))}
                                <Text style={[styles.marksCellHeader, { width: 60, backgroundColor: PRIMARY_COLOR, color: 'white' }]}>Total</Text>
                            </View>
                            
                            {Object.keys(marks).map(subject => (
                                <View key={subject} style={styles.marksTableRow}>
                                    <Text style={[styles.marksCell, { width: 80, fontWeight: 'bold' }]}>{subject}</Text>
                                    {EXAM_TYPES.map(exam => (
                                        <Text key={exam} style={styles.marksCell}>
                                            {getMarkDisplay(subject, exam)}
                                        </Text>
                                    ))}
                                    <Text style={[styles.marksCell, { width: 60, fontWeight: 'bold', backgroundColor: '#F0F0F0' }]}>
                                        {data.overallTotals[subject] || 0}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    <View style={{ marginTop: 30 }}>
                        <Text style={styles.detailLabel}>Parent Signature: ____________</Text>
                        <Text style={styles.detailLabel}>Class Teacher Signature: ____________</Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
};


// --- Mark Input Grid Component (Admin/Teacher) ---

const MarkInputGrid = ({ classGroup, config, initialMarks, teacherId }) => {
    const { user } = useAuth();
    const [marksData, setMarksData] = useState<StudentMark[]>([]);
    const [selectedExam, setSelectedExam] = useState(config.examTypes[0]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Admin check: Admin can edit any column. Teacher can only edit subjects they teach.
    const teacherSubjects = useMemo(() => {
        if (user?.role === 'admin') return config.subjects; 
        try {
            return JSON.parse(user?.subjects_taught || '[]');
        } catch {
            return [];
        }
    }, [user, config.subjects]);
    
    // Fetch marks when class or exam changes
    const fetchMarks = useCallback(async () => {
        if (!classGroup || !selectedExam) return;
        setLoading(true);
        try {
            const response = await apiClient.get(`/reportcard/marks/${classGroup}/${selectedExam}`);
            setMarksData(response.data);
        } catch (error) {
            Alert.alert('Error', 'Failed to load marks data.');
            setMarksData([]);
        } finally {
            setLoading(false);
        }
    }, [classGroup, selectedExam]);

    useEffect(() => {
        fetchMarks();
    }, [fetchMarks]);
    
    const handleMarkChange = (student_id: number, subject: string, value: string) => {
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
    
    const calculateTotal = (studentMarks: { [subject: string]: number | undefined }) => {
        return config.subjects.reduce((sum, subject) => {
            const mark = studentMarks[subject];
            return sum + (typeof mark === 'number' && !isNaN(mark) ? mark : 0);
        }, 0);
    };

    const handleSave = async () => {
        if (isSaving) return;
        
        const marksToSave = marksData.map(student => ({
            student_id: student.student_id,
            marks: student.marks,
        }));

        setIsSaving(true);
        try {
            await apiClient.post('/reportcard/marks', {
                classGroup,
                examType: selectedExam,
                marksData: marksToSave,
                teacherId: user.id
            });
            Alert.alert('Success', `${selectedExam} marks saved successfully.`);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to save marks.');
        } finally {
            setIsSaving(false);
            fetchMarks(); // Reload data to ensure consistency
        }
    };

    if (!user || loading) {
        return <ActivityIndicator size="large" color={PRIMARY_COLOR} style={{ marginTop: 50 }} />;
    }
    
    if (marksData.length === 0) {
        return <Text style={styles.noDataText}>No students found in this class to enter marks.</Text>;
    }

    return (
        <View style={styles.gridContainer}>
            <View style={styles.pickerWrapperHorizontal}>
                <Text style={styles.pickerLabel}>Exam Type:</Text>
                <View style={styles.pickerStyle}>
                    <Picker
                        selectedValue={selectedExam}
                        onValueChange={(itemValue) => setSelectedExam(itemValue)}
                        style={styles.picker}
                    >
                        {config.examTypes.map(type => (
                            <Picker.Item key={type} label={type} value={type} />
                        ))}
                    </Picker>
                </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.marksScrollContainer}>
                <View>
                    {/* Header Row */}
                    <View style={styles.marksInputHeader}>
                        <Text style={[styles.marksInputCell, styles.headerCell, { width: 50 }]}>Roll No</Text>
                        <Text style={[styles.marksInputCell, styles.headerCell, { width: 150 }]}>Name</Text>
                        
                        {config.subjects.map(subject => (
                            <Text key={subject} style={[styles.marksInputCell, styles.headerCell, { width: 80 }]}>
                                {subject}
                            </Text>
                        ))}
                        
                        <Text style={[styles.marksInputCell, styles.headerCell, { width: 60, backgroundColor: PRIMARY_COLOR, color: 'white' }]}>Total</Text>
                    </View>

                    {/* Data Rows */}
                    {marksData.map(student => (
                        <View key={student.student_id} style={styles.marksInputRow}>
                            <Text style={[styles.marksInputCell, { width: 50, fontWeight: 'bold' }]}>{student.roll_no}</Text>
                            <Text style={[styles.marksInputCell, { width: 150 }]}>{student.full_name}</Text>
                            
                            {config.subjects.map(subject => {
                                const isEditable = user?.role === 'admin' || teacherSubjects.includes(subject);
                                return (
                                    <View key={subject} style={[styles.marksInputCell, { width: 80, padding: 0 }]}>
                                        <TextInput
                                            style={[styles.marksInputField, !isEditable && styles.marksInputDisabled]}
                                            keyboardType="numeric"
                                            value={student.marks[subject]?.toString() ?? ''}
                                            onChangeText={(text) => handleMarkChange(student.student_id, subject, text)}
                                            editable={isEditable}
                                            placeholder="-"
                                        />
                                    </View>
                                );
                            })}
                            
                            <Text style={[styles.marksInputCell, { width: 60, fontWeight: 'bold', backgroundColor: HEADER_COLOR }]}>
                                {calculateTotal(student.marks)}
                            </Text>
                        </View>
                    ))}
                </View>
            </ScrollView>

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
        </View>
    );
};


// --- Main Report Card Router ---

const ReportCardScreen = () => {
    const { user } = useAuth();
    
    // State to manage Admin/Teacher selection (class or view mode)
    const [selectedClass, setSelectedClass] = useState(CLASS_GROUPS[0]);
    const [examConfig, setExamConfig] = useState<ExamConfig | null>(null);
    const [loadingConfig, setLoadingConfig] = useState(true);
    
    // Student specific state
    const isStudent = user?.role === 'student';
    const isInputView = user?.role !== 'student';

    useEffect(() => {
        if (isStudent && user?.class_group) {
            setSelectedClass(user.class_group);
        }
    }, [user, isStudent]);

    // Fetch Subject/Exam configuration based on selected class
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
        return <ProgressCardView studentId={user.id} />;
    }
    
    // --- Teacher/Admin Flow ---

    if (loadingConfig) {
        return <ActivityIndicator size="large" color={PRIMARY_COLOR} style={{ marginTop: 50 }} />;
    }
    
    if (!examConfig) {
         return <Text style={styles.noDataText}>Configuration failed for selected class.</Text>;
    }


    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Report Card Management</Text>
            </View>
            
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
            
            {examConfig && (
                <MarkInputGrid 
                    classGroup={selectedClass} 
                    config={examConfig} 
                    teacherId={user.id}
                />
            )}
        </SafeAreaView>
    );
};

// --- Styles for Input Grid (Admin/Teacher) ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F4F6F8' },
    header: { padding: 15, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, backgroundColor: 'white', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: TEXT_COLOR_DARK },
    pickerContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, },
    pickerLabel: { fontSize: 16, color: TEXT_COLOR_MEDIUM, marginRight: 10, fontWeight: '600' },
    pickerStyle: { flex: 1, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 8, height: 45, justifyContent: 'center', backgroundColor: HEADER_COLOR },
    picker: { height: 45, width: '100%' },

    gridContainer: { flex: 1, padding: 10, backgroundColor: 'white', marginTop: 10, marginHorizontal: 10, borderRadius: 10, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
    pickerWrapperHorizontal: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    
    marksScrollContainer: { borderTopWidth: 1, borderTopColor: BORDER_COLOR, marginTop: 10 },
    
    marksInputHeader: { flexDirection: 'row', backgroundColor: PRIMARY_COLOR, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
    marksInputRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: HEADER_COLOR, backgroundColor: 'white' },
    
    marksInputCell: { paddingVertical: 10, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: BORDER_COLOR, fontSize: 13, color: TEXT_COLOR_DARK },
    headerCell: { fontWeight: 'bold', color: 'white', textAlign: 'center' },
    
    marksInputField: { flex: 1, paddingHorizontal: 5, paddingVertical: 8, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 4, textAlign: 'center', backgroundColor: '#FFF', fontSize: 14, color: TEXT_COLOR_DARK },
    marksInputDisabled: { backgroundColor: '#F0F0F0', color: TEXT_COLOR_MEDIUM },

    saveButton: { backgroundColor: PRIMARY_COLOR, padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20, marginHorizontal: 5 },
    saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    noDataText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: TEXT_COLOR_MEDIUM },
    
    // --- Progress Card Styles (Student View) ---
    cardScrollView: { padding: 15 },
    cardContainer: { backgroundColor: 'white', borderRadius: 15, elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, marginBottom: 20 },
    cardSection: { padding: 20, borderWidth: 1, borderColor: '#DDD', margin: 5, borderRadius: 10 },
    cardFront: { backgroundColor: '#F8F8FF' }, // Light blue/lavender tint
    cardBack: { backgroundColor: '#FFFFFF' },
    
    cardHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: PRIMARY_COLOR, paddingBottom: 15, marginBottom: 15 },
    logo: { width: 40, height: 40, resizeMode: 'contain', marginRight: 15 },
    schoolName: { fontSize: 16, fontWeight: 'bold', color: PRIMARY_COLOR },
    reportTitle: { fontSize: 22, fontWeight: '900', color: TEXT_COLOR_DARK, marginVertical: 4 },
    reportSubtitle: { fontSize: 14, color: TEXT_COLOR_MEDIUM },
    profileImage: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: PRIMARY_COLOR, marginLeft: 10 },
    
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    detailLabel: { fontSize: 14, color: TEXT_COLOR_MEDIUM, fontWeight: '500' },
    detailValue: { fontSize: 14, color: TEXT_COLOR_DARK, fontWeight: '600' },
    
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: PRIMARY_COLOR, marginTop: 10, borderBottomWidth: 1, borderBottomColor: '#CCC', paddingBottom: 5 },

    // Attendance Table Styles
    attendanceTable: { marginTop: 10, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 8, overflow: 'hidden' },
    attendanceRowHeader: { flexDirection: 'row', backgroundColor: PRIMARY_COLOR, },
    attendanceCellHeader: { flex: 1, padding: 10, textAlign: 'center', color: 'white', fontWeight: 'bold', fontSize: 13, borderRightWidth: 1, borderRightColor: '#7E1C8C' },
    attendanceRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, backgroundColor: '#FFF' },
    attendanceCell: { flex: 1, padding: 10, textAlign: 'center', fontSize: 13, color: TEXT_COLOR_DARK, borderRightWidth: 1, borderRightColor: BORDER_COLOR },

    // Marks Table Styles
    marksTableHeader: { flexDirection: 'row', backgroundColor: PRIMARY_COLOR, },
    marksCellHeader: { width: 50, padding: 8, textAlign: 'center', color: 'white', fontWeight: 'bold', fontSize: 11, borderRightWidth: 1, borderRightColor: '#7E1C8C' },
    marksTableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, backgroundColor: '#FFF' },
    marksCell: { width: 50, padding: 8, textAlign: 'center', fontSize: 12, color: TEXT_COLOR_DARK, borderRightWidth: 1, borderRightColor: BORDER_COLOR },

});

export default ReportCardScreen;