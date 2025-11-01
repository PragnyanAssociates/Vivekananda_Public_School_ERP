/**
 * File: src/screens/report/MarksEntryScreen.js
 * Purpose: Teachers/Admins enter marks with role-based editing permissions.
 * Version: 2.4 (With Subject-Level Teacher Permissions)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TextInput,
    TouchableOpacity, Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';


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


const MarksEntryScreen = ({ route, navigation }) => {
    const { classGroup } = route.params;
    const subjects = CLASS_SUBJECTS[classGroup] || [];

    const { user } = useAuth();
    const userRole = user?.role || 'teacher';
    const userId = user?.id; // Get the logged-in user's ID

    const [students, setStudents] = useState([]);
    const [marksData, setMarksData] = useState({});
    const [attendanceData, setAttendanceData] = useState({});
    
    // ★★★ NEW ★★★: State to store teacher assignments for permission checks
    const [teacherAssignments, setTeacherAssignments] = useState([]);

    const [selectedExam, setSelectedExam] = useState('Overall');
    const [viewMode, setViewMode] = useState('marks');
    const [sortOrder, setSortOrder] = useState('rollno');
    
    const [isEditing, setIsEditing] = useState(true);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchClassData();
    }, [classGroup]);
    
    useEffect(() => {
        setIsEditing(true);
    }, [selectedExam, viewMode]);

    const fetchClassData = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/reports/class-data/${classGroup}`);
            // ★★★ MODIFIED ★★★: Destructure 'assignments' from the API response
            const { students, marks, attendance, assignments } = response.data;

            setStudents(students);
            // ★★★ NEW ★★★: Store the fetched assignments in state
            setTeacherAssignments(assignments || []);

            // --- The rest of the data processing remains the same ---
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
        } catch (error) {
            console.error('Error fetching class data:', error);
            Alert.alert('Error', 'Failed to load class data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchClassData();
    }, [classGroup]);

    const updateMarks = (studentId, subject, examType, value) => {
        setMarksData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [subject]: {
                    ...prev[studentId][subject],
                    [examType]: value
                }
            }
        }));
    };

    const updateAttendance = (studentId, month, field, value) => {
        setAttendanceData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [month]: {
                    ...prev[studentId][month],
                    [field]: value
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

    const saveMarks = async () => {
        setSaving(true);
        const marksPayload = [];
        students.forEach(student => {
            subjects.forEach(subject => {
                EDITABLE_EXAM_TYPES.forEach(examDisplayType => {
                    const examKey = EXAM_KEY_MAPPING[examDisplayType];
                    const marksValue = marksData[student.id]?.[subject]?.[examDisplayType] || '';
                    if (examKey) {
                        marksPayload.push({ student_id: student.id, class_group: classGroup, subject: subject, exam_type: examKey, marks_obtained: marksValue === '' ? null : marksValue });
                    }
                });
                const overallValue = calculateOverallForSubject(student.id, subject);
                marksPayload.push({ student_id: student.id, class_group: classGroup, subject: subject, exam_type: 'Total', marks_obtained: overallValue === '' ? null : overallValue });
            });
        });
        try {
            await apiClient.post('/reports/marks/bulk', { marksPayload });
            Alert.alert('Success', 'Marks saved successfully! Progress reports updated.');
            setIsEditing(false); 
            fetchClassData();
        } catch (error) {
            console.error('Error saving marks:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to save marks');
        } finally {
            setSaving(false);
        }
    };

    const saveAttendance = async () => {
        setSaving(true);
        // Logic remains the same
        const attendancePayload = [];
        students.forEach(student => {
            MONTHS.forEach(month => {
                const att = attendanceData[student.id]?.[month] || {};
                attendancePayload.push({ student_id: student.id, month, working_days: att.working_days === '' ? null : att.working_days, present_days: att.present_days === '' ? null : att.present_days });
            });
        });
        try {
            await apiClient.post('/reports/attendance/bulk', { attendancePayload });
            Alert.alert('Success', 'Attendance saved successfully!');
        } catch (error) {
            console.error('Error saving attendance:', error);
            Alert.alert('Error', 'Failed to save attendance');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#2c3e50" /></View>;
    }

    const sortedStudents = getSortedStudents();
    const isOverallView = selectedExam === 'Overall';
    
    // This is the base condition for editing (not overall view and in edit mode)
    const canEditScreen = !isOverallView && isEditing;

    return (
        <View style={styles.container}>
            {userRole === 'admin' && (
                <View style={styles.adminControlsContainer}>
                    <TouchableOpacity style={styles.assignButton} onPress={() => navigation.navigate('TeacherAssignment', { classGroup })}>
                        <Text style={styles.assignButtonText}>Assign Teachers</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.modeToggle}>
                <TouchableOpacity style={[styles.modeButton, viewMode === 'marks' && styles.modeButtonActive]} onPress={() => setViewMode('marks')}>
                    <Text style={[styles.modeButtonText, viewMode === 'marks' && styles.modeButtonTextActive]}>Marks Entry</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modeButton, viewMode === 'attendance' && styles.modeButtonActive]} onPress={() => setViewMode('attendance')}>
                    <Text style={[styles.modeButtonText, viewMode === 'attendance' && styles.modeButtonTextActive]}>Attendance</Text>
                </TouchableOpacity>
            </View>

            {viewMode === 'marks' && (
                <>
                    <View style={styles.controlsRow}>
                        <View style={styles.pickerSection}>
                            <Text style={styles.label}>View:</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={selectedExam} onValueChange={setSelectedExam}>
                                    {ALL_EXAM_OPTIONS.map(exam => <Picker.Item key={exam} label={exam} value={exam} />)}
                                </Picker>
                            </View>
                        </View>
                        <View style={styles.sortPickerContainer}>
                            <Picker selectedValue={sortOrder} onValueChange={(itemValue) => setSortOrder(itemValue)} style={styles.sortPicker} dropdownIconColor="#fff">
                                <Picker.Item label="Roll No" value="rollno" />
                                <Picker.Item label="Rank (High-Low)" value="descending" />
                                <Picker.Item label="Rank (Low-High)" value="ascending" />
                            </Picker>
                        </View>
                    </View>

                    <ScrollView>
                        <ScrollView horizontal>
                            <View>
                                <View style={styles.tableRow}>
                                    <View style={[styles.cellHeader, styles.cellRollNo]}><Text style={styles.headerText}>Roll No</Text></View>
                                    <View style={[styles.cellHeader, styles.cellName]}><Text style={styles.headerText}>Name</Text></View>
                                    {subjects.map(subject => (
                                        <View key={subject} style={[styles.cellHeader, styles.cellSubject]}><Text style={styles.headerText}>{subject}</Text></View>
                                    ))}
                                    <View style={[styles.cellHeader, styles.cellTotal]}><Text style={styles.headerText}>{selectedExam} Total</Text></View>
                                    <View style={[styles.cellHeader, styles.cellTotal, styles.grandTotalHeader]}><Text style={styles.headerText}>Grand Total</Text></View>
                                </View>

                                {sortedStudents.map(student => {
                                    const studentGrandTotal = calculateStudentGrandTotal(student.id);
                                    return (
                                        <View key={student.id} style={styles.tableRow}>
                                            <View style={[styles.cell, styles.cellRollNo]}><Text style={styles.cellText}>{student.roll_no}</Text></View>
                                            <View style={[styles.cell, styles.cellName]}><Text style={styles.cellText}>{student.full_name}</Text></View>
                                            
                                            {subjects.map(subject => {
                                                // ★★★ MODIFIED ★★★: This is the core permission logic
                                                const canUserEditSubject = () => {
                                                    if (userRole === 'admin') {
                                                        return true; // Admins can always edit.
                                                    }
                                                    // Find if a teacher is assigned to this specific subject.
                                                    const assignment = teacherAssignments.find(a => a.subject === subject);
                                                    if (assignment) {
                                                        // If assigned, only the assigned teacher (matching userId) can edit.
                                                        return assignment.teacher_id === userId;
                                                    }
                                                    // If no one is assigned, no teacher can edit.
                                                    return false;
                                                };

                                                const isEditable = canEditScreen && canUserEditSubject();
                                                const displayValue = isOverallView 
                                                    ? (calculateOverallForSubject(student.id, subject) || '').toString()
                                                    : (marksData[student.id]?.[subject]?.[selectedExam] || '');

                                                return (
                                                    <View key={subject} style={[styles.cell, styles.cellSubject]}>
                                                        <TextInput
                                                            style={[styles.input, !isEditable && styles.inputDisabled, isOverallView && styles.inputOverallView]}
                                                            keyboardType="numeric"
                                                            maxLength={isOverallView ? 4 : 3}
                                                            value={displayValue}
                                                            onChangeText={(val) => updateMarks(student.id, subject, selectedExam, val)}
                                                            editable={isEditable}
                                                            placeholder="-"
                                                        />
                                                    </View>
                                                );
                                            })}

                                            <View style={[styles.cell, styles.cellTotal]}>
                                                <Text style={[styles.cellText, styles.overallText]}>
                                                    {subjects.reduce((sum, subject) => {
                                                        const marks = isOverallView ? parseFloat(calculateOverallForSubject(student.id, subject)) || 0 : parseFloat(marksData[student.id]?.[subject]?.[selectedExam]) || 0;
                                                        return sum + marks;
                                                    }, 0) || '-'}
                                                </Text>
                                            </View>
                                            <View style={[styles.cell, styles.cellTotal, styles.grandTotalCell]}>
                                                <Text style={[styles.cellText, styles.totalText]}>{studentGrandTotal || '-'}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                                {/* Footer row remains the same */}
                                <View style={[styles.tableRow, styles.footerRow]}>
                                    <View style={[styles.cellHeader, styles.cellRollNo]}><Text style={styles.headerText}>-</Text></View>
                                    <View style={[styles.cellHeader, styles.cellName]}><Text style={styles.headerText}>Total</Text></View>
                                    {subjects.map(subject => {
                                        const columnTotal = sortedStudents.reduce((sum, student) => {
                                            const marks = isOverallView ? parseFloat(calculateOverallForSubject(student.id, subject)) || 0 : parseFloat(marksData[student.id]?.[subject]?.[selectedExam]) || 0;
                                            return sum + marks;
                                        }, 0);
                                        return <View key={subject} style={[styles.cellHeader, styles.cellSubject]}><Text style={styles.headerText}>{columnTotal || '-'}</Text></View>;
                                    })}
                                    <View style={[styles.cellHeader, styles.cellTotal]}>
                                        <Text style={styles.headerText}>
                                            {sortedStudents.reduce((totalSum, student) => {
                                                const studentExamTotal = subjects.reduce((sum, subject) => {
                                                     const marks = isOverallView ? parseFloat(calculateOverallForSubject(student.id, subject)) || 0 : parseFloat(marksData[student.id]?.[subject]?.[selectedExam]) || 0;
                                                    return sum + marks;
                                                }, 0);
                                                return totalSum + studentExamTotal;
                                            }, 0) || '-'}
                                        </Text>
                                    </View>
                                    <View style={[styles.cellHeader, styles.cellTotal, styles.grandTotalHeader]}>
                                         <Text style={styles.headerText}>{sortedStudents.reduce((sum, student) => sum + (calculateStudentGrandTotal(student.id) || 0), 0) || '-'}</Text>
                                    </View>
                                </View>
                            </View>
                        </ScrollView>
                    </ScrollView>
                </>
            )}

            {viewMode === 'attendance' && (
                // Attendance section remains the same
                <ScrollView>
                    <ScrollView horizontal refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                        <View>
                            <View style={styles.tableRow}>
                                <View style={[styles.cellHeader, styles.cellRollNo]}><Text style={styles.headerText}>Roll No</Text></View>
                                <View style={[styles.cellHeader, styles.cellName]}><Text style={styles.headerText}>Name</Text></View>
                                {MONTHS.map(month => (
                                    <View key={month} style={[styles.cellHeader, styles.cellAttendance]}>
                                        <Text style={styles.headerText}>{month}</Text>
                                        <Text style={styles.subHeaderText}>(W / P)</Text>
                                    </View>
                                ))}
                            </View>
                            {students.map(student => (
                                <View key={student.id} style={styles.tableRow}>
                                    <View style={[styles.cell, styles.cellRollNo]}><Text style={styles.cellText}>{student.roll_no}</Text></View>
                                    <View style={[styles.cell, styles.cellName]}><Text style={styles.cellText}>{student.full_name}</Text></View>
                                    {MONTHS.map(month => {
                                        const att = attendanceData[student.id]?.[month] || {};
                                        return (
                                            <View key={month} style={[styles.cell, styles.cellAttendance]}>
                                                <View style={styles.attendanceInputContainer}>
                                                    <TextInput style={[styles.input, styles.attendanceInput]} keyboardType="numeric" maxLength={2} placeholder="W" value={att.working_days} onChangeText={(val) => updateAttendance(student.id, month, 'working_days', val)} />
                                                    <Text style={styles.attendanceSeparator}>/</Text>
                                                    <TextInput style={[styles.input, styles.attendanceInput]} keyboardType="numeric" maxLength={2} placeholder="P" value={att.present_days} onChangeText={(val) => updateAttendance(student.id, month, 'present_days', val)} />
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                </ScrollView>
            )}

            {/* Bottom button logic remains the same */}
            {viewMode === 'attendance' ? (
                <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                </TouchableOpacity>
            ) : viewMode === 'marks' && !isOverallView ? (
                isEditing ? (
                    <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Marks</Text>}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
                        <Text style={styles.editButtonText}>Edit Marks</Text>
                    </TouchableOpacity>
                )
            ) : null}
        </View>
    );
};

// Styles remain the same
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f2f5' },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    adminControlsContainer: {
        backgroundColor: '#fff',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        alignItems: 'flex-end',
    },
    assignButton: {
        backgroundColor: '#00796b',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 8,
        elevation: 2,
    },
    assignButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    modeToggle: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ddd' },
    modeButton: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#ecf0f1', marginHorizontal: 5, borderRadius: 8 },
    modeButtonActive: { backgroundColor: '#2c3e50' },
    modeButtonText: { fontSize: 16, fontWeight: '600', color: '#7f8c8d' },
    modeButtonTextActive: { color: '#fff' },
    controlsRow: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ddd', justifyContent: 'space-between' },
    pickerSection: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
    label: { fontSize: 16, fontWeight: '600', marginRight: 10, color: '#2c3e50' },
    pickerContainer: { flex: 1, borderWidth: 1, borderColor: '#bdc3c7', borderRadius: 8, backgroundColor: '#fff' },
    sortPickerContainer: {
        backgroundColor: '#3498db',
        borderRadius: 8,
        height: 50,
        justifyContent: 'center',
        minWidth: 160,
    },
    sortPicker: {
        color: '#fff',
    },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ddd' },
    footerRow: { borderTopWidth: 2, borderTopColor: '#34495e' },
    cellHeader: { backgroundColor: '#34495e', padding: 12, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#2c3e50' },
    cell: { backgroundColor: '#fff', padding: 10, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#ecf0f1' },
    cellRollNo: { width: 80 },
    cellName: { width: 150 },
    cellSubject: { width: 100 },
    cellTotal: { width: 110, backgroundColor: '#d4edda' },
    grandTotalHeader: { backgroundColor: '#27ae60' },
    grandTotalCell: { backgroundColor: '#c8e6c9' },
    cellAttendance: { width: 120 },
    headerText: { fontSize: 14, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
    subHeaderText: { fontSize: 11, color: '#ecf0f1', marginTop: 2 },
    cellText: { fontSize: 14, color: '#2c3e50', textAlign: 'center' },
    overallText: { fontWeight: '600', color: '#155724', fontSize: 15 },
    totalText: { fontWeight: 'bold', color: '#155724', fontSize: 16 },
    input: { borderWidth: 1, borderColor: '#bdc3c7', borderRadius: 6, padding: 8, textAlign: 'center', fontSize: 14, backgroundColor: '#fff', width: '100%' },
    inputDisabled: { backgroundColor: '#ecf0f1', color: '#95a5a6' },
    inputOverallView: { backgroundColor: '#e9ecef', color: '#495057', fontWeight: 'bold', borderColor: '#ced4da' },
    attendanceInputContainer: { flexDirection: 'row', alignItems: 'center', width: '100%' },
    attendanceInput: { flex: 1, minWidth: 40 },
    attendanceSeparator: { marginHorizontal: 4, fontSize: 14, fontWeight: 'bold', color: '#7f8c8d' },
    saveButton: { backgroundColor: '#27ae60', padding: 16, margin: 15, borderRadius: 10, alignItems: 'center', elevation: 3 },
    saveButtonDisabled: { backgroundColor: '#95a5a6' },
    saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    editButton: { backgroundColor: '#3498db', padding: 16, margin: 15, borderRadius: 10, alignItems: 'center', elevation: 3 },
    editButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});

export default MarksEntryScreen;