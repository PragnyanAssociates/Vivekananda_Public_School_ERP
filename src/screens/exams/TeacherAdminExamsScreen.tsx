import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView, TextInput, Modal } from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';

// --- Main Router Component ---
const TeacherAdminExamsScreen = () => {
    const [view, setView] = useState('list');
    const [selectedExam, setSelectedExam] = useState(null);

    const backToList = () => { setSelectedExam(null); setView('list'); };
    const handleCreateNew = () => { setSelectedExam(null); setView('create'); };
    const handleEdit = (exam) => { setSelectedExam(exam); setView('create'); };
    const handleViewSubmissions = (exam) => { setSelectedExam(exam); setView('submissions'); };

    if (view === 'list') {
        return <ExamList onCreateNew={handleCreateNew} onEdit={handleEdit} onViewSubmissions={handleViewSubmissions} />;
    }
    if (view === 'create') {
        return <CreateOrEditExamView examToEdit={selectedExam} onFinish={backToList} />;
    }
    if (view === 'submissions' && selectedExam) {
        return <SubmissionsView exam={selectedExam} onBack={backToList} />;
    }
    return null;
};

// --- View 1: List of Created Exams ---
const ExamList = ({ onCreateNew, onEdit, onViewSubmissions }) => {
    const { user } = useAuth();
    const [exams, setExams] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const isFocused = useIsFocused();

    const fetchExams = useCallback(async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/exams/teacher/${user.id}`);
            setExams(response.data);
        } catch (e: any) { Alert.alert('Error', e.response?.data?.message || 'Failed to fetch exams.'); }
        finally { setIsLoading(false); }
    }, [user?.id]);

    useEffect(() => {
        if (isFocused) { fetchExams(); }
    }, [isFocused, fetchExams]);

    const handleDelete = (exam) => {
        Alert.alert("Confirm Delete", `Are you sure you want to delete "${exam.title}"?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive",
                onPress: async () => {
                    setIsLoading(true);
                    try {
                        await apiClient.delete(`/exams/${exam.exam_id}`);
                        setExams(prevExams => prevExams.filter(e => e.exam_id !== exam.exam_id));
                        Alert.alert("Success", "Exam deleted.");
                    } catch (e: any) { Alert.alert("Error", e.response?.data?.message || 'Failed to delete.'); }
                    finally { setIsLoading(false); }
                }
            }
        ]);
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}><Text style={styles.headerTitle}>My Created Exams</Text></View>
            <FlatList
                data={exams}
                keyExtractor={(item) => item.exam_id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                            <View style={styles.actionIcons}>
                                <TouchableOpacity onPress={() => onEdit(item)}><MaterialIcons name="edit" size={24} color="#007bff" /></TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(item)} style={{ marginLeft: 15 }}><MaterialIcons name="delete" size={24} color="#dc3545" /></TouchableOpacity>
                            </View>
                        </View>
                        <Text style={styles.cardSubtitle}>For: {item.class_group}</Text>
                        <View style={item.submission_count > 0 ? styles.badge : styles.badgeMuted}><Text style={styles.badgeText}>{item.submission_count} Submission(s)</Text></View>
                        <TouchableOpacity style={styles.viewSubmissionsBtn} onPress={() => onViewSubmissions(item)}><Text style={styles.viewSubmissionsBtnText}>View Submissions & Grade</Text></TouchableOpacity>
                    </View>
                )}
                onRefresh={fetchExams}
                refreshing={isLoading}
                ListEmptyComponent={!isLoading ? <Text style={styles.emptyText}>You have not created any exams yet.</Text> : null}
                ListFooterComponent={<TouchableOpacity style={styles.addButton} onPress={onCreateNew}><MaterialIcons name="add" size={24} color="#fff" /><Text style={styles.addButtonText}>Create New Exam</Text></TouchableOpacity>}
                contentContainerStyle={{ flexGrow: 1 }}
            />
        </View>
    );
};

