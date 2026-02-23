import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    ActivityIndicator, Alert, ScrollView, TextInput, Platform,
    SafeAreaView, useColorScheme, StatusBar, Dimensions
} from 'react-native';
import apiClient from '../../api/client';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080', background: '#F5F7FA', cardBg: '#FFFFFF',
    textMain: '#263238', textSub: '#546E7A', border: '#CFD8DC',
    inputBg: '#FAFAFA', iconGrey: '#90A4AE', danger: '#E53935',
    success: '#43A047', warning: '#FFA000', headerIconBg: '#E0F2F1',
    divider: '#f0f2f5', tabInactive: '#eceff1'
};

const DarkColors = {
    primary: '#008080', background: '#121212', cardBg: '#1E1E1E',
    textMain: '#E0E0E0', textSub: '#B0B0B0', border: '#333333',
    inputBg: '#2C2C2C', iconGrey: '#757575', danger: '#EF5350',
    success: '#66BB6A', warning: '#FFA726', headerIconBg: '#333333',
    divider: '#2C2C2C', tabInactive: '#263238'
};

const EXAM_TYPES = ["AT1", "UT1", "AT2", "UT2", "SA1", "AT3", "UT3", "AT4", "UT4", "SA2"];

// --- DYNAMIC CARD COLORS ---
const DYNAMIC_COLORS = [
    { border: '#0D9488', bg: '#F0FDFA', text: '#0F766E' }, // Teal
    { border: '#0284C7', bg: '#F0F9FF', text: '#0369A1' }, // Blue
    { border: '#7C3AED', bg: '#F5F3FF', text: '#6D28D9' }, // Violet
    { border: '#EA580C', bg: '#FFF7ED', text: '#C2410C' }, // Orange
    { border: '#E11D48', bg: '#FFF1F2', text: '#BE123C' }, // Rose
    { border: '#16A34A', bg: '#F0FDF4', text: '#15803D' }, // Green
];

