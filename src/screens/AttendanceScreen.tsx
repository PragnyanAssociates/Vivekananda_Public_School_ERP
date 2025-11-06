import React, { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput, // ✨ NEW: Import TextInput for the search bar
  UIManager,   // ✨ NEW: For LayoutAnimation
  LayoutAnimation, // ✨ NEW: For smooth list filtering
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Animatable from 'react-native-animatable'; // ✨ NEW: Import Animatable

// ✨ NEW: Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Constants (Shared across views) ---
const PRIMARY_COLOR = '#008080';
const TEXT_COLOR_DARK = '#37474F';
const TEXT_COLOR_MEDIUM = '#566573';
const BORDER_COLOR = '#E0E0E0';
const GREEN = '#43A047';
const RED = '#E53935';
const BLUE = '#1E88E5';
const YELLOW = '#FDD835';
const WHITE = '#FFFFFF';
const ORANGE = '#FB8C00';

const CLASS_GROUPS = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
const PERIOD_DEFINITIONS = [
  { period: 1, time: '09:00-09:45' },
];

const SummaryCard = ({ label, value, color, delay }) => ( // ✨ MODIFIED: Added delay prop
    <Animatable.View animation="zoomIn" duration={500} delay={delay} style={styles.summaryBox}>
        <Text style={[styles.summaryValue, { color }]}>{value}</Text>
        <Text style={styles.summaryLabel}>{label}</Text>
    </Animatable.View>
);

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

const HistoryDayCard = ({ item, index }) => { // ✨ MODIFIED: Added index prop
    const isPresent = item.status === 'Present';
    const dayStatus = isPresent ? 'Present' : 'Absent';
    const statusColor = isPresent ? GREEN : RED;

    return (
        <Animatable.View animation="fadeInUp" duration={400} delay={index * 100} style={styles.historyDayCard}>
            <View style={styles.historyDayHeader}>
                <Text style={styles.historyDate}>{new Date(item.attendance_date).toDateString()}</Text>
                <Text style={[styles.historyStatus, { color: statusColor }]}>{dayStatus}</Text>
            </View>
        </Animatable.View>
    );
};

// --- Main Router Component ---
const AttendanceScreen = ({ route }) => {
  const { user } = useAuth();
  if (!user) return <View style={styles.loaderContainer}><Text style={styles.noDataText}>User not found.</Text></View>;

  switch (user.role) {
    case 'teacher':
      return route?.params ? <TeacherLiveAttendanceView route={route} teacher={user} /> : <TeacherSummaryView teacher={user} />;
    case 'student':
      return <StudentAttendanceView student={user} />;
    case 'admin':
      return <AdminAttendanceView />;
    default:
      return <View style={styles.loaderContainer}><Text style={styles.noDataText}>No attendance view available for your role.</Text></View>;
  }
};


// --- MODIFIED: Generic Student History Component with Calendar ---
const GenericStudentHistoryView = ({ studentId, headerTitle, onBack }) => {
    const [viewMode, setViewMode] = useState('monthly');
    const [data, setData] = useState({ summary: {}, history: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!studentId) return;
            setIsLoading(true);
            try {
                let url = onBack
                    ? `/attendance/student-history-admin/${studentId}?viewMode=${viewMode}`
                    : `/attendance/my-history/${studentId}?viewMode=${viewMode}`;

                if (viewMode === 'daily') {
                    url += `&date=${selectedDate.toISOString().split('T')[0]}`;
                }

                const response = await apiClient.get(url);
                setData(response.data);
            } catch (error: any) {
                Alert.alert('Error', error.response?.data?.message || 'Could not load attendance history.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, [studentId, viewMode, selectedDate]);

    const onDateChange = (event: any, date?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (date) {
            setSelectedDate(date);
            if (viewMode !== 'daily') {
                setViewMode('daily');
            }
        }
    };

    const percentage = useMemo(() => {
        if (!data.summary?.total_days || data.summary.total_days === 0) return '0.0';
        return ((data.summary.present_days / data.summary.total_days) * 100).toFixed(1);
    }, [data.summary]);

    return (
        <SafeAreaView style={styles.container}>
            <Animatable.View animation="fadeInDown" duration={500}>
                <View style={styles.header}>
                    {onBack && (
                        <TouchableOpacity onPress={onBack} style={styles.backButton}>
                            <Icon name="arrow-left" size={24} color={TEXT_COLOR_DARK} />
                        </TouchableOpacity>
                    )}
                    <View style={{flex: 1, alignItems: 'center', paddingRight: onBack ? 30 : 0 }}>
                        <Text style={styles.headerTitle}>{headerTitle}</Text>
                        {viewMode === 'daily' && (
                            <Text style={styles.headerSubtitleSmall}>
                                Showing for: {selectedDate.toDateString()}
                            </Text>
                        )}
                    </View>
                </View>
            </Animatable.View>

            <View style={styles.toggleContainer}>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'daily' && styles.toggleButtonActive]} onPress={() => setViewMode('daily')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'daily' && styles.toggleButtonTextActive]}>Daily</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'monthly' && styles.toggleButtonActive]} onPress={() => setViewMode('monthly')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'monthly' && styles.toggleButtonTextActive]}>Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'overall' && styles.toggleButtonActive]} onPress={() => setViewMode('overall')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'overall' && styles.toggleButtonTextActive]}>Overall</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.calendarButton} onPress={() => setShowDatePicker(true)}>
                    <Icon name="calendar" size={22} color={PRIMARY_COLOR} />
                </TouchableOpacity>
            </View>

            {showDatePicker && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                />
            )}

            {isLoading ? <ActivityIndicator style={styles.loaderContainer} size="large" color={PRIMARY_COLOR} /> : (
                <>
                    <View style={styles.summaryContainer}>
                        <SummaryCard label="Overall" value={`${percentage}%`} color={BLUE} delay={100} />
                        <SummaryCard label="Days Present" value={data.summary.present_days || 0} color={GREEN} delay={200} />
                        <SummaryCard label="Days Absent" value={data.summary.absent_days || 0} color={RED} delay={300} />
                    </View>
                    <FlatList
                        data={data.history}
                        keyExtractor={(item) => item.attendance_date}
                        renderItem={({ item, index }) => <HistoryDayCard item={item} index={index} />}
                        ListHeaderComponent={<Text style={styles.historyTitle}>Detailed History ({capitalize(viewMode)})</Text>}
                        ListEmptyComponent={<Text style={styles.noDataText}>No records found for this period.</Text>}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                </>
            )}
        </SafeAreaView>
    );
};

