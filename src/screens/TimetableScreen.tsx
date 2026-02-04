import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  Dimensions, TouchableOpacity, Modal, ActivityIndicator, Alert,
  StatusBar
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Animatable from 'react-native-animatable';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// --- Type Definitions ---
type RootStackParamList = { Attendance: { class_group: string; subject_name: string; period_number: number; date: string; }; };
interface TimetableSlotFromAPI { id?: number; class_group: string; day_of_week: Day; period_number: number; subject_name: string; teacher_id: number; teacher_name: string; }
interface Teacher { id: number; full_name: string; subjects_taught: string[]; }
interface PeriodDefinition { period: number; time: string; isBreak?: boolean; }
interface RenderablePeriod { subject?: string; teacher?: string; teacher_id?: number; isBreak?: boolean; class_group?: string; }
type Day = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

// --- Constants ---
const CLASS_GROUPS = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIOD_DEFINITIONS: PeriodDefinition[] = [ { period: 1, time: '09:00-09:45' }, { period: 2, time: '09:45-10:30' }, { period: 3, time: '10:30-10:45', isBreak: true }, { period: 4, time: '10:45-11:30' }, { period: 5, time: '11:30-12:15' }, { period: 6, time: '12:15-01:00', }, { period: 7, time: '01:00-01:45', isBreak: true }, { period: 8, time: '01:45-02:30' }, { period: 9, time: '02:30-03:15' }, { period: 10, time: '03:15-04:00' }, ];

// Responsive Dimensions
const { width } = Dimensions.get('window');
const TABLE_HORIZONTAL_MARGIN = 10;
const tableContentWidth = width - TABLE_HORIZONTAL_MARGIN * 2;
// Dynamic column sizing
const timeColumnWidth = Math.floor(tableContentWidth * 0.20);
const dayColumnWidth = Math.floor((tableContentWidth * 0.80) / 6);

// Header definitions
const headerTextColor = '#455A64';
const tableHeaders = [ { name: 'TIME', color: '#EBEBEB', textColor: '#343A40', width: timeColumnWidth }, { name: 'MON', color: '#E0F7FA', textColor: headerTextColor, width: dayColumnWidth }, { name: 'TUE', color: '#FFFDE7', textColor: headerTextColor, width: dayColumnWidth }, { name: 'WED', color: '#FCE4EC', textColor: headerTextColor, width: dayColumnWidth }, { name: 'THU', color: '#EDE7F6', textColor: headerTextColor, width: dayColumnWidth }, { name: 'FRI', color: '#E8EAF6', textColor: headerTextColor, width: dayColumnWidth }, { name: 'SAT', color: '#F1F8E9', textColor: headerTextColor, width: dayColumnWidth }, ];

// Subject colors
const subjectColorPalette = [ '#B39DDB', '#80DEEA', '#FFAB91', '#A5D6A7', '#FFE082', '#F48FB1', '#C5CAE9', '#DCE775', '#FFCC80', '#B0BEC5', ];
const subjectColorMap = new Map<string, string>();
let colorIndex = 0;
const getSubjectColor = (subject?: string): string => { if (!subject) return '#FFFFFF'; if (subjectColorMap.has(subject)) { return subjectColorMap.get(subject)!; } const color = subjectColorPalette[colorIndex % subjectColorPalette.length]; subjectColorMap.set(subject, color); colorIndex++; return color; };

