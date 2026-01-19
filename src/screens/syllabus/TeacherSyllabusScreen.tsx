import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView, SafeAreaView } from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useIsFocused } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();
const FILTER_TYPES = ["Overall", "AT1", "UT1", "AT2", "UT2", "SA1", "AT3", "UT3", "AT4", "UT4", "SA2"];

// Helper to format date strictly as DD/MM/YYYY
const formatDate = (isoString) => {
    if (!isoString) return 'No Date';
    const d = new Date(isoString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

const TeacherSyllabusNavigator = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="TeacherSubjectList" component={TeacherSyllabusListScreen} />
        <Stack.Screen name="TeacherLessonProgress" component={TeacherLessonProgressScreen} />
    </Stack.Navigator>
);

const TeacherSyllabusListScreen = ({ navigation }) => {
    const { user } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const isFocused = useIsFocused();

    const fetchAssignments = useCallback(async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/teacher-assignments/${user.id}`);
            setAssignments(response.data);
        } catch (error) { Alert.alert("Error", "Failed to load subjects."); }
        finally { setIsLoading(false); }
    }, [user?.id]);

    useEffect(() => { if (isFocused) fetchAssignments(); }, [isFocused, fetchAssignments]);

    return (
        <View style={styles.container}>
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerIconContainer}>
                    <MaterialIcons name="menu-book" size={24} color="#008080" />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>My Syllabus</Text>
                    <Text style={styles.headerSubtitle}>Select a subject to manage</Text>
                </View>
            </View>

            <FlatList
                data={assignments}
                keyExtractor={(item, index) => `${item.class_group}-${item.subject_name}-${index}`}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('TeacherLessonProgress', { classGroup: item.class_group, subjectName: item.subject_name })}>
                        <View style={styles.iconBox}>
                            <MaterialIcons name="class" size={24} color="#4f46e5" />
                        </View>
                        <View style={styles.cardContent}>
                           <Text style={styles.cardTitle}>{item.subject_name}</Text>
                           <Text style={styles.cardSubtitle}>{item.class_group}</Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={24} color="#cbd5e1" />
                    </TouchableOpacity>
                )}
                onRefresh={fetchAssignments}
                refreshing={isLoading}
                ListEmptyComponent={!isLoading && <Text style={styles.emptyText}>No assigned classes found.</Text>}
            />
        </View>
    );
};

const TeacherLessonProgressScreen = ({ route, navigation }) => {
    const { classGroup, subjectName } = route.params;
    const { user: teacher } = useAuth();
    
    // State for filtering
    const [fullLessonList, setFullLessonList] = useState([]); 
    const [filteredLessons, setFilteredLessons] = useState([]);
    const [selectedFilter, setSelectedFilter] = useState("Overall");

    const [overview, setOverview] = useState({ completed: 0, missed: 0, left: 0 });
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const syllabusResponse = await apiClient.get(`/syllabus/teacher/${classGroup}/${subjectName}`);
            const syllabusData = syllabusResponse.data;
            
            const progressResponse = await apiClient.get(`/syllabus/class-progress/${syllabusData.id}`);
            const progressData = progressResponse.data;

            setFullLessonList(progressData);
            // Apply default filter 'Overall'
            setFilteredLessons(progressData);
            calculateStats(progressData);

        } catch (error) {
            Alert.alert("Notice", "Syllabus not found for this subject.");
        } finally {
            setIsLoading(false);
        }
    }, [classGroup, subjectName]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleFilter = (filterType) => {
        setSelectedFilter(filterType);
        let updatedList = [];
        if (filterType === "Overall") {
            updatedList = fullLessonList;
        } else {
            updatedList = fullLessonList.filter(l => l.exam_type === filterType);
        }
        setFilteredLessons(updatedList);
        calculateStats(updatedList);
    };

    const calculateStats = (dataList) => {
        const stats = { completed: 0, missed: 0, left: 0 };
        dataList.forEach(l => {
            if (l.status === 'Completed') stats.completed++;
            else if (l.status === 'Missed') stats.missed++;
            else stats.left++; // Pending
        });
        setOverview(stats);
    };

    const handleStatusUpdate = (lessonId, newStatus) => {
        const action = newStatus === 'Pending' ? 'reset' : 'mark';
        Alert.alert(
            "Confirm Update", 
            `Do you want to ${action} this lesson as ${newStatus}?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Yes", 
                    onPress: async () => {
                        try {
                            await apiClient.patch('/syllabus/lesson-status', {
                                class_group: classGroup,
                                lesson_id: lessonId,
                                status: newStatus,
                                teacher_id: teacher.id
                            });
                            fetchData(); // Reload data
                        } catch (error) { Alert.alert("Error", "Update failed."); }
                    } 
                }
            ]
        );
    };

    if (isLoading) return <View style={styles.centered}><ActivityIndicator size="large" color="#4f46e5" /></View>;

    return (
        <View style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerContentWrapper}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color="#333333" />
                    </TouchableOpacity>

                    <View style={styles.headerIconContainer}>
                         <MaterialIcons name="trending-up" size={24} color="#008080" />
                    </View>
                    
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>{subjectName}</Text>
                        <Text style={styles.headerSubtitle}>{classGroup} • Progress</Text>
                    </View>
                </View>
            </View>

            {/* FILTER BAR */}
            <View style={styles.filterBarContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    {FILTER_TYPES.map((type) => (
                        <TouchableOpacity 
                            key={type} 
                            style={[styles.filterTab, selectedFilter === type && styles.filterTabActive]}
                            onPress={() => handleFilter(type)}
                        >
                            <Text style={[styles.filterText, selectedFilter === type && styles.filterTextActive]}>
                                {type}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
                {/* Stats Grid */}
                <View style={styles.statsContainer}>
                    <View style={styles.statBox}>
                        <Text style={[styles.statNum, {color: '#10b981'}]}>{overview.completed}</Text>
                        <Text style={styles.statLabel}>Done</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statNum, {color: '#ef4444'}]}>{overview.missed}</Text>
                        <Text style={styles.statLabel}>Missed</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statNum, {color: '#f59e0b'}]}>{overview.left}</Text>
                        <Text style={styles.statLabel}>Left</Text>
                    </View>
                </View>

                {filteredLessons.map((lesson) => {
                    const isCompleted = lesson.status === 'Completed';
                    const isMissed = lesson.status === 'Missed';
                    // Use to_date for overdue check
                    const isOverdue = new Date(lesson.to_date) < new Date() && !isCompleted && !isMissed;

                    return (
                        <View key={lesson.lesson_id} style={[styles.lessonCard, isOverdue && styles.overdueBorder]}>
                            <View style={styles.lessonHeader}>
                                <Text style={styles.lessonTitle}>{lesson.lesson_name}</Text>
                                <Text style={styles.examBadge}>{lesson.exam_type}</Text>
                                <Text style={[styles.dateText, isOverdue && {color: '#ef4444'}]}>
                                    Due: {formatDate(lesson.from_date)} - {formatDate(lesson.to_date)}
                                </Text>
                            </View>

                            {(isCompleted || isMissed) ? (
                                <View style={styles.statusActionRow}>
                                    <View style={[styles.badge, isCompleted ? styles.badgeSuccess : styles.badgeError]}>
                                        <MaterialIcons name={isCompleted ? "check" : "close"} size={14} color={isCompleted ? "#15803d" : "#b91c1c"} />
                                        <Text style={[styles.badgeText, isCompleted ? {color: '#15803d'} : {color: '#b91c1c'}]}>
                                            {lesson.status}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleStatusUpdate(lesson.lesson_id, 'Pending')}>
                                        <Text style={styles.editLink}>Edit</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.btnRow}>
                                    <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#dcfce7'}]} onPress={() => handleStatusUpdate(lesson.lesson_id, 'Completed')}>
                                        <Text style={[styles.btnText, {color: '#166534'}]}>Mark Done</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#fee2e2'}]} onPress={() => handleStatusUpdate(lesson.lesson_id, 'Missed')}>
                                        <Text style={[styles.btnText, {color: '#991b1b'}]}>Mark Missed</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                })}
                {filteredLessons.length === 0 && (
                    <Text style={styles.emptyText}>No lessons found for {selectedFilter}.</Text>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F5F8' }, // Matching reference background
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 15,
        paddingVertical: 10,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15, // REDUCED GAP (Fixed from 40 to 15)
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerContentWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    headerIconContainer: {
        backgroundColor: '#E0F2F1', // Teal bg
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: {
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333333',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666666',
        marginTop: 1,
    },
    // ---------------------------------------------

    // List Card
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, marginBottom: 12, borderRadius: 16, shadowColor: '#64748b', shadowOpacity: 0.1, shadowRadius: 5, elevation: 2 },
    iconBox: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    cardContent: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
    cardSubtitle: { fontSize: 13, color: '#64748b' },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#94a3b8' },
    
    // Filter Bar
    filterBarContainer: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    filterScroll: { paddingHorizontal: 15, paddingVertical: 12 },
    filterTab: { marginRight: 15, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#f1f5f9' },
    filterTabActive: { backgroundColor: '#4f46e5' },
    filterText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
    filterTextActive: { color: '#fff' },

    statsContainer: { flexDirection: 'row', justifyContent: 'space-around', padding: 20, backgroundColor: '#fff', marginBottom: 15, borderRadius: 12, marginHorizontal: 15, marginTop: 10, elevation: 1 },
    statBox: { alignItems: 'center' },
    statNum: { fontSize: 24, fontWeight: '800' },
    statLabel: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },

    // Lesson Card
    lessonCard: { backgroundColor: '#fff', marginHorizontal: 15, marginBottom: 12, borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#f1f5f9', elevation: 1 },
    overdueBorder: { borderColor: '#fca5a5' },
    lessonHeader: { marginBottom: 12 },
    lessonTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
    dateText: { fontSize: 13, color: '#64748b', marginTop: 4 },
    examBadge: { fontSize: 10, color: '#6366f1', backgroundColor: '#e0e7ff', alignSelf:'flex-start', paddingHorizontal:6, paddingVertical:2, borderRadius: 4, marginTop:4, overflow:'hidden', fontWeight: 'bold' },
    
    // Actions
    statusActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    badgeSuccess: { backgroundColor: '#dcfce7' },
    badgeError: { backgroundColor: '#fee2e2' },
    badgeText: { fontSize: 12, fontWeight: '700', marginLeft: 5 },
    editLink: { color: '#64748b', textDecorationLine: 'underline', fontSize: 13 },
    
    btnRow: { flexDirection: 'row', gap: 10 },
    actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    btnText: { fontWeight: '700', fontSize: 13 },
});

export default TeacherSyllabusNavigator;