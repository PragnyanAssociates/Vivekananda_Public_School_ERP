// 📂 File: src/screens/reports/AdminTeacherMarkEntry.tsx

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

// --- Constants ---
const SUBJECTS_BY_CLASS: { [key: string]: string[] } = {
    'LKG': ['All subjects'], 'UKG': ['All subjects'],
    'Class 1': ['Telugu', 'English', 'Hindi', 'EVS', 'Math'],'Class 2': ['Telugu', 'English', 'Hindi', 'EVS', 'Math'],'Class 3': ['Telugu', 'English', 'Hindi', 'EVS', 'Math'],'Class 4': ['Telugu', 'English', 'Hindi', 'EVS', 'Math'],'Class 5': ['Telugu', 'English', 'Hindi', 'EVS', 'Math'],
    'Class 6': ['Telugu', 'English', 'Hindi', 'Math', 'Science', 'Social'],'Class 7': ['Telugu', 'English', 'Hindi', 'Math', 'Science', 'Social'],'Class 8': ['Telugu', 'English', 'Hindi', 'Math', 'Science', 'Social'],'Class 9': ['Telugu', 'English', 'Hindi', 'Math', 'Science', 'Social'],'Class 10': ['Telugu', 'English', 'Hindi', 'Math', 'Science', 'Social'],
};
const EXAMS_STANDARD = ['Assignment 1', 'Unit Test 1', 'Assignment 2', 'Unit Test 2', 'SA 1', 'Assignment 3', 'Unit Test 3', 'Assignment 4', 'Unit Test 4', 'SA 2'];
const EXAMS_LKG_UKG = ['Term 1 Assessment'];
const ALL_CLASSES = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
const MONTHS = ['June', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];

// --- Interfaces ---
interface Student { id: number; full_name: string; roll_no: string; }
interface MarksState { [subject: string]: { [exam: string]: string; }; }
interface AttendanceState { [month: string]: { working_days: string; present_days: string; }; }

// --- Reusable Components ---
const ScreenHeader = ({ icon, title, subtitle }) => (
    <View style={styles.headerCard}><View style={styles.headerContent}><View style={styles.headerIconContainer}><MaterialIcons name={icon} size={28} color={styles.primaryColor.color} /></View><View style={styles.headerTextContainer}><Text style={styles.headerTitle}>{title}</Text><Text style={styles.headerSubtitle}>{subtitle}</Text></View></View></View>
);

