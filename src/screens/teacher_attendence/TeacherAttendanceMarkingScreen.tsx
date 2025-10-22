import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, TextInput, Platform, UIManager, LayoutAnimation, SafeAreaView } from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import TeacherReportView from './TeacherReportView';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';

// ... (Interface and Theme Constants remain the same)
interface Teacher {
  id: number;
  full_name: string;
  username: string;
  subjects_taught?: string[]; 
}

interface TeacherMarking extends Teacher {
  status: 'P' | 'A' | 'L'; 
}

const PRIMARY_COLOR = '#008080';
const TEXT_COLOR_DARK = '#37474F';
const TEXT_COLOR_MEDIUM = '#566573';
const BORDER_COLOR = '#E0E0E0';
const GREEN = '#43A047';
const RED = '#E53935';
const WHITE = '#FFFFFF';
const API_BASE_URL = '/teacher-attendance';


const TeacherAttendanceMarkingScreen = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'marking' | 'reporting'>('marking');
  const [teachers, setTeachers] = useState<TeacherMarking[]>([]); 
  const [allTeachersForReport, setAllTeachersForReport] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [attendanceDate, setAttendanceDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [markingState, setMarkingState] = useState<'LOADING' | 'MARKING' | 'SUCCESS_SUMMARY'>('LOADING');

  
  const fetchBaseTeacherData = useCallback(async (dateToCheck: Date) => {
    const dateString = dateToCheck.toISOString().slice(0, 10);
    
    try {
        const response = await apiClient.get<Teacher[]>(`${API_BASE_URL}/teachers`);
        const teachersData = response.data.map(t => {
            const subjects = (t.subjects_taught && Array.isArray(t.subjects_taught)) ? t.subjects_taught : [];
            return { ...t, subjects_taught: subjects } as TeacherMarking;
        });

        // --- CHECK SAVED STATUS (CRITICAL FIX) ---
        // We will query the report API for the FIRST teacher listed for today's date.
        // If we get any history records back, we assume marking has occurred.
        let attendanceExists = false;
        if (teachersData.length > 0) {
            const firstTeacherId = teachersData[0].id;
            try {
                const reportRes = await apiClient.get(`${API_BASE_URL}/report/${firstTeacherId}?period=daily&targetDate=${dateString}`);
                if (reportRes.data.detailedHistory && reportRes.data.detailedHistory.length > 0) {
                    attendanceExists = true;
                }
            } catch (e) {
                // Ignore API error if teacher hasn't been marked before, still treat as new marking.
            }
        }
        
        setTeachers(teachersData);
        setAllTeachersForReport(teachersData);
        
        if (attendanceExists) {
            setMarkingState('SUCCESS_SUMMARY'); // Show Edit button
        } else {
            setMarkingState('MARKING'); // Show P/A list
        }

    } catch (error: any) {
        Alert.alert("Error", error.response?.data?.message || "Failed to load teacher base data.");
        setMarkingState('MARKING'); // Fallback to marking
    } finally {
        setIsLoading(false);
    }
  }, []);
  
  
  // Load data when component mounts or attendanceDate changes
  useEffect(() => {
      setIsLoading(true);
      fetchBaseTeacherData(attendanceDate);
  }, [attendanceDate, fetchBaseTeacherData]); // Reruns when date or component mounts


  const handleStatusChange = (teacherId: number, status: 'P' | 'A' | 'L') => {
    setTeachers(prev =>
      prev.map(t => (t.id === teacherId ? { ...t, status } : t))
    );
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setAttendanceDate(selectedDate);
      // The useEffect hook above will trigger data loading when attendanceDate changes
    }
  };

  const handleSubmitAttendance = async () => {
    if (!user || user.role !== 'admin') {
      return Alert.alert("Error", "Only Admins can submit attendance.");
    }
    
    const dateString = attendanceDate.toISOString().slice(0, 10);
    
    const attendanceData = teachers.map(t => ({
      teacher_id: t.id,
      status: t.status,
    }));

    if (attendanceData.length === 0) {
      return Alert.alert("Error", "No teachers selected.");
    }

    try {
      setIsLoading(true);
      await apiClient.post(`${API_BASE_URL}/mark`, {
        date: dateString,
        attendanceData,
      });

      // SUCCESS: Switch to Summary View immediately
      setMarkingState('SUCCESS_SUMMARY');
      
    } catch (error: any) {
      Alert.alert("Submission Error", error.response?.data?.message || 'Failed to submit attendance.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchQuery(text);
  };

  const filteredReportList = useMemo(() => {
    if (!searchQuery) return allTeachersForReport;
    const lowerQuery = searchQuery.toLowerCase();
    return allTeachersForReport.filter(t => 
        t.full_name.toLowerCase().includes(lowerQuery) || 
        (t.subjects_taught && t.subjects_taught.some(sub => sub.toLowerCase().includes(lowerQuery)))
    );
  }, [allTeachersForReport, searchQuery]);

  // --- Render Functions ---

  const renderTeacherMarkingItem = ({ item }: { item: TeacherMarking }) => (
    <View style={styles.teacherRow}>
      <View style={styles.teacherInfo}>
        <Text style={styles.teacherName}>{item.full_name}</Text>
        <Text style={styles.teacherSubjects}>
            { (item.subjects_taught?.length ? item.subjects_taught.join(', ') : `ID: ${item.id}`) }
        </Text>
      </View>
      
      <View style={styles.statusButtons}>
        <TouchableOpacity
          style={[styles.statusButton, styles.presentButton, item.status === 'P' && styles.presentActive]}
          onPress={() => handleStatusChange(item.id, 'P')}
        >
          <Text style={item.status === 'P' ? styles.activeText : styles.presentText}>P</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statusButton, styles.absentButton, item.status === 'A' && styles.absentActive]}
          onPress={() => handleStatusChange(item.id, 'A')}
        >
          <Text style={item.status === 'A' ? styles.activeText : styles.absentText}>A</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTeacherReportSelectionItem = ({ item, index }: { item: Teacher, index: number }) => (
    <Animatable.View animation="fadeInUp" duration={400} delay={index * 50}>
      <TouchableOpacity 
        style={styles.reportSelectionRow}
        onPress={() => setSelectedTeacherId(item.id.toString())}
      >
        <View style={styles.teacherInfo}>
            <Text style={styles.teacherName}>{item.full_name}</Text>
            <Text style={styles.teacherSubjects}>
                { (item.subjects_taught?.length ? item.subjects_taught.join(', ') : `ID: ${item.id}`) }
            </Text>
        </View>
        <Icon name="chevron-right" size={24} color={TEXT_COLOR_MEDIUM} />
      </TouchableOpacity>
    </Animatable.View>
  );

  // --- Render Success Summary View ---
  const renderSuccessSummary = () => (
      <View style={styles.summaryContainer}>
          <Icon name="check-circle-outline" size={80} color={GREEN} />
          <Text style={styles.summaryTitle}>Attendance Marked!</Text>
          <Text style={styles.summaryMessage}>
              Attendance for {attendanceDate.toLocaleDateString()} has been saved successfully.
              You can click "Edit Attendance" to make any changes.
          </Text>
          <TouchableOpacity 
              style={styles.editButton}
              onPress={() => {
                  // When clicking Edit, switch back to MARKING state
                  setMarkingState('MARKING');
                  // We need to reload the actual status for the date for editing
                  loadMarkingDataForDate(attendanceDate);
              }}
          >
              <Text style={styles.editButtonText}>Edit Attendance</Text>
          </TouchableOpacity>
      </View>
  );


  // --- Conditional Rendering for Report View ---
  if (selectedTeacherId) {
    const teacherName = allTeachersForReport.find(t => t.id.toString() === selectedTeacherId)?.full_name || "Unknown Teacher";
    return (
        <TeacherReportView 
            teacherId={selectedTeacherId} 
            headerTitle={`Report: ${teacherName}`} 
            onBack={() => setSelectedTeacherId(null)}
        />
    );
  }

  // --- Main Admin Tabbed View ---
  return (
    <SafeAreaView style={styles.container}>
        <View style={styles.tabBar}>
            <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'marking' && styles.tabActive]} 
                onPress={() => setActiveTab('marking')}
            >
                <Text style={[styles.tabButtonText, activeTab === 'marking' && styles.tabButtonTextActive]}>Mark Attendance</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'reporting' && styles.tabActive]} 
                onPress={() => setActiveTab('reporting')}
            >
                <Text style={[styles.tabButtonText, activeTab === 'reporting' && styles.tabButtonTextActive]}>Check Reports</Text>
            </TouchableOpacity>
        </View>

        {activeTab === 'marking' && (
            <View style={{flex: 1}}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Mark Teacher Attendance</Text>
                    <View style={styles.dateSelector}>
                        <Text style={styles.label}>Date:</Text>
                        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateInput}>
                            <Text>{attendanceDate.toLocaleDateString()}</Text>
                        </TouchableOpacity>
                    </View>
                    {showDatePicker && (
                        <DateTimePicker
                            value={attendanceDate}
                            mode="date"
                            display="default"
                            onChange={handleDateChange}
                        />
                    )}
                </View>
                
                {markingState === 'LOADING' && <View style={styles.center}><ActivityIndicator size="large" color={PRIMARY_COLOR} /></View>}
                {markingState === 'SUCCESS_SUMMARY' && renderSuccessSummary()}
                
                {markingState === 'MARKING' && (
                    <>
                        <Text style={styles.listTitle}>Teacher List ({teachers.length})</Text>

                        <FlatList
                            data={teachers}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={renderTeacherMarkingItem}
                            contentContainerStyle={{ paddingBottom: 100 }}
                            ListEmptyComponent={<Text style={styles.emptyText}>No teacher records found.</Text>}
                        />

                        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitAttendance} disabled={isLoading}>
                            <Text style={styles.submitBtnText}>SUBMIT ATTENDANCE</Text>
                        </TouchableOpacity>
                    </>
                )}

            </View>
        )}

        {activeTab === 'reporting' && (
            <View style={{flex: 1}}>
                <Animatable.View animation="fadeIn" duration={600} style={styles.searchBarContainer}>
                    <Icon name="magnify" size={22} color={TEXT_COLOR_MEDIUM} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchBar}
                        placeholder="Search teacher by name or subject..."
                        value={searchQuery}
                        onChangeText={handleSearch}
                        placeholderTextColor={TEXT_COLOR_MEDIUM}
                    />
                </Animatable.View>

                {isLoading ? (
                    <View style={styles.center}><ActivityIndicator size="large" color={PRIMARY_COLOR} /></View>
                ) : (
                    <FlatList
                        data={filteredReportList}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderTeacherReportSelectionItem}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        ListEmptyComponent={<Text style={styles.emptyText}>No teachers found matching search criteria.</Text>}
                    />
                )}
            </View>
        )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // --- Tabs ---
  tabBar: { flexDirection: 'row', backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  tabButton: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: PRIMARY_COLOR },
  tabButtonText: { color: TEXT_COLOR_MEDIUM, fontWeight: '600' },
  tabButtonTextActive: { color: PRIMARY_COLOR },

  // --- Header/Date Selector (Marking Tab) ---
  header: { paddingHorizontal: 20, paddingTop: 15, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: TEXT_COLOR_DARK, marginBottom: 10, textAlign: 'left' },
  dateSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 10, paddingBottom: 20 },
  label: { fontSize: 16, fontWeight: '500', color: TEXT_COLOR_DARK, marginRight: 15 },
  dateInput: { borderWidth: 1, borderColor: BORDER_COLOR, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 5, backgroundColor: WHITE },
  listTitle: { fontSize: 16, fontWeight: 'bold', padding: 10, backgroundColor: '#E0E0E0', color: TEXT_COLOR_DARK },
  
  // --- Marking List Rows ---
  teacherRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: WHITE },
  teacherInfo: { flex: 1, marginRight: 10 },
  teacherName: { fontSize: 16, fontWeight: 'bold', color: TEXT_COLOR_DARK },
  teacherSubjects: { fontSize: 13, color: TEXT_COLOR_MEDIUM, marginTop: 2 },
  
  statusButtons: { flexDirection: 'row' },
  statusButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 10, borderWidth: 1.5 },
  
  presentButton: { borderColor: GREEN },
  absentButton: { borderColor: RED, backgroundColor: WHITE },
  
  presentText: { color: GREEN, fontWeight: 'bold' },
  absentText: { color: RED, fontWeight: 'bold' },

  presentActive: { backgroundColor: GREEN, borderColor: GREEN },
  absentActive: { backgroundColor: RED, borderColor: RED },
  activeText: { color: WHITE, fontWeight: 'bold' },

  // --- Submit Button ---
  submitBtn: { backgroundColor: PRIMARY_COLOR, padding: 15, alignItems: 'center', position: 'absolute', bottom: 0, left: 0, right: 0 },
  submitBtnText: { color: WHITE, fontSize: 18, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 20, color: TEXT_COLOR_MEDIUM },

  // --- Report Selection List ---
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, marginHorizontal: 15, marginVertical: 15, borderRadius: 8, borderWidth: 1, borderColor: BORDER_COLOR, paddingHorizontal: 10 },
  searchBar: { flex: 1, height: 45, fontSize: 16, color: TEXT_COLOR_DARK },
  searchIcon: { marginRight: 8 },
  reportSelectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 20, marginHorizontal: 10, marginVertical: 4, backgroundColor: WHITE, borderRadius: 8, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },

  // --- Success Summary View Styles ---
  summaryContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: WHITE },
  summaryTitle: { fontSize: 24, fontWeight: 'bold', color: TEXT_COLOR_DARK, marginTop: 15, marginBottom: 10 },
  summaryMessage: { fontSize: 16, color: TEXT_COLOR_MEDIUM, textAlign: 'center', marginBottom: 30 },
  editButton: { backgroundColor: PRIMARY_COLOR, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 },
  editButtonText: { color: WHITE, fontSize: 16, fontWeight: 'bold' },
});

export default TeacherAttendanceMarkingScreen;