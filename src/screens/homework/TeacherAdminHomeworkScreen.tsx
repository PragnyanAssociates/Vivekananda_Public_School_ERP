// 📂 File: TeacherAdminHomeworkScreen.js (HEAVILY MODIFIED & FINAL)

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput, ScrollView, Linking, LayoutAnimation, UIManager, Platform, SafeAreaView } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import { pick, types, isCancel } from '@react-native-documents/picker';
import * as Animatable from 'react-native-animatable';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AnimatableTouchableOpacity = Animatable.createAnimatableComponent(TouchableOpacity);

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

const AssignmentList = ({ onSelectAssignment }) => {
    const { user } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState(null);
    const [studentClasses, setStudentClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const initialAssignmentState = { title: '', description: '', due_date: '', homework_type: 'PDF' };
    const [newAssignment, setNewAssignment] = useState(initialAssignmentState);
    const [attachment, setAttachment] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const fetchTeacherAssignments = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/homework/teacher/${user.id}`);
            setAssignments(response.data);
        } catch (e) {
            Alert.alert("Error", e.response?.data?.message || "Failed to fetch assignment history.");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const fetchStudentClasses = async () => {
        try {
            const response = await apiClient.get('/student-classes');
            setStudentClasses(response.data);
        } catch (e) {
            console.error("Error fetching student classes:", e);
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
                const data = response.data;
                setSubjects(data);
                return data;
            } catch (e) {
                console.error(e);
                return [];
            }
        }
        return [];
    };

    const openCreateModal = () => {
        setEditingAssignment(null);
        setNewAssignment(initialAssignmentState);
        setSelectedClass('');
        setSelectedSubject('');
        setSubjects([]);
        setAttachment(null);
        setIsModalVisible(true);
    };

    const openEditModal = async (assignment) => {
        setEditingAssignment(assignment);
        const date = new Date(assignment.due_date);
        const formattedDate = date.toISOString().split('T')[0];
        setNewAssignment({ title: assignment.title, description: assignment.description, due_date: formattedDate, homework_type: assignment.homework_type || 'PDF' });
        setAttachment(assignment.attachment_path ? { name: assignment.attachment_path.split('/').pop() } : null);
        const fetchedSubjects = await handleClassChange(assignment.class_group);
        if (fetchedSubjects.includes(assignment.subject)) {
            setSelectedSubject(assignment.subject);
        }
        setIsModalVisible(true);
    };

    const handleDelete = (assignment) => {
        Alert.alert("Confirm Delete", `Are you sure you want to delete "${assignment.title}"?`, [{ text: "Cancel", style: 'cancel' }, {
            text: "Delete",
            style: 'destructive',
            onPress: async () => {
                try {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
                    await apiClient.delete(`/homework/${assignment.id}`);
                    Alert.alert("Success", "Assignment deleted.");
                    fetchTeacherAssignments();
                } catch (e) {
                    Alert.alert("Error", e.response?.data?.message || 'Failed to delete assignment.');
                }
            }
        },]);
    };

    const handleSave = async () => {
        if (!user || !selectedClass || !selectedSubject || !newAssignment.title || !newAssignment.due_date) {
            return Alert.alert("Validation Error", "Title, Class, Subject, and Due Date are required.");
        }
        setIsSaving(true);
        const formData = new FormData();
        formData.append('title', newAssignment.title);
        formData.append('description', newAssignment.description || '');
        formData.append('due_date', newAssignment.due_date);
        formData.append('class_group', selectedClass);
        formData.append('subject', selectedSubject);
        formData.append('homework_type', newAssignment.homework_type);
        if (!editingAssignment) {
            formData.append('teacher_id', user.id);
        }
        if (attachment && attachment.uri) {
            formData.append('attachment', { uri: attachment.uri, type: attachment.type, name: attachment.name, });
        } else if (editingAssignment && editingAssignment.attachment_path) {
            formData.append('existing_attachment_path', editingAssignment.attachment_path);
        }
        try {
            const url = editingAssignment ? `/homework/update/${editingAssignment.id}` : '/homework';
            await apiClient.post(url, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            Alert.alert("Success", `Assignment ${editingAssignment ? 'updated' : 'created'}!`);
            setIsModalVisible(false);
            fetchTeacherAssignments();
        } catch (e) {
            Alert.alert("Error", e.response?.data?.message || "An error occurred while saving.");
            console.error("SAVE ERROR:", JSON.stringify(e));
        } finally {
            setIsSaving(false);
        }
    };

    const selectAttachment = async () => {
        try {
            const result = await pick({ type: [types.allFiles], allowMultiSelection: false, });
            if (result && result.length > 0) {
                setAttachment(result[0]);
            }
        } catch (err) {
            if (!isCancel(err)) {
                Alert.alert('Error', 'An unknown error occurred while picking the file.');
            }
        }
    };

    const renderAssignmentItem = ({ item, index }) => (
        <Animatable.View animation="fadeInUp" duration={600} delay={index * 100}>
            <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    <View style={styles.actionIconContainer}>
                        <TouchableOpacity onPress={() => openEditModal(item)}><MaterialIcons name="edit" size={24} color="#007bff" /></TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(item)} style={{ marginLeft: 15 }}><MaterialIcons name="delete" size={24} color="#dc3545" /></TouchableOpacity>
                    </View>
                </View>
                <Text style={styles.cardSubtitle}>Type: {item.homework_type || 'PDF'} | For: {item.class_group} - {item.subject}</Text>
                <Text style={styles.cardDetail}>Due: {new Date(item.due_date).toLocaleDateString()}</Text>
                <View style={item.submission_count > 0 ? styles.badge : styles.badgeMuted}><Text style={styles.badgeText}>{item.submission_count} Submission(s)</Text></View>
                <TouchableOpacity style={styles.viewSubmissionsBtn} onPress={() => onSelectAssignment(item)}><Text style={styles.viewSubmissionsBtnText}>View Submissions & Grade</Text></TouchableOpacity>
            </View>
        </Animatable.View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                data={assignments}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderAssignmentItem}
                ListHeaderComponent={<Animatable.View animation="fadeInDown" duration={500}><View style={styles.header}><Text style={styles.headerTitle}>My Created Assignments</Text></View></Animatable.View>}
                ListFooterComponent={<AnimatableTouchableOpacity animation="pulse" easing="ease-out" iterationCount="infinite" style={styles.addButton} onPress={openCreateModal}><MaterialIcons name="add" size={24} color="#fff" /><Text style={styles.addButtonText}>Create New Homework</Text></AnimatableTouchableOpacity>}
                ListEmptyComponent={<View style={{ paddingTop: 50 }}><Text style={styles.emptyText}>You have not created any assignments yet.</Text></View>}
                onRefresh={fetchTeacherAssignments}
                refreshing={isLoading}
            />
            <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} animationType="slide">
                <SafeAreaView style={{flex: 1}}>
                    <ScrollView style={styles.modalView} contentContainerStyle={{ paddingBottom: 50 }}>
                        <Text style={styles.modalFormTitle}>{editingAssignment ? 'Edit Assignment' : 'Create New Assignment'}</Text>
                        <Text style={styles.label}>Homework Type *</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={newAssignment.homework_type} onValueChange={(itemValue) => setNewAssignment({ ...newAssignment, homework_type: itemValue })}>
                                <Picker.Item label="PDF / File Upload" value="PDF" />
                                <Picker.Item label="Written / Text Answer" value="Written" />
                            </Picker>
                        </View>
                        <Text style={styles.label}>Class *</Text>
                        <View style={styles.pickerContainer}><Picker selectedValue={selectedClass} onValueChange={(itemValue) => handleClassChange(itemValue)}><Picker.Item label="-- Select a class --" value="" />{studentClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}</Picker></View>
                        <Text style={styles.label}>Subject *</Text>
                        <View style={styles.pickerContainer}><Picker selectedValue={selectedSubject} onValueChange={(itemValue) => setSelectedSubject(itemValue)} enabled={subjects.length > 0}><Picker.Item label={subjects.length > 0 ? "-- Select a subject --" : "Select a class first"} value="" />{subjects.map(s => <Picker.Item key={s} label={s} value={s} />)}</Picker></View>
                        <Text style={styles.label}>Title *</Text>
                        <TextInput style={styles.input} placeholder="e.g., Chapter 5 Exercise" value={newAssignment.title} onChangeText={text => setNewAssignment({ ...newAssignment, title: text })} />
                        <Text style={styles.label}>Description (Optional)</Text>
                        <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} placeholder="Instructions for students" multiline value={newAssignment.description} onChangeText={text => setNewAssignment({ ...newAssignment, description: text })} />
                        <Text style={styles.label}>Due Date *</Text>
                        <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={newAssignment.due_date} onChangeText={text => setNewAssignment({ ...newAssignment, due_date: text })} />
                        <TouchableOpacity style={styles.uploadButton} onPress={selectAttachment}><MaterialIcons name="attach-file" size={20} color="#fff" /><Text style={styles.uploadButtonText}>Attach Question Paper (Optional)</Text></TouchableOpacity>
                        {attachment && <Text style={styles.attachmentText}>Selected: {attachment.name}</Text>}
                        <View style={styles.modalActions}><TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsModalVisible(false)}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[styles.modalBtn, styles.createBtn]} onPress={handleSave} disabled={isSaving}>{isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>{editingAssignment ? 'Save Changes' : 'Create'}</Text>}</TouchableOpacity></View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};


const SubmissionList = ({ assignment, onBack }) => {
    const [studentRoster, setStudentRoster] = useState([]);
    const [filteredRoster, setFilteredRoster] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [gradeData, setGradeData] = useState({ grade: '', remarks: '' });
    const [isGrading, setIsGrading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchStudentRoster = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/homework/submissions/${assignment.id}`);
            setStudentRoster(response.data);
            setFilteredRoster(response.data);
        } catch (e) {
            Alert.alert("Error", e.response?.data?.message || "Failed to fetch student roster.");
        } finally {
            setIsLoading(false);
        }
    }, [assignment.id]);

    useEffect(() => {
        fetchStudentRoster();
    }, [fetchStudentRoster]);

    useEffect(() => {
        if (searchQuery === '') {
            setFilteredRoster(studentRoster);
        } else {
            const lowercasedQuery = searchQuery.toLowerCase();
            const filteredData = studentRoster.filter(item =>
                item.student_name.toLowerCase().includes(lowercasedQuery) ||
                (item.roll_no && item.roll_no.includes(lowercasedQuery))
            );
            setFilteredRoster(filteredData);
        }
    }, [searchQuery, studentRoster]);

    const openDetailsModal = (student) => {
        setSelectedStudent(student);
        setGradeData({ grade: student.grade || '', remarks: student.remarks || '' });
    };

    const handleGrade = async () => {
        if (!selectedStudent || !selectedStudent.submission_id) return;
        setIsGrading(true);
        try {
            await apiClient.put(`/homework/grade/${selectedStudent.submission_id}`, gradeData);
            Alert.alert("Success", "Submission graded!");
            setSelectedStudent(null);
            fetchStudentRoster();
        } catch (e) {
            Alert.alert("Error", e.response?.data?.message || "An error occurred while grading.");
        } finally {
            setIsGrading(false);
        }
    };

    const renderSubmissionItem = ({ item, index }) => (
        <Animatable.View animation="fadeInUp" duration={400} delay={index * 50}>
            <TouchableOpacity style={styles.submissionCard} onPress={() => openDetailsModal(item)}>
                <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.roll_no ? `(${item.roll_no}) ` : ''}{item.student_name}
                    </Text>
                    {item.grade && (
                        <View style={styles.gradeBadge}>
                           <MaterialIcons name="star" size={14} color="#fff"/>
                           <Text style={styles.gradeBadgeText}>{item.grade}</Text>
                        </View>
                    )}
                </View>

                {item.submission_id ? (
                    <View style={styles.submittedContainer}>
                        <MaterialIcons name="check-circle" size={18} color="#4caf50"/>
                        <Text style={styles.submittedText}>
                            Submitted: {new Date(item.submitted_at).toLocaleDateString()}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.notSubmittedContainer}>
                        <MaterialIcons name="cancel" size={18} color="#a5a5a5"/>
                        <Text style={styles.notSubmittedText}>Not Submitted</Text>
                    </View>
                )}
            </TouchableOpacity>
        </Animatable.View>
    );

    if (isLoading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#007bff" /></View>;
    }

    return (
        <SafeAreaView style={styles.container}>
            <Animatable.View animation="fadeInDown" duration={500}>
                <View style={styles.submissionHeader}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <Text style={styles.submissionHeaderTitle} numberOfLines={1}>Submissions for: "{assignment.title}"</Text>
                </View>
                <View style={styles.searchContainer}>
                    <MaterialIcons name="search" size={22} color="#888" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name or roll no..."
                        placeholderTextColor="#888"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </Animatable.View>
            
            <FlatList
                data={filteredRoster}
                keyExtractor={(item) => item.student_id.toString()}
                renderItem={renderSubmissionItem}
                ListEmptyComponent={<Text style={styles.emptyText}>{studentRoster.length > 0 ? 'No students match your search.' : 'No students found in this class.'}</Text>}
                onRefresh={fetchStudentRoster}
                refreshing={isLoading}
                contentContainerStyle={{ paddingBottom: 20 }}
            />

            <Modal visible={!!selectedStudent} onRequestClose={() => setSelectedStudent(null)} animationType="slide">
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                       <Text style={styles.modalTitle}>Submission Details</Text>
                       <TouchableOpacity onPress={() => setSelectedStudent(null)}>
                           <MaterialIcons name="close" size={28} color="#333" />
                       </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.modalContent}>
                         <Text style={styles.modalStudentName}>
                            {selectedStudent?.roll_no ? `(${selectedStudent.roll_no}) ` : ''}{selectedStudent?.student_name}
                         </Text>
                         <View style={styles.separator} />

                         {selectedStudent?.submission_id ? (
                            <>
                                <Text style={styles.modalSectionTitle}>Submitted Answer</Text>
                                {selectedStudent.written_answer ? (
                                    <View style={styles.writtenAnswerContainer}>
                                        <ScrollView style={{maxHeight: 200}}>
                                            <Text style={styles.writtenAnswerText}>{selectedStudent.written_answer}</Text>
                                        </ScrollView>
                                    </View>
                                ) : selectedStudent.submission_path ? (
                                    <TouchableOpacity style={styles.downloadButton} onPress={() => Linking.openURL(`${SERVER_URL}${selectedStudent.submission_path}`)}>
                                        <MaterialIcons name="cloud-download" size={20} color="#fff"/>
                                        <Text style={styles.downloadButtonText}>View Submitted File</Text>
                                    </TouchableOpacity>
                                ) : <Text style={styles.modalInfoText}>No submission content found.</Text>}

                                <View style={styles.separator} />

                                <Text style={styles.modalSectionTitle}>{selectedStudent.grade ? 'Update Grade' : 'Grade Submission'}</Text>
                                <Text style={styles.label}>Grade</Text>
                                <TextInput style={styles.input} placeholder="e.g., A+, 95/100" defaultValue={gradeData.grade} onChangeText={text => setGradeData({...gradeData, grade: text})} />
                                <Text style={styles.label}>Remarks / Feedback</Text>
                                <TextInput style={[styles.input, {height: 100, textAlignVertical: 'top'}]} placeholder="Provide feedback for the student" multiline defaultValue={gradeData.remarks} onChangeText={text => setGradeData({...gradeData, remarks: text})} />
                                
                                <TouchableOpacity style={[styles.modalBtn, styles.createBtn]} onPress={handleGrade} disabled={isGrading}>
                                    {isGrading ? <ActivityIndicator color="#fff"/> : <Text style={styles.modalButtonText}>Submit Grade</Text>}
                                </TouchableOpacity>
                            </>
                         ) : (
                            <View style={styles.centered}>
                                <MaterialIcons name="info-outline" size={40} color="#aaa" />
                                <Text style={styles.modalInfoText}>This student has not submitted the homework yet.</Text>
                            </View>
                         )}
                         
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f8' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    header: { paddingBottom: 10, paddingTop: 10 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', paddingHorizontal: 15, color: '#333' },
    card: { backgroundColor: '#fff', borderRadius: 8, marginHorizontal: 15, marginVertical: 8, padding: 15, elevation: 2 },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    actionIconContainer: { flexDirection: 'row' },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#37474f', flex: 1 },
    cardSubtitle: { fontSize: 14, color: '#546e7a', marginTop: 2 },
    cardDetail: { fontSize: 14, color: '#777', marginTop: 5 },
    viewSubmissionsBtn: { marginTop: 12, backgroundColor: '#007bff', paddingVertical: 10, borderRadius: 5, alignItems: 'center' },
    viewSubmissionsBtnText: { color: '#fff', fontWeight: 'bold' },
    addButton: { flexDirection: 'row', backgroundColor: '#28a745', padding: 15, marginHorizontal: 15, marginBottom: 15, borderRadius: 10, justifyContent: 'center', alignItems: 'center', elevation: 3 },
    addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#777' },
    badge: { backgroundColor: '#ffb300', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10, alignSelf: 'flex-start', marginTop: 10 },
    badgeMuted: { backgroundColor: '#e0e0e0', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10, alignSelf: 'flex-start', marginTop: 10 },
    badgeText: { color: '#333', fontSize: 12, fontWeight: 'bold' },
    // Form Modal Styles
    modalView: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
    modalFormTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#333' },
    pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 15, backgroundColor: '#fff' },
    uploadButton: { flexDirection: 'row', backgroundColor: '#007bff', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    uploadButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 },
    attachmentText: { textAlign: 'center', marginVertical: 10, fontStyle: 'italic', color: '#555' },
    modalActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
    cancelBtn: { backgroundColor: '#6c757d', marginRight: 10 },
    // Submission List Styles
    submissionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingTop: 15, paddingBottom: 10 },
    backButton: { marginRight: 15 },
    submissionHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', flex: 1 },
    searchContainer: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 8, marginHorizontal: 15, marginBottom: 10, alignItems: 'center', elevation: 2, paddingHorizontal: 10, },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, height: 45, fontSize: 16 },
    submissionCard: { backgroundColor: '#fff', borderRadius: 10, marginHorizontal: 15, marginVertical: 6, padding: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
    gradeBadge: { flexDirection: 'row', backgroundColor: '#42a5f5', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10, alignItems: 'center' },
    gradeBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
    submittedContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
    submittedText: { marginLeft: 8, fontSize: 14, color: '#4caf50' },
    notSubmittedContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
    notSubmittedText: { marginLeft: 8, fontSize: 14, color: '#a5a5a5', fontStyle: 'italic' },
    // Detailed Modal Styles
    modalContainer: { flex: 1, backgroundColor: '#f9f9f9' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
    modalContent: { padding: 20 },
    modalStudentName: { fontSize: 18, fontWeight: '600', color: '#263238', marginBottom: 15 },
    separator: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 20 },
    modalSectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#546e7a', marginBottom: 10 },
    modalInfoText: { fontSize: 16, color: '#777', textAlign: 'center', marginTop: 10 },
    writtenAnswerContainer: { backgroundColor: '#f1f8e9', padding: 12, borderRadius: 6, borderWidth: 1, borderColor: '#dcedc8', marginBottom: 20 },
    writtenAnswerText: { fontSize: 15, color: '#33691e', lineHeight: 22 },
    downloadButton: { flexDirection: 'row', backgroundColor: '#2196f3', paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    downloadButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 },
    label: { fontSize: 16, fontWeight: '500', color: '#444', marginBottom: 5, marginTop: 10 },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 15, fontSize: 16 },
    modalBtn: { paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    createBtn: { backgroundColor: '#28a745', marginLeft: 10, flex: 1 },
    modalButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

export default TeacherAdminHomeworkScreen;