// --- View 2: Create OR Edit Exam ---
const CreateOrEditExamView = ({ examToEdit, onFinish }) => {
    const { user } = useAuth();
    const isEditMode = !!examToEdit;
    const [examDetails, setExamDetails] = useState({ title: '', description: '', class_group: '', time_limit_mins: '0' });
    const [questions, setQuestions] = useState([]);
    const [isLoading, setIsLoading] = useState(isEditMode);
    const [isSaving, setIsSaving] = useState(false);
    const [studentClasses, setStudentClasses] = useState([]);
    
    useEffect(() => {
        const bootstrapData = async () => {
            try {
                const classesRes = await apiClient.get('/student-classes');
                setStudentClasses(classesRes.data);

                if (isEditMode) {
                    const examRes = await apiClient.get(`/exams/${examToEdit.exam_id}`);
                    const data = examRes.data;
                    setExamDetails({ title: data.title, description: data.description || '', class_group: data.class_group, time_limit_mins: String(data.time_limit_mins || '0') });
                    setQuestions(data.questions.map(q => ({ ...q, id: q.question_id, options: (q.options && typeof q.options === 'string') ? JSON.parse(q.options) : (q.options || {A:'', B:'', C:'', D:''}) })));
                }
            } catch (e: any) { 
                Alert.alert("Error", e.response?.data?.message || "Failed to load data.");
                if(isEditMode) onFinish();
            } finally { 
                setIsLoading(false); 
            }
        };
        bootstrapData();
    }, [isEditMode, examToEdit, onFinish]);

    const addQuestion = () => setQuestions([...questions, { id: Date.now(), question_text: '', question_type: 'multiple_choice', options: { A: '', B: '', C: '', D: '' }, correct_answer: '', marks: '1' }]);
    const handleQuestionChange = (id, field, value) => setQuestions(questions.map(q => (q.id === id ? { ...q, [field]: value } : q)));
    const handleOptionChange = (id, optionKey, value) => setQuestions(questions.map(q => (q.id === id ? { ...q, options: { ...q.options, [optionKey]: value } } : q)));
    const handleRemoveQuestion = (id) => setQuestions(questions.filter(q => q.id !== id));
    
    const handleSave = async () => {
        if (!user?.id) return Alert.alert("Session Error", "Could not identify user.");
        if (!examDetails.title || !examDetails.class_group || questions.length === 0) return Alert.alert('Validation Error', 'Title, Class Group, and at least one question are required.');
        setIsSaving(true);
        const payload = { ...examDetails, questions, teacher_id: user.id };
        try {
            if (isEditMode) {
                await apiClient.put(`/exams/${examToEdit.exam_id}`, payload);
            } else {
                await apiClient.post('/exams', payload);
            }
            Alert.alert('Success', `Exam ${isEditMode ? 'updated' : 'created'}!`);
            onFinish();
        } catch (e: any) { Alert.alert('Error', e.response?.data?.message || "Failed to save exam."); } 
        finally { setIsSaving(false); }
    };

    if (isLoading) return <View style={styles.centered}><ActivityIndicator size="large" /><Text>Loading Exam Data...</Text></View>
    return ( <ScrollView style={styles.containerDark}><TouchableOpacity onPress={onFinish} style={styles.backButton}><MaterialIcons name="arrow-back" size={24} color="#333" /><Text style={styles.backButtonText}>Back to Exam List</Text></TouchableOpacity><Text style={styles.headerTitle}>{isEditMode ? 'Edit Exam' : 'Create New Exam'}</Text><View style={styles.formSection}><Text style={styles.label}>Exam Title *</Text><TextInput style={styles.input} value={examDetails.title} onChangeText={t => setExamDetails({ ...examDetails, title: t })} /><Text style={styles.label}>Class *</Text><View style={styles.pickerContainer}><Picker selectedValue={examDetails.class_group} onValueChange={v => setExamDetails({ ...examDetails, class_group: v })}><Picker.Item label="-- Select a Class --" value="" />{studentClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}</Picker></View><Text style={styles.label}>Time Limit (minutes)</Text><TextInput style={styles.input} keyboardType="number-pad" value={examDetails.time_limit_mins} onChangeText={t => setExamDetails({ ...examDetails, time_limit_mins: t })} /></View><View style={styles.formSection}><Text style={styles.headerTitleSecondary}>Questions</Text>{questions.map((q, index) => (<View key={q.id} style={styles.questionEditor}><View style={styles.cardHeader}><Text style={styles.questionEditorTitle}>Question {index + 1}</Text><TouchableOpacity onPress={() => handleRemoveQuestion(q.id)}><MaterialIcons name="close" size={22} color="#dc3545" /></TouchableOpacity></View><TextInput style={styles.input} multiline placeholder="Enter question text..." value={q.question_text} onChangeText={t => handleQuestionChange(q.id, 'question_text', t)} />
    
    <Text style={styles.label}>Question Type</Text>
    <View style={styles.pickerContainer}><Picker selectedValue={q.question_type} onValueChange={v => handleQuestionChange(q.id, 'question_type', v)}><Picker.Item label="Multiple Choice" value="multiple_choice" /><Picker.Item label="Written Answer" value="written_answer" /></Picker></View>
    
    {q.question_type === 'multiple_choice' && (<>
        {Object.keys(q.options).map(key => (<TextInput key={key} style={styles.input} placeholder={`Option ${key}`} value={q.options[key]} onChangeText={t => handleOptionChange(q.id, key, t)} />))}
        <Text style={styles.label}>Correct Answer</Text>
        <View style={styles.pickerContainer}><Picker selectedValue={q.correct_answer} onValueChange={v => handleQuestionChange(q.id, 'correct_answer', v)}><Picker.Item label="-- Select correct option --" value="" />{Object.keys(q.options).map(key => q.options[key] && <Picker.Item key={key} label={`Option ${key}`} value={key} />)}</Picker></View>
    </>)}

    <Text style={styles.label}>Marks</Text><TextInput style={styles.input} keyboardType="number-pad" value={String(q.marks)} onChangeText={t => handleQuestionChange(q.id, 'marks', t)} /></View>))}<TouchableOpacity style={styles.addQuestionBtn} onPress={addQuestion}><Text style={styles.addQuestionBtnText}>+ Add Another Question</Text></TouchableOpacity></View><TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSaving}>{isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{isEditMode ? 'Save Changes' : 'Save and Publish Exam'}</Text>}</TouchableOpacity></ScrollView> );
};