// --- Reusable Component for Admin Slot Editing Modal ---
const EditSlotModal = ({ isVisible, onClose, onSave, slotInfo, teachers, currentData, selectedClass }: { isVisible: boolean; onClose: () => void; onSave: (slot: { subject_name?: string; teacher_id?: number }) => void; slotInfo: { day: Day; period: number; class_group?: string }; teachers: Teacher[]; currentData?: TimetableSlotFromAPI; selectedClass: string; }) => {
    const [selectedTeacherId, setSelectedTeacherId] = useState<number | undefined>(currentData?.teacher_id);
    const [selectedSubject, setSelectedSubject] = useState<string | undefined>(currentData?.subject_name);
    
    useEffect(() => { setSelectedTeacherId(currentData?.teacher_id); setSelectedSubject(currentData?.subject_name); }, [currentData, isVisible]);
    
    const availableSubjects = useMemo(() => { if (!selectedTeacherId) return []; const teacher = teachers.find(t => t.id === selectedTeacherId); return teacher?.subjects_taught || []; }, [selectedTeacherId, teachers]);
    const className = slotInfo.class_group || selectedClass;
    
    return (
        <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <Animatable.View animation="zoomIn" duration={400} style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Edit Slot</Text>
                    <Text style={styles.modalSubtitle}>{className} - {slotInfo.day} - Period {slotInfo.period}</Text>
                    
                    <Text style={styles.inputLabel}>Teacher</Text>
                    <View style={styles.modalPickerStyle}>
                        <Picker selectedValue={selectedTeacherId?.toString() || 'none'} 
                            onValueChange={(itemValue: string) => { const teacherId = itemValue === 'none' ? undefined : parseInt(itemValue); setSelectedTeacherId(teacherId); setSelectedSubject(undefined); }} 
                            style={styles.picker} 
                            itemStyle={styles.pickerItem} 
                            dropdownIconColor="#333">
                            <Picker.Item label="-- Select Teacher --" value="none" color="#333" />
                            {teachers.map(t => (<Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} color="#333" />))}
                        </Picker>
                    </View>
                    
                    <Text style={styles.inputLabel}>Subject</Text>
                    <View style={styles.modalPickerStyle}>
                        <Picker selectedValue={selectedSubject || 'none'} 
                            onValueChange={(itemValue: string) => setSelectedSubject(itemValue === 'none' ? undefined : itemValue)} 
                            style={styles.picker} 
                            itemStyle={styles.pickerItem} 
                            enabled={!!selectedTeacherId && availableSubjects.length > 0} 
                            dropdownIconColor="#333">
                            <Picker.Item label="-- Select Subject --" value="none" color="#333"/>
                            {availableSubjects.map(s => (<Picker.Item key={s} label={s} value={s} color="#333" />))}
                        </Picker>
                    </View>
                    
                    <View style={styles.modalButtonContainer}>
                        <TouchableOpacity style={[styles.modalButton, styles.clearButton]} onPress={() => onSave({})}><Text style={styles.modalButtonText}>Clear Slot</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={() => onSave({ teacher_id: selectedTeacherId, subject_name: selectedSubject })}><Text style={styles.modalButtonText}>Save</Text></TouchableOpacity>
                    </View>
                    
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}><Text style={styles.closeButtonText}>Cancel</Text></TouchableOpacity>
                </Animatable.View>
            </View>
        </Modal>
    );
};

