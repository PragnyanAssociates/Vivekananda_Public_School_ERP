import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, 
  TextInput, Platform, UIManager, LayoutAnimation, SafeAreaView, useColorScheme, 
  StatusBar, Dimensions
} from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import TeacherReportView from './TeacherReportView';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';

const { width } = Dimensions.get('window');

// --- THEME DEFINITIONS ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    inputBg: '#FFFFFF',
    success: '#43A047',
    danger: '#E53935',
    white: '#FFFFFF',
    headerIconBg: '#E0F2F1',
    tabActiveBg: '#F0FDF4',
    placeholder: '#90A4AE'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    success: '#66BB6A',
    danger: '#EF5350',
    white: '#FFFFFF', // Text on buttons usually stays white
    headerIconBg: '#333333',
    tabActiveBg: '#1A2733',
    placeholder: '#757575'
};

const API_BASE_URL = '/teacher-attendance';

const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

const TeacherAttendanceMarkingScreen = () => {
  const { user } = useAuth();
  
  // Theme Hook
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const COLORS = isDark ? DarkColors : LightColors;

  const [activeTab, setActiveTab] = useState('marking');
  const [teachers, setTeachers] = useState([]); 
  const [allTeachersForReport, setAllTeachersForReport] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [attendanceDate, setAttendanceDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const [markingState, setMarkingState] = useState('LOADING');

  const loadMarkingDataForDate = useCallback(async (dateToCheck) => {
    const dateString = dateToCheck.toISOString().slice(0, 10);
    try {
        const response = await apiClient.get(`${API_BASE_URL}/sheet?date=${dateString}`);
        const teachersData = response.data; 
        setTeachers(teachersData);
        setAllTeachersForReport(teachersData); 
        const isAlreadyMarked = teachersData.length > 0 && teachersData.some(t => t.isMarked);
        setMarkingState(isAlreadyMarked ? 'SUCCESS_SUMMARY' : 'MARKING'); 
    } catch (error) {
        Alert.alert("Error", error.response?.data?.message || "Failed to load teacher base data.");
        setMarkingState('MARKING'); 
    } finally {
        setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
      setIsLoading(true);
      loadMarkingDataForDate(attendanceDate);
  }, [attendanceDate, loadMarkingDataForDate]); 

  const handleStatusChange = (teacherId, status) => {
    setTeachers(prev => prev.map(t => (t.id === teacherId ? { ...t, status } : t)));
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setAttendanceDate(selectedDate);
  };

  const handleSubmitAttendance = async () => {
    if (!user || user.role !== 'admin') return Alert.alert("Error", "Only Admins can submit attendance.");
    const dateString = attendanceDate.toISOString().slice(0, 10);
    const attendanceData = teachers.map(t => ({ teacher_id: t.id, status: t.status }));

    if (attendanceData.length === 0) return Alert.alert("Error", "No teachers selected.");

    try {
      setIsLoading(true);
      await apiClient.post(`${API_BASE_URL}/mark`, { date: dateString, attendanceData });
      setMarkingState('SUCCESS_SUMMARY');
      loadMarkingDataForDate(attendanceDate);
    } catch (error) {
      Alert.alert("Submission Error", error.response?.data?.message || 'Failed to submit attendance.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (text) => {
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
  const renderTeacherMarkingItem = ({ item }) => (
    <View style={[styles.teacherRow, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
      <View style={styles.teacherInfo}>
        <Text style={[styles.teacherName, { color: COLORS.textMain }]}>{item.full_name}</Text>
        <Text style={[styles.teacherSubjects, { color: COLORS.textSub }]}>
            { (item.subjects_taught?.length ? item.subjects_taught.join(', ') : `ID: ${item.id}`) }
        </Text>
      </View>
      <View style={styles.statusButtons}>
        <TouchableOpacity 
            style={[
                styles.statusButton, 
                item.status === 'P' ? { backgroundColor: COLORS.success, borderColor: COLORS.success } : { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }
            ]} 
            onPress={() => handleStatusChange(item.id, 'P')}
        >
          <Text style={[styles.statusBtnText, item.status === 'P' ? {color: '#fff'} : {color: COLORS.success}]}>P</Text>
        </TouchableOpacity>
        <TouchableOpacity 
            style={[
                styles.statusButton, 
                item.status === 'A' ? { backgroundColor: COLORS.danger, borderColor: COLORS.danger } : { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }
            ]} 
            onPress={() => handleStatusChange(item.id, 'A')}
        >
          <Text style={[styles.statusBtnText, item.status === 'A' ? {color: '#fff'} : {color: COLORS.danger}]}>A</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTeacherReportSelectionItem = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" duration={400} delay={index * 50}>
      <TouchableOpacity style={[styles.reportSelectionRow, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]} onPress={() => setSelectedTeacherId(item.id.toString())}>
        <View style={styles.teacherInfo}>
            <Text style={[styles.teacherName, { color: COLORS.textMain }]}>{item.full_name}</Text>
            <Text style={[styles.teacherSubjects, { color: COLORS.textSub }]}>{ (item.subjects_taught?.length ? item.subjects_taught.join(', ') : `ID: ${item.id}`) }</Text>
        </View>
        <Icon name="chevron-right" size={24} color={COLORS.textSub} />
      </TouchableOpacity>
    </Animatable.View>
  );

  const renderSuccessSummary = () => (
      <Animatable.View animation="fadeIn" duration={500} style={[styles.summaryContainer, { backgroundColor: COLORS.cardBg }]}>
          <View style={[styles.successIconContainer, { backgroundColor: COLORS.success }]}>
            <Icon name="check" size={50} color={COLORS.white} />
          </View>
          <Text style={[styles.summaryTitle, { color: COLORS.textMain }]}>Attendance Marked!</Text>
          <Text style={[styles.summaryMessage, { color: COLORS.textSub }]}>Attendance for {formatDate(attendanceDate)} has been saved successfully.</Text>
          <TouchableOpacity style={[styles.editButton, { backgroundColor: COLORS.primary }]} onPress={() => setMarkingState('MARKING')}>
              <Text style={styles.editButtonText}>Edit Attendance</Text>
          </TouchableOpacity>
      </Animatable.View>
  );

  if (selectedTeacherId) {
    const teacherName = allTeachersForReport.find(t => t.id.toString() === selectedTeacherId)?.full_name || "Unknown Teacher";
    return <TeacherReportView teacherId={selectedTeacherId} headerTitle={`Report: ${teacherName}`} onBack={() => setSelectedTeacherId(null)} />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
        
        {/* --- HEADER CARD --- */}
        <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
            <View style={styles.headerLeft}>
                <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                    <MaterialIcons name="person-pin" size={24} color={COLORS.primary} />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Teacher Attendance</Text>
                    <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Admin Control Panel</Text>
                </View>
            </View>
            {activeTab === 'marking' && (
                <TouchableOpacity style={styles.headerActionBtn} onPress={() => setShowDatePicker(true)}>
                    <MaterialIcons name="calendar-today" size={20} color={COLORS.primary} />
                </TouchableOpacity>
            )}
        </View>

        {/* Tabs */}
        <View style={[styles.tabContainer, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'marking' && { backgroundColor: COLORS.tabActiveBg, borderBottomColor: COLORS.primary }]} onPress={() => setActiveTab('marking')}>
                <Text style={[styles.tabButtonText, { color: COLORS.textSub }, activeTab === 'marking' && { color: COLORS.primary }]}>Mark Attendance</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, activeTab === 'reporting' && { backgroundColor: COLORS.tabActiveBg, borderBottomColor: COLORS.primary }]} onPress={() => setActiveTab('reporting')}>
                <Text style={[styles.tabButtonText, { color: COLORS.textSub }, activeTab === 'reporting' && { color: COLORS.primary }]}>View Reports</Text>
            </TouchableOpacity>
        </View>

        {showDatePicker && <DateTimePicker value={attendanceDate} mode="date" display="default" onChange={handleDateChange} />}

        {activeTab === 'marking' && (
            <View style={{flex: 1}}>
                {/* Date Subtitle */}
                <View style={styles.dateSubtitleContainer}>
                    <Text style={[styles.dateSubtitleText, { color: COLORS.textSub }]}>Date: {formatDate(attendanceDate)}</Text>
                </View>

                {isLoading && <View style={[styles.center, { backgroundColor: COLORS.background }]}><ActivityIndicator size="large" color={COLORS.primary} /></View>}
                
                {!isLoading && markingState === 'SUCCESS_SUMMARY' && renderSuccessSummary()}
                
                {!isLoading && markingState === 'MARKING' && (
                    <>
                        <FlatList
                            data={teachers}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={renderTeacherMarkingItem}
                            contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 100 }}
                            ListEmptyComponent={<Text style={[styles.emptyText, { color: COLORS.textSub }]}>No teacher records found.</Text>}
                        />
                        <View style={styles.footerContainer}>
                            <TouchableOpacity style={[styles.submitFooterButton, { backgroundColor: COLORS.primary }]} onPress={handleSubmitAttendance} disabled={isLoading}>
                                <Text style={styles.submitFooterText}>SUBMIT ATTENDANCE</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        )}

        {activeTab === 'reporting' && (
            <View style={{flex: 1}}>
                <Animatable.View animation="fadeIn" duration={600} style={[styles.searchBarContainer, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                    <Icon name="magnify" size={22} color={COLORS.textSub} style={styles.searchIcon} />
                    <TextInput
                        style={[styles.searchBar, { color: COLORS.textMain }]}
                        placeholder="Search teacher..."
                        value={searchQuery}
                        onChangeText={handleSearch}
                        placeholderTextColor={COLORS.placeholder}
                    />
                </Animatable.View>

                {isLoading ? (
                    <View style={[styles.center, { backgroundColor: COLORS.background }]}><ActivityIndicator size="large" color={COLORS.primary} /></View>
                ) : (
                    <FlatList
                        data={filteredReportList}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderTeacherReportSelectionItem}
                        contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
                        ListEmptyComponent={<Text style={[styles.emptyText, { color: COLORS.textSub }]}>No teachers found matching search criteria.</Text>}
                    />
                )}
            </View>
        )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
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
    headerActionBtn: { padding: 8, backgroundColor: '#f0fdfa', borderRadius: 8, borderWidth: 1, borderColor: '#ccfbf1' },

    // Tabs
    tabContainer: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 10, borderRadius: 8, overflow: 'hidden', elevation: 2, borderWidth: 1 },
    tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabButtonText: { fontSize: 14, fontWeight: '600' },

    // Date Subtitle
    dateSubtitleContainer: { alignItems: 'center', marginBottom: 10 },
    dateSubtitleText: { fontSize: 14, fontWeight: '500' },

    // List Rows
    teacherRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, marginVertical: 5, borderRadius: 10, elevation: 1 },
    teacherInfo: { flex: 1, marginRight: 10 },
    teacherName: { fontSize: 16, fontWeight: 'bold' },
    teacherSubjects: { fontSize: 13, marginTop: 2 },
    
    statusButtons: { flexDirection: 'row', gap: 10 },
    statusButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
    statusBtnText: { fontWeight: 'bold', fontSize: 16 },

    emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16 },

    // Search
    searchBarContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 15, marginBottom: 10, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10 },
    searchBar: { flex: 1, height: 45, fontSize: 16 },
    searchIcon: { marginRight: 8 },
    reportSelectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, marginVertical: 4, borderRadius: 10, elevation: 1 },

    // Summary View
    summaryContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    successIconContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    summaryTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
    summaryMessage: { fontSize: 16, textAlign: 'center', marginBottom: 30 },
    editButton: { paddingVertical: 12, paddingHorizontal: 40, borderRadius: 8 },
    editButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },

    // Footer
    footerContainer: { position: 'absolute', bottom: 20, left: 20, right: 20 },
    submitFooterButton: { paddingVertical: 15, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 5 },
    submitFooterText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
});

export default TeacherAttendanceMarkingScreen;