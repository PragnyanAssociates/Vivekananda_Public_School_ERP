/**
 * File: src/screens/report/StudentPerformance.tsx
 * Purpose: View class-wise student performance.
 * Logic: Calculates ranks internally so colors (Red/Green/Blue/Brown/Black) 
 * persist regardless of the selected sort order (Roll No vs Rank).
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    Alert
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// --- Constants ---
const CLASS_SUBJECTS: { [key: string]: string[] } = {
    'LKG': ['All Subjects'], 'UKG': ['All Subjects'], 
    'Class 1': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 2': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 
    'Class 3': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 4': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 
    'Class 5': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 6': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 
    'Class 7': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 8': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 
    'Class 9': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 10': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social']
};

// Max marks definition for a single subject
const EXAM_MAX_SCORES: { [key: string]: number } = {
    'AT1': 25, 'UT1': 25, 
    'AT2': 25, 'UT2': 25,
    'AT3': 25, 'UT3': 25, 
    'AT4': 25, 'UT4': 25,
    'SA1': 100, 'SA2': 100
};

// Mapping to normalize API exam types to short codes
const EXAM_NAME_TO_CODE: { [key: string]: string } = {
    'Assignment-1': 'AT1', 'Unitest-1': 'UT1', 
    'Assignment-2': 'AT2', 'Unitest-2': 'UT2',
    'Assignment-3': 'AT3', 'Unitest-3': 'UT3', 
    'Assignment-4': 'AT4', 'Unitest-4': 'UT4',
    'SA1': 'SA1', 'SA2': 'SA2', 
    'AT1': 'AT1', 'UT1': 'UT1', 
    'AT2': 'AT2', 'UT2': 'UT2',
    'AT3': 'AT3', 'UT3': 'UT3',
    'AT4': 'AT4', 'UT4': 'UT4'
};

const StudentPerformance = () => {
    const [loading, setLoading] = useState(false);
    const [classList, setClassList] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>('');
    
    // Raw Data from API
    const [students, setStudents] = useState<any[]>([]);
    const [marksData, setMarksData] = useState<any[]>([]);
    
    // Filter State
    const [sortBy, setSortBy] = useState<'roll_no' | 'desc' | 'asc'>('roll_no');

    // 1. Fetch List of Classes on Mount
    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const response = await apiClient.get('/reports/classes');
                const classes = response.data || [];
                setClassList(classes);
                if (classes.length > 0) {
                    setSelectedClass(classes[0]); 
                }
            } catch (error) {
                console.error('Error fetching classes:', error);
                Alert.alert('Error', 'Failed to load class list.');
            }
        };
        fetchClasses();
    }, []);

    // 2. Fetch Class Data when selectedClass changes
    useEffect(() => {
        if (!selectedClass) return;
        fetchClassData(selectedClass);
    }, [selectedClass]);

    const fetchClassData = async (classGroup: string) => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/reports/class-data/${classGroup}`);
            const { students, marks } = response.data;
            setStudents(students || []);
            setMarksData(marks || []);
        } catch (error) {
            console.error('Error fetching class data:', error);
            Alert.alert('Error', 'Failed to load student data.');
        } finally {
            setLoading(false);
        }
    };

    // 3. Calculate Totals, Assign Ranks, and Sort
    const processedData = useMemo(() => {
        if (!selectedClass || students.length === 0) return [];

        const subjects = CLASS_SUBJECTS[selectedClass] || [];
        const subjectCount = subjects.length;

        // A. Determine active exams & Max Total
        const activeExams = new Set<string>();
        marksData.forEach((mark: any) => {
            const normalizedCode = EXAM_NAME_TO_CODE[mark.exam_type];
            if (normalizedCode && EXAM_MAX_SCORES[normalizedCode]) {
                if (mark.marks_obtained !== null && mark.marks_obtained !== '') {
                    activeExams.add(normalizedCode);
                }
            }
        });

        let dynamicMaxTotal = 0;
        activeExams.forEach(examCode => {
            const maxScoreForExam = EXAM_MAX_SCORES[examCode] || 0;
            dynamicMaxTotal += (maxScoreForExam * subjectCount);
        });
        if (dynamicMaxTotal === 0) dynamicMaxTotal = 1; 

        // B. Create Lookup Map
        const marksMap: any = {};
        marksData.forEach((mark: any) => {
            if (!marksMap[mark.student_id]) marksMap[mark.student_id] = {};
            const normCode = EXAM_NAME_TO_CODE[mark.exam_type];
            if (normCode) {
                if (!marksMap[mark.student_id][normCode]) marksMap[mark.student_id][normCode] = {};
                marksMap[mark.student_id][normCode][mark.subject] = mark.marks_obtained;
            }
        });

        // C. Calculate Scores for all students
        let results = students.map(student => {
            let totalObtained = 0;
            activeExams.forEach(examCode => {
                subjects.forEach(subject => {
                    const val = marksMap[student.id]?.[examCode]?.[subject];
                    const floatVal = parseFloat(val);
                    if (!isNaN(floatVal)) totalObtained += floatVal;
                });
            });

            const percentage = ((totalObtained / dynamicMaxTotal) * 100).toFixed(2);

            return {
                ...student,
                totalObtained,
                percentage: parseFloat(percentage),
                maxTotal: dynamicMaxTotal,
                performanceRank: 0 // Placeholder
            };
        });

        // D. Assign Ranks (Sort by Total Descending First)
        results.sort((a, b) => b.totalObtained - a.totalObtained);
        results = results.map((item, index) => ({
            ...item,
            performanceRank: index + 1 // 1-based rank (1 is highest score)
        }));

        // E. Apply Requested Display Sort
        if (sortBy === 'desc') {
            // Already sorted descending by totals
        } else if (sortBy === 'asc') {
            results.sort((a, b) => a.totalObtained - b.totalObtained);
        } else {
            // Default: Roll No
            results.sort((a, b) => {
                const rA = parseInt(a.roll_no, 10);
                const rB = parseInt(b.roll_no, 10);
                if(!isNaN(rA) && !isNaN(rB)) return rA - rB;
                return (a.roll_no || '').localeCompare(b.roll_no || '');
            });
        }

        return results;

    }, [selectedClass, students, marksData, sortBy]);

    // --- Helper: Get Color based on Actual Performance Rank ---
    const getColorForStudent = (rank: number, totalStudents: number) => {
        const RED = '#d32f2f';      // Top 1
        const GREEN = '#2e7d32';    // Top 2
        const BLUE = '#1565c0';     // Top 3
        const BLACK = '#000000';    // Bottom 3
        const BROWN = '#795548';    // Others

        if (rank === 1) return RED;
        if (rank === 2) return GREEN;
        if (rank === 3) return BLUE;
        
        // "Least three is in the black"
        // If rank is one of the last 3 (e.g., total 30: 28, 29, 30)
        if (rank > totalStudents - 3 && totalStudents >= 3) return BLACK;

        return BROWN;
    };

    // --- Render Item ---
    const renderStudentItem = ({ item, index }: { item: any, index: number }) => {
        const isSortByRollNo = sortBy === 'roll_no';
        
        // Color is determined by the calculated 'performanceRank', NOT the visual index
        const totalStudents = processedData.length;
        const itemColor = getColorForStudent(item.performanceRank, totalStudents);

        // Rank Badge Display Logic:
        // 1. If sorted by Roll No: Hide badge (opacity 0 or transparent).
        // 2. If sorted by High/Low: Show badge.
        // Note: item.performanceRank is the true rank. index + 1 is just list position.
        // When sorted by performance, index + 1 matches performanceRank (or reverse).
        // We'll display 'performanceRank' in the badge to be accurate.
        
        return (
            <View style={styles.card}>
                {/* Rank Badge */}
                <View style={[styles.rankContainer, isSortByRollNo && styles.rankHidden]}>
                    {!isSortByRollNo && (
                        <Text style={styles.rankText}>#{item.performanceRank}</Text>
                    )}
                </View>

                {/* Info */}
                <View style={styles.infoContainer}>
                    <Text style={styles.studentName}>{item.full_name}</Text>
                    <Text style={styles.rollNo}>Roll No: {item.roll_no}</Text>
                    
                    {/* Marks Bar */}
                    <View style={styles.progressBarContainer}>
                        <View 
                            style={[
                                styles.progressBarFill, 
                                { width: `${Math.min(item.percentage, 100)}%`, backgroundColor: itemColor }
                            ]} 
                        />
                    </View>
                    <Text style={styles.marksText}>
                        {item.totalObtained} / {item.maxTotal} Marks
                    </Text>
                </View>

                {/* Percentage Circle */}
                <View style={[styles.percentBadge, { borderColor: itemColor }]}>
                    <Text style={[styles.percentText, { color: itemColor }]}>
                        {item.percentage}%
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header & Controls */}
            <View style={styles.headerContainer}>
                <Text style={styles.title}>Class Performance</Text>
                
                <View style={styles.controlsRow}>
                    {/* Class Selector */}
                    <View style={styles.pickerWrapper}>
                        <Text style={styles.pickerLabel}>Class</Text>
                        <View style={styles.pickerBox}>
                            <Picker
                                selectedValue={selectedClass}
                                onValueChange={(val) => setSelectedClass(val)}
                                style={styles.picker}
                                dropdownIconColor="#34495e"
                            >
                                {classList.map((cls) => (
                                    <Picker.Item key={cls} label={cls} value={cls} />
                                ))}
                            </Picker>
                        </View>
                    </View>

                    {/* Sort Selector */}
                    <View style={styles.pickerWrapper}>
                        <Text style={styles.pickerLabel}>Sort By</Text>
                        <View style={styles.pickerBox}>
                            <Picker
                                selectedValue={sortBy}
                                onValueChange={(val) => setSortBy(val)}
                                style={styles.picker}
                                dropdownIconColor="#34495e"
                            >
                                <Picker.Item label="Roll No" value="roll_no" />
                                <Picker.Item label="High to Low" value="desc" />
                                <Picker.Item label="Low to High" value="asc" />
                            </Picker>
                        </View>
                    </View>
                </View>
            </View>

            {/* List Content */}
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#008080" />
                    <Text style={styles.loadingText}>Loading Data...</Text>
                </View>
            ) : (
                <FlatList
                    data={processedData}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderStudentItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.centerContainer}>
                            <Icon name="account-search" size={50} color="#bdc3c7" />
                            <Text style={styles.emptyText}>No student data found for {selectedClass}</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5',
    },
    headerContainer: {
        backgroundColor: '#fff',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#008080',
        marginBottom: 15,
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    pickerWrapper: {
        flex: 1,
    },
    pickerLabel: {
        fontSize: 12,
        color: '#7f8c8d',
        marginBottom: 4,
        fontWeight: '600',
    },
    pickerBox: {
        borderWidth: 1,
        borderColor: '#bdc3c7',
        borderRadius: 8,
        backgroundColor: '#f8f9fa',
        height: 45,
        justifyContent: 'center',
    },
    picker: {
        width: '100%',
        color: '#2c3e50',
    },
    listContent: {
        padding: 15,
        paddingBottom: 30,
    },
    // Card Styles
    card: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginBottom: 12,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    rankContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f0f2f5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    rankHidden: {
        backgroundColor: 'transparent', 
    },
    rankText: {
        fontWeight: 'bold',
        color: '#546E7A',
        fontSize: 14,
    },
    infoContainer: {
        flex: 1,
    },
    studentName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    rollNo: {
        fontSize: 13,
        color: '#7f8c8d',
        marginTop: 2,
    },
    marksText: {
        fontSize: 12,
        color: '#34495e',
        marginTop: 4,
        fontWeight: '600',
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: '#ecf0f1',
        borderRadius: 3,
        marginTop: 8,
        width: '90%',
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    percentBadge: {
        width: 65,
        height: 65,
        borderRadius: 35,
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    percentText: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 50,
    },
    loadingText: {
        marginTop: 10,
        color: '#008080',
        fontWeight: '500',
    },
    emptyText: {
        marginTop: 10,
        color: '#95a5a6',
        fontSize: 16,
    },
});

export default StudentPerformance;