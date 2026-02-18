import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView,
    TouchableOpacity, ActivityIndicator, Alert, Modal, Animated, Easing,
    Dimensions, useColorScheme, StatusBar, Platform, UIManager
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// Enable Layout Animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',    
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    success: '#10b981',
    average: '#3b82f6',
    poor: '#ef4444',
    warning: '#FFC107',
    border: '#CFD8DC',
    inputBg: '#FFFFFF',
    iconBg: '#E0F2F1',
    tableHeader: '#e0e7ff',
    tableHeaderText: '#4338ca',
    tableBorder: '#c7d2fe',
    rowAlt: '#f8fafc',
    track: '#F0F0F0',
    modalOverlay: 'rgba(0,0,0,0.5)',
    btnDisabled: '#E0E0E0'
};

const DarkColors = {
    primary: '#008080',    
    background: '#121212', 
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    success: '#10b981',
    average: '#3b82f6',
    poor: '#ef4444',
    warning: '#FFC107',
    border: '#333333',
    inputBg: '#2C2C2C',
    iconBg: '#333333',
    tableHeader: '#2C2C2C',
    tableHeaderText: '#E0E0E0',
    tableBorder: '#444',
    rowAlt: '#252525',
    track: '#333333',
    modalOverlay: 'rgba(255,255,255,0.1)',
    btnDisabled: '#424242'
};

// --- CONSTANTS ---
const COL_WIDTHS = {
    ROLL: 50,      
    NAME: 150,     
    STATUS: 180,   
    REMARKS: 200   
};
const TABLE_MIN_WIDTH = COL_WIDTHS.ROLL + COL_WIDTHS.NAME + COL_WIDTHS.STATUS + COL_WIDTHS.REMARKS; 

// --- ANIMATED BAR COMPONENT ---
const AnimatedBar = ({ percentage, rating, label, roll, color, colors }) => {
    const animatedHeight = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animatedHeight, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
            easing: Easing.out(Easing.poly(4)),
        }).start();
    }, [percentage]);

    const heightStyle = animatedHeight.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', `${percentage}%`]
    });

    // --- UPDATED: Show up to 8 chars instead of just splitting by space ---
    const displayLabel = label.length > 8 ? label.substring(0, 8) + '..' : label;

    return (
        <View style={styles.barWrapper}>
            <Text style={[styles.barLabelTop, { color: colors.textMain }]}>{Math.round(percentage)}%</Text>
            
            <View style={[styles.barTrack, { backgroundColor: colors.track }]}>
                <Animated.View style={[styles.barFill, { height: heightStyle, backgroundColor: color }]} />
            </View>
            
            {/* Roll Number Display */}
            <Text style={[styles.barRollText, { color: colors.primary }]}>
                {roll ? `(${roll})` : '-'}
            </Text>

            <Text style={[styles.barLabelBottom, { color: colors.textMain }]} numberOfLines={1}>
                {displayLabel} 
            </Text>
            
            <View style={{flexDirection:'row', alignItems:'center', marginTop:2}}>
                 <Text style={{fontSize:10, fontWeight:'bold', color: colors.textSub}}>{rating}</Text>
                 <MaterialIcons name="star" size={10} color={colors.warning} />
            </View>
        </View>
    );
};

