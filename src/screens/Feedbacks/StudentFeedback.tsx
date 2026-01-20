import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView,
    TouchableOpacity, TextInput, ActivityIndicator, Alert, Dimensions
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// --- CONSTANTS ---
const COL_WIDTHS = {
    ROLL: 60,      
    NAME: 180,     
    STATUS: 160,   
    REMARKS: 200   
};
const TABLE_MIN_WIDTH = COL_WIDTHS.ROLL + COL_WIDTHS.NAME + COL_WIDTHS.STATUS + COL_WIDTHS.REMARKS; 

interface StudentFeedbackRow {
    student_id: number;
    full_name: string;
    roll_no: string;
    behavior_status: 'Good' | 'Average' | 'Poor' | null;
    remarks: string;
}

interface Teacher {
    id: number;
    full_name: string;
}

const StudentFeedback = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    
    // --- Filters State ---
    const [allClasses, setAllClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>('');
    
    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    
    const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);

    // Data
    const [students, setStudents] = useState<StudentFeedbackRow[]>([]);
    const [hasChanges, setHasChanges] = useState(false);

    // --- 1. Initial Setup ---
    useEffect(() => {
        if (!user) return;
        fetchClasses(); // Step 1: Load Classes
    }, [user]);

    // --- 2. API Calls for Filters ---

    // Step 1: Fetch Classes (based on role)
    const fetchClasses = async () => {
        try {
            if (user?.role === 'admin') {
                const response = await apiClient.get('/feedback/classes');
                setAllClasses(response.data);
            } else if (user?.role === 'teacher') {
                // For teacher, get only their assigned classes
                const response = await apiClient.get(`/teacher-classes/${user.id}`);
                setAllClasses(response.data);
            }
        } catch (error) { console.error('Error fetching classes', error); }
    };

    // Step 2: When Class Changes -> Fetch Subjects
    useEffect(() => {
        if (!selectedClass) {
            setAvailableSubjects([]);
            setSelectedSubject('');
            return;
        }

        const fetchSubjects = async () => {
            try {
                const params: any = { class_group: selectedClass };
                // If teacher logged in, filter subjects by their ID
                if (user?.role === 'teacher') params.teacher_id = user.id;

                const response = await apiClient.get('/feedback/subjects', { params });
                setAvailableSubjects(response.data);
                
                // Auto-select first subject if available
                if (response.data.length > 0) setSelectedSubject(response.data[0]);
                else setSelectedSubject('');

            } catch (error) { console.error('Error fetching subjects', error); }
        };
        fetchSubjects();
    }, [selectedClass, user]);

    // Step 3: When Subject Changes -> Fetch Teachers (Admin Only) OR Set Teacher ID (Teacher Only)
    useEffect(() => {
        if (!selectedClass || !selectedSubject) {
            setAvailableTeachers([]);
            if (user?.role === 'admin') setSelectedTeacherId(null);
            return;
        }

        if (user?.role === 'teacher') {
            setSelectedTeacherId(user.id); // Teacher ID is fixed for logged-in teacher
        } else if (user?.role === 'admin') {
            const fetchTeachersForSubject = async () => {
                try {
                    const response = await apiClient.get('/feedback/teachers', {
                        params: { class_group: selectedClass, subject: selectedSubject }
                    });
                    setAvailableTeachers(response.data);
                    
                    // Auto-select first teacher
                    if (response.data.length > 0) setSelectedTeacherId(response.data[0].id);
                    else setSelectedTeacherId(null);

                } catch (error) { console.error('Error fetching teachers', error); }
            };
            fetchTeachersForSubject();
        }
    }, [selectedClass, selectedSubject, user]);


    // --- 3. Fetch Student Data (Final Step) ---
    const fetchStudentData = useCallback(async () => {
        if (!selectedClass || !selectedTeacherId) {
            setStudents([]);
            return;
        }

        setLoading(true);
        try {
            const response = await apiClient.get('/feedback/students', {
                params: { class_group: selectedClass, teacher_id: selectedTeacherId }
            });
            const formattedData = response.data.map((s: any) => ({
                ...s,
                behavior_status: s.behavior_status || null,
                remarks: s.remarks || ''
            }));
            setStudents(formattedData);
            setHasChanges(false);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load student list.');
        } finally {
            setLoading(false);
        }
    }, [selectedClass, selectedTeacherId]);

    // Trigger fetch when all filters are ready
    useEffect(() => {
        if (selectedClass && selectedSubject && selectedTeacherId) {
            fetchStudentData();
        }
    }, [selectedClass, selectedSubject, selectedTeacherId, fetchStudentData]);


    // --- 4. Save Logic ---
    const handleSave = async () => {
        if (!selectedTeacherId || !selectedClass) return;
        setLoading(true);
        try {
            const payload = {
                teacher_id: selectedTeacherId,
                class_group: selectedClass,
                feedback_data: students.map(s => ({
                    student_id: s.student_id,
                    behavior_status: s.behavior_status,
                    remarks: s.remarks
                }))
            };
            await apiClient.post('/feedback', payload);
            Alert.alert("Success", "Student behavior updated!");
            setHasChanges(false);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to save feedback.");
        } finally {
            setLoading(false);
        }
    };

    const updateStudentFeedback = (id: number, field: keyof StudentFeedbackRow, value: any) => {
        if (user?.role === 'admin') return; 
        setStudents(prev => prev.map(s => {
            if (s.student_id === id) return { ...s, [field]: value };
            return s;
        }));
        setHasChanges(true);
    };

    // --- Components ---
    const StatusButton = ({ label, currentStatus, targetStatus, color, onPress, disabled }: any) => {
        const isSelected = currentStatus === targetStatus;
        return (
            <TouchableOpacity 
                style={[
                    styles.statusBtn, 
                    isSelected 
                        ? { backgroundColor: color, borderColor: color, borderWidth: 1 } 
                        : { borderColor: '#E0E0E0', backgroundColor: '#FFF', borderWidth: 1 }
                ]}
                onPress={onPress}
                disabled={disabled}
            >
                <Text style={[
                    styles.statusBtnText, 
                    isSelected ? { color: '#FFF' } : { color: '#9e9e9e' }
                ]}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                         <MaterialIcons name="fact-check" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Behaviour</Text>
                        <Text style={styles.headerSubtitle}>Student Tracking</Text>
                    </View>
                </View>
            </View>

            {/* --- FILTERS --- */}
            <View style={styles.filterContainer}>
                {/* 1. Class Filter */}
                <View style={styles.pickerWrapper}>
                    <Picker
                        selectedValue={selectedClass}
                        onValueChange={setSelectedClass}
                        style={styles.picker}
                        dropdownIconColor="#008080"
                    >
                        <Picker.Item label="Select Class" value="" color="#94a3b8" />
                        {allClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
                    </Picker>
                </View>

                {/* 2. Subject Filter */}
                {selectedClass !== '' && (
                    <View style={styles.pickerWrapper}>
                        <Picker
                            selectedValue={selectedSubject}
                            onValueChange={setSelectedSubject}
                            enabled={availableSubjects.length > 0}
                            style={styles.picker}
                            dropdownIconColor="#008080"
                        >
                            <Picker.Item label="Select Subject" value="" color="#94a3b8" />
                            {availableSubjects.map(s => <Picker.Item key={s} label={s} value={s} />)}
                        </Picker>
                    </View>
                )}

                {/* 3. Teacher Filter (Admin Only) */}
                {user?.role === 'admin' && selectedSubject !== '' && (
                    <View style={styles.pickerWrapper}>
                        <Picker
                            selectedValue={selectedTeacherId?.toString()}
                            onValueChange={(val) => val && setSelectedTeacherId(parseInt(val))}
                            enabled={availableTeachers.length > 0}
                            style={styles.picker}
                            dropdownIconColor="#008080"
                        >
                            <Picker.Item label="Select Teacher" value="" color="#94a3b8" />
                            {availableTeachers.map(t => <Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} />)}
                        </Picker>
                    </View>
                )}
            </View>

            {/* --- TABLE AREA --- */}
            <View style={{flex: 1}}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }}
                >
                    <View style={{ minWidth: TABLE_MIN_WIDTH }}>
                        
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.th, { width: COL_WIDTHS.ROLL, paddingLeft: 10 }]}>Roll</Text>
                            <Text style={[styles.th, { width: COL_WIDTHS.NAME }]}>Student Name</Text>
                            <Text style={[styles.th, { width: COL_WIDTHS.STATUS, textAlign: 'center' }]}>Status</Text>
                            <Text style={[styles.th, { width: COL_WIDTHS.REMARKS, paddingLeft: 10 }]}>Remarks</Text>
                        </View>

                        {/* List */}
                        {loading ? (
                            <ActivityIndicator size="large" color="#008080" style={{ marginTop: 40 }} />
                        ) : (
                            <ScrollView contentContainerStyle={{ paddingBottom: 130 }}> 
                                {students.length > 0 ? (
                                    students.map((item, index) => (
                                        <View key={item.student_id} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
                                            <Text style={[styles.td, { width: COL_WIDTHS.ROLL, paddingLeft: 10, fontWeight: '700', color: '#111' }]}>
                                                {item.roll_no ? item.roll_no.toString().padStart(2, '0') : '-'}
                                            </Text>
                                            <Text style={[styles.td, { width: COL_WIDTHS.NAME, color: '#444' }]} numberOfLines={1}>
                                                {item.full_name}
                                            </Text>
                                            
                                            <View style={{ width: COL_WIDTHS.STATUS, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                                                <StatusButton label="G" targetStatus="Good" currentStatus={item.behavior_status} color="#10b981" disabled={user?.role === 'admin'} onPress={() => updateStudentFeedback(item.student_id, 'behavior_status', 'Good')} />
                                                <StatusButton label="A" targetStatus="Average" currentStatus={item.behavior_status} color="#3b82f6" disabled={user?.role === 'admin'} onPress={() => updateStudentFeedback(item.student_id, 'behavior_status', 'Average')} />
                                                <StatusButton label="P" targetStatus="Poor" currentStatus={item.behavior_status} color="#ef4444" disabled={user?.role === 'admin'} onPress={() => updateStudentFeedback(item.student_id, 'behavior_status', 'Poor')} />
                                            </View>

                                            <View style={{ width: COL_WIDTHS.REMARKS, paddingLeft: 10 }}>
                                                <TextInput 
                                                    style={styles.input}
                                                    placeholder="..."
                                                    placeholderTextColor="#bdbdbd"
                                                    value={item.remarks}
                                                    editable={user?.role !== 'admin'}
                                                    onChangeText={(text) => updateStudentFeedback(item.student_id, 'remarks', text)}
                                                />
                                            </View>
                                        </View>
                                    ))
                                ) : (
                                    <View style={styles.emptyContainer}>
                                        <MaterialIcons name="person-off" size={40} color="#CFD8DC" />
                                        <Text style={styles.emptyText}>
                                            {!selectedClass ? "Select a class to view students." : "No students found."}
                                        </Text>
                                    </View>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </ScrollView>
            </View>

            {/* --- SAVE BUTTON --- */}
            {user?.role === 'teacher' && hasChanges && (
                <View style={styles.floatingSaveContainer}>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" size="small"/> : (
                            <Text style={styles.saveBtnText}>Save Changes</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* --- FOOTER LEGEND --- */}
            <View style={styles.footerContainer}>
                <View style={styles.legendContainer}>
                    <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#10b981' }]} /><Text style={styles.legendText}>Good</Text></View>
                    <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} /><Text style={styles.legendText}>Avg</Text></View>
                    <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} /><Text style={styles.legendText}>Poor</Text></View>
                </View>
            </View>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F5F8' }, 
    
    // Header
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
        elevation: 3,
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        backgroundColor: '#E0F2F1',
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

    // Filters
    filterContainer: { paddingHorizontal: 20, marginBottom: 5 },
    pickerWrapper: {
        borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginBottom: 10,
        backgroundColor: '#fff', overflow: 'hidden', height: 45, justifyContent: 'center'
    },
    picker: { width: '100%', color: '#1f2937' },
    
    // Table
    tableHeader: {
        flexDirection: 'row', backgroundColor: '#e0e7ff', paddingVertical: 12,
        borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#c7d2fe',
        borderTopLeftRadius: 8, borderTopRightRadius: 8
    },
    th: { fontWeight: '700', color: '#4338ca', fontSize: 13 },
    
    // Rows
    row: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#FFF', minHeight: 65
    },
    rowAlt: { backgroundColor: '#f8fafc' },
    td: { fontSize: 13, color: '#374151' },
    
    // Status Buttons
    statusBtn: { width: 36, height: 36, borderRadius: 6, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    statusBtnText: { fontWeight: 'bold', fontSize: 14 },
    
    // Input
    input: { borderBottomWidth: 1, borderBottomColor: '#cbd5e1', height: 40, fontSize: 13, padding: 0, color: '#374151' },
    
    // Floating Save
    floatingSaveContainer: {
        position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center', paddingBottom: 10, zIndex: 10,
    },
    saveBtn: {
        backgroundColor: '#008080', paddingVertical: 10, paddingHorizontal: 30, borderRadius: 25,
        elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: {width: 0, height: 2}
    },
    saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, letterSpacing: 0.5 },

    // Footer
    footerContainer: {
        position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', 
        borderTopWidth: 1, borderTopColor: '#f0f0f0', height: 45, 
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
        paddingHorizontal: 20, elevation: 10
    },
    legendContainer: { flexDirection: 'row', alignItems: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 },
    legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
    legendText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
    
    emptyContainer: { alignItems: 'center', marginTop: 50, width: '100%' },
    emptyText: { textAlign: 'center', marginTop: 10, color: '#94a3b8', fontSize: 14 },
});

export default StudentFeedback;