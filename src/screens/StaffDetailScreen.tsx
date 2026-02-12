/**
 * File: src/screens/staff/StaffDetailScreen.js
 * Purpose: Staff Details with updated UI, Performance Analytics, and Theme Support.
 */
import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, Image,
    TouchableOpacity, Modal, Pressable, Platform, UIManager, LayoutAnimation, Alert, Animated, Easing, SafeAreaView, Dimensions, useColorScheme, StatusBar
} from 'react-native';
import apiClient from '../api/client';
import { SERVER_URL } from '../../apiConfig';
// Assuming TimetableScreen exists in the same directory
import TimetableScreen from './TimetableScreen'; 
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

// --- THEME DEFINITIONS ---
const LightColors = {
    primary: '#008080',     // Teal 
    background: '#F2F5F8',  // Light Grey Blue
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    success: '#43A047',     // Green
    average: '#1E88E5',     // Blue
    poor: '#E53935',        // Red
    track: '#ECEFF1',
    headerIconBg: '#E0F2F1',
    inputBg: '#FAFAFA',
    modalOverlay: 'rgba(0,0,0,0.5)',
    iconColor: '#546E7A'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    success: '#66BB6A',
    average: '#42A5F5',
    poor: '#EF5350',
    track: '#2C2C2C',
    headerIconBg: '#333333',
    inputBg: '#2C2C2C',
    modalOverlay: 'rgba(255,255,255,0.1)',
    iconColor: '#B0B0B0'
};

// --- HELPERS ---
const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

// Rule: 94.5% -> 94%, 94.6% -> 95%
const getRoundedPercentage = (value) => {
    const floatVal = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(floatVal)) return 0;
    
    const decimalPart = floatVal - Math.floor(floatVal);
    if (decimalPart > 0.5) {
        return Math.ceil(floatVal);
    } else {
        return Math.floor(floatVal);
    }
};

const getStatusColor = (percentage, colors) => {
    const val = getRoundedPercentage(percentage);
    if (val >= 85) return colors.success; 
    if (val >= 50) return colors.average; 
    return colors.poor; 
};

// --- COMPONENT: ANIMATED BAR ---
const AnimatedBar = ({ percentage, marks, label, color, height = 200, colors }) => {
    const animatedHeight = useRef(new Animated.Value(0)).current;
    const displayPercentage = getRoundedPercentage(percentage);

    useEffect(() => {
        Animated.timing(animatedHeight, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: false,
            easing: Easing.out(Easing.poly(4)),
        }).start();
    }, [percentage]);

    const heightStyle = animatedHeight.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', `${displayPercentage}%`]
    });

    return (
        <View style={[styles.barWrapper, { height: height }]}>
            <Text style={[styles.barLabelTop, { color: colors.textMain }]}>{displayPercentage}%</Text>
            <View style={[styles.barBackground, { backgroundColor: colors.track }]}>
                <Animated.View style={[styles.barFill, { height: heightStyle, backgroundColor: color }]} />
                <View style={styles.barTextContainer}>
                    <Text style={styles.barInnerText} numberOfLines={1}>{marks}</Text>
                </View>
            </View>
            <Text style={[styles.barLabelBottom, { color: colors.textMain }]} numberOfLines={1}>{label}</Text>
        </View>
    );
};

// --- SUB-COMPONENTS ---
const SummaryCard = ({ label, value, color, colors, width = '23%' }) => (
    <Animatable.View animation="zoomIn" duration={500} style={[styles.attSummaryBox, { width: width, borderColor: colors.border }]}>
        <Text style={[styles.attSummaryValue, { color }]}>{value}</Text>
        <Text style={[styles.attSummaryLabel, { color: colors.textSub }]}>{label}</Text>
    </Animatable.View>
);

