import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert, useColorScheme, StatusBar, Dimensions, Modal, Animated, Easing
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker'; // MUST BE IMPORTED
import apiClient from '../../api/client'; 
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    background: '#F5F7FA', cardBg: '#FFFFFF', textMain: '#263238', textSub: '#546E7A',
    primary: '#008080', border: '#CFD8DC', success: '#27AE60', danger: '#E53935', 
    warning: '#FFA000', iconBg: '#E0F2F1', rowAlt: '#FAFAFA', redBox: '#EF4444', 
    graphBg: '#F0F0F0', graphGreen: '#10B981', graphBlue: '#3B82F6', graphRed: '#EF4444'
};
const DarkColors = {
    background: '#121212', cardBg: '#1E1E1E', textMain: '#E0E0E0', textSub: '#B0B0B0',
    primary: '#008080', border: '#333333', success: '#27AE60', danger: '#EF5350', 
    warning: '#FFA726', iconBg: '#333333', rowAlt: '#252525', redBox: '#EF4444', 
    graphBg: '#333333', graphGreen: '#10B981', graphBlue: '#3B82F6', graphRed: '#EF4444'
};

// --- GRID COLORS ---
const CLASS_COLORS =[
    { border: '#0F766E', bg: '#F0FDF4' }, 
    { border: '#4F46E5', bg: '#EEF2FF' }, 
    { border: '#E11D48', bg: '#FFF1F2' }, 
    { border: '#16A34A', bg: '#F0FDF4' }, 
    { border: '#7C3AED', bg: '#F5F3FF' }, 
    { border: '#EA580C', bg: '#FFF7ED' }  
];

const TEACHER_REMARK_OPTIONS =[
    "Irregular", "Unfocused", "Unhealthy", 
    "Poor Performance", "Needs improvement", "None of the above"
];

const getBarColor = (percentage, colors) => {
    if (percentage >= 80) return colors.graphGreen;
    if (percentage >= 50) return colors.graphBlue;  
    return colors.graphRed;                         
};

// --- ANIMATED BAR COMPONENT ---
const AnimatedBar = ({ percentage, label, topLabel, rollNo, color, colors }) => {
    const animatedHeight = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animatedHeight, {
            toValue: percentage,
            duration: 1000,
            useNativeDriver: false,
            easing: Easing.out(Easing.poly(4)),
        }).start();
    }, [percentage]);

    const heightStyle = animatedHeight.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%']
    });

    const displayLabel = label.length > 8 ? label.substring(0, 8) + '..' : label;

    return (
        <View style={styles.barWrapper}>
            <Text style={[styles.barLabelTop, { color: colors.textMain }]}>{topLabel}</Text>
            <View style={[styles.barTrack, { backgroundColor: colors.graphBg }]}>
                <Animated.View style={[styles.barFill, { height: heightStyle, backgroundColor: color }]} />
            </View>
            <Text style={[styles.barLabelBottom, { color: colors.textSub }]} numberOfLines={1}>
                {displayLabel}
            </Text>
            <Text style={[styles.barRollNo, { color: colors.primary }]}>
                ({rollNo})
            </Text>
        </View>
    );
};

