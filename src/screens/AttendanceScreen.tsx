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
  TextInput,
  UIManager,
  LayoutAnimation,
  Dimensions
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Animatable from 'react-native-animatable';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Constants ---
const PRIMARY_COLOR = '#008080'; // Teal color from your image
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

// --- Helper: Date Formatter (DD/MM/YYYY) ---
const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

const SummaryCard = ({ label, value, color, delay }) => (
    <Animatable.View animation="zoomIn" duration={500} delay={delay} style={styles.summaryBox}>
        <Text style={[styles.summaryValue, { color }]}>{value}</Text>
        <Text style={styles.summaryLabel}>{label}</Text>
    </Animatable.View>
);

const HistoryDayCard = ({ item, index }) => {
    const isPresent = item.status === 'Present';
    const dayStatus = isPresent ? 'Present' : 'Absent';
    const statusColor = isPresent ? GREEN : RED;

    return (
        <Animatable.View animation="fadeInUp" duration={400} delay={index * 100} style={styles.historyDayCard}>
            <View style={styles.historyDayHeader}>
                <Text style={styles.historyDate}>{formatDate(item.attendance_date)}</Text>
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
      // If params exist (class_group, etc.), show Live View, otherwise Summary View
      return route?.params ? <TeacherLiveAttendanceView route={route} teacher={user} /> : <TeacherSummaryView teacher={user} />;
    case 'student':
      return <StudentAttendanceView student={user} />;
    case 'admin':
      return <AdminAttendanceView />;
    default:
      return <View style={styles.loaderContainer}><Text style={styles.noDataText}>No attendance view available for your role.</Text></View>;
  }
};