const StudentFeedback = () => {
    // Theme Hook
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    
    // --- Main Screen Filters ---
    const [allClasses, setAllClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState('');
    
    const [availableTeachers, setAvailableTeachers] = useState([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState(null);

    // --- Data ---
    const [students, setStudents] = useState([]);
    const [hasChanges, setHasChanges] = useState(false);

    // --- Compare Modal State ---
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [compareClass, setCompareClass] = useState(''); 
    const [compareSubject, setCompareSubject] = useState('All Subjects'); 
    const [sortOrder, setSortOrder] = useState('desc'); 
    const [analyticsData, setAnalyticsData] = useState([]);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);

    // Helper
    const isOverallView = selectedSubject === 'All Subjects';

    // --- 1. Initial Setup ---
    useEffect(() => {
        if (!user) return;
        fetchClasses(); 
    }, [user]);

    // --- 2. API Calls for Filters ---
    const fetchClasses = async () => {
        try {
            let classesData = [];
            if (user?.role === 'admin') {
                const response = await apiClient.get('/feedback/classes');
                classesData = response.data;
            } else if (user?.role === 'teacher') {
                const response = await apiClient.get(`/teacher-classes/${user.id}`);
                classesData = response.data;
            }

            // --- IMPROVED SORTING LOGIC ---
            // Ensures LKG & UKG are at the top, then numeric classes
            const sortedClasses = classesData.sort((a, b) => {
                const valA = a.toUpperCase().replace(/\./g, ''); // Normalize (L.K.G -> LKG)
                const valB = b.toUpperCase().replace(/\./g, '');

                // Priority for LKG and UKG
                if (valA.includes('LKG')) return -1;
                if (valB.includes('LKG')) return 1;
                if (valA.includes('UKG')) return -1;
                if (valB.includes('UKG')) return 1;

                // Numeric Sort for Class 1, Class 2, etc.
                const numA = parseInt(valA.replace(/\D/g, ''), 10);
                const numB = parseInt(valB.replace(/\D/g, ''), 10);

                if (!isNaN(numA) && !isNaN(numB)) {
                    return numA - numB;
                }
                
                // Fallback to alphabetical
                return valA.localeCompare(valB);
            });

            setAllClasses(sortedClasses);
            if (sortedClasses.length > 0) {
                // Default to first class (likely LKG or Class 1)
                setSelectedClass(sortedClasses[0]);
            }
        } catch (error) { console.error('Error fetching classes', error); }
    };

    // Fetch Subjects when Class changes
    useEffect(() => {
        if (!selectedClass) {
            setAvailableSubjects([]);
            setSelectedSubject('');
            return;
        }
        const fetchSubjects = async () => {
            try {
                const params = { class_group: selectedClass };
                if (user?.role === 'teacher') params.teacher_id = user.id;

                const response = await apiClient.get('/feedback/subjects', { params });
                
                let subjectsList = response.data;
                if (user?.role === 'admin') {
                    subjectsList = ['All Subjects', ...subjectsList];
                }
                setAvailableSubjects(subjectsList);
                if (subjectsList.length > 0) setSelectedSubject(subjectsList[0]);
                else setSelectedSubject('');

            } catch (error) { console.error('Error fetching subjects', error); }
        };
        fetchSubjects();
    }, [selectedClass, user]);

    // Fetch Teachers (For Admin List View Editing)
    useEffect(() => {
        if (!selectedClass || !selectedSubject || isOverallView) {
            setAvailableTeachers([]);
            if (user?.role === 'admin') setSelectedTeacherId(null);
            return;
        }
        
        if (user?.role === 'teacher') {
            setSelectedTeacherId(user.id);
        } else if (user?.role === 'admin') {
            const fetchTeachersForSubject = async () => {
                try {
                    const response = await apiClient.get('/feedback/teachers', {
                        params: { class_group: selectedClass, subject: selectedSubject }
                    });
                    setAvailableTeachers(response.data);
                    if (response.data.length > 0) setSelectedTeacherId(response.data[0].id);
                    else setSelectedTeacherId(null);
                } catch (error) { console.error('Error fetching teachers', error); }
            };
            fetchTeachersForSubject();
        }
    }, [selectedClass, selectedSubject, user]);

    // --- 3. Fetch List Data (Main Screen) ---
    const fetchStudentData = useCallback(async () => {
        if (!selectedClass) { setStudents([]); return; }
        
        // Validation: Don't fetch if detailed view is selected but no teacher/subject is ready
        if (!isOverallView && (!selectedTeacherId || !selectedSubject)) {
            setStudents([]); return;
        }

        setLoading(true);
        try {
            const params = { class_group: selectedClass };

            if (isOverallView) {
                params.mode = 'overall';
            } else {
                params.teacher_id = selectedTeacherId;
                params.subject = selectedSubject;
            }

            const response = await apiClient.get('/feedback/students', { params });
            const formattedData = response.data.map((s) => ({
                ...s,
                status_marks: s.status_marks || 0, 
                remarks_category: s.remarks_category || null
            }));
            setStudents(formattedData);
            setHasChanges(false);
        } catch (error) {
            Alert.alert('Error', 'Failed to load student list.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [selectedClass, selectedTeacherId, selectedSubject, isOverallView]);

    useEffect(() => {
        if ((isOverallView && selectedClass) || (selectedClass && selectedSubject && selectedTeacherId)) {
            fetchStudentData();
        }
    }, [fetchStudentData]);


    // --- 4. Analytics Data (Modal) ---
    useEffect(() => {
        if (showCompareModal && compareClass) {
            fetchAnalytics();
        }
    }, [showCompareModal, compareSubject, sortOrder, compareClass]);

    const fetchAnalytics = async () => {
        setLoadingAnalytics(true);
        try {
            const params = { 
                class_group: compareClass, 
                mode: 'analytics',
                subject: compareSubject 
            };

            const response = await apiClient.get('/feedback/students', { params });
            
            let data = response.data.map(s => ({
                id: s.student_id,
                name: s.full_name,
                roll_no: s.roll_no,
                avg_rating: parseFloat(s.avg_rating || 0),
                percentage: parseFloat(s.percentage || 0)
            }));

            // Filter out empty data
            data = data.filter(s => s.avg_rating > 0);

            // Sort logic
            if (sortOrder === 'desc') {
                data.sort((a, b) => b.percentage - a.percentage);
            } else if (sortOrder === 'asc') {
                data.sort((a, b) => a.percentage - b.percentage);
            } else if (sortOrder === 'roll') {
                data.sort((a, b) => parseInt(a.roll_no || 0) - parseInt(b.roll_no || 0));
            }

            setAnalyticsData(data);
        } catch (error) {
            console.error("Analytics Error", error);
        } finally {
            setLoadingAnalytics(false);
        }
    };

    // --- 5. Save Logic ---
    const handleSave = async () => {
        if (isOverallView) return; 
        if (!selectedTeacherId || !selectedClass || !selectedSubject) return;
        
        setLoading(true);
        try {
            const payload = {
                teacher_id: selectedTeacherId,
                class_group: selectedClass,
                subject_name: selectedSubject, 
                feedback_data: students.map(s => ({
                    student_id: s.student_id,
                    status_marks: s.status_marks === 0 ? null : s.status_marks, 
                    remarks_category: s.remarks_category
                }))
            };
            await apiClient.post('/feedback', payload);
            Alert.alert("Success", "Student behavior updated!");
            setHasChanges(false);
            fetchStudentData();
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to save feedback.");
        } finally {
            setLoading(false);
        }
    };

    const updateStudentFeedback = (id, field, value) => {
        if (user?.role === 'admin') return; 
        if (isOverallView) return; 
        
        setStudents(prev => prev.map(s => {
            if (s.student_id === id) return { ...s, [field]: value };
            return s;
        }));
        setHasChanges(true);
    };

    // --- Sub-Components ---
    const RemarkButton = ({ label, targetValue, currentValue, color, onPress, disabled }) => {
        const isSelected = currentValue === targetValue;
        const opacity = isOverallView && !isSelected ? 0.3 : 1;
        return (
            <TouchableOpacity 
                style={[
                    styles.remarkBtn, 
                    { opacity }, 
                    isSelected 
                        ? { backgroundColor: color, borderColor: color } 
                        : { borderColor: COLORS.border, backgroundColor: COLORS.cardBg }
                ]}
                onPress={onPress} disabled={disabled}
            >
                <Text style={[styles.remarkBtnText, isSelected ? { color: '#FFF' } : { color: COLORS.textSub }]}>{label}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar backgroundColor={COLORS.background} barStyle={isDark ? 'light-content' : 'dark-content'} />
            
            {/* HEADER */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: COLORS.iconBg }]}>
                         <MaterialIcons name="fact-check" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Behaviour</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Student Tracking</Text>
                    </View>
                </View>

                {/* Right Side: Compare Button */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity 
                        style={styles.comButton}
                        onPress={() => {
                            if(selectedClass) {
                                setCompareClass(selectedClass); // Initialize modal with current class
                                setCompareSubject(selectedSubject || 'All Subjects');
                                setShowCompareModal(true);
                            } else {
                                Alert.alert("Select Class", "Please select a class first.");
                            }
                        }}
                    >
                        <Text style={styles.comBtnText}>COM</Text>
                        <MaterialIcons name="bar-chart" size={18} color="#fff" style={{marginLeft: 4}} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* FILTERS */}
            <View style={styles.filterContainer}>
                {/* Row 1: Class (Full Width) */}
                <View style={[styles.pickerWrapper, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                    <Picker
                        selectedValue={selectedClass}
                        onValueChange={setSelectedClass}
                        style={[styles.picker, { color: COLORS.textMain }]}
                        dropdownIconColor={COLORS.textMain}
                    >
                        <Picker.Item label="Select Class" value="" color={COLORS.textSub} />
                        {allClasses.map(c => <Picker.Item key={c} label={c} value={c} style={{fontSize: 14}} />)}
                    </Picker>
                </View>

                {/* Row 2: Subject */}
                {selectedClass !== '' && (
                    <View style={[styles.pickerWrapper, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                        <Picker
                            selectedValue={selectedSubject}
                            onValueChange={setSelectedSubject}
                            enabled={availableSubjects.length > 0}
                            style={[styles.picker, { color: COLORS.textMain }]}
                            dropdownIconColor={COLORS.textMain}
                        >
                            <Picker.Item label="Select Subject" value="" color={COLORS.textSub} />
                            {availableSubjects.map(s => <Picker.Item key={s} label={s} value={s} style={{fontSize: 14}} />)}
                        </Picker>
                    </View>
                )}

                {/* Row 3: Teacher (Admin only) */}
                {user?.role === 'admin' && selectedSubject !== '' && !isOverallView && (
                    <View style={[styles.pickerWrapper, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                        <Picker
                            selectedValue={selectedTeacherId?.toString()}
                            onValueChange={(val) => val && setSelectedTeacherId(parseInt(val))}
                            enabled={availableTeachers.length > 0}
                            style={[styles.picker, { color: COLORS.textMain }]}
                            dropdownIconColor={COLORS.textMain}
                        >
                            <Picker.Item label="Select Teacher" value="" color={COLORS.textSub} />
                            {availableTeachers.map(t => <Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} style={{fontSize: 14}} />)}
                        </Picker>
                    </View>
                )}
            </View>

            {/* TABLE CONTENT */}
            <View style={{flex: 1}}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }}
                >
                    <View style={{ minWidth: TABLE_MIN_WIDTH }}>
                        
                        <View style={[styles.tableHeader, { backgroundColor: COLORS.tableHeader, borderColor: COLORS.tableBorder }]}>
                            <Text style={[styles.th, { width: COL_WIDTHS.ROLL, textAlign: 'center', color: COLORS.tableHeaderText }]}>Roll</Text>
                            <Text style={[styles.th, { width: COL_WIDTHS.NAME, color: COLORS.tableHeaderText }]}>Student Name</Text>
                            <Text style={[styles.th, { width: COL_WIDTHS.STATUS, textAlign: 'center', color: COLORS.tableHeaderText }]}>
                                {isOverallView ? 'Avg Rating' : 'Rating'}
                            </Text>
                            <Text style={[styles.th, { width: COL_WIDTHS.REMARKS, textAlign: 'center', color: COLORS.tableHeaderText }]}>
                                {isOverallView ? 'Overall Remarks' : 'Remarks'}
                            </Text>
                        </View>

                        {loading ? (
                            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
                        ) : (
                            <ScrollView contentContainerStyle={{ paddingBottom: 130 }}> 
                                {students.length > 0 ? (
                                    students.map((item, index) => (
                                        <View key={item.student_id} style={[
                                            styles.row, 
                                            { backgroundColor: COLORS.cardBg, borderBottomColor: COLORS.border },
                                            index % 2 === 1 && { backgroundColor: COLORS.rowAlt }
                                        ]}>
                                            <Text style={[styles.td, { width: COL_WIDTHS.ROLL, textAlign: 'center', fontWeight: '700', color: COLORS.textMain }]}>
                                                {item.roll_no ? item.roll_no.toString().padStart(2, '0') : '-'}
                                            </Text>
                                            <Text style={[styles.td, { width: COL_WIDTHS.NAME, color: COLORS.textSub }]} numberOfLines={1}>
                                                {item.full_name}
                                            </Text>
                                            
                                            <View style={{ width: COL_WIDTHS.STATUS, flexDirection: 'row', justifyContent: 'center', gap: 2 }}>
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <TouchableOpacity 
                                                        key={star}
                                                        onPress={() => !isOverallView && !user?.role?.includes('admin') && updateStudentFeedback(item.student_id, 'status_marks', star)}
                                                        disabled={user?.role === 'admin' || isOverallView}
                                                        style={{ padding: 2 }}
                                                    >
                                                        <MaterialIcons 
                                                            name={item.status_marks && item.status_marks >= star ? "star" : "star-border"} 
                                                            size={28} 
                                                            color={item.status_marks && item.status_marks >= star ? COLORS.warning : COLORS.border} 
                                                        />
                                                    </TouchableOpacity>
                                                ))}
                                            </View>

                                            <View style={{ width: COL_WIDTHS.REMARKS, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                                                <RemarkButton label="G" targetValue="Good" currentValue={item.remarks_category} color={COLORS.success} disabled={user?.role === 'admin' || isOverallView} onPress={() => updateStudentFeedback(item.student_id, 'remarks_category', 'Good')} />
                                                <RemarkButton label="A" targetValue="Average" currentValue={item.remarks_category} color={COLORS.average} disabled={user?.role === 'admin' || isOverallView} onPress={() => updateStudentFeedback(item.student_id, 'remarks_category', 'Average')} />
                                                <RemarkButton label="P" targetValue="Poor" currentValue={item.remarks_category} color={COLORS.poor} disabled={user?.role === 'admin' || isOverallView} onPress={() => updateStudentFeedback(item.student_id, 'remarks_category', 'Poor')} />
                                            </View>
                                        </View>
                                    ))
                                ) : (
                                    <View style={styles.emptyContainer}>
                                        <MaterialIcons name="person-off" size={40} color={COLORS.border} />
                                        <Text style={[styles.emptyText, { color: COLORS.textSub }]}>
                                            {!selectedClass ? "Select a class." : "No data found."}
                                        </Text>
                                    </View>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </ScrollView>
            </View>

            {/* SAVE BUTTON */}
            {!isOverallView && user?.role === 'teacher' && hasChanges && (
                <View style={styles.floatingSaveContainer}>
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: COLORS.primary }]} onPress={handleSave} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" size="small"/> : (
                            <Text style={styles.saveBtnText}>Save Changes</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* FOOTER LEGEND */}
            <View style={[styles.footerContainer, { backgroundColor: COLORS.cardBg, borderTopColor: COLORS.border }]}>
                <View style={styles.legendGroup}>
                    <Text style={[styles.legendLabel, { color: COLORS.textMain }]}>Scale: </Text>
                    <MaterialIcons name="star" size={14} color={COLORS.warning} />
                    <Text style={[styles.legendText, { color: COLORS.textSub }]}> (1-5)</Text>
                </View>
                <View style={[styles.verticalDivider, { backgroundColor: COLORS.border }]} />
                <View style={styles.legendGroup}>
                    <Text style={[styles.legendLabel, { color: COLORS.textMain }]}>Note: </Text>
                    <Text style={[styles.legendText, { color: COLORS.success, fontWeight:'bold' }]}>G</Text><Text style={[styles.legendText, { color: COLORS.textSub }]}>=Good, </Text>
                    <Text style={[styles.legendText, { color: COLORS.average, fontWeight:'bold' }]}>A</Text><Text style={[styles.legendText, { color: COLORS.textSub }]}>=Avg, </Text>
                    <Text style={[styles.legendText, { color: COLORS.poor, fontWeight:'bold' }]}>P</Text><Text style={[styles.legendText, { color: COLORS.textSub }]}>=Poor</Text>
                </View>
            </View>

            {/* ========================================================== */}
            {/* COMPARISON MODAL */}
            {/* ========================================================== */}
            <Modal
                visible={showCompareModal}
                animationType="slide"
                onRequestClose={() => setShowCompareModal(false)}
            >
                <SafeAreaView style={{flex:1, backgroundColor: COLORS.background}}>
                    
                    {/* MODAL HEADER */}
                    <View style={[styles.modalHeader, { backgroundColor: COLORS.cardBg }]}>
                        <TouchableOpacity onPress={() => setShowCompareModal(false)} style={{padding:5}}>
                            <MaterialIcons name="close" size={26} color={COLORS.textMain} />
                        </TouchableOpacity>
                        <Text style={[styles.modalTitle, { color: COLORS.textMain }]}>Performance Analytics</Text>
                        <View style={{width:30}}/>
                    </View>

                    {/* MODAL FILTERS */}
                    <View style={[styles.modalFilterContainer, { backgroundColor: COLORS.inputBg, borderBottomColor: COLORS.border }]}>
                        
                        {/* 1. Class Filter (NEW) */}
                        <View style={{marginBottom: 10}}>
                            <Text style={[styles.modalLabel, { color: COLORS.textSub }]}>Comparing Class:</Text>
                            <View style={[styles.modalPickerWrap, { borderColor: COLORS.border, backgroundColor: COLORS.cardBg }]}>
                                <Picker
                                    selectedValue={compareClass}
                                    onValueChange={setCompareClass}
                                    style={{width:'100%', color: COLORS.textMain}}
                                    dropdownIconColor={COLORS.textMain}
                                >
                                    {allClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
                                </Picker>
                            </View>
                        </View>

                        {/* 2. Subject Filter */}
                        <View style={{marginBottom: 10}}>
                            <Text style={[styles.modalLabel, { color: COLORS.textSub }]}>Comparing Subject:</Text>
                            <View style={[styles.modalPickerWrap, { borderColor: COLORS.border, backgroundColor: COLORS.cardBg }]}>
                                <Picker
                                    selectedValue={compareSubject}
                                    onValueChange={setCompareSubject}
                                    style={{width:'100%', color: COLORS.textMain}}
                                    dropdownIconColor={COLORS.textMain}
                                >
                                    <Picker.Item label="All Subjects" value="All Subjects" />
                                    {availableSubjects
                                        .filter(s => s !== "All Subjects")
                                        .map(s => <Picker.Item key={s} label={s} value={s} />)
                                    }
                                </Picker>
                            </View>
                        </View>

                        {/* 3. Sort Filter */}
                        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                            <Text style={[styles.modalLabel, { color: COLORS.textSub }]}>Sort Order:</Text>
                            <View style={{flexDirection:'row', backgroundColor: COLORS.cardBg, borderRadius:8, borderWidth: 1, borderColor: COLORS.border}}>
                                <TouchableOpacity 
                                    style={[styles.sortBtn, sortOrder==='roll' && { backgroundColor: COLORS.background }]}
                                    onPress={() => setSortOrder('roll')}
                                >
                                    <Text style={[styles.sortBtnText, { color: sortOrder==='roll' ? COLORS.primary : COLORS.textSub, fontWeight: sortOrder==='roll'?'bold':'normal' }]}>Roll No</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.sortBtn, sortOrder==='desc' && { backgroundColor: COLORS.background }]}
                                    onPress={() => setSortOrder('desc')}
                                >
                                    <Text style={[styles.sortBtnText, { color: sortOrder==='desc' ? COLORS.primary : COLORS.textSub, fontWeight: sortOrder==='desc'?'bold':'normal' }]}>High to Low</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.sortBtn, sortOrder==='asc' && { backgroundColor: COLORS.background }]}
                                    onPress={() => setSortOrder('asc')}
                                >
                                    <Text style={[styles.sortBtnText, { color: sortOrder==='asc' ? COLORS.primary : COLORS.textSub, fontWeight: sortOrder==='asc'?'bold':'normal' }]}>Low to High</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* GRAPH CONTENT */}
                    <View style={styles.graphContainer}>
                        {loadingAnalytics ? (
                            <ActivityIndicator size="large" color={COLORS.primary} />
                        ) : analyticsData.length > 0 ? (
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false} 
                                contentContainerStyle={{paddingHorizontal: 10, alignItems:'flex-end'}}
                            >
                                {analyticsData.map((item, idx) => {
                                    let color = COLORS.average;
                                    if(item.percentage >= 85) color = COLORS.success;
                                    else if(item.percentage < 50) color = COLORS.poor;

                                    return (
                                        <AnimatedBar 
                                            key={idx}
                                            percentage={item.percentage}
                                            rating={item.avg_rating}
                                            label={item.name}
                                            roll={item.roll_no}
                                            color={color}
                                            colors={COLORS}
                                        />
                                    );
                                })}
                            </ScrollView>
                        ) : (
                            <View style={{alignItems:'center'}}>
                                <MaterialIcons name="bar-chart" size={50} color={COLORS.border} />
                                <Text style={{color: COLORS.textSub, marginTop: 10}}>No student data found.</Text>
                            </View>
                        )}
                    </View>

                    {/* MODAL LEGEND */}
                    <View style={[styles.modalFooter, { borderTopColor: COLORS.border }]}>
                         <View style={{flexDirection:'row', alignItems:'center', gap:5}}>
                             <View style={{width:10, height:10, borderRadius:5, backgroundColor: COLORS.success}}/>
                             <Text style={{fontSize:12, color: COLORS.textSub}}>85-100%</Text>
                         </View>
                         <View style={{flexDirection:'row', alignItems:'center', gap:5}}>
                             <View style={{width:10, height:10, borderRadius:5, backgroundColor: COLORS.average}}/>
                             <Text style={{fontSize:12, color: COLORS.textSub}}>50-85%</Text>
                         </View>
                         <View style={{flexDirection:'row', alignItems:'center', gap:5}}>
                             <View style={{width:10, height:10, borderRadius:5, backgroundColor: COLORS.poor}}/>
                             <Text style={{fontSize:12, color: COLORS.textSub}}>0-50%</Text>
                         </View>
                    </View>

                </SafeAreaView>
            </Modal>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 }, 
    headerCard: {
        paddingHorizontal: 15, paddingVertical: 12,
        width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10,
        borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        borderRadius: 30, width: 45, height: 45,
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },
    
    filterContainer: { paddingHorizontal: 20, marginBottom: 5 },
    pickerWrapper: {
        borderWidth: 1, borderRadius: 8, marginBottom: 10,
        overflow: 'hidden', height: 45, justifyContent: 'center'
    },
    picker: { width: '100%' },
    
    comButton: {
        backgroundColor: '#ef4444', height: 45, paddingHorizontal: 15, borderRadius: 8,
        justifyContent: 'center', alignItems: 'center', flexDirection: 'row', elevation: 2
    },
    comBtnText: { color:'#fff', fontWeight:'bold', fontSize: 12 },
    
    tableHeader: {
        flexDirection: 'row', paddingVertical: 12,
        borderTopWidth: 1, borderBottomWidth: 1,
        borderTopLeftRadius: 8, borderTopRightRadius: 8
    },
    th: { fontWeight: '700', fontSize: 13 },
    row: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
        borderBottomWidth: 1, minHeight: 65
    },
    td: { fontSize: 13 },
    remarkBtn: { width: 36, height: 36, borderRadius: 6, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    remarkBtnText: { fontWeight: 'bold', fontSize: 14 },
    floatingSaveContainer: {
        position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center', paddingBottom: 10, zIndex: 10,
    },
    saveBtn: {
        paddingVertical: 10, paddingHorizontal: 30, borderRadius: 25,
        elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: {width: 0, height: 2}
    },
    saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, letterSpacing: 0.5 },
    
    footerContainer: {
        position: 'absolute', bottom: 0, left: 0, right: 0, 
        borderTopWidth: 1, height: 45, 
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
        paddingHorizontal: 15, elevation: 10
    },
    legendGroup: { flexDirection: 'row', alignItems: 'center' },
    legendLabel: { fontSize: 12, fontWeight: '700', marginRight: 4 },
    legendText: { fontSize: 11, fontWeight: '500' },
    verticalDivider: { height: 16, width: 1, marginHorizontal: 12 },
    
    emptyContainer: { alignItems: 'center', marginTop: 50, width: '100%' },
    emptyText: { textAlign: 'center', marginTop: 10, fontSize: 14 },
    
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 15, elevation: 2
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    modalFilterContainer: { padding: 15, borderBottomWidth: 1 },
    modalLabel: { fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
    modalPickerWrap: { borderWidth: 1, borderRadius: 8, height: 45, justifyContent: 'center' },
    sortBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
    sortBtnActive: { elevation: 1 },
    sortBtnText: { fontSize: 11 },
    
    graphContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 },
    modalFooter: { flexDirection: 'row', justifyContent: 'space-evenly', padding: 15, borderTopWidth: 1 },
    
    barWrapper: { alignItems: 'center', width: 60, marginHorizontal: 8, height: 280, justifyContent: 'flex-end' },
    barLabelTop: { fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
    barTrack: { width: 30, height: 220, borderRadius: 0, justifyContent: 'flex-end', overflow: 'hidden' },
    barFill: { width: '100%', borderRadius: 0 },
    
    barRollText: { fontSize: 10, fontWeight: 'bold', marginTop: 4, textAlign: 'center' },

    barLabelBottom: { fontSize: 11, fontWeight: '600', marginTop: 1, textAlign:'center', width: '100%' },
});

export default StudentFeedback;