const StudentAttendanceView = ({ student }) => {
    return (
        <GenericStudentHistoryView
            studentId={student.id}
            headerTitle="My Attendance Report"
        />
    );
};

const AdminStudentDetailView = ({ student, onBack }) => {
    return (
        <GenericStudentHistoryView
            studentId={student.student_id}
            headerTitle={`${student.full_name}'s Report`}
            onBack={onBack}
        />
    );
};


// ==========================================================
// --- MODIFIED SECTION STARTS HERE ---
// ==========================================================
const GenericSummaryView = ({
    picker1, picker2, listData,
    summaryData, isLoading, viewMode, setViewMode, onDateChange, selectedDate, onSelectStudent
}) => {
    const summary = summaryData?.overallSummary ?? {};
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredListData = useMemo(() => {
        if (!searchQuery) {
            return listData;
        }
        return listData.filter(student =>
            student.full_name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [listData, searchQuery]);

    const handleDateChange = (event: any, date?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (date) {
            onDateChange(date);
        }
    };

    const handleSearch = (text: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSearchQuery(text);
    };

    const renderSummaryCards = () => {
        if (viewMode === 'daily') {
            return (
                <View style={styles.summaryContainer}>
                    <SummaryCard label="Class Attendance %" value={`${Number(summary.overall_percentage ?? 0).toFixed(1)}%`} color={BLUE} delay={100} />
                    <SummaryCard label="Students Present" value={summary.students_present ?? 0} color={GREEN} delay={200} />
                    <SummaryCard label="Students Absent" value={summary.students_absent ?? 0} color={RED} delay={300} />
                </View>
            );
        } else {
            return (
                <View style={styles.summaryContainer}>
                    <SummaryCard label="Class Attendance %" value={`${Number(summary.overall_percentage ?? 0).toFixed(1)}%`} color={BLUE} delay={100} />
                    <SummaryCard label="Avg. Daily Attendance" value={`${Number(summary.avg_daily_attendance ?? 0).toFixed(1)}%`} color={ORANGE} delay={200} />
                    <SummaryCard label="Students Below 75%" value={summary.students_below_threshold ?? 0} color={RED} delay={300} />
                </View>
            );
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {showDatePicker && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                />
            )}
            <Animatable.View animation="fadeInDown" duration={500}>
                <View style={styles.pickerContainer}>
                    <View style={styles.pickerWrapper}>{picker1}</View>
                    <View style={styles.pickerWrapper}>{picker2}</View>
                </View>
            </Animatable.View>

            {viewMode === 'daily' && (
                <Text style={styles.dateHeader}>
                    Showing for: {selectedDate.toDateString()}
                </Text>
            )}

            <View style={styles.toggleContainer}>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'daily' && styles.toggleButtonActive]} onPress={() => setViewMode('daily')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'daily' && styles.toggleButtonTextActive]}>Daily</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'monthly' && styles.toggleButtonActive]} onPress={() => setViewMode('monthly')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'monthly' && styles.toggleButtonTextActive]}>Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'overall' && styles.toggleButtonActive]} onPress={() => setViewMode('overall')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'overall' && styles.toggleButtonTextActive]}>Overall</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.calendarButton} onPress={() => setShowDatePicker(true)}>
                    <Icon name="calendar" size={22} color={PRIMARY_COLOR} />
                </TouchableOpacity>
            </View>

            {isLoading ? <ActivityIndicator size="large" color={PRIMARY_COLOR} style={styles.loaderContainer} /> : (
                <FlatList
                    data={filteredListData}
                    keyExtractor={(item) => item.student_id.toString()}
                    ListHeaderComponent={
                        <>
                            {renderSummaryCards()}
                            <Animatable.View animation="fadeIn" duration={600} delay={400} style={styles.searchBarContainer}>
                                <Icon name="magnify" size={22} color={TEXT_COLOR_MEDIUM} style={styles.searchIcon} />
                                <TextInput
                                    style={styles.searchBar}
                                    placeholder="Search student by name..."
                                    value={searchQuery}
                                    onChangeText={handleSearch}
                                    placeholderTextColor={TEXT_COLOR_MEDIUM}
                                />
                            </Animatable.View>
                        </>
                    }
                    renderItem={({ item, index }) => { // ★★★ MODIFIED: Added roll number display ★★★
                        const studentPercentage = item.total_days > 0 ? (item.present_days / item.total_days) * 100 : 0;
                        const percentageColor = studentPercentage >= 75 ? GREEN : studentPercentage >= 50 ? YELLOW : RED;
                        return (
                            <Animatable.View animation="fadeInUp" duration={400} delay={index * 75}>
                                <TouchableOpacity onPress={() => onSelectStudent && onSelectStudent(item)}>
                                    <View style={styles.summaryStudentRow}>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.studentName}>{item.full_name}</Text>
                                            <Text style={styles.studentDetailText}>
                                                Roll No: {item.roll_no || 'N/A'} | Days Present: {item.present_days} / {item.total_days}
                                            </Text>
                                        </View>
                                        <Text style={[styles.percentageText, { color: percentageColor }]}>{studentPercentage.toFixed(0)}%</Text>
                                    </View>
                                </TouchableOpacity>
                            </Animatable.View>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.loaderContainer}>
                            <Text style={styles.noDataText}>
                                {searchQuery ? 'No students match your search.' : 'No attendance data for this selection.'}
                            </Text>
                        </View>
                    }
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}
        </SafeAreaView>
    );
};
// ==========================================================
// --- MODIFIED SECTION ENDS HERE ---
// ==========================================================

