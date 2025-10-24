/**
 * File: src/screens/report/MarksEntryScreen.js
 * Purpose: The main data entry form for teachers/admins. Allows selecting a student
 * from a class and inputting their marks and attendance for the dynamic academic year.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import apiClient from '../../api/client'; // Adjust path if needed
import { Picker } from '@react-native-picker/picker';

// Central configuration for subjects, exams, and attendance months.
const config = {
    subjects: {
        'LKG': ['All Subjects'], 'UKG': ['All Subjects'],
        '1st Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], '2nd Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
        '3rd Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], '4th Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
        '5th Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
        '6th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], '7th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
        '8th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], '9th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
        '10th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    },
    exams: ['FA-1', 'FA-2', 'FA-3', 'FA-4', 'UT-1', 'UT-2', 'UT-3', 'UT-4', 'SA-1', 'SA-2'],
    attendanceMonths: ['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May']
};

const MarksEntryScreen = ({ route }) => {
    const { classGroup } = route.params;
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [marks, setMarks] = useState({});
    const [attendance, setAttendance] = useState({});
    const [academicYear, setAcademicYear] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const subjectsForClass = config.subjects[classGroup] || [];

    useEffect(() => {
        const fetchStudents = async () => {
            setLoading(true);
            try {
                const res = await apiClient.get(`/reports/students/${classGroup}`);
                setStudents(res.data);
                if (res.data.length > 0) {
                    setSelectedStudent(res.data[0].id);
                }
            } catch (error) {
                console.error('Failed to fetch students:', error);
                Alert.alert('Error', 'Could not load students for this class.');
            } finally {
                setLoading(false);
            }
        };
        fetchStudents();
    }, [classGroup]);

    useEffect(() => {
        if (!selectedStudent) {
            setAcademicYear(''); // Clear year if no student is selected
            return;
        };
        
        const fetchStudentData = async () => {
            setLoading(true);
            try {
                const res = await apiClient.get(`/reports/student-data/${selectedStudent}`);
                setAcademicYear(res.data.academicYear);

                const marksData = {};
                res.data.marks.forEach(m => {
                    if (!marksData[m.subject]) marksData[m.subject] = {};
                    marksData[m.subject][m.exam_type] = m.marks_obtained?.toString() || '';
                });
                setMarks(marksData);

                const attendanceData = {};
                res.data.attendance.forEach(a => {
                    attendanceData[a.month] = { working_days: a.working_days?.toString() || '', present_days: a.present_days?.toString() || '' };
                });
                setAttendance(attendanceData);

            } catch (error) {
                console.error('Failed to fetch student data:', error);
                Alert.alert('Error', 'Could not load data for the selected student.');
            } finally {
                setLoading(false);
            }
        };
        fetchStudentData();
    }, [selectedStudent]);

    const handleMarkChange = useCallback((subject, exam, value) => {
        setMarks(prev => ({
            ...prev,
            [subject]: { ...(prev[subject] || {}), [exam]: value }
        }));
    }, []);

    const handleAttendanceChange = useCallback((month, field, value) => {
        setAttendance(prev => ({
            ...prev,
            [month]: { ...(prev[month] || {}), [field]: value }
        }));
    }, []);
    
    const onSave = async () => {
        setSaving(true);
        try {
            const marksPayload = [];
            Object.keys(marks).forEach(subject => {
                Object.keys(marks[subject]).forEach(exam_type => {
                    marksPayload.push({ subject, exam_type, marks_obtained: marks[subject][exam_type] });
                });
            });

            const attendancePayload = [];
            Object.keys(attendance).forEach(month => {
                attendancePayload.push({ month, ...attendance[month] });
            });

            await apiClient.post('/reports/marks', { studentId: selectedStudent, classGroup, marks: marksPayload });
            await apiClient.post('/reports/attendance', { studentId: selectedStudent, attendance: attendancePayload });

            Alert.alert('Success', 'Data saved successfully!');
        } catch (error) {
            console.error("Save error:", error.response?.data || error);
            Alert.alert('Error', 'Failed to save data. Please check your network and try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading && !selectedStudent) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#0000ff" /></View>;
    }
    
    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
            <Text style={styles.label}>Select Student:</Text>
            <View style={styles.pickerContainer}>
                <Picker
                    selectedValue={selectedStudent}
                    onValueChange={(itemValue) => setSelectedStudent(itemValue)}
                    enabled={students.length > 0}
                >
                    {students.map(s => <Picker.Item key={s.id} label={`${s.full_name} (Roll: ${s.username})`} value={s.id} />)}
                </Picker>
            </View>

            {loading && <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }}/>}
            
            {!loading && selectedStudent && (
                <>
                    <Text style={styles.yearHeader}>
                        Academic Year: {academicYear}
                    </Text>

                    <Text style={styles.sectionTitle}>Enter Marks</Text>
                    {subjectsForClass.map(subject => (
                        <View key={subject} style={styles.subjectContainer}>
                            <Text style={styles.subjectTitle}>{subject}</Text>
                            {config.exams.map(exam => (
                                <View key={exam} style={styles.inputRow}>
                                    <Text style={styles.inputLabel}>{exam}:</Text>
                                    <TextInput
                                        style={styles.input}
                                        keyboardType="number-pad"
                                        value={marks[subject]?.[exam] || ''}
                                        onChangeText={text => handleMarkChange(subject, exam, text)}
                                        placeholder="-"
                                        maxLength={3}
                                    />
                                </View>
                            ))}
                        </View>
                    ))}
                    
                    <Text style={styles.sectionTitle}>Enter Attendance</Text>
                     {config.attendanceMonths.map(month => (
                        <View key={month} style={[styles.inputRow, styles.attendanceRow]}>
                             <Text style={styles.inputLabel}>{month}:</Text>
                             <TextInput
                                style={styles.input}
                                keyboardType="number-pad"
                                value={attendance[month]?.working_days || ''}
                                onChangeText={text => handleAttendanceChange(month, 'working_days', text)}
                                placeholder="Working"
                                maxLength={2}
                            />
                             <TextInput
                                style={styles.input}
                                keyboardType="number-pad"
                                value={attendance[month]?.present_days || ''}
                                onChangeText={text => handleAttendanceChange(month, 'present_days', text)}
                                placeholder="Present"
                                maxLength={2}
                            />
                        </View>
                    ))}

                    <View style={styles.buttonContainer}>
                        <Button title={saving ? "Saving..." : "Save All Data"} onPress={onSave} disabled={saving || !selectedStudent} />
                    </View>
                </>
            )}

            {!loading && students.length === 0 && (
                <Text style={styles.emptyText}>No students found in this class to enter marks for.</Text>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 10, backgroundColor: '#f0f2f5' },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, backgroundColor: '#fff' },
    label: { fontSize: 16, fontWeight: 'bold', marginBottom: 5, color: '#333' },
    yearHeader: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', color: '#1E8449', marginVertical: 15, padding: 8, backgroundColor: '#D5F5E3', borderRadius: 5, borderWidth: 1, borderColor: '#ABEBC6' },
    sectionTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 20, marginBottom: 10, borderBottomWidth: 1, borderColor: '#ccc', paddingBottom: 5, color: '#2c3e50' },
    subjectContainer: { marginBottom: 15, padding: 15, backgroundColor: '#fff', borderRadius: 8, elevation: 1 },
    subjectTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#34495e' },
    inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'space-between' },
    attendanceRow: { paddingVertical: 5, paddingHorizontal: 10 },
    inputLabel: { flex: 2, fontSize: 16, color: '#555' },
    input: { flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 5, textAlign: 'center', marginLeft: 10, backgroundColor: '#fafafa' },
    buttonContainer: { marginTop: 30 },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#666' }
});

export default MarksEntryScreen;