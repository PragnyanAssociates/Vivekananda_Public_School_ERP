import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, TextInput, useColorScheme, StatusBar, Dimensions
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/client'; 
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    background: '#F5F7FA', cardBg: '#FFFFFF', textMain: '#263238', textSub: '#546E7A',
    primary: '#008080', border: '#CFD8DC', inputBg: '#FAFAFA', success: '#27AE60',
    warning: '#FFA000', iconBg: '#E0F2F1', danger: '#E53935', redBox: '#EF4444'
};
const DarkColors = {
    background: '#121212', cardBg: '#1E1E1E', textMain: '#E0E0E0', textSub: '#B0B0B0',
    primary: '#008080', border: '#333333', inputBg: '#2C2C2C', success: '#27AE60',
    warning: '#FFA726', iconBg: '#333333', danger: '#EF5350', redBox: '#EF4444'
};

const QUESTIONS = [
    "Why should we learn this lesson?",
    "Who made or found this?",
    "What is this lesson about?",
    "Can you explain this in your own words?",
    "Where do we see this in our daily life?",
    "Tell 3 important words from this lesson.",
    "Can you give one example?",
    "What was hard for you in this lesson?",
    "Did you understand it better now?",
    "How will you tell this to your friend?"
];

const StudentLessonFeedback = () => {
    const { user } = useAuth();
    const isDark = useColorScheme() === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;
    const isAdmin = user?.role === 'admin';

    const [viewStep, setViewStep] = useState('subjects'); 
    const [loading, setLoading] = useState(false);
    
    const [subjects, setSubjects] = useState([]);
    const [lessons, setLessons] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedLesson, setSelectedLesson] = useState('');

    const [answers, setAnswers] = useState(
        QUESTIONS.map((q, i) => ({ q_no: i + 1, question: q, answer: '', mark: null }))
    );
    const [remarks, setRemarks] = useState('');
    const [isMarked, setIsMarked] = useState(false);
    
    // NEW: Teacher Remarks array shown to student
    const [teacherRemarks, setTeacherRemarks] = useState([]); 

    useEffect(() => {
        if (user?.class_group) fetchSubjects();
    }, [user]);

    const fetchSubjects = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/lesson-feedback/student/subjects/${user.class_group}`);
            setSubjects(res.data);
        } catch (e) { Alert.alert('Error', 'Failed to load subjects.'); }
        setLoading(false);
    };

    const handleSubjectSelect = async (subject) => {
        setSelectedSubject(subject);
        setLoading(true);
        try {
            const res = await apiClient.get(`/lesson-feedback/student/lessons/${user.id}/${user.class_group}/${subject}`);
            setLessons(res.data);
            setViewStep('lessons');
        } catch (e) { Alert.alert('Error', 'Failed to load lessons.'); }
        setLoading(false);
    };

    const handleLessonSelect = async (lesson) => {
        setSelectedLesson(lesson.lesson_name);
        setLoading(true);
        try {
            const res = await apiClient.get(`/lesson-feedback/student/submission/${user.id}/${user.class_group}/${selectedSubject}/${lesson.lesson_name}`);
            
            if (res.data && res.data.answers) {
                const savedAnswers = res.data.answers;
                const mergedAnswers = QUESTIONS.map((q, i) => {
                    const existing = savedAnswers.find(sa => sa.q_no === i + 1);
                    return { q_no: i + 1, question: q, answer: existing ? existing.answer : '', mark: existing ? existing.mark : null };
                });
                setAnswers(mergedAnswers);
                setRemarks(res.data.teaching_remarks || '');
                setIsMarked(res.data.is_marked);

                // Extract Teacher Remarks if they exist
                let parsedRemarks = [];
                try {
                    if (typeof res.data.teacher_remarks_checkboxes === 'string') {
                        parsedRemarks = JSON.parse(res.data.teacher_remarks_checkboxes);
                    } else if (Array.isArray(res.data.teacher_remarks_checkboxes)) {
                        parsedRemarks = res.data.teacher_remarks_checkboxes;
                    }
                } catch (e) {}
                setTeacherRemarks(parsedRemarks);

            } else {
                setAnswers(QUESTIONS.map((q, i) => ({ q_no: i + 1, question: q, answer: '', mark: null })));
                setRemarks('');
                setIsMarked(false);
                setTeacherRemarks([]);
            }
            setViewStep('form');
        } catch (e) { Alert.alert('Error', 'Failed to load submission.'); }
        setLoading(false);
    };

    const handleAnswerChange = (index, text) => {
        const newAnswers = [...answers];
        newAnswers[index].answer = text;
        setAnswers(newAnswers);
    };

    const handleSave = async () => {
        if (isAdmin) return;
        setLoading(true);
        try {
            await apiClient.post('/lesson-feedback/student/submit', {
                student_id: user.id,
                class_group: user.class_group,
                subject_name: selectedSubject,
                lesson_name: selectedLesson,
                answers,
                teaching_remarks: remarks
            });
            Alert.alert('Success', 'Feedback submitted!');
            handleSubjectSelect(selectedSubject);
        } catch (e) { Alert.alert('Error', e.response?.data?.message || 'Failed to submit.'); }
        setLoading(false);
    };

    const renderHeader = (title, subtitle, showBack, backAction) => (
        <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {showBack && (
                    <TouchableOpacity onPress={backAction} style={{ marginRight: 15 }}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>
                )}
                <View style={[styles.headerIconContainer, { backgroundColor: COLORS.iconBg }]}>
                    <MaterialIcons name="assignment" size={24} color={COLORS.primary} />
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
                    {/* STEP 1: SUBJECTS */}
                    {viewStep === 'subjects' && (
                        <>
                            {renderHeader("Lesson Feedback", "Select a Subject", false)}
                            <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 50 }}>
                                {subjects.length > 0 ? subjects.map((sub, idx) => (
                                    <TouchableOpacity key={idx} style={[styles.card, { backgroundColor: COLORS.cardBg }]} onPress={() => handleSubjectSelect(sub)}>
                                        <Text style={[styles.cardTitle, { color: COLORS.textMain }]}>{sub}</Text>
                                        <MaterialIcons name="chevron-right" size={24} color={COLORS.textSub} />
                                    </TouchableOpacity>
                                )) : <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No subjects found with lessons.</Text>}
                            </ScrollView>
                        </>
                    )}

                    {/* STEP 2: LESSONS */}
                    {viewStep === 'lessons' && (
                        <>
                            {renderHeader(selectedSubject, "Select a Lesson", true, () => setViewStep('subjects'))}
                            <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 50 }}>
                                {lessons.length > 0 ? lessons.map((lesson) => (
                                    <TouchableOpacity key={lesson.id} style={[styles.card, { backgroundColor: COLORS.cardBg }]} onPress={() => handleLessonSelect(lesson)}>
                                        <Text style={[styles.cardTitle, { color: COLORS.textMain }]} numberOfLines={2}>
                                            {lesson.lesson_name}
                                        </Text>
                                        
                                        <View style={styles.badgeContainer}>
                                            {lesson.is_marked ? (
                                                <>
                                                    <View style={[styles.scoreBoxSmall, { borderColor: COLORS.redBox }]}>
                                                        <Text style={[styles.scoreTextSmall, { color: COLORS.redBox }]}>{lesson.obtained_marks}/{lesson.max_marks}</Text>
                                                    </View>
                                                    <View style={[styles.statusBadge, { backgroundColor: COLORS.success }]}>
                                                        <Text style={styles.badgeText}>MARKED</Text>
                                                    </View>
                                                </>
                                            ) : lesson.is_submitted ? (
                                                <View style={[styles.statusBadge, { backgroundColor: COLORS.warning }]}>
                                                    <Text style={styles.badgeText}>PENDING</Text>
                                                </View>
                                            ) : (
                                                <View style={[styles.statusBadge, { backgroundColor: COLORS.danger }]}>
                                                    <Text style={styles.badgeText}>NO DATA</Text>
                                                </View>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                )) : <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No lessons found.</Text>}
                            </ScrollView>
                        </>
                    )}

                    {/* STEP 3: FORM */}
                    {viewStep === 'form' && (
                        <>
                            {renderHeader(selectedLesson, isMarked ? "Marked by Teacher (Read-only)" : "Answer Questions", true, () => setViewStep('lessons'))}
                            <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 50 }}>
                                {answers.map((item, index) => (
                                    <View key={index} style={[styles.questionBox, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <View style={{ flex: 1, paddingRight: 10 }}>
                                                <Text style={[styles.questionLabel, { color: COLORS.primary }]}>
                                                    {item.q_no}. {item.question}
                                                </Text>
                                            </View>
                                            {item.mark !== null && (
                                                <View style={[styles.markBadge, { backgroundColor: item.mark === 1 ? COLORS.success : COLORS.danger }]}>
                                                    <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 12 }}>
                                                        Marks: {item.mark}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: COLORS.inputBg, color: COLORS.textMain, borderColor: COLORS.border }]}
                                            multiline
                                            placeholder="Type your answer here..."
                                            placeholderTextColor={COLORS.textSub}
                                            value={item.answer}
                                            onChangeText={(txt) => handleAnswerChange(index, txt)}
                                            editable={!isMarked && !isAdmin}
                                        />
                                    </View>
                                ))}

                                <View style={[styles.questionBox, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                                    <Text style={[styles.questionLabel, { color: COLORS.primary, marginBottom: 8 }]}>Teaching Remarks</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: COLORS.inputBg, color: COLORS.textMain, borderColor: COLORS.border, minHeight: 80 }]}
                                        multiline
                                        placeholder="Add any remarks regarding teaching..."
                                        placeholderTextColor={COLORS.textSub}
                                        value={remarks}
                                        onChangeText={setRemarks}
                                        editable={!isMarked && !isAdmin}
                                    />
                                </View>

                                {/* --- NEW: TEACHER REMARKS VISIBLE TO STUDENT --- */}
                                {isMarked && teacherRemarks.length > 0 && (
                                    <View style={[styles.questionBox, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                                        <Text style={[styles.questionLabel, { color: COLORS.primary, marginBottom: 10 }]}>Teacher's Feedback:</Text>
                                        <View style={styles.tagsContainer}>
                                            {teacherRemarks.map(rmk => {
                                                const isGood = rmk === 'None of the above';
                                                return (
                                                    <View key={rmk} style={[
                                                        styles.tag, 
                                                        { 
                                                            borderColor: isGood ? COLORS.success : COLORS.danger, 
                                                            backgroundColor: isGood ? COLORS.success + '20' : COLORS.danger + '20' 
                                                        }
                                                    ]}>
                                                        <Text style={[styles.tagText, { color: isGood ? COLORS.success : COLORS.danger }]}>
                                                            {rmk}
                                                        </Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    </View>
                                )}

                                {!isMarked && !isAdmin && (
                                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: COLORS.primary }]} onPress={handleSave}>
                                        <Text style={styles.saveBtnText}>Submit Answers</Text>
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
    headerCard: { padding: 15, width: '94%', alignSelf: 'center', marginTop: 15, marginBottom: 5, borderRadius: 12, elevation: 2 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13, marginTop: 2 },
    card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, marginBottom: 12, borderRadius: 10, elevation: 1, width: '94%', alignSelf: 'center' },
    cardTitle: { fontSize: 15, fontWeight: '600', flex: 1 },
    
    badgeContainer: { flexDirection: 'row', alignItems: 'center' },
    scoreBoxSmall: { borderWidth: 1.5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 8, backgroundColor: 'transparent' },
    scoreTextSmall: { fontWeight: 'bold', fontSize: 14 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 },
    badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
    
    questionBox: { padding: 15, width: '94%', alignSelf: 'center', borderRadius: 10, borderWidth: 1, marginBottom: 15, elevation: 1, shadowOpacity: 0.05 },
    questionLabel: { fontSize: 14, fontWeight: 'bold' },
    markBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
    input: { borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 60, textAlignVertical: 'top', fontSize: 14 },
    
    // Checkbox Tags for Student View
    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, borderWidth: 1 },
    tagText: { fontWeight: 'bold', fontSize: 13 },

    saveBtn: { padding: 15, width: '94%', alignSelf: 'center', borderRadius: 10, alignItems: 'center', marginTop: 10 },
    saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
    emptyText: { textAlign: 'center', marginTop: 30, fontSize: 14 }
});

export default StudentLessonFeedback;