// --- MODIFIED: Generic Student History Component with Yearly/Range ---
const GenericStudentHistoryView = ({ studentId, headerTitle, onBack }) => {
    const [viewMode, setViewMode] = useState('monthly');
    const [data, setData] = useState({ summary: {}, history: [] });
    const [isLoading, setIsLoading] = useState(true);
    
    // Date States
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [fromDate, setFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)));
    const [toDate, setToDate] = useState(new Date());

    // Picker Visibility
    const [showMainPicker, setShowMainPicker] = useState(false);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);

    const fetchHistory = async () => {
        if (!studentId) return;
        setIsLoading(true);
        try {
            let url = onBack
                ? `/attendance/student-history-admin/${studentId}?viewMode=${viewMode}`
                : `/attendance/my-history/${studentId}?viewMode=${viewMode}`;

            if (viewMode === 'daily') url += `&date=${selectedDate.toISOString().split('T')[0]}`;
            else if (viewMode === 'monthly') url += `&date=${selectedDate.toISOString().slice(0, 7)}`;
            else if (viewMode === 'yearly') url += `&targetYear=${selectedDate.getFullYear()}`;
            else if (viewMode === 'custom') url += `&startDate=${fromDate.toISOString().split('T')[0]}&endDate=${toDate.toISOString().split('T')[0]}`;

            const response = await apiClient.get(url);
            setData(response.data);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Could not load attendance history.');
        } finally {
            setIsLoading(false);
        }
    };

    // Auto fetch on mode/date change (except custom range)
    useEffect(() => {
        if (viewMode !== 'custom') fetchHistory();
    }, [studentId, viewMode, selectedDate]);

    const onMainDateChange = (event: any, date?: Date) => {
        setShowMainPicker(Platform.OS === 'ios');
        if (date) setSelectedDate(date);
    };

    const onFromDateChange = (event: any, date?: Date) => {
        setShowFromPicker(Platform.OS === 'ios');
        if (date) setFromDate(date);
    };

    const onToDateChange = (event: any, date?: Date) => {
        setShowToPicker(Platform.OS === 'ios');
        if (date) setToDate(date);
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
                        {viewMode === 'daily' && <Text style={styles.headerSubtitleSmall}>Date: {formatDate(selectedDate)}</Text>}
                        {viewMode === 'monthly' && <Text style={styles.headerSubtitleSmall}>{selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>}
                        {viewMode === 'yearly' && <Text style={styles.headerSubtitleSmall}>Year: {selectedDate.getFullYear()}</Text>}
                        {viewMode === 'custom' && <Text style={styles.headerSubtitleSmall}>Custom Range</Text>}
                    </View>
                </View>
            </Animatable.View>

            {/* TABS: Daily | Monthly | Yearly | Range */}
            <View style={styles.toggleContainer}>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'daily' && styles.toggleButtonActive]} onPress={() => setViewMode('daily')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'daily' && styles.toggleButtonTextActive]}>Daily</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'monthly' && styles.toggleButtonActive]} onPress={() => setViewMode('monthly')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'monthly' && styles.toggleButtonTextActive]}>Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'yearly' && styles.toggleButtonActive]} onPress={() => setViewMode('yearly')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'yearly' && styles.toggleButtonTextActive]}>Yearly</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'custom' && styles.toggleButtonActive]} onPress={() => setViewMode('custom')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'custom' && styles.toggleButtonTextActive]}>Range</Text>
                </TouchableOpacity>
                
                {viewMode !== 'custom' && (
                    <TouchableOpacity style={styles.calendarButton} onPress={() => setShowMainPicker(true)}>
                        <Icon name="calendar" size={22} color={PRIMARY_COLOR} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Range Inputs */}
            {viewMode === 'custom' && (
                <Animatable.View animation="fadeIn" duration={300} style={styles.rangeContainer}>
                    <TouchableOpacity style={styles.dateInputBox} onPress={() => setShowFromPicker(true)}>
                        <Icon name="calendar-today" size={18} color={TEXT_COLOR_MEDIUM} style={{marginRight:5}}/>
                        <Text style={styles.dateInputText}>{formatDate(fromDate)}</Text>
                    </TouchableOpacity>
                    <Icon name="arrow-right" size={20} color={TEXT_COLOR_MEDIUM} />
                    <TouchableOpacity style={styles.dateInputBox} onPress={() => setShowToPicker(true)}>
                        <Icon name="calendar-today" size={18} color={TEXT_COLOR_MEDIUM} style={{marginRight:5}}/>
                        <Text style={styles.dateInputText}>{formatDate(toDate)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.goButton} onPress={fetchHistory}>
                        <Text style={styles.goButtonText}>Go</Text>
                    </TouchableOpacity>
                </Animatable.View>
            )}

            {showMainPicker && <DateTimePicker value={selectedDate} mode="date" onChange={onMainDateChange} />}
            {showFromPicker && <DateTimePicker value={fromDate} mode="date" onChange={onFromDateChange} />}
            {showToPicker && <DateTimePicker value={toDate} mode="date" onChange={onToDateChange} />}

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
                        ListEmptyComponent={<Text style={styles.noDataText}>No records found.</Text>}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                </>
            )}
        </SafeAreaView>
    );
};

const StudentAttendanceView = ({ student }) => <GenericStudentHistoryView studentId={student.id} headerTitle="My Attendance Report" />;
const AdminStudentDetailView = ({ student, onBack }) => <GenericStudentHistoryView studentId={student.student_id} headerTitle={`${student.full_name}'s Report`} onBack={onBack} />;

