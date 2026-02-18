import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Modal, Animated, Easing, 
  TextInput, Dimensions, useColorScheme, StatusBar, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// --- DIMENSIONS & THEME CONFIGURATION ---
const { width, height } = Dimensions.get('window');

const LightColors = {
  primary: '#008080',
  background: '#F5F7FA',
  cardBg: '#FFFFFF',
  textMain: '#263238',
  textSub: '#546E7A',
  border: '#CFD8DC',
  inputBg: '#FAFAFA',
  success: '#10b981', 
  danger: '#ef4444',
  warning: '#FFC107',
  blue: '#3b82f6',
  iconGrey: '#90A4AE',
  modalOverlay: 'rgba(0,0,0,0.5)',
  placeholder: '#B0BEC5'
};

const DarkColors = {
  primary: '#008080',
  background: '#121212',
  cardBg: '#1E1E1E',
  textMain: '#E0E0E0',
  textSub: '#B0B0B0',
  border: '#333333',
  inputBg: '#2C2C2C',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#FFC107',
  blue: '#3b82f6',
  iconGrey: '#757575',
  modalOverlay: 'rgba(255,255,255,0.1)',
  placeholder: '#616161'
};

// --- CONSTANTS ---
const TEACHER_COL_WIDTH = 130; 
const NAME_COL_WIDTH = 150;
const ROLL_COL_WIDTH = 60;
const FIXED_COLS_WIDTH = NAME_COL_WIDTH + ROLL_COL_WIDTH;

