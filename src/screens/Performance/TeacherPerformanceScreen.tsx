/**
 * File: src/screens/report/TeacherPerformanceScreen.js
 * Purpose: Teacher Performance Analytics with Table View, Class-wise Max Mark Logic, and Attendance Graph.
 * Updated: Responsive Design & Dark/Light Mode Support.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator,
    FlatList, TouchableOpacity, RefreshControl, LayoutAnimation, 
    Platform, UIManager, Modal, ScrollView, Animated, Easing, Dimensions, Alert, StatusBar, useColorScheme
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

// --- Constants & Dimensions ---
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Define Exact Column Widths for Table Alignment
const COL_WIDTHS = {
    no: 50,
    name: 130,
    subject: 150,
    perf: 90,
    att: 110 
};

const EXAM_TYPES = ['Overall', 'AT1', 'UT1', 'AT2', 'UT2', 'AT3', 'UT3', 'AT4', 'UT4', 'SA1', 'SA2', 'Pre-Final'];

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',    
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',   
    textSub: '#546E7A',    
    white: '#FFFFFF',
    
    success: '#43A047',    
    average: '#1E88E5',    
    poor: '#E53935',       
    
    track: '#ECEFF1',      
    border: '#CFD8DC',
    graphBtn: '#FB8C00',
    inputBg: '#FAFAFA',
    modalOverlay: 'rgba(0,0,0,0.6)',
    headerIconBg: '#E0F2F1',
    tableHeader: '#008080',
    tableRowAlt: '#F9FAFB',
    subRowBorder: '#f0f0f0',
    expandedBg: '#FAFAFA',
    detailBorder: '#F0F0F0',
    detailHeaderBorder: '#F5F5F5',
    bdHeaderBg: '#F9FAFB',
    pickerBorder: '#cbd5e1',
    noteBg: '#FFF8E1',
    noteBorder: '#FFE0B2',
    noteText: '#F57C00'
};

const DarkColors = {
    primary: '#008080',    
    background: '#121212', 
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',   
    textSub: '#B0B0B0',    
    white: '#E0E0E0',
    
    success: '#43A047',    
    average: '#1E88E5',    
    poor: '#E53935',       
    
    track: '#333333',      
    border: '#333333',
    graphBtn: '#FB8C00',
    inputBg: '#2C2C2C',
    modalOverlay: 'rgba(255,255,255,0.1)',
    headerIconBg: '#333333',
    tableHeader: '#004D40',
    tableRowAlt: '#2C2C2C',
    subRowBorder: '#424242',
    expandedBg: '#252525',
    detailBorder: '#333333',
    detailHeaderBorder: '#424242',
    bdHeaderBg: '#2C2C2C',
    pickerBorder: '#424242',
    noteBg: '#2C2C2C',
    noteBorder: '#FFB74D',
    noteText: '#FFB74D'
};

// --- HELPER: CUSTOM ROUNDING ---
const getRoundedPercentage = (value) => {
    const floatVal = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(floatVal)) return 0;
    const decimalPart = floatVal - Math.floor(floatVal);
    return decimalPart > 0.5 ? Math.ceil(floatVal) : Math.floor(floatVal);
};

// --- HELPER: GET COLOR ---
const getStatusColor = (percentage, colors) => {
    const val = getRoundedPercentage(percentage);
    if (val >= 85) return colors.success; 
    if (val >= 50) return colors.average;
    return colors.poor; 
};

// --- COMPONENT: ANIMATED BAR ---
const AnimatedBar = ({ percentage, marks, label, subLabel, color, height = 260, colors }) => {
    const animatedHeight = useRef(new Animated.Value(0)).current;
    const displayPercentage = getRoundedPercentage(percentage);

    useEffect(() => {
        Animated.timing(animatedHeight, {
            toValue: 1,
            duration: 1000,
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
                    <Text style={[styles.barInnerText, { color: colors.textMain }]} numberOfLines={1}>{marks}</Text>
                </View>
            </View>
            <Text style={[styles.barLabelBottom, { color: colors.textMain }]} numberOfLines={1}>{label}</Text>
            {subLabel ? <Text style={[styles.barSubLabel, { color: colors.textSub }]} numberOfLines={1}>{subLabel}</Text> : null}
        </View>
    );
};

const TeacherPerformanceScreen = () => {
    // Theme Hook
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    // Navigation Hook
    const navigation = useNavigation();

    const { user } = useAuth();
    const userRole = user?.role || 'teacher';
    const userId = user?.id;

    // Data States
    const [performanceData, setPerformanceData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedId, setExpandedId] = useState(null);

    // Table View & Attendance States
    const [isTableView, setIsTableView] = useState(false);
    const [attendanceData, setAttendanceData] = useState({});
    
    // Modal States
    const [isGraphVisible, setIsGraphVisible] = useState(false);
    const [individualGraphData, setIndividualGraphData] = useState(null);
    const [isAttGraphVisible, setIsAttGraphVisible] = useState(false);
    const [attGraphData, setAttGraphData] = useState(null);
    const [loadingAttGraph, setLoadingAttGraph] = useState(false);
    const [isCompareVisible, setIsCompareVisible] = useState(false);
    
    // Filter States
    const [sortBy, setSortBy] = useState('high-low');
    
    // Comparison States
    const [compareExam, setCompareExam] = useState('Overall');
    const [compareClass, setCompareClass] = useState('All Classes');
    const [compareSortBy, setCompareSortBy] = useState('high-low'); 
    const [availableClasses, setAvailableClasses] = useState(['All Classes']);

    // --- FETCH DATA ---
    const fetchData = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            let response;
            if (userRole === 'admin') {
                response = await apiClient.get(`/performance/admin/all-teachers`);
            } else {
                response = await apiClient.get(`/performance/teacher/${userId}`);
            }
            const data = response.data || [];
            setPerformanceData(data);
            setExpandedId(null);
            extractClasses(data);
            
            if (userRole === 'admin') {
                fetchAttendanceSummaries(data);
            }
        } catch (error) {
            console.error('Error fetching performance data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchAttendanceSummaries = async (teachersList) => {
        if (!teachersList || teachersList.length === 0) return;
        const attendanceMap = {};
        try {
            const promises = teachersList.map(async (teacher) => {
                const tId = teacher.teacher_id;
                try {
                    const res = await apiClient.get(`/teacher-attendance/report/${tId}`);
                    const pct = res.data?.stats?.overallPercentage || '0';
                    return { id: tId, pct: getRoundedPercentage(pct) };
                } catch (err) {
                    return { id: tId, pct: 'N/A' };
                }
            });
            const results = await Promise.all(promises);
            results.forEach(item => { attendanceMap[item.id] = item.pct; });
            setAttendanceData(attendanceMap);
        } catch (error) {
            console.error("Error batch fetching attendance:", error);
        }
    };

    const fetchAttendanceGraph = async (tId, teacherName) => {
        setLoadingAttGraph(true);
        
        try {
            const now = new Date();
            const currentMonth = now.getMonth(); 
            const currentYear = now.getFullYear();

            const startYear = currentMonth < 5 ? currentYear - 1 : currentYear;
            
            const startDate = `${startYear}-06-01`; 
            const endDate = now.toISOString().split('T')[0]; 

            const response = await apiClient.get(`/teacher-attendance/report/${tId}`, {
                params: { 
                    period: 'custom', 
                    startDate: startDate,
                    endDate: endDate
                }
            });

            const history = response.data.detailedHistory || [];
            const monthsMap = {};
            
            history.forEach(rec => {
                const d = new Date(rec.date);
                const monthIdx = d.getMonth(); 
                const monthName = d.toLocaleString('default', { month: 'short' });
                const sortKey = d.getFullYear() * 100 + monthIdx;

                if (!monthsMap[sortKey]) {
                    monthsMap[sortKey] = { name: monthName, present: 0, total: 0 };
                }
                
                if (['P', 'A', 'L'].includes(rec.status)) monthsMap[sortKey].total++;
                if (rec.status === 'P') monthsMap[sortKey].present++;
            });

            const processed = Object.keys(monthsMap)
                .sort((a, b) => a - b)
                .map(key => {
                    const m = monthsMap[key];
                    const pct = m.total > 0 ? (m.present / m.total) * 100 : 0;
                    return {
                        month: m.name,
                        percentage: pct,
                        present: m.present,
                        total: m.total
                    };
                });

            setAttGraphData({ title: teacherName.toUpperCase(), data: processed });
            setIsAttGraphVisible(true);

        } catch (error) {
            console.error("Attendance Graph Error:", error);
            Alert.alert("Error", "Could not fetch attendance history.");
        } finally {
            setLoadingAttGraph(false);
        }
    };

    const extractClasses = (data) => {
        const classes = new Set(['All Classes']);
        if (Array.isArray(data)) {
            data.forEach(teacher => {
                if (teacher.detailed_performance) {
                    teacher.detailed_performance.forEach(d => classes.add(d.class_group));
                }
            });
        }
        setAvailableClasses(Array.from(classes).sort());
    };

    useEffect(() => { fetchData(); }, [userId]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const toggleExpand = (id) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(expandedId === id ? null : id);
    };

    const handleOpenIndividualGraph = (title, exams) => {
        setIndividualGraphData({ title, exams });
        setIsGraphVisible(true);
    };

    const getComparisonData = () => {
        if (!performanceData) return [];
        return performanceData.map(teacher => {
            let totalObtained = 0;
            let totalPossible = 0;
            const subjectsFound = new Set(); 

            if (teacher.detailed_performance) {
                teacher.detailed_performance.forEach(detail => {
                    if (compareClass !== 'All Classes' && detail.class_group !== compareClass) return;
                    if (detail.subject) subjectsFound.add(detail.subject);

                    if (compareExam === 'Overall') {
                        detail.exam_breakdown.forEach(e => {
                            totalObtained += e.total_obtained;
                            totalPossible += e.total_possible;
                        });
                    } else {
                        const exam = detail.exam_breakdown.find(e => e.exam_type === compareExam);
                        if (exam) {
                            totalObtained += exam.total_obtained;
                            totalPossible += exam.total_possible;
                        }
                    }
                });
            }

            let rawPercentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;
            const subjectLabel = Array.from(subjectsFound).join(', ');

            return {
                name: teacher.teacher_name,
                subject: subjectLabel, 
                total_obtained: totalObtained,
                total_possible: totalPossible,
                percentage: getRoundedPercentage(rawPercentage)
            };
        })
        .filter(item => item.total_possible > 0)
        .sort((a, b) => {
            if (compareSortBy === 'low-high') {
                return a.percentage - b.percentage;
            }
            return b.percentage - a.percentage; 
        });
    };

    const processedData = useMemo(() => {
        if (!performanceData || performanceData.length === 0) return [];
        let mappedData = [];

        if (userRole === 'admin') {
            mappedData = performanceData.map((teacher) => ({
                id: teacher.teacher_id,
                uniqueKey: `teacher-${teacher.teacher_id}`,
                name: teacher.teacher_name,
                totalManaged: teacher.overall_total || 0,
                maxPossible: teacher.overall_possible || 0,
                percentage: getRoundedPercentage(teacher.overall_average || 0),
                details: teacher.detailed_performance || [],
                performanceRank: 0
            }));
        } else {
            mappedData = performanceData.map((item, index) => ({
                id: index,
                uniqueKey: `class-${index}`,
                name: item.class_group,
                subName: item.subject,
                totalManaged: item.total_marks,
                maxPossible: item.max_possible_marks,
                percentage: getRoundedPercentage(item.average_marks || 0),
                examBreakdown: item.exam_breakdown || [],
                performanceRank: 0
            }));
        }

        mappedData.sort((a, b) => b.percentage - a.percentage);
        mappedData = mappedData.map((item, index) => ({ ...item, performanceRank: index + 1 }));

        if (sortBy === 'low-high') mappedData.sort((a, b) => a.percentage - b.percentage);
        else mappedData.sort((a, b) => b.percentage - a.percentage);

        return mappedData;
    }, [performanceData, sortBy, userRole]);

    const getRankColor = (rank) => {
        if (rank === 1) return COLORS.success; 
        if (rank === 2) return COLORS.primary;
        if (rank === 3) return COLORS.average;
        return COLORS.textSub;
    };

    // --- RENDER TABLE (UPDATED ALIGNMENT) ---
    const renderTableView = () => {
        return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScrollContainer}>
                <View style={[styles.tableContainer, { borderColor: COLORS.border, backgroundColor: COLORS.cardBg }]}>
                    {/* Header Row */}
                    <View style={[styles.tableHeaderRow, { backgroundColor: COLORS.tableHeader, borderBottomColor: COLORS.border }]}>
                        <View style={[styles.headerCellContainer, { width: COL_WIDTHS.no }]}>
                            <Text style={styles.tableHeaderCell}>No</Text>
                        </View>
                        <View style={[styles.headerCellContainer, { width: COL_WIDTHS.name, alignItems: 'flex-start', paddingLeft: 10 }]}>
                            <Text style={styles.tableHeaderCell}>Name</Text>
                        </View>
                        <View style={[styles.headerCellContainer, { width: COL_WIDTHS.subject }]}>
                            <Text style={styles.tableHeaderCell}>Subject / Class</Text>
                        </View>
                        <View style={[styles.headerCellContainer, { width: COL_WIDTHS.perf }]}>
                            <Text style={styles.tableHeaderCell}>Performance</Text>
                        </View>
                        <View style={[styles.headerCellContainer, { width: COL_WIDTHS.att }]}>
                            <Text style={styles.tableHeaderCell}>Attendance</Text>
                        </View>
                    </View>

                    {/* Data Rows */}
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {processedData.map((item, index) => {
                            const attPercentageStr = attendanceData[item.id] !== undefined && attendanceData[item.id] !== 'N/A' 
                                ? `${attendanceData[item.id]}%` : '-';
                            const attVal = attendanceData[item.id] !== 'N/A' ? attendanceData[item.id] : 0;
                            const attColor = getStatusColor(attVal, COLORS);

                            return (
                                <View key={item.uniqueKey} style={[
                                    styles.tableRow, 
                                    { backgroundColor: COLORS.cardBg, borderBottomColor: COLORS.border },
                                    index % 2 === 1 && { backgroundColor: COLORS.tableRowAlt }
                                ]}>
                                    
                                    {/* NO */}
                                    <View style={[styles.cellContainer, { width: COL_WIDTHS.no }]}>
                                        <Text style={[styles.tableCell, { color: COLORS.textMain }]}>{index + 1}</Text>
                                    </View>
                                    
                                    {/* NAME */}
                                    <View style={[styles.cellContainer, { width: COL_WIDTHS.name, alignItems: 'flex-start', paddingLeft: 10 }]}>
                                        <Text style={[styles.tableCell, { fontWeight: 'bold', textAlign: 'left', color: COLORS.textMain }]} numberOfLines={2}>{item.name}</Text>
                                    </View>
                                    
                                    {/* SUBJECT / CLASS LIST */}
                                    <View style={[styles.cellContainer, { width: COL_WIDTHS.subject }]}>
                                        {item.details && item.details.length > 0 ? (
                                            item.details.map((d, i) => (
                                                <View key={i} style={[styles.subRowItem, { borderBottomColor: COLORS.subRowBorder }]}>
                                                    <Text style={[styles.detailRowText, { color: COLORS.textSub }]}>{d.class_group} - {d.subject}</Text>
                                                </View>
                                            ))
                                        ) : (
                                            <View style={[styles.subRowItem, { borderBottomColor: COLORS.subRowBorder }]}><Text style={[styles.detailRowText, { color: COLORS.textSub }]}>N/A</Text></View>
                                        )}
                                    </View>
                                    
                                    {/* PERFORMANCE */}
                                    <View style={[styles.cellContainer, { width: COL_WIDTHS.perf }]}>
                                        {item.details && item.details.length > 0 ? (
                                            item.details.map((d, i) => {
                                                const dPerc = getRoundedPercentage(d.average_marks);
                                                return (
                                                    <View key={i} style={[styles.subRowItem, { borderBottomColor: COLORS.subRowBorder }]}>
                                                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: getStatusColor(dPerc, COLORS) }}>{dPerc}%</Text>
                                                    </View>
                                                )
                                            })
                                        ) : (
                                            <View style={[styles.subRowItem, { borderBottomColor: COLORS.subRowBorder }]}><Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.poor }}>0%</Text></View>
                                        )}
                                    </View>
                                    
                                    {/* ATTENDANCE + GRAPH BUTTON */}
                                    <View style={[styles.cellContainer, { width: COL_WIDTHS.att, flexDirection: 'row' }]}>
                                        <Text style={{ fontWeight: 'bold', color: attColor, marginRight: 8, fontSize: 12 }}>{attPercentageStr}</Text>
                                        {userRole === 'admin' && (
                                            <TouchableOpacity 
                                                style={styles.tableGraphBtn} 
                                                onPress={() => fetchAttendanceGraph(item.id, item.name)}
                                            >
                                                <Icon name="chart-bar" size={14} color="#FFF" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>
            </ScrollView>
        );
    };

    // --- RENDER CARDS ---
    const renderItem = ({ item }) => {
        const rankStripColor = getRankColor(item.performanceRank);
        const performanceColor = getStatusColor(item.percentage, COLORS);
        const isExpanded = expandedId === item.uniqueKey;
        const percentage = item.percentage;
        const teacherAttPct = attendanceData[item.id] !== undefined ? attendanceData[item.id] : 'N/A';
        const attColor = getStatusColor(teacherAttPct === 'N/A' ? 0 : teacherAttPct, COLORS);

        return (
            <View style={[styles.card, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                <TouchableOpacity style={styles.cardContent} onPress={() => toggleExpand(item.uniqueKey)} activeOpacity={0.8}>
                    <View style={[styles.rankStrip, { backgroundColor: rankStripColor }]}>
                        <Text style={styles.rankText}>#{item.performanceRank}</Text>
                    </View>
                    <View style={styles.cardBody}>
                        <View style={styles.cardTopRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.teacherName, { color: COLORS.textMain }]}>{item.name}</Text>
                                {item.subName && <Text style={[styles.subName, { color: COLORS.textSub }]}>{item.subName}</Text>}
                            </View>
                            <View style={[styles.circleBadge, { borderColor: performanceColor }]}>
                                <Text style={[styles.circleText, { color: performanceColor }]}>{percentage}%</Text>
                            </View>
                        </View>
                        <Text style={[styles.marksLabel, { color: COLORS.textSub }]}>Total: <Text style={[styles.marksValue, { color: COLORS.textMain }]}>{Math.round(item.totalManaged)} / {Math.round(item.maxPossible)}</Text></Text>
                        <View style={[styles.progressTrack, { backgroundColor: COLORS.track }]}>
                            <View style={[styles.progressFill, { width: `${Math.min(item.percentage, 100)}%`, backgroundColor: performanceColor }]} />
                        </View>
                        <View style={styles.expandRow}>
                            <Text style={[styles.perfLabel, { color: COLORS.textSub }]}>Performance: {percentage}%</Text>
                            <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textSub} />
                        </View>
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={[styles.expandedSection, { backgroundColor: COLORS.expandedBg, borderTopColor: COLORS.border }]}>
                        {userRole === 'admin' && (
                            <View style={[styles.attRow, { borderBottomColor: COLORS.border }]}>
                                <Text style={[styles.attLabel, { color: COLORS.textMain }]}>Overall Attendance:</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={[styles.attValue, { color: attColor, marginRight: 10 }]}>{teacherAttPct}%</Text>
                                    <TouchableOpacity 
                                        style={styles.iconButton} 
                                        onPress={() => fetchAttendanceGraph(item.id, item.name)}
                                        disabled={loadingAttGraph}
                                    >
                                        {loadingAttGraph ? <ActivityIndicator size="small" color="#fff"/> : <Icon name="chart-bar" size={16} color="#fff" />}
                                        <Text style={styles.btnText}>GRAPH</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                        
                        {userRole === 'admin' ? (
                            item.details && item.details.length > 0 ? (
                                item.details.map((detail, idx) => {
                                    const dPerc = getRoundedPercentage(detail.average_marks);
                                    return (
                                        <View key={idx} style={[styles.detailBlock, { backgroundColor: COLORS.cardBg, borderColor: COLORS.detailBorder }]}>
                                            <View style={[styles.detailHeader, { borderBottomColor: COLORS.detailHeaderBorder }]}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.detailTitle, { color: COLORS.primary }]} numberOfLines={1}>{detail.class_group} - {detail.subject}</Text>
                                                </View>
                                                <TouchableOpacity style={styles.iconButton} onPress={() => handleOpenIndividualGraph(`${detail.class_group} - ${detail.subject}`, detail.exam_breakdown)}>
                                                    <Icon name="chart-bar" size={18} color="#fff" />
                                                </TouchableOpacity>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={[styles.detailMarks, { color: COLORS.textSub }]}>{Math.round(detail.total_marks)} / {Math.round(detail.max_possible_marks)}</Text>
                                                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: getStatusColor(dPerc, COLORS) }}>{dPerc}%</Text>
                                                </View>
                                            </View>
                                            {renderExamBreakdown(detail.exam_breakdown)}
                                        </View>
                                    );
                                })
                            ) : <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No detailed records found.</Text>
                        ) : (
                            <View style={[styles.detailBlock, { backgroundColor: COLORS.cardBg, borderColor: COLORS.detailBorder }]}>
                                <View style={[styles.detailHeader, { borderBottomColor: COLORS.detailHeaderBorder }]}>
                                    <Text style={[styles.detailTitle, { color: COLORS.primary }]}>Exam Analysis</Text>
                                    <TouchableOpacity style={[styles.iconButton, {flexDirection: 'row', width: 'auto', paddingHorizontal: 10}]} onPress={() => handleOpenIndividualGraph(`${item.name} - ${item.subName}`, item.examBreakdown)}>
                                        <Icon name="chart-bar" size={18} color="#fff" />
                                        <Text style={{color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 5}}>GRAPH</Text>
                                    </TouchableOpacity>
                                </View>
                                {renderExamBreakdown(item.examBreakdown)}
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    const renderExamBreakdown = (exams) => (
        <View style={styles.breakdownContainer}>
            <View style={[styles.bdHeader, { backgroundColor: COLORS.bdHeaderBg }]}>
                <Text style={[styles.bdHeaderTxt, { flex: 1.5, color: COLORS.textSub }]}>Exam</Text>
                <Text style={[styles.bdHeaderTxt, { flex: 2, textAlign: 'center', color: COLORS.textSub }]}>Marks</Text>
                <Text style={[styles.bdHeaderTxt, { flex: 1.5, textAlign: 'right', color: COLORS.textSub }]}>Perf %</Text>
            </View>
            {exams.map((exam, idx) => {
                const ePerc = getRoundedPercentage(exam.percentage);
                return (
                    <View key={idx} style={[styles.bdRow, { borderBottomColor: COLORS.detailBorder }]}>
                        <Text style={[styles.bdTxt, { flex: 1.5, fontWeight: '600', color: COLORS.textMain }]}>{exam.exam_type}</Text>
                        <Text style={[styles.bdTxt, { flex: 2, textAlign: 'center', color: COLORS.textMain }]}>{Math.round(exam.total_obtained)} / {Math.round(exam.total_possible)}</Text>
                        <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                            <View style={[styles.percentagePill, { backgroundColor: getStatusColor(ePerc, COLORS) }]}>
                                <Text style={styles.pillText}>{ePerc}%</Text>
                            </View>
                        </View>
                    </View>
                );
            })}
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar backgroundColor={COLORS.background} barStyle={isDark ? "light-content" : "dark-content"} />
            
            {/* --- HEADER --- */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                <View style={styles.headerLeft}>
                    {/* BACK BUTTON - Only for Admin */}
                    {userRole === 'admin' && (
                        <TouchableOpacity 
                            style={styles.backButton} 
                            onPress={() => navigation.goBack()}
                        >
                            <Icon name="arrow-left" size={24} color={COLORS.textMain} />
                        </TouchableOpacity>
                    )}

                    <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                        <Icon name="poll" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>{userRole === 'admin' ? 'Teacher Performance' : 'Class Performance'}</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Analytics & Reports</Text>
                    </View>
                </View>
                
                {userRole === 'admin' && (
                    <View style={{flexDirection: 'row', gap: 10}}>
                         <TouchableOpacity style={[styles.headerActionBtn, { backgroundColor: isDark ? '#333' : '#f0fdfa', borderColor: isDark ? '#444' : '#ccfbf1' }]} onPress={() => setIsTableView(!isTableView)}>
                            <Icon name={isTableView ? "card-bulleted-outline" : "table-large"} size={22} color={COLORS.primary} />
                         </TouchableOpacity>
                         <TouchableOpacity style={[styles.headerActionBtn, { backgroundColor: isDark ? '#333' : '#f0fdfa', borderColor: isDark ? '#444' : '#ccfbf1' }]} onPress={() => setIsCompareVisible(true)}>
                            <Icon name="scale-balance" size={22} color={COLORS.primary} />
                         </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Filter Section */}
            <View style={styles.filterContainer}>
                <View style={[styles.pickerWrapper, { backgroundColor: COLORS.cardBg, borderColor: COLORS.pickerBorder }]}>
                    <Picker 
                        selectedValue={sortBy} 
                        onValueChange={setSortBy} 
                        style={[styles.picker, { color: COLORS.textMain }]}
                        dropdownIconColor={COLORS.textMain}
                    >
                        <Picker.Item label="Sort: High to Low" value="high-low" style={{fontSize: 14}} />
                        <Picker.Item label="Sort: Low to High" value="low-high" style={{fontSize: 14}}/>
                    </Picker>
                </View>
            </View>

            {/* Note Section */}
            <View style={[styles.noteContainer, { backgroundColor: COLORS.noteBg, borderColor: COLORS.noteBorder }]}>
                <Text style={[styles.noteText, { color: COLORS.noteText }]}>
                    Note: Performance based on exam-wise marks of all students.
                </Text>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>
            ) : (
                isTableView ? (
                    <View style={{ flex: 1 }}>{renderTableView()}</View>
                ) : (
                    <FlatList
                        data={processedData}
                        keyExtractor={(item) => item.uniqueKey}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listPadding}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
                        ListEmptyComponent={<Text style={[styles.emptyText, { color: COLORS.textSub }]}>No data found.</Text>}
                    />
                )
            )}

            {/* Modal: Individual Graph */}
            <Modal visible={isGraphVisible} transparent={true} animationType="fade" onRequestClose={() => setIsGraphVisible(false)}>
                <View style={[styles.modalOverlay, { backgroundColor: COLORS.modalOverlay }]}>
                    <View style={[styles.graphModalCard, { backgroundColor: COLORS.cardBg }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalHeaderTitle, { color: COLORS.textMain }]}>Performance Stats</Text>
                            <TouchableOpacity onPress={() => setIsGraphVisible(false)}>
                                <Icon name="close-circle-outline" size={28} color={COLORS.textSub} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.graphSubTitle, { color: COLORS.textSub }]}>{individualGraphData?.title}</Text>
                        <View style={[styles.graphViewArea, { borderBottomColor: COLORS.border }]}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'flex-end' }}>
                                {individualGraphData?.exams && individualGraphData.exams.map((exam, idx) => (
                                    <AnimatedBar 
                                        key={idx} 
                                        percentage={exam.percentage} 
                                        marks={`${Math.round(exam.total_obtained)}/${Math.round(exam.total_possible)}`}
                                        label={exam.exam_type} 
                                        color={getStatusColor(exam.percentage, COLORS)}
                                        height={260}
                                        colors={COLORS}
                                    />
                                ))}
                            </ScrollView>
                        </View>
                        <View style={styles.legendRow}>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.success}]} /><Text style={[styles.legendTxt, {color: COLORS.textSub}]}>85-100%</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.average}]} /><Text style={[styles.legendTxt, {color: COLORS.textSub}]}>50-85%</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.poor}]} /><Text style={[styles.legendTxt, {color: COLORS.textSub}]}>0-50%</Text></View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal: Attendance Graph */}
            <Modal visible={isAttGraphVisible} transparent={true} animationType="fade" onRequestClose={() => setIsAttGraphVisible(false)}>
                <View style={[styles.modalOverlay, { backgroundColor: COLORS.modalOverlay }]}>
                    <View style={[styles.graphModalCard, { backgroundColor: COLORS.cardBg }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalHeaderTitle, { color: COLORS.textMain }]}>Attendance Stats</Text>
                            <TouchableOpacity onPress={() => setIsAttGraphVisible(false)}>
                                <Icon name="close-circle-outline" size={28} color={COLORS.textSub} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.graphSubTitle, { color: COLORS.textSub }]}>{attGraphData?.title}</Text>
                        <View style={[styles.graphViewArea, { borderBottomColor: COLORS.border }]}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'flex-end' }}>
                                {attGraphData?.data && attGraphData.data.length > 0 ? attGraphData.data.map((att, idx) => (
                                    <AnimatedBar 
                                        key={idx} 
                                        percentage={att.percentage} 
                                        marks={`${att.present}/${att.total}`}
                                        label={att.month} 
                                        color={getStatusColor(att.percentage, COLORS)}
                                        height={260}
                                        colors={COLORS}
                                    />
                                )) : <Text style={[styles.noDataTxt, { color: COLORS.textSub }]}>No attendance records found.</Text>}
                            </ScrollView>
                        </View>
                        <View style={styles.legendRow}>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.success}]} /><Text style={[styles.legendTxt, {color: COLORS.textSub}]}>85-100%</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.average}]} /><Text style={[styles.legendTxt, {color: COLORS.textSub}]}>50-85%</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.poor}]} /><Text style={[styles.legendTxt, {color: COLORS.textSub}]}>0-50%</Text></View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal: Global Comparison */}
            <Modal visible={isCompareVisible} animationType="slide" onRequestClose={() => setIsCompareVisible(false)}>
                <View style={[styles.fullScreenContainer, { backgroundColor: COLORS.background }]}>
                    <View style={[styles.fsHeader, { backgroundColor: COLORS.cardBg }]}>
                        <Text style={[styles.fsTitle, { color: COLORS.textMain }]}>Teacher Comparison</Text>
                        <TouchableOpacity onPress={() => setIsCompareVisible(false)} style={styles.closeFsBtn}>
                            <Icon name="close" size={24} color={COLORS.textMain} />
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.compareControls, { backgroundColor: COLORS.cardBg }]}>
                        <View style={styles.compareControlRow}>
                            <Text style={[styles.controlLabel, { color: COLORS.textSub }]}>Exam Type:</Text>
                            <View style={[styles.controlPicker, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                                <Picker selectedValue={compareExam} onValueChange={setCompareExam} dropdownIconColor={COLORS.textMain} style={{color: COLORS.textMain}}>
                                    {EXAM_TYPES.map(t => <Picker.Item key={t} label={t} value={t} style={{fontSize: 14}} />)}
                                </Picker>
                            </View>
                        </View>
                        
                        {/* Sort Filter */}
                        <View style={styles.compareControlRow}>
                            <Text style={[styles.controlLabel, { color: COLORS.textSub }]}>Sort Order:</Text>
                            <View style={[styles.controlPicker, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                                <Picker selectedValue={compareSortBy} onValueChange={setCompareSortBy} dropdownIconColor={COLORS.textMain} style={{color: COLORS.textMain}}>
                                    <Picker.Item label="High to Low" value="high-low" style={{fontSize: 14}} />
                                    <Picker.Item label="Low to High" value="low-high" style={{fontSize: 14}} />
                                </Picker>
                            </View>
                        </View>

                        {compareExam !== 'Overall' && (
                            <View style={styles.compareControlRow}>
                                <Text style={[styles.controlLabel, { color: COLORS.textSub }]}>Class:</Text>
                                <View style={[styles.controlPicker, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                                    <Picker selectedValue={compareClass} onValueChange={setCompareClass} dropdownIconColor={COLORS.textMain} style={{color: COLORS.textMain}}>
                                        {availableClasses.map(c => <Picker.Item key={c} label={c} value={c} style={{fontSize: 14}} />)}
                                    </Picker>
                                </View>
                            </View>
                        )}
                    </View>
                    <View style={styles.compareGraphArea}>
                        <Text style={[styles.compareGraphTitle, { color: COLORS.primary }]}>Ranking by {compareExam} {compareClass !== 'All Classes' ? `(${compareClass})` : ''}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, alignItems: 'flex-end' }}>
                            {getComparisonData().length > 0 ? (
                                getComparisonData().map((item, idx) => {
                                    const shortName = item.name.split(' ')[0];
                                    return (
                                        <AnimatedBar 
                                            key={idx}
                                            percentage={item.percentage}
                                            marks={`${Math.round(item.total_obtained)}/${Math.round(item.total_possible)}`}
                                            label={shortName}
                                            subLabel={item.subject}
                                            color={getStatusColor(item.percentage, COLORS)}
                                            height={320}
                                            colors={COLORS}
                                        />
                                    );
                                })
                            ) : (
                                <View style={styles.noDataContainer}>
                                    <Icon name="chart-bar-stacked" size={40} color={COLORS.border} />
                                    <Text style={[styles.noDataTxt, { color: COLORS.textSub }]}>No data available for this selection.</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    
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
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, 
        shadowRadius: 4,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    backButton: {
        marginRight: 4,
        padding: 5,
        marginLeft: -3,
    },
    headerIconContainer: {
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 19, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },
    headerActionBtn: {
        padding: 6,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },

    // --- FILTERS & NOTE ---
    filterContainer: { paddingHorizontal: 15, marginBottom: 5 },
    pickerWrapper: {
        borderWidth: 1, borderRadius: 8, marginBottom: 5,
        overflow: 'hidden', height: 45, justifyContent: 'center'
    },
    picker: { width: '100%' },
    
    noteContainer: {
        marginHorizontal: 15,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 10
    },
    noteText: { fontSize: 11, fontWeight: 'bold', textAlign: 'center' },

    // --- GENERAL ---
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listPadding: { paddingHorizontal: 15, paddingBottom: 40 },
    emptyText: { textAlign: 'center', marginTop: 30, fontStyle: 'italic' },

    // --- TABLE STYLES ---
    tableScrollContainer: { paddingHorizontal: 15, paddingBottom: 20 },
    tableContainer: { 
        borderRadius: 8, 
        overflow: 'hidden', 
        elevation: 2, 
        borderWidth: 1,
    },
    tableHeaderRow: { 
        flexDirection: 'row', 
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    headerCellContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 2
    },
    tableHeaderCell: { 
        color: '#FFFFFF', 
        fontWeight: 'bold', 
        fontSize: 11, 
        textAlign: 'center' 
    },
    tableRow: { 
        flexDirection: 'row', 
        borderBottomWidth: 1, 
        alignItems: 'center', 
        minHeight: 50 
    },
    
    cellContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 2
    },
    tableCell: { 
        fontSize: 12, 
        textAlign: 'center' 
    },
    
    subRowItem: {
        width: '100%',
        paddingVertical: 4,
        borderBottomWidth: 0.5,
        alignItems: 'center',
        justifyContent: 'center'
    },
    detailRowText: { fontSize: 11, textAlign: 'center' },
    
    tableGraphBtn: {
        backgroundColor: '#FB8C00',
        padding: 4,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        marginLeft: 5
    },

    // --- CARDS ---
    card: { borderRadius: 12, marginBottom: 15, elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3, overflow: 'hidden' },
    cardContent: { flexDirection: 'row' },
    rankStrip: { width: 36, justifyContent: 'center', alignItems: 'center' },
    rankText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, transform: [{ rotate: '-90deg' }], width: 60, textAlign: 'center' },
    cardBody: { flex: 1, padding: 15 },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
    teacherName: { fontSize: 16, fontWeight: '700' },
    subName: { fontSize: 13, marginTop: 2 },
    circleBadge: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
    circleText: { fontSize: 13, fontWeight: 'bold' },
    marksLabel: { fontSize: 12, marginTop: 8, marginBottom: 4 },
    marksValue: { fontWeight: 'bold' },
    progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
    progressFill: { height: '100%', borderRadius: 3 },
    expandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    perfLabel: { fontSize: 11, fontWeight: '600' },
    
    // Expanded Section
    expandedSection: { borderTopWidth: 1, padding: 15 },
    
    // --- ATTENDANCE ROW ---
    attRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 10, borderBottomWidth: 1 },
    attLabel: { fontSize: 14, fontWeight: '600' },
    attValue: { fontSize: 16, fontWeight: 'bold' },
    btnText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', marginLeft: 5 },

    // Details
    detailBlock: { marginBottom: 20, padding: 10, borderRadius: 8, borderWidth: 1 },
    detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1 },
    detailTitle: { fontSize: 14, fontWeight: 'bold' },
    detailMarks: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
    iconButton: { flexDirection: 'row', backgroundColor: '#FB8C00', padding: 6, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 },
    breakdownContainer: { paddingHorizontal: 4 },
    bdHeader: { flexDirection: 'row', marginBottom: 6, paddingVertical: 6, borderRadius: 4 },
    bdHeaderTxt: { fontSize: 11, fontWeight: '700' },
    bdRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, alignItems: 'center' },
    bdTxt: { fontSize: 12 },
    percentagePill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10 },
    pillText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

    // --- MODAL ---
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    graphModalCard: { width: '90%', borderRadius: 16, padding: 20, elevation: 15, maxHeight: SCREEN_HEIGHT * 0.8 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    modalHeaderTitle: { fontSize: 18, fontWeight: 'bold' },
    graphSubTitle: { textAlign: 'center', marginBottom: 25, fontSize: 14, fontWeight: '600', textTransform: 'uppercase' },
    graphViewArea: { height: 300, borderBottomWidth: 1, paddingBottom: 10 },
    
    // --- BARS ---
    barWrapper: { width: 45, alignItems: 'center', justifyContent: 'flex-end', marginHorizontal: 12 },
    barLabelTop: { marginBottom: 6, fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
    barBackground: { width: 34, height: '80%', borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end', position: 'relative' },
    barFill: { width: '100%', borderRadius: 6 },
    barTextContainer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    barInnerText: { fontSize: 10, fontWeight: 'bold', transform: [{ rotate: '-90deg' }], width: 200, textAlign: 'center' },
    barLabelBottom: { marginTop: 10, fontSize: 12, fontWeight: 'bold', textAlign: 'center', width: 60 },
    barSubLabel: { marginTop: 0, fontSize: 10, fontWeight: '500', textAlign: 'center', width: 60 },
    
    // --- LEGEND ---
    legendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 15 },
    legendItem: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
    legendTxt: { fontSize: 12, fontWeight: '500' },

    // Full Screen Compare
    fullScreenContainer: { flex: 1 },
    fsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, elevation: 3 },
    fsTitle: { fontSize: 18, fontWeight: 'bold' },
    closeFsBtn: { padding: 4 },
    compareControls: { padding: 16, marginBottom: 10 },
    compareControlRow: { marginBottom: 12 },
    controlLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
    controlPicker: { borderWidth: 1, borderRadius: 8, height: 45, justifyContent: 'center' },
    compareGraphArea: { flex: 1, paddingVertical: 20 },
    compareGraphTitle: { textAlign: 'center', fontSize: 16, fontWeight: 'bold', marginBottom: 20 },
    noDataContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', width: SCREEN_WIDTH },
    noDataTxt: { marginTop: 10 },
});

export default TeacherPerformanceScreen;