// --- View 3: Submissions View ---
const SubmissionsView = ({ exam, onBack }) => {
    const { user } = useAuth();
    const [submissions, setSubmissions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [gradingSubmission, setGradingSubmission] = useState(null);
    const [submissionDetails, setSubmissionDetails] = useState([]);
    const [gradedAnswers, setGradedAnswers] = useState({});
    const [isSubmittingGrade, setIsSubmittingGrade] = useState(false);

    const fetchSubmissions = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/exams/${exam.exam_id}/submissions`);
            setSubmissions(response.data);
        } catch (e: any) { Alert.alert('Error', e.response?.data?.message || 'Failed to fetch submissions.'); } 
        finally { setIsLoading(false); }
    }, [exam.exam_id]);

    useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

    const openGradingModal = async (submission) => {
        setIsLoading(true);
        setGradingSubmission(submission);
        try {
            const response = await apiClient.get(`/submissions/${submission.attempt_id}`);
            let details = response.data.map(item => ({...item, options: (item.options && typeof item.options === 'string') ? JSON.parse(item.options) : item.options,}));
            setSubmissionDetails(details);
            const initialGrades = details.reduce((acc, item) => ({ ...acc, [item.question_id]: item.marks_awarded || '' }), {});
            setGradedAnswers(initialGrades);
        } catch (e: any) { Alert.alert('Error', e.response?.data?.message || 'Could not fetch submission details.'); setGradingSubmission(null); } 
        finally { setIsLoading(false); }
    };

    const handleGradeChange = (questionId, marks) => setGradedAnswers(prev => ({ ...prev, [questionId]: marks }));
    
    const submitGrade = async () => {
        if (!user?.id) return Alert.alert('Session Error', 'Could not identify the grading teacher.');
        setIsSubmittingGrade(true);
        const answersPayload = Object.entries(gradedAnswers).map(([qid, marks]) => ({ question_id: qid, marks_awarded: marks || 0 }));
        try {
            await apiClient.post(`/submissions/${gradingSubmission.attempt_id}/grade`, { gradedAnswers: answersPayload, teacher_feedback: '', teacher_id: user.id });
            Alert.alert('Success', 'Grades submitted successfully!');
            setGradingSubmission(null);
            fetchSubmissions();
        } catch (e: any) { Alert.alert('Error', e.response?.data?.message || "Failed to submit grade."); } 
        finally { setIsSubmittingGrade(false); }
    };
    
    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}><MaterialIcons name="arrow-back" size={24} color="#333" /><Text style={styles.backButtonText}>Back to Exam List</Text></TouchableOpacity>
            <Text style={styles.headerTitle}>Submissions for "{exam.title}"</Text>
            <FlatList
                data={submissions}
                keyExtractor={(item) => item.attempt_id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.submissionCard}>
                        <Text style={styles.cardTitle}>{item.student_name}</Text>
                        <Text style={styles.cardDetail}>Status: {item.status}</Text>
                        {item.status === 'graded' && <Text style={styles.cardDetail}>Score: {item.final_score} / {exam.total_marks}</Text>}
                        <TouchableOpacity style={styles.gradeButton} onPress={() => openGradingModal(item)}><Text style={styles.gradeButtonText}>{item.status === 'graded' ? 'Update Grade' : 'Grade Now'}</Text></TouchableOpacity>
                    </View>
                )}
                onRefresh={fetchSubmissions}
                refreshing={isLoading}
                ListEmptyComponent={!isLoading ? <Text style={styles.emptyText}>No students have submitted this exam yet.</Text> : null}
                contentContainerStyle={{ flexGrow: 1 }}
            />
            <Modal visible={!!gradingSubmission} onRequestClose={() => setGradingSubmission(null)} animationType="slide">
                <ScrollView style={styles.modalView}>
                    <Text style={styles.modalTitle}>Grading: {gradingSubmission?.student_name}</Text>
                    {isLoading ? <ActivityIndicator size="large" /> : submissionDetails.map((item, index) => {
                        let correctAnswerDisplay = 'N/A';
                        if (item.question_type === 'multiple_choice' && item.correct_answer && item.options && item.options[item.correct_answer]) {
                            correctAnswerDisplay = `${item.correct_answer}. ${item.options[item.correct_answer]}`;
                        }

                        return (
                            <View key={item.question_id} style={styles.gradingItem}>
                                <Text style={styles.questionText}>{index + 1}. {item.question_text}</Text>
                                <Text style={styles.studentAnswer}>Student Answer: <Text style={{ fontWeight: 'normal' }}>{item.answer_text || 'Not answered'}</Text></Text>
                                
                                {item.question_type === 'multiple_choice' &&
                                    <Text style={styles.correctAnswerText}>Correct Answer: <Text style={{ fontWeight: 'normal' }}>{correctAnswerDisplay}</Text></Text>
                                }
                                
                                <Text style={styles.label}>Award Marks (out of {item.marks})</Text>
                                <TextInput style={styles.input} keyboardType="number-pad" placeholder={`Max ${item.marks}`} value={String(gradedAnswers[item.question_id] ?? '')} onChangeText={text => handleGradeChange(item.question_id, text)} />
                            </View>
                        );
                    })}
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setGradingSubmission(null)}><Text style={styles.modalBtnText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.modalBtn, styles.saveButton]} onPress={submitGrade} disabled={isSubmittingGrade}>{isSubmittingGrade ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Submit Grades</Text>}</TouchableOpacity>
                    </View>
                </ScrollView>
            </Modal>
        </View>
    );
};


// Styles
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f8' },
    containerDark: { flex: 1, backgroundColor: '#eceff1' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerContainer: { paddingBottom: 10, paddingTop: 10, backgroundColor: '#f4f6f8' },
    headerTitle: { fontSize: 24, fontWeight: 'bold', paddingHorizontal: 15, color: '#333' },
    headerTitleSecondary: { fontSize: 20, fontWeight: 'bold', color: '#333' },
    card: { backgroundColor: '#fff', borderRadius: 8, marginHorizontal: 15, marginVertical: 8, padding: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    actionIcons: { flexDirection: 'row' },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#37474f', flex: 1, marginRight: 10 },
    cardSubtitle: { fontSize: 14, color: '#546e7a', marginTop: 2 },
    badge: { backgroundColor: '#ffb300', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10, alignSelf: 'flex-start', marginTop: 10 },
    badgeMuted: { backgroundColor: '#e0e0e0', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10, alignSelf: 'flex-start', marginTop: 10 },
    badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    viewSubmissionsBtn: { marginTop: 12, backgroundColor: '#007bff', paddingVertical: 10, borderRadius: 5, alignItems: 'center' },
    viewSubmissionsBtnText: { color: '#fff', fontWeight: 'bold' },
    addButton: { flexDirection: 'row', backgroundColor: '#28a745', padding: 15, marginHorizontal: 15, marginTop: 10, marginBottom: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', elevation: 3 },
    addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#777' },
    backButton: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    backButtonText: { marginLeft: 5, fontSize: 18, color: '#333', fontWeight: '500' },
    formSection: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginHorizontal: 10, marginVertical: 8 },
    label: { fontSize: 16, fontWeight: '500', color: '#444', marginBottom: 5, marginLeft: 5 },
    input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 15, fontSize: 16 },
    pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 15, backgroundColor: '#f9f9f9' },
    questionEditor: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 10, marginVertical: 10, backgroundColor: '#fafafa' },
    questionEditorTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, paddingBottom: 5 },
    addQuestionBtn: { backgroundColor: '#e8eaf6', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    addQuestionBtnText: { color: '#3f51b5', fontWeight: 'bold' },
    saveButton: { backgroundColor: '#28a745', padding: 15, margin: 15, borderRadius: 10, alignItems: 'center' },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    submissionCard: { backgroundColor: '#fff', borderRadius: 8, marginHorizontal: 15, marginVertical: 8, padding: 15, elevation: 2 },
    cardDetail: { fontSize: 14, color: '#777', marginTop: 5 },
    gradeButton: { marginTop: 12, backgroundColor: '#ffc107', paddingVertical: 10, borderRadius: 5, alignItems: 'center' },
    gradeButtonText: { color: '#212529', fontWeight: 'bold' },
    modalView: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    gradingItem: { marginVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    questionText: { fontSize: 16, fontWeight: '500' },
    studentAnswer: { fontStyle: 'italic', color: '#333', marginVertical: 8, padding: 8, backgroundColor: '#f0f0f0', borderRadius: 5, fontWeight: 'bold' },
    correctAnswerText: { fontStyle: 'italic', color: '#28a745', marginVertical: 8, padding: 8, backgroundColor: '#e9f5e9', borderRadius: 5, fontWeight: 'bold' },
    modalActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 30, marginBottom: 50 },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    modalBtnText: { color: '#fff', fontWeight: 'bold' },
    cancelBtn: { backgroundColor: '#6c757d', marginRight: 10 },
});

export default TeacherAdminExamsScreen;