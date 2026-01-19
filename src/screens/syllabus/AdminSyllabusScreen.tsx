import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    ActivityIndicator, Alert, ScrollView, TextInput, Platform 
} from 'react-native';
import apiClient from '../../api/client';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';

// --- CONSTANTS ---
const EXAM_TYPES = ["AT1", "UT1", "AT2", "UT2", "SA1", "AT3", "UT3", "AT4", "UT4", "SA2"];
const FILTER_TYPES = ["Overall", ...EXAM_TYPES];

// --- Helper: Format Date for Display (DD/MM/YYYY) ---
const formatDateDisplay = (isoDateString) => {
    if (!isoDateString) return '';
    const date = new Date(isoDateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

// --- Helper: Format Date for Backend (YYYY-MM-DD) Local Time ---
const formatDateForBackend = (dateObj) => {
    if (!dateObj) return '';
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const day = dateObj.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// --- Main Component ---
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

    const handleDeleteSyllabus = (syllabusToDelete) => {
        Alert.alert(
            "Confirm Delete",
            `Are you sure you want to delete the syllabus for ${syllabusToDelete.class_group} - ${syllabusToDelete.subject_name}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await apiClient.delete(`/syllabus/${syllabusToDelete.id}`);
                            Alert.alert("Success", "Syllabus has been deleted.");
                            fetchData();
                        } catch (error) {
                            Alert.alert("Error", error.response?.data?.message || "Could not delete the syllabus.");
                        }
                    },
                },
            ]
        );
    };

    const filteredSyllabuses = useMemo(() => {
        if (selectedClassFilter === 'All') return syllabuses;
        return syllabuses.filter(s => s.class_group === selectedClassFilter);
    }, [selectedClassFilter, syllabuses]);

    return (
        <View style={styles.container}>
            
            {/* --- UPDATED HEADER CARD (Matches Reference) --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerContentWrapper}>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="menu-book" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Syllabus</Text>
                        <Text style={styles.headerSubtitle}>Manage syllabus data</Text>
                    </View>
                </View>
                
                {/* Add Button positioned to the right */}
                <TouchableOpacity style={styles.headerBtn} onPress={onCreate}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.headerBtnText}>Add</Text>
                </TouchableOpacity>
            </View>
            
            <View style={styles.filterContainer}>
                <Text style={styles.filterLabel}>Filter Class:</Text>
                <View style={styles.pickerWrapper}>
                    <Picker
                        selectedValue={selectedClassFilter}
                        onValueChange={(itemValue) => setSelectedClassFilter(itemValue)}
                        style={styles.picker}
                        mode="dropdown"
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
                            <View>
                                <Text style={styles.cardTitle}>{item.subject_name}</Text>
                                <Text style={styles.cardClassBadge}>{item.class_group}</Text>
                            </View>
                           <View style={styles.cardActions}>
                                <TouchableOpacity onPress={() => onEdit(item)} style={styles.actionIconBtn}>
                                    <MaterialIcons name="edit" size={20} color="#3b82f6" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteSyllabus(item)} style={[styles.actionIconBtn, {backgroundColor: '#fee2e2'}]}>
                                    <MaterialIcons name="delete" size={20} color="#ef4444" />
                                </TouchableOpacity>
                           </View>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.cardInfoRow}>
                            <MaterialIcons name="library-books" size={16} color="#64748b" />
                            <Text style={styles.cardDetailText}>{item.lesson_count} Lessons</Text>
                        </View>
                        <View style={styles.cardInfoRow}>
                             <MaterialIcons name="person" size={16} color="#64748b" />
                            <Text style={styles.cardDetailText}>{item.creator_name}</Text>
                        </View>
                        
                        <TouchableOpacity style={styles.viewProgressButton} onPress={() => onViewProgress(item)}>
                            <Text style={styles.buttonTextSmall}>View Progress</Text>
                            <MaterialIcons name="arrow-forward" size={16} color="#fff" />
                        </TouchableOpacity>
                    </View>
                )}
                onRefresh={fetchData}
                refreshing={isLoading}
                ListEmptyComponent={!isLoading && <Text style={styles.emptyText}>No syllabuses found.</Text>}
                contentContainerStyle={{ paddingBottom: 100 }}
            />
        </View>
    );
};

const CreateOrEditSyllabus = ({ initialSyllabus, onFinish }) => {
    const isEditMode = !!initialSyllabus;
    
    // Form States
    const [selectedClass, setSelectedClass] = useState(isEditMode ? initialSyllabus.class_group : '');
    const [selectedSubject, setSelectedSubject] = useState(isEditMode ? initialSyllabus.subject_name : '');
    const [selectedTeacherId, setSelectedTeacherId] = useState(isEditMode ? initialSyllabus.creator_id : '');
    
    // Lessons State
    const [lessons, setLessons] = useState([{ lessonName: '', examType: 'AT1', fromDate: new Date(), toDate: new Date() }]);
    
    // Dropdown Data
    const [allClasses, setAllClasses] = useState([]);
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [availableTeachers, setAvailableTeachers] = useState([]);
    
    // UI Loading States
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubjectsLoading, setIsSubjectsLoading] = useState(false);

    // Date Picker Logic
    const [datePickerState, setDatePickerState] = useState({ show: false, index: null, mode: 'from' });

    useEffect(() => {
        const bootstrapForm = async () => {
            setIsLoading(true);
            try {
                const [classRes, teacherRes] = await Promise.all([
                    apiClient.get('/student-classes'),
                    apiClient.get('/teachers/all-simple') 
                ]);

                const filteredClasses = classRes.data.filter(c => c && (c.startsWith('Class') || c === 'LKG' || c === 'UKG'));
                setAllClasses(filteredClasses);
                setAvailableTeachers(teacherRes.data);

                if (isEditMode) {
                    await handleClassChange(initialSyllabus.class_group, true);
                    await handleSubjectChange(initialSyllabus.subject_name, true);
                    
                    const syllabusDetailsRes = await apiClient.get(`/syllabus/teacher/${initialSyllabus.class_group}/${initialSyllabus.subject_name}`);
                    const syllabusData = syllabusDetailsRes.data;
                    
                    const formattedLessons = syllabusData.lessons.map(l => ({ 
                        lessonName: l.lesson_name,
                        examType: l.exam_type || 'AT1',
                        fromDate: new Date(l.from_date),
                        toDate: new Date(l.to_date) 
                    }));
                    setLessons(formattedLessons.length > 0 ? formattedLessons : [{ lessonName: '', examType: 'AT1', fromDate: new Date(), toDate: new Date() }]);
                    setSelectedTeacherId(initialSyllabus.creator_id.toString());
                }
            } catch (e) { console.error(e); Alert.alert("Error", "Could not load data."); } 
            finally { setIsLoading(false); }
        };
        bootstrapForm();
    }, []);

    const handleClassChange = async (classGroup, isInitialLoad = false) => {
        if (!isInitialLoad) {
            setSelectedSubject(''); setAvailableSubjects([]);
        }
        setSelectedClass(classGroup);
        if (!classGroup) return;

        setIsSubjectsLoading(true);
        try {
            const subjectRes = await apiClient.get(`/subjects-for-class/${classGroup}`);
            setAvailableSubjects(subjectRes.data);
        } catch (error) { console.error(error); } 
        finally { setIsSubjectsLoading(false); }
    };

    const handleSubjectChange = async (subjectName, isInitialLoad = false) => {
        setSelectedSubject(subjectName);
    };

    const openDatePicker = (index, mode) => {
        setDatePickerState({ show: true, index, mode });
    };

    const onDateChange = (event, selectedDate) => {
        if (event.type === 'dismissed') {
            setDatePickerState({ ...datePickerState, show: false });
            return;
        }
        if (selectedDate && datePickerState.index !== null) {
            const newLessons = [...lessons];
            if (datePickerState.mode === 'from') {
                newLessons[datePickerState.index].fromDate = selectedDate;
            } else {
                newLessons[datePickerState.index].toDate = selectedDate;
            }
            setLessons(newLessons);
            if(Platform.OS === 'android') setDatePickerState({ ...datePickerState, show: false });
        }
    };

    const handleLessonNameChange = (index, text) => {
        const newLessons = [...lessons];
        newLessons[index].lessonName = text;
        setLessons(newLessons);
    };

    const handleExamChange = (index, value) => {
        const newLessons = [...lessons];
        newLessons[index].examType = value;
        setLessons(newLessons);
    };

    const addLessonField = () => setLessons([...lessons, { lessonName: '', examType: 'AT1', fromDate: new Date(), toDate: new Date() }]);
    const removeLessonField = (index) => setLessons(lessons.filter((_, i) => i !== index));

    const handleSaveSyllabus = async () => {
        if (!selectedClass || !selectedSubject || !selectedTeacherId) return Alert.alert("Required", "Please select Class, Subject and Teacher.");
        
        const validLessons = lessons
            .filter(l => l.lessonName.trim())
            .map(l => ({
                lessonName: l.lessonName,
                examType: l.examType,
                fromDate: formatDateForBackend(l.fromDate),
                toDate: formatDateForBackend(l.toDate)
            }));

        if (validLessons.length === 0) return Alert.alert("Required", "Please add at least one lesson name.");
        
        setIsSaving(true);
        try {
            const payload = {
                class_group: selectedClass,
                subject_name: selectedSubject,
                lessons: validLessons,
                creator_id: selectedTeacherId,
            };

            if (isEditMode) {
                await apiClient.put(`/syllabus/${initialSyllabus.id}`, payload);
            } else {
                await apiClient.post('/syllabus/create', payload);
            }

            Alert.alert("Success", "Syllabus saved successfully!");
            onFinish();
        } catch (error) {
            Alert.alert("Error", error.response?.data?.message || "Failed to save.");
        } finally {
            setIsSaving(false);
        }
    };
    
    if (isLoading) return <View style={styles.centered}><ActivityIndicator size="large" color="#4f46e5" /></View>;

    return (
        <View style={styles.container}>
            {/* Simple Header for Edit/Create - keeping as is but ensuring safe spacing */}
            <View style={[styles.headerCard, { justifyContent: 'flex-start', gap: 10 }]}>
                 <TouchableOpacity onPress={onFinish} style={{ padding: 4 }}>
                    <MaterialIcons name="arrow-back" size={24} color="#333333" />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                     <Text style={styles.headerTitle}>{isEditMode ? 'Edit Syllabus' : 'New Syllabus'}</Text>
                </View>
            </View>

            <ScrollView style={styles.formContainer} contentContainerStyle={{paddingBottom: 40}}>
                <View style={styles.formSection}>
                    <Text style={styles.sectionHeader}>Class Details</Text>
                    
                    <Text style={styles.label}>Class</Text>
                    <View style={styles.inputWrapper}>
                        <Picker selectedValue={selectedClass} onValueChange={handleClassChange} enabled={!isEditMode}>
                            <Picker.Item label="Select Class..." value="" color="#94a3b8"/>
                            {allClasses.map((c, i) => <Picker.Item key={i} label={c} value={c} color="#0f172a"/>)}
                        </Picker>
                    </View>

                    <Text style={styles.label}>Subject</Text>
                    <View style={styles.inputWrapper}>
                        <Picker selectedValue={selectedSubject} onValueChange={handleSubjectChange} enabled={!isEditMode && !!selectedClass}>
                            <Picker.Item label={isSubjectsLoading ? "Loading..." : "Select Subject..."} value="" color="#94a3b8"/>
                            {availableSubjects.map((s, i) => <Picker.Item key={i} label={s} value={s} color="#0f172a"/>)}
                        </Picker>
                    </View>

                    <Text style={styles.label}>Assign Teacher</Text>
                    <View style={styles.inputWrapper}>
                        <Picker selectedValue={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                            <Picker.Item label="Select Teacher..." value="" color="#94a3b8"/>
                            {availableTeachers.map((t) => <Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} color="#0f172a"/>)}
                        </Picker>
                    </View>
                </View>

                <View style={styles.formSection}>
                    <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 15}}>
                        <Text style={styles.sectionHeader}>Lessons Plan</Text>
                        <Text style={styles.countBadge}>{lessons.length} Items</Text>
                    </View>

                    {lessons.map((lesson, index) => (
                        <View key={index} style={styles.lessonRow}>
                            <View style={styles.lessonHeaderRow}>
                                <Text style={styles.lessonIndex}>#{index + 1}</Text>
                                {lessons.length > 1 && (
                                    <TouchableOpacity onPress={() => removeLessonField(index)}>
                                        <MaterialIcons name="close" size={20} color="#ef4444" />
                                    </TouchableOpacity>
                                )}
                            </View>
                            
                            <TextInput 
                                style={styles.input} 
                                placeholder="Enter Lesson Name" 
                                value={lesson.lessonName} 
                                onChangeText={(text) => handleLessonNameChange(index, text)} 
                            />

                            <Text style={styles.labelSmall}>Exam Type</Text>
                            <View style={styles.inputWrapperSmall}>
                                <Picker
                                    selectedValue={lesson.examType}
                                    onValueChange={(val) => handleExamChange(index, val)}
                                    style={{ height: 50, width: '100%' }}
                                >
                                    {EXAM_TYPES.map(type => (
                                        <Picker.Item key={type} label={type} value={type} />
                                    ))}
                                </Picker>
                            </View>
                            
                            <View style={{flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 10}}>
                                <TouchableOpacity 
                                    style={[styles.dateSelector, {flex: 1}]} 
                                    onPress={() => openDatePicker(index, 'from')}
                                >
                                    <Text style={styles.dateLabelSmall}>Start Date</Text>
                                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                        <MaterialIcons name="event" size={18} color="#4f46e5" />
                                        <Text style={styles.dateText}>
                                            {formatDateDisplay(lesson.fromDate.toISOString())}
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.dateSelector, {flex: 1}]} 
                                    onPress={() => openDatePicker(index, 'to')}
                                >
                                    <Text style={styles.dateLabelSmall}>End Date</Text>
                                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                        <MaterialIcons name="event-available" size={18} color="#4f46e5" />
                                        <Text style={styles.dateText}>
                                            {formatDateDisplay(lesson.toDate.toISOString())}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                    
                    <TouchableOpacity style={styles.addLessonBtn} onPress={addLessonField}>
                        <MaterialIcons name="add-circle-outline" size={20} color="#4f46e5" />
                        <Text style={styles.addLessonBtnText}>Add Another Lesson</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.saveButton} onPress={handleSaveSyllabus} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Syllabus</Text>}
                </TouchableOpacity>
            </ScrollView>

            {datePickerState.show && (
                <DateTimePicker
                    value={datePickerState.mode === 'from' ? lessons[datePickerState.index].fromDate : lessons[datePickerState.index].toDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                    minimumDate={new Date(2023, 0, 1)}
                />
            )}
        </View>
    );
};

const AdminProgressView = ({ syllabus, onBack }) => {
    const [auditLog, setAuditLog] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [selectedFilter, setSelectedFilter] = useState("Overall");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchProgress = async () => {
            if (!syllabus?.id) return;
            setIsLoading(true);
            try {
                const response = await apiClient.get(`/syllabus/class-progress/${syllabus.id}`);
                setAuditLog(response.data);
                setFilteredLogs(response.data);
            } catch (error) {
                Alert.alert("Error", "Could not load class progress.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchProgress();
    }, [syllabus]);

    const handleFilter = (type) => {
        setSelectedFilter(type);
        if (type === "Overall") {
            setFilteredLogs(auditLog);
        } else {
            const filtered = auditLog.filter(item => item.exam_type === type);
            setFilteredLogs(filtered);
        }
    };

    return (
        <View style={styles.container}>
            {/* --- UPDATED HEADER CARD (Progress) --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerContentWrapper}>
                    {/* Back Button */}
                    <TouchableOpacity onPress={onBack} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color="#333333" />
                    </TouchableOpacity>

                    <View style={[styles.headerIconContainer, { backgroundColor: '#e0e7ff' }]}>
                         <MaterialIcons name="trending-up" size={24} color="#4f46e5" />
                    </View>
                    
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Progress</Text>
                        <Text style={styles.headerSubtitle}>{syllabus?.class_group} • {syllabus?.subject_name}</Text>
                    </View>
                </View>
            </View>

            {/* Filter Bar */}
            <View style={styles.filterBarContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    {FILTER_TYPES.map((type) => (
                        <TouchableOpacity 
                            key={type} 
                            style={[styles.filterTab, selectedFilter === type && styles.filterTabActive]}
                            onPress={() => handleFilter(type)}
                        >
                            <Text style={[styles.filterText, selectedFilter === type && styles.filterTextActive]}>
                                {type}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {isLoading ? <ActivityIndicator size="large" style={{ marginTop: 50 }} color="#4f46e5"/> : (
                <FlatList
                    data={filteredLogs}
                    keyExtractor={(item) => item.lesson_id.toString()}
                    contentContainerStyle={{ padding: 15 }}
                    ListEmptyComponent={<Text style={styles.emptyText}>No lessons found for {selectedFilter}</Text>}
                    renderItem={({ item }) => (
                        <View style={styles.logCard}>
                            <View style={[styles.statusStrip, { backgroundColor: item.status === 'Completed' ? '#10b981' : item.status === 'Missed' ? '#ef4444' : '#f59e0b' }]} />
                            <View style={styles.logContent}>
                                <Text style={styles.logTitle}>{item.lesson_name}</Text>
                                <Text style={styles.examBadge}>{item.exam_type}</Text>
                                <View style={styles.logMetaRow}>
                                    <MaterialIcons name="date-range" size={14} color="#64748b" />
                                    <Text style={styles.logMetaText}>
                                        {formatDateDisplay(item.from_date)} - {formatDateDisplay(item.to_date)}
                                    </Text>
                                </View>
                                <View style={styles.logMetaRow}>
                                    <Text style={[styles.statusBadge, { color: item.status === 'Completed' ? '#10b981' : item.status === 'Missed' ? '#ef4444' : '#f59e0b' }]}>
                                        {item.status}
                                    </Text>
                                    {item.updater_name && <Text style={styles.logMetaText}>by {item.updater_name}</Text>}
                                </View>
                            </View>
                        </View>
                    )}
                />
            )}
        </View>
    );
};

// --- STYLES ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F5F8' }, // Matches reference background
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // --- UPDATED HEADER STYLES (From Reference) ---
    headerCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 15,
        paddingVertical: 10, // REDUCED Padding (Smaller box height)
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between', // Push button to right
        elevation: 3,
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerContentWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1, // Takes available space
    },
    headerIconContainer: {
        backgroundColor: '#E0F2F1',
        borderRadius: 30,
        width: 45, // Slightly smaller circle to match reduced height
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: {
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 22, // INCREASED Font Size
        fontWeight: 'bold',
        color: '#333333',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666666',
        marginTop: 1,
    },
    // Button inside Header
    headerBtn: {
        backgroundColor: '#10b981', 
        paddingVertical: 6, // Slightly reduced to fit header
        paddingHorizontal: 12,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 10,
    },
    headerBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    // ----------------------------

    // Filter Area
    filterContainer: { paddingHorizontal: 15, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    filterLabel: { fontSize: 14, fontWeight: '600', color: '#64748b' },
    pickerWrapper: { flex: 1, marginLeft: 10, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', height: 45, justifyContent: 'center' },

    // Card Styles
    card: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 15, marginBottom: 15, padding: 15, shadowColor: '#64748b', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    cardClassBadge: { fontSize: 12, backgroundColor: '#e0e7ff', color: '#4338ca', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 12, overflow: 'hidden', alignSelf: 'flex-start', marginTop: 4 },
    cardActions: { flexDirection: 'row', gap: 8 },
    actionIconBtn: { padding: 8, backgroundColor: '#eff6ff', borderRadius: 8 },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 10 },
    cardInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    cardDetailText: { marginLeft: 8, color: '#475569', fontSize: 14 },
    viewProgressButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4f46e5', padding: 10, borderRadius: 10, marginTop: 10 },
    buttonTextSmall: { color: '#fff', fontWeight: '600', fontSize: 14, marginRight: 5 },

    // Form Styles
    formContainer: { padding: 15 },
    formSection: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
    sectionHeader: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 15 },
    label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 10 },
    labelSmall: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 8, marginBottom: 4 },
    inputWrapper: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, backgroundColor: '#f8fafc', overflow: 'hidden' },
    inputWrapperSmall: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, backgroundColor: '#f8fafc', overflow: 'hidden' },
    input: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, fontSize: 15, color: '#334155' },
    
    // Lesson Row
    lessonRow: { marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    lessonHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    lessonIndex: { fontSize: 12, color: '#94a3b8', fontWeight: 'bold' },
    dateSelector: { marginTop: 5, padding: 10, backgroundColor: '#eff6ff', borderRadius: 10, borderWidth: 1, borderColor: '#dbeafe' },
    dateLabelSmall: { fontSize: 10, color: '#6366f1', marginBottom: 2, textTransform: 'uppercase' },
    dateText: { marginLeft: 6, color: '#1e293b', fontWeight: '600', fontSize: 14 },
    addLessonBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#6366f1', borderRadius: 10, backgroundColor: '#eef2ff' },
    addLessonBtnText: { marginLeft: 8, color: '#4f46e5', fontWeight: '600' },
    countBadge: { fontSize: 12, color: '#64748b' },
    
    // Save Button
    saveButton: { backgroundColor: '#10b981', padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#10b981', shadowOpacity: 0.3, shadowOffset: {width: 0, height: 4}, elevation: 4 },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    // Progress Filter Bar Styles
    filterBarContainer: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 10 },
    filterScroll: { paddingHorizontal: 15, paddingVertical: 12 },
    filterTab: { marginRight: 15, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#f1f5f9' },
    filterTabActive: { backgroundColor: '#4f46e5' },
    filterText: { color: '#64748b', fontWeight: '600', fontSize: 13 },
    filterTextActive: { color: '#fff' },

    // Log Card (Progress)
    logCard: { flexDirection: 'row', backgroundColor: '#fff', marginBottom: 10, borderRadius: 12, overflow: 'hidden', elevation: 1 },
    statusStrip: { width: 6 },
    logContent: { flex: 1, padding: 12 },
    logTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
    logMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, justifyContent: 'space-between' },
    logMetaText: { fontSize: 13, color: '#64748b', marginLeft: 5 },
    statusBadge: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    examBadge: { fontSize: 10, color: '#fff', backgroundColor: '#6366f1', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, overflow: 'hidden', fontWeight: 'bold' },
    emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8' }
});

export default AdminSyllabusScreen;