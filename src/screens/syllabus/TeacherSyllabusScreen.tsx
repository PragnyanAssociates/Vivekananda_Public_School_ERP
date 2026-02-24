import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, 
    Alert, ScrollView, SafeAreaView, useColorScheme, StatusBar, Dimensions 
} from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useIsFocused } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();
const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080', background: '#F5F7FA', cardBg: '#FFFFFF',
    textMain: '#263238', textSub: '#546E7A', border: '#CFD8DC',
    inputBg: '#FAFAFA', iconGrey: '#90A4AE', danger: '#E53935',
    success: '#43A047', warning: '#FFA000', headerIconBg: '#E0F2F1',
    divider: '#f0f2f5', filterBg: '#FFFFFF', filterTabBg: '#f1f5f9'
};

const DarkColors = {
    primary: '#008080', background: '#121212', cardBg: '#1E1E1E',
    textMain: '#E0E0E0', textSub: '#B0B0B0', border: '#333333',
    inputBg: '#2C2C2C', iconGrey: '#757575', danger: '#EF5350',
    success: '#66BB6A', warning: '#FFA726', headerIconBg: '#333333',
    divider: '#2C2C2C', filterBg: '#1E1E1E', filterTabBg: '#2C2C2C'
};

const FILTER_TYPES = ["Overall", "AT1", "UT1", "AT2", "UT2", "SA1", "AT3", "UT3", "AT4", "UT4", "SA2"];

// Helper to format date strictly as DD/MM/YYYY
const formatDate = (isoString) => {
    if (!isoString) return 'No Date';
    const d = new Date(isoString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

// --- NAVIGATOR ---
const TeacherSyllabusNavigator = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="TeacherSubjectList" component={TeacherSyllabusListScreen} />
        <Stack.Screen name="TeacherLessonProgress" component={TeacherLessonProgressScreen} />
    </Stack.Navigator>
);

// --- SUBJECT LIST SCREEN ---
const TeacherSyllabusListScreen = ({ navigation }) => {
    const { user } = useAuth();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

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
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={COLORS.background} />
            
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                <View style={styles.headerContentWrapper}>
                    <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                        <MaterialIcons name="menu-book" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>My Syllabus</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Select a subject to manage</Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={assignments}
                keyExtractor={(item, index) => `${item.class_group}-${item.subject_name}-${index}`}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        style={[styles.card, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]} 
                        onPress={() => navigation.navigate('TeacherLessonProgress', { classGroup: item.class_group, subjectName: item.subject_name })}
                    >
                        <View style={[styles.iconBox, { backgroundColor: isDark ? COLORS.inputBg : '#E0E7FF' }]}>
                            <MaterialIcons name="class" size={24} color={COLORS.primary} />
                        </View>
                        <View style={styles.cardContent}>
                           <Text style={[styles.cardTitle, { color: COLORS.textMain }]}>{item.subject_name}</Text>
                           <Text style={[styles.cardSubtitle, { color: COLORS.textSub }]}>{item.class_group}</Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={24} color={COLORS.iconGrey} />
                    </TouchableOpacity>
                )}
                onRefresh={fetchAssignments}
                refreshing={isLoading}
                ListEmptyComponent={!isLoading && <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No assigned classes found.</Text>}
            />
        </SafeAreaView>
    );
};

