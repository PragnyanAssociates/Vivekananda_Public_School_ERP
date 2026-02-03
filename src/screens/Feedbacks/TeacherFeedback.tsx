import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView,
    TouchableOpacity, ActivityIndicator, Alert, Modal, Animated, Easing, TextInput
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// --- CONSTANTS ---
const TEACHER_COL_WIDTH = 130; 
const NAME_COL_WIDTH = 150;
const ROLL_COL_WIDTH = 50;
const FIXED_COLS_WIDTH = NAME_COL_WIDTH + ROLL_COL_WIDTH;

// --- Types ---
interface TeacherRow {
    teacher_id: number;
    teacher_name: string;
    rating: number; // 1-5
    teaching_quality: 'Good' | 'Average' | 'Poor' | ''; // Renamed from remarks
    suggestions: string; // Added
    isSubmitted?: boolean; 
}

interface AdminReviewRow {
    student_name: string;
    roll_no: string;
    rating: number;
    teaching_quality: string;
    suggestions: string;
}

interface MatrixStudent {
    id: number;
    full_name: string;
    roll_no: string;
    feedback_map: {
        [teacherId: number]: { rating: number, teaching_quality: string, suggestions: string }
    };
}

interface AnalyticsItem {
    teacher_id: number;
    teacher_name: string;
    avg_rating: number;
    percentage: number;
    total_reviews: number;
}

// --- ANIMATED BAR COMPONENT ---
const AnimatedBar = ({ percentage, rating, label, color }: any) => {
    const animatedHeight = useRef(new Animated.Value(0)).current;

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
        outputRange: ['0%', `${percentage}%`]
    });

    return (
        <View style={styles.barWrapper}>
            <Text style={styles.barLabelTop}>{Math.round(percentage)}%</Text>
            <View style={styles.barTrack}>
                <Animated.View style={[styles.barFill, { height: heightStyle, backgroundColor: color }]} />
            </View>
            <Text style={styles.barLabelBottom} numberOfLines={1}>
                {label.split(' ')[0]}
            </Text>
            <View style={{flexDirection:'row', alignItems:'center', marginTop:2}}>
                 <Text style={{fontSize:10, fontWeight:'bold', color:'#555'}}>{rating}</Text>
                 <MaterialIcons name="star" size={10} color="#FFC107" />
            </View>
        </View>
    );
};

// --- EXPANDABLE ADMIN LIST ITEM COMPONENT ---
const AdminReviewItem = ({ review }: { review: AdminReviewRow }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <View style={styles.adminRow}>
            <View style={styles.adminRowMain}>
                <Text style={styles.rollNo}>{review.roll_no || '-'}</Text>
                <Text style={styles.studentName} numberOfLines={1}>{review.student_name}</Text>
                <View style={{alignItems:'flex-end'}}>
                    {/* Just Show Rating Initially */}
                    <StarRating rating={review.rating} readOnly size={18} />
                    
                    {/* View More Button */}
                    <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.viewMoreBtn}>
                        <Text style={styles.viewMoreText}>{expanded ? "Show Less" : "View More"}</Text>
                        <MaterialIcons name={expanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={14} color="#008080" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Expanded Content */}
            {expanded && (
                <View style={styles.adminRowDetails}>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Quality of teaching:</Text>
                        <View style={[
                            styles.miniBadgeLarge, 
                            { backgroundColor: review.teaching_quality === 'Good' ? '#10b981' : review.teaching_quality === 'Poor' ? '#ef4444' : '#3b82f6' }
                        ]}>
                            <Text style={styles.badgeText}>{review.teaching_quality || 'Not Selected'}</Text>
                        </View>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Student Suggestion:</Text>
                        <Text style={styles.suggestionText}>
                            {review.suggestions ? review.suggestions : "No suggestions provided."}
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
};

// --- STAR RATING COMPONENT ---
const StarRating = ({ rating, setRating, readOnly = false, size=24 }: any) => {
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
                        size={size}
                        color={star <= rating ? "#FFC107" : "#E0E0E0"}
                        style={{ marginHorizontal: 1 }}
                    />
                </TouchableOpacity>
            ))}
        </View>
    );
};