const TeacherSummaryView = ({ teacher }) => {
    // ... (This component's logic remains unchanged, it just benefits from the updated GenericSummaryView)
    const [assignments, setAssignments] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [summaryData, setSummaryData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState('overall');
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => {
        const fetchAssignments = async () => {
            if (!teacher?.id) { setIsLoading(false); return; }
            try {
                const response = await apiClient.get(`/teacher-assignments/${teacher.id}`);
                setAssignments(response.data);
                if (response.data.length > 0) {
                    setSelectedClass(response.data[0].class_group);
                    setSelectedSubject(response.data[0].subject_name);
                } else {
                    setIsLoading(false);
                }
            } catch (error) {
                Alert.alert('Error', 'Could not fetch assignments.');
                setIsLoading(false);
            }
        };
        fetchAssignments();
    }, [teacher.id]);

    useEffect(() => {
        const fetchSummary = async () => {
            if (!teacher?.id || !selectedClass || !selectedSubject) {
                setSummaryData(null);
                return;
            }
            setIsLoading(true);
            try {
                let url = `/attendance/teacher-summary?teacherId=${teacher.id}&classGroup=${selectedClass}&subjectName=${selectedSubject}&viewMode=${viewMode}`;
                if (viewMode === 'daily') {
                    url += `&date=${selectedDate.toISOString().split('T')[0]}`;
                }
                const response = await apiClient.get(url);
                setSummaryData(response.data);
            } catch (error) {
                Alert.alert('Error', 'Could not retrieve data.');
                setSummaryData(null);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSummary();
    }, [selectedClass, selectedSubject, viewMode, selectedDate]);

    const uniqueClasses = useMemo(() => [...new Set(assignments.map(a => a.class_group))], [assignments]);
    const subjectsForSelectedClass = useMemo(() => assignments.filter(a => a.class_group === selectedClass).map(a => a.subject_name), [assignments, selectedClass]);

    const handleClassChange = (newClass) => {
        setSelectedClass(newClass);
        const newSubjects = assignments.filter(a => a.class_group === newClass).map(a => a.subject_name);
        setSelectedSubject(newSubjects[0] || '');
    };

    const handleDateChange = (date: Date) => {
        setSelectedDate(date);
        if (viewMode !== 'daily') {
            setViewMode('daily');
        }
    };

    const picker1 = (
        <Picker selectedValue={selectedClass} onValueChange={handleClassChange} enabled={uniqueClasses.length > 0}>
            {uniqueClasses.length > 0 ?
                uniqueClasses.map(c => <Picker.Item key={c} label={c} value={c} />) :
                <Picker.Item label="No classes..." value="" enabled={false} />
            }
        </Picker>
    );

    const picker2 = (
        <Picker selectedValue={selectedSubject} onValueChange={setSelectedSubject} enabled={subjectsForSelectedClass.length > 0}>
             {subjectsForSelectedClass.length > 0 ?
                subjectsForSelectedClass.map(s => <Picker.Item key={s} label={s} value={s} />) :
                <Picker.Item label="No subjects..." value="" enabled={false} />
            }
        </Picker>
    );

    return (
        <GenericSummaryView
            picker1={picker1}
            picker2={picker2}
            listData={summaryData?.studentDetails || []}
            summaryData={summaryData}
            isLoading={isLoading}
            viewMode={viewMode}
            setViewMode={setViewMode}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
        />
    );
};

const AdminAttendanceView = () => {
  // ... (This component's logic remains unchanged, it just benefits from the updated GenericSummaryView)
  const [selectedClass, setSelectedClass] = useState(CLASS_GROUPS[9]);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [summaryData, setSummaryData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState('overall');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    const fetchSubjects = async () => {
      if (!selectedClass) return;
      setIsLoading(true);
      setSubjects([]);
      setSelectedSubject('');
      setSummaryData(null);
      try {
        const response = await apiClient.get(`/subjects/${selectedClass}`);
        setSubjects(response.data);
        if (response.data.length > 0) {
          setSelectedSubject(response.data[0]);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to fetch subjects.');
        setIsLoading(false);
      }
    };
    fetchSubjects();
  }, [selectedClass]);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!selectedClass || !selectedSubject) {
        setSummaryData(null);
        return;
      }
      setIsLoading(true);
      try {
        let url = `/attendance/admin-summary?classGroup=${selectedClass}&subjectName=${selectedSubject}&viewMode=${viewMode}`;
        if (viewMode === 'daily') {
            url += `&date=${selectedDate.toISOString().split('T')[0]}`;
        }
        const response = await apiClient.get(url);
        setSummaryData(response.data);
      } catch (error) {
        Alert.alert('Error', 'Could not fetch summary.');
        setSummaryData(null);
      } finally {
        setIsLoading(false);
      }
    };
    if (selectedSubject) {
        fetchSummary();
    }
  }, [selectedSubject, viewMode, selectedDate]);

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    if (viewMode !== 'daily') {
        setViewMode('daily');
    }
  };

  if (selectedStudent) {
    return <AdminStudentDetailView student={selectedStudent} onBack={() => setSelectedStudent(null)} />;
  }

  const picker1 = (
    <Picker selectedValue={selectedClass} onValueChange={setSelectedClass}>
        {CLASS_GROUPS.map(c => <Picker.Item key={c} label={c} value={c} />)}
    </Picker>
  );

  const picker2 = (
    <Picker selectedValue={selectedSubject} onValueChange={setSelectedSubject} enabled={subjects.length > 0}>
        {subjects.length > 0 ?
          subjects.map(s => <Picker.Item key={s} label={s} value={s} />) :
          <Picker.Item label="No subjects..." value="" />
        }
    </Picker>
  );

  return (
    <GenericSummaryView
        picker1={picker1}
        picker2={picker2}
        listData={summaryData?.studentDetails || []}
        summaryData={summaryData}
        isLoading={isLoading}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onSelectStudent={setSelectedStudent}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
    />
  );
};