const TimetableScreen = ({ teacherId: propTeacherId, isEmbedded = false }) => {
    const { user, isLoading: isAuthLoading } = useAuth();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const [activeTab, setActiveTab] = useState<'academic' | 'personal'>('academic');
    const [isTimetableLoading, setIsTimetableLoading] = useState(true);
    const [apiTimetableData, setApiTimetableData] = useState<TimetableSlotFromAPI[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedTeacherId, setSelectedTeacherId] = useState<number | undefined>(undefined);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ day: Day; period: number; class_group?: string } | null>(null);

    const fetchTeachers = async () => { try { const response = await apiClient.get('/teachers'); setTeachers(response.data); } catch (error: any) { Alert.alert('Error', error.response?.data?.message || 'Failed to fetch teachers list.'); } };

    useEffect(() => {
        if (isEmbedded || !user || isAuthLoading) return;
        const initialClass = user.class_group && CLASS_GROUPS.includes(user.class_group) ? user.class_group : CLASS_GROUPS[0];
        if (user.role === 'admin') { fetchTeachers(); setSelectedClass(initialClass); }
        else if (user.role === 'teacher') { setSelectedClass(initialClass); setSelectedTeacherId(user.id); setActiveTab('personal'); }
        else if (user.role === 'student' && user.class_group) { setSelectedClass(user.class_group); setActiveTab('academic'); }
    }, [user, isAuthLoading, isEmbedded]);

    useEffect(() => {
        if (isEmbedded) return;
        if (user?.role === 'admin' && teachers.length > 0 && selectedTeacherId === undefined) { setSelectedTeacherId(teachers[0].id); }
    }, [user, teachers, selectedTeacherId, isEmbedded]);

    const fetchTimetable = useCallback(async () => {
        setIsTimetableLoading(true);
        setApiTimetableData([]);

        if (isEmbedded) {
            if (!propTeacherId) { setIsTimetableLoading(false); return; }
            try {
                const response = await apiClient.get(`/timetable/teacher/${propTeacherId}`);
                setApiTimetableData(response.data);
            } catch (error: any) { setApiTimetableData([]); } 
            finally { setIsTimetableLoading(false); }
            return;
        }

        if (isAuthLoading || !user) return;

        try {
            let response;
            if (activeTab === 'academic' && selectedClass) { response = await apiClient.get(`/timetable/${selectedClass}`); }
            else if (activeTab === 'personal') {
                const idToFetch = user.role === 'admin' ? selectedTeacherId : user.id;
                if (!idToFetch && user.role !== 'admin') { setIsTimetableLoading(false); return; }
                if (user.role === 'admin' && !idToFetch) { setApiTimetableData([]); setIsTimetableLoading(false); return; }
                response = await apiClient.get(`/timetable/teacher/${idToFetch}`);
            } else { setIsTimetableLoading(false); return; }
            setApiTimetableData(response.data);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to fetch timetable data.');
            setApiTimetableData([]);
        } finally {
            setIsTimetableLoading(false);
        }
    }, [user, isAuthLoading, activeTab, selectedClass, selectedTeacherId, isEmbedded, propTeacherId]);

    useEffect(() => { fetchTimetable(); }, [fetchTimetable]);

    const { scheduleData, headerTitle } = useMemo(() => {
        const timetableMap = new Map<string, TimetableSlotFromAPI>();
        if (Array.isArray(apiTimetableData)) { apiTimetableData.forEach(slot => { const key = `${slot.day_of_week}-${slot.period_number}`; timetableMap.set(key, slot); }); }
        const data = PERIOD_DEFINITIONS.map(pDef => {
            const periods: RenderablePeriod[] = DAYS.map(day => {
                if (pDef.isBreak) return { subject: pDef.period === 3 ? 'Break' : 'Lunch', isBreak: true };
                const key = `${day}-${pDef.period}`;
                const slotData = timetableMap.get(key);
                return { subject: slotData?.subject_name, teacher: slotData?.teacher_name, teacher_id: slotData?.teacher_id, class_group: slotData?.class_group };
            });
            return { time: pDef.time, periods };
        });

        let title = 'Schedule';
        if (!isEmbedded) {
            if (activeTab === 'academic') { title = `Academic: ${selectedClass}`; }
            else if (activeTab === 'personal') {
                const teacherName = user?.role === 'admin' ? teachers.find(t => t.id === selectedTeacherId)?.full_name || 'Teachers Timetable' : 'My Timetable';
                title = teacherName;
            }
        }
        return { scheduleData: data, headerTitle: title };
    }, [apiTimetableData, activeTab, selectedClass, selectedTeacherId, teachers, user, isEmbedded]);

    const handleSlotPress = (day: Day, period: number, currentSlotData?: RenderablePeriod) => {
        if (isEmbedded || user?.role !== 'admin') return; 
        let classGroupToModify;
        if (activeTab === 'academic') { classGroupToModify = selectedClass; }
        else {
            if (currentSlotData?.class_group) { classGroupToModify = currentSlotData.class_group; }
            else if (activeTab === 'personal') { Alert.alert('Assignment Rule', 'To assign a new class, please use the "Academic Timetable" tab. To modify an existing slot, click an assigned period on this view.'); return; }
            else { return; }
        }
        const existingSlot = apiTimetableData.find(d => d.day_of_week === day && d.period_number === period && d.class_group === classGroupToModify);
        setSelectedSlot({ day, period, class_group: classGroupToModify });
        setIsModalVisible(true);
    };

    const handleSaveChanges = async (slotToSave: { subject_name?: string; teacher_id?: number }) => {
        if (!selectedSlot) return;
        const classGroupToUse = selectedSlot.class_group || selectedClass;
        if (!classGroupToUse) { Alert.alert('Error', 'Class group context missing.'); return; }
        
        const payload = { 
            class_group: classGroupToUse, 
            day_of_week: selectedSlot.day, 
            period_number: selectedSlot.period, 
            subject_name: slotToSave.subject_name || null, 
            teacher_id: slotToSave.teacher_id || null, 
        };

        try { 
            await apiClient.post('/timetable', payload); 
            Alert.alert('Success', 'Timetable updated!'); 
            setIsModalVisible(false); 
            fetchTimetable(); 
        }
        catch (error: any) { 
            // Handle Conflict (Already Assigned) or other errors
            const errorMessage = error.response?.data?.message || 'An error occurred while updating timetable.';
            Alert.alert('Unable to Assign', errorMessage); 
        }
    };

    const handleAttendancePress = (slotData: RenderablePeriod, periodNumber: number, dayOfColumn: Day) => {
        if (isEmbedded) return; 
        const today = new Date(); const currentDayOfWeek = today.toLocaleString('en-US', { weekday: 'long' }) as Day;
        if (dayOfColumn !== currentDayOfWeek) { Alert.alert('Invalid Day', `Attendance can only be marked for today (${currentDayOfWeek}).`); return; }
        if (periodNumber !== 1) { Alert.alert('Attendance Rule', 'Attendance is only taken for the first period to mark the full day.'); return; }
        if (!user?.id || !slotData.subject) return;
        const classContext = activeTab === 'academic' ? selectedClass : slotData.class_group;
        if (!classContext) { Alert.alert('Error', 'Cannot determine class context for attendance.'); return; }
        navigation.navigate('Attendance', { class_group: classContext, subject_name: slotData.subject, period_number: periodNumber, date: today.toISOString().split('T')[0] });
    };

    const isSlotAssignedToMe = (period: RenderablePeriod) => {
        if (activeTab === 'personal' && period.subject) { const targetId = user?.role === 'admin' ? selectedTeacherId : user?.id; return targetId && String(period.teacher_id) === String(targetId); }
        return activeTab === 'academic' && period.teacher_id && String(period.teacher_id) === String(user?.id);
    };

    if (!isEmbedded && isAuthLoading) { return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#008080" /></View>; }

    const showClassPicker = activeTab === 'academic' && user?.role !== 'student';
    const showTeacherPicker = activeTab === 'personal' && user?.role === 'admin';
    const displayableTeacherList = teachers.filter(t => t.id !== undefined);

    // --- RENDER TIMETABLE GRID ---
    const TimetableGrid = (
        isTimetableLoading ? (<ActivityIndicator size="large" color="#008080" style={{ marginTop: 50 }} />) : (
            <Animatable.View animation="fadeInUp" duration={700} delay={isEmbedded ? 0 : 300} style={[styles.tableOuterContainer, isEmbedded && styles.embeddedTable]}>
                <View style={styles.tableHeaderRow}>{tableHeaders.map(h => (<View key={h.name} style={[styles.tableHeaderCell, { backgroundColor: h.color, width: h.width }]}><Text style={[styles.tableHeaderText, { color: h.textColor }]}>{h.name}</Text></View>))}</View>
                {scheduleData.map((row, rowIndex) => (
                    <Animatable.View key={rowIndex} animation="fadeIn" duration={500} delay={rowIndex * 50}>
                        <View style={styles.tableRow}>
                            <View style={[styles.tableCell, styles.timeCell, { width: tableHeaders[0].width }]}><Text style={styles.timeText}>{row.time}</Text></View>
                            {row.periods.map((period, periodIndex) => {
                                const day = DAYS[periodIndex];
                                const periodNumber = PERIOD_DEFINITIONS[rowIndex].period;
                                const isMyPeriod = !isEmbedded && isSlotAssignedToMe(period);
                                const periodBgColor = getSubjectColor(period.subject);
                                const isClickable = !isEmbedded && (user?.role === 'admin' || isMyPeriod);
                                const onPressHandler = () => { if (user?.role === 'admin') { handleSlotPress(day, periodNumber, period); } else if (isMyPeriod) { handleAttendancePress(period, periodNumber, day); } };
                                
                                let slotContent;
                                if (period.isBreak) { slotContent = <Text style={styles.breakTextSubject} numberOfLines={2}>{period.subject}</Text>; }
                                else if (!isEmbedded && activeTab === 'academic') { slotContent = (<><Text style={styles.subjectText} numberOfLines={2}>{period.subject || (user?.role === 'admin' ? 'Free' : '')}</Text>{period.teacher && <Text style={styles.teacherContextText} numberOfLines={1}>{period.teacher}</Text>}</>); }
                                else { slotContent = (<><Text style={styles.subjectText} numberOfLines={2}>{period.subject || 'Free'}</Text>{period.class_group && <Text style={styles.classGroupText} numberOfLines={1}>{period.class_group}</Text>}</>); }
                                
                                return (
                                    <TouchableOpacity key={periodIndex} style={[styles.tableCell, period.isBreak ? styles.breakCell : { backgroundColor: periodBgColor }, isMyPeriod && styles.myPeriodCell, { width: tableHeaders[periodIndex + 1].width },]} disabled={!isClickable} onPress={isClickable ? onPressHandler : undefined}>{slotContent}</TouchableOpacity>
                                );
                            })}
                        </View>
                    </Animatable.View>
                ))}
            </Animatable.View>
        )
    );

    if (isEmbedded) { return <View>{TimetableGrid}</View>; }

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor="#F2F5F8" />
            <ScrollView contentContainerStyle={styles.pageContainer}>
                
                {/* --- HEADER CARD --- */}
                <Animatable.View animation="fadeInDown" duration={600}>
                    <View style={styles.headerCard}>
                        <View style={styles.headerLeft}>
                            <View style={styles.headerIconContainer}>
                                <Icon name="calendar-clock" size={24} color="#008080" />
                            </View>
                            <View style={styles.headerTextContainer}>
                                <Text style={styles.headerTitle}>{headerTitle}</Text>
                                <Text style={styles.headerSubtitle}>Logged in as: {user?.full_name}</Text>
                            </View>
                        </View>
                    </View>
                </Animatable.View>

                {/* Tabs */}
                {(user?.role === 'admin' || user?.role === 'teacher') && (
                    <Animatable.View animation="fadeIn" duration={500} style={styles.tabContainer}>
                        <TouchableOpacity style={[styles.tabButton, activeTab === 'academic' && styles.tabButtonActive]} onPress={() => setActiveTab('academic')}>
                            <Text style={[styles.tabButtonText, activeTab === 'academic' && styles.tabButtonTextActive]}>Academic Timetable</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tabButton, activeTab === 'personal' && styles.tabButtonActive]} onPress={() => setActiveTab('personal')}>
                            <Text style={[styles.tabButtonText, activeTab === 'personal' && styles.tabButtonTextActive]}>{user.role === 'admin' ? 'Teachers Timetable' : 'My Timetable'}</Text>
                        </TouchableOpacity>
                    </Animatable.View>
                )}

                {/* Filters/Pickers */}
                {(showClassPicker || showTeacherPicker || user?.role === 'student') && (
                    <Animatable.View animation="fadeIn" duration={500} delay={200} style={styles.filterContainer}>
                        {(showClassPicker || user?.role === 'student') && (
                            <View style={styles.pickerWrapper}>
                                <Picker selectedValue={selectedClass} onValueChange={(itemValue: string) => setSelectedClass(itemValue)} style={styles.picker} itemStyle={styles.pickerItem} dropdownIconColor="#333" enabled={user?.role !== 'student'}>
                                    {CLASS_GROUPS.map(option => (<Picker.Item key={option} label={option} value={option} color="#333" />))}
                                </Picker>
                            </View>
                        )}
                        {showTeacherPicker && (
                            <View style={styles.pickerWrapper}>
                                <Picker selectedValue={selectedTeacherId?.toString()} onValueChange={(itemValue: string) => setSelectedTeacherId(parseInt(itemValue))} style={styles.picker} itemStyle={styles.pickerItem} dropdownIconColor="#333">
                                    {displayableTeacherList.map(t => (<Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} color="#333" />))}
                                </Picker>
                            </View>
                        )}
                    </Animatable.View>
                )}

                {TimetableGrid}
            </ScrollView>
            
            {/* Edit Modal */}
            {selectedSlot && (<EditSlotModal isVisible={isModalVisible} onClose={() => setIsModalVisible(false)} onSave={handleSaveChanges} slotInfo={selectedSlot} teachers={teachers} selectedClass={selectedClass} currentData={apiTimetableData.find(d => d.day_of_week === selectedSlot.day && d.period_number === selectedSlot.period && d.class_group === (selectedSlot.class_group || selectedSlot.class_group))} />)}
        </SafeAreaView>
    );
};


