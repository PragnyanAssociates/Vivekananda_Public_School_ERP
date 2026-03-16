import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput,
    ActivityIndicator, Alert, useColorScheme, StatusBar, useWindowDimensions, Modal
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/client'; 
import { useAuth } from '../../context/AuthContext';

// --- THEME CONFIGURATION ---
const LightColors = {
    background: '#F5F7FA', cardBg: '#FFFFFF', textMain: '#263238', textSub: '#546E7A',
    primary: '#008080', border: '#CFD8DC', inputBg: '#FAFAFA', success: '#27AE60', 
    danger: '#E53935', warning: '#FFA000', iconBg: '#E0F2F1', rowAlt: '#FAFAFA'
};
const DarkColors = {
    background: '#121212', cardBg: '#1E1E1E', textMain: '#E0E0E0', textSub: '#B0B0B0',
    primary: '#008080', border: '#333333', inputBg: '#2C2C2C', success: '#27AE60', 
    danger: '#EF5350', warning: '#FFA726', iconBg: '#333333', rowAlt: '#252525'
};

const CLASS_COLORS =[
    { border: '#0F766E', bg: '#F0FDF4' }, { border: '#4F46E5', bg: '#EEF2FF' }, 
    { border: '#E11D48', bg: '#FFF1F2' }, { border: '#16A34A', bg: '#F0FDF4' }, 
    { border: '#7C3AED', bg: '#F5F3FF' }, { border: '#EA580C', bg: '#FFF7ED' }  
];

// Helper to extract the bracket number and sort numerically
const sortLessons = (lessonsArray: any[]) => {
    return [...lessonsArray].sort((a, b) => {
        const matchA = a.lesson_name.match(/\((\d+)\)/);
        const matchB = b.lesson_name.match(/\((\d+)\)/);
        const numA = matchA ? parseInt(matchA[1], 10) : 9999;
        const numB = matchB ? parseInt(matchB[1], 10) : 9999;
        return numA - numB;
    });
};

// Format Date to (DD/MM/YYYY)
const formatDate = (isoString: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `(${dd}/${mm}/${yyyy})`;
};