// --- Generic Summary View (Teacher & Admin Class List) ---
const GenericSummaryView = ({
    picker1, picker2, listData,
    summaryData, isLoading, viewMode, setViewMode, 
    selectedDate, onDateChange, 
    fromDate, setFromDate, 
    toDate, setToDate,     
    onRangeFetch,          
    onSelectStudent
}) => {
    const summary = summaryData?.overallSummary ?? {};
    
    const [showMainPicker, setShowMainPicker] = useState(false);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    
    const [searchQuery, setSearchQuery] = useState('');

    const filteredListData = useMemo(() => {
        if (!searchQuery) return listData;
        return listData.filter(student => student.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [listData, searchQuery]);

    const handleMainDateChange = (event, date) => {
        setShowMainPicker(Platform.OS === 'ios');
        if (date && onDateChange) onDateChange(date);
    };

    const handleFromDateChange = (event, date) => {
        setShowFromPicker(Platform.OS === 'ios');
        if (date && setFromDate) setFromDate(date);
    };

    const handleToDateChange = (event, date) => {
        setShowToPicker(Platform.OS === 'ios');
        if (date && setToDate) setToDate(date);
    };

    const handleSearch = (text) => {
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
            <Animatable.View animation="fadeInDown" duration={500}>
                <View style={styles.pickerContainer}>
                    <View style={styles.pickerWrapper}>{picker1}</View>
                    {picker2 && <View style={styles.pickerWrapper}>{picker2}</View>} 
                </View>
                <View style={{alignItems: 'center', marginBottom: 5}}>
                     {viewMode === 'daily' && <Text style={styles.headerSubtitleSmall}>Date: {formatDate(selectedDate)}</Text>}
                     {viewMode === 'monthly' && <Text style={styles.headerSubtitleSmall}>Month: {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>}
                     {viewMode === 'yearly' && <Text style={styles.headerSubtitleSmall}>Year: {selectedDate.getFullYear()}</Text>}
                     {viewMode === 'custom' && <Text style={styles.headerSubtitleSmall}>Custom Range</Text>}
                </View>
            </Animatable.View>

            <View style={styles.toggleContainer}>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'daily' && styles.toggleButtonActive]} onPress={() => setViewMode('daily')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'daily' && styles.toggleButtonTextActive]}>Daily</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'monthly' && styles.toggleButtonActive]} onPress={() => setViewMode('monthly')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'monthly' && styles.toggleButtonTextActive]}>Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'yearly' && styles.toggleButtonActive]} onPress={() => setViewMode('yearly')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'yearly' && styles.toggleButtonTextActive]}>Yearly</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleButton, viewMode === 'custom' && styles.toggleButtonActive]} onPress={() => setViewMode('custom')}>
                    <Text style={[styles.toggleButtonText, viewMode === 'custom' && styles.toggleButtonTextActive]}>Range</Text>
                </TouchableOpacity>
                
                {viewMode !== 'custom' && (
                    <TouchableOpacity style={styles.calendarButton} onPress={() => setShowMainPicker(true)}>
                        <Icon name="calendar" size={22} color={PRIMARY_COLOR} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Range Inputs */}
            {viewMode === 'custom' && (
                <Animatable.View animation="fadeIn" duration={300} style={styles.rangeContainer}>
                    <TouchableOpacity style={styles.dateInputBox} onPress={() => setShowFromPicker(true)}>
                        <Icon name="calendar-today" size={18} color={TEXT_COLOR_MEDIUM} style={{marginRight:5}}/>
                        <Text style={styles.dateInputText}>{formatDate(fromDate)}</Text>
                    </TouchableOpacity>
                    <Icon name="arrow-right" size={20} color={TEXT_COLOR_MEDIUM} />
                    <TouchableOpacity style={styles.dateInputBox} onPress={() => setShowToPicker(true)}>
                        <Icon name="calendar-today" size={18} color={TEXT_COLOR_MEDIUM} style={{marginRight:5}}/>
                        <Text style={styles.dateInputText}>{formatDate(toDate)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.goButton} onPress={onRangeFetch}>
                        <Text style={styles.goButtonText}>Go</Text>
                    </TouchableOpacity>
                </Animatable.View>
            )}

            {/* Pickers */}
            {showMainPicker && <DateTimePicker value={selectedDate} mode="date" onChange={handleMainDateChange} />}
            {showFromPicker && <DateTimePicker value={fromDate} mode="date" onChange={handleFromDateChange} />}
            {showToPicker && <DateTimePicker value={toDate} mode="date" onChange={handleToDateChange} />}

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
                    renderItem={({ item, index }) => {
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

// --- Teacher View ---
const TeacherSummaryView = ({ teacher }) => {
    const [assignments, setAssignments] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [summaryData, setSummaryData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState('overall');
    const [selectedDate, setSelectedDate] = useState(new Date());
    
    const [fromDate, setFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)));
    const [toDate, setToDate] = useState(new Date());

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

    const fetchSummary = async () => {
        if (!teacher?.id || !selectedClass || !selectedSubject) {
            setSummaryData(null);
            return;
        }
        setIsLoading(true);
        try {
            let url = `/attendance/teacher-summary?teacherId=${teacher.id}&classGroup=${selectedClass}&subjectName=${selectedSubject}&viewMode=${viewMode}`;
            if (viewMode === 'daily') url += `&date=${selectedDate.toISOString().split('T')[0]}`;
            else if (viewMode === 'monthly') url += `&date=${selectedDate.toISOString().slice(0, 7)}`;
            else if (viewMode === 'yearly') url += `&targetYear=${selectedDate.getFullYear()}`;
            else if (viewMode === 'custom') url += `&startDate=${fromDate.toISOString().split('T')[0]}&endDate=${toDate.toISOString().split('T')[0]}`;
            
            const response = await apiClient.get(url);
            setSummaryData(response.data);
        } catch (error) {
            Alert.alert('Error', 'Could not retrieve data.');
            setSummaryData(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (viewMode !== 'custom') fetchSummary();
    }, [selectedClass, selectedSubject, viewMode, selectedDate]);

    const uniqueClasses = useMemo(() => [...new Set(assignments.map(a => a.class_group))], [assignments]);
    const subjectsForSelectedClass = useMemo(() => assignments.filter(a => a.class_group === selectedClass).map(a => a.subject_name), [assignments, selectedClass]);

    const handleClassChange = (newClass) => {
        setSelectedClass(newClass);
        const newSubjects = assignments.filter(a => a.class_group === newClass).map(a => a.subject_name);
        setSelectedSubject(newSubjects[0] || '');
    };

    const picker1 = (
        <Picker selectedValue={selectedClass} onValueChange={handleClassChange} enabled={uniqueClasses.length > 0}>
            {uniqueClasses.length > 0 ? uniqueClasses.map(c => <Picker.Item key={c} label={c} value={c} />) : <Picker.Item label="No classes..." value="" enabled={false} />}
        </Picker>
    );

    const picker2 = (
        <Picker selectedValue={selectedSubject} onValueChange={setSelectedSubject} enabled={subjectsForSelectedClass.length > 0}>
             {subjectsForSelectedClass.length > 0 ? subjectsForSelectedClass.map(s => <Picker.Item key={s} label={s} value={s} />) : <Picker.Item label="No subjects..." value="" enabled={false} />}
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
            onDateChange={setSelectedDate}
            fromDate={fromDate} setFromDate={setFromDate}
            toDate={toDate} setToDate={setToDate}
            onRangeFetch={fetchSummary}
        />
    );
};

// --- Admin View ---
const AdminAttendanceView = () => {
  const [selectedClass, setSelectedClass] = useState(CLASS_GROUPS[0]);
  const [summaryData, setSummaryData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState('overall');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [fromDate, setFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)));
  const [toDate, setToDate] = useState(new Date());

  const fetchSummary = async () => {
      if (!selectedClass) return;
      setIsLoading(true);
      try {
        let url = `/attendance/admin-summary?classGroup=${selectedClass}&viewMode=${viewMode}`;
        if (viewMode === 'daily') url += `&date=${selectedDate.toISOString().split('T')[0]}`;
        else if (viewMode === 'monthly') url += `&date=${selectedDate.toISOString().slice(0, 7)}`;
        else if (viewMode === 'yearly') url += `&targetYear=${selectedDate.getFullYear()}`;
        else if (viewMode === 'custom') url += `&startDate=${fromDate.toISOString().split('T')[0]}&endDate=${toDate.toISOString().split('T')[0]}`;

        const response = await apiClient.get(url);
        setSummaryData(response.data);
      } catch (error) {
        Alert.alert('Error', 'Could not fetch summary.');
        setSummaryData(null);
      } finally {
        setIsLoading(false);
      }
  };

  useEffect(() => {
    if (viewMode !== 'custom') fetchSummary();
  }, [selectedClass, viewMode, selectedDate]);

  if (selectedStudent) {
    return <AdminStudentDetailView student={selectedStudent} onBack={() => setSelectedStudent(null)} />;
  }

  const picker1 = (
    <Picker selectedValue={selectedClass} onValueChange={setSelectedClass}>
        {CLASS_GROUPS.map(c => <Picker.Item key={c} label={c} value={c} />)}
    </Picker>
  );

  return (
    <GenericSummaryView
        picker1={picker1}
        listData={summaryData?.studentDetails || []}
        summaryData={summaryData}
        isLoading={isLoading}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onSelectStudent={setSelectedStudent}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        fromDate={fromDate} setFromDate={setFromDate}
        toDate={toDate} setToDate={setToDate}
        onRangeFetch={fetchSummary}
    />
  );
};

// ==========================================================
// --- MODIFIED TEACHER LIVE ATTENDANCE VIEW ---
// ==========================================================
const TeacherLiveAttendanceView = ({ route, teacher }) => {
    const navigation = useNavigation();
    const { class_group, subject_name, date, period_number } = route?.params || {};
    
    const [students, setStudents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // State to toggle between "Already Marked" view and "Edit/List" view
    const [attendanceAlreadyMarked, setAttendanceAlreadyMarked] = useState(false);

    // Initial Data Fetch
    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            try {
                // 1. Check if attendance is already marked
                const statusRes = await apiClient.get('/attendance/status', {
                    params: { class_group, date, period_number, subject_name }
                });
                
                if (statusRes.data.isMarked) {
                    setAttendanceAlreadyMarked(true);
                }

                // 2. Fetch the student list (we need it regardless, to populate state)
                const sheetRes = await apiClient.get('/attendance/sheet', {
                    params: { class_group, date, period_number }
                });

                // Map response: if status is null (not marked yet), default to 'Present'
                const formattedData = sheetRes.data.map(student => ({
                    ...student,
                    status: student.status || 'Present' 
                }));
                setStudents(formattedData);

            } catch (error) {
                console.error("Init Error:", error);
                Alert.alert('Error', 'Failed to load attendance data.');
            } finally {
                setIsLoading(false);
            }
        };

        if (class_group) init();
    }, [class_group, date, period_number, subject_name]);

    // Set Status (Present / Absent)
    const setStatus = (id, newStatus) => {
        setStudents(currentStudents => 
            currentStudents.map(student => 
                student.id === id ? { ...student, status: newStatus } : student
            )
        );
    };

    // Submit Attendance
    const handleSubmit = async () => {
        if (students.length === 0) return;
        setIsSubmitting(true);
        try {
            const payload = {
                class_group,
                subject_name,
                period_number,
                date,
                teacher_id: teacher.id,
                attendanceData: students.map(s => ({ student_id: s.id, status: s.status }))
            };

            await apiClient.post('/attendance', payload);
            setAttendanceAlreadyMarked(true); // Switch to "Marked" view
        } catch (error) {
            Alert.alert('Error', 'Failed to save attendance.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color={PRIMARY_COLOR} /></View>;
    }

    // --- VIEW 1: ATTENDANCE ALREADY MARKED (Success Screen) ---
    if (attendanceAlreadyMarked) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Animatable.View animation="zoomIn" duration={600} style={{ alignItems: 'center' }}>
                    <View style={styles.successCircle}>
                        <Icon name="check" size={60} color={WHITE} />
                    </View>
                    <Text style={styles.successTitle}>Attendance Marked!</Text>
                    <Text style={styles.successSubtitle}>
                        Attendance for {formatDate(date)} has been saved successfully. You can click "Edit Attendance" to make any changes.
                    </Text>
                    
                    <TouchableOpacity 
                        style={styles.editButton} 
                        onPress={() => setAttendanceAlreadyMarked(false)}
                    >
                        <Text style={styles.editButtonText}>Edit Attendance</Text>
                    </TouchableOpacity>
                </Animatable.View>
            </SafeAreaView>
        );
    }

    // --- VIEW 2: LIST VIEW (Marking Screen) ---
    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.listHeader}>
                <Text style={styles.listHeaderTitle}>
                     {class_group} List ({students.length})
                </Text>
            </View>

            {/* Student List */}
            <FlatList
                data={students}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ paddingBottom: 100 }}
                renderItem={({ item, index }) => {
                    const isPresent = item.status === 'Present';
                    return (
                        <View style={styles.attendanceRow}>
                            {/* Left Side: Name & Info */}
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rowName}>{item.full_name}</Text>
                                <Text style={styles.rowSubText}>{item.subject || 'Maths, P.S'}</Text>
                            </View>

                            {/* Right Side: P / A Buttons */}
                            <View style={styles.actionButtonsContainer}>
                                {/* Present Button */}
                                <TouchableOpacity 
                                    style={[
                                        styles.statusCircle, 
                                        isPresent ? styles.circleGreenFilled : styles.circleGreenOutline
                                    ]}
                                    onPress={() => setStatus(item.id, 'Present')}
                                >
                                    <Text style={[
                                        styles.statusText, 
                                        isPresent ? { color: WHITE } : { color: GREEN }
                                    ]}>P</Text>
                                </TouchableOpacity>

                                {/* Absent Button */}
                                <TouchableOpacity 
                                    style={[
                                        styles.statusCircle, 
                                        !isPresent ? styles.circleRedFilled : styles.circleRedOutline
                                    ]}
                                    onPress={() => setStatus(item.id, 'Absent')}
                                >
                                    <Text style={[
                                        styles.statusText, 
                                        !isPresent ? { color: WHITE } : { color: RED }
                                    ]}>A</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                }}
            />

            {/* Footer Submit Button */}
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
};

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WHITE },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: WHITE },
  noDataText: { textAlign: 'center', marginTop: 20, color: TEXT_COLOR_MEDIUM, fontSize: 16 },
  
  // Generic Headers
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: TEXT_COLOR_DARK, textAlign: 'center' },
  headerSubtitleSmall: { fontSize: 14, color: TEXT_COLOR_MEDIUM, marginTop: 2, textAlign: 'center' },
  backButton: { position: 'absolute', left: 15, zIndex: 1, padding: 5 },
  
  // Pickers
  pickerContainer: { flexDirection: 'row', padding: 10, backgroundColor: WHITE, borderBottomColor: BORDER_COLOR, borderBottomWidth: 1, alignItems: 'center' },
  pickerWrapper: { flex: 1, marginHorizontal: 5, backgroundColor: '#F0F4F8', borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 8, height: 50, justifyContent: 'center' },
  
  // Summary Cards
  summaryContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  summaryBox: { alignItems: 'center', flex: 1, paddingVertical: 10, paddingHorizontal: 5 },
  summaryValue: { fontSize: 22, fontWeight: 'bold' },
  summaryLabel: { fontSize: 12, color: TEXT_COLOR_MEDIUM, marginTop: 5, fontWeight: '500', textAlign: 'center' },
  
  // Search Bar
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, marginHorizontal: 15, marginTop: 15, borderRadius: 8, borderWidth: 1, borderColor: BORDER_COLOR, paddingHorizontal: 10 },
  searchBar: { flex: 1, height: 45, fontSize: 16, color: TEXT_COLOR_DARK },
  searchIcon: { marginRight: 8 },
  summaryStudentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, padding: 15, marginHorizontal: 15, marginVertical: 6, borderRadius: 8, elevation: 1, shadowColor: '#999', shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  studentName: { fontSize: 16, color: TEXT_COLOR_DARK, fontWeight: '600' },
  studentDetailText: { fontSize: 12, color: TEXT_COLOR_MEDIUM, marginTop: 4 },
  percentageText: { fontSize: 20, fontWeight: 'bold' },
  
  // Toggles
  toggleContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 2, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, alignItems: 'center', flexWrap: 'wrap' },
  toggleButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginHorizontal: 3, backgroundColor: '#E0E0E0', marginBottom: 5 },
  toggleButtonActive: { backgroundColor: PRIMARY_COLOR },
  toggleButtonText: { color: TEXT_COLOR_DARK, fontWeight: '600', fontSize: 13 },
  toggleButtonTextActive: { color: WHITE },
  calendarButton: { padding: 8, marginLeft: 5, justifyContent: 'center', alignItems: 'center' },
  
  // Range
  rangeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, backgroundColor: '#f9f9f9', borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  dateInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0E0E0', padding: 10, borderRadius: 6, marginHorizontal: 5, justifyContent: 'center' },
  dateInputText: { color: TEXT_COLOR_DARK, fontSize: 13, fontWeight: '500' },
  goButton: { backgroundColor: GREEN, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, marginLeft: 5 },
  goButtonText: { color: WHITE, fontWeight: 'bold' },

  // History List
  historyTitle: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 20, marginTop: 15, marginBottom: 10, color: TEXT_COLOR_DARK },
  historyDayCard: { backgroundColor: WHITE, marginHorizontal: 15, marginVertical: 8, borderRadius: 8, elevation: 2, shadowColor: '#999', shadowOpacity: 0.1, shadowRadius: 5 },
  historyDayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  historyDate: { fontSize: 16, fontWeight: '600', color: TEXT_COLOR_DARK },
  historyStatus: { fontSize: 14, fontWeight: 'bold' },

  // ===================================
  // --- NEW STYLES FOR ATTENDANCE ---
  // ===================================

  // Success View Styles
  successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#43A047', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 22, fontWeight: 'bold', color: '#37474F', marginBottom: 10 },
  successSubtitle: { fontSize: 14, color: '#566573', textAlign: 'center', paddingHorizontal: 40, lineHeight: 20, marginBottom: 30 },
  editButton: { backgroundColor: '#008080', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 },
  editButtonText: { color: WHITE, fontSize: 16, fontWeight: 'bold' },

  // List View Styles
  listHeader: { paddingVertical: 15, paddingHorizontal: 20, backgroundColor: '#E0E0E0' },
  listHeaderTitle: { fontSize: 16, fontWeight: 'bold', color: '#37474F' },
  
  attendanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  rowName: { fontSize: 16, fontWeight: 'bold', color: '#37474F', textTransform: 'uppercase' },
  rowSubText: { fontSize: 12, color: '#78909C', marginTop: 4 },
  
  actionButtonsContainer: { flexDirection: 'row', alignItems: 'center' },
  statusCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  
  // P (Present) Styling
  circleGreenFilled: { backgroundColor: '#43A047', borderWidth: 0 },
  circleGreenOutline: { backgroundColor: WHITE, borderWidth: 1.5, borderColor: '#43A047' },
  
  // A (Absent) Styling
  circleRedFilled: { backgroundColor: '#E53935', borderWidth: 0 },
  circleRedOutline: { backgroundColor: WHITE, borderWidth: 1.5, borderColor: '#E53935' },
  
  statusText: { fontSize: 16, fontWeight: 'bold' },

  // Footer Submit
  footerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#008080' },
  submitFooterButton: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  submitFooterText: { color: WHITE, fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
});

export default AttendanceScreen;