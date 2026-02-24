import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, 
    ScrollView, FlatList, Alert, useColorScheme, StatusBar, Dimensions 
} from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useIsFocused } from '@react-navigation/native';
import * as Progress from 'react-native-progress';
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();
const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080', background: '#F5F7FA', cardBg: '#FFFFFF',
    textMain: '#263238', textSub: '#546E7A', border: '#CFD8DC',
    inputBg: '#FAFAFA', iconGrey: '#90A4AE', danger: '#E53935',
    success: '#43A047', warning: '#FFA000', headerIconBg: '#E0F2F1',
    divider: '#f0f2f5', progressUnfilled: '#E0F2F1'
};

const DarkColors = {
    primary: '#008080', background: '#121212', cardBg: '#1E1E1E',
    textMain: '#E0E0E0', textSub: '#B0B0B0', border: '#333333',
    inputBg: '#2C2C2C', iconGrey: '#757575', danger: '#EF5350',
    success: '#66BB6A', warning: '#FFA726', headerIconBg: '#333333',
    divider: '#2C2C2C', progressUnfilled: '#37474F'
};

const FILTER_TYPES = ["Overall", "AT1", "UT1", "AT2", "UT2", "SA1", "AT3", "UT3", "AT4", "UT4", "SA2"];

// Helper for DD/MM/YYYY
const formatDate = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

// --- NAVIGATOR ---
const StudentSyllabusNavigator = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="StudentDashboard" component={StudentSyllabusDashboardScreen} />
        <Stack.Screen name="StudentLessonList" component={StudentLessonListScreen} />
    </Stack.Navigator>
);