// --- HELPERS ---
const formatDateDisplay = (isoDateString) => {
    if (!isoDateString) return '';
    const date = new Date(isoDateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
};

const formatDateForBackend = (dateObj) => {
    if (!dateObj) return '';
    return `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;
};

// --- Main Component ---
const AdminSyllabusScreen = () => {
    const [view, setView] = useState('classes'); // 'classes' | 'subjects' | 'createOrEdit' | 'progressDetail'
    const [selectedClass, setSelectedClass] = useState(null);
    const [selectedSyllabus, setSelectedSyllabus] = useState(null);

    const navigateTo = (targetView, data = null, classGrp = null) => { 
        if (data) setSelectedSyllabus(data); 
        if (classGrp) setSelectedClass(classGrp);
        setView(targetView); 
    };

    if (view === 'classes') return <ClassListScreen onSelectClass={(c) => navigateTo('subjects', null, c)} />;
    
    if (view === 'subjects') {
        return <SubjectListScreen 
            classGroup={selectedClass} 
            onBack={() => navigateTo('classes')}
            onEdit={(syllabus) => navigateTo('createOrEdit', syllabus)} 
            onCreate={() => navigateTo('createOrEdit')} 
            onViewProgress={(syllabus) => navigateTo('progressDetail', syllabus)} 
        />;
    }
    
    if (view === 'createOrEdit') {
        return <CreateOrEditSyllabus 
            initialSyllabus={selectedSyllabus} 
            fixedClassGroup={selectedClass}
            onFinish={() => navigateTo('subjects')} 
        />;
    }
    
    if (view === 'progressDetail') {
        return <AdminProgressView syllabus={selectedSyllabus} onBack={() => navigateTo('subjects')} />;
    }
    
    return null;
};

// --- Sub-Component 1: Class Selection (2-Column Grid) ---
const ClassListScreen = ({ onSelectClass }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;
    
    const [allClasses, setAllClasses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const isFocused = useIsFocused();

    useEffect(() => {
        const fetchClasses = async () => {
            setIsLoading(true);
            try {
                const classesRes = await apiClient.get('/all-classes');
                const filtered = classesRes.data.filter(c => c && (c.startsWith('Class') || c === 'LKG' || c === 'UKG'));
                setAllClasses(filtered);
            } catch (e) { Alert.alert("Error", "Could not load classes."); }
            finally { setIsLoading(false); }
        };
        if (isFocused) fetchClasses();
    }, [isFocused]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={COLORS.background} />
            
            <View style={[styles.cleanHeader, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                <Text style={[styles.cleanHeaderTitle, { color: COLORS.textMain }]}>Syllabus Tracking</Text>
            </View>

            {isLoading ? <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop: 50}} /> : (
                <FlatList
                    data={allClasses}
                    keyExtractor={(item) => item}
                    numColumns={2} // <--- Enables the 2 column grid
                    columnWrapperStyle={styles.rowWrapper} // <--- Spaces the columns out evenly
                    contentContainerStyle={{ paddingBottom: 100, paddingTop: 5 }}
                    renderItem={({ item, index }) => {
                        const theme = DYNAMIC_COLORS[index % DYNAMIC_COLORS.length];
                        
                        return (
                            <TouchableOpacity 
                                style={[
                                    styles.dynamicClassCard, 
                                    { 
                                        borderColor: theme.border, 
                                        backgroundColor: isDark ? COLORS.cardBg : theme.bg 
                                    }
                                ]} 
                                onPress={() => onSelectClass(item)}
                                activeOpacity={0.7}
                            >
                                <Text 
                                    style={[styles.dynamicClassText, { color: isDark ? theme.border : theme.text }]}
                                    numberOfLines={1}
                                >
                                    {item}
                                </Text>
                                <MaterialIcons 
                                    name="chevron-right" 
                                    size={24} // Slightly smaller icon for the smaller boxes
                                    color={isDark ? theme.border : theme.text} 
                                />
                            </TouchableOpacity>
                        );
                    }}
                />
            )}
        </SafeAreaView>
    );
};

// --- Sub-Component 2: Subject List for a specific class ---
const SubjectListScreen = ({ classGroup, onBack, onEdit, onCreate, onViewProgress }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const [syllabuses, setSyllabuses] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const isFocused = useIsFocused();

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await apiClient.get('/syllabus/all');
            setSyllabuses(res.data.filter(s => s.class_group === classGroup));
        } catch (error) { Alert.alert("Error", "Failed to load subjects."); } 
        finally { setIsLoading(false); }
    }, [classGroup]);

    useEffect(() => { if (isFocused) fetchData(); }, [isFocused, fetchData]);

    const handleMenuPress = (item) => {
        Alert.alert(
            "Manage Syllabus", `${item.subject_name}`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Edit Syllabus", onPress: () => onEdit(item) },
                { text: "Delete", style: "destructive", onPress: async () => {
                    try {
                        await apiClient.delete(`/syllabus/${item.id}`);
                        fetchData();
                    } catch (e) { Alert.alert("Error", "Could not delete."); }
                }}
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                <View style={styles.headerContentWrapper}>
                    <TouchableOpacity onPress={onBack} style={{marginRight: 10}}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>
                    <View>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>{classGroup}</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Manage Subjects</Text>
                    </View>
                </View>
                <TouchableOpacity style={[styles.headerBtn, { backgroundColor: COLORS.primary }]} onPress={onCreate}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.headerBtnText}>Add</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={syllabuses}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={[styles.card, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                        <View style={styles.cardHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.cardTitle, { color: COLORS.textMain }]}>{item.subject_name}</Text>
                                <View style={[styles.classBadgeContainer, { backgroundColor: isDark ? '#1A3333' : '#E0F2F1' }]}>
                                    <Text style={[styles.cardClassBadge, { color: COLORS.primary }]}>{item.class_group}</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => handleMenuPress(item)} style={styles.menuIconBtn}>
                                <MaterialIcons name="more-vert" size={26} color={COLORS.iconGrey} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={[styles.divider, { backgroundColor: COLORS.divider }]} />
                        
                        <View style={styles.cardInfoRow}>
                            <MaterialIcons name="library-books" size={16} color={COLORS.textSub} />
                            <Text style={[styles.cardDetailText, { color: COLORS.textSub }]}>{item.lesson_count} Lessons</Text>
                        </View>
                        <View style={styles.cardInfoRow}>
                             <MaterialIcons name="person" size={16} color={COLORS.textSub} />
                            <Text style={[styles.cardDetailText, { color: COLORS.textSub }]}>{item.creator_name}</Text>
                        </View>
                        
                        <TouchableOpacity style={[styles.viewProgressButton, { backgroundColor: COLORS.primary }]} onPress={() => onViewProgress(item)}>
                            <Text style={styles.buttonTextSmall}>View Progress</Text>
                            <MaterialIcons name="arrow-forward" size={16} color="#fff" />
                        </TouchableOpacity>
                    </View>
                )}
                onRefresh={fetchData}
                refreshing={isLoading}
                ListEmptyComponent={!isLoading && <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No subjects configured for this class.</Text>}
            />
        </SafeAreaView>
    );
};

// --- Sub-Component 3: Create/Edit Form (Tabbed) ---
const CreateOrEditSyllabus = ({ initialSyllabus, fixedClassGroup, onFinish }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;
    const isEditMode = !!initialSyllabus;
    
    const [activeTab, setActiveTab] = useState('lessons'); // 'lessons' | 'exams'
    const [selectedSubject, setSelectedSubject] = useState(isEditMode ? initialSyllabus.subject_name : '');
    const [selectedTeacherId, setSelectedTeacherId] = useState(isEditMode ? initialSyllabus.creator_id.toString() : '');
    const [lessons, setLessons] = useState([{ id: Date.now(), lessonName: '', examType: 'Unassigned', fromDate: new Date(), toDate: new Date() }]);
    const [examFilter, setExamFilter] = useState('AT1');

    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [availableTeachers, setAvailableTeachers] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [datePickerState, setDatePickerState] = useState({ show: false, index: null, mode: 'from' });

    useEffect(() => {
        const bootstrapForm = async () => {
            setIsLoading(true);
            try {
                const [teacherRes, subjectRes] = await Promise.all([
                    apiClient.get('/teachers/all-simple'),
                    apiClient.get(`/subjects-for-class/${fixedClassGroup}`)
                ]);
                setAvailableTeachers(teacherRes.data);
                setAvailableSubjects(subjectRes.data);

                if (isEditMode) {
                    const syllabusDetailsRes = await apiClient.get(`/syllabus/teacher/${fixedClassGroup}/${initialSyllabus.subject_name}`);
                    const formattedLessons = syllabusDetailsRes.data.lessons.map(l => ({ 
                        id: l.id || Date.now() + Math.random(),
                        lessonName: l.lesson_name, 
                        examType: l.exam_type || 'Unassigned',
                        fromDate: new Date(l.from_date), 
                        toDate: new Date(l.to_date) 
                    }));
                    setLessons(formattedLessons.length > 0 ? formattedLessons : [{ id: Date.now(), lessonName: '', examType: 'Unassigned', fromDate: new Date(), toDate: new Date() }]);
                }
            } catch (e) { Alert.alert("Error", "Could not load data."); } 
            finally { setIsLoading(false); }
        };
        bootstrapForm();
    }, []);

    const onDateChange = (event, selectedDate) => {
        if (event.type === 'dismissed') { setDatePickerState({ ...datePickerState, show: false }); return; }
        if (selectedDate && datePickerState.index !== null) {
            const newLessons = [...lessons];
            if (datePickerState.mode === 'from') newLessons[datePickerState.index].fromDate = selectedDate;
            else newLessons[datePickerState.index].toDate = selectedDate;
            setLessons(newLessons);
            if(Platform.OS === 'android') setDatePickerState({ ...datePickerState, show: false });
        }
    };

    const toggleLessonExam = (index) => {
        const newLessons = [...lessons];
        if (newLessons[index].examType === examFilter) {
            newLessons[index].examType = 'Unassigned';
        } else {
            newLessons[index].examType = examFilter;
        }
        setLessons(newLessons);
    };

    const handleSaveSyllabus = async () => {
        if (!selectedSubject || !selectedTeacherId) return Alert.alert("Required", "Please select Subject and Teacher.");
        
        const validLessons = lessons.filter(l => l.lessonName.trim()).map(l => ({
            lessonName: l.lessonName, 
            examType: l.examType,
            fromDate: formatDateForBackend(l.fromDate), 
            toDate: formatDateForBackend(l.toDate)
        }));

        if (validLessons.length === 0) return Alert.alert("Required", "Add at least one valid lesson.");
        
        const unassignedCount = validLessons.filter(l => l.examType === 'Unassigned').length;
        if (unassignedCount > 0) {
            return Alert.alert("Missing Exam Types", `Please assign an Exam Type to all lessons. ${unassignedCount} lesson(s) unassigned.`);
        }

        setIsSaving(true);
        try {
            const payload = { class_group: fixedClassGroup, subject_name: selectedSubject, lessons: validLessons, creator_id: selectedTeacherId };
            if (isEditMode) await apiClient.put(`/syllabus/${initialSyllabus.id}`, payload);
            else await apiClient.post('/syllabus/create', payload);
            
            Alert.alert("Success", "Syllabus saved!");
            onFinish();
        } catch (error) { Alert.alert("Error", "Failed to save."); } 
        finally { setIsSaving(false); }
    };

    if (isLoading) return <View style={[styles.centered, { backgroundColor: COLORS.background }]}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
             <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                 <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <TouchableOpacity onPress={onFinish} style={{ padding: 4, marginRight: 10 }}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>
                    <View>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain, fontSize: 18 }]}>{isEditMode ? 'Edit Syllabus' : 'New Syllabus'}</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>{fixedClassGroup}</Text>
                    </View>
                 </View>
            </View>
            
            <View style={[styles.tabContainer, { backgroundColor: COLORS.cardBg }]}>
                <TouchableOpacity 
                    style={[styles.tabButton, activeTab === 'lessons' && { borderBottomColor: COLORS.primary, borderBottomWidth: 3 }]} 
                    onPress={() => setActiveTab('lessons')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'lessons' ? COLORS.primary : COLORS.textSub }]}>Assign Lessons</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tabButton, activeTab === 'exams' && { borderBottomColor: COLORS.primary, borderBottomWidth: 3 }]} 
                    onPress={() => setActiveTab('exams')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'exams' ? COLORS.primary : COLORS.textSub }]}>Assign Exam Type</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContainer} contentContainerStyle={{paddingBottom: 40}}>
                {activeTab === 'lessons' && (
                    <View>
                        <View style={[styles.formSection, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                            <Text style={[styles.label, { color: COLORS.textSub, marginTop: 0 }]}>Subject</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                                <Picker selectedValue={selectedSubject} onValueChange={setSelectedSubject} enabled={!isEditMode} style={{color: COLORS.textMain}} dropdownIconColor={COLORS.textMain}>
                                    <Picker.Item label="Select Subject..." value="" color={COLORS.textMain} />
                                    {availableSubjects.map((s, i) => <Picker.Item key={i} label={s} value={s} color={COLORS.textMain} />)}
                                </Picker>
                            </View>
                            
                            <Text style={[styles.label, { color: COLORS.textSub }]}>Teacher</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                                <Picker selectedValue={selectedTeacherId} onValueChange={setSelectedTeacherId} style={{color: COLORS.textMain}} dropdownIconColor={COLORS.textMain}>
                                    <Picker.Item label="Select Teacher..." value="" color={COLORS.textMain} />
                                    {availableTeachers.map((t) => <Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} color={COLORS.textMain} />)}
                                </Picker>
                            </View>
                        </View>

                        <View style={[styles.formSection, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                            {lessons.map((lesson, index) => (
                                <View key={lesson.id} style={[styles.lessonRow, { borderBottomColor: COLORS.divider }]}>
                                    <View style={styles.lessonHeaderRow}>
                                        <Text style={[styles.lessonIndex, { color: COLORS.textSub }]}>Lesson #{index + 1}</Text>
                                        {lessons.length > 1 && (
                                            <TouchableOpacity onPress={() => setLessons(lessons.filter((_, i) => i !== index))}>
                                                <MaterialIcons name="close" size={20} color={COLORS.danger} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <TextInput 
                                        style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} 
                                        placeholder="Lesson Name" 
                                        placeholderTextColor={COLORS.textSub} 
                                        value={lesson.lessonName} 
                                        onChangeText={(t) => { const nl = [...lessons]; nl[index].lessonName = t; setLessons(nl); }} 
                                    />
                                    <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                                        <TouchableOpacity style={[styles.dateSelector, { flex: 1, backgroundColor: isDark ? '#2C3E50' : '#E0F7FA', borderColor: COLORS.border }]} onPress={() => setDatePickerState({ show: true, index, mode: 'from' })}>
                                            <Text style={[styles.dateLabelSmall, { color: COLORS.primary }]}>Start</Text>
                                            <Text style={[styles.dateText, { color: COLORS.textMain }]}>{formatDateDisplay(lesson.fromDate.toISOString())}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.dateSelector, { flex: 1, backgroundColor: isDark ? '#2C3E50' : '#E0F7FA', borderColor: COLORS.border }]} onPress={() => setDatePickerState({ show: true, index, mode: 'to' })}>
                                            <Text style={[styles.dateLabelSmall, { color: COLORS.primary }]}>End</Text>
                                            <Text style={[styles.dateText, { color: COLORS.textMain }]}>{formatDateDisplay(lesson.toDate.toISOString())}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                            <TouchableOpacity style={[styles.addLessonBtn, { borderColor: COLORS.primary, backgroundColor: isDark ? 'transparent' : '#F0FDF4' }]} onPress={() => setLessons([...lessons, { id: Date.now(), lessonName: '', examType: 'Unassigned', fromDate: new Date(), toDate: new Date() }])}>
                                <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>+ Add Lesson</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {activeTab === 'exams' && (
                    <View style={[styles.formSection, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                        <Text style={[styles.label, { color: COLORS.textSub, marginTop: 0 }]}>Select Exam Type</Text>
                        <View style={[styles.inputWrapper, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, marginBottom: 20 }]}>
                            <Picker selectedValue={examFilter} onValueChange={setExamFilter} style={{color: COLORS.textMain}} dropdownIconColor={COLORS.textMain}>
                                {EXAM_TYPES.map((e) => <Picker.Item key={e} label={e} value={e} color={COLORS.textMain} />)}
                            </Picker>
                        </View>

                        <Text style={[styles.sectionHeader, { color: COLORS.textMain, borderBottomColor: COLORS.divider }]}>Lessons</Text>
                        
                        {lessons.map((lesson, index) => {
                            const isSelected = lesson.examType === examFilter;
                            return (
                                <TouchableOpacity 
                                    key={lesson.id} 
                                    style={[styles.checkboxRow, { borderBottomColor: COLORS.divider }]}
                                    onPress={() => toggleLessonExam(index)}
                                    activeOpacity={0.7}
                                >
                                    <MaterialIcons 
                                        name={isSelected ? "check-box" : "check-box-outline-blank"} 
                                        size={24} 
                                        color={isSelected ? COLORS.primary : COLORS.iconGrey} 
                                    />
                                    <View style={{ marginLeft: 12, flex: 1 }}>
                                        <Text style={{ color: COLORS.textMain, fontSize: 16, fontWeight: isSelected ? '600' : '400' }}>
                                            {lesson.lessonName || `Lesson #${index + 1}`}
                                        </Text>
                                        {lesson.examType !== 'Unassigned' && !isSelected && (
                                            <Text style={{ fontSize: 11, color: COLORS.textSub, marginTop: 2 }}>Assigned to: {lesson.examType}</Text>
                                        )}
                                        {lesson.examType === 'Unassigned' && (
                                            <Text style={{ fontSize: 11, color: COLORS.danger, marginTop: 2 }}>Unassigned</Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            )
                        })}
                        
                        {lessons.length === 0 && (
                            <Text style={{ color: COLORS.textSub, textAlign: 'center', marginTop: 20 }}>No lessons added yet. Go to Assign Lessons tab.</Text>
                        )}
                    </View>
                )}
                
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: COLORS.primary }]} onPress={handleSaveSyllabus} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Syllabus</Text>}
                </TouchableOpacity>
            </ScrollView>

            {datePickerState.show && <DateTimePicker value={datePickerState.mode === 'from' ? lessons[datePickerState.index].fromDate : lessons[datePickerState.index].toDate} mode="date" display="default" onChange={onDateChange} />}
        </SafeAreaView>
    );
};


