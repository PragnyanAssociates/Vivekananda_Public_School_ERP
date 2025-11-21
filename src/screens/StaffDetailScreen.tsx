/**
 * File: src/screens/staff/StaffDetailScreen.js
 * Purpose: Staff Details with Professional, Timetable, Attendance, and Graphical Performance Analysis.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, Image,
    TouchableOpacity, Modal, Pressable, Platform, UIManager, LayoutAnimation, Alert, Animated, Easing
} from 'react-native';
import apiClient from '../api/client';
import { SERVER_URL } from '../../apiConfig';
import TimetableScreen from './TimetableScreen';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- COLORS ---
const COLORS = {
    primary: '#00897B',    // Teal
    background: '#f4f6f8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    success: '#43A047',    // Green
    average: '#1E88E5',    // Blue
    poor: '#E53935',       // Red
    track: '#ECEFF1',      // Light Grey
    border: '#CFD8DC'
};

// --- HELPER: Date Formatter ---
const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

const getCurrentAcademicYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return currentMonth >= 5 ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;
};

// --- COMPONENT: ANIMATED BAR (From Performance Screen) ---
const AnimatedBar = ({ percentage, marks, label, color, height = 200 }) => {
    const animatedHeight = useRef(new Animated.Value(0)).current;

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
        outputRange: ['0%', `${percentage}%`]
    });

    return (
        <View style={[styles.barWrapper, { height: height }]}>
            {/* Percentage Label */}
            <Text style={styles.barLabelTop}>{Math.round(percentage)}%</Text>
            {/* Bar Track */}
            <View style={styles.barBackground}>
                {/* Animated Fill */}
                <Animated.View style={[styles.barFill, { height: heightStyle, backgroundColor: color }]} />
                {/* Marks Overlay (Rotated) */}
                <View style={styles.barTextContainer}>
                    <Text style={styles.barInnerText} numberOfLines={1}>{marks}</Text>
                </View>
            </View>
            {/* Bottom Label */}
            <Text style={styles.barLabelBottom} numberOfLines={1}>{label}</Text>
        </View>
    );
};

// --- SUB-COMPONENTS FOR ATTENDANCE ---
const SummaryCard = ({ label, value, color, width = '23%' }) => (
    <Animatable.View animation="zoomIn" duration={500} style={[styles.attSummaryBox, { width: width }]}>
        <Text style={[styles.attSummaryValue, { color }]}>{value}</Text>
        <Text style={styles.attSummaryLabel}>{label}</Text>
    </Animatable.View>
);

const DailyStatusCard = ({ record, date }) => {
    const hasRecord = !!record;
    const status = hasRecord ? record.status : null;
    let bgColor = '#9E9E9E'; let iconName = "help-circle-outline"; let statusText = "No Record";

    if (status === 'P') { bgColor = '#43A047'; iconName = "check-circle-outline"; statusText = "Present"; }
    else if (status === 'A') { bgColor = '#E53935'; iconName = "close-circle-outline"; statusText = "Absent"; }
    else if (status === 'L') { bgColor = '#F57C00'; iconName = "clock-alert-outline"; statusText = "Late / Leave"; }

    return (
        <Animatable.View animation="flipInX" duration={600} style={[styles.dailyCard, { backgroundColor: hasRecord ? bgColor : '#FFFFFF', borderColor: bgColor }]}>
            <Icon name={iconName} size={50} color={hasRecord ? '#FFFFFF' : bgColor} />
            <Text style={[styles.dailyStatusText, { color: hasRecord ? '#FFFFFF' : bgColor }]}>{statusText.toUpperCase()}</Text>
            <Text style={[styles.dailyDateText, { color: hasRecord ? 'rgba(255,255,255,0.9)' : '#566573' }]}>{formatDate(date)}</Text>
        </Animatable.View>
    );
};

