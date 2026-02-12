import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  FlatList,
  Modal,
  useColorScheme,
  StatusBar,
  Dimensions
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Animatable from 'react-native-animatable';
import { useNavigation } from '@react-navigation/native';

// Import your existing auth/api hooks
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',    
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    success: '#43A047',
    error: '#E53935',
    border: '#CFD8DC',
    inputBg: '#FFFFFF',
    iconBg: '#E0F2F1',
    btnInactive: '#FFFFFF',
    shadow: '#000'
};

const DarkColors = {
    primary: '#008080',    
    background: '#121212', 
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    success: '#43A047',
    error: '#EF5350',
    border: '#333333',
    inputBg: '#2C2C2C',
    iconBg: '#333333',
    btnInactive: '#2C2C2C',
    shadow: '#000'
};

const CLASS_GROUPS = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MarkStudentAttendance = () => {
    // Theme Hook
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const navigation = useNavigation();
    const { user } = useAuth();
    
    // --- State: Selection ---
    const [selectedClass, setSelectedClass] = useState(CLASS_GROUPS[0]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    
    // --- State: Data & Logic ---
    const [viewState, setViewState] = useState('selection'); // 'selection' | 'success' | 'marking'
    const [isLoading, setIsLoading] = useState(false);
    const [students, setStudents] = useState<any[]>([]);
    const [subjectName, setSubjectName] = useState(''); 
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Format Date Helper ---
    const formatDate = (date: Date) => {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // --- Handlers ---
    const handleDateChange = (event: any, date?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (date) setSelectedDate(date);
    };

    // --- MAIN LOGIC ---
    const handleProceed = async () => {
        setIsLoading(true);
        try {
            const dateString = selectedDate.toISOString().split('T')[0];
            const periodNumber = 1; 
            const dayOfWeek = DAYS[selectedDate.getDay()];

            if (dayOfWeek === 'Sunday') {
                Alert.alert("Warning", "Selected date is a Sunday.");
                setIsLoading(false);
                return;
            }

            const timetableRes = await apiClient.get(`/timetable/${selectedClass}`);
            const slot = timetableRes.data.find(
                (s: any) => s.day_of_week === dayOfWeek && s.period_number === periodNumber
            );
            
            const resolvedSubject = slot ? slot.subject_name : "General Attendance";
            setSubjectName(resolvedSubject);

            const statusRes = await apiClient.get('/attendance/status', {
                params: { 
                    class_group: selectedClass, 
                    date: dateString, 
                    period_number: periodNumber, 
                    subject_name: resolvedSubject 
                }
            });

            if (statusRes.data.isMarked) {
                setViewState('success');
            } else {
                await fetchStudentSheet(periodNumber, dateString);
                setViewState('marking');
            }

        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to fetch attendance data. Please check network.');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStudentSheet = async (periodNumber: number, dateString: string) => {
        const sheetRes = await apiClient.get('/attendance/sheet', {
            params: { class_group: selectedClass, date: dateString, period_number: periodNumber }
        });

        const formattedData = sheetRes.data.map((student: any) => ({
            ...student,
            status: student.status || 'Present' 
        }));
        setStudents(formattedData);
    };

    const toggleStatus = (id: number, status: string) => {
        setStudents(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const payload = {
                class_group: selectedClass,
                subject_name: subjectName,
                period_number: 1,
                date: selectedDate.toISOString().split('T')[0],
                teacher_id: user.id, 
                attendanceData: students.map(s => ({ student_id: s.id, status: s.status }))
            };

            await apiClient.post('/attendance', payload);
            setViewState('success');
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to save.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ================= RENDER =================

    if (isLoading) {
        return (
            <View style={[styles.loaderContainer, { backgroundColor: COLORS.background }]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={{marginTop: 10, color: COLORS.textSub}}>Checking records...</Text>
            </View>
        );
    }

    // --- VIEW 1: SELECTION ---
    if (viewState === 'selection') {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
                
                {/* --- HEADER CARD --- */}
                <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                    <View style={styles.headerLeft}>
                        <View style={[styles.headerIconContainer, { backgroundColor: COLORS.iconBg }]}>
                            <MaterialIcons name="assignment-turned-in" size={24} color={COLORS.primary} />
                        </View>
                        <View style={styles.headerTextContainer}>
                            <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Mark Attendance</Text>
                            <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Daily Entry</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.contentContainer}>
                    <Text style={[styles.label, { color: COLORS.textSub }]}>Select Class</Text>
                    <View style={[styles.pickerWrapper, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                        <Picker
                            selectedValue={selectedClass}
                            onValueChange={(itemValue) => setSelectedClass(itemValue)}
                            dropdownIconColor={COLORS.textMain}
                            style={[styles.picker, { color: COLORS.textMain }]}
                        >
                            {CLASS_GROUPS.map((cls) => (
                                <Picker.Item key={cls} label={cls} value={cls} style={{fontSize: 14}} />
                            ))}
                        </Picker>
                    </View>

                    <Text style={[styles.label, { color: COLORS.textSub }]}>Select Date</Text>
                    <TouchableOpacity 
                        style={[styles.datePickerBtn, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]} 
                        onPress={() => setShowDatePicker(true)}
                    >
                        <Text style={[styles.dateText, { color: COLORS.textMain }]}>{formatDate(selectedDate)}</Text>
                        <Icon name="calendar" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                    {showDatePicker && (
                        <DateTimePicker
                            value={selectedDate}
                            mode="date"
                            display="default"
                            onChange={handleDateChange}
                        />
                    )}

                    <TouchableOpacity style={[styles.proceedBtn, { backgroundColor: COLORS.primary }]} onPress={handleProceed}>
                        <Text style={styles.proceedBtnText}>PROCEED</Text>
                        <Icon name="arrow-right" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // --- VIEW 2: SUCCESS ---
    if (viewState === 'success') {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
                <View style={[styles.contentContainer, { justifyContent: 'center', alignItems: 'center', flex: 1 }]}>
                    <TouchableOpacity onPress={() => setViewState('selection')} style={styles.closeIcon}>
                        <Icon name="close" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>

                    <Animatable.View animation="zoomIn" duration={600} style={{ alignItems: 'center', width: '100%' }}>
                        <View style={[styles.successCircle, { backgroundColor: COLORS.success }]}>
                            <Icon name="check" size={50} color="#fff" />
                        </View>
                        <Text style={[styles.successTitle, { color: COLORS.textMain }]}>Done!</Text>
                        <Text style={[styles.successSubtitle, { color: COLORS.textSub }]}>
                            Attendance for <Text style={{fontWeight: 'bold', color: COLORS.textMain}}>{formatDate(selectedDate)}</Text> has been marked.
                        </Text>
                        
                        <TouchableOpacity 
                            style={[styles.editButton, { backgroundColor: COLORS.primary }]} 
                            onPress={async () => {
                                setIsLoading(true);
                                await fetchStudentSheet(1, selectedDate.toISOString().split('T')[0]);
                                setIsLoading(false);
                                setViewState('marking');
                            }}
                        >
                            <Text style={styles.editButtonText}>Edit Record</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={{marginTop: 20}} onPress={() => setViewState('selection')}>
                            <Text style={{color: COLORS.textSub}}>Back to Selection</Text>
                        </TouchableOpacity>
                    </Animatable.View>
                </View>
            </SafeAreaView>
        );
    }

    // --- VIEW 3: MARKING LIST ---
    if (viewState === 'marking') {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
                
                {/* --- HEADER CARD (With Back) --- */}
                <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity onPress={() => setViewState('selection')} style={{marginRight: 10, padding: 4}}>
                            <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                        </TouchableOpacity>
                        <View style={[styles.headerIconContainer, { backgroundColor: COLORS.iconBg }]}>
                            <MaterialIcons name="edit-note" size={24} color={COLORS.primary} />
                        </View>
                        <View style={styles.headerTextContainer}>
                            <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>{selectedClass}</Text>
                            <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>{students.length} Students • {formatDate(selectedDate)}</Text>
                        </View>
                    </View>
                </View>

                <FlatList
                    data={students}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 100 }}
                    renderItem={({ item }) => {
                        const isPresent = item.status === 'Present';
                        return (
                            <View style={[styles.studentCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.rowName, { color: COLORS.textMain }]}>{item.full_name}</Text>
                                    <Text style={[styles.rowSubText, { color: COLORS.textSub }]}>{item.roll_no ? `Roll: ${item.roll_no}` : '-'}</Text>
                                </View>

                                <View style={styles.actionButtonsContainer}>
                                    <TouchableOpacity 
                                        style={[
                                            styles.statusBtn, 
                                            isPresent 
                                                ? { backgroundColor: COLORS.success, borderColor: COLORS.success } 
                                                : { backgroundColor: COLORS.btnInactive, borderColor: COLORS.border }
                                        ]}
                                        onPress={() => toggleStatus(item.id, 'Present')}
                                    >
                                        <Text style={[styles.statusText, isPresent ? {color: '#fff'} : {color: COLORS.success}]}>P</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        style={[
                                            styles.statusBtn, 
                                            !isPresent 
                                                ? { backgroundColor: COLORS.error, borderColor: COLORS.error } 
                                                : { backgroundColor: COLORS.btnInactive, borderColor: COLORS.border }
                                        ]}
                                        onPress={() => toggleStatus(item.id, 'Absent')}
                                    >
                                        <Text style={[styles.statusText, !isPresent ? {color: '#fff'} : {color: COLORS.error}]}>A</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    }}
                />

                <View style={styles.footerContainer}>
                    <TouchableOpacity 
                        style={[styles.submitFooterButton, { backgroundColor: COLORS.primary }]}
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.submitFooterText}>Submit Attendance</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return null;
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // --- HEADER CARD STYLES ---
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
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },

    // --- SELECTION VIEW ---
    contentContainer: { padding: 20 },
    label: { fontSize: 14, marginBottom: 8, fontWeight: '600', marginTop: 10 },
    pickerWrapper: { borderWidth: 1, borderRadius: 8, overflow: 'hidden', height: 50, justifyContent: 'center' },
    picker: { width: '100%' },
    
    datePickerBtn: { 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 15, borderWidth: 1, borderRadius: 8, marginBottom: 30 
    },
    dateText: { fontSize: 16, fontWeight: '500' },
    
    proceedBtn: { 
        padding: 16, borderRadius: 12, 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 3 
    },
    proceedBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginRight: 10 },

    // --- SUCCESS VIEW ---
    closeIcon: { position: 'absolute', top: 20, right: 20, padding: 10, zIndex: 10 },
    successCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    successTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
    successSubtitle: { fontSize: 15, textAlign: 'center', paddingHorizontal: 40, marginBottom: 30 },
    editButton: { paddingVertical: 12, paddingHorizontal: 40, borderRadius: 25 },
    editButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    // --- MARKING LIST ---
    studentCard: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 15, borderRadius: 12, marginBottom: 10,
        elevation: 1, shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: {width: 0, height: 1}
    },
    rowName: { fontSize: 16, fontWeight: '600' },
    rowSubText: { fontSize: 12, marginTop: 4 },
    
    actionButtonsContainer: { flexDirection: 'row', gap: 10 },
    statusBtn: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
    statusText: { fontSize: 16, fontWeight: 'bold' },

    // Footer
    footerContainer: { 
        position: 'absolute', bottom: 20, left: 20, right: 20, 
    },
    submitFooterButton: { 
        paddingVertical: 15, borderRadius: 30,
        alignItems: 'center', justifyContent: 'center', elevation: 5,
        shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: {width: 0, height: 3}
    },
    submitFooterText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
});

export default MarkStudentAttendance;