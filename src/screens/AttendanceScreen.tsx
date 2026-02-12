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
  Dimensions,
  StatusBar,
  useColorScheme
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Animatable from 'react-native-animatable';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Constants ---
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
    warning: '#FDD835',
    blue: '#1E88E5',
    border: '#CFD8DC',
    inputBg: '#FFFFFF',
    iconBg: '#E0F2F1',
    toggleInactive: '#E0E0E0',
    white: '#FFFFFF',
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
    warning: '#FBC02D',
    blue: '#2196F3',
    border: '#333333',
    inputBg: '#2C2C2C',
    iconBg: '#333333',
    toggleInactive: '#424242',
    white: '#E0E0E0',
    shadow: '#000'
};

const CLASS_GROUPS = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

// --- Helper: Date Formatter ---
const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

// --- Responsive Summary Card ---
const SummaryCard = ({ label, value, color, delay, colors }) => (
    <Animatable.View animation="zoomIn" duration={500} delay={delay} style={[styles.summaryBox, { backgroundColor: colors.cardBg }]}>
        <Text style={[styles.summaryValue, { color }]}>{value}</Text>
        <Text style={[styles.summaryLabel, { color: colors.textSub }]} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
    </Animatable.View>
);

const HistoryDayCard = ({ item, index, colors }) => {
    const isPresent = item.status === 'Present';
    const dayStatus = isPresent ? 'Present' : 'Absent';
    const statusColor = isPresent ? colors.success : colors.error;

    return (
        <Animatable.View 
            animation="fadeInUp" 
            duration={400} 
            delay={index * 100} 
            style={[styles.historyDayCard, { backgroundColor: colors.cardBg }]}
        >
            <View style={styles.historyDayHeader}>
                <Text style={[styles.historyDate, { color: colors.textMain }]}>{formatDate(item.attendance_date)}</Text>
                <Text style={[styles.historyStatus, { color: statusColor }]}>{dayStatus}</Text>
            </View>
        </Animatable.View>
    );
};

// --- Main Router ---
const AttendanceScreen = ({ route }) => {
  const { user } = useAuth();
  // We handle theme inside each sub-component, or we could pass it down. 
  // Since sub-components are distinct, we will handle it inside them for cleaner props.
  
  if (!user) return (
      <View style={[styles.loaderContainer, { backgroundColor: '#F2F5F8' }]}>
          <Text style={{color: '#546E7A'}}>User not found.</Text>
      </View>
  );

  switch (user.role) {
    case 'teacher':
      return route?.params ? <TeacherLiveAttendanceView route={route} teacher={user} /> : <TeacherSummaryView teacher={user} />;
    case 'student':
      return <StudentAttendanceView student={user} />;
    case 'admin':
      return <AdminAttendanceView />;
    default:
      return (
          <View style={[styles.loaderContainer, { backgroundColor: '#F2F5F8' }]}>
              <Text style={{color: '#546E7A'}}>No attendance view available.</Text>
          </View>
      );
  }
};