// --- MAIN COMPONENT ---
const StaffDetailScreen = ({ route }) => {
    const { staffId } = route.params;
    const [staffDetails, setStaffDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isViewerVisible, setViewerVisible] = useState(false);

    // Collapsibles
    const [isProfessionalExpanded, setIsProfessionalExpanded] = useState(false);
    const [isTimetableExpanded, setIsTimetableExpanded] = useState(false);
    const [isPerformanceExpanded, setIsPerformanceExpanded] = useState(false);
    const [isAttendanceExpanded, setIsAttendanceExpanded] = useState(false);

    // Performance State
    const [performanceDetails, setPerformanceDetails] = useState([]);
    const [performanceLoading, setPerformanceLoading] = useState(false);
    
    // Graph Modal State
    const [isGraphVisible, setIsGraphVisible] = useState(false);
    const [graphData, setGraphData] = useState(null);

    // Attendance State
    const [attendanceReport, setAttendanceReport] = useState(null);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [attendanceViewMode, setAttendanceViewMode] = useState('daily');
    const [attSelectedDate, setAttSelectedDate] = useState(new Date());
    const [attFromDate, setAttFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)));
    const [attToDate, setAttToDate] = useState(new Date());

    // Pickers
    const [showMainPicker, setShowMainPicker] = useState(false);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);

    const scrollViewRef = useRef(null);

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            try {
                const response = await apiClient.get(`/staff/${staffId}`);
                setStaffDetails(response.data);
            } catch (error) {
                console.error('Error fetching staff details:', error);
            } finally {
                setLoading(false);
            }
        };
        if (staffId) fetchDetails();
    }, [staffId]);
    
    const scrollToBottom = () => { setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150); };

    // --- TOGGLES ---
    const handleProfessionalToggle = () => { if (!isProfessionalExpanded) scrollToBottom(); setIsProfessionalExpanded(p => !p); };
    const handleTimetableToggle = () => { if (!isTimetableExpanded) scrollToBottom(); setIsTimetableExpanded(p => !p); };

    const handlePerformanceToggle = async () => {
        if (!isPerformanceExpanded) {
            setPerformanceLoading(true);
            try {
                const academicYear = getCurrentAcademicYear();
                const response = await apiClient.get(`/performance/teacher/${staffId}/${academicYear}`);
                setPerformanceDetails(response.data);
            } catch (error) {
                console.error("Failed to fetch performance data:", error);
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

    // --- GRAPH HANDLER ---
    const handleOpenGraph = (title, exams) => {
        setGraphData({ title, exams });
        setIsGraphVisible(true);
    };

    const getBarColor = (perc) => {
        if (perc >= 75) return COLORS.success;
        if (perc >= 50) return COLORS.average;
        return COLORS.poor;
    };

    // --- ATTENDANCE LOGIC ---
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

    // --- STATS CALCULATION ---
    const overallStats = useMemo(() => {
        if (!performanceDetails || performanceDetails.length === 0) return { totalObtained: 0, totalPossible: 0, percentage: 0 };
        let totalObtained = 0; let totalPossible = 0;
        performanceDetails.forEach(item => { totalObtained += parseFloat(item.total_marks) || 0; totalPossible += parseFloat(item.max_possible_marks) || 0; });
        const percentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;
        return { totalObtained, totalPossible, percentage };
    }, [performanceDetails]);

    const attendanceSummary = useMemo(() => attendanceReport?.stats || { overallPercentage: '0.0', daysPresent: 0, daysAbsent: 0, totalDays: 0 }, [attendanceReport]);
    const dailyRecord = (attendanceViewMode === 'daily' && attendanceReport?.detailedHistory?.length) ? attendanceReport.detailedHistory.find(r => r.date === attSelectedDate.toISOString().slice(0, 10)) || attendanceReport.detailedHistory[0] : null;

    const DetailRow = ({ label, value }) => (<View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || 'Not Provided'}</Text></View>);

    if (loading) return <View style={styles.loaderContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    if (!staffDetails) return <View style={styles.loaderContainer}><Text>Could not load staff details.</Text></View>;

    const imageUrl = staffDetails.profile_image_url ? `${SERVER_URL}${staffDetails.profile_image_url}` : null;
    const displayRole = staffDetails.role === 'admin' ? staffDetails.class_group : staffDetails.role;
    const subjectsDisplay = staffDetails.subjects_taught && Array.isArray(staffDetails.subjects_taught) && staffDetails.subjects_taught.length > 0 ? staffDetails.subjects_taught.join(', ') : 'Not Provided';

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
            <Modal visible={isViewerVisible} transparent={true} onRequestClose={() => setViewerVisible(false)} animationType="fade">
                <Pressable style={styles.modalBackdrop} onPress={() => setViewerVisible(false)}><View style={styles.modalContent}><Image source={imageUrl ? { uri: imageUrl } : require('../assets/default_avatar.png')} style={styles.enlargedAvatar} resizeMode="contain" /><TouchableOpacity style={styles.closeButton} onPress={() => setViewerVisible(false)}><Text style={styles.closeButtonText}>Close</Text></TouchableOpacity></View></Pressable>
            </Modal>
            
            <ScrollView ref={scrollViewRef} style={styles.container} contentContainerStyle={styles.scrollContentContainer}>
                {/* Header Profile */}
                <View style={styles.profileHeader}>
                    <TouchableOpacity onPress={() => setViewerVisible(true)}><Image source={imageUrl ? { uri: imageUrl } : require('../assets/default_avatar.png')} style={styles.avatar} /></TouchableOpacity>
                    <Text style={styles.fullName}>{staffDetails.full_name}</Text>
                    <Text style={styles.role}>{displayRole}</Text>
                </View>
                
                {/* Static Details */}
                <View style={styles.card}><Text style={styles.cardTitle}>Personal Details</Text><DetailRow label="Username" value={staffDetails.username} />{staffDetails.role === 'teacher' && (<DetailRow label="Subjects Taught" value={subjectsDisplay} />)}<DetailRow label="Date of Birth" value={staffDetails.dob} /><DetailRow label="Gender" value={staffDetails.gender} /></View>
                <View style={styles.card}><Text style={styles.cardTitle}>Contact Details</Text><DetailRow label="Mobile No" value={staffDetails.phone} /><DetailRow label="Email Address" value={staffDetails.email} /><DetailRow label="Address" value={staffDetails.address} /></View>

                {/* Collapsible: Professional */}
                <View style={styles.collapsibleCard}>
                    <TouchableOpacity style={styles.collapsibleHeader} onPress={handleProfessionalToggle} activeOpacity={0.8}>
                        <Text style={styles.collapsibleTitle}>Professional Details</Text><Text style={styles.arrowIcon}>{isProfessionalExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {isProfessionalExpanded && (
                        <View style={styles.cardContent}><DetailRow label="Aadhar No." value={staffDetails.aadhar_no} /><DetailRow label="Joining Date" value={staffDetails.joining_date} /><DetailRow label="Previous Salary" value={staffDetails.previous_salary} /><DetailRow label="Present Salary" value={staffDetails.present_salary} /><DetailRow label="Experience" value={staffDetails.experience} /></View>
                    )}
                </View>

                {staffDetails.role === 'teacher' && (
                    <>
                        {/* Collapsible: Timetable */}
                        <View style={styles.collapsibleCard}>
                            <TouchableOpacity style={styles.collapsibleHeader} onPress={handleTimetableToggle} activeOpacity={0.8}>
                                <Text style={styles.collapsibleTitle}>Timetable</Text><Text style={styles.arrowIcon}>{isTimetableExpanded ? '▲' : '▼'}</Text>
                            </TouchableOpacity>
                            {isTimetableExpanded && <TimetableScreen teacherId={staffId} isEmbedded={true} />}
                        </View>
                        
                        {/* Collapsible: Performance with Graph */}
                        <View style={styles.collapsibleCard}>
                            <TouchableOpacity style={styles.collapsibleHeader} onPress={handlePerformanceToggle} activeOpacity={0.8}>
                                <Text style={styles.collapsibleTitle}>Performance</Text><Text style={styles.arrowIcon}>{isPerformanceExpanded ? '▲' : '▼'}</Text>
                            </TouchableOpacity>
                            
                            {isPerformanceExpanded && (
                                performanceLoading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ padding: 20 }} /> : (
                                    <View>
                                        <View style={styles.teacherHeader}>
                                            <Text style={styles.teacherNameHeader}>{staffDetails.full_name}</Text>
                                            <View style={styles.teacherStatsContainer}>
                                                <Text style={styles.overallStat}>Marks: <Text style={styles.overallValue}>{Math.round(overallStats.totalObtained)}</Text></Text>
                                                <Text style={styles.overallStat}>Perf: <Text style={styles.averageValue}>{overallStats.percentage.toFixed(2)}%</Text></Text>
                                            </View>
                                        </View>
                                        
                                        {performanceDetails.length > 0 ? (
                                            <>
                                                <View style={styles.detailHeaderRow}>
                                                    <Text style={[styles.detailHeaderText, { flex: 3 }]}>Class / Subject</Text>
                                                    <Text style={[styles.detailHeaderText, { flex: 2, textAlign: 'center' }]}>Score</Text>
                                                    <Text style={[styles.detailHeaderText, { flex: 1.5, textAlign: 'right' }]}>Avg %</Text>
                                                </View>
                                                {performanceDetails.map((detail, index) => (
                                                    <View key={index} style={[styles.detailRowPerformance, index === performanceDetails.length - 1 && styles.lastDetailRow]}>
                                                        <View style={{flex: 3, flexDirection: 'row', alignItems: 'center'}}>
                                                            <Text style={styles.detailColumnSubject} numberOfLines={1}>{`${detail.class_group} - ${detail.subject}`}</Text>
                                                            {/* GRAPH BUTTON */}
                                                            <TouchableOpacity style={styles.inlineGraphBtn} onPress={() => handleOpenGraph(`${detail.class_group} - ${detail.subject}`, detail.exam_breakdown)}>
                                                                <Icon name="chart-bar" size={16} color="#FFF" />
                                                            </TouchableOpacity>
                                                        </View>
                                                        <Text style={styles.detailColumnTotal}>{detail.total_marks}/{detail.max_possible_marks}</Text>
                                                        <Text style={styles.detailColumnAverage}>{parseFloat(detail.average_marks).toFixed(2)}%</Text>
                                                    </View>
                                                ))}
                                            </>
                                        ) : <View style={styles.noDataContainer}><Text style={styles.noDataText}>No performance data available.</Text></View>}
                                    </View>
                                )
                            )}
                        </View>
                        
                        {/* Collapsible: Attendance */}
                        <View style={styles.collapsibleCard}>
                            <TouchableOpacity style={styles.collapsibleHeader} onPress={handleAttendanceToggle} activeOpacity={0.8}>
                                <Text style={styles.collapsibleTitle}>Attendance</Text><Text style={styles.arrowIcon}>{isAttendanceExpanded ? '▲' : '▼'}</Text>
                            </TouchableOpacity>
                            {isAttendanceExpanded && (
                                <View>
                                    <View style={styles.attToggleContainer}>
                                        {['daily', 'monthly', 'yearly', 'custom'].map(m => (
                                            <TouchableOpacity key={m} style={[styles.attToggleButton, attendanceViewMode === m && styles.attToggleButtonActive]} onPress={() => setAttendanceViewMode(m)}>
                                                <Text style={[styles.attToggleButtonText, attendanceViewMode === m && styles.attToggleButtonTextActive]}>{m.charAt(0).toUpperCase() + m.slice(1)}</Text>
                                            </TouchableOpacity>
                                        ))}
                                        {attendanceViewMode !== 'custom' && (
                                            <TouchableOpacity style={styles.attCalendarButton} onPress={() => setShowMainPicker(true)}><Icon name="calendar" size={22} color={COLORS.primary} /></TouchableOpacity>
                                        )}
                                    </View>
                                    <View style={styles.attSubtitleContainer}>
                                        {attendanceViewMode === 'daily' && <Text style={styles.attSubtitle}>Date: {formatDate(attSelectedDate)}</Text>}
                                        {attendanceViewMode === 'monthly' && <Text style={styles.attSubtitle}>Month: {attSelectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>}
                                        {attendanceViewMode === 'yearly' && <Text style={styles.attSubtitle}>Year: {attSelectedDate.getFullYear()}</Text>}
                                        {attendanceViewMode === 'custom' && <Text style={styles.attSubtitle}>Custom Range</Text>}
                                    </View>

                                    {attendanceViewMode === 'custom' && (
                                        <Animatable.View animation="fadeIn" duration={300} style={styles.attRangeContainer}>
                                            <TouchableOpacity style={styles.attDateInputBox} onPress={() => setShowFromPicker(true)}><Icon name="calendar-today" size={18} color="#566573" style={{marginRight:5}}/><Text style={styles.attDateInputText}>{formatDate(attFromDate)}</Text></TouchableOpacity>
                                            <Icon name="arrow-right" size={20} color="#566573" />
                                            <TouchableOpacity style={styles.attDateInputBox} onPress={() => setShowToPicker(true)}><Icon name="calendar-today" size={18} color="#566573" style={{marginRight:5}}/><Text style={styles.attDateInputText}>{formatDate(attToDate)}</Text></TouchableOpacity>
                                            <TouchableOpacity style={styles.attGoButton} onPress={fetchAttendanceReport}><Text style={styles.attGoButtonText}>Go</Text></TouchableOpacity>
                                        </Animatable.View>
                                    )}

                                    {showMainPicker && <DateTimePicker value={attSelectedDate} mode="date" onChange={onMainDateChange} />}
                                    {showFromPicker && <DateTimePicker value={attFromDate} mode="date" onChange={onFromDateChange} />}
                                    {showToPicker && <DateTimePicker value={attToDate} mode="date" onChange={onToDateChange} />}

                                    {attendanceLoading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ padding: 20 }} /> : (
                                        <>
                                            {attendanceViewMode === 'daily' ? (
                                                <View style={{ padding: 20, alignItems: 'center' }}><DailyStatusCard record={dailyRecord} date={attSelectedDate} /></View>
                                            ) : (
                                                <View style={styles.attSummaryContainer}>
                                                    <SummaryCard label="Overall %" value={`${attendanceSummary.overallPercentage}%`} color={COLORS.average} />
                                                    <SummaryCard label="Working Days" value={attendanceSummary.totalDays || 0} color="#F57C00" />
                                                    <SummaryCard label="Days Present" value={attendanceSummary.daysPresent || 0} color={COLORS.success} />
                                                    <SummaryCard label="Days Absent" value={attendanceSummary.daysAbsent || 0} color={COLORS.poor} />
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

            {/* --- MODAL: GRAPH VISUALIZATION --- */}
            <Modal visible={isGraphVisible} transparent={true} animationType="fade" onRequestClose={() => setIsGraphVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.graphModalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalHeaderTitle}>Performance Stats</Text>
                            <TouchableOpacity onPress={() => setIsGraphVisible(false)}>
                                <Icon name="close-circle-outline" size={28} color={COLORS.textSub} />
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={styles.graphSubTitle}>{graphData?.title}</Text>

                        <View style={styles.graphViewArea}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'flex-end' }}>
                                {graphData?.exams && graphData.exams.length > 0 ? graphData.exams.map((exam, idx) => (
                                    <AnimatedBar 
                                        key={idx} 
                                        percentage={parseFloat(exam.percentage)} 
                                        marks={`${Math.round(exam.total_obtained)}/${Math.round(exam.total_possible)}`}
                                        label={exam.exam_type} 
                                        color={getBarColor(parseFloat(exam.percentage))}
                                        height={240}
                                    />
                                )) : <Text style={styles.noDataText}>No exam data found.</Text>}
                            </ScrollView>
                        </View>

                        {/* Legend */}
                        <View style={styles.legendRow}>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.success}]} /><Text style={styles.legendTxt}>Excellent</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.average}]} /><Text style={styles.legendTxt}>Average</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.poor}]} /><Text style={styles.legendTxt}>Poor</Text></View>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f8' },
    scrollContentContainer: { paddingBottom: 20 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    profileHeader: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 15, backgroundColor: COLORS.primary },
    avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: '#ffffff', marginBottom: 15, backgroundColor: '#bdc3c7' },
    fullName: { fontSize: 24, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' },
    role: { fontSize: 16, color: '#ecf0f1', marginTop: 5, backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 15, textTransform: 'capitalize' },
    card: { backgroundColor: '#ffffff', borderRadius: 8, marginHorizontal: 15, marginTop: 15, paddingHorizontal: 15, paddingBottom: 5, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f2f5', marginBottom: 5 },
    cardContent: { paddingHorizontal: 15, paddingBottom: 5 },
    detailRow: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f2f5', alignItems: 'center' },
    detailLabel: { fontSize: 15, color: '#7f8c8d', flex: 2 },
    detailValue: { fontSize: 15, color: '#2c3e50', flex: 3, fontWeight: '500', textAlign: 'right' },
    
    // Collapsible
    collapsibleCard: { backgroundColor: '#ffffff', borderRadius: 8, marginHorizontal: 15, marginTop: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, overflow: 'hidden' },
    collapsibleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
    collapsibleTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
    arrowIcon: { fontSize: 20, color: COLORS.primary },
    
    // Performance Styles
    teacherHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#34495e' },
    teacherNameHeader: { fontSize: 18, fontWeight: '600', color: '#ffffff', flexShrink: 1 },
    teacherStatsContainer: { alignItems: 'flex-end' },
    overallStat: { fontSize: 14, color: '#ecf0f1', lineHeight: 20 },
    overallValue: { fontWeight: 'bold', color: '#ffffff' },
    averageValue: { fontWeight: 'bold', color: '#2ecc71' },
    detailHeaderRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#f8f9fa', borderBottomWidth: 2, borderBottomColor: '#e9ecef' },
    detailHeaderText: { fontSize: 12, fontWeight: 'bold', color: '#6c757d', textTransform: 'uppercase', letterSpacing: 0.5 },
    detailRowPerformance: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f0f2f5' },
    lastDetailRow: { borderBottomWidth: 0 },
    detailColumnSubject: { fontSize: 15, color: '#34495e', maxWidth: '85%' },
    detailColumnTotal: { flex: 2, fontSize: 15, color: '#2c3e50', textAlign: 'center' },
    detailColumnAverage: { flex: 1.5, fontSize: 15, fontWeight: 'bold', color: COLORS.primary, textAlign: 'right' },
    inlineGraphBtn: { backgroundColor: '#FB8C00', padding: 4, borderRadius: 4, marginLeft: 8 },
    
    // Modal Styles (Graph)
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    graphModalCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 16, padding: 20, elevation: 10 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
    graphSubTitle: { textAlign: 'center', color: COLORS.textSub, marginBottom: 15, fontSize: 14, fontWeight: '500' },
    graphViewArea: { height: 250, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 10 },
    
    // Animated Bar Styles
    barWrapper: { width: 55, alignItems: 'center', justifyContent: 'flex-end', marginHorizontal: 8 },
    barLabelTop: { marginBottom: 4, fontSize: 12, fontWeight: 'bold', textAlign: 'center', color: COLORS.textMain },
    barBackground: { width: 30, height: '80%', backgroundColor: COLORS.track, borderRadius: 15, overflow: 'hidden', justifyContent: 'flex-end', position: 'relative' },
    barFill: { width: '100%', borderRadius: 15 },
    barTextContainer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    barInnerText: { fontSize: 10, fontWeight: 'bold', color: '#455A64', transform: [{ rotate: '-90deg' }], width: 120, textAlign: 'center' },
    barLabelBottom: { marginTop: 8, fontSize: 11, fontWeight: '600', color: COLORS.textMain, textAlign: 'center', width: '100%' },
    
    // Legend
    legendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 15 },
    legendItem: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
    legendTxt: { fontSize: 12, color: COLORS.textSub },

    // Profile Modal
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', height: '70%', justifyContent: 'center', alignItems: 'center' },
    enlargedAvatar: { width: '100%', height: '100%', borderRadius: 10 },
    closeButton: { position: 'absolute', bottom: -20, backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 35, borderRadius: 25 },
    closeButtonText: { color: '#2c3e50', fontSize: 16, fontWeight: 'bold' },

    // Misc
    noDataContainer: { padding: 20, alignItems: 'center', justifyContent: 'center' },
    noDataText: { fontSize: 16, color: '#7f8c8d', textAlign: 'center' },
    
    // Attendance Specific
    attToggleContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E0E0E0', alignItems: 'center', flexWrap: 'wrap' },
    attToggleButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginHorizontal: 3, backgroundColor: '#E0E0E0', marginBottom: 5 },
    attToggleButtonActive: { backgroundColor: COLORS.primary },
    attToggleButtonText: { color: '#37474F', fontWeight: '600', fontSize: 13 },
    attToggleButtonTextActive: { color: '#FFFFFF' },
    attCalendarButton: { padding: 8, marginLeft: 5 },
    attSubtitleContainer: { alignItems: 'center', paddingVertical: 5 },
    attSubtitle: { fontSize: 14, color: '#566573' },
    attRangeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, backgroundColor: '#f9f9f9', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
    attDateInputBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0E0E0', padding: 10, borderRadius: 6, marginHorizontal: 5, justifyContent: 'center' },
    attDateInputText: { color: '#37474F', fontSize: 13, fontWeight: '500' },
    attGoButton: { backgroundColor: COLORS.success, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, marginLeft: 5 },
    attGoButtonText: { color: '#FFFFFF', fontWeight: 'bold' },
    attSummaryContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingVertical: 15 },
    attSummaryBox: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2 },
    attSummaryValue: { fontSize: 20, fontWeight: 'bold' },
    attSummaryLabel: { fontSize: 12, color: '#566573', marginTop: 5, textAlign: 'center' },
    dailyCard: { width: '100%', padding: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, elevation: 2 },
    dailyStatusText: { fontSize: 24, fontWeight: 'bold', marginTop: 10 },
    dailyDateText: { fontSize: 16, marginTop: 5 },
});

export default StaffDetailScreen;