// ==========================================================
// --- TeacherLiveAttendanceView: REBUILT FOR PERSISTENT STATE ---
// ==========================================================
const TeacherLiveAttendanceView = ({ route, teacher }) => {
  const { class_group, subject_name, date } = route?.params || {};
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAttendanceMarked, setIsAttendanceMarked] = useState(false);
  const periodInfo = PERIOD_DEFINITIONS.find(p => p.period === 1);
  const periodTime = periodInfo ? periodInfo.time : `Period 1`;

  const fetchAttendanceSheet = async () => {
    if (!class_group || !date) {
      Alert.alert('Error', 'Missing parameters.');
      setIsLoading(false);
      return;
    }
    try {
      const response = await apiClient.get(`/attendance/sheet?class_group=${class_group}&date=${date}&period_number=1`);
      const studentsWithStatus = response.data.map(s => ({ ...s, status: s.status || 'Present' }));
      setStudents(studentsWithStatus);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load students.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkInitialStatus = async () => {
      setIsLoading(true);
      try {
        const statusResponse = await apiClient.get(
          `/attendance/status?class_group=${class_group}&date=${date}&period_number=1&subject_name=${subject_name}`
        );

        if (statusResponse.data?.isMarked) {
          setIsAttendanceMarked(true);
          setIsLoading(false);
        } else {
          setIsAttendanceMarked(false);
          await fetchAttendanceSheet();
        }
      } catch (error) {
        Alert.alert('Error', 'Could not check attendance status.');
        setIsLoading(false);
      }
    };

    if (class_group && subject_name && date) {
        checkInitialStatus();
    }
  }, [class_group, date, subject_name]);

  const handleMarkAttendance = (studentId, newStatus) => {
    setStudents(prev => prev.map(s => (s.id === studentId ? { ...s, status: newStatus } : s)));
  };

  const handleSaveAttendance = async () => {
    const attendanceData = students.map(s => ({ student_id: s.id, status: s.status }));
    if (attendanceData.length === 0) return;
    setIsSaving(true);
    try {
      await apiClient.post('/attendance', { class_group, subject_name, period_number: 1, date, teacher_id: teacher.id, attendanceData });
      setIsAttendanceMarked(true);
    } catch (error: any) {
      console.error("Failed to save attendance:", JSON.stringify(error.response?.data || error.message, null, 2));
      const errorMessage = error.response?.data?.message || 'Failed to save attendance. Please contact support.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditAttendance = async () => {
    setIsLoading(true);
    setIsAttendanceMarked(false);
    await fetchAttendanceSheet();
  };

  if (isLoading) {
    return <ActivityIndicator style={styles.loaderContainer} size="large" color={PRIMARY_COLOR} />;
  }

  if (isAttendanceMarked) {
    const formattedDate = new Date(date).toLocaleDateString('en-GB'); // Using en-GB for DD/MM/YYYY
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.successContainer}>
                <Animatable.View animation="bounceIn" duration={800}>
                   <Icon name="check-circle" size={80} color={GREEN} style={{ color: '#2E8B57' }} />
                </Animatable.View>
                <Text style={styles.successTitle}>Attendance Marked!</Text>
                <Text style={styles.successSubtitle}>
                    {`Attendance for ${formattedDate} has been saved successfully. You can click "Edit Attendance" to make any changes.`}
                </Text>
                <TouchableOpacity style={styles.editButton} onPress={handleEditAttendance}>
                    <Text style={styles.editButtonText}>Edit Attendance</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animatable.View animation="fadeInDown" duration={500}>
        <View style={styles.centeredHeader}>
            <Text style={styles.headerTitle}>Daily Attendance</Text>
            <Text style={styles.headerSubtitle}>{`${class_group} - ${subject_name}`}</Text>
            <Text style={styles.headerSubtitleSmall}>{`For ${date} (Based on 1st Period - ${periodTime})`}</Text>
        </View>
      </Animatable.View>
      <FlatList
        data={students}
        renderItem={({ item, index }) => (
            <Animatable.View animation="fadeInUp" duration={400} delay={index * 75} style={styles.liveStudentRow}>
                <View style={styles.studentInfoContainer}>
                    <Icon name="account-circle-outline" size={32} color={TEXT_COLOR_DARK} />
                    <View style={styles.studentNameContainer}>
                        <Text style={styles.studentName}>{item.full_name}</Text>
                        <Text style={styles.rollNoText}>Roll No: {item.roll_no || 'N/A'}</Text>
                    </View>
                </View>

                <View style={styles.buttonGroup}>
                    <TouchableOpacity style={[styles.statusButton, item.status === 'Present' && styles.presentButton]} onPress={() => handleMarkAttendance(item.id, 'Present')}><Text style={[styles.statusButtonText, item.status === 'Present' && { color: WHITE }]}>P</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.statusButton, item.status === 'Absent' && styles.absentButton]} onPress={() => handleMarkAttendance(item.id, 'Absent')}><Text style={[styles.statusButtonText, item.status === 'Absent' && { color: WHITE }]}>A</Text></TouchableOpacity>
                </View>
            </Animatable.View>
        )}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={{ padding: 10 }}
        ListEmptyComponent={<Text style={styles.noDataText}>No students found in this class.</Text>}
      />
      <TouchableOpacity style={styles.saveButton} onPress={handleSaveAttendance} disabled={isSaving || students.length === 0}>
        {isSaving ? <ActivityIndicator color={WHITE} /> : <Text style={styles.saveButtonText}>SUBMIT ATTENDANCE</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
};


// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WHITE }, // Changed to WHITE for the success screen
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: WHITE },
  noDataText: { textAlign: 'center', marginTop: 20, color: TEXT_COLOR_MEDIUM, fontSize: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  centeredHeader: { paddingVertical: 15, paddingHorizontal: 20, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: TEXT_COLOR_DARK, textAlign: 'center' },
  headerSubtitle: { fontSize: 16, color: TEXT_COLOR_MEDIUM, marginTop: 4, textAlign: 'center' },
  headerSubtitleSmall: { fontSize: 14, color: TEXT_COLOR_MEDIUM, marginTop: 2, textAlign: 'center' },
  backButton: { position: 'absolute', left: 15, zIndex: 1, padding: 5 },
  pickerContainer: { flexDirection: 'row', padding: 10, backgroundColor: WHITE, borderBottomColor: BORDER_COLOR, borderBottomWidth: 1, alignItems: 'center' },
  pickerWrapper: { flex: 1, marginHorizontal: 5, backgroundColor: '#F0F4F8', borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 8, height: 50, justifyContent: 'center' },
  summaryContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  summaryBox: { alignItems: 'center', flex: 1, paddingVertical: 10, paddingHorizontal: 5 },
  summaryValue: { fontSize: 26, fontWeight: 'bold' },
  summaryLabel: { fontSize: 14, color: TEXT_COLOR_MEDIUM, marginTop: 5, fontWeight: '500', textAlign: 'center' },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, marginHorizontal: 15, marginTop: 15, borderRadius: 8, borderWidth: 1, borderColor: BORDER_COLOR, paddingHorizontal: 10 },
  searchBar: { flex: 1, height: 45, fontSize: 16, color: TEXT_COLOR_DARK },
  searchIcon: { marginRight: 8 },
  summaryStudentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, padding: 15, marginHorizontal: 15, marginVertical: 6, borderRadius: 8, elevation: 1, shadowColor: '#999', shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  studentName: { fontSize: 16, color: TEXT_COLOR_DARK, fontWeight: '600' },
  studentDetailText: { fontSize: 12, color: TEXT_COLOR_MEDIUM, marginTop: 4 },
  percentageText: { fontSize: 20, fontWeight: 'bold' },
  liveStudentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, backgroundColor: '#F9F9F9', marginHorizontal: 10, marginVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: BORDER_COLOR },
  studentInfoContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10, },
  studentNameContainer: { marginLeft: 12, flex: 1 },
  rollNoText: { fontSize: 13, color: TEXT_COLOR_MEDIUM, marginTop: 2 },
  buttonGroup: { flexDirection: 'row' },
  statusButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#BDBDBD', marginHorizontal: 5 },
  presentButton: { backgroundColor: GREEN, borderColor: '#388E3C' },
  absentButton: { backgroundColor: RED, borderColor: '#D32F2F' },
  statusButtonText: { fontSize: 16, fontWeight: 'bold', color: '#555' },
  saveButton: { backgroundColor: PRIMARY_COLOR, padding: 15, margin: 10, borderRadius: 8, alignItems: 'center' },
  saveButtonText: { color: WHITE, fontSize: 16, fontWeight: 'bold' },
  toggleContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 5, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, alignItems: 'center' },
  toggleButton: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, marginHorizontal: 5, backgroundColor: '#E0E0E0' },
  toggleButtonActive: { backgroundColor: PRIMARY_COLOR },
  toggleButtonText: { color: TEXT_COLOR_DARK, fontWeight: '600' },
  toggleButtonTextActive: { color: WHITE },
  historyTitle: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 20, marginTop: 15, marginBottom: 10, color: TEXT_COLOR_DARK },
  historyDayCard: { backgroundColor: WHITE, marginHorizontal: 15, marginVertical: 8, borderRadius: 8, elevation: 2, shadowColor: '#999', shadowOpacity: 0.1, shadowRadius: 5 },
  historyDayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  historyDate: { fontSize: 16, fontWeight: '600', color: TEXT_COLOR_DARK },
  historyStatus: { fontSize: 14, fontWeight: 'bold' },
  calendarButton: { padding: 8, marginLeft: 10, justifyContent: 'center', alignItems: 'center' },
  dateHeader: { textAlign: 'center', paddingVertical: 8, backgroundColor: '#F0F4F8', color: TEXT_COLOR_MEDIUM, fontSize: 14, fontWeight: '500' },
  // Styles for the success screen
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30, backgroundColor: WHITE },
  successTitle: { fontSize: 24, fontWeight: 'bold', color: TEXT_COLOR_DARK, marginTop: 20, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium' },
  successSubtitle: { fontSize: 16, color: TEXT_COLOR_MEDIUM, textAlign: 'center', marginTop: 10, marginBottom: 30, lineHeight: 24, },
  editButton: { backgroundColor: '#008080', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, },
  editButtonText: { color: WHITE, fontSize: 16, fontWeight: 'bold' },
});

export default AttendanceScreen;