const AdminTeacherMarkEntry = () => {
    const { user } = useAuth();
    const [view, setView] = useState<'classes' | 'students' | 'entryForm'>('classes');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [marks, setMarks] = useState<MarksState>({});
    const [attendance, setAttendance] = useState<AttendanceState>({});
    const [loading, setLoading] = useState(false);
    
    const handleClassSelect = async (className: string) => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/reports/students/${className}`);
            setStudents(res.data);
            setSelectedClass(className);
            setView('students');
        } catch (error) { Alert.alert('Error', 'Failed to load students.'); }
        finally { setLoading(false); }
    };

    const handleStudentSelect = async (student: Student) => {
        setLoading(true); setSelectedStudent(student);
        try {
            const res = await apiClient.get(`/reports/student-data/${student.id}`);
            const initialMarks: MarksState = {};
            res.data.marks.forEach((m: any) => {
                if (!initialMarks[m.subject]) initialMarks[m.subject] = {};
                initialMarks[m.subject][m.exam_type] = m.marks_obtained?.toString() ?? '';
            });
            setMarks(initialMarks);
            const initialAttendance: AttendanceState = {};
            res.data.attendance.forEach((a: any) => {
                initialAttendance[a.month] = { working_days: a.working_days?.toString() ?? '', present_days: a.present_days?.toString() ?? '' };
            });
            setAttendance(initialAttendance);
            setView('entryForm');
        } catch (error) { Alert.alert('Error', 'Failed to load student data.'); }
        finally { setLoading(false); }
    };

    const handleMarkChange = (subject: string, exam: string, value: string) => setMarks(prev => ({ ...prev, [subject]: { ...prev[subject], [exam]: value } }));
    const handleAttendanceChange = (month: string, field: 'working_days' | 'present_days', value: string) => setAttendance(prev => ({ ...prev, [month]: { ...prev[month], [field]: value } }));

    const handleSave = async () => {
        if (!selectedStudent || !selectedClass || !user) return;
        setLoading(true);
        try {
            const marksPayload = Object.entries(marks).flatMap(([subject, exams]) => Object.entries(exams).map(([exam_type, marks_obtained]) => ({ subject, exam_type, marks_obtained })));
            await apiClient.post('/reports/marks', { studentId: selectedStudent.id, classGroup: selectedClass, marks: marksPayload });
            
            const attendancePayload = Object.entries(attendance).map(([month, days]) => ({ month, working_days: days.working_days, present_days: days.present_days }));
            await apiClient.post('/reports/attendance', { studentId: selectedStudent.id, attendance: attendancePayload });

            Alert.alert('Success', 'Data saved successfully!');
        } catch (error) { Alert.alert('Error', 'Failed to save data.'); }
        finally { setLoading(false); }
    };

    const goBack = () => { if (view === 'entryForm') setView('students'); else if (view === 'students') setView('classes'); };

    const renderContent = () => {
        if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={styles.primaryColor.color} /></View>;
        
        switch (view) {
            case 'classes':
                return <ScrollView contentContainerStyle={styles.gridContainer}>{ALL_CLASSES.map(c => <TouchableOpacity key={c} style={styles.gridItem} onPress={() => handleClassSelect(c)}><Text style={styles.gridText}>{c}</Text></TouchableOpacity>)}</ScrollView>;
            
            case 'students':
                return <ScrollView>{students.map(s => <TouchableOpacity key={s.id} style={styles.listItem} onPress={() => handleStudentSelect(s)}><Text style={styles.listText}>{s.full_name} ({s.roll_no})</Text></TouchableOpacity>)}</ScrollView>;
            
            case 'entryForm':
                const subjects = SUBJECTS_BY_CLASS[selectedClass];
                const exams = selectedClass === 'LKG' || selectedClass === 'UKG' ? EXAMS_LKG_UKG : EXAMS_STANDARD;
                return (
                    <ScrollView>
                        <Text style={styles.sectionTitle}>Marks Entry</Text>
                        <ScrollView horizontal>
                            <View>
                                <View style={styles.tableRow}><Text style={[styles.cell, styles.headerCell, styles.subjectCell]}>Subject</Text>{exams.map(e => <Text key={e} style={[styles.cell, styles.headerCell, styles.examCell]}>{e}</Text>)}</View>
                                {subjects.map(sub => (
                                    <View key={sub} style={styles.tableRow}>
                                        <Text style={[styles.cell, styles.subjectCell]}>{sub}</Text>
                                        {exams.map(exam => (
                                            <TextInput
                                                key={exam}
                                                style={[styles.cell, styles.inputCell, styles.examCell]}
                                                keyboardType="numeric"
                                                value={marks[sub]?.[exam] ?? ''}
                                                onChangeText={(val) => handleMarkChange(sub, exam, val)}
                                            />
                                        ))}
                                    </View>
                                ))}
                            </View>
                        </ScrollView>

                        <Text style={styles.sectionTitle}>Attendance Entry</Text>
                        <View style={styles.attRow}><Text style={[styles.attCell, styles.attHeader]}>Month</Text>{MONTHS.map(m => <Text key={m} style={[styles.attCell, styles.attHeader]}>{m}</Text>)}</View>
                        <View style={styles.attRow}><Text style={[styles.attCell, styles.attHeader]}>Working Days</Text>{MONTHS.map(m => <TextInput key={m} style={[styles.attCell, styles.inputCell]} keyboardType="numeric" value={attendance[m]?.working_days ?? ''} onChangeText={val => handleAttendanceChange(m, 'working_days', val)} />)}</View>
                        <View style={styles.attRow}><Text style={[styles.attCell, styles.attHeader]}>Present Days</Text>{MONTHS.map(m => <TextInput key={m} style={[styles.attCell, styles.inputCell]} keyboardType="numeric" value={attendance[m]?.present_days ?? ''} onChangeText={val => handleAttendanceChange(m, 'present_days', val)} />)}</View>
                        
                        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}><Text style={styles.saveButtonText}>Save All Changes</Text></TouchableOpacity>
                    </ScrollView>
                );
            default: return null;
        }
    };

    return (
        <View style={styles.fullScreenContainer}>
            <ScreenHeader icon="edit" title="Marks & Attendance Entry" subtitle={view === 'entryForm' ? `${selectedStudent?.full_name} - ${selectedClass}` : 'Select a class to begin'} />
            {view !== 'classes' && <TouchableOpacity onPress={goBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={24} color={styles.primaryColor.color} /><Text style={styles.backButtonText}>Back</Text></TouchableOpacity>}
            <View style={styles.contentContainer}>
                {renderContent()}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    primaryColor: { color: '#008080' },
    fullScreenContainer: { flex: 1, backgroundColor: '#f0f4f7' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerCard: { backgroundColor: '#fff', padding: 15, marginHorizontal: 10, marginTop: 10, borderRadius: 10, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
    headerContent: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: { backgroundColor: '#e0f2f1', borderRadius: 25, width: 50, height: 50, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    headerTextContainer: { flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    headerSubtitle: { fontSize: 14, color: '#555', marginTop: 2 },
    contentContainer: { flex: 1, padding: 10, },
    backButton: { flexDirection: 'row', alignItems: 'center', padding: 10, },
    backButtonText: { color: '#008080', fontSize: 16, marginLeft: 5 },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    gridItem: { backgroundColor: '#008080', margin: 8, width: 100, height: 100, borderRadius: 10, justifyContent: 'center', alignItems: 'center', elevation: 3 },
    gridText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    listItem: { backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee', },
    listText: { fontSize: 16 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#008080', marginTop: 20, marginBottom: 10, },
    tableRow: { flexDirection: 'row' },
    cell: { borderWidth: 1, borderColor: '#ccc', padding: 8, textAlign: 'center' },
    headerCell: { backgroundColor: '#f0f4f7', fontWeight: 'bold' },
    subjectCell: { width: 120, textAlign: 'left' },
    examCell: { width: 90 },
    inputCell: { backgroundColor: '#fff' },
    attRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee' },
    attCell: { flex: 1, padding: 10, textAlign: 'center', borderWidth: 1, borderColor: '#ddd' },
    attHeader: { fontWeight: 'bold', backgroundColor: '#f0f4f7' },
    saveButton: { backgroundColor: '#28a745', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20, elevation: 2 },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default AdminTeacherMarkEntry;