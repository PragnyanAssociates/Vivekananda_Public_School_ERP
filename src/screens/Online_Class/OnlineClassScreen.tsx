import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking,
    ActivityIndicator, Modal, TextInput, FlatList, Platform, SafeAreaView,
    Dimensions, useColorScheme, StatusBar
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext'; 
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import Video from 'react-native-video';
import * as Animatable from 'react-native-animatable';

// Get device dimensions for responsive adjustments
const { width, height } = Dimensions.get('window');

// --- THEME CONFIGURATION (Master Style Guide) ---
// Ensures consistent colors across Light and Dark modes
const LightColors = {
    primary: '#008080',
    background: '#F5F7FA',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    inputBg: '#FAFAFA',
    iconGrey: '#90A4AE',
    danger: '#E53935',
    success: '#43A047',
    blue: '#1E88E5',
    headerIconBg: '#E0F2F1',
    modalOverlay: 'rgba(0,0,0,0.6)',
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
    iconGrey: '#757575',
    danger: '#EF5350',
    success: '#66BB6A',
    blue: '#42A5F5',
    headerIconBg: '#333333',
    modalOverlay: 'rgba(255,255,255,0.1)',
    placeholder: '#616161'
};

// --- TYPE DEFINITIONS ---
interface OnlineClass {
    id: number; title: string; class_group: string; subject: string; teacher_id: number;
    teacher_name: string; class_datetime: string; meet_link?: string | null;
    description?: string | null; created_by?: number; class_type: 'live' | 'recorded';
    topic?: string | null; video_url?: string | null;
}
interface Teacher { id: number; full_name: string; }
interface FormData {
    title: string; class_group: string; subject: string; teacher_id: number | '';
    meet_link: string; description: string; topic: string;
}

// --- HELPER: DATE FORMATTING (DD/MM/YYYY) ---
const formatDateTime = (isoString: string): string => {
    if (!isoString) return 'Select Date & Time';
    const date = new Date(isoString);
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    
    return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
};

