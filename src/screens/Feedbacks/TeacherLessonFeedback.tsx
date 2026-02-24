import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, useColorScheme, StatusBar, Dimensions
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/client'; // Adjust path based on your folder structure
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    background: '#F5F7FA', cardBg: '#FFFFFF', textMain: '#263238', textSub: '#546E7A',
    primary: '#008080', border: '#CFD8DC', success: '#27AE60', danger: '#E53935', 
    warning: '#FFA000', iconBg: '#E0F2F1', rowAlt: '#FAFAFA'
};
const DarkColors = {
    background: '#121212', cardBg: '#1E1E1E', textMain: '#E0E0E0', textSub: '#B0B0B0',
    primary: '#008080', border: '#333333', success: '#27AE60', danger: '#EF5350', 
    warning: '#FFA726', iconBg: '#333333', rowAlt: '#252525'
};

const formatDate = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

const TeacherLessonFeedback = () => {
    const { user } = useAuth();
    const isDark = useColorScheme() === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;
    const isAdmin = user?.role === 'admin';

    // FLOW: classes -> students -> lessons -> grading
    const [viewStep, setViewStep] = useState('classes'); 
    const [loading, setLoading] = useState(false);

    // Data States
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [lessons, setLessons] = useState([]);
    
    // Selections
    const [selectedClass, setSelectedClass] = useState(null);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedLesson, setSelectedLesson] = useState(null);

    // Grading State
    const [answers, setAnswers] = useState([]);
    const [remarks, setRemarks] = useState('');

    useEffect(() => {
        if (user) fetchClasses();
    }, [user]);

    // 1. Fetch Classes assigned to Teacher
    const fetchClasses = async () => {
        setLoading(true);
        try {
            const targetId = isAdmin ? 1 : user.id; 
            const res = await apiClient.get(`/lesson-feedback/teacher/classes/${targetId}`);
            setClasses(res.data);
        } catch (e) { Alert.alert('Error', 'Failed to load classes.'); }
        setLoading(false);
    };

    // 2. Select Class -> Fetch Students
    const handleClassSelect = async (classItem) => {
        setSelectedClass(classItem);
        setLoading(true);
        try {
            const res = await apiClient.get(`/lesson-feedback/teacher/class-students/${classItem.class_group}`);
            setStudents(res.data);
            setViewStep('students');
        } catch (e) { Alert.alert('Error', 'Failed to load students.'); }
        setLoading(false);
    };

    // 3. Select Student -> Fetch Lessons with Statuses
    const handleStudentSelect = async (student) => {
        setSelectedStudent(student);
        setLoading(true);
        try {
            const res = await apiClient.get(`/lesson-feedback/teacher/student-lessons/${selectedClass.class_group}/${selectedClass.subject_name}/${student.student_id}`);
            setLessons(res.data);
            setViewStep('lessons');
        } catch (e) { Alert.alert('Error', 'Failed to load student lessons.'); }
        setLoading(false);
    };

    // 4. Select Lesson -> Fetch Grading Form
    const handleLessonSelect = async (lesson) => {
        setSelectedLesson(lesson);
        if (!lesson.is_submitted) {
            Alert.alert("Pending", "Student has not submitted answers for this lesson yet.");
            return;
        }
        setLoading(true);
        try {
            const res = await apiClient.get(`/lesson-feedback/student/submission/${selectedStudent.student_id}/${selectedClass.class_group}/${selectedClass.subject_name}/${lesson.lesson_name}`);
            setAnswers(res.data.answers || []);
            setRemarks(res.data.teaching_remarks || '');
            setViewStep('grading');
        } catch (e) { Alert.alert('Error', 'Failed to load answers.'); }
        setLoading(false);
    };

    // 5. Toggle Marks
    const handleMarkToggle = (index, markValue) => {
        if (isAdmin) return;
        const newAnswers = [...answers];
        newAnswers[index].mark = markValue;
        setAnswers(newAnswers);
    };

    // 6. Save Marks -> Return to Lessons view for that student
    const handleSaveMarks = async () => {
        if (isAdmin) return;
        setLoading(true);
        try {
            await apiClient.post('/lesson-feedback/teacher/mark', {
                student_id: selectedStudent.student_id,
                class_group: selectedClass.class_group,
                subject_name: selectedClass.subject_name,
                lesson_name: selectedLesson.lesson_name,
                answers,
                teacher_id: user.id
            });
            Alert.alert('Success', 'Marks saved successfully!');
            handleStudentSelect(selectedStudent); // Refresh lesson list for the student
        } catch (e) { Alert.alert('Error', 'Failed to save marks.'); }
        setLoading(false);
    };

    // Reusable Header Component
    const renderHeader = (title, subtitle, showBack, backAction) => (
        <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {showBack && (
                    <TouchableOpacity onPress={backAction} style={{ marginRight: 15 }}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>
                )}
                <View style={[styles.headerIconContainer, { backgroundColor: COLORS.iconBg }]}>
                    <MaterialIcons name="fact-check" size={24} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: COLORS.textMain }]} numberOfLines={1}>{title}</Text>
                    <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>{subtitle}</Text>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={COLORS.background} />

            {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} /> : (
                <>
                    {/* STEP 1: CLASSES */}
                    {viewStep === 'classes' && (
                        <>
                            {renderHeader("Marking Dashboard", "Select a Class & Subject", false)}
                            <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 50 }}>
                                {classes.length > 0 ? classes.map((c, idx) => (
                                    <TouchableOpacity key={idx} style={[styles.card, { backgroundColor: COLORS.cardBg }]} onPress={() => handleClassSelect(c)}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.cardTitle, { color: COLORS.textMain }]}>{c.class_group}</Text>
                                            <Text style={{ color: COLORS.textSub, marginTop: 4 }}>{c.subject_name}</Text>
                                        </View>
                                        <MaterialIcons name="chevron-right" size={24} color={COLORS.textSub} />
                                    </TouchableOpacity>
                                )) : <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No assigned classes found.</Text>}
                            </ScrollView>
                        </>
                    )}

                    {/* STEP 2: STUDENTS */}
                    {viewStep === 'students' && (
                        <>
                            {renderHeader(`${selectedClass.class_group} - ${selectedClass.subject_name}`, "Select a Student", true, () => setViewStep('classes'))}
                            <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 50 }}>
                                {students.length > 0 ? students.map((student, idx) => (
                                    <TouchableOpacity 
                                        key={student.student_id} 
                                        style={[styles.card, { backgroundColor: COLORS.cardBg }]} 
                                        onPress={() => handleStudentSelect(student)}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                            <Text style={{ fontWeight: 'bold', width: 35, color: COLORS.textSub, fontSize: 16 }}>{student.roll_no || '-'}</Text>
                                            <Text style={[styles.cardTitle, { color: COLORS.textMain, marginLeft: 10 }]} numberOfLines={1}>{student.full_name}</Text>
                                        </View>
                                        <MaterialIcons name="chevron-right" size={24} color={COLORS.textSub} />
                                    </TouchableOpacity>
                                )) : <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No students in this class.</Text>}
                            </ScrollView>
                        </>
                    )}

                    {/* STEP 3: LESSONS */}
                    {viewStep === 'lessons' && (
                        <>
                            {renderHeader(selectedStudent.full_name, "Select a Lesson to Mark", true, () => setViewStep('students'))}
                            <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 50 }}>
                                {lessons.length > 0 ? lessons.map((lesson) => (
                                    <TouchableOpacity 
                                        key={lesson.id} 
                                        style={[styles.card, { backgroundColor: COLORS.cardBg }]} 
                                        onPress={() => handleLessonSelect(lesson)}
                                    >
                                        <Text style={[styles.cardTitle, { color: COLORS.textMain, flex: 1 }]}>{lesson.lesson_name}</Text>
                                        
                                        <View style={[styles.statusBadge, { backgroundColor: lesson.is_marked ? COLORS.success : (lesson.is_submitted ? COLORS.warning : COLORS.danger) }]}>
                                            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                {lesson.is_marked ? 'Marked' : (lesson.is_submitted ? 'Pending' : 'No Data')}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                )) : <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No lessons found in syllabus.</Text>}
                            </ScrollView>
                        </>
                    )}

                    {/* STEP 4: GRADING */}
                    {viewStep === 'grading' && (
                        <>
                            {renderHeader(selectedLesson.lesson_name, selectedStudent.full_name, true, () => setViewStep('lessons'))}
                            <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 50 }}>
                                
                                <View style={[styles.remarksBox, { backgroundColor: COLORS.rowAlt, borderColor: COLORS.border }]}>
                                    <Text style={[styles.label, { color: COLORS.primary }]}>Student Remarks:</Text>
                                    <Text style={{ color: COLORS.textMain, marginTop: 5, fontSize: 14 }}>{remarks || 'No remarks provided.'}</Text>
                                </View>

                                {answers.map((item, index) => (
                                    <View key={index} style={[styles.questionBox, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                                        <Text style={[styles.label, { color: COLORS.textSub }]}>{item.q_no}. {item.question}</Text>
                                        <Text style={{ color: COLORS.textMain, marginTop: 8, marginBottom: 15, fontSize: 15, padding: 10, backgroundColor: COLORS.inputBg, borderRadius: 8, overflow: 'hidden' }}>
                                            {item.answer || 'No answer typed.'}
                                        </Text>
                                        
                                        <View style={styles.gradingRow}>
                                            <Text style={{ color: COLORS.textSub, fontWeight: 'bold' }}>Marks given:</Text>
                                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                                <TouchableOpacity 
                                                    style={[styles.markBtn, item.mark === 0 && { backgroundColor: COLORS.danger, borderColor: COLORS.danger }]}
                                                    onPress={() => handleMarkToggle(index, 0)}
                                                    disabled={isAdmin}
                                                >
                                                    <Text style={[styles.markBtnText, item.mark === 0 && { color: '#FFF' }]}>0</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity 
                                                    style={[styles.markBtn, item.mark === 1 && { backgroundColor: COLORS.success, borderColor: COLORS.success }]}
                                                    onPress={() => handleMarkToggle(index, 1)}
                                                    disabled={isAdmin}
                                                >
                                                    <Text style={[styles.markBtnText, item.mark === 1 && { color: '#FFF' }]}>1</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                ))}

                                {!isAdmin && (
                                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: COLORS.primary }]} onPress={handleSaveMarks}>
                                        <Text style={styles.saveBtnText}>Save Marks</Text>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        </>
                    )}
                </>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerCard: { padding: 15, width: width * 0.94, alignSelf: 'center', marginTop: 15, marginBottom: 5, borderRadius: 12, elevation: 2 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13, marginTop: 2 },
    card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, marginBottom: 12, borderRadius: 10, elevation: 1 },
    cardTitle: { fontSize: 16, fontWeight: '600', flex: 1 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, marginLeft: 10 },
    remarksBox: { padding: 15, borderRadius: 10, borderWidth: 1, marginBottom: 15, elevation: 1, shadowOpacity: 0.05 },
    questionBox: { padding: 15, borderRadius: 10, borderWidth: 1, marginBottom: 15, elevation: 1, shadowOpacity: 0.05 },
    label: { fontSize: 13, fontWeight: 'bold' },
    gradingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 12 },
    markBtn: { width: 45, height: 40, borderRadius: 8, borderWidth: 1, borderColor: '#CCC', justifyContent: 'center', alignItems: 'center' },
    markBtnText: { fontWeight: 'bold', fontSize: 16, color: '#777' },
    saveBtn: { padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
    saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
    emptyText: { textAlign: 'center', marginTop: 30, fontSize: 14 }
});

export default TeacherLessonFeedback;