// 📂 File: screens/syllabus/AdminSyllabusScreen.js (MODIFIED & CORRECTED)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView, TextInput } from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext'; 
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';

// Main component that controls which view is shown
const AdminSyllabusScreen = () => {
    const [view, setView] = useState('history');
    const [selectedSyllabus, setSelectedSyllabus] = useState(null);
    const navigateTo = (targetView, data = null) => { setSelectedSyllabus(data); setView(targetView); };

    if (view === 'history') {
        return <SyllabusHistoryList onEdit={(syllabus) => navigateTo('createOrEdit', syllabus)} onCreate={() => navigateTo('createOrEdit')} onViewProgress={(syllabus) => navigateTo('progressDetail', syllabus)} />;
    }
    if (view === 'createOrEdit') {
        return <CreateOrEditSyllabus initialSyllabus={selectedSyllabus} onFinish={() => navigateTo('history')} />;
    }
    if (view === 'progressDetail') {
        return <AdminProgressView syllabus={selectedSyllabus} onBack={() => navigateTo('history')} />;
    }
    return null;
};


const SyllabusHistoryList = ({ onEdit, onCreate, onViewProgress }) => {
    const [syllabuses, setSyllabuses] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [selectedClassFilter, setSelectedClassFilter] = useState('All');
    const [isLoading, setIsLoading] = useState(false);
    const isFocused = useIsFocused();

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [syllabiRes, classesRes] = await Promise.all([
                apiClient.get('/syllabus/all'),
                apiClient.get('/all-classes')
            ]);
            setSyllabuses(syllabiRes.data);
            
            const filteredClasses = classesRes.data.filter(c => 
                c && (c.startsWith('Class') || c === 'LKG' || c === 'UKG')
            );
            setAllClasses(filteredClasses);

        } catch (error) { 
            Alert.alert("Error", error.response?.data?.message || "Failed to load syllabus history."); 
        } finally { 
            setIsLoading(false); 
        }
    }, []);

    useEffect(() => {
        if (isFocused) fetchData();
    }, [isFocused, fetchData]);

    // ★★★★★ START: NEW DELETE SYLLABUS HANDLER ★★★★★
    const handleDeleteSyllabus = (syllabusToDelete) => {
        Alert.alert(
            "Confirm Delete",
            `Are you sure you want to delete the syllabus for ${syllabusToDelete.class_group} - ${syllabusToDelete.subject_name}? This action cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await apiClient.delete(`/syllabus/${syllabusToDelete.id}`);
                            Alert.alert("Success", "Syllabus has been deleted.");
                            fetchData(); // Refresh the list after deletion
                        } catch (error) {
                            Alert.alert("Error", error.response?.data?.message || "Could not delete the syllabus.");
                        }
                    },
                },
            ]
        );
    };
    // ★★★★★ END: NEW DELETE SYLLABUS HANDLER ★★★★★

    const filteredSyllabuses = useMemo(() => {
        if (selectedClassFilter === 'All') {
            return syllabuses;
        }
        return syllabuses.filter(s => s.class_group === selectedClassFilter);
    }, [selectedClassFilter, syllabuses]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Syllabus Management</Text>
            </View>
            
            <View style={styles.filterContainer}>
                <Text style={styles.filterLabel}>Filter by Class:</Text>
                <View style={styles.pickerWrapper}>
                    <Picker
                        selectedValue={selectedClassFilter}
                        onValueChange={(itemValue) => setSelectedClassFilter(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="All Classes" value="All" />
                        {allClasses.map((className, index) => (
                            <Picker.Item key={index} label={className} value={className} />
                        ))}
                    </Picker>
                </View>
            </View>

            <FlatList
                data={filteredSyllabuses}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                           <Text style={styles.cardTitle}>{item.class_group} - {item.subject_name}</Text>
                           {/* ★★★ MODIFIED: Added View for Edit and Delete Icons ★★★ */}
                           <View style={styles.cardActions}>
                                <TouchableOpacity onPress={() => onEdit(item)} style={styles.actionIcon}>
                                    <MaterialIcons name="edit" size={24} color="#007bff" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteSyllabus(item)} style={styles.actionIcon}>
                                    <MaterialIcons name="delete" size={24} color="#d9534f" />
                                </TouchableOpacity>
                           </View>
                        </View>
                        <Text style={styles.cardSubtitle}>{item.lesson_count} lessons</Text>
                        <Text style={styles.cardCreator}>Created by: {item.creator_name}</Text>
                        <Text style={styles.cardDate}>Last Updated: {new Date(item.updated_at).toLocaleDateString()}</Text>
                        <TouchableOpacity style={styles.viewProgressButton} onPress={() => onViewProgress(item)}>
                            <MaterialIcons name="bar-chart" size={20} color="#fff" />
                            <Text style={styles.buttonText}>View Class Progress</Text>
                        </TouchableOpacity>
                    </View>
                )}
                ListFooterComponent={
                    <TouchableOpacity style={styles.createButton} onPress={onCreate}>
                        <MaterialIcons name="add" size={24} color="#fff" />
                        <Text style={styles.buttonText}>Create New Syllabus</Text>
                    </TouchableOpacity>
                }
                onRefresh={fetchData}
                refreshing={isLoading}
                ListEmptyComponent={!isLoading && <Text style={styles.emptyText}>No syllabuses found for the selected class.</Text>}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
};

const CreateOrEditSyllabus = ({ initialSyllabus, onFinish }) => {
    const isEditMode = !!initialSyllabus;
    const { user } = useAuth();

    const [selectedClass, setSelectedClass] = useState(isEditMode ? initialSyllabus.class_group : '');
    const [selectedSubject, setSelectedSubject] = useState(isEditMode ? initialSyllabus.subject_name : '');
    const [selectedTeacherId, setSelectedTeacherId] = useState(isEditMode ? initialSyllabus.creator_id : '');
    const [lessons, setLessons] = useState([{ lessonName: '', dueDate: '' }]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [allClasses, setAllClasses] = useState([]);
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [availableTeachers, setAvailableTeachers] = useState([]);
    const [isSubjectsLoading, setIsSubjectsLoading] = useState(false);
    const [isTeachersLoading, setIsTeachersLoading] = useState(false);

    useEffect(() => {
        const bootstrapForm = async () => {
            setIsLoading(true);
            try {
                const classRes = await apiClient.get('/student-classes');
                
                const filteredClasses = classRes.data.filter(c => 
                    c && (c.startsWith('Class') || c === 'LKG' || c === 'UKG')
                );
                setAllClasses(filteredClasses);

                if (isEditMode) {
                    await handleClassChange(initialSyllabus.class_group, true);
                    await handleSubjectChange(initialSyllabus.subject_name, initialSyllabus.class_group, true);
                    
                    const syllabusDetailsRes = await apiClient.get(`/syllabus/teacher/${initialSyllabus.class_group}/${initialSyllabus.subject_name}`);
                    const syllabusData = syllabusDetailsRes.data;
                    const formattedLessons = syllabusData.lessons.map(l => ({ lessonName: l.lesson_name, dueDate: l.due_date.split('T')[0] }));
                    setLessons(formattedLessons.length > 0 ? formattedLessons : [{ lessonName: '', dueDate: '' }]);
                }
            } catch (e) { console.error("Error bootstrapping form:", e); Alert.alert("Error", "Could not load initial form data."); } 
            finally { setIsLoading(false); }
        };
        bootstrapForm();
    }, []);

    const handleClassChange = async (classGroup, isInitialLoad = false) => {
        if (!isInitialLoad) {
            setSelectedSubject(''); setAvailableSubjects([]);
            setSelectedTeacherId(''); setAvailableTeachers([]);
        }
        setSelectedClass(classGroup);
        if (!classGroup) return;

        setIsSubjectsLoading(true);
        try {
            const subjectRes = await apiClient.get(`/subjects-for-class/${classGroup}`);
            setAvailableSubjects(subjectRes.data);
        } catch (error) { console.error("Error fetching subjects:", error); } 
        finally { setIsSubjectsLoading(false); }
    };

    const handleSubjectChange = async (subjectName, classGroup = selectedClass, isInitialLoad = false) => {
        if (!isInitialLoad) {
            setSelectedTeacherId(''); setAvailableTeachers([]);
        }
        setSelectedSubject(subjectName);
        if (!subjectName || !classGroup) return;
        
        setIsTeachersLoading(true);
        try {
            const teacherRes = await apiClient.get(`/syllabus/teachers/${classGroup}/${subjectName}`);
            const teachers = teacherRes.data;
            setAvailableTeachers(teachers);
            if (teachers.length === 1 && !isEditMode) setSelectedTeacherId(teachers[0].id);
        } catch (error) { console.error("Error fetching teachers:", error); } 
        finally { setIsTeachersLoading(false); }
    };

    const handleLessonChange = (index, field, value) => { const newLessons = [...lessons]; newLessons[index][field] = value; setLessons(newLessons); };
    const addLessonField = () => setLessons([...lessons, { lessonName: '', dueDate: '' }]);
    const removeLessonField = (index) => setLessons(lessons.filter((_, i) => i !== index));

    const handleSaveSyllabus = async () => {
        if (!selectedClass || !selectedSubject || !selectedTeacherId) return Alert.alert("Selection Missing", "Please select a class, subject, and teacher.");
        if (lessons.some(l => l.lessonName && !l.dueDate)) return Alert.alert("Missing Date", "All lessons must have a due date.");
        const validLessons = lessons.filter(l => l.lessonName.trim() && l.dueDate.trim());
        if (validLessons.length === 0) return Alert.alert("No Lessons", "Please add at least one lesson.");
        
        setIsSaving(true);
        
        try {
            let response;
            if (isEditMode) {
                response = await apiClient.put(`/syllabus/${initialSyllabus.id}`, {
                    lessons: validLessons,
                    creator_id: selectedTeacherId,
                });
            } else {
                response = await apiClient.post('/syllabus/create', {
                    class_group: selectedClass,
                    subject_name: selectedSubject,
                    lessons: validLessons,
                    creator_id: selectedTeacherId,
                });
            }

            Alert.alert("Success", response.data.message);
            onFinish();

        } catch (error) {
            Alert.alert("Error", error.response?.data?.message || "Failed to save syllabus.");
        } finally {
            setIsSaving(false);
        }
    };
    
    if (isLoading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3f51b5" /></View>;

    return (
        <ScrollView style={styles.containerDark}>
            <TouchableOpacity onPress={onFinish} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={24} color="#333" />
                <Text style={styles.backButtonText}>Back to List</Text>
            </TouchableOpacity>
            <Text style={styles.formHeaderTitle}>{isEditMode ? 'Edit Syllabus' : 'Create New Syllabus'}</Text>
            
            <View style={styles.formSection}>
                <Text style={styles.label}>1. Select Class</Text>
                <View style={styles.pickerContainer}>
                    <Picker selectedValue={selectedClass} onValueChange={handleClassChange} enabled={!isEditMode}>
                        <Picker.Item label="Select Class..." value="" />
                        {allClasses.map((c, i) => <Picker.Item key={i} label={c} value={c} />)}
                    </Picker>
                </View>

                <Text style={styles.label}>2. Select Subject</Text>
                <View style={styles.pickerContainer}>
                    <Picker selectedValue={selectedSubject} onValueChange={handleSubjectChange} enabled={!isEditMode && !!selectedClass && !isSubjectsLoading}>
                        <Picker.Item label={isSubjectsLoading ? "Loading..." : "Select Subject..."} value="" />
                        {availableSubjects.map((s, i) => <Picker.Item key={i} label={s} value={s} />)}
                    </Picker>
                </View>
                {isSubjectsLoading && <ActivityIndicator style={{marginBottom: 15}}/>}

                <Text style={styles.label}>3. Select Teacher</Text>
                <View style={styles.pickerContainer}>
                    <Picker selectedValue={selectedTeacherId} onValueChange={(val) => setSelectedTeacherId(val)} enabled={!!selectedSubject && !isTeachersLoading}>
                        <Picker.Item label={isTeachersLoading ? "Loading..." : "Select Teacher..."} value="" />
                        {availableTeachers.map((t) => <Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} />)}
                    </Picker>
                </View>
                {isTeachersLoading && <ActivityIndicator style={{marginBottom: 15}}/>}
            </View>

            <View style={styles.formSection}>
                <Text style={styles.headerTitleSecondary}>4. Add/Edit Lessons</Text>
                {lessons.map((lesson, index) => (
                    <View key={index} style={styles.lessonInputGroup}>
                        <View style={styles.lessonInputHeader}>
                            <Text style={styles.label}>Lesson {index + 1}</Text>
                            {lessons.length > 1 && <TouchableOpacity onPress={() => removeLessonField(index)}><MaterialIcons name="delete-outline" size={22} color="#c62828" /></TouchableOpacity>}
                        </View>
                        <TextInput style={styles.input} placeholder="Lesson Name" value={lesson.lessonName} onChangeText={(text) => handleLessonChange(index, 'lessonName', text)} />
                        <TextInput style={styles.input} placeholder="Due Date (YYYY-MM-DD)" value={lesson.dueDate} onChangeText={(text) => handleLessonChange(index, 'dueDate', text)} keyboardType="numeric" />
                    </View>
                ))}
                <TouchableOpacity style={styles.addLessonBtn} onPress={addLessonField}>
                    <Text style={styles.addLessonBtnText}>+ Add Another Lesson</Text>
                </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveSyllabus} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isEditMode ? 'Update Syllabus' : 'Save Syllabus'}</Text>}
            </TouchableOpacity>
        </ScrollView>
    );
};

const AdminProgressView = ({ syllabus, onBack }) => {
    const [auditLog, setAuditLog] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Completed': return { color: '#22c55e' };
            case 'Missed': return { color: '#ef4444' };
            default: return { color: '#f59e0b' };
        }
    };
    
    useEffect(() => {
        const fetchProgress = async () => {
            if (!syllabus?.id) return;
            setIsLoading(true);
            try {
                const response = await apiClient.get(`/syllabus/class-progress/${syllabus.id}`);
                setAuditLog(response.data);
            } catch (error) {
                Alert.alert("Error", error.response?.data?.message || "Could not load class progress.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchProgress();
    }, [syllabus]);

    const renderLessonCard = ({ item: lesson }) => {
        const statusStyle = getStatusStyle(lesson.status);
        return (
            <View style={styles.lessonAuditCard}>
                <Text style={styles.lessonAuditTitle}>{lesson.lesson_name}</Text>
                <View style={styles.lessonAuditDetails}>
                    <View style={styles.lessonAuditRow}>
                        <MaterialIcons name="event" size={16} color="#6b7280" />
                        <Text style={styles.lessonAuditText}>Due: {new Date(lesson.due_date).toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.lessonAuditRow}>
                        <MaterialIcons name="person" size={16} color="#6b7280" />
                        <Text style={styles.lessonAuditText}>Updated by: <Text style={styles.updaterName}>{lesson.updater_name}</Text></Text>
                    </View>
                </View>
                <View style={[styles.statusBanner, { backgroundColor: statusStyle.color }]}>
                    <Text style={styles.statusBannerText}>{lesson.status}</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={24} color="#333" />
                <Text style={styles.backButtonText}>Back to Syllabus List</Text>
            </TouchableOpacity>
            <Text style={styles.progressHeaderTitle}>Progress for {syllabus?.class_group} - {syllabus?.subject_name}</Text>
            {isLoading ? (
                <ActivityIndicator size="large" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={auditLog}
                    renderItem={renderLessonCard}
                    keyExtractor={(item) => item.lesson_id.toString()}
                    ListEmptyComponent={<Text style={styles.emptyText}>No lessons found in this syllabus.</Text>}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f7' },
    containerDark: { flex: 1, backgroundColor: '#e8eaf6', padding: 5,},
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        paddingTop: 20,
        paddingBottom: 5,
        paddingHorizontal: 15,
        backgroundColor: '#f0f4f7',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1A202C',
    },
    formHeaderTitle: { fontSize: 24, fontWeight: 'bold', paddingHorizontal: 15, paddingBottom: 10, textAlign: 'center'},
    headerTitleSecondary: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#3f51b5' },
    card: { backgroundColor: '#fff', padding: 20, marginHorizontal: 15, marginVertical: 8, borderRadius: 12, elevation: 3 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#263238', flex: 1 }, // Added flex: 1
    // ★★★ NEW STYLES for Edit/Delete icons ★★★
    cardActions: {
        flexDirection: 'row',
    },
    actionIcon: {
        padding: 5,
        marginLeft: 10,
    },
    // ★★★ END NEW STYLES ★★★
    cardSubtitle: { fontSize: 14, color: '#546e7a', marginTop: 4 },
    cardCreator: { fontSize: 12, color: '#90a4ae', marginTop: 4 },
    cardDate: { fontSize: 12, color: '#90a4ae', marginTop: 2, marginBottom: 15 },
    viewProgressButton: { flexDirection: 'row', backgroundColor: '#00838f', paddingVertical: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    buttonText: { color: '#fff', fontWeight: 'bold', marginLeft: 10, fontSize: 16 },
    createButton: { flexDirection: 'row', backgroundColor: '#2e7d32', padding: 15, marginHorizontal: 15, marginTop: 10, borderRadius: 10, justifyContent: 'center', alignItems: 'center', elevation: 2 },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#666', fontSize: 16 },
    backButton: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    backButtonText: { fontSize: 16, fontWeight: '500', marginLeft: 5 },
    formSection: { backgroundColor: '#fff', padding: 20, borderRadius: 12, margin: 10, elevation: 2, },
    pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 15, backgroundColor: '#fff' },
    label: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8 },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 12, backgroundColor: '#f9f9f9' },
    lessonInputGroup: { marginBottom: 15, padding: 15, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, backgroundColor: '#fafafa' },
    lessonInputHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    addLessonBtn: { backgroundColor: '#e0e6ff', padding: 12, borderRadius: 8, alignItems: 'center', marginVertical: 10 },
    addLessonBtnText: { color: '#3f51b5', fontWeight: 'bold' },
    saveButton: { flexDirection: 'row', backgroundColor: '#43a047', padding: 15, margin: 15, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    progressHeaderTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 15, marginBottom: 10, color: '#1f2937' },
    lessonAuditCard: { backgroundColor: '#fff', marginHorizontal: 15, marginVertical: 8, borderRadius: 12, elevation: 2, overflow: 'hidden' },
    lessonAuditTitle: { fontSize: 18, fontWeight: '600', color: '#111827', paddingHorizontal: 15, paddingTop: 15 },
    lessonAuditDetails: { paddingHorizontal: 15, paddingBottom: 15, paddingTop: 5 },
    lessonAuditRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    lessonAuditText: { fontSize: 14, color: '#4b5563', marginLeft: 8 },
    updaterName: { fontWeight: 'bold', color: '#1e3a8a' },
    statusBanner: { paddingVertical: 6, alignItems: 'center' },
    statusBannerText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    filterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        backgroundColor: '#f0f4f7',
        marginBottom: 5,
    },
    filterLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#4A5568',
        marginRight: 10,
    },
    pickerWrapper: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        height: 50,
        justifyContent: 'center',
    },
    picker: {
        width: '100%',
        color: '#1A202C',
    },
});

export default AdminSyllabusScreen;