// --- Student View (UPDATED with No Record Animation) ---
const GenericStudentHistoryView = ({ studentId, headerTitle, onBack }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const colors = isDark ? DarkColors : LightColors;

    const [viewMode, setViewMode] = useState('daily');
    const [data, setData] = useState({ summary: {}, history: [] });
    const [isLoading, setIsLoading] = useState(true);
    
    // Date States
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [fromDate, setFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)));
    const [toDate, setToDate] = useState(new Date());

    // Pickers
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
        } catch (error) {
            // Silent catch
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (viewMode !== 'custom') fetchHistory();
    }, [studentId, viewMode, selectedDate]);

    const onMainDateChange = (event, date) => {
        setShowMainPicker(Platform.OS === 'ios');
        if (date) setSelectedDate(date);
    };

    const percentage = useMemo(() => {
        if (!data.summary?.total_days || data.summary.total_days === 0) return '0.0';
        return ((data.summary.present_days / data.summary.total_days) * 100).toFixed(1);
    }, [data.summary]);

    let subTitle = '';
    if (viewMode === 'daily') subTitle = `Date: ${formatDate(selectedDate)}`;
    else if (viewMode === 'monthly') subTitle = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    else if (viewMode === 'yearly') subTitle = `Year: ${selectedDate.getFullYear()}`;
    else subTitle = 'Custom Range';

    // CHECK FOR NO RECORD CONDITION (Same as Teacher View)
    const isDailyNoRecord = viewMode === 'daily' && (!data.history || data.history.length === 0);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar backgroundColor={colors.background} barStyle={isDark ? 'light-content' : 'dark-content'} />
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: colors.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                <View style={styles.headerLeft}>
                    {onBack && (
                        <TouchableOpacity onPress={onBack} style={{marginRight: 10, padding: 4}}>
                            <MaterialIcons name="arrow-back" size={24} color={colors.textMain} />
                        </TouchableOpacity>
                    )}
                    <View style={[styles.headerIconContainer, { backgroundColor: colors.iconBg }]}>
                        <MaterialIcons name="history" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: colors.textMain }]}>{headerTitle}</Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSub }]}>{subTitle}</Text>
                    </View>
                </View>
                
                {viewMode !== 'custom' && (
                    <TouchableOpacity style={[styles.headerActionBtn, { borderColor: colors.primary, backgroundColor: isDark ? '#333' : '#f0fdfa' }]} onPress={() => setShowMainPicker(true)}>
                        <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* TABS */}
            <View style={styles.toggleContainer}>
                {['daily', 'monthly', 'yearly', 'custom'].map(mode => (
                    <TouchableOpacity 
                        key={mode}
                        style={[styles.toggleButton, { backgroundColor: viewMode === mode ? colors.primary : colors.toggleInactive }]} 
                        onPress={() => setViewMode(mode)}
                    >
                        <Text style={[styles.toggleButtonText, { color: viewMode === mode ? colors.white : colors.textMain }]}>
                            {capitalize(mode)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Range Inputs */}
            {viewMode === 'custom' && (
                <Animatable.View animation="fadeIn" duration={300} style={styles.rangeContainer}>
                    <TouchableOpacity style={[styles.dateInputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={() => setShowFromPicker(true)}>
                        <Text style={[styles.dateInputText, { color: colors.textMain }]}>{formatDate(fromDate)}</Text>
                    </TouchableOpacity>
                    <Icon name="arrow-right" size={20} color={colors.textSub} />
                    <TouchableOpacity style={[styles.dateInputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={() => setShowToPicker(true)}>
                        <Text style={[styles.dateInputText, { color: colors.textMain }]}>{formatDate(toDate)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.goButton, { backgroundColor: colors.success }]} onPress={fetchHistory}>
                        <Text style={styles.goButtonText}>Go</Text>
                    </TouchableOpacity>
                </Animatable.View>
            )}

            {showMainPicker && <DateTimePicker value={selectedDate} mode="date" onChange={onMainDateChange} />}
            {showFromPicker && <DateTimePicker value={fromDate} mode="date" onChange={(e, d) => { setShowFromPicker(Platform.OS === 'ios'); if(d) setFromDate(d); }} />}
            {showToPicker && <DateTimePicker value={toDate} mode="date" onChange={(e, d) => { setShowToPicker(Platform.OS === 'ios'); if(d) setToDate(d); }} />}

            {isLoading ? <ActivityIndicator style={styles.loaderContainer} size="large" color={colors.primary} /> : (
                <FlatList
                    data={data.history}
                    keyExtractor={(item) => item.attendance_date}
                    ListHeaderComponent={
                        <>
                            {isDailyNoRecord ? (
                                <Animatable.View animation="zoomIn" duration={400} style={[styles.noRecordCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                                    <Icon name="help-circle-outline" size={70} color={colors.textSub} style={{marginBottom: 10}} />
                                    <Text style={[styles.noRecordTitle, { color: colors.textSub }]}>NO RECORD</Text>
                                    <Text style={[styles.noRecordDate, { color: colors.textSub }]}>{formatDate(selectedDate)}</Text>
                                </Animatable.View>
                            ) : (
                                <View style={[styles.summaryContainer, { backgroundColor: colors.cardBg }]}>
                                    <SummaryCard label="Overall" value={`${percentage}%`} color={colors.blue} delay={100} colors={colors} />
                                    <SummaryCard label="Present" value={data.summary.present_days || 0} color={colors.success} delay={200} colors={colors} />
                                    <SummaryCard label="Absent" value={data.summary.absent_days || 0} color={colors.error} delay={300} colors={colors} />
                                </View>
                            )}
                        </>
                    }
                    renderItem={({ item, index }) => <HistoryDayCard item={item} index={index} colors={colors} />}
                    ListEmptyComponent={
                        <View style={{ marginTop: 20, alignItems: 'center' }}>
                             <Text style={[styles.noDataText, { color: colors.textSub }]}>No records found.</Text>
                        </View>
                    }
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}
        </SafeAreaView>
    );
};

const StudentAttendanceView = ({ student }) => <GenericStudentHistoryView studentId={student.id} headerTitle="My Attendance" />;
const AdminStudentDetailView = ({ student, onBack }) => <GenericStudentHistoryView studentId={student.student_id} headerTitle={student.full_name} onBack={onBack} />;

// --- Generic Summary View (Teacher & Admin) ---
const GenericSummaryView = ({
    picker1, picker2, listData,
    summaryData, isLoading, viewMode, setViewMode, 
    selectedDate, onDateChange, 
    fromDate, setFromDate, 
    toDate, setToDate,     
    onRangeFetch,          
    onSelectStudent
}) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const colors = isDark ? DarkColors : LightColors;

    const summary = summaryData?.overallSummary ?? {};
    
    const [showMainPicker, setShowMainPicker] = useState(false);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredListData = useMemo(() => {
        if (!listData) return [];
        if (!searchQuery) return listData;
        return listData.filter(student => student.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [listData, searchQuery]);

    const handleDateChange = (event, date) => {
        setShowMainPicker(Platform.OS === 'ios');
        if (date) onDateChange(date);
    };

    const valOverall = viewMode === 'daily' 
        ? `${Number(summary.overall_percentage ?? 0).toFixed(1)}%` 
        : `${Number(summary.overall_percentage ?? 0).toFixed(1)}%`;
    
    const valGreen = viewMode === 'daily' 
        ? (summary.students_present ?? 0) 
        : `${Number(summary.avg_daily_attendance ?? 0).toFixed(1)}%`;
        
    const labelGreen = viewMode === 'daily' ? 'Present' : 'Avg Daily';

    const valRed = viewMode === 'daily' 
        ? (summary.students_absent ?? 0) 
        : (summary.students_below_threshold ?? 0);
        
    const labelRed = viewMode === 'daily' ? 'Absent' : '< 75%';

    let subTitle = '';
    if (viewMode === 'daily') subTitle = `Date: ${formatDate(selectedDate)}`;
    else if (viewMode === 'monthly') subTitle = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    else if (viewMode === 'yearly') subTitle = `Year: ${selectedDate.getFullYear()}`;
    else subTitle = 'Custom Range';

    // CHECK FOR NO RECORD CONDITION IN DAILY MODE
    const isDailyNoRecord = viewMode === 'daily' && (!listData || listData.length === 0);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar backgroundColor={colors.background} barStyle={isDark ? 'light-content' : 'dark-content'} />

            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: colors.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: colors.iconBg }]}>
                        <MaterialIcons name="assessment" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: colors.textMain }]}>Attendance Report</Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSub }]}>{subTitle}</Text>
                    </View>
                </View>
                {viewMode !== 'custom' && (
                    <TouchableOpacity style={[styles.headerActionBtn, { borderColor: colors.primary, backgroundColor: isDark ? '#333' : '#f0fdfa' }]} onPress={() => setShowMainPicker(true)}>
                        <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Pickers & Filters */}
            <View style={styles.pickerContainer}>
                <View style={[styles.pickerWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>{picker1}</View>
                {picker2 && <View style={[styles.pickerWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>{picker2}</View>} 
            </View>

            <View style={styles.toggleContainer}>
                {['daily', 'monthly', 'yearly', 'custom'].map(mode => (
                    <TouchableOpacity 
                        key={mode}
                        style={[styles.toggleButton, { backgroundColor: viewMode === mode ? colors.primary : colors.toggleInactive }]} 
                        onPress={() => setViewMode(mode)}
                    >
                        <Text style={[styles.toggleButtonText, { color: viewMode === mode ? colors.white : colors.textMain }]}>
                            {capitalize(mode)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Range Inputs */}
            {viewMode === 'custom' && (
                <Animatable.View animation="fadeIn" duration={300} style={styles.rangeContainer}>
                    <TouchableOpacity style={[styles.dateInputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={() => setShowFromPicker(true)}>
                        <Text style={[styles.dateInputText, { color: colors.textMain }]}>{formatDate(fromDate)}</Text>
                    </TouchableOpacity>
                    <Icon name="arrow-right" size={20} color={colors.textSub} />
                    <TouchableOpacity style={[styles.dateInputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={() => setShowToPicker(true)}>
                        <Text style={[styles.dateInputText, { color: colors.textMain }]}>{formatDate(toDate)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.goButton, { backgroundColor: colors.success }]} onPress={onRangeFetch}>
                        <Text style={styles.goButtonText}>Go</Text>
                    </TouchableOpacity>
                </Animatable.View>
            )}

            {showMainPicker && <DateTimePicker value={selectedDate} mode="date" onChange={handleDateChange} />}
            {showFromPicker && <DateTimePicker value={fromDate} mode="date" onChange={(e, d) => { setShowFromPicker(Platform.OS === 'ios'); if(d) setFromDate(d); }} />}
            {showToPicker && <DateTimePicker value={toDate} mode="date" onChange={(e, d) => { setShowToPicker(Platform.OS === 'ios'); if(d) setToDate(d); }} />}

            {isLoading ? <ActivityIndicator size="large" color={colors.primary} style={styles.loaderContainer} /> : (
                <FlatList
                    data={filteredListData}
                    keyExtractor={(item) => item.student_id.toString()}
                    ListHeaderComponent={
                        <>
                            {isDailyNoRecord ? (
                                <Animatable.View animation="zoomIn" duration={400} style={[styles.noRecordCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                                    <Icon name="help-circle-outline" size={70} color={colors.textSub} style={{marginBottom: 10}} />
                                    <Text style={[styles.noRecordTitle, { color: colors.textSub }]}>NO RECORD</Text>
                                    <Text style={[styles.noRecordDate, { color: colors.textSub }]}>{formatDate(selectedDate)}</Text>
                                </Animatable.View>
                            ) : (
                                <>
                                    <View style={[styles.summaryContainer, { backgroundColor: colors.cardBg }]}>
                                        <SummaryCard label="Attendance %" value={valOverall} color={colors.blue} delay={100} colors={colors} />
                                        <SummaryCard label={labelGreen} value={valGreen} color={colors.success} delay={200} colors={colors} />
                                        <SummaryCard label={labelRed} value={valRed} color={colors.error} delay={300} colors={colors} />
                                    </View>
                                    
                                    <View style={[styles.searchBarContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                                        <Icon name="magnify" size={20} color={colors.textSub} style={styles.searchIcon} />
                                        <TextInput
                                            style={[styles.searchBar, { color: colors.textMain }]}
                                            placeholder="Search student..."
                                            value={searchQuery}
                                            onChangeText={(text) => {
                                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                setSearchQuery(text);
                                            }}
                                            placeholderTextColor={colors.textSub}
                                        />
                                    </View>
                                </>
                            )}
                        </>
                    }
                    renderItem={({ item, index }) => {
                        const studentPercentage = item.total_days > 0 ? (item.present_days / item.total_days) * 100 : 0;
                        const percentageColor = studentPercentage >= 75 ? colors.success : studentPercentage >= 50 ? colors.warning : colors.error;
                        return (
                            <Animatable.View animation="fadeInUp" duration={400} delay={index * 50}>
                                <TouchableOpacity onPress={() => onSelectStudent && onSelectStudent(item)}>
                                    <View style={[styles.summaryStudentRow, { backgroundColor: colors.cardBg }]}>
                                        <View style={{flex: 1}}>
                                            <Text style={[styles.studentName, { color: colors.textMain }]}>{item.full_name}</Text>
                                            <Text style={[styles.studentDetailText, { color: colors.textSub }]}>
                                                Roll: {item.roll_no || '-'} | {item.present_days}/{item.total_days} Days
                                            </Text>
                                        </View>
                                        <View style={[styles.percentageBadge, { borderColor: percentageColor }]}>
                                            <Text style={[styles.percentageText, { color: percentageColor }]}>{studentPercentage.toFixed(0)}%</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            </Animatable.View>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={{ marginTop: 20, alignItems: 'center' }}>
                             <Text style={[styles.noDataText, { color: colors.textSub }]}>No records found.</Text>
                        </View>
                    }
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}
        </SafeAreaView>
    );
};

// --- Teacher View Wrapper ---
const TeacherSummaryView = ({ teacher }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const colors = isDark ? DarkColors : LightColors;

    const [assignments, setAssignments] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [summaryData, setSummaryData] = useState(null); 
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState('daily');
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
                setIsLoading(false);
            }
        };
        fetchAssignments();
    }, [teacher.id]);

    const fetchSummary = async () => {
        if (!teacher?.id || !selectedClass || !selectedSubject) {
            setSummaryData({ overallSummary: {}, studentDetails: [] });
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
            setSummaryData({ overallSummary: {}, studentDetails: [] });
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
        <Picker selectedValue={selectedClass} onValueChange={handleClassChange} enabled={uniqueClasses.length > 0} style={[styles.picker, {color: colors.textMain}]} dropdownIconColor={colors.textMain}>
            {uniqueClasses.length > 0 ? uniqueClasses.map(c => <Picker.Item key={c} label={c} value={c} style={{fontSize: 14}} />) : <Picker.Item label="No classes" value="" enabled={false} />}
        </Picker>
    );

    const picker2 = (
        <Picker selectedValue={selectedSubject} onValueChange={setSelectedSubject} enabled={subjectsForSelectedClass.length > 0} style={[styles.picker, {color: colors.textMain}]} dropdownIconColor={colors.textMain}>
             {subjectsForSelectedClass.length > 0 ? subjectsForSelectedClass.map(s => <Picker.Item key={s} label={s} value={s} style={{fontSize: 14}} />) : <Picker.Item label="No subjects" value="" enabled={false} />}
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

// --- Admin View Wrapper ---
const AdminAttendanceView = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? DarkColors : LightColors;

  const [selectedClass, setSelectedClass] = useState(CLASS_GROUPS[0]);
  const [summaryData, setSummaryData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState('daily');
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
        setSummaryData({ overallSummary: {}, studentDetails: [] });
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
    <Picker selectedValue={selectedClass} onValueChange={setSelectedClass} style={[styles.picker, {color: colors.textMain}]} dropdownIconColor={colors.textMain}>
        {CLASS_GROUPS.map(c => <Picker.Item key={c} label={c} value={c} style={{fontSize: 14}} />)}
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

// --- Teacher Live Attendance View (For Redirection) ---
const TeacherLiveAttendanceView = ({ route, teacher }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const colors = isDark ? DarkColors : LightColors;

    const navigation = useNavigation();
    const { class_group, subject_name, date, period_number } = route?.params || {};
    
    const [students, setStudents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attendanceAlreadyMarked, setAttendanceAlreadyMarked] = useState(false);

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            try {
                const statusRes = await apiClient.get('/attendance/status', {
                    params: { class_group, date, period_number, subject_name }
                });
                if (statusRes.data.isMarked) setAttendanceAlreadyMarked(true);

                const sheetRes = await apiClient.get('/attendance/sheet', {
                    params: { class_group, date, period_number }
                });
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

    const setStatus = (id, newStatus) => {
        setStudents(currentStudents => 
            currentStudents.map(student => 
                student.id === id ? { ...student, status: newStatus } : student
            )
        );
    };

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
            setAttendanceAlreadyMarked(true);
        } catch (error) {
            Alert.alert('Error', 'Failed to save attendance.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <View style={[styles.loaderContainer, {backgroundColor: colors.background}]}><ActivityIndicator size="large" color={colors.primary} /></View>;

    if (attendanceAlreadyMarked) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }]}>
                <Animatable.View animation="zoomIn" duration={600} style={{ alignItems: 'center' }}>
                    <View style={styles.successCircle}>
                        <Icon name="check" size={60} color={colors.white} />
                    </View>
                    <Text style={[styles.successTitle, { color: colors.textMain }]}>Done!</Text>
                    <Text style={[styles.successSubtitle, { color: colors.textSub }]}>Attendance for {formatDate(date)} saved.</Text>
                    <TouchableOpacity style={styles.editButton} onPress={() => setAttendanceAlreadyMarked(false)}>
                        <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                </Animatable.View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header Card */}
            <View style={[styles.headerCard, { backgroundColor: colors.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: colors.iconBg }]}>
                        <MaterialIcons name="edit-note" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: colors.textMain }]}>{class_group}</Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSub }]}>Live Attendance</Text>
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
                        <View style={[styles.summaryStudentRow, { backgroundColor: colors.cardBg }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.studentName, { color: colors.textMain }]}>{item.full_name}</Text>
                                <Text style={[styles.studentDetailText, { color: colors.textSub }]}>{item.subject || 'Subject'}</Text>
                            </View>
                            <View style={{flexDirection: 'row', gap: 10}}>
                                <TouchableOpacity style={[styles.statusBtn, isPresent ? { backgroundColor: colors.success, borderColor: colors.success } : { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={() => setStatus(item.id, 'Present')}>
                                    <Text style={[styles.statusText, isPresent ? {color: '#fff'} : {color: colors.success}]}>P</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.statusBtn, !isPresent ? { backgroundColor: colors.error, borderColor: colors.error } : { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={() => setStatus(item.id, 'Absent')}>
                                    <Text style={[styles.statusText, !isPresent ? {color: '#fff'} : {color: colors.error}]}>A</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                }}
            />

            <View style={styles.footerContainer}>
                <TouchableOpacity style={styles.submitFooterButton} onPress={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitFooterText}>SUBMIT</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    ); 
};

// --- Styles ---
const styles = StyleSheet.create({
  container: { 
      flex: 1
  },
  loaderContainer: { 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center'
  },
  noDataText: { 
      textAlign: 'center', 
      marginTop: 20, 
      fontSize: 16 
  },
  
  // --- HEADER CARD STYLES ---
  headerCard: {
      paddingHorizontal: 15,
      paddingVertical: 12,
      width: '95%', 
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 10,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      elevation: 2,
      shadowOffset: { width: 0, height: 1 },
  },
  headerLeft: { 
      flexDirection: 'row', 
      alignItems: 'center',
      flex: 1 
  },
  headerIconContainer: {
      borderRadius: 25,
      width: 45,
      height: 45,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
  },
  headerTextContainer: { 
      justifyContent: 'center',
      flex: 1
  },
  headerTitle: { 
      fontSize: 18, 
      fontWeight: 'bold', 
  },
  headerSubtitle: { 
      fontSize: 12, 
  },
  headerActionBtn: {
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
  },

  // Pickers & Filters
  pickerContainer: { 
      flexDirection: 'row', 
      paddingHorizontal: '2.5%', 
      marginBottom: 5, 
      width: '100%',
      justifyContent: 'space-between'
  },
  pickerWrapper: { 
      flex: 1, 
      borderWidth: 1, 
      borderRadius: 8, 
      height: 45, 
      justifyContent: 'center',
      marginHorizontal: 2 
  },
  picker: { 
      width: '100%', 
  },
  
  // Summary Cards
  summaryContainer: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      paddingVertical: 15, 
      width: '95%',
      alignSelf: 'center',
      marginBottom: 10, 
      borderRadius: 12, 
      elevation: 2,
      paddingHorizontal: 5
  },
  summaryBox: { 
      alignItems: 'center', 
      flex: 1,
      paddingHorizontal: 2
  },
  summaryValue: { 
      fontSize: 18, 
      fontWeight: 'bold' 
  },
  summaryLabel: { 
      fontSize: 11, 
      marginTop: 4, 
      fontWeight: '500', 
      textAlign: 'center' 
  },
  
  // Search Bar
  searchBarContainer: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      width: '95%',
      alignSelf: 'center',
      marginBottom: 10, 
      borderRadius: 8, 
      borderWidth: 1, 
      paddingHorizontal: 10, 
      height: 45 
  },
  searchBar: { 
      flex: 1, 
      fontSize: 14, 
  },
  searchIcon: { 
      marginRight: 8 
  },

  // List Rows
  summaryStudentRow: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      padding: 15, 
      width: '95%',
      alignSelf: 'center',
      marginVertical: 5, 
      borderRadius: 10, 
      elevation: 1 
  },
  studentName: { 
      fontSize: 15, 
      fontWeight: '600' 
  },
  studentDetailText: { 
      fontSize: 12, 
      marginTop: 2 
  },
  percentageBadge: { 
      paddingHorizontal: 8, 
      paddingVertical: 2, 
      borderRadius: 12, 
      borderWidth: 1,
      minWidth: 50,
      alignItems: 'center'
  },
  percentageText: { 
      fontSize: 12, 
      fontWeight: 'bold' 
  },
  
  // Toggles
  toggleContainer: { 
      flexDirection: 'row', 
      justifyContent: 'center', 
      paddingVertical: 5, 
      marginBottom: 10,
      flexWrap: 'wrap'
  },
  toggleButton: { 
      paddingVertical: 6, 
      paddingHorizontal: 12, 
      borderRadius: 20, 
      marginHorizontal: 3,
      marginVertical: 2, 
  },
  toggleButtonText: { 
      fontWeight: '600', 
      fontSize: 12 
  },
  
  // Range
  rangeContainer: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'center', 
      width: '95%',
      alignSelf: 'center',
      marginBottom: 10 
  },
  dateInputBox: { 
      flex: 1, 
      flexDirection: 'row', 
      alignItems: 'center', 
      padding: 8, 
      borderRadius: 6, 
      marginHorizontal: 5, 
      borderWidth: 1, 
      justifyContent: 'center' 
  },
  dateInputText: { 
      fontSize: 12, 
      fontWeight: '500' 
  },
  goButton: { 
      paddingVertical: 8, 
      paddingHorizontal: 15, 
      borderRadius: 6, 
      marginLeft: 5 
  },
  goButtonText: { 
      color: '#FFF', 
      fontWeight: 'bold', 
      fontSize: 12 
  },

  // History List
  historyDayCard: { 
      width: '95%',
      alignSelf: 'center',
      marginVertical: 6, 
      borderRadius: 8, 
      padding: 15, 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      elevation: 1 
  },
  historyDate: { 
      fontSize: 14, 
      fontWeight: '600', 
  },
  historyStatus: { 
      fontSize: 14, 
      fontWeight: 'bold' 
  },

  // --- NO RECORD CARD STYLES ---
  noRecordCard: {
      width: '95%',
      alignSelf: 'center',
      paddingVertical: 40,
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      marginTop: 15,
      marginBottom: 5
  },
  noRecordTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      marginBottom: 5
  },
  noRecordDate: {
      fontSize: 16,
      fontWeight: '500'
  },

  // Success View
  successCircle: { 
      width: 80, 
      height: 80, 
      borderRadius: 40, 
      backgroundColor: '#43A047', 
      justifyContent: 'center', 
      alignItems: 'center', 
      marginBottom: 20 
  },
  successTitle: { 
      fontSize: 20, 
      fontWeight: 'bold', 
      marginBottom: 8 
  },
  successSubtitle: { 
      fontSize: 14, 
      textAlign: 'center', 
      marginBottom: 25 
  },
  editButton: { 
      backgroundColor: '#008080', 
      paddingVertical: 10, 
      paddingHorizontal: 30, 
      borderRadius: 8 
  },
  editButtonText: { 
      color: '#FFF', 
      fontSize: 14, 
      fontWeight: 'bold' 
  },

  // Live Marking Buttons
  statusBtn: { 
      width: 36, 
      height: 36, 
      borderRadius: 8, 
      justifyContent: 'center', 
      alignItems: 'center', 
      borderWidth: 1 
  },
  statusText: { fontSize: 14, fontWeight: 'bold' },

  // Footer
  footerContainer: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  submitFooterButton: { backgroundColor: '#008080', paddingVertical: 15, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  submitFooterText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
});

export default AttendanceScreen;