const TeacherFeedback = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    // --- STUDENT STATE ---
    const [myTeachers, setMyTeachers] = useState<TeacherRow[]>([]);
    
    // --- ADMIN STATE (Main Screen) ---
    const [allClasses, setAllClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [classTeachers, setClassTeachers] = useState<{id: number | string, full_name: string}[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>(''); 
    
    const [adminReviews, setAdminReviews] = useState<AdminReviewRow[]>([]); // List View
    const [matrixData, setMatrixData] = useState<{teachers: any[], students: MatrixStudent[]} | null>(null); // Matrix View
    const [stats, setStats] = useState({ average: '0.0', total: 0 });

    // --- COMPARE MODAL STATE ---
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [compareClass, setCompareClass] = useState('All Classes');
    const [analyticsData, setAnalyticsData] = useState<AnalyticsItem[]>([]);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

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
            const formatted = response.data.map((t: any) => ({
                ...t,
                rating: t.rating || 0,
                teaching_quality: t.teaching_quality || '',
                suggestions: t.suggestions || '',
                isSubmitted: (t.rating > 0)
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
        if (!teacher.teaching_quality) {
            Alert.alert("Input Required", "Please select Quality of Teaching.");
            return;
        }

        try {
            await apiClient.post('/teacher-feedback', {
                student_id: user?.id,
                class_group: user?.class_group,
                teacher_id: teacher.teacher_id,
                rating: teacher.rating,
                teaching_quality: teacher.teaching_quality,
                suggestions: teacher.suggestions
            });
            
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
    // ADMIN LOGIC (MAIN SCREEN)
    // ==========================================
    const fetchClasses = async () => {
        try {
            const res = await apiClient.get('/feedback/classes');
            setAllClasses(res.data);
            if (res.data.length > 0) {
                const defaultClass = res.data.includes("Class 10") ? "Class 10" : res.data[0];
                setSelectedClass(defaultClass);
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (user?.role === 'admin' && selectedClass) {
            const loadTeachers = async () => {
                try {
                    const res = await apiClient.get(`/timetable/${selectedClass}`);
                    const uniqueTeachers = new Map();
                    res.data.forEach((slot: any) => {
                        if(slot.teacher_id) uniqueTeachers.set(slot.teacher_id, slot.teacher_name);
                    });
                    
                    let tList: any[] = Array.from(uniqueTeachers, ([id, full_name]) => ({ id, full_name }));
                    tList = [{ id: 'all', full_name: 'All Teachers' }, ...tList];
                    
                    setClassTeachers(tList);
                    if(tList.length > 0) setSelectedTeacherId(tList[0].id.toString());
                } catch(e) { console.error(e); }
            };
            loadTeachers();
        }
    }, [selectedClass, user]);

    useEffect(() => {
        if (user?.role === 'admin' && selectedClass && selectedTeacherId) {
            const loadReviews = async () => {
                setLoading(true);
                try {
                    const params: any = { class_group: selectedClass };
                    if (selectedTeacherId === 'all') {
                        params.mode = 'all'; 
                    } else {
                        params.teacher_id = selectedTeacherId;
                    }

                    const res = await apiClient.get('/admin/teacher-feedback', { params });
                    
                    if (res.data.mode === 'matrix') {
                        setMatrixData({ teachers: res.data.teachers, students: res.data.students });
                        setAdminReviews([]); 
                    } else {
                        setAdminReviews(res.data.reviews);
                        setStats({ average: res.data.average, total: res.data.total });
                        setMatrixData(null); 
                    }
                } catch (e) { console.error(e); }
                finally { setLoading(false); }
            };
            loadReviews();
        }
    }, [selectedTeacherId, selectedClass, user]);

    // ==========================================
    // COMPARE MODAL LOGIC
    // ==========================================
    useEffect(() => {
        if (showCompareModal) {
            fetchAnalytics();
        }
    }, [showCompareModal, compareClass, sortOrder]);

    const fetchAnalytics = async () => {
        setLoadingAnalytics(true);
        try {
            const params: any = { mode: 'analytics' };
            if (compareClass === 'All Classes') params.class_group = 'all';
            else params.class_group = compareClass;

            const res = await apiClient.get('/admin/teacher-feedback', { params });
            let data = res.data.data || [];
            
            data.sort((a: AnalyticsItem, b: AnalyticsItem) => {
                return sortOrder === 'desc' 
                    ? b.percentage - a.percentage
                    : a.percentage - b.percentage;
            });
            setAnalyticsData(data);
        } catch (error) {
            console.error("Analytics Error", error);
        } finally {
            setLoadingAnalytics(false);
        }
    };

    // Helper for Quality Selection Buttons
    const QualityButtons = ({ selected, onSelect, readOnly=false }: any) => {
        const options = ['Good', 'Average', 'Poor'];
        const colors: any = { 'Good': '#10b981', 'Average': '#3b82f6', 'Poor': '#ef4444' };
        
        return (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {options.map(opt => (
                    <TouchableOpacity
                        key={opt}
                        disabled={readOnly}
                        onPress={() => onSelect(opt)}
                        style={[
                            styles.remarkBtn,
                            selected === opt 
                                ? { backgroundColor: colors[opt], borderColor: colors[opt] }
                                : { borderColor: '#ccc', backgroundColor: '#fff' }
                        ]}
                    >
                        <Text style={[
                            styles.remarkBtnText,
                            selected === opt ? { color: '#fff' } : { color: '#999' }
                        ]}>
                            {opt}
                        </Text>
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
                    {loading ? <ActivityIndicator color="#008080" style={{marginTop:20}} /> : (
                        myTeachers.length > 0 ? myTeachers.map((item, index) => (
                            <View key={item.teacher_id} style={styles.cardRow}>
                                <View style={styles.rowHeader}>
                                    <Text style={styles.serialNo}>{index + 1}.</Text>
                                    <Text style={styles.teacherName}>{item.teacher_name}</Text>
                                    <TouchableOpacity 
                                        style={[styles.iconSaveBtn, item.isSubmitted && styles.iconEditBtn]} 
                                        onPress={() => handleStudentSave(item)}
                                    >
                                        <MaterialIcons name={item.isSubmitted ? "check" : "save"} size={20} color="#FFF" />
                                    </TouchableOpacity>
                                </View>
                                
                                {/* 1. RATING */}
                                <View style={styles.inputArea}>
                                    <Text style={styles.label}>Rate:</Text>
                                    <StarRating 
                                        rating={item.rating} 
                                        setRating={(r: number) => updateMyFeedback(item.teacher_id, 'rating', r)} 
                                        size={30}
                                    />
                                </View>

                                {/* 2. QUALITY OF TEACHING */}
                                <View style={styles.inputArea}>
                                    <Text style={styles.label}>Quality of teaching:</Text>
                                    <QualityButtons 
                                        selected={item.teaching_quality} 
                                        onSelect={(val: string) => updateMyFeedback(item.teacher_id, 'teaching_quality', val)}
                                    />
                                </View>

                                {/* 3. SUGGESTIONS */}
                                <View style={styles.inputArea}>
                                    <Text style={styles.label}>Student suggestion:</Text>
                                    <TextInput 
                                        style={styles.textInput}
                                        multiline
                                        numberOfLines={2}
                                        placeholder="Write your suggestions here..."
                                        placeholderTextColor="#999"
                                        value={item.suggestions}
                                        onChangeText={(text) => updateMyFeedback(item.teacher_id, 'suggestions', text)}
                                    />
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <View style={[styles.pickerWrapper, { flex: 1, marginBottom: 0 }]}>
                                <Picker
                                    selectedValue={selectedClass}
                                    onValueChange={setSelectedClass}
                                    style={styles.picker}
                                >
                                    {allClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
                                </Picker>
                            </View>
                            <TouchableOpacity 
                                style={styles.comButton}
                                onPress={() => setShowCompareModal(true)}
                            >
                                <Text style={styles.comBtnText}>COM</Text>
                                <MaterialIcons name="bar-chart" size={18} color="#fff" style={{marginLeft: 4}} />
                            </TouchableOpacity>
                        </View>
                        {selectedClass !== '' && (
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    selectedValue={selectedTeacherId}
                                    onValueChange={(v) => setSelectedTeacherId(v)}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="Select Teacher" value="" color="#999" />
                                    {classTeachers.map(t => <Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} />)}
                                </Picker>
                            </View>
                        )}
                    </View>

                    {loading ? <ActivityIndicator color="#008080" style={{marginTop:20}} /> : (
                        <>
                            {/* CASE 1: SPECIFIC TEACHER (List View) */}
                            {selectedTeacherId !== 'all' && selectedTeacherId !== '' && (
                                <>
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

                                    <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
                                        <View style={styles.tableHeader}>
                                            <Text style={[styles.th, { width: 50 }]}>Roll</Text>
                                            <Text style={[styles.th, { flex: 1 }]}>Student</Text>
                                            <Text style={[styles.th, { width: 100 }]}>Rating</Text>
                                        </View>
                                        {adminReviews.map((review, idx) => (
                                            <AdminReviewItem key={idx} review={review} />
                                        ))}
                                    </ScrollView>
                                </>
                            )}

                            {/* CASE 2: ALL TEACHERS (Matrix View) */}
                            {selectedTeacherId === 'all' && matrixData && (
                                <ScrollView horizontal contentContainerStyle={{flexGrow: 1}}>
                                    <View>
                                        {/* Matrix Header */}
                                        <View style={[styles.matrixHeaderRow, { minWidth: FIXED_COLS_WIDTH + (matrixData.teachers.length * TEACHER_COL_WIDTH) }]}>
                                            <View style={{width: ROLL_COL_WIDTH, justifyContent:'center', alignItems:'center'}}><Text style={styles.th}>Roll</Text></View>
                                            <View style={{width: NAME_COL_WIDTH, justifyContent:'center'}}><Text style={styles.th}>Student Name</Text></View>
                                            {matrixData.teachers.map((t) => (
                                                <View key={t.id} style={{width: TEACHER_COL_WIDTH, justifyContent:'center', alignItems:'center', paddingHorizontal: 2}}>
                                                    <Text style={[styles.th, { textAlign: 'center' }]} numberOfLines={2}>
                                                        {t.full_name.split(' ')[0]}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>

                                        {/* Matrix Rows */}
                                        <ScrollView contentContainerStyle={{paddingBottom: 60}}>
                                            {matrixData.students.map((stu) => (
                                                <View key={stu.id} style={[styles.matrixRow, { minWidth: FIXED_COLS_WIDTH + (matrixData.teachers.length * TEACHER_COL_WIDTH) }]}>
                                                    <View style={{width: ROLL_COL_WIDTH, justifyContent:'center', alignItems:'center'}}><Text style={styles.rollNo}>{stu.roll_no || '-'}</Text></View>
                                                    <View style={{width: NAME_COL_WIDTH}}><Text style={styles.studentName} numberOfLines={1}>{stu.full_name}</Text></View>
                                                    
                                                    {matrixData.teachers.map((t) => {
                                                        const fb = stu.feedback_map[t.id];
                                                        return (
                                                            <View key={t.id} style={styles.matrixCell}>
                                                                {fb ? (
                                                                    <TouchableOpacity 
                                                                        style={{alignItems:'center'}}
                                                                        onPress={() => {
                                                                             Alert.alert(
                                                                                 `${t.full_name}`,
                                                                                 `Quality: ${fb.teaching_quality || 'N/A'}\n\nSuggestion: ${fb.suggestions || 'None'}`
                                                                             );
                                                                        }}
                                                                    >
                                                                       <StarRating rating={fb.rating} readOnly size={12} /> 
                                                                       <View style={{flexDirection:'row', alignItems:'center', marginTop:2}}>
                                                                           <Text style={[styles.miniBadge, {
                                                                               backgroundColor: fb.teaching_quality === 'Good' ? '#10b981' : fb.teaching_quality === 'Poor' ? '#ef4444' : '#3b82f6'
                                                                           }]}>
                                                                               {fb.teaching_quality ? fb.teaching_quality.charAt(0) : '-'}
                                                                           </Text>
                                                                           <View style={styles.viewMoreMini}>
                                                                                <Text style={{fontSize:8, color:'#fff'}}>View</Text>
                                                                           </View>
                                                                       </View>
                                                                    </TouchableOpacity>
                                                                ) : (
                                                                    <Text style={{color:'#ccc'}}>-</Text>
                                                                )}
                                                            </View>
                                                        )
                                                    })}
                                                </View>
                                            ))}
                                        </ScrollView>
                                    </View>
                                </ScrollView>
                            )}
                        </>
                    )}
                </View>
            )}

            {/* COMPARE MODAL */}
            <Modal
                visible={showCompareModal}
                animationType="slide"
                onRequestClose={() => setShowCompareModal(false)}
            >
                <SafeAreaView style={{flex:1, backgroundColor:'#FFF'}}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowCompareModal(false)} style={{padding:5}}>
                            <MaterialIcons name="close" size={26} color="#333" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Performance Analytics</Text>
                        <View style={{width:30}}/>
                    </View>

                    <View style={styles.modalFilterContainer}>
                        <View style={{marginBottom: 10}}>
                            <Text style={styles.modalLabel}>Select Class:</Text>
                            <View style={styles.modalPickerWrap}>
                                <Picker
                                    selectedValue={compareClass}
                                    onValueChange={setCompareClass}
                                    style={{width:'100%'}}
                                >
                                    <Picker.Item label="All Classes" value="All Classes" />
                                    {allClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
                                </Picker>
                            </View>
                        </View>
                        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                            <Text style={styles.modalLabel}>Sort Order:</Text>
                            <View style={{flexDirection:'row', backgroundColor:'#F5F5F5', borderRadius:8}}>
                                <TouchableOpacity 
                                    style={[styles.sortBtn, sortOrder==='desc' && styles.sortBtnActive]}
                                    onPress={() => setSortOrder('desc')}
                                >
                                    <Text style={[styles.sortBtnText, sortOrder==='desc' && {color:'#008080', fontWeight:'bold'}]}>High to Low</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.sortBtn, sortOrder==='asc' && styles.sortBtnActive]}
                                    onPress={() => setSortOrder('asc')}
                                >
                                    <Text style={[styles.sortBtnText, sortOrder==='asc' && {color:'#008080', fontWeight:'bold'}]}>Low to High</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    <View style={styles.graphContainer}>
                        {loadingAnalytics ? (
                            <ActivityIndicator size="large" color="#008080" />
                        ) : analyticsData.length > 0 ? (
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false} 
                                contentContainerStyle={{paddingHorizontal: 10, alignItems:'flex-end'}}
                            >
                                {analyticsData.map((item, idx) => {
                                    let color = '#3b82f6';
                                    if(item.percentage >= 85) color = '#10b981';
                                    else if(item.percentage < 50) color = '#ef4444';

                                    return (
                                        <AnimatedBar 
                                            key={idx}
                                            percentage={item.percentage}
                                            rating={item.avg_rating}
                                            label={item.teacher_name}
                                            color={color}
                                        />
                                    );
                                })}
                            </ScrollView>
                        ) : (
                            <Text style={{color:'#999', marginTop: 50}}>No data available.</Text>
                        )}
                    </View>

                    <View style={styles.modalFooter}>
                         <View style={{flexDirection:'row', alignItems:'center', gap:5}}>
                             <View style={{width:10, height:10, borderRadius:5, backgroundColor:'#10b981'}}/>
                             <Text style={{fontSize:12, color:'#555'}}>85-100%</Text>
                         </View>
                         <View style={{flexDirection:'row', alignItems:'center', gap:5}}>
                             <View style={{width:10, height:10, borderRadius:5, backgroundColor:'#3b82f6'}}/>
                             <Text style={{fontSize:12, color:'#555'}}>50-85%</Text>
                         </View>
                         <View style={{flexDirection:'row', alignItems:'center', gap:5}}>
                             <View style={{width:10, height:10, borderRadius:5, backgroundColor:'#ef4444'}}/>
                             <Text style={{fontSize:12, color:'#555'}}>0-50%</Text>
                         </View>
                    </View>
                </SafeAreaView>
            </Modal>

            <View style={styles.footerContainer}>
                <View style={styles.legendGroup}>
                    <Text style={styles.legendLabel}>Scale: </Text>
                    <MaterialIcons name="star" size={14} color="#FFC107" />
                    <Text style={styles.legendText}> (1-5)</Text>
                </View>
                <View style={styles.verticalDivider} />
                <View style={styles.legendGroup}>
                    <Text style={styles.legendLabel}>Note: </Text>
                    <Text style={[styles.legendText, { color: '#10b981', fontWeight:'bold' }]}>G</Text><Text style={styles.legendText}>=Good, </Text>
                    <Text style={[styles.legendText, { color: '#3b82f6', fontWeight:'bold' }]}>A</Text><Text style={styles.legendText}>=Avg, </Text>
                    <Text style={[styles.legendText, { color: '#ef4444', fontWeight:'bold' }]}>P</Text><Text style={styles.legendText}>=Poor</Text>
                </View>
            </View>

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

    // --- Student View Styles ---
    cardRow: {
        backgroundColor: '#FFF', marginHorizontal: 10, marginBottom: 10, borderRadius: 12,
        padding: 15, elevation: 1, borderLeftWidth: 5, borderLeftColor: '#008080'
    },
    rowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10 },
    serialNo: { width: 30, fontWeight: 'bold', color: '#555', fontSize: 16 },
    teacherName: { flex: 1, fontSize: 16, fontWeight: '700', color: '#333' },
    iconSaveBtn: { backgroundColor: '#008080', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    iconEditBtn: { backgroundColor: '#10b981' },
    
    inputArea: { marginBottom: 15 },
    label: { fontSize: 14, color: '#333', marginBottom: 6, fontWeight: '600' },
    remarkBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, minWidth: 80, alignItems: 'center' },
    remarkBtnText: { fontSize: 13, fontWeight: '600' },
    textInput: {
        borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 10,
        backgroundColor: '#FAFAFA', textAlignVertical: 'top', height: 60, color: '#333'
    },

    // --- Admin View Styles ---
    filterContainer: { paddingHorizontal: 10, marginBottom: 5 },
    pickerWrapper: {
        borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginBottom: 8,
        backgroundColor: '#fff', overflow: 'hidden', height: 45, justifyContent: 'center'
    },
    picker: { width: '100%', color: '#333' },
    
    comButton: {
        backgroundColor: '#ef4444', 
        height: 45, 
        paddingHorizontal: 12, 
        borderRadius: 8,
        justifyContent: 'center', 
        alignItems: 'center',
        flexDirection: 'row',
        elevation: 2
    },
    comBtnText: { color:'#fff', fontWeight:'bold', fontSize: 12 },

    // List View
    statsContainer: { flexDirection: 'row', marginHorizontal: 10, marginBottom: 10 },
    statBox: { flex: 1, backgroundColor: '#FFF', marginHorizontal: 5, padding: 10, borderRadius: 8, alignItems: 'center', elevation: 1 },
    statLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase' },
    statValue: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 2 },

    tableHeader: { flexDirection: 'row', backgroundColor: '#e0e7ff', padding: 10, marginHorizontal: 10, borderRadius: 8, marginBottom: 5 },
    th: { fontWeight: 'bold', color: '#4338ca', fontSize: 13 },
    
    adminRow: { backgroundColor: '#FFF', marginHorizontal: 10, marginBottom: 8, borderRadius: 8, borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 5 },
    adminRowMain: { flexDirection: 'row', alignItems: 'center', padding: 10 },
    rollNo: { width: 50, fontWeight: 'bold', color: '#333' },
    studentName: { flex: 1, color: '#444' },
    viewMoreBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 4, padding: 2 },
    viewMoreText: { fontSize: 10, color: '#008080', marginRight: 2, fontWeight:'600' },

    adminRowDetails: { backgroundColor: '#F9FAFB', padding: 10, borderTopWidth: 1, borderTopColor: '#EEE', marginHorizontal: 5, borderRadius: 4 },
    detailItem: { marginBottom: 8 },
    detailLabel: { fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 2 },
    badgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
    miniBadgeLarge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start' },
    suggestionText: { fontSize: 12, color: '#444', fontStyle: 'italic', backgroundColor: '#FFF', padding: 5, borderRadius: 4, borderWidth: 1, borderColor: '#EEE' },

    // Matrix View
    matrixHeaderRow: { flexDirection: 'row', backgroundColor: '#e0e7ff', paddingVertical: 12, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: '#ccc' },
    matrixRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 10, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: '#eee' },
    matrixCell: { width: TEACHER_COL_WIDTH, alignItems: 'center', justifyContent: 'center' },
    miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden', color: '#fff', fontSize: 10, fontWeight: 'bold' },
    viewMoreMini: { marginLeft: 4, backgroundColor: '#444', borderRadius: 3, paddingHorizontal: 3 },

    emptyText: { textAlign: 'center', marginTop: 30, color: '#999' },

    // Footer
    footerContainer: {
        position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', 
        borderTopWidth: 1, borderTopColor: '#f0f0f0', height: 45, 
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
        paddingHorizontal: 15, elevation: 10
    },
    legendGroup: { flexDirection: 'row', alignItems: 'center' },
    legendLabel: { fontSize: 12, fontWeight: '700', color: '#333', marginRight: 4 },
    legendText: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
    verticalDivider: { height: 16, width: 1, backgroundColor: '#e5e7eb', marginHorizontal: 12 },

    // --- MODAL STYLES ---
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 15, backgroundColor: '#fff', elevation: 2
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    modalFilterContainer: { padding: 15, backgroundColor: '#FAFAFA', borderBottomWidth: 1, borderBottomColor: '#eee' },
    modalLabel: { fontSize: 12, fontWeight: 'bold', color: '#666', marginBottom: 5 },
    modalPickerWrap: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, backgroundColor: '#fff', height: 45, justifyContent: 'center' },
    sortBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8 },
    sortBtnActive: { backgroundColor: '#fff', elevation: 1 },
    sortBtnText: { fontSize: 12, color: '#666' },
    graphContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 },
    modalFooter: { flexDirection: 'row', justifyContent: 'space-evenly', padding: 15, borderTopWidth: 1, borderTopColor: '#eee' },
    
    // --- ANIMATED BAR STYLES ---
    barWrapper: { alignItems: 'center', width: 60, marginHorizontal: 8, height: 280, justifyContent: 'flex-end' },
    barLabelTop: { fontSize: 10, fontWeight: 'bold', color: '#333', marginBottom: 4 },
    barTrack: { width: 30, height: 220, backgroundColor: '#F0F0F0', borderRadius: 0, justifyContent: 'flex-end', overflow: 'hidden' },
    barFill: { width: '100%', borderRadius: 0 },
    barLabelBottom: { fontSize: 11, fontWeight: '600', color: '#333', marginTop: 6, textAlign:'center', width: '100%' },

});

export default TeacherFeedback;