// --- DASHBOARD SCREEN ---
const StudentSyllabusDashboardScreen = ({ navigation }) => {
    const { user } = useAuth();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const [summary, setSummary] = useState({ Done: 0, Missed: 0, Pending: 0, Total: 0 });
    const [subjects, setSubjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const isFocused = useIsFocused();

    const fetchSummary = useCallback(async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/syllabus/student/overview/${user.id}`);
            const { totalStats, subjectStats } = response.data;

            const totalSummary = { Done: 0, Missed: 0, Pending: 0, Total: 0 };
            totalStats.forEach(item => {
                if (item.status === 'Completed') totalSummary.Done = item.count;
                if (item.status === 'Missed') totalSummary.Missed = item.count;
                else if (item.status === 'Pending') totalSummary.Pending = item.count;
                totalSummary.Total += item.count;
            });
            setSummary(totalSummary);

            const subjectMap = new Map();
            subjectStats.forEach(stat => {
                if (!subjectMap.has(stat.syllabus_id)) {
                    subjectMap.set(stat.syllabus_id, { id: stat.syllabus_id, name: stat.subject_name, Done: 0, Missed: 0, Pending: 0, Total: 0 });
                }
                const subjectData = subjectMap.get(stat.syllabus_id);
                if (stat.status === 'Completed') subjectData.Done = stat.count;
                if (stat.status === 'Missed') subjectData.Missed = stat.count;
                else if (stat.status === 'Pending') subjectData.Pending = stat.count;
                subjectData.Total += stat.count;
            });
            setSubjects(Array.from(subjectMap.values()));
        } catch (error) { Alert.alert("Error", "Failed to fetch progress."); } 
        finally { setIsLoading(false); }
    }, [user?.id]);

    useEffect(() => { if (isFocused) fetchSummary(); }, [isFocused, fetchSummary]);

    const overallProgress = summary.Total > 0 ? summary.Done / summary.Total : 0;

    return (
        <View style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={COLORS.background} />
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                    <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                        <MaterialIcons name="school" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>{user?.class_group || 'Student'}</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Syllabus Tracking</Text>
                    </View>
                </View>

                {isLoading ? <ActivityIndicator size="large" style={{ marginTop: 40 }} color={COLORS.primary} /> :
                <View style={styles.contentContainer}>
                    <View style={[styles.mainCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                        <Text style={[styles.cardTitle, { color: COLORS.textMain }]}>Overall Progress</Text>
                        <View style={styles.progressBarRow}>
                            <Progress.Bar progress={overallProgress} width={null} color={COLORS.primary} unfilledColor={COLORS.progressUnfilled} borderWidth={0} height={10} style={{flex: 1, borderRadius: 5}} />
                            <Text style={[styles.percentText, { color: COLORS.primary }]}>{Math.round(overallProgress * 100)}%</Text>
                        </View>
                        <View style={styles.statsRow}>
                            <View style={[styles.statPill, { backgroundColor: isDark ? COLORS.inputBg : '#f0fdf4' }]}>
                                <View style={[styles.dot, {backgroundColor: COLORS.success}]}/>
                                <Text style={[styles.statText, { color: COLORS.textSub }]}>{summary.Done} Done</Text>
                            </View>
                            <View style={[styles.statPill, { backgroundColor: isDark ? COLORS.inputBg : '#fef2f2' }]}>
                                <View style={[styles.dot, {backgroundColor: COLORS.danger}]}/>
                                <Text style={[styles.statText, { color: COLORS.textSub }]}>{summary.Missed} Missed</Text>
                            </View>
                            <View style={[styles.statPill, { backgroundColor: isDark ? COLORS.inputBg : '#fffbeb' }]}>
                                <View style={[styles.dot, {backgroundColor: COLORS.warning}]}/>
                                <Text style={[styles.statText, { color: COLORS.textSub }]}>{summary.Pending} Left</Text>
                            </View>
                        </View>
                    </View>
                    
                    <Text style={[styles.sectionTitle, { color: COLORS.textMain }]}>Subjects</Text>
                    {subjects.map(subject => {
                        const subjectProgress = subject.Total > 0 ? subject.Done / subject.Total : 0;
                        return (
                            <TouchableOpacity key={subject.id} style={[styles.subjectCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]} onPress={() => navigation.navigate('StudentLessonList', { syllabusId: subject.id, subjectName: subject.name })}>
                                <View style={styles.subjectRow}>
                                    <Text style={[styles.subjectName, { color: COLORS.textMain }]}>{subject.name}</Text>
                                    <Text style={[styles.subjectPercent, { color: COLORS.primary }]}>{Math.round(subjectProgress * 100)}%</Text>
                                </View>
                                <Progress.Bar progress={subjectProgress} width={null} color={COLORS.primary} unfilledColor={COLORS.progressUnfilled} borderWidth={0} height={6} borderRadius={3} style={{marginTop: 8}} />
                                <Text style={[styles.miniStats, { color: COLORS.textSub }]}>{subject.Done} done • {subject.Pending} remaining</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                }
            </ScrollView>
        </View>
    );
};

// --- LESSON LIST SCREEN ---
const StudentLessonListScreen = ({ route, navigation }) => {
    const { syllabusId, subjectName } = route.params;
    const { user } = useAuth();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;
    
    const [fullList, setFullList] = useState([]);
    const [filteredList, setFilteredList] = useState([]);
    const [selectedFilter, setSelectedFilter] = useState("Overall");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLessons = async () => {
            setIsLoading(true);
            try {
                const response = await apiClient.get(`/syllabus/student/subject-details/${syllabusId}/${user.id}`);
                setFullList(response.data.lessons);
                setFilteredList(response.data.lessons); 
            } catch (error) { Alert.alert("Error", "Failed to load details."); }
            finally { setIsLoading(false); }
        };
        fetchLessons();
    }, [user, syllabusId]);

    const handleFilter = (type) => {
        setSelectedFilter(type);
        if (type === "Overall") {
            setFilteredList(fullList);
        } else {
            // CHANGED: Use .includes() for multiple exams
            setFilteredList(fullList.filter(l => l.exam_type && l.exam_type.includes(type)));
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: COLORS.background }]}>
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                <View style={styles.headerContentWrapper}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>

                    <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                         <MaterialIcons name="menu-book" size={24} color={COLORS.primary} />
                    </View>
                    
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>{subjectName}</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Lesson Details</Text>
                    </View>
                </View>
            </View>
            
            <View style={[styles.filterBarContainer, { backgroundColor: COLORS.cardBg }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                     {FILTER_TYPES.map(type => (
                        <TouchableOpacity 
                            key={type} 
                            onPress={() => handleFilter(type)}
                            style={[styles.filterTab, selectedFilter === type ? { backgroundColor: COLORS.primary } : { backgroundColor: isDark ? COLORS.inputBg : '#f1f5f9' }]}>
                            <Text style={[styles.filterText, { color: selectedFilter === type ? '#FFF' : COLORS.textSub }]}>{type}</Text>
                        </TouchableOpacity>
                     ))}
                </ScrollView>
            </View>

            <FlatList
                data={filteredList}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{padding: 15}}
                renderItem={({item}) => {
                    const isDone = item.status === 'Completed';
                    const isMissed = item.status === 'Missed';
                    return (
                        <View style={[styles.lessonItem, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                           <View style={styles.iconContainer}>
                                <MaterialIcons name={isDone ? 'check-circle' : isMissed ? 'cancel' : 'radio-button-unchecked'} size={24} color={isDone ? COLORS.success : isMissed ? COLORS.danger : COLORS.iconGrey} />
                                {item.status !== 'Pending' && <View style={{height: '100%', width: 2, backgroundColor: COLORS.divider, position: 'absolute', top: 30, left: 11, zIndex: -1}} />}
                           </View>
                           <View style={styles.lessonContent}>
                                <Text style={[styles.lessonName, { color: isDone ? COLORS.textSub : COLORS.textMain, textDecorationLine: isDone ? 'line-through' : 'none' }]}>{item.lesson_name}</Text>
                                <Text style={[styles.examBadge, { color: COLORS.primary }]}>{item.exam_type}</Text>
                                <Text style={[styles.lessonDate, { color: COLORS.textSub }]}>
                                    Due: {formatDate(item.from_date)} - {formatDate(item.to_date)}
                                </Text>
                           </View>
                           <View style={[styles.statusTag, { backgroundColor: isDone ? (isDark ? '#052e16' : '#dcfce7') : isMissed ? (isDark ? '#450a0a' : '#fee2e2') : (isDark ? COLORS.inputBg : '#f1f5f9') }]}>
                               <Text style={[styles.statusTagText, { color: isDone ? COLORS.success : isMissed ? COLORS.danger : COLORS.textSub }]}>{item.status}</Text>
                           </View>
                        </View>
                    )
                }}
                ListEmptyComponent={!isLoading && <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No lessons found.</Text>}
                refreshing={isLoading}
            />
        </View>
    );
};

// --- STYLES ---
const styles = StyleSheet.create({
    container: { flex: 1 },
    headerCard: {
        paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10,
        borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        elevation: 3, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    },
    headerContentWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },
    contentContainer: { paddingHorizontal: 15, paddingBottom: 20 },
    mainCard: { padding: 20, borderRadius: 20, elevation: 3, marginBottom: 25, shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
    cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 15 },
    progressBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    percentText: { marginLeft: 10, fontWeight: 'bold' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statPill: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 10 },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    statText: { fontSize: 12, fontWeight: '600' },
    sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 15, marginLeft: 5 },
    subjectCard: { padding: 16, borderRadius: 16, marginBottom: 12, elevation: 2, shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
    subjectRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    subjectName: { fontSize: 16, fontWeight: '600' },
    subjectPercent: { fontWeight: '700' },
    miniStats: { fontSize: 12, marginTop: 6 },
    filterBarContainer: { height: 60, elevation: 2, marginBottom: 10, justifyContent: 'center' },
    filterScroll: { alignItems: 'center', paddingHorizontal: 10 },
    filterTab: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
    filterText: { fontWeight: '600' },
    lessonItem: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 10, borderRadius: 12, elevation: 1, marginHorizontal: 15, shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    iconContainer: { marginRight: 15, alignItems: 'center' },
    lessonContent: { flex: 1 },
    lessonName: { fontSize: 16, fontWeight: '500' },
    lessonDate: { fontSize: 12, marginTop: 2 },
    examBadge: { fontSize: 10, fontWeight:'700', marginBottom: 2 },
    statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    statusTagText: { fontSize: 11, fontWeight: '700' },
    emptyText: { textAlign: 'center', marginTop: 50 }
});

export default StudentSyllabusNavigator;