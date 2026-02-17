import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  Dimensions, TouchableOpacity, Modal, ActivityIndicator, Alert,
  StatusBar, useColorScheme
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

// --- THEME CONFIGURATION ---
const LightColors = {
  primary: '#008080',
  background: '#F5F7FA',
  cardBg: '#FFFFFF',
  textMain: '#263238',
  textSub: '#546E7A',
  border: '#CFD8DC',
  inputBg: '#FAFAFA',
  headerIconBg: '#E0F2F1',
  success: '#27AE60',
  danger: '#E74C3C',
  modalOverlay: 'rgba(0,0,0,0.6)',
  tableBorder: '#EEE'
};

const DarkColors = {
  primary: '#008080',
  background: '#121212',
  cardBg: '#1E1E1E',
  textMain: '#E0E0E0',
  textSub: '#B0B0B0',
  border: '#333333',
  inputBg: '#2C2C2C',
  headerIconBg: '#333333',
  success: '#27AE60',
  danger: '#EF5350',
  modalOverlay: 'rgba(255,255,255,0.1)',
  tableBorder: '#333'
};

// --- Constants ---
const CLASS_GROUPS = ['Class 10', 'Class 9', 'Class 8', 'Class 7', 'Class 6', 'Class 5', 'Class 4', 'Class 3', 'Class 2', 'Class 1',  'UKG', 'LKG'];
const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIOD_DEFINITIONS: PeriodDefinition[] = [
  { period: 1, time: '09:00-09:45' }, { period: 2, time: '09:45-10:30' },
  { period: 3, time: '10:30-10:45', isBreak: true },
  { period: 4, time: '10:45-11:30' }, { period: 5, time: '11:30-12:15' },
  { period: 6, time: '12:15-01:00' },
  { period: 7, time: '01:00-01:45', isBreak: true },
  { period: 8, time: '01:45-02:30' }, { period: 9, time: '02:30-03:15' },
  { period: 10, time: '03:15-04:00' },
];

// Responsive Dimensions
const { width } = Dimensions.get('window');
const TABLE_HORIZONTAL_MARGIN = 10;
const tableContentWidth = width - TABLE_HORIZONTAL_MARGIN * 2;
const timeColumnWidth = Math.floor(tableContentWidth * 0.22);
const dayColumnWidth = Math.floor((tableContentWidth * 0.78) / 6);

// Helper to get headers based on theme
const getTableHeaders = (isDark: boolean) => [
  { name: 'TIME', color: isDark ? '#263238' : '#EBEBEB', textColor: isDark ? '#B0BEC5' : '#343A40', width: timeColumnWidth },
  { name: 'MON', color: isDark ? '#1B5E20' : '#E0F7FA', textColor: isDark ? '#E0E0E0' : '#455A64', width: dayColumnWidth },
  { name: 'TUE', color: isDark ? '#F57F17' : '#FFFDE7', textColor: isDark ? '#E0E0E0' : '#455A64', width: dayColumnWidth },
  { name: 'WED', color: isDark ? '#880E4F' : '#FCE4EC', textColor: isDark ? '#E0E0E0' : '#455A64', width: dayColumnWidth },
  { name: 'THU', color: isDark ? '#311B92' : '#EDE7F6', textColor: isDark ? '#E0E0E0' : '#455A64', width: dayColumnWidth },
  { name: 'FRI', color: isDark ? '#0D47A1' : '#E8EAF6', textColor: isDark ? '#E0E0E0' : '#455A64', width: dayColumnWidth },
  { name: 'SAT', color: isDark ? '#33691E' : '#F1F8E9', textColor: isDark ? '#E0E0E0' : '#455A64', width: dayColumnWidth },
];

// Subject colors
const subjectColorPalette = ['#B39DDB', '#80DEEA', '#FFAB91', '#A5D6A7', '#FFE082', '#F48FB1', '#C5CAE9', '#DCE775', '#FFCC80', '#B0BEC5'];
const subjectColorMap = new Map<string, string>();
let colorIndex = 0;
const getSubjectColor = (subject?: string): string => {
  if (!subject) return 'transparent'; // Transparent allows background color of cell to show
  if (subjectColorMap.has(subject)) { return subjectColorMap.get(subject)!; }
  const color = subjectColorPalette[colorIndex % subjectColorPalette.length];
  subjectColorMap.set(subject, color);
  colorIndex++;
  return color;
};

