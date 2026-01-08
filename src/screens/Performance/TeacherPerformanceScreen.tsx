/**
 * File: src/screens/report/TeacherPerformanceScreen.js
 * Purpose: Teacher Performance Analytics with Table View and Class-wise Max Mark Logic.
 * Updated: Rectangular Bars in Comparison Graph.
 * Updated: Added Subject Name below Teacher Name in Comparison Graph.
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

// Mapping for consistency with Backend
const EXAM_TYPES = ['Overall', 'AT1', 'UT1', 'AT2', 'UT2', 'AT3', 'UT3', 'AT4', 'UT4', 'SA1', 'SA2', 'Pre-Final'];

// --- COLORS ---
const COLORS = {
    primary: '#00897B',    // Teal (Header/Rank 2)
    background: '#F5F7FA', // Light Grey-Blue
    cardBg: '#FFFFFF',
    textMain: '#263238',   // Dark Slate
    textSub: '#546E7A',    // Slate Grey
    
    // --- UPDATED STATUS COLORS ---
    success: '#43A047',    // Green (85% - 100%)
    average: '#1E88E5',    // Blue (50% - 85%)
    poor: '#E53935',       // Red (0% - 50%)
    
    track: '#ECEFF1',      // Light Grey for bar track
    border: '#CFD8DC'
};

// --- HELPER: CUSTOM ROUNDING ---
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

// --- HELPER: GET COLOR BASED ON PERCENTAGE ---
// 85-100: Green, 50-85: Blue, 0-50: Red
const getStatusColor = (percentage) => {
    const val = getRoundedPercentage(percentage);
    if (val >= 85) return COLORS.success; 
    if (val >= 50) return COLORS.average;
    return COLORS.poor; 
};

// --- COMPONENT: ANIMATED BAR ---
// Updated: Supports subLabel (Subject) and Rectangular shape
const AnimatedBar = ({ percentage, marks, label, subLabel, color, height = 200 }) => {
    const animatedHeight = useRef(new Animated.Value(0)).current;

    // Use rounded integer for display
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
            <Text style={styles.barLabelTop}>
                {displayPercentage}%
            </Text>
            {/* Rectangular Bar Background */}
            <View style={styles.barBackground}>
                <Animated.View 
                    style={[
                        styles.barFill, 
                        { height: heightStyle, backgroundColor: color }
                    ]} 
                />
                <View style={styles.barTextContainer}>
                    <Text style={styles.barInnerText} numberOfLines={1}>
                        {marks}
                    </Text>
                </View>
            </View>
            <Text style={styles.barLabelBottom} numberOfLines={1}>{label}</Text>
            {/* Added Subject Label */}
            {subLabel ? (
                <Text style={styles.barSubLabel} numberOfLines={1}>{subLabel}</Text>
            ) : null}
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
    const [loadingAttendance, setLoadingAttendance] = useState(false);

    // Modal States
    const [isGraphVisible, setIsGraphVisible] = useState(false);
    const [individualGraphData, setIndividualGraphData] = useState(null);
    const [isCompareVisible, setIsCompareVisible] = useState(false);
    
    // Filter States
    const [sortBy, setSortBy] = useState('high-low');
    
    // Comparison States
    const [compareExam, setCompareExam] = useState('Overall');
    const [compareClass, setCompareClass] = useState('All Classes');
    const [availableClasses, setAvailableClasses] = useState(['All Classes']);

    // --- FETCH PERFORMANCE DATA ---
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
            
            // Reset attendance data
            setAttendanceData({});
            if (isTableView && userRole === 'admin') {
                fetchAttendanceForTable(data);
            }
        } catch (error) {
            console.error('Error fetching performance data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // --- FETCH ATTENDANCE DATA (For Table View) ---
    const fetchAttendanceForTable = async (teachersList) => {
        if (!teachersList || teachersList.length === 0) return;
        
        setLoadingAttendance(true);
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
            results.forEach(item => {
                attendanceMap[item.id] = item.pct;
            });

            setAttendanceData(attendanceMap);
        } catch (error) {
            console.error("Error batch fetching attendance:", error);
            Alert.alert("Error", "Could not fetch attendance data.");
        } finally {
            setLoadingAttendance(false);
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

    useEffect(() => {
        fetchData();
    }, [userId]);

    useEffect(() => {
        if (isTableView && userRole === 'admin' && performanceData.length > 0 && Object.keys(attendanceData).length === 0) {
            fetchAttendanceForTable(performanceData);
        }
    }, [isTableView]);

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

    // --- COMPARISON LOGIC (UPDATED WITH SUBJECT EXTRACTION) ---
    const getComparisonData = () => {
        if (!performanceData) return [];

        return performanceData.map(teacher => {
            let totalObtained = 0;
            let totalPossible = 0;
            const subjectsFound = new Set(); // Track subjects for this specific filter

            if (teacher.detailed_performance) {
                teacher.detailed_performance.forEach(detail => {
                    // 1. Filter by Class
                    if (compareClass !== 'All Classes' && detail.class_group !== compareClass) return;

                    // 2. Identify Subject
                    if (detail.subject) {
                        subjectsFound.add(detail.subject);
                    }

                    // 3. Sum Marks based on Exam Filter
                    if (compareExam === 'Overall') {
                        // Sum all exams in this detail block
                        detail.exam_breakdown.forEach(e => {
                            totalObtained += e.total_obtained;
                            totalPossible += e.total_possible;
                        });
                    } else {
                        // Find specific exam
                        const exam = detail.exam_breakdown.find(e => e.exam_type === compareExam);
                        if (exam) {
                            totalObtained += exam.total_obtained;
                            totalPossible += exam.total_possible;
                        }
                    }
                });
            }

            let rawPercentage = 0;
            if (totalPossible > 0) {
                rawPercentage = (totalObtained / totalPossible) * 100;
            }

            // Create Subject String (e.g., "Maths" or "Maths, Science")
            const subjectLabel = Array.from(subjectsFound).join(', ');

            return {
                name: teacher.teacher_name,
                subject: subjectLabel, // Added Subject
                total_obtained: totalObtained,
                total_possible: totalPossible,
                percentage: getRoundedPercentage(rawPercentage)
            };
        })
        .filter(item => item.total_possible > 0)
        .sort((a, b) => b.percentage - a.percentage);
    };

    // --- DATA PROCESSING ---
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

    // --- RENDER TABLE VIEW ---
    const renderTableView = () => {
        if (loadingAttendance && Object.keys(attendanceData).length === 0) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={{marginTop: 10, color: COLORS.textSub}}>Loading Attendance Data...</Text>
                </View>
            );
        }

        return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                                ? `${attendanceData[item.id]}%` 
                                : '-';
                            const attVal = attendanceData[item.id] !== 'N/A' ? attendanceData[item.id] : 0;
                            const attColor = getStatusColor(attVal);

                            return (
                                <View key={item.uniqueKey} style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
                                    <View style={{ width: 45, justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={styles.tableCell}>{index + 1}</Text>
                                    </View>
                                    <View style={{ width: 120, justifyContent: 'center', paddingLeft: 5 }}>
                                        <Text style={[styles.tableCell, { fontWeight: 'bold' }]} numberOfLines={2}>
                                            {item.name}
                                        </Text>
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
                                                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: getStatusColor(dPerc) }}>
                                                            {dPerc}%
                                                        </Text>
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

    // --- RENDER CARD LIST VIEW ---
    const renderItem = ({ item }) => {
        const rankStripColor = getRankColor(item.performanceRank);
        const performanceColor = getStatusColor(item.percentage);
        const isExpanded = expandedId === item.uniqueKey;
        const percentage = item.percentage;

        return (
            <View style={styles.card}>
                <TouchableOpacity 
                    style={styles.cardContent} 
                    onPress={() => toggleExpand(item.uniqueKey)}
                    activeOpacity={0.8}
                >
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
                        
                        <Text style={styles.marksLabel}>
                            Total Marks: <Text style={styles.marksValue}>{Math.round(item.totalManaged)} / {Math.round(item.maxPossible)}</Text>
                        </Text>
                        
                        <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${Math.min(item.percentage, 100)}%`, backgroundColor: performanceColor }]} />
                        </View>
                        
                        <View style={styles.expandRow}>
                            <Text style={styles.perfLabel}>Overall Performance: {percentage}%</Text>
                            <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textSub} />
                        </View>
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.expandedSection}>
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
                                                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: getStatusColor(dPerc) }}>
                                                        {dPerc}%
                                                    </Text>
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
                        <Text style={[styles.bdTxt, { flex: 2, textAlign: 'center' }]}>
                            {Math.round(exam.total_obtained)} / {Math.round(exam.total_possible)}
                        </Text>
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
            <View style={styles.headerContainer}>
                <View style={styles.headerTitleRow}>
                    <Text style={[styles.headerTitle, { flex: 1 }]} numberOfLines={1}>
                        {userRole === 'admin' ? 'Teacher Performance' : 'Class Performance'}
                    </Text>
                    <View style={{flexDirection: 'row'}}>
                        {userRole === 'admin' && (
                            <TouchableOpacity 
                                style={[styles.compareBtn, { backgroundColor: isTableView ? COLORS.success : '#546E7A', marginRight: 8 }]} 
                                onPress={() => setIsTableView(!isTableView)}
                            >
                                <Icon name={isTableView ? "card-bulleted-outline" : "table-large"} size={14} color="#fff" />
                                <Text style={styles.compareBtnText}>{isTableView ? "CARDS" : "TABLE"}</Text>
                            </TouchableOpacity>
                        )}
                        {userRole === 'admin' && (
                            <TouchableOpacity style={styles.compareBtn} onPress={() => setIsCompareVisible(true)}>
                                <Icon name="scale-balance" size={14} color="#fff" />
                                <Text style={styles.compareBtnText}>COMPARE</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
                <View style={styles.filterContainer}>
                    <View style={styles.filterBox}>
                        <Picker selectedValue={sortBy} onValueChange={setSortBy} style={styles.picker}>
                            <Picker.Item label="High to Low" value="high-low" />
                            <Picker.Item label="Low to High" value="low-high" />
                        </Picker>
                    </View>
                </View>

                {/* --- ADDED NOTE SECTION --- */}
                <View style={styles.noteContainer}>
                    <Text style={styles.noteText}>
                        Note :- Teacher performance is evaluated based on exam-wise marks of all students in the class
                    </Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>
            ) : (
                isTableView ? (
                    <View style={{ flex: 1, backgroundColor: '#fff' }}>{renderTableView()}</View>
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

            {/* Modal: Individual Graph */}
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
                                        height={240}
                                    />
                                ))}
                            </ScrollView>
                        </View>
                        <View style={styles.legendRow}>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.success}]} /><Text style={styles.legendTxt}>85-100% (Topper)</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.average}]} /><Text style={styles.legendTxt}>50-85% (Avg)</Text></View>
                            <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.poor}]} /><Text style={styles.legendTxt}>0-50% (Least)</Text></View>
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
                                            subLabel={item.subject} // Pass Subject here
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
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listPadding: { padding: 15, paddingBottom: 40 },
    emptyText: { textAlign: 'center', color: COLORS.textSub, marginTop: 30, fontStyle: 'italic' },
    headerContainer: { backgroundColor: '#FFF', padding: 15, paddingBottom: 15, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 4, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4 },
    headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5 },
    compareBtn: { flexDirection: 'row', backgroundColor: '#a13815ff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 25, alignItems: 'center', elevation: 3 },
    compareBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 10, marginLeft: 5, letterSpacing: 0.5 },
    filterContainer: { flexDirection: 'row', gap: 12 },
    filterBox: { flex: 1, backgroundColor: '#F0F2F5', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#E0E0E0', height: 45, justifyContent: 'center' },
    picker: { width: '100%', color: COLORS.textMain },
    
    // --- NOTE STYLES ---
    noteContainer: {
        marginTop: 12,
        backgroundColor: '#FFF8E1', // Very light amber
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFE0B2', // Orange-ish border
        flexDirection: 'row',
        alignItems: 'center'
    },
    noteText: {
        fontSize: 11,
        color: '#F57C00', // Deep Orange Text
        fontWeight: 'bold',
        textAlign: 'center',
        flex: 1
    },

    tableContainer: { padding: 10 },
    tableHeaderRow: { flexDirection: 'row', backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 5, marginBottom: 5 },
    tableHeaderCell: { color: '#FFF', fontWeight: 'bold', fontSize: 11, textAlign: 'center' },
    tableRow: { flexDirection: 'row', backgroundColor: '#FFF', paddingVertical: 0, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: '#EEE', alignItems: 'center', minHeight: 50 },
    tableRowAlt: { backgroundColor: '#F9FAFB' },
    tableCell: { fontSize: 12, color: COLORS.textMain, textAlign: 'center' },
    detailRowItem: { height: 30, justifyContent: 'center', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', width: '100%' },
    detailRowText: { fontSize: 11, color: COLORS.textSub, textAlign: 'center' },
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
    expandedSection: { backgroundColor: '#FAFAFA', borderTopWidth: 1, borderTopColor: '#EEE', padding: 15 },
    detailBlock: { marginBottom: 20, backgroundColor: '#FFF', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#F0F0F0' },
    detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    detailTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary },
    detailMarks: { fontSize: 11, color: COLORS.textSub, fontWeight: '600', marginBottom: 2 },
    iconButton: { backgroundColor: '#FB8C00', padding: 6, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 },
    breakdownContainer: { paddingHorizontal: 4 },
    bdHeader: { flexDirection: 'row', marginBottom: 6, backgroundColor: '#F9FAFB', paddingVertical: 6, borderRadius: 4 },
    bdHeaderTxt: { fontSize: 11, fontWeight: '700', color: COLORS.textSub },
    bdRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', alignItems: 'center' },
    bdTxt: { fontSize: 12, color: COLORS.textMain },
    percentagePill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10 },
    pillText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    graphModalCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 16, padding: 20, elevation: 10 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
    graphSubTitle: { textAlign: 'center', color: COLORS.textSub, marginBottom: 15, fontSize: 14, fontWeight: '500' },
    graphViewArea: { height: 250, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 10 },
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
    barWrapper: { width: 55, alignItems: 'center', justifyContent: 'flex-end', marginHorizontal: 8 },
    barLabelTop: { marginBottom: 4, fontSize: 12, fontWeight: 'bold', textAlign: 'center', color: COLORS.textMain },
    // Updated Bar Style for Rectangle
    barBackground: { width: 30, height: '80%', backgroundColor: COLORS.track, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end', position: 'relative' },
    barFill: { width: '100%', borderRadius: 4 },
    barTextContainer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    barInnerText: { fontSize: 10, fontWeight: 'bold', color: '#0e0e0eff', transform: [{ rotate: '-90deg' }], width: 120, textAlign: 'center' },
    barLabelBottom: { marginTop: 8, fontSize: 11, fontWeight: '600', color: COLORS.textMain, textAlign: 'center', width: '100%' },
    // Added Style for Subject Label
    barSubLabel: { marginTop: 2, fontSize: 10, fontWeight: '500', color: COLORS.textSub, textAlign: 'center', width: '100%' },
    legendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 15 },
    legendItem: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
    legendTxt: { fontSize: 12, color: COLORS.textSub }
});

export default TeacherPerformanceScreen;