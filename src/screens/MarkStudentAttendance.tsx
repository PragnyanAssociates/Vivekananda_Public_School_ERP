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
  Modal
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Animatable from 'react-native-animatable';
import { useNavigation } from '@react-navigation/native';

// Import your existing auth/api hooks
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';

// --- Constants ---
const PRIMARY_COLOR = '#008080';
const WHITE = '#FFFFFF';
const TEXT_COLOR_DARK = '#37474F';
const TEXT_COLOR_MEDIUM = '#566573';
const BORDER_COLOR = '#E0E0E0';
const GREEN = '#43A047';
const RED = '#E53935';

const CLASS_GROUPS = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MarkStudentAttendance = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    
    // --- State: Selection ---
    const [selectedClass, setSelectedClass] = useState(CLASS_GROUPS[0]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    
    // --- State: Data & Logic ---
    const [viewState, setViewState] = useState('selection'); // 'selection' | 'success' | 'marking'
    const [isLoading, setIsLoading] = useState(false);
    const [students, setStudents] = useState([]);
    const [subjectName, setSubjectName] = useState(''); // To be fetched from timetable
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Format Date Helper ---
    const formatDate = (date) => {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // --- Handlers ---
    const handleDateChange = (event, date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (date) setSelectedDate(date);
    };

    // --- MAIN LOGIC: Check Status & Fetch Data ---
    const handleProceed = async () => {
        setIsLoading(true);
        try {
            const dateString = selectedDate.toISOString().split('T')[0];
            const periodNumber = 1; // Assuming Daily Attendance is always Period 1
            const dayOfWeek = DAYS[selectedDate.getDay()];

            if (dayOfWeek === 'Sunday') {
                Alert.alert("Warning", "Selected date is a Sunday.");
                setIsLoading(false);
                return;
            }

            // 1. Fetch Timetable to get Subject Name for Period 1 on this day
            // We need this to check status correctly and save correctly
            const timetableRes = await apiClient.get(`/timetable/${selectedClass}`);
            const slot = timetableRes.data.find(
                s => s.day_of_week === dayOfWeek && s.period_number === periodNumber
            );
            
            // If no subject assigned, fallback to "General Attendance" or alert
            const resolvedSubject = slot ? slot.subject_name : "General Attendance";
            setSubjectName(resolvedSubject);

            // 2. Check if Attendance is already marked
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
                // 3. Not marked: Fetch Sheet to mark it
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

    // --- Fetch Student Sheet ---
    const fetchStudentSheet = async (periodNumber, dateString) => {
        const sheetRes = await apiClient.get('/attendance/sheet', {
            params: { class_group: selectedClass, date: dateString, period_number: periodNumber }
        });

        const formattedData = sheetRes.data.map(student => ({
            ...student,
            status: student.status || 'Present' 
        }));
        setStudents(formattedData);
    };

    // --- Toggle P/A ---
    const toggleStatus = (id, status) => {
        setStudents(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    };

    // --- Submit Attendance ---
    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const payload = {
                class_group: selectedClass,
                subject_name: subjectName,
                period_number: 1,
                date: selectedDate.toISOString().split('T')[0],
                teacher_id: user.id, // Admin ID passed here
                attendanceData: students.map(s => ({ student_id: s.id, status: s.status }))
            };

            await apiClient.post('/attendance', payload);
            setViewState('success');
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to save.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ================= RENDER =================

    if (isLoading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                <Text style={{marginTop: 10, color: TEXT_COLOR_MEDIUM}}>Checking records...</Text>
            </View>
        );
    }

    // --- VIEW 1: SELECTION (Admin picks Class & Date) ---
    if (viewState === 'selection') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        {/* <Icon name="arrow-left" size={24} color={TEXT_COLOR_DARK} /> */}
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Mark Attendance</Text>
                </View>

                <View style={styles.selectionContent}>
                    <Text style={styles.label}>Select Class</Text>
                    <View style={styles.pickerWrapper}>
                        <Picker
                            selectedValue={selectedClass}
                            onValueChange={(itemValue) => setSelectedClass(itemValue)}
                            dropdownIconColor={TEXT_COLOR_DARK}
                        >
                            {CLASS_GROUPS.map((cls) => (
                                <Picker.Item key={cls} label={cls} value={cls} style={styles.pickerItem} />
                            ))}
                        </Picker>
                    </View>

                    <Text style={styles.label}>Select Date</Text>
                    <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                        <Icon name="calendar" size={20} color={TEXT_COLOR_DARK} style={{marginRight: 10}} />
                        <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                        <DateTimePicker
                            value={selectedDate}
                            mode="date"
                            display="default"
                            onChange={handleDateChange}
                        />
                    )}

                    <TouchableOpacity style={styles.proceedBtn} onPress={handleProceed}>
                        <Text style={styles.proceedBtnText}>PROCEED TO MARK</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // --- VIEW 2: SUCCESS (Already Marked) ---
    if (viewState === 'success') {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <TouchableOpacity onPress={() => setViewState('selection')} style={[styles.backButton, {top: 20, left: 20}]}>
                    <Icon name="close" size={24} color={TEXT_COLOR_DARK} />
                </TouchableOpacity>

                <Animatable.View animation="zoomIn" duration={600} style={{ alignItems: 'center' }}>
                    <View style={styles.successCircle}>
                        <Icon name="check" size={60} color={WHITE} />
                    </View>
                    <Text style={styles.successTitle}>Attendance Marked!</Text>
                    <Text style={styles.successSubtitle}>
                        Attendance for {formatDate(selectedDate)} has been saved successfully. You can click "Edit Attendance" to make any changes.
                    </Text>
                    
                    <TouchableOpacity 
                        style={styles.editButton} 
                        onPress={async () => {
                            setIsLoading(true);
                            await fetchStudentSheet(1, selectedDate.toISOString().split('T')[0]);
                            setIsLoading(false);
                            setViewState('marking');
                        }}
                    >
                        <Text style={styles.editButtonText}>Edit Attendance</Text>
                    </TouchableOpacity>
                </Animatable.View>
            </SafeAreaView>
        );
    }

    // --- VIEW 3: MARKING LIST (P/A Toggles) ---
    if (viewState === 'marking') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.listHeader}>
                    <TouchableOpacity onPress={() => setViewState('selection')}>
                        <Icon name="arrow-left" size={24} color={TEXT_COLOR_DARK} />
                    </TouchableOpacity>
                    <Text style={styles.listHeaderTitle}>
                        {selectedClass} List ({students.length})
                    </Text>
                    <View style={{width: 24}} /> 
                </View>

                <FlatList
                    data={students}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    renderItem={({ item }) => {
                        const isPresent = item.status === 'Present';
                        return (
                            <View style={styles.attendanceRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rowName}>{item.full_name}</Text>
                                    <Text style={styles.rowSubText}>{item.roll_no ? `Roll: ${item.roll_no}` : 'No Roll No'}</Text>
                                </View>

                                <View style={styles.actionButtonsContainer}>
                                    <TouchableOpacity 
                                        style={[styles.statusCircle, isPresent ? styles.circleGreenFilled : styles.circleGreenOutline]}
                                        onPress={() => toggleStatus(item.id, 'Present')}
                                    >
                                        <Text style={[styles.statusText, isPresent ? { color: WHITE } : { color: GREEN }]}>P</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        style={[styles.statusCircle, !isPresent ? styles.circleRedFilled : styles.circleRedOutline]}
                                        onPress={() => toggleStatus(item.id, 'Absent')}
                                    >
                                        <Text style={[styles.statusText, !isPresent ? { color: WHITE } : { color: RED }]}>A</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    }}
                />

                <View style={styles.footerContainer}>
                    <TouchableOpacity 
                        style={styles.submitFooterButton}
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color={WHITE} />
                        ) : (
                            <Text style={styles.submitFooterText}>SUBMIT ATTENDANCE</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return null;
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: WHITE },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: WHITE },
    
    // Header
    header: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: BORDER_COLOR },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: TEXT_COLOR_DARK, marginLeft: 20 },
    backButton: { padding: 5, position: 'absolute', left: 15, zIndex: 10 },

    // Selection View Styles
    selectionContent: { padding: 20, marginTop: 20 },
    label: { fontSize: 16, color: TEXT_COLOR_MEDIUM, marginBottom: 8, fontWeight: '600' },
    pickerWrapper: { borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 8, marginBottom: 20, backgroundColor: '#F9F9F9' },
    pickerItem: { fontSize: 16, color: TEXT_COLOR_DARK },
    datePickerBtn: { flexDirection: 'row', alignItems: 'center', padding: 15, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 8, marginBottom: 30, backgroundColor: '#F9F9F9' },
    dateText: { fontSize: 16, color: TEXT_COLOR_DARK },
    proceedBtn: { backgroundColor: PRIMARY_COLOR, padding: 15, borderRadius: 8, alignItems: 'center', elevation: 2 },
    proceedBtnText: { color: WHITE, fontSize: 16, fontWeight: 'bold' },

    // Success View Styles
    successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: GREEN, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    successTitle: { fontSize: 22, fontWeight: 'bold', color: TEXT_COLOR_DARK, marginBottom: 10 },
    successSubtitle: { fontSize: 14, color: TEXT_COLOR_MEDIUM, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20, marginBottom: 30 },
    editButton: { backgroundColor: PRIMARY_COLOR, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 },
    editButtonText: { color: WHITE, fontSize: 16, fontWeight: 'bold' },

    // List View Styles
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#F5F5F5', borderBottomWidth: 1, borderColor: BORDER_COLOR },
    listHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: TEXT_COLOR_DARK },
    
    attendanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
    rowName: { fontSize: 16, fontWeight: 'bold', color: TEXT_COLOR_DARK, textTransform: 'uppercase' },
    rowSubText: { fontSize: 12, color: '#78909C', marginTop: 4 },
    
    actionButtonsContainer: { flexDirection: 'row', alignItems: 'center' },
    statusCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
    
    // P (Present) Styling
    circleGreenFilled: { backgroundColor: GREEN, borderWidth: 0 },
    circleGreenOutline: { backgroundColor: WHITE, borderWidth: 1.5, borderColor: GREEN },
    
    // A (Absent) Styling
    circleRedFilled: { backgroundColor: RED, borderWidth: 0 },
    circleRedOutline: { backgroundColor: WHITE, borderWidth: 1.5, borderColor: RED },
    
    statusText: { fontSize: 16, fontWeight: 'bold' },

    // Footer
    footerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: PRIMARY_COLOR },
    submitFooterButton: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
    submitFooterText: { color: WHITE, fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
});

export default MarkStudentAttendance;