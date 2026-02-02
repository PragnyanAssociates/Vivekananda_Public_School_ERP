/**
 * File: src/screens/report/TeacherPerformanceScreen.js
 * Purpose: Teacher Performance Analytics with Table View, Class-wise Max Mark Logic, and Attendance Graph.
 * Updated: Added Overall Attendance Row and Month-wise Graph Pop-up.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator,
    FlatList, TouchableOpacity, RefreshControl, LayoutAnimation, 
    Platform, UIManager, Modal, ScrollView, Animated, Easing, Dimensions, Alert
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

// --- Constants ---
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const EXAM_TYPES = ['Overall', 'AT1', 'UT1', 'AT2', 'UT2', 'AT3', 'UT3', 'AT4', 'UT4', 'SA1', 'SA2', 'Pre-Final'];

// --- COLORS ---
const COLORS = {
    primary: '#008080',    // Teal
    background: '#F2F5F8', // Light Grey-Blue
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    
    success: '#43A047',    // Green
    average: '#1E88E5',    // Blue
    poor: '#E53935',       // Red
    
    track: '#F5F5F5',      // Light Gray for Bar Background
    border: '#CFD8DC'
};

// --- HELPER: CUSTOM ROUNDING ---
const getRoundedPercentage = (value) => {
    const floatVal = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(floatVal)) return 0;
    const decimalPart = floatVal - Math.floor(floatVal);
    return decimalPart > 0.5 ? Math.ceil(floatVal) : Math.floor(floatVal);
};

// --- HELPER: GET COLOR ---
const getStatusColor = (percentage) => {
    const val = getRoundedPercentage(percentage);
    if (val >= 85) return COLORS.success; 
    if (val >= 50) return COLORS.average;
    return COLORS.poor; 
};

// --- COMPONENT: ANIMATED BAR (Updated Design) ---
const AnimatedBar = ({ percentage, marks, label, subLabel, color, height = 260 }) => {
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
            {/* Percentage on Top */}
            <Text style={styles.barLabelTop}>{displayPercentage}%</Text>
            
            {/* Bar Track */}
            <View style={styles.barBackground}>
                {/* Colored Fill */}
                <Animated.View style={[styles.barFill, { height: heightStyle, backgroundColor: color }]} />
                
                {/* Marks Text (Rotated and Centered over the track) */}
                <View style={styles.barTextContainer}>
                    <Text style={styles.barInnerText} numberOfLines={1}>{marks}</Text>
                </View>
            </View>
            
            {/* Label Bottom */}
            <Text style={styles.barLabelBottom} numberOfLines={1}>{label}</Text>
            {subLabel ? <Text style={styles.barSubLabel} numberOfLines={1}>{subLabel}</Text> : null}
        </View>
    );
};

