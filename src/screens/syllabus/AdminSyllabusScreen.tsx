import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    ActivityIndicator, Alert, ScrollView, TextInput, Platform,
    SafeAreaView, useColorScheme, StatusBar, Dimensions, Modal
} from 'react-native';
import apiClient from '../../api/client';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import { useIsFocused } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

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
    warning: '#FFA000',
    headerIconBg: '#E0F2F1',
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
    warning: '#FFA726',
    headerIconBg: '#333333',
    divider: '#2C2C2C'
};

// --- HELPERS ---
const formatDateDisplay = (isoDateString) => {
    if (!isoDateString) return '';
    const date = new Date(isoDateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

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

// --- Sub-Component: History List ---
const SyllabusHistoryList = ({ onEdit, onCreate, onViewProgress }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

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
            const filteredClasses = classesRes.data.filter(c => c && (c.startsWith('Class') || c === 'LKG' || c === 'UKG'));
            setAllClasses(filteredClasses);
        } catch (error) { 
            Alert.alert("Error", "Failed to load syllabus history."); 
        } finally { setIsLoading(false); }
    }, []);

    useEffect(() => { if (isFocused) fetchData(); }, [isFocused, fetchData]);

    const handleMenuPress = (item) => {
        Alert.alert(
            "Manage Syllabus",
            `${item.class_group} - ${item.subject_name}`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Edit Syllabus", onPress: () => onEdit(item) },
                { text: "Delete", style: "destructive", onPress: () => handleDeleteSyllabus(item) }
            ]
        );
    };

    const handleDeleteSyllabus = async (item) => {
        try {
            await apiClient.delete(`/syllabus/${item.id}`);
            Alert.alert("Success", "Syllabus deleted.");
            fetchData();
        } catch (error) {
            Alert.alert("Error", "Could not delete syllabus.");
        }
    };

    const filteredSyllabuses = useMemo(() => {
        if (selectedClassFilter === 'All') return syllabuses;
        return syllabuses.filter(s => s.class_group === selectedClassFilter);
    }, [selectedClassFilter, syllabuses]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={COLORS.background} />
            
            {/* Header Card */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                <View style={styles.headerContentWrapper}>
                    <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                        <MaterialIcons name="menu-book" size={24} color={COLORS.primary} />
                    </View>
                    <View>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Syllabus</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Manage syllabus data</Text>
                    </View>
                </View>
                <TouchableOpacity style={[styles.headerBtn, { backgroundColor: COLORS.primary }]} onPress={onCreate}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.headerBtnText}>Add</Text>
                </TouchableOpacity>
            </View>
            
            {/* Filter Section */}
            <View style={styles.filterContainer}>
                <Text style={[styles.filterLabel, { color: COLORS.textSub }]}>Filter Class:</Text>
                <View style={[styles.pickerWrapper, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                    <Picker
                        selectedValue={selectedClassFilter}
                        onValueChange={(v) => setSelectedClassFilter(v)}
                        style={{ color: COLORS.textMain }}
                        dropdownIconColor={COLORS.textMain}
                    >
                        <Picker.Item label="All Classes" value="All" />
                        {allClasses.map((c, i) => <Picker.Item key={i} label={c} value={c} />)}
                    </Picker>
                </View>
            </View>

            {/* List */}
            <FlatList
                data={filteredSyllabuses}
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
                ListEmptyComponent={!isLoading && <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No syllabuses found.</Text>}
                contentContainerStyle={{ paddingBottom: 100 }}
            />
        </SafeAreaView>
    );
};

// --- Sub-Component: Create/Edit Form ---
const CreateOrEditSyllabus = ({ initialSyllabus, onFinish }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;
    const isEditMode = !!initialSyllabus;
    
    const [selectedClass, setSelectedClass] = useState(isEditMode ? initialSyllabus.class_group : '');
    const [selectedSubject, setSelectedSubject] = useState(isEditMode ? initialSyllabus.subject_name : '');
    const [selectedTeacherId, setSelectedTeacherId] = useState(isEditMode ? initialSyllabus.creator_id : '');
    const [lessons, setLessons] = useState([{ lessonName: '', examType: 'AT1', fromDate: new Date(), toDate: new Date() }]);
    const [allClasses, setAllClasses] = useState([]);
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [availableTeachers, setAvailableTeachers] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubjectsLoading, setIsSubjectsLoading] = useState(false);
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
                    const syllabusDetailsRes = await apiClient.get(`/syllabus/teacher/${initialSyllabus.class_group}/${initialSyllabus.subject_name}`);
                    const formattedLessons = syllabusDetailsRes.data.lessons.map(l => ({ 
                        lessonName: l.lesson_name, examType: l.exam_type || 'AT1',
                        fromDate: new Date(l.from_date), toDate: new Date(l.to_date) 
                    }));
                    setLessons(formattedLessons.length > 0 ? formattedLessons : [{ lessonName: '', examType: 'AT1', fromDate: new Date(), toDate: new Date() }]);
                    setSelectedTeacherId(initialSyllabus.creator_id.toString());
                }
            } catch (e) { Alert.alert("Error", "Could not load data."); } 
            finally { setIsLoading(false); }
        };
        bootstrapForm();
    }, []);

    const handleClassChange = async (classGroup, isInitialLoad = false) => {
        if (!isInitialLoad) { setSelectedSubject(''); setAvailableSubjects([]); }
        setSelectedClass(classGroup);
        if (!classGroup) return;
        setIsSubjectsLoading(true);
        try {
            const subjectRes = await apiClient.get(`/subjects-for-class/${classGroup}`);
            setAvailableSubjects(subjectRes.data);
        } catch (error) { console.error(error); } 
        finally { setIsSubjectsLoading(false); }
    };

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

    const handleSaveSyllabus = async () => {
        if (!selectedClass || !selectedSubject || !selectedTeacherId) return Alert.alert("Required", "Please fill details.");
        const validLessons = lessons.filter(l => l.lessonName.trim()).map(l => ({
            lessonName: l.lessonName, examType: l.examType,
            fromDate: formatDateForBackend(l.fromDate), toDate: formatDateForBackend(l.toDate)
        }));
        if (validLessons.length === 0) return Alert.alert("Required", "Add at least one lesson.");
        setIsSaving(true);
        try {
            const payload = { class_group: selectedClass, subject_name: selectedSubject, lessons: validLessons, creator_id: selectedTeacherId };
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
             <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, justifyContent: 'flex-start', gap: 10, shadowColor: COLORS.border }]}>
                 <TouchableOpacity onPress={onFinish} style={{ padding: 4 }}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                </TouchableOpacity>
                <View>
                     <Text style={[styles.headerTitle, { color: COLORS.textMain, fontSize: 18 }]}>{isEditMode ? 'Edit Syllabus' : 'New Syllabus'}</Text>
                </View>
            </View>
            
            <ScrollView style={styles.formContainer} contentContainerStyle={{paddingBottom: 40}}>
                {/* Form Section 1 */}
                <View style={[styles.formSection, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                    <Text style={[styles.sectionHeader, { color: COLORS.primary, borderBottomColor: COLORS.divider }]}>Class Details</Text>
                    
                    <Text style={[styles.label, { color: COLORS.textSub }]}>Class</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                        <Picker selectedValue={selectedClass} onValueChange={handleClassChange} enabled={!isEditMode} style={{color: COLORS.textMain}} dropdownIconColor={COLORS.textMain}>
                            <Picker.Item label="Select Class..." value="" color={COLORS.textMain} />
                            {allClasses.map((c, i) => <Picker.Item key={i} label={c} value={c} color={COLORS.textMain} />)}
                        </Picker>
                    </View>
                    
                    <Text style={[styles.label, { color: COLORS.textSub }]}>Subject</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                        <Picker selectedValue={selectedSubject} onValueChange={setSelectedSubject} enabled={!isEditMode && !!selectedClass} style={{color: COLORS.textMain}} dropdownIconColor={COLORS.textMain}>
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

                {/* Form Section 2 */}
                <View style={[styles.formSection, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                    <Text style={[styles.sectionHeader, { color: COLORS.primary, borderBottomColor: COLORS.divider }]}>Lessons Plan</Text>
                    {lessons.map((lesson, index) => (
                        <View key={index} style={[styles.lessonRow, { borderBottomColor: COLORS.divider }]}>
                            <View style={styles.lessonHeaderRow}>
                                <Text style={[styles.lessonIndex, { color: COLORS.textSub }]}>#{index + 1}</Text>
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
                    <TouchableOpacity style={[styles.addLessonBtn, { borderColor: COLORS.primary, backgroundColor: isDark ? 'transparent' : '#F0FDF4' }]} onPress={() => setLessons([...lessons, { lessonName: '', examType: 'AT1', fromDate: new Date(), toDate: new Date() }])}>
                        <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>+ Add Lesson</Text>
                    </TouchableOpacity>
                </View>
                
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: COLORS.primary }]} onPress={handleSaveSyllabus} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Syllabus</Text>}
                </TouchableOpacity>
            </ScrollView>
            {datePickerState.show && <DateTimePicker value={datePickerState.mode === 'from' ? lessons[datePickerState.index].fromDate : lessons[datePickerState.index].toDate} mode="date" display="default" onChange={onDateChange} />}
        </SafeAreaView>
    );
};

// --- Sub-Component: Progress View ---
const AdminProgressView = ({ syllabus, onBack }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;
    const [auditLog, setAuditLog] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchProgress = async () => {
            setIsLoading(true);
            try {
                const response = await apiClient.get(`/syllabus/class-progress/${syllabus.id}`);
                setAuditLog(response.data);
                setFilteredLogs(response.data);
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
                    data={filteredLogs}
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

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Header Style
    headerCard: {
        paddingHorizontal: 15, 
        paddingVertical: 12, 
        width: '96%', 
        alignSelf: 'center', 
        marginTop: 15, 
        marginBottom: 10, 
        borderRadius: 12, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        elevation: 3,
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    headerContentWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },
    headerBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    // Filters
    filterContainer: { paddingHorizontal: 15, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '96%', alignSelf: 'center' },
    filterLabel: { fontSize: 14, fontWeight: '600' },
    pickerWrapper: { flex: 1, marginLeft: 10, borderRadius: 8, borderWidth: 1, height: 45, justifyContent: 'center' },

    // List Card
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

    // Form
    formContainer: { padding: 15 },
    formSection: { borderRadius: 12, padding: 15, marginBottom: 15, elevation: 2, shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
    sectionHeader: { fontSize: 16, fontWeight: '700', marginBottom: 10, borderBottomWidth: 1, paddingBottom: 5 },
    label: { fontSize: 13, fontWeight: '600', marginBottom: 4, marginTop: 10 },
    inputWrapper: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
    input: { borderWidth: 1, padding: 12, borderRadius: 8, fontSize: 15 },
    lessonRow: { marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1 },
    lessonHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    lessonIndex: { fontSize: 11, fontWeight: 'bold' },
    dateSelector: { padding: 10, borderRadius: 8, borderWidth: 1 },
    dateLabelSmall: { fontSize: 10, marginBottom: 2, textTransform: 'uppercase', fontWeight: 'bold' },
    dateText: { fontWeight: '600', fontSize: 13 },
    addLessonBtn: { padding: 12, borderStyle: 'dashed', borderWidth: 1, borderRadius: 10, alignItems: 'center', marginTop: 5 },
    saveButton: { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 30, width: '96%', alignSelf: 'center' },
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