// --- Reusable Component for Admin Slot Editing Modal ---
const EditSlotModal = ({ isVisible, onClose, onSave, slotInfo, teachers, currentData, selectedClass, colors }: any) => {
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | undefined>(currentData?.teacher_id);
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>(currentData?.subject_name);

  useEffect(() => { setSelectedTeacherId(currentData?.teacher_id); setSelectedSubject(currentData?.subject_name); }, [currentData, isVisible]);

  const availableSubjects = useMemo(() => { if (!selectedTeacherId) return []; const teacher = teachers.find((t: any) => t.id === selectedTeacherId); return teacher?.subjects_taught || []; }, [selectedTeacherId, teachers]);
  const className = slotInfo.class_group || selectedClass;

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
        <Animatable.View animation="zoomIn" duration={400} style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
          <Text style={[styles.modalTitle, { color: colors.textMain }]}>Edit Slot</Text>
          <Text style={[styles.modalSubtitle, { color: colors.textSub }]}>{className} - {slotInfo.day} - Period {slotInfo.period}</Text>

          <Text style={[styles.inputLabel, { color: colors.textMain }]}>Teacher</Text>
          <View style={[styles.modalPickerStyle, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Picker selectedValue={selectedTeacherId?.toString() || 'none'}
              onValueChange={(itemValue: string) => { const teacherId = itemValue === 'none' ? undefined : parseInt(itemValue); setSelectedTeacherId(teacherId); setSelectedSubject(undefined); }}
              style={[styles.picker, { color: colors.textMain }]}
              dropdownIconColor={colors.textMain}>
              <Picker.Item label="-- Select Teacher --" value="none" color={colors.textMain} />
              {teachers.map((t: any) => (<Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} color={colors.textMain} />))}
            </Picker>
          </View>

          <Text style={[styles.inputLabel, { color: colors.textMain }]}>Subject</Text>
          <View style={[styles.modalPickerStyle, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Picker selectedValue={selectedSubject || 'none'}
              onValueChange={(itemValue: string) => setSelectedSubject(itemValue === 'none' ? undefined : itemValue)}
              style={[styles.picker, { color: colors.textMain }]}
              enabled={!!selectedTeacherId && availableSubjects.length > 0}
              dropdownIconColor={colors.textMain}>
              <Picker.Item label="-- Select Subject --" value="none" color={colors.textMain} />
              {availableSubjects.map((s: any) => (<Picker.Item key={s} label={s} value={s} color={colors.textMain} />))}
            </Picker>
          </View>

          <View style={styles.modalButtonContainer}>
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.danger }]} onPress={() => onSave({})}><Text style={styles.modalButtonText}>Clear Slot</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.success }]} onPress={() => onSave({ teacher_id: selectedTeacherId, subject_name: selectedSubject })}><Text style={styles.modalButtonText}>Save</Text></TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}><Text style={[styles.closeButtonText, { color: colors.primary }]}>Cancel</Text></TouchableOpacity>
        </Animatable.View>
      </View>
    </Modal>
  );
};

