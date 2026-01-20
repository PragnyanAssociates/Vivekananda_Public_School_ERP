import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView,
    TouchableOpacity, TextInput, ActivityIndicator, Alert, Image
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// --- Types ---
interface TeacherRow {
    teacher_id: number;
    teacher_name: string;
    rating: number; // 1-5
    remarks: string;
    isSubmitted?: boolean; // Track if saved in DB
}

interface AdminReviewRow {
    student_name: string;
    roll_no: string;
    rating: number;
    remarks: string;
}

const TeacherFeedback = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    // --- STUDENT STATE ---
    const [myTeachers, setMyTeachers] = useState<TeacherRow[]>([]);
    
    // --- ADMIN STATE ---
    const [allClasses, setAllClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [classTeachers, setClassTeachers] = useState<{id: number, full_name: string}[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
    const [adminReviews, setAdminReviews] = useState<AdminReviewRow[]>([]);
    const [stats, setStats] = useState({ average: '0.0', total: 0 });

    // --- INITIAL LOAD ---
    useEffect(() => {
        if (!user) return;
        if (user.role === 'student') {
            fetchStudentView();
        } else if (user.role === 'admin') {
            fetchClasses();
        }
    }, [user]);

    // ==========================================
    // STUDENT LOGIC
    // ==========================================
    const fetchStudentView = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/student/assigned-teachers', {
                params: { student_id: user?.id, class_group: user?.class_group }
            });
            // Ensure rating is number, remarks string, and check if already submitted
            const formatted = response.data.map((t: any) => ({
                ...t,
                rating: t.rating || 0,
                remarks: t.remarks || '',
                // If rating or remarks exist, it's considered submitted/saved
                isSubmitted: (t.rating > 0 || (t.remarks && t.remarks.trim().length > 0))
            }));
            setMyTeachers(formatted);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load teachers.');
        } finally {
            setLoading(false);
        }
    };

    const updateMyFeedback = (teacherId: number, field: keyof TeacherRow, value: any) => {
        setMyTeachers(prev => prev.map(t => {
            if (t.teacher_id === teacherId) return { ...t, [field]: value };
            return t;
        }));
    };

    const handleStudentSave = async (teacher: TeacherRow) => {
        if (teacher.rating === 0) {
            Alert.alert("Rating Required", "Please give at least 1 star.");
            return;
        }
        try {
            await apiClient.post('/teacher-feedback', {
                student_id: user?.id,
                class_group: user?.class_group,
                teacher_id: teacher.teacher_id,
                rating: teacher.rating,
                remarks: teacher.remarks
            });
            
            // Mark as submitted locally to change icon
            setMyTeachers(prev => prev.map(t => {
                if (t.teacher_id === teacher.teacher_id) {
                    return { ...t, isSubmitted: true };
                }
                return t;
            }));

            Alert.alert("Success", `Feedback for ${teacher.teacher_name} saved!`);
        } catch (error) {
            Alert.alert("Error", "Could not save feedback.");
        }
    };

    // ==========================================
    // ADMIN LOGIC
    // ==========================================
    const fetchClasses = async () => {
        try {
            const res = await apiClient.get('/feedback/classes');
            setAllClasses(res.data);
        } catch (e) { console.error(e); }
    };

    // When Class Changes -> Fetch Teachers of that class
    useEffect(() => {
        if (user?.role === 'admin' && selectedClass) {
            const loadTeachers = async () => {
                try {
                    const res = await apiClient.get(`/timetable/${selectedClass}`);
                    const uniqueTeachers = new Map();
                    res.data.forEach((slot: any) => {
                        if(slot.teacher_id) uniqueTeachers.set(slot.teacher_id, slot.teacher_name);
                    });
                    const tList = Array.from(uniqueTeachers, ([id, full_name]) => ({ id, full_name }));
                    setClassTeachers(tList);
                    if(tList.length > 0) setSelectedTeacherId(tList[0].id);
                    else setSelectedTeacherId(null);
                } catch(e) { console.error(e); }
            };
            loadTeachers();
        }
    }, [selectedClass, user]);

    // When Teacher Changes -> Fetch Reviews
    useEffect(() => {
        if (user?.role === 'admin' && selectedClass && selectedTeacherId) {
            const loadReviews = async () => {
                setLoading(true);
                try {
                    const res = await apiClient.get('/admin/teacher-feedback', {
                        params: { teacher_id: selectedTeacherId, class_group: selectedClass }
                    });
                    setAdminReviews(res.data.reviews);
                    setStats({ average: res.data.average, total: res.data.total });
                } catch (e) { console.error(e); }
                finally { setLoading(false); }
            };
            loadReviews();
        }
    }, [selectedTeacherId, selectedClass, user]);


    // ==========================================
    // HELPER COMPONENTS
    // ==========================================
    const StarRating = ({ rating, setRating, readOnly = false }: { rating: number, setRating?: (r: number) => void, readOnly?: boolean }) => {
        return (
            <View style={{ flexDirection: 'row' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                        key={star}
                        disabled={readOnly}
                        onPress={() => setRating && setRating(star)}
                    >
                        <MaterialIcons
                            name={star <= rating ? "star" : "star-border"}
                            size={24}
                            color={star <= rating ? "#FFC107" : "#E0E0E0"} // Gold vs Grey
                            style={{ marginHorizontal: 2 }}
                        />
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerIconContainer}>
                     <MaterialIcons name="rate-review" size={24} color="#008080" />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>Teacher Feedback</Text>
                    <Text style={styles.headerSubtitle}>
                        {user?.role === 'student' ? 'Rate your teachers' : 'View Student Ratings'}
                    </Text>
                </View>
            </View>

            {/* ======================= STUDENT VIEW ======================= */}
            {user?.role === 'student' && (
                <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.th, { width: 40 }]}>#</Text>
                        <Text style={[styles.th, { flex: 1 }]}>Teacher Name</Text>
                        <Text style={[styles.th, { width: 100 }]}>Rating</Text>
                        <Text style={[styles.th, { width: 30 }]}> </Text>
                    </View>

                    {loading ? <ActivityIndicator color="#008080" style={{marginTop:20}} /> : (
                        myTeachers.length > 0 ? myTeachers.map((item, index) => (
                            <View key={item.teacher_id} style={styles.cardRow}>
                                {/* Row Top: Name and Stars */}
                                <View style={styles.rowTop}>
                                    <Text style={styles.serialNo}>{index + 1}.</Text>
                                    <Text style={styles.teacherName}>{item.teacher_name}</Text>
                                    <StarRating 
                                        rating={item.rating} 
                                        setRating={(r) => updateMyFeedback(item.teacher_id, 'rating', r)} 
                                    />
                                </View>
                                
                                {/* Row Bottom: Remarks Input & Button */}
                                <View style={styles.rowBottom}>
                                    <TextInput 
                                        style={styles.remarksInput}
                                        placeholder="Write remarks..."
                                        placeholderTextColor="#999"
                                        value={item.remarks}
                                        onChangeText={(text) => updateMyFeedback(item.teacher_id, 'remarks', text)}
                                    />
                                    {/* DYNAMIC BUTTON: SAVE vs EDIT */}
                                    <TouchableOpacity 
                                        style={[styles.iconSaveBtn, item.isSubmitted && styles.iconEditBtn]} 
                                        onPress={() => handleStudentSave(item)}
                                    >
                                        <MaterialIcons 
                                            name={item.isSubmitted ? "edit" : "save"} 
                                            size={20} 
                                            color="#FFF" 
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )) : (
                            <Text style={styles.emptyText}>No assigned teachers found.</Text>
                        )
                    )}
                </ScrollView>
            )}

            {/* ======================= ADMIN VIEW ======================= */}
            {user?.role === 'admin' && (
                <View style={{flex: 1}}>
                    {/* Filters */}
                    <View style={styles.filterContainer}>
                        <View style={styles.pickerWrapper}>
                            <Picker
                                selectedValue={selectedClass}
                                onValueChange={setSelectedClass}
                                style={styles.picker}
                            >
                                <Picker.Item label="Select Class" value="" color="#999" />
                                {allClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
                            </Picker>
                        </View>
                        {selectedClass !== '' && (
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    selectedValue={selectedTeacherId?.toString()}
                                    onValueChange={(v) => v && setSelectedTeacherId(parseInt(v))}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="Select Teacher" value="" color="#999" />
                                    {classTeachers.map(t => <Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} />)}
                                </Picker>
                            </View>
                        )}
                    </View>

                    {/* Stats Summary */}
                    {selectedTeacherId && (
                        <View style={styles.statsContainer}>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>Avg Rating</Text>
                                <View style={{flexDirection:'row', alignItems:'center'}}>
                                    <Text style={styles.statValue}>{stats.average}</Text>
                                    <MaterialIcons name="star" size={18} color="#FFC107" />
                                </View>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>Total Reviews</Text>
                                <Text style={styles.statValue}>{stats.total}</Text>
                            </View>
                        </View>
                    )}

                    {/* Review List */}
                    <View style={styles.tableHeader}>
                        <Text style={[styles.th, { width: 50 }]}>Roll</Text>
                        <Text style={[styles.th, { flex: 1 }]}>Student</Text>
                        <Text style={[styles.th, { width: 100 }]}>Rating</Text>
                    </View>
                    
                    {loading ? <ActivityIndicator color="#008080" style={{marginTop:20}} /> : (
                        <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
                            {adminReviews.length > 0 ? adminReviews.map((review, idx) => (
                                <View key={idx} style={styles.adminRow}>
                                    <View style={styles.rowTop}>
                                        <Text style={styles.rollNo}>{review.roll_no || '-'}</Text>
                                        <Text style={styles.studentName} numberOfLines={1}>{review.student_name}</Text>
                                        <StarRating rating={review.rating} readOnly />
                                    </View>
                                    {review.remarks ? (
                                        <Text style={styles.adminRemarks}>"{review.remarks}"</Text>
                                    ) : null}
                                </View>
                            )) : (
                                <Text style={styles.emptyText}>
                                    {selectedTeacherId ? "No feedback submitted yet." : "Select Class & Teacher."}
                                </Text>
                            )}
                        </ScrollView>
                    )}
                </View>
            )}

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F5F8' },

    // Header
    headerCard: {
        backgroundColor: '#FFFFFF', paddingHorizontal: 15, paddingVertical: 12,
        width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10,
        borderRadius: 12, flexDirection: 'row', alignItems: 'center',
        elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    },
    headerIconContainer: {
        backgroundColor: '#E0F2F1', borderRadius: 30, width: 45, height: 45,
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
    headerSubtitle: { fontSize: 13, color: '#666' },

    // Common Table Header
    tableHeader: {
        flexDirection: 'row', backgroundColor: '#e0e7ff', paddingVertical: 10, paddingHorizontal: 15,
        marginHorizontal: 10, borderRadius: 8, marginBottom: 5
    },
    th: { fontWeight: 'bold', color: '#4338ca', fontSize: 13 },

    // --- Student View Styles ---
    cardRow: {
        backgroundColor: '#FFF', marginHorizontal: 10, marginBottom: 10, borderRadius: 8,
        padding: 12, elevation: 1, borderLeftWidth: 4, borderLeftColor: '#008080'
    },
    rowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    serialNo: { width: 30, fontWeight: 'bold', color: '#555' },
    teacherName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#333' },
    
    rowBottom: { flexDirection: 'row', alignItems: 'center' },
    remarksInput: {
        flex: 1, backgroundColor: '#F5F5F5', borderRadius: 6, paddingHorizontal: 10,
        height: 40, marginRight: 10, color: '#333', fontSize: 13
    },
    // Default Save Button (Teal)
    iconSaveBtn: {
        backgroundColor: '#008080', width: 40, height: 40, borderRadius: 20,
        justifyContent: 'center', alignItems: 'center', elevation: 2
    },
    // Edit Button Style (Blue)
    iconEditBtn: {
        backgroundColor: '#2196F3', 
    },

    // --- Admin View Styles ---
    filterContainer: { paddingHorizontal: 10, marginBottom: 5 },
    pickerWrapper: {
        borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginBottom: 8,
        backgroundColor: '#fff', overflow: 'hidden', height: 45, justifyContent: 'center'
    },
    picker: { width: '100%', color: '#333' },
    
    statsContainer: {
        flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 10, marginBottom: 10
    },
    statBox: {
        flex: 1, backgroundColor: '#FFF', marginHorizontal: 5, padding: 10, borderRadius: 8,
        alignItems: 'center', elevation: 1
    },
    statLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase' },
    statValue: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 2 },

    adminRow: {
        backgroundColor: '#FFF', marginHorizontal: 10, marginBottom: 8, borderRadius: 8,
        padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee'
    },
    rollNo: { width: 50, fontWeight: 'bold', color: '#333' },
    studentName: { flex: 1, color: '#444' },
    adminRemarks: {
        marginTop: 5, fontStyle: 'italic', color: '#666', fontSize: 12, marginLeft: 50
    },

    emptyText: { textAlign: 'center', marginTop: 30, color: '#999' }
});

export default TeacherFeedback;