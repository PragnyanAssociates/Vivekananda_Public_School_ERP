import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity,
    Alert, Modal, TextInput, ScrollView, Linking, LayoutAnimation,
    UIManager, Platform, SafeAreaView, useColorScheme, StatusBar, Dimensions, Image
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import { pick, types, isCancel } from '@react-native-documents/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Animatable from 'react-native-animatable';
import Pdf from 'react-native-pdf';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';

const { width, height } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- THEME CONFIGURATION ---
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
    modalOverlay: 'rgba(0,0,0,0.6)',
    placeholder: '#B0BEC5',
    divider: '#f0f2f5',
    tabActive: '#008080',
    tabInactive: '#ECEFF1',
    viewerBg: '#000000'
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
    modalOverlay: 'rgba(255,255,255,0.1)',
    placeholder: '#616161',
    divider: '#2C2C2C',
    tabActive: '#004D40',
    tabInactive: '#424242',
    viewerBg: '#000000'
};

// --- HELPER: Date Format DD/MM/YYYY ---
const formatDateDisplay = (isoDateString) => {
    if (!isoDateString) return '';
    const d = new Date(isoDateString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

// --- MAIN SCREEN ---
const TeacherAdminHomeworkScreen = () => {
    const [view, setView] = useState('assignments');
    const [selectedAssignment, setSelectedAssignment] = useState(null);

    const viewSubmissions = (assignment) => {
        setSelectedAssignment(assignment);
        setView('submissions');
    };
    const backToAssignments = () => {
        setSelectedAssignment(null);
        setView('assignments');
    };

    if (view === 'assignments') {
        return <AssignmentList onSelectAssignment={viewSubmissions} />;
    }
    if (view === 'submissions' && selectedAssignment) {
        return <SubmissionList assignment={selectedAssignment} onBack={backToAssignments} />;
    }
    return null;
};

// --- ASSIGNMENT LIST COMPONENT ---
const AssignmentList = ({ onSelectAssignment }) => {
    const { user } = useAuth();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const [assignments, setAssignments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState(null);
    const [studentClasses, setStudentClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [dateObject, setDateObject] = useState(new Date());

    const initialAssignmentState = { title: '', description: '', due_date: '', homework_type: 'PDF' };
    const [newAssignment, setNewAssignment] = useState(initialAssignmentState);
    
    // --- Questions State ---
    const [questionsList, setQuestionsList] = useState(['']); // Start with one empty question

    const [attachments, setAttachments] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    const fetchTeacherAssignments = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/homework/teacher/${user.id}`);
            // Check if response.data is array to avoid crashes
            setAssignments(Array.isArray(response.data) ? response.data : []);
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to fetch assignments.");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const fetchStudentClasses = async () => {
        try {
            const response = await apiClient.get('/student-classes');
            setStudentClasses(response.data);
        } catch (e) {
            console.error("Error classes:", e);
        }
    };

    useEffect(() => {
        fetchTeacherAssignments();
        fetchStudentClasses();
    }, [fetchTeacherAssignments]);

    const handleClassChange = async (classGroup) => {
        setSelectedClass(classGroup);
        setSubjects([]);
        setSelectedSubject('');
        if (classGroup) {
            try {
                const response = await apiClient.get(`/subjects-for-class/${classGroup}`);
                setSubjects(response.data);
                return response.data;
            } catch (e) { return []; }
        }
        return [];
    };

    const handleDateChange = (event, selectedDate) => {
        setShowDatePicker(Platform.OS === 'ios'); 
        if (selectedDate) {
            setShowDatePicker(false);
            setDateObject(selectedDate);
            setNewAssignment({ ...newAssignment, due_date: selectedDate.toISOString().split('T')[0] });
        } else { setShowDatePicker(false); }
    };

    // --- Question Handlers ---
    const addQuestionField = () => {
        setQuestionsList([...questionsList, '']);
    };

    const removeQuestionField = (index) => {
        const updatedList = questionsList.filter((_, i) => i !== index);
        setQuestionsList(updatedList);
    };

    const updateQuestionText = (text, index) => {
        const updatedList = [...questionsList];
        updatedList[index] = text;
        setQuestionsList(updatedList);
    };

    const openCreateModal = () => {
        setEditingAssignment(null);
        setNewAssignment(initialAssignmentState);
        setQuestionsList(['']); // Reset to one empty question
        setSelectedClass('');
        setSelectedSubject('');
        setSubjects([]);
        setAttachments([]);
        setDateObject(new Date()); 
        setIsModalVisible(true);
    };

    const openEditModal = async (assignment) => {
        setEditingAssignment(assignment);
        const date = new Date(assignment.due_date);
        setDateObject(date); 
        
        // Parse existing questions safely
        let parsedQuestions = [''];
        try {
            if (assignment.questions) {
                const parsed = JSON.parse(assignment.questions);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    parsedQuestions = parsed;
                }
            }
        } catch (e) { 
            console.log("Error parsing questions JSON, resetting to empty", e); 
            // If parsing fails (e.g. old data text), maybe treat it as one question?
            // For now, reset to empty to prevent crash
        }

        setNewAssignment({ 
            title: assignment.title, 
            description: assignment.description || '', 
            due_date: date.toISOString().split('T')[0], 
            homework_type: assignment.homework_type || 'PDF' 
        });
        setQuestionsList(parsedQuestions);
        setAttachments([]); 
        await handleClassChange(assignment.class_group);
        setSelectedSubject(assignment.subject);
        setIsModalVisible(true);
    };

    const handleMenuPress = (assignment) => {
        Alert.alert(
            "Manage Assignment",
            `Options for "${assignment.title}"`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Edit", onPress: () => openEditModal(assignment) },
                { text: "Delete", style: "destructive", onPress: () => handleDelete(assignment) }
            ]
        );
    };

    const handleDelete = (assignment) => {
        Alert.alert("Confirm Delete", "Delete this assignment?", [{ text: "Cancel", style: 'cancel' }, {
            text: "Delete",
            style: 'destructive',
            onPress: async () => {
                try {
                    await apiClient.delete(`/homework/${assignment.id}`);
                    fetchTeacherAssignments();
                } catch (e) { Alert.alert("Error", "Failed to delete."); }
            }
        }]);
    };

    const selectAttachment = async () => {
        try {
            const results = await pick({ type: [types.allFiles], allowMultiSelection: true });
            if (results) {
                setAttachments(prev => [...prev, ...results]);
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            }
        } catch (err) { if (!isCancel(err)) Alert.alert('Error', 'File picker error.'); }
    };

    const handleSave = async () => {
        if (!user || !selectedClass || !selectedSubject || !newAssignment.title || !newAssignment.due_date) {
            return Alert.alert("Validation Error", "Please fill required fields.");
        }
        
        // Filter empty questions, but allow saving if at least description is there or one question
        const validQuestions = questionsList.filter(q => q.trim() !== '');
        
        setIsSaving(true);
        const data = new FormData();
        data.append('title', newAssignment.title);
        data.append('description', newAssignment.description || ''); // Can be empty if questions exist
        data.append('due_date', newAssignment.due_date);
        data.append('class_group', selectedClass);
        data.append('subject', selectedSubject);
        data.append('homework_type', newAssignment.homework_type);
        // Important: Serialize array to string for backend
        data.append('questions', JSON.stringify(validQuestions)); 

        if (!editingAssignment) data.append('teacher_id', user.id);

        attachments.forEach((file) => {
            data.append('attachments', { uri: file.uri, type: file.type, name: file.name });
        });

        try {
            const url = editingAssignment ? `/homework/update/${editingAssignment.id}` : '/homework';
            await apiClient.post(url, data, { headers: { 'Content-Type': 'multipart/form-data' } });
            setIsModalVisible(false);
            fetchTeacherAssignments();
        } catch (e) { 
            console.error("Save Error:", e.response?.data || e.message);
            Alert.alert("Error", "Failed to save assignment."); 
        } finally { setIsSaving(false); }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
            
            {/* Header Card */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                        <MaterialIcons name="assignment" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Homework</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Manage Assignments</Text>
                    </View>
                </View>
                <TouchableOpacity style={[styles.headerBtn, { backgroundColor: COLORS.primary }]} onPress={openCreateModal}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.headerBtnText}>Add</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={assignments}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item, index }) => (
                    <Animatable.View animation="fadeInUp" duration={500} delay={index * 50}>
                        <View style={[styles.card, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                            <View style={styles.cardHeaderRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.cardTitle, { color: COLORS.textMain }]} numberOfLines={2}>{item.title}</Text>
                                    <Text style={[styles.cardSubtitle, { color: COLORS.textSub }]}>{item.class_group} • {item.subject}</Text>
                                    <View style={[styles.typeBadge, { backgroundColor: isDark ? COLORS.inputBg : '#E0F7FA' }]}>
                                        <Text style={[styles.typeBadgeText, { color: COLORS.primary }]}>{item.homework_type}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => handleMenuPress(item)} style={styles.menuIcon} hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}>
                                    <MaterialIcons name="more-vert" size={26} color={COLORS.iconGrey} />
                                </TouchableOpacity>
                            </View>
                            
                            <View style={[styles.divider, { backgroundColor: COLORS.divider }]} />
                            
                            <Text style={[styles.cardDetail, { color: COLORS.textSub }]}>Due: {formatDateDisplay(item.due_date)}</Text>
                            <View style={styles.footerRow}>
                                <View style={[styles.submissionBadge, { backgroundColor: item.submission_count > 0 ? (isDark ? '#332b00' : '#fff3cd') : (isDark ? COLORS.inputBg : '#f8f9fa') }]}>
                                    <Text style={[styles.submissionBadgeText, { color: item.submission_count > 0 ? (isDark ? '#ffd700' : '#856404') : COLORS.textSub }]}>{item.submission_count} Submitted</Text>
                                </View>
                                <TouchableOpacity style={[styles.viewSubmissionsBtn, { backgroundColor: COLORS.primary }]} onPress={() => onSelectAssignment(item)}>
                                    <Text style={styles.viewSubmissionsBtnText}>View & Grade</Text>
                                    <MaterialIcons name="arrow-forward" size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Animatable.View>
                )}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
                ListEmptyComponent={<View style={styles.center}><Text style={[styles.emptyText, { color: COLORS.textSub }]}>No assignments found.</Text></View>}
                onRefresh={fetchTeacherAssignments}
                refreshing={isLoading}
            />

            <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} animationType="slide">
                <SafeAreaView style={{flex: 1, backgroundColor: COLORS.background}}>
                    <View style={[styles.modalHeaderBar, { backgroundColor: COLORS.cardBg, borderBottomColor: COLORS.divider }]}>
                        <Text style={[styles.modalFormTitle, { color: COLORS.textMain }]}>{editingAssignment ? 'Edit Assignment' : 'New Assignment'}</Text>
                        <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                            <MaterialIcons name="close" size={24} color={COLORS.textMain} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.modalView} contentContainerStyle={{ paddingBottom: 50 }}>
                        <Text style={[styles.label, { color: COLORS.textSub }]}>Homework Type *</Text>
                        <View style={[styles.pickerContainer, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                            <Picker selectedValue={newAssignment.homework_type} onValueChange={(v) => setNewAssignment({ ...newAssignment, homework_type: v })} style={{ color: COLORS.textMain }} dropdownIconColor={COLORS.textMain}>
                                <Picker.Item label="PDF / File Upload" value="PDF" color={COLORS.textMain} />
                                <Picker.Item label="Written / Text Answer" value="Written" color={COLORS.textMain} />
                            </Picker>
                        </View>
                        
                        <Text style={[styles.label, { color: COLORS.textSub }]}>Class *</Text>
                        <View style={[styles.pickerContainer, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                            <Picker selectedValue={selectedClass} onValueChange={handleClassChange} style={{ color: COLORS.textMain }} dropdownIconColor={COLORS.textMain}>
                                <Picker.Item label="-- Select --" value="" color={COLORS.textMain} />
                                {studentClasses.map(c => <Picker.Item key={c} label={c} value={c} color={COLORS.textMain} />)}
                            </Picker>
                        </View>
                        
                        <Text style={[styles.label, { color: COLORS.textSub }]}>Subject *</Text>
                        <View style={[styles.pickerContainer, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                            <Picker selectedValue={selectedSubject} onValueChange={setSelectedSubject} style={{ color: COLORS.textMain }} dropdownIconColor={COLORS.textMain}>
                                <Picker.Item label="-- Select --" value="" color={COLORS.textMain} />
                                {subjects.map(s => <Picker.Item key={s} label={s} value={s} color={COLORS.textMain} />)}
                            </Picker>
                        </View>
                        
                        <Text style={[styles.label, { color: COLORS.textSub }]}>Title *</Text>
                        <TextInput style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} placeholder="Title" placeholderTextColor={COLORS.placeholder} value={newAssignment.title} onChangeText={t => setNewAssignment({ ...newAssignment, title: t })} />
                        
                        {/* --- DESCRIPTION / INSTRUCTIONS SECTION --- */}
                        <Text style={[styles.label, { color: COLORS.textSub }]}>Description / General Instructions :</Text>
                        <TextInput 
                            style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain, height: 80, textAlignVertical: 'top' }]} 
                            placeholder="Enter general description..." 
                            placeholderTextColor={COLORS.placeholder} 
                            multiline 
                            value={newAssignment.description} 
                            onChangeText={t => setNewAssignment({ ...newAssignment, description: t })} 
                        />

                        {/* --- DYNAMIC QUESTIONS SECTION --- */}
                        <Text style={[styles.label, { color: COLORS.textSub }]}>Exam Questions :</Text>
                        <View style={{ marginBottom: 15 }}>
                            {questionsList.map((question, index) => (
                                <View key={index} style={[styles.questionRow, { borderColor: COLORS.border }]}>
                                    <Text style={{color: COLORS.primary, fontWeight: 'bold', marginRight: 8, marginTop: 12}}>Q{index + 1}.</Text>
                                    <TextInput 
                                        style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain, textAlignVertical: 'top', height: 60 }]} 
                                        placeholder={`Enter question ${index + 1}`}
                                        placeholderTextColor={COLORS.placeholder} 
                                        multiline 
                                        value={question} 
                                        onChangeText={(text) => updateQuestionText(text, index)} 
                                    />
                                    {/* Show remove button only if there is more than one question */}
                                    {questionsList.length > 1 && (
                                        <TouchableOpacity onPress={() => removeQuestionField(index)} style={{ marginLeft: 8, marginTop: 10 }}>
                                            <MaterialIcons name="remove-circle-outline" size={24} color={COLORS.danger} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                            
                            <TouchableOpacity style={[styles.addQuestionBtn, { borderColor: COLORS.primary }]} onPress={addQuestionField}>
                                <MaterialIcons name="add-circle-outline" size={24} color={COLORS.primary} />
                                <Text style={{ color: COLORS.primary, fontWeight: 'bold', marginLeft: 8 }}>Add Another Question</Text>
                            </TouchableOpacity>
                        </View>
                        {/* --- END QUESTIONS SECTION --- */}

                        <Text style={[styles.label, { color: COLORS.textSub }]}>Due Date *</Text>
                        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.datePickerInput, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                            <Text style={{ color: newAssignment.due_date ? COLORS.textMain : COLORS.placeholder }}>{newAssignment.due_date ? formatDateDisplay(newAssignment.due_date) : "Select Date"}</Text>
                            <MaterialIcons name="event" size={20} color={COLORS.textSub} />
                        </TouchableOpacity>
                        {showDatePicker && <DateTimePicker value={dateObject} mode="date" display="default" onChange={handleDateChange} minimumDate={new Date()} />}
                        
                        <View style={styles.attachmentSection}>
                            <TouchableOpacity style={[styles.uploadButton, { backgroundColor: COLORS.blue }]} onPress={selectAttachment}>
                                <MaterialIcons name="attach-file" size={20} color="#fff" /><Text style={styles.uploadButtonText}>Add Attachments</Text>
                            </TouchableOpacity>
                            {attachments.map((file, idx) => (
                                <View key={idx} style={[styles.fileItem, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                                    <Text style={[styles.fileName, { color: COLORS.textMain }]} numberOfLines={1}>{file.name}</Text>
                                    <TouchableOpacity onPress={() => setAttachments(attachments.filter((_, i) => i !== idx))}><MaterialIcons name="close" size={20} color={COLORS.danger} /></TouchableOpacity>
                                </View>
                            ))}
                        </View>
                        
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.border }]} onPress={() => setIsModalVisible(false)}><Text style={{ color: COLORS.textMain, fontWeight: 'bold' }}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.success }]} onPress={handleSave} disabled={isSaving}>{isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>{editingAssignment ? 'Save' : 'Create'}</Text>}</TouchableOpacity>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

// --- SUBMISSION LIST COMPONENT ---
const SubmissionList = ({ assignment, onBack }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const [studentRoster, setStudentRoster] = useState([]);
    const [filteredRoster, setFilteredRoster] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [gradeData, setGradeData] = useState({ grade: '', remarks: '' });
    const [isGrading, setIsGrading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('All'); 
    const [isViewerVisible, setIsViewerVisible] = useState(false);
    const [currentFile, setCurrentFile] = useState({ uri: '', type: '', name: '' });
    const [submissionFiles, setSubmissionFiles] = useState([]);

    const fetchStudentRoster = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/homework/submissions/${assignment.id}`);
            setStudentRoster(response.data);
            setFilteredRoster(response.data);
        } catch (e) { Alert.alert("Error", "Failed to fetch roster."); } 
        finally { setIsLoading(false); }
    }, [assignment.id]);

    useEffect(() => { fetchStudentRoster(); }, [fetchStudentRoster]);

    useEffect(() => {
        let result = studentRoster;
        if (activeTab === 'Submitted') {
            result = result.filter(item => item.submission_id);
        } else if (activeTab === 'Pending') {
            result = result.filter(item => !item.submission_id);
        }
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(i => i.student_name.toLowerCase().includes(query) || (i.roll_no && i.roll_no.includes(query)));
        }
        setFilteredRoster(result);
    }, [searchQuery, activeTab, studentRoster]);

    const handleGrade = async () => {
        if (!selectedStudent?.submission_id) return;
        setIsGrading(true);
        try {
            await apiClient.put(`/homework/grade/${selectedStudent.submission_id}`, gradeData);
            Alert.alert("Success", "Graded!");
            setSelectedStudent(null);
            fetchStudentRoster();
        } catch (e) { Alert.alert("Error", "Grading failed."); } 
        finally { setIsGrading(false); }
    };

    const openDocumentViewer = (file) => {
        if (file.type === 'unknown') {
            Alert.alert('Cannot View', 'This file type is not supported for in-app viewing.', [
                { text: 'Open Externally', onPress: () => Linking.openURL(file.uri) },
                { text: 'Cancel', style: 'cancel' }
            ]);
        } else {
            setCurrentFile(file);
            setIsViewerVisible(true);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={onBack} style={{marginRight: 10, padding: 4}}><MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} /></TouchableOpacity>
                    <View>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain, fontSize: 18 }]}>Submissions</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]} numberOfLines={1}>{assignment.title}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.tabContainer}>
                {['All', 'Submitted', 'Pending'].map((tab) => (
                    <TouchableOpacity 
                        key={tab} 
                        style={[styles.tabButton, { backgroundColor: activeTab === tab ? COLORS.primary : COLORS.inputBg, borderColor: COLORS.border }]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, { color: activeTab === tab ? '#fff' : COLORS.textMain }]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={[styles.searchContainer, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                <MaterialIcons name="search" size={22} color={COLORS.textSub} />
                <TextInput style={[styles.searchInput, { color: COLORS.textMain }]} placeholder="Search student..." placeholderTextColor={COLORS.placeholder} value={searchQuery} onChangeText={setSearchQuery} />
            </View>

            <FlatList
                data={filteredRoster}
                keyExtractor={(item) => item.student_id.toString()}
                renderItem={({ item }) => (
                    <TouchableOpacity style={[styles.card, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]} onPress={() => { 
                        setSelectedStudent(item); 
                        setGradeData({ grade: item.grade || '', remarks: item.remarks || '' });
                        let files = [];
                        if (item.submission_path) {
                            try {
                                files = JSON.parse(item.submission_path);
                                if (!Array.isArray(files)) files = [files];
                            } catch (e) { files = [item.submission_path]; }
                        }
                        setSubmissionFiles(files.map(path => {
                            const url = `${SERVER_URL}${path}`;
                            const extension = path.split('.').pop().toLowerCase();
                            let type = 'unknown';
                            if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) type = 'image';
                            else if (extension === 'pdf') type = 'pdf';
                            return { uri: url, type, name: path.split('/').pop() };
                        }));
                    }}>
                        <View style={styles.cardHeaderRow}>
                            <Text style={[styles.cardTitle, { color: COLORS.textMain }]}>{item.roll_no ? `(${item.roll_no}) ` : ''}{item.student_name}</Text>
                            {item.grade && <View style={[styles.gradeBadge, { backgroundColor: COLORS.blue }]}><Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{item.grade}</Text></View>}
                        </View>
                        <View style={styles.submittedContainer}>
                            <MaterialIcons name={item.submission_id ? "check-circle" : "cancel"} size={18} color={item.submission_id ? COLORS.success : COLORS.iconGrey}/>
                            <Text style={[styles.submittedText, { color: item.submission_id ? COLORS.success : COLORS.textSub }]}>{item.submission_id ? `Submitted: ${formatDateDisplay(item.submitted_at)}` : "Not Submitted"}</Text>
                        </View>
                    </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
                ListEmptyComponent={<View style={styles.center}><Text style={{ color: COLORS.textSub, marginTop: 20 }}>No students found.</Text></View>}
            />

            <Modal visible={!!selectedStudent} onRequestClose={() => setSelectedStudent(null)} animationType="slide">
                <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
                    <View style={[styles.modalHeaderBar, { backgroundColor: COLORS.cardBg, borderBottomColor: COLORS.divider }]}>
                        <Text style={[styles.modalFormTitle, { color: COLORS.textMain }]}>Submission</Text>
                        <TouchableOpacity onPress={() => setSelectedStudent(null)}><MaterialIcons name="close" size={24} color={COLORS.textMain} /></TouchableOpacity>
                    </View>
                    <ScrollView style={{ padding: 20 }}>
                        <Text style={[styles.modalStudentName, { color: COLORS.textMain }]}>{selectedStudent?.student_name}</Text>
                        {selectedStudent?.submission_id ? (
                            <>
                                <Text style={[styles.label, { color: COLORS.textSub }]}>Content</Text>
                                {assignment.homework_type === 'Written' ? (
                                    <View style={[styles.writtenAnswerContainer, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                                        <Text style={{ color: COLORS.textSub, marginBottom: 5, fontSize: 12, fontStyle: 'italic' }}>Student Answer:</Text>
                                        <Text style={{ color: COLORS.textMain, lineHeight: 22, fontSize: 15 }}>{selectedStudent.written_answer || "No text answer provided."}</Text>
                                    </View>
                                ) : (
                                    <View style={styles.fileListContainer}>
                                        {submissionFiles.map((file, index) => (
                                            <TouchableOpacity key={index} style={[styles.fileItem, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]} onPress={() => openDocumentViewer(file)}>
                                                <MaterialIcons name={file.type === 'image' ? 'image' : file.type === 'pdf' ? 'picture-as-pdf' : 'insert-drive-file'} size={24} color={COLORS.primary} />
                                                <Text style={[styles.fileName, { color: COLORS.textMain }]} numberOfLines={1}>{file.name}</Text>
                                                <MaterialIcons name="visibility" size={20} color={COLORS.iconGrey} />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                                <View style={[styles.divider, { backgroundColor: COLORS.divider, marginVertical: 20 }]} />
                                <Text style={[styles.label, { color: COLORS.textSub }]}>Grade</Text>
                                <TextInput style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} value={gradeData.grade} onChangeText={t => setGradeData({...gradeData, grade: t})} placeholder="e.g., A, 9/10" placeholderTextColor={COLORS.placeholder} />
                                <Text style={[styles.label, { color: COLORS.textSub }]}>Remarks</Text>
                                <TextInput style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain, height: 80 }]} multiline value={gradeData.remarks} onChangeText={t => setGradeData({...gradeData, remarks: t})} placeholder="Feedback for student..." placeholderTextColor={COLORS.placeholder} />
                                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.success, marginTop: 15 }]} onPress={handleGrade}>{isGrading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>Submit Grade</Text>}</TouchableOpacity>
                            </>
                        ) : <View style={styles.center}><Text style={{ color: COLORS.textSub, marginTop: 20 }}>No submission yet.</Text></View>}
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            <Modal visible={isViewerVisible} onRequestClose={() => setIsViewerVisible(false)} animationType="fade" transparent={true}>
                <View style={[styles.viewerModalContainer, { backgroundColor: COLORS.viewerBg }]}>
                    <SafeAreaView style={styles.viewerSafeArea}>
                        <View style={[styles.viewerHeader, { backgroundColor: COLORS.cardBg, borderBottomColor: COLORS.divider }]}>
                            <Text style={[styles.viewerTitle, { color: COLORS.textMain }]} numberOfLines={1}>{currentFile.name}</Text>
                            <TouchableOpacity onPress={() => setIsViewerVisible(false)} style={styles.closeViewerBtn}>
                                <MaterialIcons name="close" size={24} color={COLORS.textMain} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.viewerContent}>
                            {currentFile.type === 'pdf' && (
                                <Pdf source={{ uri: currentFile.uri, cache: true }} style={styles.pdfView} onError={(error) => Alert.alert('Error', 'Could not load PDF.')} />
                            )}
                            {currentFile.type === 'image' && (
                                <Image source={{ uri: currentFile.uri }} style={styles.imageView} resizeMode="contain" />
                            )}
                        </View>
                    </SafeAreaView>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { alignItems: 'center', justifyContent: 'center' },
    
    // Header
    headerCard: { paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },
    headerBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    // Tabs
    tabContainer: { flexDirection: 'row', paddingHorizontal: 15, marginBottom: 10, justifyContent: 'space-between' },
    tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', marginHorizontal: 4, borderRadius: 20, borderWidth: 1 },
    tabText: { fontWeight: 'bold', fontSize: 13 },

    // Card
    card: { borderRadius: 12, marginBottom: 15, padding: 15, elevation: 2, shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    menuIcon: { padding: 4 },
    cardTitle: { fontSize: 16, fontWeight: 'bold' },
    cardSubtitle: { fontSize: 13, marginTop: 4 },
    typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 5 },
    typeBadgeText: { fontSize: 10, fontWeight: 'bold' },
    divider: { height: 1, marginVertical: 10 },
    cardDetail: { fontSize: 12, marginTop: 2 },
    
    // Footer Actions
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
    viewSubmissionsBtn: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', gap: 5 },
    viewSubmissionsBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    submissionBadge: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
    submissionBadgeText: { fontSize: 11, fontWeight: 'bold' },
    gradeBadge: { borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 },

    // Modal
    modalHeaderBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
    modalView: { flex: 1, padding: 20 },
    modalFormTitle: { fontSize: 20, fontWeight: 'bold' },
    pickerContainer: { borderWidth: 1, borderRadius: 8, marginBottom: 15, overflow: 'hidden', justifyContent: 'center' },
    attachmentSection: { marginTop: 10, marginBottom: 20 },
    uploadButton: { flexDirection: 'row', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    uploadButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 },
    fileItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1 },
    fileName: { flex: 1, fontSize: 14, marginRight: 10, marginLeft: 10 },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
    modalBtn: { paddingVertical: 14, borderRadius: 8, alignItems: 'center', flex: 1, justifyContent: 'center' },
    datePickerInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 10 },
    
    // Question Rows
    questionRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    addQuestionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', marginBottom: 20 },

    // Search
    searchContainer: { flexDirection: 'row', borderRadius: 8, marginHorizontal: 15, marginBottom: 15, alignItems: 'center', paddingHorizontal: 10, borderWidth: 1, height: 45 },
    searchInput: { flex: 1, height: 45, marginLeft: 8, fontSize: 15 },
    
    // Submission View
    submittedContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    submittedText: { marginLeft: 8, fontSize: 13 },
    modalStudentName: { fontSize: 18, fontWeight: '600', marginBottom: 15 },
    writtenAnswerContainer: { padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 15, minHeight: 100 },
    fileListContainer: { marginBottom: 15 },

    // Form Elements
    label: { fontSize: 14, fontWeight: '600', marginBottom: 5, marginTop: 10 },
    input: { borderWidth: 1, padding: 10, borderRadius: 8, marginBottom: 10, fontSize: 15 },
    modalButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    emptyText: { textAlign: 'center', marginTop: 50 },

    // Viewer Modal
    viewerModalContainer: { flex: 1 },
    viewerSafeArea: { flex: 1 },
    viewerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1 },
    viewerTitle: { fontSize: 16, fontWeight: 'bold', flex: 1 },
    closeViewerBtn: { padding: 5 },
    viewerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pdfView: { flex: 1, width: width, height: height },
    imageView: { flex: 1, width: width, height: height },
});

export default TeacherAdminHomeworkScreen;