import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, 
    Alert, ScrollView, TextInput, Modal, SafeAreaView, useColorScheme, 
    StatusBar, Dimensions, Platform 
} from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';

const { width, height } = Dimensions.get('window');

// --- THEME CONFIGURATION (Master Style Guide) ---
const LightColors = {
    primary: '#008080',
    background: '#F5F7FA',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    inputBg: '#FAFAFA',
    iconGrey: '#90A4AE',
    danger: '#E53935',
    success: '#43A047',
    blue: '#1E88E5',
    headerIconBg: '#E0F2F1',
    placeholder: '#B0BEC5',
    modalOverlay: 'rgba(0,0,0,0.6)',
    divider: '#f0f2f5'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    iconGrey: '#757575',
    danger: '#EF5350',
    success: '#66BB6A',
    blue: '#42A5F5',
    headerIconBg: '#333333',
    placeholder: '#616161',
    modalOverlay: 'rgba(255,255,255,0.1)',
    divider: '#2C2C2C'
};

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
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const [exams, setExams] = useState([]);
    const [filteredExams, setFilteredExams] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const isFocused = useIsFocused();

    const fetchExams = useCallback(async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/exams/teacher/${user.id}`);
            setExams(response.data);
            setFilteredExams(response.data);
        } catch (e) { 
            Alert.alert('Error', 'Failed to fetch exams.'); 
        } finally { setIsLoading(false); }
    }, [user?.id]);

    useEffect(() => {
        if (isFocused) { fetchExams(); }
    }, [isFocused, fetchExams]);

    // Handle Search
    useEffect(() => {
        const query = searchQuery.toLowerCase();
        const filtered = exams.filter(e => 
            e.title.toLowerCase().includes(query) || 
            e.class_group.toLowerCase().includes(query)
        );
        setFilteredExams(filtered);
    }, [searchQuery, exams]);

    const handleMenuPress = (exam) => {
        Alert.alert(
            "Manage Exam",
            `Options for "${exam.title}"`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Edit", onPress: () => onEdit(exam) },
                { text: "Delete", style: "destructive", onPress: () => handleDelete(exam) }
            ]
        );
    };

    const handleDelete = (exam) => {
        Alert.alert("Confirm Delete", "Permanently delete this exam?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive",
                onPress: async () => {
                    setIsLoading(true);
                    try {
                        await apiClient.delete(`/exams/${exam.exam_id}`);
                        const updatedList = exams.filter(e => e.exam_id !== exam.exam_id);
                        setExams(updatedList);
                        setFilteredExams(updatedList);
                        Alert.alert("Success", "Exam deleted.");
                    } catch (e) { Alert.alert("Error", "Failed to delete."); }
                    finally { setIsLoading(false); }
                }
            }
        ]);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={COLORS.background} />
            
            {/* Header Card */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                        <MaterialIcons name="assignment" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Exam Manager</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Create & Manage Exams</Text>
                    </View>
                </View>
                <TouchableOpacity style={[styles.headerBtn, { backgroundColor: COLORS.primary }]} onPress={onCreateNew}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.headerBtnText}>Add</Text>
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                <MaterialIcons name="search" size={22} color={COLORS.textSub} style={styles.searchIcon} />
                <TextInput 
                    style={[styles.searchInput, { color: COLORS.textMain }]} 
                    placeholder="Search exams..." 
                    placeholderTextColor={COLORS.placeholder} 
                    value={searchQuery} 
                    onChangeText={setSearchQuery} 
                />
            </View>

            <FlatList
                data={filteredExams}
                keyExtractor={(item) => item.exam_id.toString()}
                renderItem={({ item, index }) => (
                    <Animatable.View animation="fadeInUp" duration={600} delay={index * 100}>
                        <View style={[styles.card, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                            <View style={styles.cardHeaderRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.cardTitle, { color: COLORS.textMain }]} numberOfLines={2}>{item.title}</Text>
                                    <Text style={[styles.cardSubtitle, { color: COLORS.textSub }]}>For: {item.class_group}</Text>
                                </View>
                                <TouchableOpacity 
                                    onPress={() => handleMenuPress(item)} 
                                    style={styles.menuIcon}
                                    hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
                                >
                                    <MaterialIcons name="more-vert" size={26} color={COLORS.iconGrey} />
                                </TouchableOpacity>
                            </View>
                            
                            <View style={[styles.footerRow, { borderTopColor: COLORS.divider }]}>
                                <View style={[styles.badge, { backgroundColor: item.submission_count > 0 ? (isDark ? '#332b00' : '#fff3cd') : (isDark ? COLORS.inputBg : '#f8f9fa') }]}>
                                    <Text style={[styles.badgeText, { color: item.submission_count > 0 ? (isDark ? '#ffd700' : '#856404') : COLORS.textSub }]}>{item.submission_count} Submitted</Text>
                                </View>
                                <TouchableOpacity style={[styles.viewSubmissionsBtn, { backgroundColor: COLORS.primary }]} onPress={() => onViewSubmissions(item)}>
                                    <Text style={styles.viewSubmissionsBtnText}>View & Grade</Text>
                                    <MaterialIcons name="arrow-forward" size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Animatable.View>
                )}
                onRefresh={fetchExams}
                refreshing={isLoading}
                ListEmptyComponent={!isLoading ? <View style={styles.center}><Text style={[styles.emptyText, { color: COLORS.textSub }]}>No exams found.</Text></View> : null}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
            />
        </SafeAreaView>
    );
};

// --- View 2: Create OR Edit Exam ---
const CreateOrEditExamView = ({ examToEdit, onFinish }) => {
    const { user } = useAuth();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const isEditMode = !!examToEdit;
    
    // Initial State: Empty string by default, uses placeholders for hints
    const initialExamDetails = isEditMode ? { 
        title: examToEdit.title, 
        description: examToEdit.description || '', 
        class_group: examToEdit.class_group, 
        time_limit_mins: String(examToEdit.time_limit_mins || '0') 
    } : { 
        title: '', 
        description: '', 
        class_group: '', 
        time_limit_mins: '' 
    };

    // Start with 1 empty question template if creating new
    const initialQuestions = isEditMode ? [] : [{
        id: Date.now(),
        question_text: '', 
        question_type: 'multiple_choice',
        options: { A: '', B: '', C: '', D: '' },
        correct_answer: '',
        marks: '1'
    }];

    const [examDetails, setExamDetails] = useState(initialExamDetails);
    const [questions, setQuestions] = useState(initialQuestions);
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
                    setExamDetails({ 
                        title: data.title, 
                        description: data.description || '', 
                        class_group: data.class_group, 
                        time_limit_mins: String(data.time_limit_mins || '0') 
                    });
                    setQuestions(data.questions.map(q => ({ 
                        ...q, 
                        id: q.question_id, 
                        options: (q.options && typeof q.options === 'string') ? JSON.parse(q.options) : (q.options || {A:'', B:'', C:'', D:''}) 
                    })));
                }
            } catch (e) { 
                Alert.alert("Error", "Failed to load data.");
                if(isEditMode) onFinish();
            } finally { setIsLoading(false); }
        };
        bootstrapData();
    }, [isEditMode, examToEdit, onFinish]);

    const addQuestion = () => setQuestions([...questions, { id: Date.now(), question_text: '', question_type: 'multiple_choice', options: { A: '', B: '', C: '', D: '' }, correct_answer: '', marks: '1' }]);
    
    const handleQuestionChange = (id, field, value) => {
        setQuestions(questions.map(q => {
            if (q.id !== id) return q;
            let newQ = { ...q, [field]: value };
            if (field === 'question_type') {
                if (value !== 'multiple_choice') {
                    const { options, correct_answer, ...rest } = newQ;
                    return rest;
                } else {
                    newQ.options = { A: '', B: '', C: '', D: '' };
                    newQ.correct_answer = '';
                }
            }
            return newQ;
        }));
    };

    const handleOptionChange = (id, optionKey, value) => setQuestions(questions.map(q => (q.id === id ? { ...q, options: { ...q.options, [optionKey]: value } } : q)));
    const handleRemoveQuestion = (id) => setQuestions(questions.filter(q => q.id !== id));
    
    const handleSave = async () => {
        if (!user?.id) return Alert.alert("Error", "Session identification failed.");
        if (!examDetails.title || !examDetails.class_group || questions.length === 0) return Alert.alert('Error', 'Title, Class, and Questions are required.');
        setIsSaving(true);
        const sanitizedQuestions = questions.map(q => {
            const payload = { question_text: q.question_text, question_type: q.question_type, marks: parseInt(q.marks, 10) || 1 };
            if (q.question_type === 'multiple_choice') { payload.options = q.options; payload.correct_answer = q.correct_answer; }
            return payload;
        });
        const payload = { ...examDetails, questions: sanitizedQuestions, teacher_id: user.id };
        try {
            if (isEditMode) { await apiClient.put(`/exams/${examToEdit.exam_id}`, payload); } else { await apiClient.post('/exams', payload); }
            Alert.alert('Success', `Exam ${isEditMode ? 'updated' : 'created'}!`);
            onFinish();
        } catch (e) { Alert.alert('Error', "Failed to save exam."); } 
        finally { setIsSaving(false); }
    };

    if (isLoading) return <View style={[styles.center, { backgroundColor: COLORS.background }]}><ActivityIndicator size="large" color={COLORS.primary}/></View>;
    
    return ( 
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={onFinish} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>{isEditMode ? 'Edit Exam' : 'Create Exam'}</Text>
                    </View>
                </View>
            </View>

            <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 15, paddingBottom: 50}}>
                <View style={[styles.formSection, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                    <Text style={[styles.label, { color: COLORS.textSub }]}>Exam Title *</Text>
                    <TextInput 
                        style={[styles.input, { backgroundColor: COLORS.inputBg, color: COLORS.textMain, borderColor: COLORS.border }]} 
                        value={examDetails.title} 
                        onChangeText={t => setExamDetails({ ...examDetails, title: t })} 
                        placeholder="e.g. Weekly Science Quiz" // Placeholder Example
                        placeholderTextColor={COLORS.placeholder} 
                    />
                    
                    <Text style={[styles.label, { color: COLORS.textSub }]}>Description</Text>
                    <TextInput 
                        style={[styles.input, { backgroundColor: COLORS.inputBg, color: COLORS.textMain, borderColor: COLORS.border }]} 
                        value={examDetails.description} 
                        onChangeText={t => setExamDetails({ ...examDetails, description: t })} 
                        placeholder="e.g. Chapter 4 & 5 Revision" // Placeholder Example
                        placeholderTextColor={COLORS.placeholder} 
                    />

                    <Text style={[styles.label, { color: COLORS.textSub }]}>Class *</Text>
                    <View style={[styles.pickerContainer, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                        <Picker selectedValue={examDetails.class_group} onValueChange={v => setExamDetails({ ...examDetails, class_group: v })} style={{ color: COLORS.textMain }} dropdownIconColor={COLORS.textMain}>
                            <Picker.Item label="-- Select Class --" value="" color={COLORS.textMain} />
                            {studentClasses.map(c => <Picker.Item key={c} label={c} value={c} color={COLORS.textMain} />)}
                        </Picker>
                    </View>
                    
                    <Text style={[styles.label, { color: COLORS.textSub }]}>Time Limit (mins)</Text>
                    <TextInput 
                        style={[styles.input, { backgroundColor: COLORS.inputBg, color: COLORS.textMain, borderColor: COLORS.border }]} 
                        keyboardType="number-pad" 
                        value={examDetails.time_limit_mins} 
                        onChangeText={t => setExamDetails({ ...examDetails, time_limit_mins: t })} 
                        placeholder="e.g. 45" // Placeholder Example
                        placeholderTextColor={COLORS.placeholder} 
                    />
                </View>

                <Text style={[styles.headerTitleSecondary, { color: COLORS.textMain }]}>Questions</Text>
                
                {questions.map((q, index) => (
                    <View key={q.id} style={[styles.questionEditor, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                        <View style={styles.cardHeaderRow}>
                            <Text style={[styles.questionEditorTitle, { color: COLORS.textMain }]}>Question {index + 1}</Text>
                            <TouchableOpacity onPress={() => handleRemoveQuestion(q.id)}>
                                <MaterialIcons name="close" size={22} color={COLORS.danger} />
                            </TouchableOpacity>
                        </View>
                        
                        <TextInput 
                            style={[styles.input, { backgroundColor: COLORS.inputBg, color: COLORS.textMain, borderColor: COLORS.border }]} 
                            multiline 
                            placeholder="e.g. What is the chemical symbol for Water?" // Placeholder Example
                            placeholderTextColor={COLORS.placeholder} 
                            value={q.question_text} 
                            onChangeText={t => handleQuestionChange(q.id, 'question_text', t)} 
                        />
                        
                        <Text style={[styles.label, { color: COLORS.textSub }]}>Type</Text>
                        <View style={[styles.pickerContainer, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                            <Picker selectedValue={q.question_type} onValueChange={v => handleQuestionChange(q.id, 'question_type', v)} style={{ color: COLORS.textMain }} dropdownIconColor={COLORS.textMain}>
                                <Picker.Item label="Multiple Choice" value="multiple_choice" color={COLORS.textMain} />
                                <Picker.Item label="Written Answer" value="short_answer" color={COLORS.textMain} />
                            </Picker>
                        </View>
                        
                        {q.question_type === 'multiple_choice' && q.options && (<>
                            {Object.keys(q.options).map(key => (<TextInput key={key} style={[styles.input, { backgroundColor: COLORS.inputBg, color: COLORS.textMain, borderColor: COLORS.border }]} placeholder={`Option ${key}`} placeholderTextColor={COLORS.placeholder} value={q.options[key]} onChangeText={t => handleOptionChange(q.id, key, t)} />))}
                            <Text style={[styles.label, { color: COLORS.textSub }]}>Correct Answer</Text>
                            <View style={[styles.pickerContainer, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                                <Picker selectedValue={q.correct_answer} onValueChange={v => handleQuestionChange(q.id, 'correct_answer', v)} style={{ color: COLORS.textMain }} dropdownIconColor={COLORS.textMain}>
                                    <Picker.Item label="-- Select Correct --" value="" color={COLORS.textMain} />
                                    {Object.keys(q.options).map(key => q.options[key] && <Picker.Item key={key} label={`Option ${key}`} value={key} color={COLORS.textMain} />)}
                                </Picker>
                            </View>
                        </>)}

                        <Text style={[styles.label, { color: COLORS.textSub }]}>Marks</Text>
                        <TextInput style={[styles.input, { backgroundColor: COLORS.inputBg, color: COLORS.textMain, borderColor: COLORS.border }]} keyboardType="number-pad" value={String(q.marks)} onChangeText={t => handleQuestionChange(q.id, 'marks', t)} />
                    </View>
                ))}
                
                <TouchableOpacity style={[styles.addQuestionBtn, { backgroundColor: isDark ? '#333' : '#E8EAF6' }]} onPress={addQuestion}>
                    <Text style={[styles.addQuestionBtnText, { color: COLORS.blue }]}>+ Add Question</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: COLORS.success }]} onPress={handleSave} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{isEditMode ? 'Save Changes' : 'Publish Exam'}</Text>}
                </TouchableOpacity>
            </ScrollView> 
        </SafeAreaView> 
    );
};

// --- View 3: Submissions View ---
const SubmissionsView = ({ exam, onBack }) => {
    const { user } = useAuth();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const [submissions, setSubmissions] = useState([]);
    const [filteredSubmissions, setFilteredSubmissions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [gradingSubmission, setGradingSubmission] = useState(null);
    const [submissionDetails, setSubmissionDetails] = useState([]);
    const [gradedAnswers, setGradedAnswers] = useState({});
    const [isSubmittingGrade, setIsSubmittingGrade] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchSubmissions = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/exams/${exam.exam_id}/submissions`);
            setSubmissions(response.data);
            setFilteredSubmissions(response.data);
        } catch (e) { Alert.alert('Error', 'Failed to fetch submissions.'); } 
        finally { setIsLoading(false); }
    }, [exam.exam_id]);

    useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

    // Handle Search
    useEffect(() => {
        const query = searchQuery.toLowerCase();
        const filtered = submissions.filter(s => 
            s.student_name.toLowerCase().includes(query) || 
            (s.roll_no && s.roll_no.toLowerCase().includes(query))
        );
        setFilteredSubmissions(filtered);
    }, [searchQuery, submissions]);

    const openGradingModal = async (submission) => {
        setIsLoading(true);
        setGradingSubmission(submission);
        try {
            const response = await apiClient.get(`/submissions/${submission.attempt_id}`);
            let details = response.data.map(item => ({...item, options: (item.options && typeof item.options === 'string') ? JSON.parse(item.options) : item.options}));
            setSubmissionDetails(details);
            const initialGrades = details.reduce((acc, item) => ({ ...acc, [item.question_id]: item.marks_awarded || '' }), {});
            setGradedAnswers(initialGrades);
        } catch (e) { Alert.alert('Error', 'Could not fetch submission.'); setGradingSubmission(null); } 
        finally { setIsLoading(false); }
    };

    const submitGrade = async () => {
        if (!user?.id) return Alert.alert('Error', 'Session error.');
        setIsSubmittingGrade(true);
        const answersPayload = Object.entries(gradedAnswers).map(([qid, marks]) => ({ question_id: qid, marks_awarded: marks || 0 }));
        try {
            await apiClient.post(`/submissions/${gradingSubmission.attempt_id}/grade`, { gradedAnswers: answersPayload, teacher_feedback: '', teacher_id: user.id });
            Alert.alert('Success', 'Grades submitted!');
            setGradingSubmission(null);
            fetchSubmissions();
        } catch (e) { Alert.alert('Error', "Failed to submit grade."); } 
        finally { setIsSubmittingGrade(false); }
    };
    
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={onBack} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Submissions</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]} numberOfLines={1}>{exam.title}</Text>
                    </View>
                </View>
            </View>

            <View style={[styles.searchContainer, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                <MaterialIcons name="search" size={22} color={COLORS.textSub} style={styles.searchIcon} />
                <TextInput style={[styles.searchInput, { color: COLORS.textMain }]} placeholder="Search by name..." placeholderTextColor={COLORS.placeholder} value={searchQuery} onChangeText={setSearchQuery} />
            </View>

            <FlatList
                data={filteredSubmissions}
                keyExtractor={(item) => item.attempt_id.toString()}
                renderItem={({ item }) => (
                    <View style={[styles.card, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                        <View style={styles.cardHeaderRow}>
                            <Text style={[styles.cardTitle, { color: COLORS.textMain }]} numberOfLines={1}>{item.roll_no ? `(${item.roll_no}) ` : ''}{item.student_name}</Text>
                            {item.grade && <View style={[styles.gradeBadge, { backgroundColor: COLORS.blue }]}><Text style={styles.gradeBadgeText}>{item.grade}</Text></View>}
                        </View>
                        <Text style={[styles.cardDetail, { color: COLORS.textSub }]}>Status: <Text style={{fontWeight: 'bold', color: item.status === 'graded' ? COLORS.success : COLORS.textSub}}>{item.status}</Text></Text>
                        <TouchableOpacity style={[styles.gradeButton, { backgroundColor: isDark ? '#333' : '#FFC107' }]} onPress={() => openGradingModal(item)}><Text style={{ color: isDark ? '#fff' : '#212529', fontWeight: 'bold' }}>{item.status === 'graded' ? 'Update Grade' : 'Grade Now'}</Text></TouchableOpacity>
                    </View>
                )}
                onRefresh={fetchSubmissions}
                refreshing={isLoading}
                ListEmptyComponent={!isLoading ? <View style={styles.center}><Text style={[styles.emptyText, { color: COLORS.textSub }]}>No submissions yet.</Text></View> : null}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
            />
            
            <Modal visible={!!gradingSubmission} onRequestClose={() => setGradingSubmission(null)} animationType="slide">
                <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
                    <ScrollView style={{ padding: 20 }}>
                        <Text style={[styles.modalTitle, { color: COLORS.textMain }]}>Grading: {gradingSubmission?.student_name}</Text>
                        {isLoading ? <ActivityIndicator size="large" color={COLORS.primary} /> : submissionDetails.map((item, index) => (
                            <View key={item.question_id} style={[styles.gradingItem, { borderBottomColor: COLORS.border }]}>
                                <Text style={[styles.questionText, { color: COLORS.textMain }]}>{index + 1}. {item.question_text}</Text>
                                <Text style={[styles.studentAnswer, { backgroundColor: isDark ? '#222' : '#F0F0F0', color: COLORS.textMain }]}>Answer: {item.answer_text || 'None'}</Text>
                                <TextInput style={[styles.input, { backgroundColor: COLORS.inputBg, color: COLORS.textMain, borderColor: COLORS.border }]} keyboardType="number-pad" placeholder={`Max Marks: ${item.marks}`} placeholderTextColor={COLORS.placeholder} value={String(gradedAnswers[item.question_id] ?? '')} onChangeText={text => setGradedAnswers({...gradedAnswers, [item.question_id]: text})} />
                            </View>
                        ))}
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setGradingSubmission(null)}><Text style={styles.modalBtnText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.success }]} onPress={submitGrade} disabled={isSubmittingGrade}><Text style={styles.modalBtnText}>Submit</Text></TouchableOpacity>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

// Styles
const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Header
    headerCard: { paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },
    headerBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    
    // Card
    card: { borderRadius: 12, marginBottom: 15, padding: 15, elevation: 2, shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    menuIcon: { padding: 4 },
    cardTitle: { fontSize: 16, fontWeight: 'bold' },
    cardSubtitle: { fontSize: 13, marginTop: 4 },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
    viewSubmissionsBtn: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', gap: 5 },
    viewSubmissionsBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    badge: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
    badgeText: { fontSize: 11, fontWeight: 'bold' },
    
    // Forms
    formSection: { padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 5, marginTop: 10 },
    input: { borderWidth: 1, padding: 12, borderRadius: 10, fontSize: 15, marginBottom: 10 },
    pickerContainer: { borderWidth: 1, borderRadius: 10, marginBottom: 15, overflow: 'hidden', justifyContent: 'center' },
    questionEditor: { borderWidth: 1, borderRadius: 12, padding: 15, marginVertical: 10 },
    questionEditorTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 10 },
    headerTitleSecondary: { fontSize: 18, fontWeight: 'bold', marginTop: 10 },
    addQuestionBtn: { padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10, marginBottom: 20 },
    addQuestionBtnText: { fontWeight: 'bold', fontSize: 14 },
    saveButton: { padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 30 },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    
    // Search
    searchContainer: { flexDirection: 'row', borderRadius: 10, marginHorizontal: 15, marginBottom: 15, alignItems: 'center', paddingHorizontal: 10, borderWidth: 1, height: 45 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, height: 45, fontSize: 15 },
    cardDetail: { fontSize: 13, marginTop: 2 },
    
    // Grading
    gradeButton: { marginTop: 12, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    gradeBadge: { flexDirection: 'row', borderRadius: 12, paddingVertical: 2, paddingHorizontal: 8, alignItems: 'center' },
    gradeBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    gradingItem: { marginVertical: 10, borderBottomWidth: 1, paddingBottom: 15 },
    questionText: { fontSize: 15, fontWeight: '600' },
    studentAnswer: { fontStyle: 'italic', marginVertical: 8, padding: 10, borderRadius: 8 },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 40 },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
    modalBtnText: { color: '#fff', fontWeight: 'bold' },
    cancelBtn: { backgroundColor: '#6c757d' },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 15 },
});

export default TeacherAdminExamsScreen;