const TeacherPerformanceScreen = () => {
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
    const [isGraphVisible, setIsGraphVisible] = useState(false); // For Exams
    const [individualGraphData, setIndividualGraphData] = useState(null);
    
    // Attendance Graph States
    const [isAttGraphVisible, setIsAttGraphVisible] = useState(false);
    const [attGraphData, setAttGraphData] = useState(null);
    const [loadingAttGraph, setLoadingAttGraph] = useState(false);

    const [isCompareVisible, setIsCompareVisible] = useState(false);
    
    // Filter States
    const [sortBy, setSortBy] = useState('high-low');
    
    // Comparison States
    const [compareExam, setCompareExam] = useState('Overall');
    const [compareClass, setCompareClass] = useState('All Classes');
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
            
            // Fetch attendance summaries regardless of view mode (Table or List)
            // so percentages are ready when expanding a card.
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

    // --- FETCH ATTENDANCE GRAPH DATA ---
    const fetchAttendanceGraph = async (tId, teacherName) => {
        setLoadingAttGraph(true);
        const currentYear = new Date().getFullYear().toString();
        
        try {
            // Using the 'yearly' logic from your reference code
            const response = await apiClient.get(`/teacher-attendance/report/${tId}`, {
                params: { period: 'yearly', targetYear: currentYear }
            });

            const history = response.data.detailedHistory || [];
            
            // Process into months (Jan, Feb...)
            const monthsMap = {};
            history.forEach(rec => {
                const d = new Date(rec.date);
                const monthIdx = d.getMonth(); // 0-11
                const monthName = d.toLocaleString('default', { month: 'short' });
                const sortKey = d.getFullYear() * 100 + monthIdx;

                if (!monthsMap[sortKey]) {
                    monthsMap[sortKey] = { name: monthName, present: 0, total: 0 };
                }

                // Total = Present + Absent + Late (Assume strict counting of working days)
                if (['P', 'A', 'L'].includes(rec.status)) {
                    monthsMap[sortKey].total++;
                }
                if (rec.status === 'P') {
                    monthsMap[sortKey].present++;
                }
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

            setAttGraphData({
                title: teacherName.toUpperCase(),
                data: processed
            });
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
        .sort((a, b) => b.percentage - a.percentage);
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

    // --- RENDER TABLE ---
    const renderTableView = () => {
        return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15 }}>
                <View style={styles.tableContainer}>
                    <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, { width: 45 }]}>No</Text>
                        <Text style={[styles.tableHeaderCell, { width: 120, textAlign: 'left', paddingLeft: 5 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { width: 170 }]}>Subject / Class</Text>
                        <Text style={[styles.tableHeaderCell, { width: 90 }]}>Performance</Text>
                        <Text style={[styles.tableHeaderCell, { width: 90 }]}>Attendance</Text>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {processedData.map((item, index) => {
                            const attPercentageStr = attendanceData[item.id] !== undefined && attendanceData[item.id] !== 'N/A' 
                                ? `${attendanceData[item.id]}%` : '-';
                            const attVal = attendanceData[item.id] !== 'N/A' ? attendanceData[item.id] : 0;
                            const attColor = getStatusColor(attVal);

                            return (
                                <View key={item.uniqueKey} style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
                                    <View style={{ width: 45, justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={styles.tableCell}>{index + 1}</Text>
                                    </View>
                                    <View style={{ width: 120, justifyContent: 'center', paddingLeft: 5 }}>
                                        <Text style={[styles.tableCell, { fontWeight: 'bold' }]} numberOfLines={2}>{item.name}</Text>
                                    </View>
                                    <View style={{ width: 170, justifyContent: 'center' }}>
                                        {item.details && item.details.length > 0 ? (
                                            item.details.map((d, i) => (
                                                <View key={i} style={styles.detailRowItem}>
                                                    <Text style={styles.detailRowText}>{d.class_group} - {d.subject}</Text>
                                                </View>
                                            ))
                                        ) : (
                                            <View style={styles.detailRowItem}><Text style={styles.detailRowText}>N/A</Text></View>
                                        )}
                                    </View>
                                    <View style={{ width: 90, justifyContent: 'center', alignItems: 'center' }}>
                                        {item.details && item.details.length > 0 ? (
                                            item.details.map((d, i) => {
                                                const dPerc = getRoundedPercentage(d.average_marks);
                                                return (
                                                    <View key={i} style={styles.detailRowItem}>
                                                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: getStatusColor(dPerc) }}>{dPerc}%</Text>
                                                    </View>
                                                )
                                            })
                                        ) : (
                                            <View style={styles.detailRowItem}><Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.poor }}>0%</Text></View>
                                        )}
                                    </View>
                                    <View style={{ width: 90, justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={{ fontWeight: 'bold', color: attColor }}>{attPercentageStr}</Text>
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
        const performanceColor = getStatusColor(item.percentage);
        const isExpanded = expandedId === item.uniqueKey;
        const percentage = item.percentage;
        
        // Attendance Data for this card
        const teacherAttPct = attendanceData[item.id] !== undefined ? attendanceData[item.id] : 'N/A';
        const attColor = getStatusColor(teacherAttPct === 'N/A' ? 0 : teacherAttPct);

        return (
            <View style={styles.card}>
                <TouchableOpacity style={styles.cardContent} onPress={() => toggleExpand(item.uniqueKey)} activeOpacity={0.8}>
                    <View style={[styles.rankStrip, { backgroundColor: rankStripColor }]}>
                        <Text style={styles.rankText}>#{item.performanceRank}</Text>
                    </View>
                    <View style={styles.cardBody}>
                        <View style={styles.cardTopRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.teacherName}>{item.name}</Text>
                                {item.subName && <Text style={styles.subName}>{item.subName}</Text>}
                            </View>
                            <View style={[styles.circleBadge, { borderColor: performanceColor }]}>
                                <Text style={[styles.circleText, { color: performanceColor }]}>{percentage}%</Text>
                            </View>
                        </View>
                        <Text style={styles.marksLabel}>Total: <Text style={styles.marksValue}>{Math.round(item.totalManaged)} / {Math.round(item.maxPossible)}</Text></Text>
                        <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${Math.min(item.percentage, 100)}%`, backgroundColor: performanceColor }]} />
                        </View>
                        <View style={styles.expandRow}>
                            <Text style={styles.perfLabel}>Performance: {percentage}%</Text>
                            <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textSub} />
                        </View>
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.expandedSection}>
                        {/* --- ATTENDANCE ROW (Inserted Here) --- */}
                        {userRole === 'admin' && (
                            <View style={styles.attRow}>
                                <Text style={styles.attLabel}>Overall Attendance:</Text>
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
                        
                        {/* --- Detailed Performance --- */}
                        {userRole === 'admin' ? (
                            item.details && item.details.length > 0 ? (
                                item.details.map((detail, idx) => {
                                    const dPerc = getRoundedPercentage(detail.average_marks);
                                    return (
                                        <View key={idx} style={styles.detailBlock}>
                                            <View style={styles.detailHeader}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.detailTitle} numberOfLines={1}>{detail.class_group} - {detail.subject}</Text>
                                                </View>
                                                <TouchableOpacity style={styles.iconButton} onPress={() => handleOpenIndividualGraph(`${detail.class_group} - ${detail.subject}`, detail.exam_breakdown)}>
                                                    <Icon name="chart-bar" size={18} color="#fff" />
                                                </TouchableOpacity>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.detailMarks}>{Math.round(detail.total_marks)} / {Math.round(detail.max_possible_marks)}</Text>
                                                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: getStatusColor(dPerc) }}>{dPerc}%</Text>
                                                </View>
                                            </View>
                                            {renderExamBreakdown(detail.exam_breakdown)}
                                        </View>
                                    );
                                })
                            ) : <Text style={styles.emptyText}>No detailed records found.</Text>
                        ) : (
                            <View style={styles.detailBlock}>
                                <View style={styles.detailHeader}>
                                    <Text style={styles.detailTitle}>Exam Analysis</Text>
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
            <View style={styles.bdHeader}>
                <Text style={[styles.bdHeaderTxt, { flex: 1.5 }]}>Exam</Text>
                <Text style={[styles.bdHeaderTxt, { flex: 2, textAlign: 'center' }]}>Marks</Text>
                <Text style={[styles.bdHeaderTxt, { flex: 1.5, textAlign: 'right' }]}>Perf %</Text>
            </View>
            {exams.map((exam, idx) => {
                const ePerc = getRoundedPercentage(exam.percentage);
                return (
                    <View key={idx} style={styles.bdRow}>
                        <Text style={[styles.bdTxt, { flex: 1.5, fontWeight: '600' }]}>{exam.exam_type}</Text>
                        <Text style={[styles.bdTxt, { flex: 2, textAlign: 'center' }]}>{Math.round(exam.total_obtained)} / {Math.round(exam.total_possible)}</Text>
                        <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                            <View style={[styles.percentagePill, { backgroundColor: getStatusColor(ePerc) }]}>
                                <Text style={styles.pillText}>{ePerc}%</Text>
                            </View>
                        </View>
                    </View>
                );
            })}
        </View>
    );

    return (
        <View style={styles.container}>
            
            {/* --- NEW HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <Icon name="poll" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>{userRole === 'admin' ? 'Teacher Performance' : 'Class Performance'}</Text>
                        <Text style={styles.headerSubtitle}>Analytics & Reports</Text>
                    </View>
                </View>
                
                {/* Admin Actions inside Header */}
                {userRole === 'admin' && (
                    <View style={{flexDirection: 'row', gap: 10}}>
                         <TouchableOpacity style={styles.headerActionBtn} onPress={() => setIsTableView(!isTableView)}>
                            <Icon name={isTableView ? "card-bulleted-outline" : "table-large"} size={22} color="#008080" />
                         </TouchableOpacity>
                         <TouchableOpacity style={styles.headerActionBtn} onPress={() => setIsCompareVisible(true)}>
                            <Icon name="scale-balance" size={22} color="#008080" />
                         </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Filter Section */}
            <View style={styles.filterContainer}>
                <View style={styles.pickerWrapper}>
                    <Picker selectedValue={sortBy} onValueChange={setSortBy} style={styles.picker}>
                        <Picker.Item label="Sort: High to Low" value="high-low" />
                        <Picker.Item label="Sort: Low to High" value="low-high" />
                    </Picker>
                </View>
            </View>

            {/* Note Section */}
            <View style={styles.noteContainer}>
                <Text style={styles.noteText}>
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
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                        ListEmptyComponent={<Text style={styles.emptyText}>No data found.</Text>}
                    />
                )
            )}

            {/* Modal: Individual Graph (Exams) */}
            <Modal visible={isGraphVisible} transparent={true} animationType="fade" onRequestClose={() => setIsGraphVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.graphModalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalHeaderTitle}>Performance Stats</Text>
                            <TouchableOpacity onPress={() => setIsGraphVisible(false)}>
                                <Icon name="close-circle-outline" size={28} color={COLORS.textSub} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.graphSubTitle}>{individualGraphData?.title}</Text>
                        <View style={styles.graphViewArea}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'flex-end' }}>
                                {individualGraphData?.exams && individualGraphData.exams.map((exam, idx) => (
                                    <AnimatedBar 
                                        key={idx} 
                                        percentage={exam.percentage} 
                                        marks={`${Math.round(exam.total_obtained)}/${Math.round(exam.total_possible)}`}
                                        label={exam.exam_type} 
                                        color={getStatusColor(exam.percentage)}
                                        height={260}
                                    />
                                ))}
                            </ScrollView>
                        </View>
                        <View style={styles.legendRow}>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.success}]} /><Text style={styles.legendTxt}>85-100%</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.average}]} /><Text style={styles.legendTxt}>50-85%</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.poor}]} /><Text style={styles.legendTxt}>0-50%</Text></View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal: Attendance Graph (NEW) */}
            <Modal visible={isAttGraphVisible} transparent={true} animationType="fade" onRequestClose={() => setIsAttGraphVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.graphModalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalHeaderTitle}>Attendance Stats</Text>
                            <TouchableOpacity onPress={() => setIsAttGraphVisible(false)}>
                                <Icon name="close-circle-outline" size={28} color={COLORS.textSub} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.graphSubTitle}>{attGraphData?.title}</Text>
                        <View style={styles.graphViewArea}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, alignItems: 'flex-end' }}>
                                {attGraphData?.data && attGraphData.data.length > 0 ? attGraphData.data.map((att, idx) => (
                                    <AnimatedBar 
                                        key={idx} 
                                        percentage={att.percentage} 
                                        marks={`${att.present}/${att.total}`}
                                        label={att.month} 
                                        color={getStatusColor(att.percentage)}
                                        height={260}
                                    />
                                )) : <Text style={styles.noDataTxt}>No attendance records found.</Text>}
                            </ScrollView>
                        </View>
                        <View style={styles.legendRow}>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.success}]} /><Text style={styles.legendTxt}>85-100%</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.average}]} /><Text style={styles.legendTxt}>50-85%</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.poor}]} /><Text style={styles.legendTxt}>0-50%</Text></View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal: Global Comparison */}
            <Modal visible={isCompareVisible} animationType="slide" onRequestClose={() => setIsCompareVisible(false)}>
                <View style={styles.fullScreenContainer}>
                    <View style={styles.fsHeader}>
                        <Text style={styles.fsTitle}>Teacher Comparison</Text>
                        <TouchableOpacity onPress={() => setIsCompareVisible(false)} style={styles.closeFsBtn}>
                            <Icon name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.compareControls}>
                        <View style={styles.compareControlRow}>
                            <Text style={styles.controlLabel}>Exam Type:</Text>
                            <View style={styles.controlPicker}>
                                <Picker selectedValue={compareExam} onValueChange={setCompareExam}>
                                    {EXAM_TYPES.map(t => <Picker.Item key={t} label={t} value={t} />)}
                                </Picker>
                            </View>
                        </View>
                        {compareExam !== 'Overall' && (
                            <View style={styles.compareControlRow}>
                                <Text style={styles.controlLabel}>Class:</Text>
                                <View style={styles.controlPicker}>
                                    <Picker selectedValue={compareClass} onValueChange={setCompareClass}>
                                        {availableClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
                                    </Picker>
                                </View>
                            </View>
                        )}
                    </View>
                    <View style={styles.compareGraphArea}>
                        <Text style={styles.compareGraphTitle}>Ranking by {compareExam} {compareClass !== 'All Classes' ? `(${compareClass})` : ''}</Text>
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
                                            color={getStatusColor(item.percentage)}
                                            height={320}
                                        />
                                    );
                                })
                            ) : (
                                <View style={styles.noDataContainer}>
                                    <Icon name="chart-bar-stacked" size={40} color="#CCC" />
                                    <Text style={styles.noDataTxt}>No data available for this selection.</Text>
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
    container: { flex: 1, backgroundColor: COLORS.background },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: '#FFFFFF',
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
    headerActionBtn: {
        padding: 5,
        backgroundColor: '#f0fdfa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ccfbf1'
    },

    // --- FILTERS & NOTE ---
    filterContainer: { paddingHorizontal: 15, marginBottom: 5 },
    pickerWrapper: {
        borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginBottom: 5,
        backgroundColor: '#fff', overflow: 'hidden', height: 45, justifyContent: 'center'
    },
    picker: { width: '100%', color: '#1f2937' },
    
    noteContainer: {
        backgroundColor: '#FFF8E1', 
        marginHorizontal: 15,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFE0B2', 
        marginBottom: 10
    },
    noteText: { fontSize: 11, color: '#F57C00', fontWeight: 'bold', textAlign: 'center' },

    // --- GENERAL ---
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listPadding: { paddingHorizontal: 15, paddingBottom: 40 },
    emptyText: { textAlign: 'center', color: COLORS.textSub, marginTop: 30, fontStyle: 'italic' },

    // --- TABLE ---
    tableContainer: { backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', elevation: 2, marginBottom: 20 },
    tableHeaderRow: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 5 },
    tableHeaderCell: { color: '#FFF', fontWeight: 'bold', fontSize: 11, textAlign: 'center' },
    tableRow: { flexDirection: 'row', backgroundColor: '#FFF', paddingVertical: 0, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: '#EEE', alignItems: 'center', minHeight: 50 },
    tableRowAlt: { backgroundColor: '#F9FAFB' },
    tableCell: { fontSize: 12, color: COLORS.textMain, textAlign: 'center' },
    detailRowItem: { height: 30, justifyContent: 'center', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', width: '100%' },
    detailRowText: { fontSize: 11, color: COLORS.textSub, textAlign: 'center' },

    // --- CARDS ---
    card: { backgroundColor: COLORS.cardBg, borderRadius: 12, marginBottom: 15, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3, overflow: 'hidden' },
    cardContent: { flexDirection: 'row' },
    rankStrip: { width: 36, justifyContent: 'center', alignItems: 'center' },
    rankText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, transform: [{ rotate: '-90deg' }], width: 60, textAlign: 'center' },
    cardBody: { flex: 1, padding: 15 },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
    teacherName: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
    subName: { fontSize: 13, color: COLORS.textSub, marginTop: 2 },
    circleBadge: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
    circleText: { fontSize: 13, fontWeight: 'bold' },
    marksLabel: { fontSize: 12, color: COLORS.textSub, marginTop: 8, marginBottom: 4 },
    marksValue: { fontWeight: 'bold', color: COLORS.textMain },
    progressTrack: { height: 6, backgroundColor: COLORS.track, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
    progressFill: { height: '100%', borderRadius: 3 },
    expandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    perfLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSub },
    
    // Expanded Section
    expandedSection: { backgroundColor: '#FAFAFA', borderTopWidth: 1, borderTopColor: '#EEE', padding: 15 },
    
    // --- ATTENDANCE ROW ---
    attRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
    attLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textMain },
    attValue: { fontSize: 16, fontWeight: 'bold' },
    btnText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', marginLeft: 5 },

    // Details
    detailBlock: { marginBottom: 20, backgroundColor: '#FFF', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#F0F0F0' },
    detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    detailTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary },
    detailMarks: { fontSize: 11, color: COLORS.textSub, fontWeight: '600', marginBottom: 2 },
    iconButton: { flexDirection: 'row', backgroundColor: '#FB8C00', padding: 6, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 },
    breakdownContainer: { paddingHorizontal: 4 },
    bdHeader: { flexDirection: 'row', marginBottom: 6, backgroundColor: '#F9FAFB', paddingVertical: 6, borderRadius: 4 },
    bdHeaderTxt: { fontSize: 11, fontWeight: '700', color: COLORS.textSub },
    bdRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', alignItems: 'center' },
    bdTxt: { fontSize: 12, color: COLORS.textMain },
    percentagePill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10 },
    pillText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

    // --- MODAL ---
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    graphModalCard: { width: '90%', backgroundColor: '#FFF', borderRadius: 16, padding: 20, elevation: 15, maxHeight: SCREEN_HEIGHT * 0.8 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    modalHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
    graphSubTitle: { textAlign: 'center', color: COLORS.textSub, marginBottom: 25, fontSize: 14, fontWeight: '600', textTransform: 'uppercase' },
    graphViewArea: { height: 300, borderBottomWidth: 1, borderBottomColor: '#ECEFF1', paddingBottom: 10 },
    
    // --- BARS ---
    barWrapper: { width: 45, alignItems: 'center', justifyContent: 'flex-end', marginHorizontal: 12 },
    barLabelTop: { marginBottom: 6, fontSize: 12, fontWeight: 'bold', textAlign: 'center', color: COLORS.textMain },
    barBackground: { width: 34, height: '80%', backgroundColor: '#F5F5F5', borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end', position: 'relative' },
    barFill: { width: '100%', borderRadius: 6 },
    // Text inside the bar track
    barTextContainer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    barInnerText: { fontSize: 10, fontWeight: 'bold', color: '#000', transform: [{ rotate: '-90deg' }], width: 200, textAlign: 'center' },
    barLabelBottom: { marginTop: 10, fontSize: 12, fontWeight: 'bold', color: COLORS.textMain, textAlign: 'center', width: 60 },
    barSubLabel: { marginTop: 0, fontSize: 10, fontWeight: '500', color: COLORS.textSub, textAlign: 'center', width: 60 },
    
    // --- LEGEND ---
    legendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 15 },
    legendItem: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
    legendTxt: { fontSize: 12, color: COLORS.textSub, fontWeight: '500' },

    // Full Screen Compare
    fullScreenContainer: { flex: 1, backgroundColor: COLORS.background },
    fsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', elevation: 3 },
    fsTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
    closeFsBtn: { padding: 4 },
    compareControls: { padding: 16, backgroundColor: '#FFF', marginBottom: 10 },
    compareControlRow: { marginBottom: 12 },
    controlLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSub, marginBottom: 6 },
    controlPicker: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: '#FAFAFA', height: 45, justifyContent: 'center' },
    compareGraphArea: { flex: 1, paddingVertical: 20 },
    compareGraphTitle: { textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: COLORS.primary, marginBottom: 20 },
    noDataContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', width: SCREEN_WIDTH },
    noDataTxt: { marginTop: 10, color: COLORS.textSub },
});

export default TeacherPerformanceScreen;