// --- Styles ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F2F5F8' }, // Matched Background
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F5F8' },
    pageContainer: { paddingBottom: 30 },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 15,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 3,
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        backgroundColor: '#E0F2F1', // Teal bg
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333333' },
    headerSubtitle: { fontSize: 13, color: '#666666' },

    // Tabs
    tabContainer: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 15, backgroundColor: '#FFFFFF', borderRadius: 8, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, borderWidth: 1, borderColor: '#EFEFEF', },
    tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', },
    tabButtonActive: { backgroundColor: '#F0FDF4', borderBottomWidth: 3, borderBottomColor: '#008080', },
    tabButtonText: { fontSize: 14, fontWeight: '600', color: '#777', },
    tabButtonTextActive: { color: '#008080', },

    // Filters
    filterContainer: { marginHorizontal: 15, marginBottom: 15 },
    pickerWrapper: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginVertical: 5, backgroundColor: '#FFFFFF', overflow: 'hidden', height: 45, justifyContent: 'center' },
    picker: { width: '100%', color: '#333333', },
    pickerItem: { fontSize: 16, color: '#333333', textAlign: 'left', },

    // Table
    tableOuterContainer: { marginHorizontal: TABLE_HORIZONTAL_MARGIN, backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: '#EEE', },
    tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#CFD8DC' },
    tableHeaderCell: { paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#ECEFF1', },
    tableHeaderText: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F3F4' },
    tableCell: { paddingVertical: 12, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#F1F3F4', minHeight: 70, },
    timeCell: { alignItems: 'center', backgroundColor: '#F8F9FA' },
    timeText: { fontSize: 11, color: '#495057', fontWeight: '600', textAlign: 'center' },
    myPeriodCell: { backgroundColor: '#E0F2F1', borderWidth: 2, borderColor: '#008080', elevation: 2, },
    subjectText: { fontSize: 10, fontWeight: '800', color: '#37474F', marginBottom: 3, textAlign: 'center', },
    teacherContextText: { fontSize: 9, color: '#0288D1', textAlign: 'center', marginTop: 2, fontWeight: '500', },
    classGroupText: { fontSize: 10, color: '#008080', fontWeight: '700', textAlign: 'center', marginTop: 2, },
    breakCell: { alignItems: 'center', backgroundColor: '#EAECEE', },
    breakTextSubject: { fontSize: 12, fontWeight: '600', color: '#546E7A', textAlign: 'center' },
    
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', },
    modalContent: { width: '90%', backgroundColor: 'white', borderRadius: 15, padding: 20, elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, },
    modalPickerStyle: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 10, backgroundColor: '#F9F9F9', },
    modalTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#333333' },
    modalSubtitle: { fontSize: 16, color: '#555555', textAlign: 'center', marginBottom: 20 },
    inputLabel: { fontSize: 16, marginTop: 15, marginBottom: 5, color: '#333333', fontWeight: '500' },
    modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25, },
    modalButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', elevation: 2 },
    saveButton: { backgroundColor: '#27AE60', marginLeft: 10 },
    clearButton: { backgroundColor: '#E74C3C', marginRight: 10 },
    modalButtonText: { color: 'white', fontWeight: 'bold' },
    closeButton: { marginTop: 15, padding: 10 },
    closeButtonText: { textAlign: 'center', color: '#3498DB', fontSize: 16, fontWeight: '600' },
    
    embeddedTable: { marginHorizontal: 0, elevation: 0, shadowOpacity: 0, borderWidth: 0, borderRadius: 0, shadowRadius: 0, },
});

export default TimetableScreen;