// --- TYPES ---
interface TeacherRow {
  teacher_id: number;
  teacher_name: string;
  rating: number; // 1-5
  teaching_quality: 'Good' | 'Average' | 'Poor' | ''; 
  suggestions: string; 
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
const AnimatedBar = ({ percentage, rating, label, color, colors }: any) => {
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

  // --- UPDATED: Truncate logic to show more than just initial "G" ---
  const displayLabel = label.length > 8 ? label.substring(0, 8) + '..' : label;

  return (
    <View style={styles.barWrapper}>
      <Text style={[styles.barLabelTop, { color: colors.textMain }]}>{Math.round(percentage)}%</Text>
      <View style={[styles.barTrack, { backgroundColor: colors.inputBg }]}>
        <Animated.View style={[styles.barFill, { height: heightStyle, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barLabelBottom, { color: colors.textSub }]} numberOfLines={1}>
        {displayLabel}
      </Text>
      <View style={{flexDirection:'row', alignItems:'center', marginTop:2}}>
         <Text style={{fontSize:10, fontWeight:'bold', color: colors.textSub}}>{rating}</Text>
         <MaterialIcons name="star" size={10} color={colors.warning} />
      </View>
    </View>
  );
};

// --- EXPANDABLE ADMIN LIST ITEM ---
const AdminReviewItem = ({ review, colors }: { review: AdminReviewRow, colors: any }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.adminRow, { backgroundColor: colors.cardBg, borderBottomColor: colors.border }]}>
      <View style={styles.adminRowMain}>
        <Text style={[styles.rollNo, { color: colors.textMain }]}>{review.roll_no || '-'}</Text>
        <Text style={[styles.studentName, { color: colors.textMain }]} numberOfLines={1}>{review.student_name}</Text>
        <View style={{alignItems:'flex-end'}}>
          <StarRating rating={review.rating} readOnly size={18} colors={colors} />
          <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.viewMoreBtn}>
            <Text style={[styles.viewMoreText, { color: colors.primary }]}>{expanded ? "Show Less" : "view more"}</Text>
            <MaterialIcons name={expanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {expanded && (
        <View style={[styles.adminRowDetails, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textSub }]}>Quality of teaching:</Text>
            <View style={[
              styles.miniBadgeLarge, 
              { backgroundColor: review.teaching_quality === 'Good' ? colors.success : review.teaching_quality === 'Poor' ? colors.danger : colors.blue }
            ]}>
              <Text style={styles.badgeText}>{review.teaching_quality || 'Not Selected'}</Text>
            </View>
          </View>
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textSub }]}>Student suggestion:</Text>
            <Text style={[styles.suggestionText, { color: colors.textMain, backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              {review.suggestions ? review.suggestions : "No suggestions provided."}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

// --- STAR RATING COMPONENT ---
const StarRating = ({ rating, setRating, readOnly = false, size=24, colors }: any) => {
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
            color={star <= rating ? colors.warning : colors.border}
            style={{ marginHorizontal: 1 }}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const TeacherFeedback = () => {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? DarkColors : LightColors;

  const [loading, setLoading] = useState(false);

  // --- STUDENT STATE ---
  const [myTeachers, setMyTeachers] = useState<TeacherRow[]>([]);
  
  // --- ADMIN STATE ---
  const [allClasses, setAllClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [classTeachers, setClassTeachers] = useState<{id: number | string, full_name: string}[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(''); 
  
  const [adminReviews, setAdminReviews] = useState<AdminReviewRow[]>([]); 
  const [matrixData, setMatrixData] = useState<{teachers: any[], students: MatrixStudent[]} | null>(null); 
  const [stats, setStats] = useState({ average: '0.0', total: 0 });

  // --- COMPARE MODAL STATE ---
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareClass, setCompareClass] = useState('All Classes');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsItem[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // --- DETAIL MODAL STATE ---
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);

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
  // ADMIN LOGIC
  // ==========================================
  const fetchClasses = async () => {
    try {
      const res = await apiClient.get('/feedback/classes');
      setAllClasses(res.data);
      if (res.data.length > 0) {
        // Default to first class if available
        const defaultClass = res.data.includes("Class 10") ? "Class 10" : res.data[0];
        setSelectedClass(defaultClass);
      }
    } catch (e) { console.error(e); }
  };

  // --- REVERTED: Standard logic for specific classes (All Classes removed from main screen) ---
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

  // --- REVERTED: Standard review logic ---
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

  const handleMatrixViewMore = (studentName: string, rollNo: string, teacherName: string, fb: any) => {
    setSelectedDetail({
      studentName, rollNo, teacherName,
      rating: fb.rating, teaching_quality: fb.teaching_quality, suggestions: fb.suggestions
    });
    setDetailModalVisible(true);
  };

  const QualityButtons = ({ selected, onSelect, readOnly=false }: any) => {
    const options = ['Good', 'Average', 'Poor'];
    const qualityColors: any = { 'Good': colors.success, 'Average': colors.blue, 'Poor': colors.danger };
    
    return (
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {options.map(opt => {
          const isSelected = selected === opt;
          return (
            <TouchableOpacity
              key={opt}
              disabled={readOnly}
              onPress={() => onSelect(opt)}
              style={[
                styles.remarkBtn,
                isSelected 
                  ? { backgroundColor: qualityColors[opt], borderColor: qualityColors[opt] }
                  : { borderColor: colors.border, backgroundColor: colors.cardBg }
              ]}
            >
              <Text style={[
                styles.remarkBtnText,
                isSelected ? { color: '#fff' } : { color: colors.textSub }
              ]}>
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      {/* --- HEADER --- */}
      <View style={[styles.headerCard, { backgroundColor: colors.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIconContainer, { backgroundColor: isDark ? '#333' : '#E0F2F1' }]}>
            <MaterialIcons name="rate-review" size={24} color={colors.primary} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: colors.textMain }]}>Teacher Feedback</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSub }]}>
              {user?.role === 'student' ? 'Rate your teachers' : 'View Student Ratings'}
            </Text>
          </View>
        </View>
        {user?.role === 'admin' && (
          <TouchableOpacity 
            style={[styles.comButton, { backgroundColor: colors.danger }]}
            onPress={() => setShowCompareModal(true)}
          >
            <Text style={styles.comBtnText}>COM</Text>
            <MaterialIcons name="bar-chart" size={18} color="#fff" style={{marginLeft: 4}} />
          </TouchableOpacity>
        )}
      </View>

      {/* ======================= STUDENT VIEW ======================= */}
      {user?.role === 'student' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}>
          {loading ? <ActivityIndicator color={colors.primary} style={{marginTop:20}} size="large" /> : (
            myTeachers.length > 0 ? myTeachers.map((item, index) => (
              <View key={item.teacher_id} style={[styles.cardRow, { backgroundColor: colors.cardBg, borderLeftColor: colors.primary }]}>
                <View style={[styles.rowHeader, { borderBottomColor: colors.background }]}>
                  <Text style={[styles.serialNo, { color: colors.textSub }]}>{index + 1}.</Text>
                  <Text style={[styles.teacherName, { color: colors.textMain }]}>{item.teacher_name}</Text>
                  <TouchableOpacity 
                    style={[styles.iconSaveBtn, { backgroundColor: item.isSubmitted ? colors.success : colors.primary }]} 
                    onPress={() => handleStudentSave(item)}
                  >
                    <MaterialIcons name={item.isSubmitted ? "check" : "save"} size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.inputArea}>
                  <Text style={[styles.label, { color: colors.textMain }]}>Feedback:</Text>
                  <StarRating 
                    rating={item.rating} 
                    setRating={(r: number) => updateMyFeedback(item.teacher_id, 'rating', r)} 
                    size={30}
                    colors={colors}
                  />
                </View>

                <View style={styles.inputArea}>
                  <Text style={[styles.label, { color: colors.textMain }]}>Quality of teaching:</Text>
                  <QualityButtons 
                    selected={item.teaching_quality} 
                    onSelect={(val: string) => updateMyFeedback(item.teacher_id, 'teaching_quality', val)}
                  />
                </View>

                <View style={styles.inputArea}>
                  <Text style={[styles.label, { color: colors.textMain }]}>Student suggestion:</Text>
                  <TextInput 
                    style={[styles.textInput, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.textMain }]}
                    multiline
                    numberOfLines={2}
                    placeholder="Write your suggestions here..."
                    placeholderTextColor={colors.placeholder}
                    value={item.suggestions}
                    onChangeText={(text) => updateMyFeedback(item.teacher_id, 'suggestions', text)}
                  />
                </View>
              </View>
            )) : (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="rate-review" size={60} color={colors.border} />
                <Text style={[styles.emptyText, { color: colors.textSub }]}>No assigned teachers found.</Text>
              </View>
            )
          )}
        </ScrollView>
      )}

      {/* ======================= ADMIN VIEW ======================= */}
      {user?.role === 'admin' && (
        <View style={{flex: 1}}>
          {/* Filters */}
          <View style={styles.filterContainer}>
            <View style={[styles.pickerWrapper, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
              <Picker
                selectedValue={selectedClass}
                onValueChange={setSelectedClass}
                style={[styles.picker, { color: colors.textMain }]}
                dropdownIconColor={colors.textSub}
              >
                {/* --- UPDATED: Removed "All Classes" from here --- */}
                {allClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
              </Picker>
            </View>
            
            {/* Show Teacher Picker only if valid class selected */}
            {selectedClass !== '' && (
              <View style={[styles.pickerWrapper, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
                <Picker
                  selectedValue={selectedTeacherId}
                  onValueChange={(v) => setSelectedTeacherId(v)}
                  style={[styles.picker, { color: colors.textMain }]}
                  dropdownIconColor={colors.textSub}
                >
                  <Picker.Item label="Select Teacher" value="" color={colors.placeholder} />
                  {classTeachers.map(t => <Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} />)}
                </Picker>
              </View>
            )}
          </View>

          {loading ? <ActivityIndicator color={colors.primary} style={{marginTop:20}} size="large" /> : (
            <>
              {/* CASE 1: SPECIFIC TEACHER (List View) */}
              {selectedTeacherId !== 'all' && selectedTeacherId !== '' && (
                <>
                  <View style={styles.statsContainer}>
                    <View style={[styles.statBox, { backgroundColor: colors.cardBg }]}>
                      <Text style={[styles.statLabel, { color: colors.textSub }]}>Avg Rating</Text>
                      <View style={{flexDirection:'row', alignItems:'center'}}>
                        <Text style={[styles.statValue, { color: colors.textMain }]}>{stats.average}</Text>
                        <MaterialIcons name="star" size={18} color={colors.warning} />
                      </View>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: colors.cardBg }]}>
                      <Text style={[styles.statLabel, { color: colors.textSub }]}>Total Reviews</Text>
                      <Text style={[styles.statValue, { color: colors.textMain }]}>{stats.total}</Text>
                    </View>
                  </View>

                  <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
                    <View style={[styles.tableHeader, { backgroundColor: isDark ? '#333' : '#e0e7ff', borderColor: isDark ? '#444' : '#c7d2fe' }]}>
                      <Text style={[styles.th, { width: 50, textAlign:'center', color: isDark ? '#fff' : '#4338ca' }]}>Roll</Text>
                      <Text style={[styles.th, { flex: 1, color: isDark ? '#fff' : '#4338ca' }]}>Student</Text>
                      <Text style={[styles.th, { width: 100, color: isDark ? '#fff' : '#4338ca' }]}>Feedback</Text>
                    </View>
                    {adminReviews.map((review, idx) => (
                      <AdminReviewItem key={idx} review={review} colors={colors} />
                    ))}
                    {adminReviews.length === 0 && (
                      <Text style={[styles.emptyText, { color: colors.textSub }]}>No reviews found.</Text>
                    )}
                  </ScrollView>
                </>
              )}

              {/* CASE 2: ALL TEACHERS (Matrix View) */}
              {selectedTeacherId === 'all' && matrixData && (
                <ScrollView 
                  horizontal 
                  contentContainerStyle={{flexGrow: 1, paddingHorizontal: 20}}
                  showsHorizontalScrollIndicator={false}
                >
                  <View>
                    {/* Matrix Header */}
                    <View style={[
                      styles.matrixHeaderRow, 
                      { 
                        minWidth: FIXED_COLS_WIDTH + (matrixData.teachers.length * TEACHER_COL_WIDTH),
                        backgroundColor: isDark ? '#333' : '#e0e7ff', 
                        borderColor: isDark ? '#444' : '#c7d2fe'
                      }
                    ]}>
                      <View style={{width: ROLL_COL_WIDTH, justifyContent:'center', alignItems:'center'}}>
                        <Text style={[styles.th, { color: isDark ? '#fff' : '#4338ca' }]}>Roll</Text>
                      </View>
                      <View style={{width: NAME_COL_WIDTH, justifyContent:'center'}}>
                        <Text style={[styles.th, { color: isDark ? '#fff' : '#4338ca' }]}>Student Name</Text>
                      </View>
                      {matrixData.teachers.map((t) => (
                        <View key={t.id} style={{width: TEACHER_COL_WIDTH, justifyContent:'center', alignItems:'center', paddingHorizontal: 2}}>
                          <Text style={[styles.th, { textAlign: 'center', color: isDark ? '#fff' : '#4338ca' }]} numberOfLines={2}>
                            {t.full_name.length > 8 ? t.full_name.substring(0, 8) + '...' : t.full_name}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Matrix Rows */}
                    <ScrollView contentContainerStyle={{paddingBottom: 60}}>
                      {matrixData.students.map((stu) => (
                        <View key={stu.id} style={[
                          styles.matrixRow, 
                          { 
                            minWidth: FIXED_COLS_WIDTH + (matrixData.teachers.length * TEACHER_COL_WIDTH),
                            backgroundColor: colors.cardBg,
                            borderBottomColor: colors.border
                          }
                        ]}>
                          <View style={{width: ROLL_COL_WIDTH, justifyContent:'center', alignItems:'center'}}>
                            <Text style={[styles.rollNo, { color: colors.textMain }]}>{stu.roll_no || '-'}</Text>
                          </View>
                          <View style={{width: NAME_COL_WIDTH}}>
                            <Text style={[styles.studentName, { color: colors.textMain }]} numberOfLines={1}>{stu.full_name}</Text>
                          </View>
                          
                          {matrixData.teachers.map((t) => {
                            const fb = stu.feedback_map[t.id];
                            return (
                              <View key={t.id} style={styles.matrixCell}>
                                {fb ? (
                                  <View style={{alignItems:'center'}}>
                                    <StarRating rating={fb.rating} readOnly size={12} colors={colors} /> 
                                    <TouchableOpacity 
                                      style={{marginTop: 4}}
                                      onPress={() => handleMatrixViewMore(stu.full_name, stu.roll_no, t.full_name, fb)}
                                    >
                                      <Text style={styles.matrixViewMoreLink}>view more</Text>
                                    </TouchableOpacity>
                                  </View>
                                ) : (
                                  <Text style={{color: colors.placeholder}}>-</Text>
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

      {/* --- MATRIX DETAIL MODAL --- */}
      <Modal
        visible={detailModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.detailPopup, { backgroundColor: colors.cardBg }]}>
            {selectedDetail && (
              <>
                <View style={[styles.popupHeaderContainer, { backgroundColor: colors.primary }]}>
                  <Text style={styles.popupStudentName}>{selectedDetail.studentName}</Text>
                  <Text style={styles.popupRoll}>Roll: {selectedDetail.rollNo || '-'}</Text>
                  <View style={styles.popupDivider} />
                  <Text style={styles.popupTeacher}>Feedback for: {selectedDetail.teacherName}</Text>
                </View>

                <View style={styles.popupBody}>
                  <View style={styles.popupRow}>
                    <Text style={[styles.popupLabel, { color: colors.textSub }]}>Feedback:</Text>
                    <StarRating rating={selectedDetail.rating} readOnly size={20} colors={colors} />
                  </View>

                  <View style={styles.popupRow}>
                    <Text style={[styles.popupLabel, { color: colors.textSub }]}>Quality of teaching:</Text>
                    <View style={[
                      styles.miniBadgeLarge, 
                      { backgroundColor: selectedDetail.teaching_quality === 'Good' ? colors.success : selectedDetail.teaching_quality === 'Poor' ? colors.danger : colors.blue }
                    ]}>
                      <Text style={styles.badgeText}>{selectedDetail.teaching_quality || 'Not Selected'}</Text>
                    </View>
                  </View>

                  <View style={{marginTop: 10}}>
                    <Text style={[styles.popupLabel, { color: colors.textSub }]}>Student suggestion:</Text>
                    <Text style={[styles.suggestionTextFull, { color: colors.textMain, backgroundColor: colors.background, borderColor: colors.border }]}>
                      {selectedDetail.suggestions ? selectedDetail.suggestions : "No suggestions provided."}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.closePopupBtn, { backgroundColor: colors.textSub }]} 
                  onPress={() => setDetailModalVisible(false)}
                >
                  <Text style={{color:'#fff', fontWeight:'bold'}}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* --- COMPARE MODAL --- */}
      <Modal
        visible={showCompareModal}
        animationType="slide"
        onRequestClose={() => setShowCompareModal(false)}
      >
        <SafeAreaView style={{flex:1, backgroundColor: colors.background}}>
          <View style={[styles.modalHeader, { backgroundColor: colors.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
            <TouchableOpacity onPress={() => setShowCompareModal(false)} style={{padding:5}}>
              <MaterialIcons name="close" size={26} color={colors.textMain} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.textMain }]}>Performance Analytics</Text>
            <View style={{width:30}}/>
          </View>

          <View style={[styles.modalFilterContainer, { backgroundColor: colors.inputBg, borderBottomColor: colors.border }]}>
            <View style={{marginBottom: 10}}>
              <Text style={[styles.modalLabel, { color: colors.textSub }]}>Select Class:</Text>
              <View style={[styles.modalPickerWrap, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
                <Picker
                  selectedValue={compareClass}
                  onValueChange={setCompareClass}
                  style={{width:'100%', color: colors.textMain}}
                  dropdownIconColor={colors.textSub}
                >
                  <Picker.Item label="All Classes" value="All Classes" />
                  {allClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
                </Picker>
              </View>
            </View>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
              <Text style={[styles.modalLabel, { color: colors.textSub }]}>Sort Order:</Text>
              <View style={{flexDirection:'row', backgroundColor: colors.cardBg, borderRadius:8, borderWidth: 1, borderColor: colors.border}}>
                <TouchableOpacity 
                  style={[styles.sortBtn, sortOrder==='desc' && { backgroundColor: colors.background }]}
                  onPress={() => setSortOrder('desc')}
                >
                  <Text style={[styles.sortBtnText, { color: sortOrder==='desc' ? colors.primary : colors.textSub, fontWeight: sortOrder==='desc'?'bold':'normal' }]}>High to Low</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.sortBtn, sortOrder==='asc' && { backgroundColor: colors.background }]}
                  onPress={() => setSortOrder('asc')}
                >
                  <Text style={[styles.sortBtnText, { color: sortOrder==='asc' ? colors.primary : colors.textSub, fontWeight: sortOrder==='asc'?'bold':'normal' }]}>Low to High</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.graphContainer}>
            {loadingAnalytics ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : analyticsData.length > 0 ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={{paddingHorizontal: 10, alignItems:'flex-end'}}
              >
                {analyticsData.map((item, idx) => {
                  let color = colors.blue;
                  if(item.percentage >= 85) color = colors.success;
                  else if(item.percentage < 50) color = colors.danger;

                  return (
                    <AnimatedBar 
                      key={idx}
                      percentage={item.percentage}
                      rating={item.avg_rating}
                      label={item.teacher_name}
                      color={color}
                      colors={colors}
                    />
                  );
                })}
              </ScrollView>
            ) : (
              <View style={{alignItems:'center'}}>
                <MaterialIcons name="bar-chart" size={50} color={colors.border} />
                <Text style={{color: colors.textSub, marginTop: 10}}>No data available.</Text>
              </View>
            )}
          </View>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
             <View style={{flexDirection:'row', alignItems:'center', gap:5}}>
               <View style={{width:10, height:10, borderRadius:5, backgroundColor: colors.success}}/>
               <Text style={{fontSize:12, color: colors.textSub}}>85-100%</Text>
             </View>
             <View style={{flexDirection:'row', alignItems:'center', gap:5}}>
               <View style={{width:10, height:10, borderRadius:5, backgroundColor: colors.blue}}/>
               <Text style={{fontSize:12, color: colors.textSub}}>50-85%</Text>
             </View>
             <View style={{flexDirection:'row', alignItems:'center', gap:5}}>
               <View style={{width:10, height:10, borderRadius:5, backgroundColor: colors.danger}}/>
               <Text style={{fontSize:12, color: colors.textSub}}>0-50%</Text>
             </View>
          </View>
        </SafeAreaView>
      </Modal>

      <View style={[styles.footerContainer, { backgroundColor: colors.cardBg, borderTopColor: colors.border }]}>
        <View style={styles.legendGroup}>
          <Text style={[styles.legendLabel, { color: colors.textMain }]}>Scale: </Text>
          <MaterialIcons name="star" size={14} color={colors.warning} />
          <Text style={[styles.legendText, { color: colors.textSub }]}> (1-5)</Text>
        </View>
        <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />
        <View style={styles.legendGroup}>
          <Text style={[styles.legendLabel, { color: colors.textMain }]}>Note: </Text>
          <Text style={[styles.legendText, { color: colors.success, fontWeight:'bold' }]}>G</Text><Text style={[styles.legendText, { color: colors.textSub }]}>=Good, </Text>
          <Text style={[styles.legendText, { color: colors.blue, fontWeight:'bold' }]}>A</Text><Text style={[styles.legendText, { color: colors.textSub }]}>=Avg, </Text>
          <Text style={[styles.legendText, { color: colors.danger, fontWeight:'bold' }]}>P</Text><Text style={[styles.legendText, { color: colors.textSub }]}>=Poor</Text>
        </View>
      </View>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  headerCard: {
    paddingHorizontal: 15, paddingVertical: 12,
    width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10,
    borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerIconContainer: {
    borderRadius: 30, width: 45, height: 45,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  headerTextContainer: { justifyContent: 'center', flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 12 },

  // --- Student View Styles ---
  cardRow: {
    marginHorizontal: width * 0.04, marginBottom: 15, borderRadius: 12,
    padding: 15, elevation: 2, borderLeftWidth: 5, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, paddingBottom: 10 },
  serialNo: { width: 30, fontWeight: 'bold', fontSize: 16 },
  teacherName: { flex: 1, fontSize: 16, fontWeight: '700' },
  iconSaveBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  
  inputArea: { marginBottom: 15 },
  label: { fontSize: 14, marginBottom: 6, fontWeight: '600' },
  remarkBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, minWidth: 80, alignItems: 'center' },
  remarkBtnText: { fontSize: 13, fontWeight: '600' },
  textInput: {
    borderWidth: 1, borderRadius: 8, padding: 10,
    textAlignVertical: 'top', height: 60, fontSize: 14
  },

  // --- Admin View Styles ---
  filterContainer: { paddingHorizontal: 20, marginBottom: 5 },
  pickerWrapper: {
    borderWidth: 1, borderRadius: 10, marginBottom: 10,
    overflow: 'hidden', height: 45, justifyContent: 'center'
  },
  picker: { width: '100%' },
  
  comButton: {
    height: 36, 
    paddingHorizontal: 12, 
    borderRadius: 8,
    justifyContent: 'center', 
    alignItems: 'center',
    flexDirection: 'row',
    elevation: 2
  },
  comBtnText: { color:'#fff', fontWeight:'bold', fontSize: 12 },

  // List View
  statsContainer: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 10 },
  statBox: { flex: 1, marginHorizontal: 5, padding: 10, borderRadius: 8, alignItems: 'center', elevation: 1 },
  statLabel: { fontSize: 11, textTransform: 'uppercase' },
  statValue: { fontSize: 18, fontWeight: 'bold', marginTop: 2 },

  tableHeader: {
    flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 10,
    marginHorizontal: 20, borderRadius: 8, marginBottom: 5,
    borderWidth: 1
  },
  th: { fontWeight: '700', fontSize: 13 },
  
  adminRow: { marginHorizontal: 20, marginBottom: 8, borderRadius: 8, borderBottomWidth: 1, paddingVertical: 5, elevation: 1 },
  adminRowMain: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  rollNo: { width: 50, fontWeight: 'bold', textAlign:'center' },
  studentName: { flex: 1 },
  viewMoreBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 4, padding: 2 },
  viewMoreText: { fontSize: 10, marginRight: 2, fontWeight:'600' },

  adminRowDetails: { padding: 10, borderTopWidth: 1, marginHorizontal: 5, borderRadius: 4 },
  detailItem: { marginBottom: 8 },
  detailLabel: { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  miniBadgeLarge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start' },
  suggestionText: { fontSize: 12, fontStyle: 'italic', padding: 5, borderRadius: 4, borderWidth: 1 },

  // Matrix View
  matrixHeaderRow: { 
    flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 5, 
    borderBottomWidth: 1, borderTopWidth: 1,
    borderTopLeftRadius: 8, borderTopRightRadius: 8,
  },
  matrixRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 5, borderBottomWidth: 1 },
  matrixCell: { width: TEACHER_COL_WIDTH, alignItems: 'center', justifyContent: 'center' },
  matrixViewMoreLink: { fontSize: 12, color: '#56bff8', textDecorationLine: 'none', fontWeight: '500' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 50, opacity: 0.7 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 10, textAlign:'center' },

  // Footer
  footerContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, 
    borderTopWidth: 1, height: 45, 
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
    paddingHorizontal: 15, elevation: 10
  },
  legendGroup: { flexDirection: 'row', alignItems: 'center' },
  legendLabel: { fontSize: 12, fontWeight: '700', marginRight: 4 },
  legendText: { fontSize: 11, fontWeight: '500' },
  verticalDivider: { height: 16, width: 1, marginHorizontal: 12 },

  // --- POPUP MODAL STYLES ---
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center'
  },
  detailPopup: {
    width: width * 0.85, borderRadius: 12, padding: 0, elevation: 10, overflow: 'hidden'
  },
  popupHeaderContainer: {
    padding: 15, alignItems: 'center'
  },
  popupStudentName: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  popupRoll: { fontSize: 12, color: '#e0f2f1', marginTop: 2 },
  popupDivider: { width: '40%', height: 1, backgroundColor: '#ffffff50', marginVertical: 8 },
  popupTeacher: { fontSize: 14, color: '#e0f2f1', fontStyle: 'italic' },
  popupBody: { padding: 20 },
  popupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  popupLabel: { fontSize: 14, fontWeight: '600' },
  suggestionTextFull: { 
    fontSize: 14, marginTop: 5, fontStyle: 'italic', 
    padding: 10, borderRadius: 6, borderWidth: 1 
  },
  closePopupBtn: { padding: 12, alignItems: 'center', justifyContent: 'center' },

  // --- MODAL STYLES ---
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 15, elevation: 2
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalFilterContainer: { padding: 15, borderBottomWidth: 1 },
  modalLabel: { fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  modalPickerWrap: { borderWidth: 1, borderRadius: 8, height: 45, justifyContent: 'center' },
  sortBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8 },
  sortBtnText: { fontSize: 12 },
  graphContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-evenly', padding: 15, borderTopWidth: 1 },
  
  // --- ANIMATED BAR STYLES ---
  barWrapper: { alignItems: 'center', width: 60, marginHorizontal: 8, height: height * 0.4, justifyContent: 'flex-end' },
  barLabelTop: { fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  barTrack: { width: 30, height: height * 0.3, borderRadius: 0, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 0 },
  barLabelBottom: { fontSize: 11, fontWeight: '600', marginTop: 6, textAlign:'center', width: '100%' },

});

export default TeacherFeedback;