const DailyStatusCard = ({ record, date, colors }) => {
    const hasRecord = !!record;
    const status = hasRecord ? record.status : null;
    let bgColor = colors.border; 
    let iconName = "help-circle-outline"; 
    let statusText = "No Record";

    if (status === 'P') { bgColor = colors.success; iconName = "check-circle-outline"; statusText = "Present"; }
    else if (status === 'A') { bgColor = colors.poor; iconName = "close-circle-outline"; statusText = "Absent"; }
    else if (status === 'L') { bgColor = colors.average; iconName = "clock-alert-outline"; statusText = "Late / Leave"; }

    return (
        <Animatable.View animation="flipInX" duration={600} style={[styles.dailyCard, { backgroundColor: hasRecord ? bgColor : colors.cardBg, borderColor: bgColor }]}>
            <Icon name={iconName} size={50} color={hasRecord ? '#FFFFFF' : bgColor} />
            <Text style={[styles.dailyStatusText, { color: hasRecord ? '#FFFFFF' : bgColor }]}>{statusText.toUpperCase()}</Text>
            <Text style={[styles.dailyDateText, { color: hasRecord ? 'rgba(255,255,255,0.9)' : colors.textSub }]}>{formatDate(date)}</Text>
        </Animatable.View>
    );
};

// --- MAIN COMPONENT ---
const StaffDetailScreen = ({ route, navigation }) => {
    const { staffId } = route.params;
    
    // Theme Hook
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const [staffDetails, setStaffDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isViewerVisible, setViewerVisible] = useState(false);

    // Collapsibles
    const [isProfessionalExpanded, setIsProfessionalExpanded] = useState(false);
    const [isTimetableExpanded, setIsTimetableExpanded] = useState(false);
    const [isPerformanceExpanded, setIsPerformanceExpanded] = useState(false);
    const [isAttendanceExpanded, setIsAttendanceExpanded] = useState(false);

    // Performance Data
    const [performanceDetails, setPerformanceDetails] = useState([]);
    const [performanceLoading, setPerformanceLoading] = useState(false);
    
    // Graph Modal
    const [isGraphVisible, setIsGraphVisible] = useState(false);
    const [graphData, setGraphData] = useState(null);

    // Attendance
    const [attendanceReport, setAttendanceReport] = useState(null);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [attendanceViewMode, setAttendanceViewMode] = useState('daily');
    const [attSelectedDate, setAttSelectedDate] = useState(new Date());
    const [attFromDate, setAttFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)));
    const [attToDate, setAttToDate] = useState(new Date());

    const [showMainPicker, setShowMainPicker] = useState(false);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);

    const scrollViewRef = useRef(null);

    // Hide default header to use custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            try {
                const response = await apiClient.get(`/staff/${staffId}`);
                setStaffDetails(response.data);
            } catch (error) {
                console.error('Error fetching staff details:', error);
                Alert.alert("Error", "Failed to load staff details.");
            } finally {
                setLoading(false);
            }
        };
        if (staffId) fetchDetails();
    }, [staffId]);
    
    const scrollToBottom = () => { setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150); };

    // Toggles
    const handleProfessionalToggle = () => { if (!isProfessionalExpanded) scrollToBottom(); setIsProfessionalExpanded(p => !p); };
    const handleTimetableToggle = () => { if (!isTimetableExpanded) scrollToBottom(); setIsTimetableExpanded(p => !p); };

    const handlePerformanceToggle = async () => {
        if (!isPerformanceExpanded) {
            setPerformanceLoading(true);
            try {
                // FIXED: Removed academicYear from URL to match backend route
                const response = await apiClient.get(`/performance/teacher/${staffId}`);
                setPerformanceDetails(response.data || []);
            } catch (error) {
                console.error("Failed to fetch performance data:", error);
                // Optionally set empty array on error to show 'No Data' instead of spinning forever
                setPerformanceDetails([]);
            } finally {
                setPerformanceLoading(false);
            }
            scrollToBottom();
        }
        setIsPerformanceExpanded(p => !p);
    };

    const handleAttendanceToggle = () => {
        if (!isAttendanceExpanded) { fetchAttendanceReport(); scrollToBottom(); }
        setIsAttendanceExpanded(p => !p);
    };

    const handleOpenGraph = (title, exams) => {
        setGraphData({ title, exams });
        setIsGraphVisible(true);
    };

    const handleMenuPress = () => {
        Alert.alert(
            "Staff Options",
            `Manage ${staffDetails?.full_name || 'Staff'}`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Edit Profile", onPress: () => console.log("Edit Pressed") }, 
                { text: "Reset Password", onPress: () => console.log("Reset Password Pressed") }
            ]
        );
    };

    // Attendance Fetcher
    const fetchAttendanceReport = useCallback(async () => {
        if (!staffId) return;
        setAttendanceLoading(true);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const params = { period: attendanceViewMode };
        if (attendanceViewMode === 'daily') params.targetDate = attSelectedDate.toISOString().slice(0, 10);
        else if (attendanceViewMode === 'monthly') params.targetMonth = attSelectedDate.toISOString().slice(0, 7);
        else if (attendanceViewMode === 'yearly') params.targetYear = attSelectedDate.getFullYear().toString();
        else if (attendanceViewMode === 'custom') { params.startDate = attFromDate.toISOString().slice(0, 10); params.endDate = attToDate.toISOString().slice(0, 10); }

        try {
            const response = await apiClient.get(`/teacher-attendance/report/${staffId}`, { params });
            setAttendanceReport(response.data);
        } catch (error) { setAttendanceReport(null); } finally { setAttendanceLoading(false); }
    }, [staffId, attendanceViewMode, attSelectedDate, attFromDate, attToDate]);

    useEffect(() => { if (isAttendanceExpanded && attendanceViewMode !== 'custom') fetchAttendanceReport(); }, [attendanceViewMode, attSelectedDate, isAttendanceExpanded]);

    const onMainDateChange = (event, date) => { setShowMainPicker(Platform.OS === 'ios'); if (date) setAttSelectedDate(date); };
    const onFromDateChange = (event, date) => { setShowFromPicker(Platform.OS === 'ios'); if (date) setAttFromDate(date); };
    const onToDateChange = (event, date) => { setShowToPicker(Platform.OS === 'ios'); if (date) setAttToDate(date); };

    // Calculations
    const overallStats = useMemo(() => {
        if (!performanceDetails || performanceDetails.length === 0) return { totalObtained: 0, totalPossible: 0, percentage: 0 };
        let totalObtained = 0; let totalPossible = 0;
        performanceDetails.forEach(item => { 
            totalObtained += parseFloat(item.total_marks) || 0; 
            totalPossible += parseFloat(item.max_possible_marks) || 0; 
        });
        const percentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;
        return { totalObtained, totalPossible, percentage };
    }, [performanceDetails]);

    const attendanceSummary = useMemo(() => attendanceReport?.stats || { overallPercentage: '0.0', daysPresent: 0, daysAbsent: 0, totalDays: 0 }, [attendanceReport]);
    const dailyRecord = (attendanceViewMode === 'daily' && attendanceReport?.detailedHistory?.length) ? attendanceReport.detailedHistory.find(r => r.date === attSelectedDate.toISOString().slice(0, 10)) || attendanceReport.detailedHistory[0] : null;

    const DetailRow = ({ label, value }) => (
        <View style={[styles.detailRow, { borderBottomColor: COLORS.border }]}>
            <Text style={[styles.detailLabel, { color: COLORS.textSub }]}>{label}</Text>
            <Text style={[styles.detailValue, { color: COLORS.textMain }]}>{value || 'Not Provided'}</Text>
        </View>
    );

    if (loading) return <View style={[styles.loaderContainer, { backgroundColor: COLORS.background }]}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    if (!staffDetails) return <View style={[styles.loaderContainer, { backgroundColor: COLORS.background }]}><Text style={{color: COLORS.textMain}}>Could not load staff details.</Text></View>;

    const imageUrl = staffDetails.profile_image_url ? `${SERVER_URL}${staffDetails.profile_image_url}` : null;
    const displayRole = staffDetails.role === 'admin' ? staffDetails.class_group : staffDetails.role;
    const subjectsDisplay = staffDetails.subjects_taught && Array.isArray(staffDetails.subjects_taught) && staffDetails.subjects_taught.length > 0 ? staffDetails.subjects_taught.join(', ') : 'Not Provided';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
            
            <Modal visible={isViewerVisible} transparent={true} onRequestClose={() => setViewerVisible(false)} animationType="fade">
                <Pressable style={styles.modalBackdrop} onPress={() => setViewerVisible(false)}>
                    <View style={styles.modalContent}>
                        <Image source={imageUrl ? { uri: imageUrl } : require('../assets/default_avatar.png')} style={styles.enlargedAvatar} resizeMode="contain" />
                        <TouchableOpacity style={styles.closeButton} onPress={() => setViewerVisible(false)}>
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>
            
            {/* Header Card */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#000' }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.6}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                </TouchableOpacity>
                <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                    <MaterialIcons name="assignment-ind" size={28} color={COLORS.primary} />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Staff Profile</Text>
                    <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>View detailed information</Text>
                </View>
                
                {/* 3 DOTS MENU */}
                <TouchableOpacity style={styles.menuButton} onPress={handleMenuPress}>
                    <MaterialIcons name="more-vert" size={26} color={COLORS.iconColor} />
                </TouchableOpacity>
            </View>

            <ScrollView ref={scrollViewRef} style={styles.scrollContainer} contentContainerStyle={styles.scrollContentContainer}>
                
                {/* Profile Card */}
                <View style={[styles.profileCard, { backgroundColor: COLORS.primary }]}>
                    <TouchableOpacity onPress={() => setViewerVisible(true)} style={styles.avatarWrapper}>
                        <Image 
                            source={imageUrl ? { uri: imageUrl } : require('../assets/default_avatar.png')} 
                            style={styles.avatar}
                            fadeDuration={0} 
                        />
                    </TouchableOpacity>
                    <Text style={styles.fullName}>{staffDetails.full_name}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{displayRole}</Text>
                    </View>
                </View>
                
                {/* Details */}
                <View style={[styles.card, { backgroundColor: COLORS.cardBg }]}>
                    <Text style={[styles.cardTitle, { color: COLORS.primary, borderBottomColor: COLORS.border }]}>Personal Details</Text>
                    <DetailRow label="Username" value={staffDetails.username} />
                    {staffDetails.role === 'teacher' && (<DetailRow label="Subjects" value={subjectsDisplay} />)}
                    <DetailRow label="Date of Birth" value={staffDetails.dob} />
                    <DetailRow label="Gender" value={staffDetails.gender} />
                </View>
                
                <View style={[styles.card, { backgroundColor: COLORS.cardBg }]}>
                    <Text style={[styles.cardTitle, { color: COLORS.primary, borderBottomColor: COLORS.border }]}>Contact Details</Text>
                    <DetailRow label="Mobile No" value={staffDetails.phone} />
                    <DetailRow label="Email Address" value={staffDetails.email} />
                    <DetailRow label="Address" value={staffDetails.address} />
                </View>

                {/* Professional Info */}
                <View style={[styles.collapsibleCard, { backgroundColor: COLORS.cardBg }]}>
                    <TouchableOpacity style={styles.collapsibleHeader} onPress={handleProfessionalToggle} activeOpacity={0.8}>
                        <Text style={[styles.collapsibleTitle, { color: COLORS.primary }]}>Professional Details</Text>
                        <Text style={[styles.arrowIcon, { color: COLORS.primary }]}>{isProfessionalExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {isProfessionalExpanded && (
                        <View style={styles.cardContent}>
                            <DetailRow label="Aadhar No." value={staffDetails.aadhar_no} />
                            <DetailRow label="Joining Date" value={staffDetails.joining_date} />
                            <DetailRow label="Previous Salary" value={staffDetails.previous_salary} />
                            <DetailRow label="Present Salary" value={staffDetails.present_salary} />
                            <DetailRow label="Experience" value={staffDetails.experience} />
                        </View>
                    )}
                </View>

                {staffDetails.role === 'teacher' && (
                    <>
                        {/* Timetable */}
                        <View style={[styles.collapsibleCard, { backgroundColor: COLORS.cardBg }]}>
                            <TouchableOpacity style={styles.collapsibleHeader} onPress={handleTimetableToggle} activeOpacity={0.8}>
                                <Text style={[styles.collapsibleTitle, { color: COLORS.primary }]}>Timetable</Text>
                                <Text style={[styles.arrowIcon, { color: COLORS.primary }]}>{isTimetableExpanded ? '▲' : '▼'}</Text>
                            </TouchableOpacity>
                            {isTimetableExpanded && <TimetableScreen teacherId={staffId} isEmbedded={true} />}
                        </View>
                        
                        {/* Performance Section */}
                        <View style={[styles.collapsibleCard, { backgroundColor: COLORS.cardBg }]}>
                            <TouchableOpacity style={styles.collapsibleHeader} onPress={handlePerformanceToggle} activeOpacity={0.8}>
                                <Text style={[styles.collapsibleTitle, { color: COLORS.primary }]}>Performance</Text>
                                <Text style={[styles.arrowIcon, { color: COLORS.primary }]}>{isPerformanceExpanded ? '▲' : '▼'}</Text>
                            </TouchableOpacity>
                            
                            {isPerformanceExpanded && (
                                performanceLoading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ padding: 20 }} /> : (
                                    <View>
                                        <View style={styles.teacherHeader}>
                                            <Text style={styles.teacherNameHeader}>{staffDetails.full_name}</Text>
                                            <View style={styles.teacherStatsContainer}>
                                                <Text style={styles.overallStat}>Marks: <Text style={styles.overallValue}>{Math.round(overallStats.totalObtained)}</Text></Text>
                                                <Text style={styles.overallStat}>Perf: <Text style={[styles.averageValue, { color: getStatusColor(overallStats.percentage, COLORS) }]}>
                                                    {getRoundedPercentage(overallStats.percentage)}%
                                                </Text></Text>
                                            </View>
                                        </View>
                                        
                                        {performanceDetails.length > 0 ? (
                                            <>
                                                <View style={[styles.detailHeaderRow, { backgroundColor: COLORS.background, borderBottomColor: COLORS.border }]}>
                                                    <Text style={[styles.detailHeaderText, { flex: 3 }]}>Class / Subject</Text>
                                                    <Text style={[styles.detailHeaderText, { flex: 2, textAlign: 'center' }]}>Score</Text>
                                                    <Text style={[styles.detailHeaderText, { flex: 1.5, textAlign: 'right' }]}>Avg %</Text>
                                                </View>
                                                {performanceDetails.map((detail, index) => {
                                                    const dPerc = getRoundedPercentage(detail.average_marks);
                                                    return (
                                                        <View key={index} style={[styles.detailRowPerformance, { borderBottomColor: COLORS.border }, index === performanceDetails.length - 1 && styles.lastDetailRow]}>
                                                            <View style={{flex: 3, flexDirection: 'row', alignItems: 'center'}}>
                                                                <Text style={[styles.detailColumnSubject, { color: COLORS.textMain }]} numberOfLines={1}>{`${detail.class_group} - ${detail.subject}`}</Text>
                                                                <TouchableOpacity style={styles.inlineGraphBtn} onPress={() => handleOpenGraph(`${detail.class_group} - ${detail.subject}`, detail.exam_breakdown)}>
                                                                    <Icon name="chart-bar" size={16} color="#FFF" />
                                                                </TouchableOpacity>
                                                            </View>
                                                            <Text style={[styles.detailColumnTotal, { color: COLORS.textMain }]}>{Math.round(detail.total_marks)}/{Math.round(detail.max_possible_marks)}</Text>
                                                            <Text style={[styles.detailColumnAverage, { color: getStatusColor(dPerc, COLORS) }]}>{dPerc}%</Text>
                                                        </View>
                                                    );
                                                })}
                                            </>
                                        ) : <View style={styles.noDataContainer}><Text style={[styles.noDataText, { color: COLORS.textSub }]}>No performance data available.</Text></View>}
                                    </View>
                                )
                            )}
                        </View>
                        
                        {/* Attendance Section */}
                        <View style={[styles.collapsibleCard, { backgroundColor: COLORS.cardBg }]}>
                            <TouchableOpacity style={styles.collapsibleHeader} onPress={handleAttendanceToggle} activeOpacity={0.8}>
                                <Text style={[styles.collapsibleTitle, { color: COLORS.primary }]}>Attendance</Text>
                                <Text style={[styles.arrowIcon, { color: COLORS.primary }]}>{isAttendanceExpanded ? '▲' : '▼'}</Text>
                            </TouchableOpacity>
                            {isAttendanceExpanded && (
                                <View>
                                    <View style={[styles.attToggleContainer, { borderBottomColor: COLORS.border }]}>
                                        {['daily', 'monthly', 'yearly', 'custom'].map(m => (
                                            <TouchableOpacity key={m} style={[styles.attToggleButton, { backgroundColor: COLORS.track }, attendanceViewMode === m && { backgroundColor: COLORS.primary }]} onPress={() => setAttendanceViewMode(m)}>
                                                <Text style={[styles.attToggleButtonText, { color: COLORS.textMain }, attendanceViewMode === m && { color: '#FFFFFF' }]}>{m.charAt(0).toUpperCase() + m.slice(1)}</Text>
                                            </TouchableOpacity>
                                        ))}
                                        {attendanceViewMode !== 'custom' && (
                                            <TouchableOpacity style={styles.attCalendarButton} onPress={() => setShowMainPicker(true)}><Icon name="calendar" size={22} color={COLORS.primary} /></TouchableOpacity>
                                        )}
                                    </View>
                                    <View style={styles.attSubtitleContainer}>
                                        {attendanceViewMode === 'daily' && <Text style={[styles.attSubtitle, { color: COLORS.textSub }]}>Date: {formatDate(attSelectedDate)}</Text>}
                                        {attendanceViewMode === 'monthly' && <Text style={[styles.attSubtitle, { color: COLORS.textSub }]}>Month: {attSelectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>}
                                        {attendanceViewMode === 'yearly' && <Text style={[styles.attSubtitle, { color: COLORS.textSub }]}>Year: {attSelectedDate.getFullYear()}</Text>}
                                        {attendanceViewMode === 'custom' && <Text style={[styles.attSubtitle, { color: COLORS.textSub }]}>Custom Range</Text>}
                                    </View>

                                    {attendanceViewMode === 'custom' && (
                                        <Animatable.View animation="fadeIn" duration={300} style={[styles.attRangeContainer, { backgroundColor: COLORS.background, borderBottomColor: COLORS.border }]}>
                                            <TouchableOpacity style={[styles.attDateInputBox, { backgroundColor: COLORS.inputBg }]} onPress={() => setShowFromPicker(true)}><Icon name="calendar-today" size={18} color={COLORS.textSub} style={{marginRight:5}}/><Text style={[styles.attDateInputText, { color: COLORS.textMain }]}>{formatDate(attFromDate)}</Text></TouchableOpacity>
                                            <Icon name="arrow-right" size={20} color={COLORS.textSub} />
                                            <TouchableOpacity style={[styles.attDateInputBox, { backgroundColor: COLORS.inputBg }]} onPress={() => setShowToPicker(true)}><Icon name="calendar-today" size={18} color={COLORS.textSub} style={{marginRight:5}}/><Text style={[styles.attDateInputText, { color: COLORS.textMain }]}>{formatDate(attToDate)}</Text></TouchableOpacity>
                                            <TouchableOpacity style={[styles.attGoButton, { backgroundColor: COLORS.success }]} onPress={fetchAttendanceReport}><Text style={styles.attGoButtonText}>Go</Text></TouchableOpacity>
                                        </Animatable.View>
                                    )}

                                    {showMainPicker && <DateTimePicker value={attSelectedDate} mode="date" onChange={onMainDateChange} />}
                                    {showFromPicker && <DateTimePicker value={attFromDate} mode="date" onChange={onFromDateChange} />}
                                    {showToPicker && <DateTimePicker value={attToDate} mode="date" onChange={onToDateChange} />}

                                    {attendanceLoading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ padding: 20 }} /> : (
                                        <>
                                            {attendanceViewMode === 'daily' ? (
                                                <View style={{ padding: 20, alignItems: 'center' }}><DailyStatusCard record={dailyRecord} date={attSelectedDate} colors={COLORS} /></View>
                                            ) : (
                                                <View style={styles.attSummaryContainer}>
                                                    <SummaryCard label="Overall %" value={`${attendanceSummary.overallPercentage}%`} color={COLORS.average} colors={COLORS} />
                                                    <SummaryCard label="Working Days" value={attendanceSummary.totalDays || 0} color="#F57C00" colors={COLORS} />
                                                    <SummaryCard label="Days Present" value={attendanceSummary.daysPresent || 0} color={COLORS.success} colors={COLORS} />
                                                    <SummaryCard label="Days Absent" value={attendanceSummary.daysAbsent || 0} color={COLORS.poor} colors={COLORS} />
                                                </View>
                                            )}
                                        </>
                                    )}
                                </View>
                            )}
                        </View>
                    </>
                )}
            </ScrollView>

            {/* Modal Graph */}
            <Modal visible={isGraphVisible} transparent={true} animationType="fade" onRequestClose={() => setIsGraphVisible(false)}>
                <View style={[styles.modalOverlay, { backgroundColor: COLORS.modalOverlay }]}>
                    <View style={[styles.graphModalCard, { backgroundColor: COLORS.cardBg }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalHeaderTitle, { color: COLORS.textMain }]}>Performance Stats</Text>
                            <TouchableOpacity onPress={() => setIsGraphVisible(false)}>
                                <Icon name="close-circle-outline" size={28} color={COLORS.textSub} />
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={[styles.graphSubTitle, { color: COLORS.textSub }]}>{graphData?.title}</Text>

                        <View style={[styles.graphViewArea, { borderBottomColor: COLORS.border }]}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'flex-end' }}>
                                {graphData?.exams && graphData.exams.length > 0 ? graphData.exams.map((exam, idx) => (
                                    <AnimatedBar 
                                        key={idx} 
                                        percentage={exam.percentage} 
                                        marks={`${Math.round(exam.total_obtained)}/${Math.round(exam.total_possible)}`}
                                        label={exam.exam_type} 
                                        color={getStatusColor(exam.percentage, COLORS)}
                                        colors={COLORS}
                                        height={240}
                                    />
                                )) : <Text style={[styles.noDataText, { color: COLORS.textSub }]}>No exam data found.</Text>}
                            </ScrollView>
                        </View>

                        <View style={styles.legendRow}>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.success}]} /><Text style={[styles.legendTxt, { color: COLORS.textSub }]}>85-100%</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.average}]} /><Text style={[styles.legendTxt, { color: COLORS.textSub }]}>50-85%</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.poor}]} /><Text style={[styles.legendTxt, { color: COLORS.textSub }]}>0-50%</Text></View>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContainer: { flex: 1 },
    scrollContentContainer: { paddingBottom: 20 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Header Card
    headerCard: {
        paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center',
        marginTop: 15, marginBottom: 10, borderRadius: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
    },
    backButton: { marginRight: 8, padding: 8, justifyContent: 'center', alignItems: 'center' },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 22, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 14, marginTop: 1 },
    menuButton: { padding: 8 },

    // Profile Card
    profileCard: {
        alignItems: 'center', marginHorizontal: 15, borderRadius: 16,
        paddingVertical: 25, marginBottom: 10, elevation: 4,
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5,
    },
    avatarWrapper: {
        borderRadius: 65, borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)',
        padding: 4, marginBottom: 10,
    },
    avatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#bdc3c7' },
    fullName: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', textAlign: 'center', marginBottom: 5 },
    badge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
    badgeText: { color: '#fff', fontWeight: '600', fontSize: 14 },

    // Details Cards
    card: { borderRadius: 12, marginHorizontal: 15, marginTop: 15, paddingHorizontal: 15, paddingBottom: 5, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', paddingVertical: 15, borderBottomWidth: 1, marginBottom: 5 },
    cardContent: { paddingHorizontal: 15, paddingBottom: 5 },
    detailRow: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, alignItems: 'center' },
    detailLabel: { fontSize: 15, flex: 2 },
    detailValue: { fontSize: 15, flex: 3, fontWeight: '500', textAlign: 'right' },
    
    // Collapsible
    collapsibleCard: { borderRadius: 12, marginHorizontal: 15, marginTop: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, overflow: 'hidden' },
    collapsibleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
    collapsibleTitle: { fontSize: 18, fontWeight: 'bold' },
    arrowIcon: { fontSize: 20 },
    
    // Performance
    teacherHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#34495e' },
    teacherNameHeader: { fontSize: 18, fontWeight: '600', color: '#ffffff', flexShrink: 1 },
    teacherStatsContainer: { alignItems: 'flex-end' },
    overallStat: { fontSize: 14, color: '#ecf0f1', lineHeight: 20 },
    overallValue: { fontWeight: 'bold', color: '#ffffff' },
    averageValue: { fontWeight: 'bold' },
    detailHeaderRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2 },
    detailHeaderText: { fontSize: 12, fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', letterSpacing: 0.5 },
    detailRowPerformance: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
    lastDetailRow: { borderBottomWidth: 0 },
    detailColumnSubject: { fontSize: 15, maxWidth: '85%' },
    detailColumnTotal: { flex: 2, fontSize: 15, textAlign: 'center' },
    detailColumnAverage: { flex: 1.5, fontSize: 15, fontWeight: 'bold', textAlign: 'right' },
    inlineGraphBtn: { backgroundColor: '#FB8C00', padding: 4, borderRadius: 4, marginLeft: 8 },
    
    // Graph Modal
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    graphModalCard: { width: '100%', borderRadius: 16, padding: 20, elevation: 10 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalHeaderTitle: { fontSize: 18, fontWeight: 'bold' },
    graphSubTitle: { textAlign: 'center', marginBottom: 15, fontSize: 14, fontWeight: '500' },
    graphViewArea: { height: 250, borderBottomWidth: 1, paddingBottom: 10 },
    
    // Bar Graph
    barWrapper: { width: 55, alignItems: 'center', justifyContent: 'flex-end', marginHorizontal: 8 },
    barLabelTop: { marginBottom: 4, fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
    barBackground: { width: 30, height: '80%', borderRadius: 1, overflow: 'hidden', justifyContent: 'flex-end', position: 'relative' },
    barFill: { width: '100%', borderRadius: 1 },
    barTextContainer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    barInnerText: { fontSize: 10, fontWeight: 'bold', color: '#0e0e0eff', transform: [{ rotate: '-90deg' }], width: 120, textAlign: 'center' },
    barLabelBottom: { marginTop: 8, fontSize: 11, fontWeight: '600', textAlign: 'center', width: '100%' },
    
    legendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 15 },
    legendItem: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
    legendTxt: { fontSize: 12 },

    // Modal Profile
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', height: '70%', justifyContent: 'center', alignItems: 'center' },
    enlargedAvatar: { width: '100%', height: '100%', borderRadius: 10 },
    closeButton: { position: 'absolute', bottom: -20, backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 35, borderRadius: 25 },
    closeButtonText: { color: '#2c3e50', fontSize: 16, fontWeight: 'bold' },

    noDataContainer: { padding: 20, alignItems: 'center', justifyContent: 'center' },
    noDataText: { fontSize: 16, textAlign: 'center' },
    
    // Attendance
    attToggleContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, borderBottomWidth: 1, alignItems: 'center', flexWrap: 'wrap' },
    attToggleButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginHorizontal: 3, marginBottom: 5 },
    attToggleButtonText: { fontWeight: '600', fontSize: 13 },
    attCalendarButton: { padding: 8, marginLeft: 5 },
    attSubtitleContainer: { alignItems: 'center', paddingVertical: 5 },
    attSubtitle: { fontSize: 14 },
    attRangeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1 },
    attDateInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 6, marginHorizontal: 5, justifyContent: 'center' },
    attDateInputText: { fontSize: 13, fontWeight: '500' },
    attGoButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, marginLeft: 5 },
    attGoButtonText: { color: '#FFFFFF', fontWeight: 'bold' },
    attSummaryContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingVertical: 15 },
    attSummaryBox: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2, borderWidth: 1, borderRadius: 8 },
    attSummaryValue: { fontSize: 20, fontWeight: 'bold' },
    attSummaryLabel: { fontSize: 12, marginTop: 5, textAlign: 'center' },
    dailyCard: { width: '100%', padding: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, elevation: 2 },
    dailyStatusText: { fontSize: 24, fontWeight: 'bold', marginTop: 10 },
    dailyDateText: { fontSize: 16, marginTop: 5 },
});

export default StaffDetailScreen;