const OnlineClassScreen: React.FC = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;
    const { user } = useAuth();

    const [allClasses, setAllClasses] = useState<OnlineClass[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [classGroups, setClassGroups] = useState<string[]>([]);
    const [subjects, setSubjects] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [currentClass, setCurrentClass] = useState<OnlineClass | null>(null);
    const [view, setView] = useState<'live' | 'recorded'>('live');
    const [modalClassType, setModalClassType] = useState<'live' | 'recorded'>('live');
    
    const initialFormState: FormData = { title: '', class_group: '', subject: '', teacher_id: '', meet_link: '', description: '', topic: '' };
    const [formData, setFormData] = useState<FormData>(initialFormState);
    const [date, setDate] = useState(new Date());
    const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
    const [selectedVideo, setSelectedVideo] = useState<Asset | null>(null);
    const [videoPlayerVisible, setVideoPlayerVisible] = useState(false);
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

    const isPrivilegedUser = user?.role === 'admin' || user?.role === 'teacher';

    const fetchInitialData = useCallback(async () => {
        try {
            setLoading(true);
            const [classesRes, classGroupsRes] = await Promise.all([
                apiClient.get('/online-classes'),
                apiClient.get('/student-classes'),
            ]);
            setAllClasses(classesRes.data);
            setClassGroups(classGroupsRes.data);
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || 'Failed to load data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchInitialData(); }, [fetchInitialData]);
    
    // --- UPDATED: Fetch Subjects/Teachers even when editing ---
    // Removed 'isEditing' check so lists update if user changes Class Group
    useEffect(() => {
        const fetchClassSpecificData = async () => {
            if (!modalVisible || !formData.class_group) return;
            
            // We don't wipe state immediately to prevent flicker if values exist
            try {
                const [subjectsRes, teachersRes] = await Promise.all([
                    apiClient.get(`/subjects-for-class/${formData.class_group}`),
                    apiClient.get(`/teachers-for-class/${formData.class_group}`)
                ]);
                setSubjects(subjectsRes.data);
                setTeachers(teachersRes.data);
            } catch (error: any) {
                console.log("Error loading dropdown details", error);
            }
        };
        fetchClassSpecificData();
    }, [formData.class_group, modalVisible]);

    const handleClassChange = (classValue: string) => {
        // When class changes, we clear subject/teacher to force re-selection or re-validation
        setFormData({ ...formData, class_group: classValue, subject: '', teacher_id: '' });
    };

    const filteredClasses = useMemo(() => {
      if (!user) return [];
      if (user.role === 'admin') return allClasses;
      if (user.role === 'teacher') return allClasses.filter(c => String(c.teacher_id) === String(user.id) || String(c.created_by) === String(user.id));
      if (user.role === 'student') return allClasses.filter(c => c.class_group === user.class_group || c.class_group === 'All');
      return [];
    }, [user, allClasses]);

    const { liveClasses, recordedClasses } = useMemo(() => {
        const live = filteredClasses.filter(c => c.class_type === 'live');
        const recorded = filteredClasses.filter(c => c.class_type === 'recorded');
        live.sort((a, b) => new Date(a.class_datetime).getTime() - new Date(b.class_datetime).getTime());
        recorded.sort((a, b) => new Date(b.class_datetime).getTime() - new Date(a.class_datetime).getTime());
        return { liveClasses: live, recordedClasses: recorded };
    }, [filteredClasses]);

    const onPickerChange = (event: DateTimePickerEvent, selectedValue?: Date) => {
        setPickerMode(null);
        if (event.type === 'set' && selectedValue) {
            const currentDate = selectedValue;
            if (pickerMode === 'date') {
                setDate(currentDate);
                setPickerMode('time');
            } else if (pickerMode === 'time') {
                const finalDate = new Date(date);
                finalDate.setHours(currentDate.getHours());
                finalDate.setMinutes(currentDate.getMinutes());
                setDate(finalDate);
            }
        }
    };
    
    const handleOpenModal = (classItem: OnlineClass | null = null) => {
        if (classItem) {
            setIsEditing(true); 
            setCurrentClass(classItem); 
            setModalClassType(classItem.class_type);
            setFormData({ 
                title: classItem.title, 
                class_group: classItem.class_group, 
                subject: classItem.subject, 
                teacher_id: classItem.teacher_id, 
                meet_link: classItem.meet_link || '', 
                description: classItem.description || '', 
                topic: classItem.topic || '', 
            });
            setDate(new Date(classItem.class_datetime)); 
            setSelectedVideo(null);
        } else {
            setIsEditing(false); 
            setCurrentClass(null); 
            setFormData(initialFormState); 
            setSelectedVideo(null); 
            setModalClassType('live'); 
            setDate(new Date());
        }
        setModalVisible(true);
    };

    const handleSelectVideo = async () => {
        const result = await launchImageLibrary({ mediaType: 'video', videoQuality: 'high', });
        if (result.assets && result.assets.length > 0) setSelectedVideo(result.assets[0]);
    };
    
    const handleSave = async () => {
        if (!user) return Alert.alert("Error", "User not found.");
        if (!formData.title) return Alert.alert("Validation Error", "Title is required.");
        
        // --- UPDATED: Validation applies to both Edit and Create now ---
        if (!formData.class_group || !formData.subject || !formData.teacher_id) {
            return Alert.alert("Validation Error", "Please fill all required fields (Class, Subject, Teacher).");
        }
        
        if (modalClassType === 'live' && !formData.meet_link) {
            return Alert.alert("Validation Error", "Meeting Link required.");
        }
        if (modalClassType === 'recorded' && !isEditing && !selectedVideo) {
            return Alert.alert("Validation Error", "Video File required.");
        }

        setIsSaving(true);
        const data = new FormData();
        data.append('title', formData.title);
        data.append('description', formData.description);
        data.append('topic', formData.topic);
        data.append('class_type', modalClassType);
        
        // --- UPDATED: Append these fields for BOTH Create and Edit ---
        // This ensures if a user edits the Class/Subject/Date, it is sent to backend
        data.append('class_group', formData.class_group);
        data.append('subject', formData.subject);
        data.append('teacher_id', String(formData.teacher_id));
        data.append('class_datetime', date.toISOString());

        if (modalClassType === 'live') {
            data.append('meet_link', formData.meet_link);
        } else if (selectedVideo) {
            data.append('videoFile', { uri: selectedVideo.uri, type: selectedVideo.type, name: selectedVideo.fileName, } as any);
        }

        try { 
            if (isEditing && currentClass) {
                // Ensure backend accepts these new fields in PUT request
                await apiClient.put(`/online-classes/${currentClass.id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }); 
                Alert.alert("Success", "Class updated successfully."); 
            } else {
                await apiClient.post('/online-classes', data, { headers: { 'Content-Type': 'multipart/form-data' } }); 
                Alert.alert("Success", "Class created successfully."); 
            }
            setModalVisible(false); 
            fetchInitialData(); 
        } catch (error: any) { 
            Alert.alert("Error", "Failed to save class."); 
        } finally { setIsSaving(false); }
    };

    const handleDelete = (classId: number) => {
        Alert.alert("Confirm", "Delete this class?", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { try { await apiClient.delete(`/online-classes/${classId}`); fetchInitialData(); } catch (error: any) { Alert.alert("Error", "Failed to delete."); } }}]);
    };
    
    const handleJoinOrWatch = (classItem: OnlineClass) => {
        if (classItem.class_type === 'live' && classItem.meet_link) { Linking.openURL(classItem.meet_link).catch(() => Alert.alert("Error", "Could not open link.")); } 
        else if (classItem.class_type === 'recorded' && classItem.video_url) { setCurrentVideoUrl(classItem.video_url); setVideoPlayerVisible(true); }
    };

    if (loading) { return <View style={[styles.center, {backgroundColor: COLORS.background}]}><ActivityIndicator size="large" color={COLORS.primary} /></View>; }

    const dataToShow = view === 'live' ? liveClasses : recordedClasses;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                        <MaterialIcons name="laptop-chromebook" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Online Classes</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Live Sessions & Recordings</Text>
                    </View>
                </View>
                
                {isPrivilegedUser && (
                    <TouchableOpacity style={[styles.headerBtn, { backgroundColor: COLORS.primary }]} onPress={() => handleOpenModal()}>
                        <MaterialIcons name="add" size={18} color="#fff" />
                        <Text style={styles.headerBtnText}>Add</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* --- TABS --- */}
            <View style={[styles.tabContainer, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                <TouchableOpacity style={[styles.tabButton, view === 'live' && { borderBottomColor: COLORS.primary, borderBottomWidth: 3, backgroundColor: isDark ? '#252525' : '#F0FDF4' }]} onPress={() => setView('live')}>
                    <Text style={[styles.tabButtonText, { color: view === 'live' ? COLORS.primary : COLORS.textSub }]}>Live Classes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabButton, view === 'recorded' && { borderBottomColor: COLORS.primary, borderBottomWidth: 3, backgroundColor: isDark ? '#252525' : '#F0FDF4' }]} onPress={() => setView('recorded')}>
                    <Text style={[styles.tabButtonText, { color: view === 'recorded' ? COLORS.primary : COLORS.textSub }]}>Recorded Classes</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={dataToShow}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <ClassCard 
                        classItem={item} 
                        colors={COLORS}
                        isPrivilegedUser={isPrivilegedUser}
                        onEdit={handleOpenModal} 
                        onDelete={handleDelete} 
                        onJoinOrWatch={handleJoinOrWatch} 
                        userRole={user?.role} 
                    />
                )}
                ListEmptyComponent={ 
                    <View style={styles.center}> 
                        <MaterialIcons name="event-busy" size={60} color={COLORS.iconGrey} /> 
                        <Text style={[styles.emptyText, { color: COLORS.textSub }]}>{`No ${view} classes found.`}</Text> 
                    </View> 
                }
                contentContainerStyle={styles.listContentContainer}
            />
          
            {/* --- MODAL --- */}
            <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
                <TouchableOpacity style={[styles.modalBackdrop, { backgroundColor: COLORS.modalOverlay }]} activeOpacity={1} onPress={() => setModalVisible(false)}>
                    <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { backgroundColor: COLORS.cardBg }]}>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 20}}>
                            <Text style={[styles.modalTitle, { color: COLORS.textMain }]}>{isEditing ? 'Edit Class' : 'New Class'}</Text>
                             {!isEditing && ( 
                                 <View style={[styles.modalTabContainer, { backgroundColor: isDark ? '#333' : '#e9ecef' }]}>
                                    <TouchableOpacity style={[styles.modalTab, modalClassType === 'live' && { backgroundColor: COLORS.cardBg }]} onPress={() => setModalClassType('live')}>
                                        <Text style={[styles.modalTabText, { color: modalClassType === 'live' ? COLORS.blue : COLORS.textSub }]}>Live</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.modalTab, modalClassType === 'recorded' && { backgroundColor: COLORS.cardBg }]} onPress={() => setModalClassType('recorded')}>
                                        <Text style={[styles.modalTabText, { color: modalClassType === 'recorded' ? COLORS.blue : COLORS.textSub }]}>Recorded</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <Text style={[styles.label, { color: COLORS.textSub }]}>Title</Text>
                            <TextInput 
                                style={[styles.input, { backgroundColor: COLORS.inputBg, color: COLORS.textMain, borderColor: COLORS.border }]} 
                                placeholder="e.g. Algebra Review" 
                                placeholderTextColor={COLORS.placeholder}
                                value={formData.title} 
                                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                            />
                            
                            {/* --- UPDATED: Picker Enabled even in Edit Mode --- */}
                            <Text style={[styles.label, { color: COLORS.textSub }]}>Class</Text>
                            <View style={[styles.pickerContainer, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                                <Picker 
                                    enabled={true} 
                                    selectedValue={formData.class_group} 
                                    onValueChange={(itemValue) => handleClassChange(itemValue)} 
                                    dropdownIconColor={COLORS.textMain} 
                                    style={{color: COLORS.textMain}}
                                >
                                    <Picker.Item label="-- Select Class --" value="" color={COLORS.textMain} />
                                    {classGroups.map((c, i) => <Picker.Item key={i} label={c} value={c} color={COLORS.textMain} />)}
                                </Picker>
                            </View>

                            <Text style={[styles.label, { color: COLORS.textSub }]}>Subject</Text>
                            <View style={[styles.pickerContainer, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                                <Picker 
                                    enabled={true} 
                                    selectedValue={formData.subject} 
                                    onValueChange={(itemValue) => setFormData(prev => ({ ...prev, subject: itemValue }))} 
                                    dropdownIconColor={COLORS.textMain} 
                                    style={{color: COLORS.textMain}}
                                >
                                    <Picker.Item label="-- Select Subject --" value="" color={COLORS.textMain} />
                                    {subjects.map((s, i) => <Picker.Item key={i} label={s} value={s} color={COLORS.textMain} />)}
                                </Picker>
                            </View>

                            <Text style={[styles.label, { color: COLORS.textSub }]}>Teacher</Text>
                            <View style={[styles.pickerContainer, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                                <Picker 
                                    enabled={true} 
                                    selectedValue={String(formData.teacher_id)} 
                                    onValueChange={(itemValue) => setFormData(prev => ({ ...prev, teacher_id: Number(itemValue) }))} 
                                    dropdownIconColor={COLORS.textMain} 
                                    style={{color: COLORS.textMain}}
                                >
                                    <Picker.Item label="-- Select Person --" value="" color={COLORS.textMain} />
                                    {teachers.map((t) => <Picker.Item key={t.id} label={t.full_name} value={String(t.id)} color={COLORS.textMain} />)}
                                </Picker>
                            </View>
                            
                            {/* --- UPDATED: Date Picker Enabled in Edit Mode --- */}
                            <Text style={[styles.label, { color: COLORS.textSub }]}>Date & Time</Text>
                            <TouchableOpacity 
                                disabled={false} 
                                onPress={() => setPickerMode('date')} 
                                style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, justifyContent: 'center', height: 50 }]}
                            >
                                <Text style={{ color: COLORS.textMain }}>{formatDateTime(date.toISOString())}</Text>
                            </TouchableOpacity>
                            {pickerMode && <DateTimePicker value={date} mode={pickerMode} is24Hour={false} display="default" onChange={onPickerChange}/>}
                            
                            <Text style={[styles.label, { color: COLORS.textSub }]}>Topic</Text>
                            <TextInput 
                                style={[styles.input, { backgroundColor: COLORS.inputBg, color: COLORS.textMain, borderColor: COLORS.border }]} 
                                placeholder="e.g. Linear Equations" 
                                placeholderTextColor={COLORS.placeholder}
                                value={formData.topic} 
                                onChangeText={(text) => setFormData(prev => ({ ...prev, topic: text }))}
                            />

                            {modalClassType === 'live' ? (
                                <>
                                    <Text style={[styles.label, { color: COLORS.textSub }]}>Meeting Link</Text>
                                    <TextInput 
                                        style={[styles.input, { backgroundColor: COLORS.inputBg, color: COLORS.textMain, borderColor: COLORS.border }]} 
                                        placeholder="https://meet.google.com/xyz" 
                                        placeholderTextColor={COLORS.placeholder}
                                        value={formData.meet_link} 
                                        onChangeText={(text) => setFormData(prev => ({ ...prev, meet_link: text }))}
                                    />
                                </>
                            ) : (
                                <>
                                    <Text style={[styles.label, { color: COLORS.textSub }]}>Video File</Text>
                                    <TouchableOpacity style={[styles.filePickerButton, { borderColor: COLORS.blue, backgroundColor: isDark ? '#1a2a3a' : '#e9f5ff' }]} onPress={handleSelectVideo}>
                                        <MaterialIcons name={selectedVideo ? "check-circle" : "cloud-upload"} size={20} color={COLORS.blue} />
                                        <Text style={[styles.filePickerText, { color: COLORS.blue }]} numberOfLines={1}>
                                            {selectedVideo ? selectedVideo.fileName : (isEditing ? 'Change Existing Video' : 'Select Video File')}
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            )}
                            
                            <Text style={[styles.label, { color: COLORS.textSub }]}>Description</Text>
                            <TextInput 
                                style={[styles.input, { backgroundColor: COLORS.inputBg, color: COLORS.textMain, borderColor: COLORS.border, height: 80, textAlignVertical: 'top'}]} 
                                placeholder="Notes..." 
                                placeholderTextColor={COLORS.placeholder}
                                value={formData.description} 
                                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))} 
                                multiline
                            />
                            
                            <View style={styles.modalActions}>
                                <TouchableOpacity style={[styles.modalButton, { backgroundColor: COLORS.border }]} onPress={() => setModalVisible(false)}>
                                    <Text style={{color: COLORS.textMain}}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalButton, { backgroundColor: COLORS.success }]} onPress={handleSave} disabled={isSaving}>
                                    {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Video Player Modal */}
            <Modal visible={videoPlayerVisible} transparent={true} onRequestClose={() => { setCurrentVideoUrl(null); setVideoPlayerVisible(false); }}>
                <View style={styles.videoModalContainer}>
                    <TouchableOpacity style={styles.videoCloseButton} onPress={() => { setCurrentVideoUrl(null); setVideoPlayerVisible(false); }}>
                         <FontAwesome name="close" size={24} color="white" />
                    </TouchableOpacity>
                    {currentVideoUrl && (
                        <Video source={{ uri: currentVideoUrl }} style={styles.videoPlayer} controls={true} resizeMode="contain" onEnd={() => setVideoPlayerVisible(false)} />
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
};

// --- CARD COMPONENT ---
const ClassCard = ({ classItem, onEdit, onDelete, onJoinOrWatch, userRole, colors, isPrivilegedUser }) => {
    const isFutureClass = new Date(classItem.class_datetime) >= new Date();
    const canJoin = (userRole === 'admin' || userRole === 'teacher') || (userRole === 'student' && isFutureClass);

    const handleMenuPress = () => {
        Alert.alert(
            "Manage Class",
            `Options for "${classItem.title}"`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Edit Details", onPress: () => onEdit && onEdit(classItem) },
                { text: "Delete Record", style: "destructive", onPress: () => onDelete && onDelete(classItem.id) }
            ]
        );
    };

    return (
        <Animatable.View animation="fadeInUp" duration={500}>
            <View style={[styles.card, { backgroundColor: colors.cardBg, shadowColor: colors.border }]}>
                <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
                    <View style={{flex: 1, paddingRight: 8}}>
                        <Text style={[styles.cardTitle, { color: colors.textMain }]}>{classItem.title}</Text>
                        <Text style={[styles.cardSubtitle, { color: colors.textSub }]}>{formatDateTime(classItem.class_datetime)}</Text>
                    </View>
                    {isPrivilegedUser && (
                        <TouchableOpacity 
                            style={styles.menuIcon} 
                            onPress={handleMenuPress}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        >
                            <MaterialIcons name="more-vert" size={26} color={colors.iconGrey} />
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.cardBody}>
                    <InfoRow icon="person" text={`By: ${classItem.teacher_name}`} color={colors.textSub} textColor={colors.textMain} />
                    <InfoRow icon="school" text={`Class: ${classItem.class_group}`} color={colors.textSub} textColor={colors.textMain} />
                    <InfoRow icon="book" text={`Subject: ${classItem.subject}`} color={colors.textSub} textColor={colors.textMain} />
                    {classItem.topic && <InfoRow icon="lightbulb" text={`Topic: ${classItem.topic}`} color={colors.textSub} textColor={colors.textMain} />}
                </View>
                
                {classItem.class_type === 'live' && classItem.meet_link && canJoin && (
                    <TouchableOpacity style={[styles.joinButton, { backgroundColor: colors.blue }]} onPress={() => onJoinOrWatch(classItem)}>
                        <MaterialIcons name="videocam" size={20} color="white" />
                        <Text style={styles.joinButtonText}>Join Live Class</Text>
                    </TouchableOpacity>
                )}

                {classItem.class_type === 'recorded' && classItem.video_url && (
                    <TouchableOpacity style={[styles.joinButton, { backgroundColor: colors.primary }]} onPress={() => onJoinOrWatch(classItem)}>
                        <MaterialIcons name="play-circle-filled" size={20} color="white" />
                        <Text style={styles.joinButtonText}>Watch Recording</Text>
                    </TouchableOpacity>
                )}
            </View>
        </Animatable.View>
    );
};

const InfoRow = ({ icon, text, color, textColor }) => (
    <View style={styles.infoRow}>
        <MaterialIcons name={icon} size={18} color={color} style={styles.icon} />
        <Text style={[styles.infoText, { color: textColor }]} numberOfLines={2}>{text}</Text>
    </View>
);

// --- STYLES ---
const styles = StyleSheet.create({ 
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }, 
    container: { flex: 1 }, 
    listContentContainer: { paddingBottom: 20, paddingHorizontal: 15 }, 
    
    // Header
    headerCard: { 
        paddingHorizontal: 15, 
        paddingVertical: 12, 
        width: '96%', 
        alignSelf: 'center', 
        marginTop: 15, 
        marginBottom: 10, 
        borderRadius: 12, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        elevation: 3, 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 } 
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 12 },
    headerBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    
    // Tabs
    tabContainer: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 15, borderRadius: 8, overflow: 'hidden', elevation: 2, borderWidth: 1 },
    tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabButtonText: { fontSize: 14, fontWeight: '600' },
    
    emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16 }, 
    
    // Card
    card: { borderRadius: 12, padding: 15, marginBottom: 15, elevation: 2, shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } }, 
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, paddingBottom: 10, marginBottom: 10 }, 
    cardTitle: { fontSize: 17, fontWeight: 'bold', flexWrap: 'wrap' }, 
    cardSubtitle: { fontSize: 13, marginTop: 4 }, 
    menuIcon: { padding: 4 },
    cardBody: { marginBottom: 5 },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 }, 
    icon: { width: 24, textAlign: 'center', marginRight: 8 }, 
    infoText: { fontSize: 14, flex: 1 }, 
    joinButton: { flexDirection: 'row', paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 15 }, 
    joinButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold', marginLeft: 8 }, 
    
    // Modal
    modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center' }, 
    modalContent: { borderRadius: 12, padding: 20, width: width > 600 ? '60%' : '90%', maxHeight: '85%', elevation: 5 }, 
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' }, 
    label: { fontSize: 14, fontWeight: '600', marginBottom: 5, marginTop: 10 }, 
    input: { borderWidth: 1, padding: 10, borderRadius: 8, marginBottom: 10, fontSize: 16 }, 
    pickerContainer: { borderWidth: 1, borderRadius: 8, marginBottom: 10, justifyContent: 'center' }, 
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 }, 
    modalButton: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, marginLeft: 10, alignItems: 'center' }, 
    saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }, 
    modalTabContainer: { flexDirection: 'row', borderRadius: 8, padding: 4, marginBottom: 15 },
    modalTab: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
    modalTabText: { fontWeight: '600' },
    
    // File Picker
    filePickerButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 15 },
    filePickerText: { marginLeft: 10, flex: 1, fontSize: 14 },
    
    // Video Modal
    videoModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    videoPlayer: { width: '100%', height: height * 0.7 },
    videoCloseButton: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 30, right: 20, zIndex: 1, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 }
});

export default OnlineClassScreen;