const TimetableScreen = ({ teacherId: propTeacherId, isEmbedded = false }: any) => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigation = useNavigation<any>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const COLORS = isDark ? DarkColors : LightColors;
  const tableHeaders = getTableHeaders(isDark);

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

  if (!isEmbedded && isAuthLoading) { return <View style={[styles.loaderContainer, { backgroundColor: COLORS.background }]}><ActivityIndicator size="large" color={COLORS.primary} /></View>; }

  const showClassPicker = activeTab === 'academic' && user?.role !== 'student';
  const showTeacherPicker = activeTab === 'personal' && user?.role === 'admin';
  const displayableTeacherList = teachers.filter(t => t.id !== undefined);

  // --- RENDER TIMETABLE GRID ---
  const TimetableGrid = (
    isTimetableLoading ? (<ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />) : (
      <Animatable.View animation="fadeInUp" duration={700} delay={isEmbedded ? 0 : 300} style={[styles.tableOuterContainer, isEmbedded && styles.embeddedTable, { backgroundColor: COLORS.cardBg, borderColor: COLORS.tableBorder }]}>
        <View style={[styles.tableHeaderRow, { borderBottomColor: COLORS.border }]}>
          {tableHeaders.map(h => (
            <View key={h.name} style={[styles.tableHeaderCell, { backgroundColor: h.color, width: h.width, borderRightColor: COLORS.border }]}>
              <Text style={[styles.tableHeaderText, { color: h.textColor }]}>{h.name}</Text>
            </View>
          ))}
        </View>
        {scheduleData.map((row, rowIndex) => (
          <Animatable.View key={rowIndex} animation="fadeIn" duration={500} delay={rowIndex * 50}>
            <View style={[styles.tableRow, { borderBottomColor: COLORS.border }]}>
              <View style={[styles.tableCell, styles.timeCell, { width: tableHeaders[0].width, backgroundColor: isDark ? COLORS.inputBg : '#F8F9FA', borderRightColor: COLORS.border }]}>
                <Text style={[styles.timeText, { color: COLORS.textMain }]}>{row.time}</Text>
              </View>
              {row.periods.map((period, periodIndex) => {
                const day = DAYS[periodIndex];
                const periodNumber = PERIOD_DEFINITIONS[rowIndex].period;
                const isMyPeriod = !isEmbedded && isSlotAssignedToMe(period);
                const periodBgColor = getSubjectColor(period.subject);
                const isClickable = !isEmbedded && (user?.role === 'admin' || isMyPeriod);
                const onPressHandler = () => { if (user?.role === 'admin') { handleSlotPress(day, periodNumber, period); } else if (isMyPeriod) { handleAttendancePress(period, periodNumber, day); } };

                let slotContent;
                if (period.isBreak) { slotContent = <Text style={[styles.breakTextSubject, { color: COLORS.textSub }]} numberOfLines={2}>{period.subject}</Text>; }
                else if (!isEmbedded && activeTab === 'academic') { slotContent = (<><Text style={styles.subjectText} numberOfLines={2}>{period.subject || (user?.role === 'admin' ? 'Free' : '')}</Text>{period.teacher && <Text style={styles.teacherContextText} numberOfLines={1}>{period.teacher}</Text>}</>); }
                else { slotContent = (<><Text style={styles.subjectText} numberOfLines={2}>{period.subject || 'Free'}</Text>{period.class_group && <Text style={[styles.classGroupText, { color: COLORS.primary }]} numberOfLines={1}>{period.class_group}</Text>}</>); }

                return (
                  <TouchableOpacity key={periodIndex} style={[styles.tableCell, period.isBreak ? { backgroundColor: isDark ? '#424242' : '#EAECEE' } : { backgroundColor: periodBgColor }, isMyPeriod && styles.myPeriodCell, { width: tableHeaders[periodIndex + 1].width, borderRightColor: COLORS.border },]} disabled={!isClickable} onPress={isClickable ? onPressHandler : undefined}>{slotContent}</TouchableOpacity>
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
      <ScrollView contentContainerStyle={styles.pageContainer}>

        {/* --- HEADER CARD --- */}
        <Animatable.View animation="fadeInDown" duration={600}>
          <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                <Icon name="calendar-clock" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>{headerTitle}</Text>
                <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Logged in as: {user?.full_name}</Text>
              </View>
            </View>
          </View>
        </Animatable.View>

        {/* Tabs */}
        {(user?.role === 'admin' || user?.role === 'teacher') && (
          <Animatable.View animation="fadeIn" duration={500} style={[styles.tabContainer, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'academic' && { backgroundColor: isDark ? '#1A3333' : '#F0FDF4', borderBottomColor: COLORS.primary }]} onPress={() => setActiveTab('academic')}>
              <Text style={[styles.tabButtonText, { color: COLORS.textSub }, activeTab === 'academic' && { color: COLORS.primary }]}>Academic Timetable</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'personal' && { backgroundColor: isDark ? '#1A3333' : '#F0FDF4', borderBottomColor: COLORS.primary }]} onPress={() => setActiveTab('personal')}>
              <Text style={[styles.tabButtonText, { color: COLORS.textSub }, activeTab === 'personal' && { color: COLORS.primary }]}>{user.role === 'admin' ? 'Teachers Timetable' : 'My Timetable'}</Text>
            </TouchableOpacity>
          </Animatable.View>
        )}

        {/* Filters/Pickers */}
        {(showClassPicker || showTeacherPicker || user?.role === 'student') && (
          <Animatable.View animation="fadeIn" duration={500} delay={200} style={styles.filterContainer}>
            {(showClassPicker || user?.role === 'student') && (
              <View style={[styles.pickerWrapper, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                <Picker selectedValue={selectedClass} onValueChange={(itemValue: string) => setSelectedClass(itemValue)} style={[styles.picker, { color: COLORS.textMain }]} itemStyle={[styles.pickerItem, { color: COLORS.textMain }]} dropdownIconColor={COLORS.textMain} enabled={user?.role !== 'student'}>
                  {CLASS_GROUPS.map(option => (<Picker.Item key={option} label={option} value={option} color={COLORS.textMain} />))}
                </Picker>
              </View>
            )}
            {showTeacherPicker && (
              <View style={[styles.pickerWrapper, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                <Picker selectedValue={selectedTeacherId?.toString()} onValueChange={(itemValue: string) => setSelectedTeacherId(parseInt(itemValue))} style={[styles.picker, { color: COLORS.textMain }]} itemStyle={[styles.pickerItem, { color: COLORS.textMain }]} dropdownIconColor={COLORS.textMain}>
                  {displayableTeacherList.map(t => (<Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} color={COLORS.textMain} />))}
                </Picker>
              </View>
            )}
          </Animatable.View>
        )}

        {TimetableGrid}
      </ScrollView>

      {/* Edit Modal */}
      {selectedSlot && (<EditSlotModal isVisible={isModalVisible} onClose={() => setIsModalVisible(false)} onSave={handleSaveChanges} slotInfo={selectedSlot} teachers={teachers} selectedClass={selectedClass} currentData={apiTimetableData.find(d => d.day_of_week === selectedSlot.day && d.period_number === selectedSlot.period && d.class_group === (selectedSlot.class_group || selectedSlot.class_group))} colors={COLORS} />)}
    </SafeAreaView>
  );
};


// --- Styles ---
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageContainer: { paddingBottom: 30 },

  // --- HEADER CARD STYLES ---
  headerCard: {
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
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
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

  // Tabs
  tabContainer: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 15, borderRadius: 8, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, borderWidth: 1 },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabButtonText: { fontSize: 14, fontWeight: '600' },

  // Filters
  filterContainer: { marginHorizontal: 15, marginBottom: 15 },
  pickerWrapper: { borderWidth: 1, borderRadius: 8, marginVertical: 5, overflow: 'hidden', height: 45, justifyContent: 'center' },
  picker: { width: '100%' },
  pickerItem: { fontSize: 16, textAlign: 'left' },

  // Table
  tableOuterContainer: { marginHorizontal: TABLE_HORIZONTAL_MARGIN, borderRadius: 12, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1 },
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tableHeaderCell: { paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1 },
  tableHeaderText: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tableCell: { paddingVertical: 12, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, minHeight: 70 },
  timeCell: { alignItems: 'center', borderRightWidth: 1 },
  timeText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  myPeriodCell: { borderWidth: 2, borderColor: '#008080', elevation: 2 },
  subjectText: { fontSize: 10, fontWeight: '800', color: '#37474F', marginBottom: 3, textAlign: 'center' },
  teacherContextText: { fontSize: 9, color: '#0288D1', textAlign: 'center', marginTop: 2, fontWeight: '500' },
  classGroupText: { fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  breakTextSubject: { fontSize: 12, fontWeight: '600', textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', borderRadius: 15, padding: 20, elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
  modalPickerStyle: { borderWidth: 1, borderRadius: 8, marginBottom: 10 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  modalSubtitle: { fontSize: 16, textAlign: 'center', marginBottom: 20 },
  inputLabel: { fontSize: 16, marginTop: 15, marginBottom: 5, fontWeight: '500' },
  modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 },
  modalButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', elevation: 2, marginHorizontal: 5 },
  modalButtonText: { color: 'white', fontWeight: 'bold' },
  closeButton: { marginTop: 15, padding: 10 },
  closeButtonText: { textAlign: 'center', fontSize: 16, fontWeight: '600' },

  embeddedTable: { marginHorizontal: 0, elevation: 0, shadowOpacity: 0, borderWidth: 0, borderRadius: 0, shadowRadius: 0 },
});

export default TimetableScreen;