// --- Sub-Component 4: Progress View ---
const AdminProgressView = ({ syllabus, onBack }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;
    const [auditLog, setAuditLog] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchProgress = async () => {
            setIsLoading(true);
            try {
                const response = await apiClient.get(`/syllabus/class-progress/${syllabus.id}`);
                setAuditLog(response.data);
            } catch (error) { Alert.alert("Error", "Could not load progress."); } 
            finally { setIsLoading(false); }
        };
        fetchProgress();
    }, [syllabus]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                <View style={styles.headerContentWrapper}>
                    <TouchableOpacity onPress={onBack} style={{marginRight: 10}}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>
                    <View>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain, fontSize: 18 }]}>Progress</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>{syllabus?.class_group} • {syllabus?.subject_name}</Text>
                    </View>
                </View>
            </View>
            
            {isLoading ? <ActivityIndicator size="large" style={{ marginTop: 50 }} color={COLORS.primary}/> : (
                <FlatList
                    data={auditLog}
                    keyExtractor={(item) => item.lesson_id.toString()}
                    contentContainerStyle={{ padding: 15 }}
                    renderItem={({ item }) => (
                        <View style={[styles.logCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                            <View style={[styles.statusStrip, { backgroundColor: item.status === 'Completed' ? COLORS.success : item.status === 'Missed' ? COLORS.danger : COLORS.warning }]} />
                            <View style={styles.logContent}>
                                <Text style={[styles.logTitle, { color: COLORS.textMain }]}>{item.lesson_name}</Text>
                                <Text style={styles.examBadge}>{item.exam_type}</Text>
                                <View style={styles.logMetaRow}>
                                    <Text style={[styles.logMetaText, { color: COLORS.textSub }]}>{formatDateDisplay(item.from_date)} - {formatDateDisplay(item.to_date)}</Text>
                                    <Text style={[styles.statusBadge, { color: item.status === 'Completed' ? COLORS.success : item.status === 'Missed' ? COLORS.danger : COLORS.warning }]}>{item.status}</Text>
                                </View>
                            </View>
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
};

// --- STYLES ---
const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Core Header
    headerCard: {
        paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center', 
        marginTop: 15, marginBottom: 10, borderRadius: 12, flexDirection: 'row', 
        alignItems: 'center', justifyContent: 'space-between', elevation: 3,
        shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    },
    headerContentWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },
    headerBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    // Clean Header (For Class Selection Screen)
    cleanHeader: {
        paddingVertical: 18, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 15, 
        borderRadius: 12, alignItems: 'center', elevation: 2,
        shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }
    },
    cleanHeaderTitle: { fontSize: 20, fontWeight: 'bold' },

    // Grid Wrapper for 2-column layout
    rowWrapper: {
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        marginBottom: 14
    },

    // 2-Column Dynamic Colorful Class Cards
    dynamicClassCard: {
        width: '48%', // Half width minus gap
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        paddingVertical: 16, 
        paddingHorizontal: 14, 
        borderRadius: 12, 
        borderWidth: 1.5,
        elevation: 1, 
        shadowOpacity: 0.05, 
        shadowRadius: 2, 
        shadowOffset: { width: 0, height: 1 }
    },
    dynamicClassText: { 
        fontSize: 15, 
        fontWeight: '700', 
        letterSpacing: 0.3,
        flex: 1, // Ensures text doesn't push the icon out
        marginRight: 5
    },

    // Subject List Cards
    card: { borderRadius: 12, marginVertical: 6, padding: 15, elevation: 2, shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, width: '96%', alignSelf: 'center' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    cardTitle: { fontSize: 17, fontWeight: 'bold' },
    classBadgeContainer: { marginTop: 4, alignSelf: 'flex-start', borderRadius: 12, paddingVertical: 2, paddingHorizontal: 8 },
    cardClassBadge: { fontSize: 11, fontWeight: 'bold' },
    menuIconBtn: { padding: 4 },
    divider: { height: 1, marginVertical: 10 },
    cardInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    cardDetailText: { marginLeft: 8, fontSize: 13 },
    viewProgressButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 10, marginTop: 10 },
    buttonTextSmall: { color: '#fff', fontWeight: '600', fontSize: 13, marginRight: 5 },
    emptyText: { textAlign: 'center', marginTop: 40 },

    // Tabbed Navigation
    tabContainer: { flexDirection: 'row', width: '96%', alignSelf: 'center', borderRadius: 8, overflow: 'hidden', marginBottom: 5 },
    tabButton: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabText: { fontSize: 14, fontWeight: 'bold' },

    // Form
    formContainer: { padding: 15 },
    formSection: { borderRadius: 12, padding: 15, marginBottom: 15, elevation: 2, shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
    sectionHeader: { fontSize: 16, fontWeight: '700', marginBottom: 10, borderBottomWidth: 1, paddingBottom: 10 },
    label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 15 },
    inputWrapper: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
    input: { borderWidth: 1, padding: 12, borderRadius: 8, fontSize: 15 },
    
    // Lessons UI
    lessonRow: { marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1 },
    lessonHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    lessonIndex: { fontSize: 13, fontWeight: 'bold' },
    dateSelector: { padding: 10, borderRadius: 8, borderWidth: 1 },
    dateLabelSmall: { fontSize: 10, marginBottom: 2, textTransform: 'uppercase', fontWeight: 'bold' },
    dateText: { fontWeight: '600', fontSize: 13 },
    addLessonBtn: { padding: 12, borderStyle: 'dashed', borderWidth: 1, borderRadius: 10, alignItems: 'center', marginTop: 5 },
    
    // Assign Exam Checkboxes
    checkboxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },

    // Buttons
    saveButton: { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 30, width: '100%', alignSelf: 'center' },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    // Progress Log
    logCard: { flexDirection: 'row', marginBottom: 10, borderRadius: 12, overflow: 'hidden', elevation: 1, shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
    statusStrip: { width: 6 },
    logContent: { flex: 1, padding: 12 },
    logTitle: { fontSize: 15, fontWeight: '600' },
    logMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, justifyContent: 'space-between' },
    logMetaText: { fontSize: 12 },
    statusBadge: { fontSize: 11, fontWeight: '700' },
    examBadge: { fontSize: 10, color: '#fff', backgroundColor: '#6366f1', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, overflow: 'hidden', fontWeight: 'bold' },
});

export default AdminSyllabusScreen;