// --- PROGRESS SCREEN ---
const TeacherLessonProgressScreen = ({ route, navigation }) => {
    const { classGroup, subjectName } = route.params;
    const { user: teacher } = useAuth();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;
    
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
            setFilteredLessons(progressData);
            calculateStats(progressData);

        } catch (error) { Alert.alert("Notice", "Syllabus not found for this subject."); } 
        finally { setIsLoading(false); }
    }, [classGroup, subjectName]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleFilter = (filterType) => {
        setSelectedFilter(filterType);
        let updatedList = [];
        if (filterType === "Overall") {
            updatedList = fullLessonList;
        } else {
            // CHANGED: Use .includes() because exam_type can be a comma-separated string like "AT1, SA1"
            updatedList = fullLessonList.filter(l => l.exam_type && l.exam_type.includes(filterType));
        }
        setFilteredLessons(updatedList);
        calculateStats(updatedList);
    };

    const calculateStats = (dataList) => {
        const stats = { completed: 0, missed: 0, left: 0 };
        dataList.forEach(l => {
            if (l.status === 'Completed') stats.completed++;
            else if (l.status === 'Missed') stats.missed++;
            else stats.left++;
        });
        setOverview(stats);
    };

    const handleStatusUpdate = (lessonId, newStatus) => {
        const action = newStatus === 'Pending' ? 'reset' : 'mark';
        Alert.alert(
            "Confirm Update", `Do you want to ${action} this lesson as ${newStatus}?`,
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
                            fetchData(); 
                        } catch (error) { Alert.alert("Error", "Update failed."); }
                    } 
                }
            ]
        );
    };

    if (isLoading) return <View style={[styles.centered, { backgroundColor: COLORS.background }]}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                <View style={styles.headerContentWrapper}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>
                    <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                         <MaterialIcons name="trending-up" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>{subjectName}</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>{classGroup} • Progress</Text>
                    </View>
                </View>
            </View>

            <View style={[styles.filterBarContainer, { backgroundColor: COLORS.cardBg, borderBottomColor: COLORS.divider }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    {FILTER_TYPES.map((type) => (
                        <TouchableOpacity 
                            key={type} 
                            style={[styles.filterTab, selectedFilter === type ? { backgroundColor: COLORS.primary } : { backgroundColor: COLORS.filterTabBg }]}
                            onPress={() => handleFilter(type)}
                        >
                            <Text style={[styles.filterText, { color: selectedFilter === type ? '#FFF' : COLORS.textSub }]}>{type}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
                <View style={[styles.statsContainer, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                    <View style={styles.statBox}>
                        <Text style={[styles.statNum, {color: COLORS.success}]}>{overview.completed}</Text>
                        <Text style={[styles.statLabel, { color: COLORS.textSub }]}>Done</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statNum, {color: COLORS.danger}]}>{overview.missed}</Text>
                        <Text style={[styles.statLabel, { color: COLORS.textSub }]}>Missed</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statNum, {color: COLORS.warning}]}>{overview.left}</Text>
                        <Text style={[styles.statLabel, { color: COLORS.textSub }]}>Left</Text>
                    </View>
                </View>

                {filteredLessons.map((lesson) => {
                    const isCompleted = lesson.status === 'Completed';
                    const isMissed = lesson.status === 'Missed';
                    const isOverdue = new Date(lesson.to_date) < new Date() && !isCompleted && !isMissed;

                    return (
                        <View key={lesson.lesson_id} style={[styles.lessonCard, { backgroundColor: COLORS.cardBg, borderColor: isOverdue ? COLORS.danger : COLORS.border, shadowColor: COLORS.border }]}>
                            <View style={styles.lessonHeader}>
                                <Text style={[styles.lessonTitle, { color: COLORS.textMain }]}>{lesson.lesson_name}</Text>
                                <Text style={[styles.examBadge, { color: COLORS.primary, backgroundColor: isDark ? COLORS.inputBg : '#E0F2F1' }]}>{lesson.exam_type}</Text>
                                <Text style={[styles.dateText, { color: isOverdue ? COLORS.danger : COLORS.textSub }]}>
                                    Due: {formatDate(lesson.from_date)} - {formatDate(lesson.to_date)}
                                </Text>
                            </View>

                            {(isCompleted || isMissed) ? (
                                <View style={styles.statusActionRow}>
                                    <View style={[styles.badge, isCompleted ? { backgroundColor: isDark ? '#052e16' : '#dcfce7' } : { backgroundColor: isDark ? '#450a0a' : '#fee2e2' }]}>
                                        <MaterialIcons name={isCompleted ? "check" : "close"} size={14} color={isCompleted ? COLORS.success : COLORS.danger} />
                                        <Text style={[styles.badgeText, { color: isCompleted ? COLORS.success : COLORS.danger }]}>{lesson.status}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleStatusUpdate(lesson.lesson_id, 'Pending')}>
                                        <Text style={[styles.editLink, { color: COLORS.textSub }]}>Edit</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.btnRow}>
                                    <TouchableOpacity style={[styles.actionBtn, {backgroundColor: isDark ? '#052e16' : '#dcfce7'}]} onPress={() => handleStatusUpdate(lesson.lesson_id, 'Completed')}>
                                        <Text style={[styles.btnText, {color: COLORS.success}]}>Mark Done</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.actionBtn, {backgroundColor: isDark ? '#450a0a' : '#fee2e2'}]} onPress={() => handleStatusUpdate(lesson.lesson_id, 'Missed')}>
                                        <Text style={[styles.btnText, {color: COLORS.danger}]}>Mark Missed</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                })}
                {filteredLessons.length === 0 && (
                    <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No lessons found for {selectedFilter}.</Text>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    headerCard: {
        paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center',
        marginTop: 15, marginBottom: 10, borderRadius: 12, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'space-between', elevation: 3,
        shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    },
    headerContentWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13, marginTop: 1 },

    card: { flexDirection: 'row', alignItems: 'center', padding: 15, marginBottom: 12, borderRadius: 12, elevation: 2, shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 1 }, width: '96%', alignSelf: 'center' },
    iconBox: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    cardContent: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: '700' },
    cardSubtitle: { fontSize: 13 },
    emptyText: { textAlign: 'center', marginTop: 50 },
    
    filterBarContainer: { borderBottomWidth: 1, marginBottom: 10 },
    filterScroll: { paddingHorizontal: 15, paddingVertical: 12 },
    filterTab: { marginRight: 15, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20 },
    filterText: { fontWeight: '600', fontSize: 14 },

    statsContainer: { flexDirection: 'row', justifyContent: 'space-around', padding: 20, marginBottom: 15, borderRadius: 12, marginHorizontal: 15, marginTop: 10, elevation: 1, shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
    statBox: { alignItems: 'center' },
    statNum: { fontSize: 24, fontWeight: '800' },
    statLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

    lessonCard: { marginHorizontal: 15, marginBottom: 12, borderRadius: 12, padding: 15, borderWidth: 1, elevation: 1, shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
    lessonHeader: { marginBottom: 12 },
    lessonTitle: { fontSize: 16, fontWeight: '600' },
    dateText: { fontSize: 13, marginTop: 4 },
    examBadge: { fontSize: 10, alignSelf:'flex-start', paddingHorizontal:6, paddingVertical:2, borderRadius: 4, marginTop:4, overflow:'hidden', fontWeight: 'bold' },
    
    statusActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    badgeText: { fontSize: 12, fontWeight: '700', marginLeft: 5 },
    editLink: { textDecorationLine: 'underline', fontSize: 13 },
    
    btnRow: { flexDirection: 'row', gap: 10 },
    actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    btnText: { fontWeight: '700', fontSize: 13 },
});

export default TeacherSyllabusNavigator;