const KeywordScreen = () => {
    const { user } = useAuth();
    const isDark = useColorScheme() === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;
    const isStudent = user?.role === 'student';
    const isAdmin = user?.role === 'admin';
    const { width } = useWindowDimensions(); 

    // Navigation states
    const[viewStep, setViewStep] = useState('loading'); // 'classes' | 'subjects' | 'lessons' | 'keywords' | 'keywordForm'
    const [loading, setLoading] = useState(false);
    
    // Data states
    const [groupedClasses, setGroupedClasses] = useState<any>({}); 
    const[subjects, setSubjects] = useState<any[]>([]);
    const [lessons, setLessons] = useState<any[]>([]); 
    const [keywords, setKeywords] = useState<any[]>([]); 
    
    // Selection states
    const [selectedClassGroup, setSelectedClassGroup] = useState(''); 
    const[selectedSubjectItem, setSelectedSubjectItem] = useState<any>(null); 
    const [selectedLesson, setSelectedLesson] = useState<any>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');

    // Modal Menu states (3-dots)
    const [menuVisible, setMenuVisible] = useState(false);
    const [selectedKeywordForMenu, setSelectedKeywordForMenu] = useState<any>(null);

    // Form states
    const [formId, setFormId] = useState<number | null>(null);
    const[formWord, setFormWord] = useState('');
    const [formMeaning, setFormMeaning] = useState('');
    const [formDefinition, setFormDefinition] = useState('');
    const[formExample, setFormExample] = useState('');

    useEffect(() => { 
        if (user) fetchInitialData(); 
    }, [user]);

    // Role-based Initial Data Fetching
    const fetchInitialData = async () => {
        setLoading(true);
        try {
            if (isStudent) {
                const res = await apiClient.get(`/lesson-feedback/student/subjects-with-marks/${user.class_group}/${user.id}`);
                setSubjects(res.data);
                setSelectedClassGroup(user.class_group);
                setViewStep('subjects');
            } else {
                const role = isAdmin ? 'admin' : 'teacher';
                const res = await apiClient.get(`/lesson-feedback/teacher/classes-with-marks/${user.id}/${role}`);
                const grouped: any = {};
                res.data.forEach((item: any) => {
                    if (!grouped[item.class_group]) grouped[item.class_group] =[];
                    grouped[item.class_group].push(item);
                });
                setGroupedClasses(grouped);
                setViewStep('classes');
            }
        } catch (e) { Alert.alert('Error', 'Failed to load initial data.'); }
        setLoading(false);
    };

    // Fetch lessons based on Subject selection
    const handleSubjectSelect = async (sub: any) => {
        const cGroup = isStudent ? user.class_group : sub.class_group || selectedClassGroup;
        const sName = sub.subject_name;
        
        setSelectedSubjectItem({ class_group: cGroup, subject_name: sName });
        setLoading(true);
        try {
            let res;
            if (isStudent) {
                res = await apiClient.get(`/lesson-feedback/student/lessons/${user.id}/${cGroup}/${sName}`);
            } else {
                res = await apiClient.get(`/lesson-feedback/teacher/subject-lessons/${cGroup}/${sName}`);
            }
            setLessons(sortLessons(res.data)); 
            setViewStep('lessons');
        } catch (e) { Alert.alert('Error', 'Failed to load lessons.'); }
        setLoading(false);
    };

    // Fetch Keywords for a Lesson
    const handleLessonSelect = async (lesson: any) => {
        setSelectedLesson(lesson);
        setSearchQuery(''); // Clear search query when entering a new lesson
        setLoading(true);
        try {
            const res = await apiClient.get(`/lesson-keywords/${selectedSubjectItem.class_group}/${selectedSubjectItem.subject_name}/${lesson.lesson_name}`);
            setKeywords(res.data);
            setViewStep('keywords');
        } catch (e) { Alert.alert('Error', 'Failed to load keywords.'); }
        setLoading(false);
    };

    // Handle Form Navigation
    const openKeywordForm = (keyword: any = null) => {
        if (keyword) {
            setFormId(keyword.id);
            setFormWord(keyword.word);
            setFormMeaning(keyword.meaning || '');
            setFormDefinition(keyword.definition || '');
            setFormExample(keyword.example || '');
        } else {
            setFormId(null);
            setFormWord('');
            setFormMeaning('');
            setFormDefinition('');
            setFormExample('');
        }
        setViewStep('keywordForm');
    };

    // Save Keyword (Add/Edit)
    const handleSaveKeyword = async () => {
        if (!formWord.trim()) {
            Alert.alert('Validation Error', 'Word is required.');
            return;
        }
        setLoading(true);
        try {
            await apiClient.post('/lesson-keywords/save', {
                id: formId,
                class_group: selectedSubjectItem.class_group,
                subject_name: selectedSubjectItem.subject_name,
                lesson_name: selectedLesson.lesson_name,
                word: formWord,
                meaning: formMeaning,
                definition: formDefinition,
                example: formExample,
                user_id: user.id
            });
            Alert.alert('Success', formId ? 'Keyword updated!' : 'Keyword added!');
            handleLessonSelect(selectedLesson); 
        } catch (e) { Alert.alert('Error', 'Failed to save keyword.'); }
        setLoading(false);
    };

    // Delete Keyword
    const handleDeleteKeyword = (id: number) => {
        Alert.alert('Delete', 'Are you sure you want to delete this keyword?',[
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Delete', style: 'destructive', 
                onPress: async () => {
                    setLoading(true);
                    try {
                        await apiClient.delete(`/lesson-keywords/${id}`);
                        handleLessonSelect(selectedLesson); 
                    } catch (e) { Alert.alert('Error', 'Failed to delete keyword.'); setLoading(false); }
                } 
            }
        ]);
    };

    const getSortedClasses = () => {
        return Object.keys(groupedClasses).sort((a, b) => {
            const valA = a.toUpperCase().replace(/\./g, '');
            const valB = b.toUpperCase().replace(/\./g, '');
            if (valA.includes('LKG')) return -1;
            if (valB.includes('LKG')) return 1;
            if (valA.includes('UKG')) return -1;
            if (valB.includes('UKG')) return 1;
            const numA = parseInt(valA.replace(/\D/g, ''), 10);
            const numB = parseInt(valB.replace(/\D/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return valA.localeCompare(valB);
        });
    };

    // --- RESPONSIVE HEADER COMPONENT ---
    const renderHeader = (title: string, subtitle: string, showBack: boolean, backAction: () => void, showAddBtn: boolean) => (
        <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                    {showBack && (
                        <TouchableOpacity onPress={backAction} style={{ marginRight: 15 }}>
                            <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                        </TouchableOpacity>
                    )}
                    <View style={[styles.headerIconContainer, { backgroundColor: COLORS.iconBg }]}>
                        <MaterialIcons name="menu-book" size={24} color={COLORS.primary} />
                    </View>
                    
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]} numberOfLines={1}>{title}</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]} numberOfLines={1}>{subtitle}</Text>
                    </View>
                </View>

                {showAddBtn && !isStudent && (
                    <View style={{ flexShrink: 0 }}>
                        <TouchableOpacity style={[styles.addBtnTop, { backgroundColor: COLORS.primary }]} onPress={() => openKeywordForm()}>
                            <MaterialIcons name="add" size={20} color="#FFF" />
                            <Text style={styles.addBtnText}>Add</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );

    // Apply local search filter
    const filteredKeywords = keywords.filter(kw => 
        kw.word.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (kw.meaning && kw.meaning.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (viewStep === 'loading') {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background, justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={COLORS.background} />

            {loading && viewStep !== 'loading' ? <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} /> : (
                <>
                    {/* STEP 1: CLASSES (Teacher/Admin Only) */}
                    {viewStep === 'classes' && !isStudent && (
                        <>
                            {renderHeader(isAdmin ? "All Classes" : "My Classes", "Select a Class for Keywords", false, () => {}, false)}
                            <ScrollView contentContainerStyle={styles.gridContainer}>
                                {getSortedClasses().length > 0 ? getSortedClasses().map((className, idx) => {
                                    const colorTheme = CLASS_COLORS[idx % CLASS_COLORS.length];
                                    return (
                                        <TouchableOpacity 
                                            key={className} 
                                            style={[styles.gridCard, { borderColor: colorTheme.border, backgroundColor: isDark ? COLORS.cardBg : colorTheme.bg }]} 
                                            onPress={() => {
                                                setSelectedClassGroup(className);
                                                setViewStep('subjects');
                                            }}
                                        >
                                            <Text style={[styles.gridText, { color: colorTheme.border }]}>{className}</Text>
                                            <MaterialIcons name="chevron-right" size={20} color={colorTheme.border} />
                                        </TouchableOpacity>
                                    )
                                }) : <Text style={[styles.emptyText, { color: COLORS.textSub, width: '100%' }]}>No classes found.</Text>}
                            </ScrollView>
                        </>
                    )}

                    {/* STEP 2: SUBJECTS */}
                    {viewStep === 'subjects' && (
                        <>
                            {renderHeader(
                                isStudent ? "My Subjects" : selectedClassGroup, 
                                "Select a Subject", 
                                !isStudent, 
                                () => setViewStep('classes'), 
                                false
                            )}
                            <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 50 }}>
                                {(isStudent ? subjects : groupedClasses[selectedClassGroup] ||[]).map((sub: any, idx: number) => (
                                    <TouchableOpacity key={idx} style={[styles.card, { backgroundColor: COLORS.cardBg }]} onPress={() => handleSubjectSelect(sub)}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.cardTitle, { color: COLORS.textMain }]}>{sub.subject_name}</Text>
                                        </View>
                                        <MaterialIcons name="chevron-right" size={24} color={COLORS.textSub} />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </>
                    )}

                    {/* STEP 3: LESSONS */}
                    {viewStep === 'lessons' && (
                        <>
                            {renderHeader(
                                `${selectedSubjectItem?.class_group} - ${selectedSubjectItem?.subject_name}`, 
                                "Select a Lesson", 
                                true, 
                                () => isStudent ? setViewStep('subjects') : setViewStep('subjects'), 
                                false
                            )}
                            <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 50 }}>
                                {lessons.length > 0 ? lessons.map((lesson) => (
                                    <TouchableOpacity 
                                        key={lesson.id} 
                                        style={[styles.card, { backgroundColor: COLORS.cardBg }]} 
                                        onPress={() => handleLessonSelect(lesson)}
                                    >
                                        <Text style={[styles.cardTitle, { color: COLORS.textMain, flex: 1 }]} numberOfLines={2}>
                                            {lesson.lesson_name}
                                        </Text>
                                        <MaterialIcons name="chevron-right" size={24} color={COLORS.textSub} />
                                    </TouchableOpacity>
                                )) : <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No lessons found.</Text>}
                            </ScrollView>
                        </>
                    )}

                    {/* STEP 4: KEYWORDS LIST */}
                    {viewStep === 'keywords' && (
                        <>
                            {renderHeader(
                                selectedLesson?.lesson_name || "Keywords", 
                                "Lesson Keywords & Vocabulary", 
                                true, 
                                () => setViewStep('lessons'), 
                                true 
                            )}
                            
                            {/* --- SEARCH BAR --- */}
                            <View style={[styles.searchContainer, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                                <MaterialIcons name="search" size={24} color={COLORS.textSub} style={{ marginRight: 8 }} />
                                <TextInput
                                    style={[styles.searchInput, { color: COLORS.textMain }]}
                                    placeholder="Search keywords..."
                                    placeholderTextColor={COLORS.textSub}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <MaterialIcons name="close" size={20} color={COLORS.textSub} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 50 }}>
                                {filteredKeywords.length > 0 ? filteredKeywords.map((kw) => (
                                    <View key={kw.id} style={[styles.keywordCard, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                                        
                                        <View style={styles.keywordHeader}>
                                            <Text style={[styles.wordText, { color: COLORS.primary }]} numberOfLines={2}>{kw.word}</Text>
                                            
                                            {/* --- 3 DOTS MENU ICON --- */}
                                            {!isStudent && (
                                                <TouchableOpacity 
                                                    onPress={() => {
                                                        setSelectedKeywordForMenu(kw);
                                                        setMenuVisible(true);
                                                    }} 
                                                    style={styles.actionIcon}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                >
                                                    <MaterialIcons name="more-vert" size={24} color={COLORS.textSub} />
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        {!!kw.meaning && (
                                            <View style={styles.rowItem}>
                                                <Text style={[styles.rowLabel, { color: COLORS.textMain }]}>Meaning: </Text>
                                                <Text style={[styles.rowValue, { color: COLORS.textSub }]}>{kw.meaning}</Text>
                                            </View>
                                        )}
                                        
                                        {!!kw.definition && (
                                            <View style={styles.rowItem}>
                                                <Text style={[styles.rowLabel, { color: COLORS.textMain }]}>Definition: </Text>
                                                <Text style={[styles.rowValue, { color: COLORS.textSub }]}>{kw.definition}</Text>
                                            </View>
                                        )}

                                        {!!kw.example && (
                                            <View style={[styles.exampleBox, { backgroundColor: COLORS.iconBg }]}>
                                                <Text style={[styles.rowLabel, { color: COLORS.primary }]}>Example: </Text>
                                                <Text style={[styles.rowValue, { color: COLORS.textMain, fontStyle: 'italic' }]}>"{kw.example}"</Text>
                                            </View>
                                        )}

                                        <Text style={[styles.dateText, { color: COLORS.textSub }]}>
                                            Added: {formatDate(kw.created_at)}
                                        </Text>

                                    </View>
                                )) : <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No keywords match your search.</Text>}
                            </ScrollView>
                        </>
                    )}

                    {/* STEP 5: ADD/EDIT KEYWORD FORM (Teacher/Admin Only) */}
                    {viewStep === 'keywordForm' && !isStudent && (
                        <>
                            {renderHeader(
                                formId ? "Edit Keyword" : "Add New Keyword", 
                                selectedLesson?.lesson_name, 
                                true, 
                                () => setViewStep('keywords'), 
                                false
                            )}
                            <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 50 }}>
                                
                                <View style={[styles.inputContainer, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                                    <Text style={[styles.inputLabel, { color: COLORS.primary }]}>Keyword / Term <Text style={{ color: COLORS.danger }}>*</Text></Text>
                                    <TextInput
                                        style={[styles.inputField, { backgroundColor: COLORS.inputBg, color: COLORS.textMain, borderColor: COLORS.border }]}
                                        placeholder="e.g. Photosynthesis"
                                        placeholderTextColor={COLORS.textSub}
                                        value={formWord}
                                        onChangeText={setFormWord}
                                    />
                                </View>

                                <View style={[styles.inputContainer, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                                    <Text style={[styles.inputLabel, { color: COLORS.primary }]}>Meaning (Simple)</Text>
                                    <TextInput
                                        style={[styles.inputField, { backgroundColor: COLORS.inputBg, color: COLORS.textMain, borderColor: COLORS.border }]}
                                        placeholder="Short simple meaning..."
                                        placeholderTextColor={COLORS.textSub}
                                        value={formMeaning}
                                        onChangeText={setFormMeaning}
                                        multiline
                                    />
                                </View>

                                <View style={[styles.inputContainer, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                                    <Text style={[styles.inputLabel, { color: COLORS.primary }]}>Definition (Detailed)</Text>
                                    <TextInput
                                        style={[styles.inputField, { backgroundColor: COLORS.inputBg, color: COLORS.textMain, borderColor: COLORS.border, minHeight: 80 }]}
                                        placeholder="Full academic definition..."
                                        placeholderTextColor={COLORS.textSub}
                                        value={formDefinition}
                                        onChangeText={setFormDefinition}
                                        multiline
                                        textAlignVertical="top"
                                    />
                                </View>

                                <View style={[styles.inputContainer, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                                    <Text style={[styles.inputLabel, { color: COLORS.primary }]}>Example Sentence</Text>
                                    <TextInput
                                        style={[styles.inputField, { backgroundColor: COLORS.inputBg, color: COLORS.textMain, borderColor: COLORS.border, minHeight: 60 }]}
                                        placeholder="Use the word in a sentence..."
                                        placeholderTextColor={COLORS.textSub}
                                        value={formExample}
                                        onChangeText={setFormExample}
                                        multiline
                                        textAlignVertical="top"
                                    />
                                </View>

                                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: COLORS.primary }]} onPress={handleSaveKeyword}>
                                    <Text style={styles.saveBtnText}>{formId ? 'Update Keyword' : 'Save Keyword'}</Text>
                                </TouchableOpacity>

                            </ScrollView>
                        </>
                    )}
                </>
            )}

            {/* --- OPTIONS MODAL (MANAGE DICTIONARY) --- */}
            <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
                    <View style={[styles.menuModalCard, { backgroundColor: COLORS.cardBg }]}>
                        <Text style={[styles.menuModalTitle, { color: COLORS.textMain }]}>Manage Dictionary</Text>
                        <Text style={[styles.menuModalSubtitle, { color: COLORS.textSub }]} numberOfLines={1}>
                            Options for "{selectedKeywordForMenu?.word}"
                        </Text>
                        
                        <View style={styles.menuModalActions}>
                            <TouchableOpacity onPress={() => setMenuVisible(false)} style={styles.menuBtn}>
                                <Text style={[styles.menuActionText, { color: COLORS.primary }]}>CANCEL</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => { 
                                    setMenuVisible(false); 
                                    openKeywordForm(selectedKeywordForMenu); 
                                }} 
                                style={styles.menuBtn}
                            >
                                <Text style={[styles.menuActionText, { color: COLORS.primary }]}>EDIT WORD</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => { 
                                    setMenuVisible(false); 
                                    handleDeleteKeyword(selectedKeywordForMenu?.id); 
                                }} 
                                style={styles.menuBtn}
                            >
                                <Text style={[styles.menuActionText, { color: COLORS.primary }]}>DELETE</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    
    // --- Header Styles ---
    headerCard: { padding: 15, width: '94%', alignSelf: 'center', marginTop: 15, marginBottom: 5, borderRadius: 12, elevation: 2 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13, marginTop: 2 },
    addBtnTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    addBtnText: { color: '#FFF', fontWeight: 'bold', marginLeft: 4, fontSize: 14 },

    // --- Search Styles ---
    searchContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, marginHorizontal: '3%', marginTop: 5, marginBottom: 10, paddingHorizontal: 12, height: 45 },
    searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },

    // --- Grid / List Styles ---
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: '3%', paddingTop: 10, paddingBottom: 50 },
    gridCard: { width: '48%', borderWidth: 1.5, borderRadius: 12, padding: 18, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1, shadowOpacity: 0.05 },
    gridText: { fontSize: 16, fontWeight: 'bold' },

    card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, marginBottom: 12, borderRadius: 10, elevation: 1, width: '94%', alignSelf: 'center' },
    cardTitle: { fontSize: 15, fontWeight: '600', flex: 1 },

    // --- Keyword Card Styles ---
    keywordCard: { padding: 15, width: '94%', alignSelf: 'center', borderRadius: 10, borderWidth: 1, marginBottom: 15, elevation: 1, shadowOpacity: 0.05 },
    keywordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#EEE', paddingBottom: 8 },
    wordText: { fontSize: 18, fontWeight: 'bold', flex: 1, paddingRight: 10 },
    actionIcon: { padding: 4 },
    
    rowItem: { flexDirection: 'row', marginBottom: 6, flexWrap: 'wrap' },
    rowLabel: { fontWeight: 'bold', fontSize: 14 },
    rowValue: { fontSize: 14, flexShrink: 1 },
    
    exampleBox: { padding: 10, borderRadius: 8, marginTop: 5, marginBottom: 5 },
    dateText: { fontSize: 11, fontStyle: 'italic', textAlign: 'right', marginTop: 8 },

    // --- Form Styles ---
    inputContainer: { padding: 15, width: '94%', alignSelf: 'center', borderRadius: 10, borderWidth: 1, marginBottom: 15, elevation: 1, shadowOpacity: 0.05 },
    inputLabel: { fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
    inputField: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14 },

    saveBtn: { padding: 15, width: '94%', alignSelf: 'center', borderRadius: 10, alignItems: 'center', marginTop: 10 },
    saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
    emptyText: { textAlign: 'center', marginTop: 30, fontSize: 14 },

    // --- Modal Styles ---
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    menuModalCard: { width: '85%', borderRadius: 8, padding: 24, elevation: 5 },
    menuModalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
    menuModalSubtitle: { fontSize: 15, marginBottom: 24 },
    menuModalActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap' },
    menuBtn: { marginLeft: 20, paddingVertical: 8 },
    menuActionText: { fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5 }
});

export default KeywordScreen;