const TeacherLessonFeedback = () => {
    const { user } = useAuth();
    const isDark = useColorScheme() === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;
    const isAdmin = user?.role === 'admin';

    const[viewStep, setViewStep] = useState('classes'); 
    const [loading, setLoading] = useState(false);
    
    // Graph Modal & Sort State
    const [showGraph, setShowGraph] = useState(false);
    const[sortOrder, setSortOrder] = useState('roll_no'); // Default to Roll No

    const[groupedClasses, setGroupedClasses] = useState({}); 
    const [students, setStudents] = useState([]);
    const[lessons, setLessons] = useState([]);
    
    const [selectedClassGroup, setSelectedClassGroup] = useState(''); 
    const[selectedSubjectItem, setSelectedSubjectItem] = useState(null); 
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedLesson, setSelectedLesson] = useState(null);

    const [answers, setAnswers] = useState([]);
    const [remarks, setRemarks] = useState('');
    const [teacherRemarks, setTeacherRemarks] = useState([]); 

    useEffect(() => { if (user) fetchClasses(); }, [user]);

    const fetchClasses = async () => {
        setLoading(true);
        try {
            const role = isAdmin ? 'admin' : 'teacher';
            const res = await apiClient.get(`/lesson-feedback/teacher/classes-with-marks/${user.id}/${role}`);
            
            const grouped = {};
            res.data.forEach(item => {
                if (!grouped[item.class_group]) grouped[item.class_group] =[];
                grouped[item.class_group].push(item);
            });
            setGroupedClasses(grouped);
        } catch (e) { Alert.alert('Error', 'Failed to load classes.'); }
        setLoading(false);
    };

    const handleSubjectSelect = async (subjectItem) => {
        setSelectedSubjectItem(subjectItem);
        setLoading(true);
        try {
            const res = await apiClient.get(`/lesson-feedback/teacher/class-students/${subjectItem.class_group}/${subjectItem.subject_name}`);
            setStudents(res.data);
            setViewStep('students');
        } catch (e) { Alert.alert('Error', 'Failed to load students.'); }
        setLoading(false);
    };

    const handleStudentSelect = async (student) => {
        setSelectedStudent(student);
        setLoading(true);
        try {
            const res = await apiClient.get(`/lesson-feedback/teacher/student-lessons/${selectedSubjectItem.class_group}/${selectedSubjectItem.subject_name}/${student.student_id}`);
            setLessons(res.data);
            setViewStep('lessons');
        } catch (e) { Alert.alert('Error', 'Failed to load student lessons.'); }
        setLoading(false);
    };

    const handleLessonSelect = async (lesson) => {
        setSelectedLesson(lesson);
        if (!lesson.is_submitted) {
            Alert.alert("Pending", "Student has not submitted answers for this lesson yet.");
            return;
        }
        setLoading(true);
        try {
            const res = await apiClient.get(`/lesson-feedback/student/submission/${selectedStudent.student_id}/${selectedSubjectItem.class_group}/${selectedSubjectItem.subject_name}/${lesson.lesson_name}`);
            setAnswers(res.data.answers ||[]);
            setRemarks(res.data.teaching_remarks || '');
            
            let parsedRemarks =[];
            try {
                if (typeof res.data.teacher_remarks_checkboxes === 'string') parsedRemarks = JSON.parse(res.data.teacher_remarks_checkboxes);
                else if (Array.isArray(res.data.teacher_remarks_checkboxes)) parsedRemarks = res.data.teacher_remarks_checkboxes;
            } catch (e) {}
            setTeacherRemarks(parsedRemarks);
            
            setViewStep('grading');
        } catch (e) { Alert.alert('Error', 'Failed to load answers.'); }
        setLoading(false);
    };

    const handleMarkToggle = (index, markValue) => {
        if (isAdmin) return;
        const newAnswers = [...answers];
        newAnswers[index].mark = markValue;
        setAnswers(newAnswers);
    };

    const handleTeacherRemarkToggle = (option) => {
        if (isAdmin) return;
        setTeacherRemarks(prev => {
            if (option === "None of the above") return prev.includes("None of the above") ? [] : ["None of the above"];
            let newArr = prev.filter(item => item !== "None of the above");
            if (newArr.includes(option)) newArr = newArr.filter(item => item !== option);
            else newArr.push(option);
            return newArr;
        });
    };

    const handleSaveMarks = async () => {
        if (isAdmin) return;
        setLoading(true);
        try {
            await apiClient.post('/lesson-feedback/teacher/mark', {
                student_id: selectedStudent.student_id,
                class_group: selectedSubjectItem.class_group,
                subject_name: selectedSubjectItem.subject_name,
                lesson_name: selectedLesson.lesson_name,
                answers, teacher_id: user.id, teacher_remarks_checkboxes: teacherRemarks
            });
            Alert.alert('Success', 'Marks and remarks saved successfully!');
            handleStudentSelect(selectedStudent); 
        } catch (e) { Alert.alert('Error', 'Failed to save marks.'); }
        setLoading(false);
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

    // Sort Logic for Graph
    const getSortedStudentsForGraph = () => {
        return [...students]
            .filter(s => s.has_marks)
            .sort((a, b) => {
                if (sortOrder === 'high_to_low') return b.percentage - a.percentage;
                if (sortOrder === 'low_to_high') return a.percentage - b.percentage;
                // Default Roll No wise
                return parseInt(a.roll_no || 0, 10) - parseInt(b.roll_no || 0, 10);
            });
    };

    const renderHeader = (title, subtitle, showBack, backAction, showGraphBtn) => (
        <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    {showBack && (
                        <TouchableOpacity onPress={backAction} style={{ marginRight: 15 }}>
                            <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                        </TouchableOpacity>
                    )}
                    <View style={[styles.headerIconContainer, { backgroundColor: COLORS.iconBg }]}>
                        <MaterialIcons name="fact-check" size={24} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]} numberOfLines={1}>{title}</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>{subtitle}</Text>
                    </View>
                </View>
                {showGraphBtn && (
                    <TouchableOpacity style={styles.graphBtnTop} onPress={() => setShowGraph(true)}>
                        <MaterialIcons name="bar-chart" size={26} color={COLORS.primary} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={COLORS.background} />

            {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} /> : (
                <>
                    {/* STEP 1: CLASSES (GRID VIEW) */}
                    {viewStep === 'classes' && (
                        <>
                            {renderHeader(isAdmin ? "All Classes" : "My Classes", "Select a Class", false, null, false)}
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

                    {/* STEP 2: SUBJECTS (LIST VIEW) */}
                    {viewStep === 'subjects' && (
                        <>
                            {renderHeader(selectedClassGroup, "Select a Subject", true, () => setViewStep('classes'), false)}
                            <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 50 }}>
                                {groupedClasses[selectedClassGroup].map((sub, idx) => (
                                    <TouchableOpacity key={idx} style={[styles.card, { backgroundColor: COLORS.cardBg }]} onPress={() => handleSubjectSelect(sub)}>
                                        <Text style={[styles.cardTitle, { color: COLORS.textMain }]}>{sub.subject_name}</Text>
                                        
                                        <View style={styles.badgeContainer}>
                                            {sub.has_marks && (
                                                <View style={[styles.scoreBoxSmall, { borderColor: COLORS.redBox }]}>
                                                    <Text style={[styles.scoreTextSmall, { color: COLORS.redBox }]}>
                                                        {sub.total_obtained}/{sub.total_max}
                                                    </Text>
                                                </View>
                                            )}
                                            <MaterialIcons name="chevron-right" size={24} color={COLORS.textSub} />
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </>
                    )}

                    {/* STEP 3: STUDENTS */}
                    {viewStep === 'students' && (
                        <>
                            {renderHeader(`${selectedSubjectItem.class_group} - ${selectedSubjectItem.subject_name}`, "Select a Student", true, () => {
                                setViewStep('subjects'); fetchClasses();
                            }, true)}
                            <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 50 }}>
                                {students.length > 0 ? students.map((student, idx) => (
                                    <TouchableOpacity 
                                        key={student.student_id} 
                                        style={[styles.card, { backgroundColor: COLORS.cardBg }]} 
                                        onPress={() => handleStudentSelect(student)}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                            <Text style={{ fontWeight: 'bold', width: 35, color: COLORS.textSub, fontSize: 16 }}>
                                                {student.roll_no || '-'}
                                            </Text>
                                            <Text style={[styles.cardTitle, { color: COLORS.textMain, marginLeft: 10 }]} numberOfLines={1}>
                                                {student.full_name}
                                            </Text>
                                        </View>

                                        <View style={styles.badgeContainer}>
                                            {student.has_marks && (
                                                <View style={[styles.scoreBoxLarge, { borderColor: COLORS.redBox }]}>
                                                    <Text style={[styles.scoreTextLarge, { color: COLORS.redBox }]}>
                                                        {student.total_obtained}/{student.total_max}
                                                    </Text>
                                                </View>
                                            )}
                                            <MaterialIcons name="chevron-right" size={24} color={COLORS.textSub} />
                                        </View>
                                    </TouchableOpacity>
                                )) : <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No students in this class.</Text>}
                            </ScrollView>
                        </>
                    )}

                    {/* STEP 4: LESSONS */}
                    {viewStep === 'lessons' && (
                        <>
                            {renderHeader(selectedStudent.full_name, "Select a Lesson to Mark", true, () => {
                                setViewStep('students'); handleSubjectSelect(selectedSubjectItem); 
                            }, false)}
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
                                )) : <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No lessons found in syllabus.</Text>}
                            </ScrollView>
                        </>
                    )}

                    {/* STEP 5: GRADING & REMARKS */}
                    {viewStep === 'grading' && (
                        <>
                            {renderHeader(selectedLesson.lesson_name, selectedStudent.full_name, true, () => setViewStep('lessons'), false)}
                            <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 50 }}>
                                
                                <View style={[styles.remarksBox, { backgroundColor: COLORS.rowAlt, borderColor: COLORS.border }]}>
                                    <Text style={[styles.label, { color: COLORS.primary }]}>Student Remarks:</Text>
                                    <Text style={{ color: COLORS.textMain, marginTop: 5, fontSize: 14 }}>{remarks || 'No remarks provided.'}</Text>
                                </View>

                                {answers.map((item, index) => (
                                    <View key={index} style={[styles.questionBox, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                                        <Text style={[styles.label, { color: COLORS.textSub }]}>{item.q_no}. {item.question}</Text>
                                        <Text style={{ color: COLORS.textMain, marginTop: 8, marginBottom: 15, fontSize: 15, padding: 10, backgroundColor: COLORS.inputBg, borderRadius: 8, overflow: 'hidden' }}>
                                            {item.answer || 'No answer typed.'}
                                        </Text>
                                        
                                        <View style={styles.gradingRow}>
                                            <Text style={{ color: COLORS.textSub, fontWeight: 'bold' }}>Marks given:</Text>
                                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                                <TouchableOpacity 
                                                    style={[styles.markBtn, item.mark === 0 && { backgroundColor: COLORS.danger, borderColor: COLORS.danger }]}
                                                    onPress={() => handleMarkToggle(index, 0)}
                                                    disabled={isAdmin}
                                                >
                                                    <Text style={[styles.markBtnText, item.mark === 0 && { color: '#FFF' }]}>0</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity 
                                                    style={[styles.markBtn, item.mark === 1 && { backgroundColor: COLORS.success, borderColor: COLORS.success }]}
                                                    onPress={() => handleMarkToggle(index, 1)}
                                                    disabled={isAdmin}
                                                >
                                                    <Text style={[styles.markBtnText, item.mark === 1 && { color: '#FFF' }]}>1</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                ))}

                                {/* --- TEACHER REMARKS CHECKBOXES --- */}
                                <View style={[styles.questionBox, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border, paddingBottom: 5 }]}>
                                    <Text style={[styles.label, { color: COLORS.primary, marginBottom: 10 }]}>Teacher Remarks (Check all that apply):</Text>
                                    
                                    {TEACHER_REMARK_OPTIONS.map(opt => {
                                        const isChecked = teacherRemarks.includes(opt);
                                        return (
                                            <TouchableOpacity 
                                                key={opt} 
                                                style={styles.checkboxRow} 
                                                onPress={() => handleTeacherRemarkToggle(opt)} 
                                                disabled={isAdmin}
                                            >
                                                <MaterialIcons 
                                                    name={isChecked ? "check-box" : "check-box-outline-blank"} 
                                                    size={24} 
                                                    color={isChecked ? COLORS.primary : COLORS.iconGrey} 
                                                />
                                                <Text style={[styles.checkboxText, { color: isChecked ? COLORS.primary : COLORS.textMain }]}>
                                                    {opt}
                                                </Text>
                                            </TouchableOpacity>
                                        )
                                    })}
                                </View>

                                {!isAdmin && (
                                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: COLORS.primary }]} onPress={handleSaveMarks}>
                                        <Text style={styles.saveBtnText}>Save Marks</Text>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        </>
                    )}
                </>
            )}

            {/* --- GRAPH MODAL WITH FILTER --- */}
            <Modal visible={showGraph} animationType="slide" onRequestClose={() => setShowGraph(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
                    <View style={[styles.modalHeader, { backgroundColor: COLORS.cardBg, borderBottomColor: COLORS.border }]}>
                        <TouchableOpacity onPress={() => setShowGraph(false)} style={{ padding: 5 }}>
                            <MaterialIcons name="close" size={26} color={COLORS.textMain} />
                        </TouchableOpacity>
                        <Text style={[styles.modalTitle, { color: COLORS.textMain }]}>Performance Analytics</Text>
                        <View style={{ width: 30 }}/>
                    </View>

                    <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: COLORS.primary, marginTop: 15, marginBottom: 10 }}>
                        Student Ranking ({selectedSubjectItem?.class_group} - {selectedSubjectItem?.subject_name})
                    </Text>

                    {/* --- FILTER & TEACHER NAME BLOCK --- */}
                    <View style={{ paddingHorizontal: 20, marginBottom: 15, width: '100%' }}>
                        <View style={{ borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 8, overflow: 'hidden', backgroundColor: COLORS.cardBg }}>
                            <Picker
                                selectedValue={sortOrder}
                                onValueChange={(val) => setSortOrder(val)}
                                style={{ color: COLORS.primary, height: 45, width: '100%' }}
                                dropdownIconColor={COLORS.primary}
                            >
                                <Picker.Item label="Roll No wise" value="roll_no" />
                                <Picker.Item label="High to low" value="high_to_low" />
                                <Picker.Item label="Low to High" value="low_to_high" />
                            </Picker>
                        </View>
                        <Text style={{ textAlign: 'center', fontSize: 13, fontWeight: '700', color: COLORS.textSub, marginTop: 10 }}>
                            Teacher: {selectedSubjectItem?.teacher_name || user?.full_name || 'N/A'}
                        </Text>
                    </View>

                    <View style={styles.graphContainer}>
                        {students.filter(s => s.has_marks).length > 0 ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, alignItems: 'flex-end', paddingTop: 10 }}>
                                {getSortedStudentsForGraph().map((item, idx) => (
                                    <AnimatedBar 
                                        key={idx}
                                        percentage={item.percentage}
                                        topLabel={`${item.total_obtained}/${item.total_max}`}
                                        label={item.full_name}
                                        rollNo={item.roll_no || '-'} 
                                        color={getBarColor(item.percentage, COLORS)} 
                                        colors={COLORS}
                                    />
                                ))}
                            </ScrollView>
                        ) : (
                            <View style={{ alignItems: 'center', marginTop: 80 }}>
                                <MaterialIcons name="bar-chart" size={50} color={COLORS.textSub} />
                                <Text style={{ color: COLORS.textSub, marginTop: 10 }}>No graded students available for graph.</Text>
                            </View>
                        )}
                    </View>

                    {/* --- GUIDANCE LEGEND FOOTER --- */}
                    <View style={[styles.legendFooter, { backgroundColor: COLORS.cardBg, borderTopColor: COLORS.border }]}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: COLORS.graphGreen }]} />
                            <Text style={[styles.legendText, { color: COLORS.textSub }]}>Above Avg (≥80%)</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: COLORS.graphBlue }]} />
                            <Text style={[styles.legendText, { color: COLORS.textSub }]}>Avg (50-79%)</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: COLORS.graphRed }]} />
                            <Text style={[styles.legendText, { color: COLORS.textSub }]}>Below Avg (&lt;50%)</Text>
                        </View>
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerCard: { padding: 15, width: '94%', alignSelf: 'center', marginTop: 15, marginBottom: 5, borderRadius: 12, elevation: 2 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13, marginTop: 2 },
    graphBtnTop: { padding: 8, backgroundColor: '#E0F2F1', borderRadius: 8 },
    
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: width * 0.03, paddingTop: 10, paddingBottom: 50 },
    gridCard: { width: '48%', borderWidth: 1.5, borderRadius: 12, padding: 18, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1, shadowOpacity: 0.05 },
    gridText: { fontSize: 16, fontWeight: 'bold' },

    card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, marginBottom: 12, borderRadius: 10, elevation: 1, width: '94%', alignSelf: 'center' },
    cardTitle: { fontSize: 15, fontWeight: '600', flex: 1 },
    
    badgeContainer: { flexDirection: 'row', alignItems: 'center' },
    scoreBoxLarge: { borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginRight: 8, backgroundColor: 'transparent' },
    scoreTextLarge: { fontWeight: 'bold', fontSize: 16 },
    scoreBoxSmall: { borderWidth: 1.5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 8, backgroundColor: 'transparent' },
    scoreTextSmall: { fontWeight: 'bold', fontSize: 14 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 },
    badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
    
    remarksBox: { padding: 15, width: '94%', alignSelf: 'center', borderRadius: 10, borderWidth: 1, marginBottom: 15, elevation: 1, shadowOpacity: 0.05 },
    questionBox: { padding: 15, width: '94%', alignSelf: 'center', borderRadius: 10, borderWidth: 1, marginBottom: 15, elevation: 1, shadowOpacity: 0.05 },
    label: { fontSize: 13, fontWeight: 'bold' },
    gradingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 12 },
    markBtn: { width: 45, height: 40, borderRadius: 8, borderWidth: 1, borderColor: '#CCC', justifyContent: 'center', alignItems: 'center' },
    markBtnText: { fontWeight: 'bold', fontSize: 16, color: '#777' },
    
    checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    checkboxText: { marginLeft: 10, fontSize: 15, fontWeight: '500' },
    
    saveBtn: { padding: 15, width: '94%', alignSelf: 'center', borderRadius: 10, alignItems: 'center', marginTop: 5 },
    saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
    emptyText: { textAlign: 'center', marginTop: 30, fontSize: 14 },

    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    graphContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    barWrapper: { alignItems: 'center', width: 60, marginHorizontal: 10, height: 230, justifyContent: 'flex-end' },
    barLabelTop: { fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
    barTrack: { width: 40, height: 180, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
    barFill: { width: '100%', borderRadius: 6 },
    barLabelBottom: { fontSize: 11, fontWeight: '700', marginTop: 8, textAlign: 'center', width: '100%' },
    barRollNo: { fontSize: 11, fontWeight: 'bold', marginTop: 2, marginBottom: 20, textAlign: 'center', width: '100%' },

    legendFooter: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 10, borderTopWidth: 1 },
    legendItem: { flexDirection: 'row', alignItems: 'center' },
    legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
    legendText: { fontSize: 12, fontWeight: '700' }
});

export default TeacherLessonFeedback;