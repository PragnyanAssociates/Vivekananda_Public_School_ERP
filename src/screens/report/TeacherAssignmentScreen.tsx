/**
 * File: src/screens/report/TeacherAssignmentScreen.js
 * Purpose: Admin screen to assign teachers to subjects.
 * Updated: Responsive Design & Dark/Light Mode Support.
 */
import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, Alert, 
    ActivityIndicator, TouchableOpacity, useColorScheme, StatusBar 
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// --- CONSTANTS ---
const CLASS_SUBJECTS = {
    'LKG': ['All Subjects'],
    'UKG': ['All Subjects'],
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

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#f0f2f5',
    inputBg: '#FAFAFA',
    inputBorder: '#CFD8DC',
    iconBg: '#E0F2F1',
    // Success/Assigned States
    successBg: '#E8F5E9',
    successBorder: '#C8E6C9',
    successText: '#1B5E20',
    successLabel: '#2E7D32',
    // Button
    btnDisabled: '#B0BEC5'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    inputBorder: '#444444',
    iconBg: '#333333',
    // Success/Assigned States
    successBg: '#1b3a24', // Dark green background
    successBorder: '#2e5c3a',
    successText: '#a5d6a7', // Light green text
    successLabel: '#81c784',
    // Button
    btnDisabled: '#546E7A'
};

const TeacherAssignmentScreen = ({ route }) => {
    const { classGroup } = route.params;
    
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const [teachers, setTeachers] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [selectedTeachers, setSelectedTeachers] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const subjects = CLASS_SUBJECTS[classGroup] || [];

    useEffect(() => {
        fetchData();
    }, [classGroup]);

    const fetchData = async () => {
        try {
            const [teachersRes, assignmentsRes] = await Promise.all([
                apiClient.get('/reports/teachers'),
                apiClient.get(`/reports/teacher-assignments/${classGroup}`)
            ]);
            
            setTeachers(teachersRes.data);
            setAssignments(assignmentsRes.data);
            
            const selected = {};
            assignmentsRes.data.forEach(a => {
                selected[a.subject] = a.teacher_id.toString();
            });
            setSelectedTeachers(selected);
        } catch (error) {
            console.error('Error fetching data:', error);
            Alert.alert('Error', 'Failed to load teacher data');
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (subject) => {
        const teacherId = selectedTeachers[subject];
        if (!teacherId) {
            Alert.alert('Error', 'Please select a teacher');
            return;
        }

        setSaving(true);
        try {
            await apiClient.post('/reports/assign-teacher', {
                teacherId: parseInt(teacherId),
                classGroup,
                subject
            });
            Alert.alert('Success', 'Teacher assigned successfully. Previous marks for this subject will be visible to the new teacher.');
            fetchData();
        } catch (error) {
            console.error('Error assigning teacher:', error);
            Alert.alert('Error', 'Failed to assign teacher');
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (assignmentId) => {
        Alert.alert(
            'Confirm Removal',
            'Are you sure you want to remove this teacher assignment? \n\nNote: Student marks will NOT be deleted.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiClient.delete(`/reports/teacher-assignments/${assignmentId}`);
                            Alert.alert('Success', 'Assignment removed. Marks preserved.');
                            fetchData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to remove assignment');
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={[styles.loaderContainer, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.textMain }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <Icon name="account-details" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Teacher Allocation</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>{classGroup}</Text>
                    </View>
                </View>
            </View>

            {/* --- LIST CONTAINER --- */}
            <View style={styles.listContainer}>
                {subjects.map(subject => {
                    const currentAssignment = assignments.find(a => a.subject === subject);
                    
                    return (
                        <View key={subject} style={[styles.subjectCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                            <View style={[styles.cardHeader, { borderBottomColor: theme.border }]}>
                                <Icon name="book-open-page-variant" size={20} color={theme.textSub} style={{marginRight: 8}} />
                                <Text style={[styles.subjectTitle, { color: theme.textMain }]}>{subject}</Text>
                            </View>
                            
                            {currentAssignment ? (
                                // ASSIGNED STATE
                                <View style={[styles.assignedContainer, { backgroundColor: theme.successBg, borderColor: theme.successBorder }]}>
                                    <View style={styles.assignedInfo}>
                                        <Text style={[styles.assignedLabel, { color: theme.successLabel }]}>Assigned to:</Text>
                                        <Text style={[styles.teacherName, { color: theme.successText }]}>{currentAssignment.teacher_name}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.removeButton}
                                        onPress={() => handleRemove(currentAssignment.id)}
                                    >
                                        <Icon name="trash-can-outline" size={18} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                // UNASSIGNED STATE (PICKER)
                                <View style={styles.assignContainer}>
                                    <View style={[styles.pickerContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                                        <Picker
                                            selectedValue={selectedTeachers[subject] || ''}
                                            onValueChange={(value) => 
                                                setSelectedTeachers(prev => ({ ...prev, [subject]: value }))
                                            }
                                            style={[styles.picker, { color: theme.textMain }]}
                                            dropdownIconColor={theme.textMain}
                                        >
                                            <Picker.Item label="Select Teacher..." value="" color={theme.textSub}/>
                                            {teachers.map(teacher => (
                                                <Picker.Item 
                                                    key={teacher.id} 
                                                    label={teacher.full_name} 
                                                    value={teacher.id.toString()} 
                                                    color={theme.textMain}
                                                />
                                            ))}
                                        </Picker>
                                    </View>
                                    <TouchableOpacity
                                        style={[
                                            styles.assignButton, 
                                            { backgroundColor: theme.primary },
                                            (!selectedTeachers[subject] || saving) && { backgroundColor: theme.btnDisabled }
                                        ]}
                                        onPress={() => handleAssign(subject)}
                                        disabled={!selectedTeachers[subject] || saving}
                                    >
                                        <Text style={styles.assignButtonText}>Assign</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContainer: { paddingHorizontal: 15, paddingBottom: 30 },

    // Header
    headerCard: {
        paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },

    // Card
    subjectCard: { borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, borderWidth: 1, shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, paddingBottom: 8 },
    subjectTitle: { fontSize: 16, fontWeight: '700' },
    
    // Assigned Section
    assignedContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1 },
    assignedInfo: { flex: 1 },
    assignedLabel: { fontSize: 11, marginBottom: 2 },
    teacherName: { fontSize: 14, fontWeight: 'bold' },
    removeButton: { backgroundColor: '#ef5350', padding: 8, borderRadius: 6, marginLeft: 10 },

    // Assign Section
    assignContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    pickerContainer: { flex: 1, borderWidth: 1, borderRadius: 8, height: 45, justifyContent: 'center', overflow: 'hidden' },
    picker: { width: '100%' },
    assignButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', elevation: 2 },
    assignButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});

export default TeacherAssignmentScreen;