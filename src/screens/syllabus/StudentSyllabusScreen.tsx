import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, FlatList, Alert } from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useIsFocused } from '@react-navigation/native';
import * as Progress from 'react-native-progress';
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();
const FILTER_TYPES = ["Overall", "AT1", "UT1", "AT2", "UT2", "SA1", "AT3", "UT3", "AT4", "UT4", "SA2"];

// Helper for DD/MM/YYYY
const formatDate = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

const StudentSyllabusNavigator = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="StudentDashboard" component={StudentSyllabusDashboardScreen} />
        <Stack.Screen name="StudentLessonList" component={StudentLessonListScreen} />
    </Stack.Navigator>
);

const StudentSyllabusDashboardScreen = ({ navigation }) => {
    const { user } = useAuth();
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
        } catch (error) { 
            Alert.alert("Error", "Failed to fetch progress.");
        } finally { 
            setIsLoading(false); 
        }
    }, [user?.id]);

    useEffect(() => { if (isFocused) fetchSummary(); }, [isFocused, fetchSummary]);

    const overallProgress = summary.Total > 0 ? summary.Done / summary.Total : 0;

    return (
        <ScrollView style={styles.container}>
            
            {/* --- NEW HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerIconContainer}>
                    <MaterialIcons name="school" size={24} color="#008080" />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>{user?.class_group || 'Student'}</Text>
                    <Text style={styles.headerSubtitle}>Syllabus Tracking</Text>
                </View>
            </View>

            {isLoading ? <ActivityIndicator size="large" style={{ marginTop: 40 }} color="#3b82f6" /> :
            <View style={styles.contentContainer}>
                {/* Main Progress Card */}
                <View style={styles.mainCard}>
                    <Text style={styles.cardTitle}>Overall Progress</Text>
                    <View style={styles.progressBarRow}>
                        <Progress.Bar progress={overallProgress} width={null} color="#3b82f6" unfilledColor="#eff6ff" borderWidth={0} height={10} style={{flex: 1, borderRadius: 5}} />
                        <Text style={styles.percentText}>{Math.round(overallProgress * 100)}%</Text>
                    </View>
                    <View style={styles.statsRow}>
                        <View style={styles.statPill}><View style={[styles.dot, {backgroundColor:'#10b981'}]}/><Text style={styles.statText}>{summary.Done} Done</Text></View>
                        <View style={styles.statPill}><View style={[styles.dot, {backgroundColor:'#ef4444'}]}/><Text style={styles.statText}>{summary.Missed} Missed</Text></View>
                        <View style={styles.statPill}><View style={[styles.dot, {backgroundColor:'#f59e0b'}]}/><Text style={styles.statText}>{summary.Pending} Left</Text></View>
                    </View>
                </View>
                
                <Text style={styles.sectionTitle}>Subjects</Text>
                {subjects.map(subject => {
                    const subjectProgress = subject.Total > 0 ? subject.Done / subject.Total : 0;
                    return (
                        <TouchableOpacity key={subject.id} style={styles.subjectCard} onPress={() => navigation.navigate('StudentLessonList', { syllabusId: subject.id, subjectName: subject.name })}>
                            <View style={styles.subjectRow}>
                                <Text style={styles.subjectName}>{subject.name}</Text>
                                <Text style={styles.subjectPercent}>{Math.round(subjectProgress * 100)}%</Text>
                            </View>
                            <Progress.Bar progress={subjectProgress} width={null} color="#3b82f6" unfilledColor="#f1f5f9" borderWidth={0} height={6} borderRadius={3} style={{marginTop: 8}} />
                            <Text style={styles.miniStats}>{subject.Done} done • {subject.Pending} remaining</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
            }
        </ScrollView>
    );
};

const StudentLessonListScreen = ({ route, navigation }) => {
    const { syllabusId, subjectName } = route.params;
    const { user } = useAuth();
    
    // State for data and filtering
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
                setFilteredList(response.data.lessons); // Default to Overall
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
            setFilteredList(fullList.filter(l => l.exam_type === type));
        }
    };

    return (
        <View style={styles.container}>
            
            {/* --- NEW HEADER CARD (With Back Button) --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerContentWrapper}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color="#333333" />
                    </TouchableOpacity>

                    <View style={styles.headerIconContainer}>
                         <MaterialIcons name="menu-book" size={24} color="#008080" />
                    </View>
                    
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>{subjectName}</Text>
                        <Text style={styles.headerSubtitle}>Lesson Details</Text>
                    </View>
                </View>
            </View>
            
            {/* Filter Bar */}
            <View style={styles.filterBarContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                     {FILTER_TYPES.map(type => (
                        <TouchableOpacity 
                            key={type} 
                            onPress={() => handleFilter(type)}
                            style={[styles.filterTab, selectedFilter === type && styles.filterTabActive]}>
                            <Text style={[styles.filterText, selectedFilter === type && styles.filterTextActive]}>{type}</Text>
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
                        <View style={styles.lessonItem}>
                           <View style={styles.iconContainer}>
                                <MaterialIcons 
                                    name={isDone ? 'check-circle' : isMissed ? 'cancel' : 'radio-button-unchecked'} 
                                    size={24} 
                                    color={isDone ? '#10b981' : isMissed ? '#ef4444' : '#cbd5e1'} 
                                />
                                {item.status !== 'Pending' && <View style={{height: '100%', width: 2, backgroundColor: '#f1f5f9', position: 'absolute', top: 30, left: 11, zIndex: -1}} />}
                           </View>
                           <View style={styles.lessonContent}>
                                <Text style={[styles.lessonName, isDone && {textDecorationLine: 'line-through', color: '#94a3b8'}]}>{item.lesson_name}</Text>
                                <Text style={styles.examBadge}>{item.exam_type}</Text>
                                <Text style={styles.lessonDate}>
                                    Due: {formatDate(item.from_date)} - {formatDate(item.to_date)}
                                </Text>
                           </View>
                           <View style={[styles.statusTag, {backgroundColor: isDone ? '#dcfce7' : isMissed ? '#fee2e2' : '#f1f5f9'}]}>
                               <Text style={[styles.statusTagText, {color: isDone ? '#166534' : isMissed ? '#991b1b' : '#64748b'}]}>{item.status}</Text>
                           </View>
                        </View>
                    )
                }}
                ListEmptyComponent={!isLoading && <Text style={styles.emptyText}>No lessons found.</Text>}
                refreshing={isLoading}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F5F8' }, // Matching background
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 15,
        paddingVertical: 10,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
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
    // ----------------------------

    contentContainer: { paddingHorizontal: 15, paddingBottom: 20 },
    
    // Cards
    mainCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, shadowColor: '#3b82f6', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3, marginBottom: 25 },
    cardTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 15 },
    progressBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    percentText: { marginLeft: 10, fontWeight: 'bold', color: '#3b82f6' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 8, borderRadius: 10 },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    statText: { fontSize: 12, fontWeight: '600', color: '#475569' },

    sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 15, marginLeft: 5 },
    
    // Subject List
    subjectCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, shadowColor: '#64748b', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    subjectRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    subjectName: { fontSize: 16, fontWeight: '600', color: '#334155' },
    subjectPercent: { fontWeight: '700', color: '#3b82f6' },
    miniStats: { fontSize: 12, color: '#94a3b8', marginTop: 6 },

    // Filter Bar
    filterBarContainer: { backgroundColor: '#fff', height: 60, elevation: 2, marginBottom: 10 },
    filterScroll: { alignItems: 'center', paddingHorizontal: 10 },
    filterTab: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10, backgroundColor: '#f1f5f9' },
    filterTabActive: { backgroundColor: '#3b82f6' },
    filterText: { color: '#64748b', fontWeight: '600' },
    filterTextActive: { color: '#fff' },

    lessonItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginBottom: 10, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, marginHorizontal: 2 },
    iconContainer: { marginRight: 15, alignItems: 'center' },
    lessonContent: { flex: 1 },
    lessonName: { fontSize: 16, fontWeight: '500', color: '#1e293b' },
    lessonDate: { fontSize: 12, color: '#64748b', marginTop: 2 },
    examBadge: { fontSize: 10, color: '#3b82f6', fontWeight:'700', marginBottom: 2 },
    statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    statusTagText: { fontSize: 11, fontWeight: '700' },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#94a3b8' }
});

export default StudentSyllabusNavigator;