// 📂 File: src/screens/Online_Class/OnlineClassScreen.tsx (DESIGN & FUNCTIONALITY UPDATED)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking,
  ActivityIndicator, Modal, TextInput, FlatList, Platform, SafeAreaView,
  Dimensions
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

// --- COLORS (Fixed for Light/Dark Consistency) ---
const COLORS = {
    primary: '#008080',    // Teal
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',   // Always dark grey
    textSub: '#546E7A',
    border: '#CFD8DC',
    success: '#28a745',
    danger: '#dc3545',
    blue: '#007bff',
    inputBg: '#FFFFFF',
    placeholder: '#888888'
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

const formatDateTime = (isoString: string): string => {
  if (!isoString) return 'Select Date & Time';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
};

const OnlineClassScreen: React.FC = () => {
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
            Alert.alert("Error", error.response?.data?.message || 'An unknown error occurred.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchInitialData(); }, [fetchInitialData]);
    
    useEffect(() => {
        const fetchClassSpecificData = async () => {
            if (!modalVisible || isEditing || !formData.class_group) return;
            setSubjects([]); setTeachers([]);
            try {
                const [subjectsRes, teachersRes] = await Promise.all([
                    apiClient.get(`/subjects-for-class/${formData.class_group}`),
                    apiClient.get(`/teachers-for-class/${formData.class_group}`)
                ]);
                setSubjects(subjectsRes.data);
                setTeachers(teachersRes.data);
            } catch (error: any) {
                Alert.alert("Error", "Could not load class details.");
            }
        };
        fetchClassSpecificData();
    }, [formData.class_group, modalVisible, isEditing]);

    const handleClassChange = (classValue: string) => {
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
            setIsEditing(true); setCurrentClass(classItem); setModalClassType(classItem.class_type);
            setFormData({ title: classItem.title, class_group: classItem.class_group, subject: classItem.subject, teacher_id: classItem.teacher_id, meet_link: classItem.meet_link || '', description: classItem.description || '', topic: classItem.topic || '', });
            setDate(new Date(classItem.class_datetime)); 
            setSelectedVideo(null); // Reset video so we don't accidentally send one unless selected
        } else {
            setIsEditing(false); setCurrentClass(null); setFormData(initialFormState); setSelectedVideo(null); setModalClassType('live'); setDate(new Date());
        }
        setModalVisible(true);
    };

    const handleSelectVideo = async () => {
        const result = await launchImageLibrary({ mediaType: 'video', videoQuality: 'high', });
        if (result.assets && result.assets.length > 0) setSelectedVideo(result.assets[0]);
    };
    
    const handleSave = async () => {
        if (!user) return Alert.alert("Error", "User not found.");
        
        // Basic Validation
        if (!formData.title) return Alert.alert("Validation Error", "Title is required.");
        
        if (!isEditing) {
            if (!formData.class_group || !formData.subject || !formData.teacher_id) {
                return Alert.alert("Validation Error", "Please fill all required fields.");
            }
        }

        if (modalClassType === 'live' && !formData.meet_link) {
            return Alert.alert("Validation Error", "Meeting Link required for live class.");
        }
        if (modalClassType === 'recorded' && !isEditing && !selectedVideo) {
            return Alert.alert("Validation Error", "Video File required for new recorded class.");
        }

        setIsSaving(true);
        const data = new FormData();
        data.append('title', formData.title);
        data.append('description', formData.description);
        data.append('topic', formData.topic);
        data.append('class_type', modalClassType);

        // Fields only needed for creation or if you allow editing them (API depends)
        if (!isEditing) {
            data.append('class_group', formData.class_group);
            data.append('subject', formData.subject);
            data.append('teacher_id', String(formData.teacher_id));
            data.append('class_datetime', date.toISOString());
        }

        if (modalClassType === 'live') {
            data.append('meet_link', formData.meet_link);
        } else {
            // IF a new video is selected, append it (works for Create and Edit)
            if (selectedVideo) {
                data.append('videoFile', { uri: selectedVideo.uri, type: selectedVideo.type, name: selectedVideo.fileName, } as any);
            }
        }

        try { 
            if (isEditing && currentClass) {
                // PUT Request
                await apiClient.put(`/online-classes/${currentClass.id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }); 
                Alert.alert("Success", "Class updated successfully."); 
            } else {
                // POST Request
                await apiClient.post('/online-classes', data, { headers: { 'Content-Type': 'multipart/form-data' } }); 
                Alert.alert("Success", "Class created successfully."); 
            }
        } 
        catch (error: any) { 
            console.error("Save Error", error);
            Alert.alert("Error", "Failed to save class. Please try again."); 
        } 
        finally { 
            setIsSaving(false); 
            setModalVisible(false); 
            fetchInitialData(); 
        }
    };

    const handleDelete = (classId: number) => {
        Alert.alert("Confirm", "Delete this class?", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { try { await apiClient.delete(`/online-classes/${classId}`); fetchInitialData(); } catch (error: any) { Alert.alert("Error", "Failed to delete."); } }}]);
    };
    
    const handleJoinOrWatch = (classItem: OnlineClass) => {
        if (classItem.class_type === 'live' && classItem.meet_link) { Linking.openURL(classItem.meet_link).catch(() => Alert.alert("Error", "Could not open link.")); } 
        else if (classItem.class_type === 'recorded' && classItem.video_url) { setCurrentVideoUrl(classItem.video_url); setVideoPlayerVisible(true); }
    };

    if (loading) { return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>; }

    const dataToShow = view === 'live' ? liveClasses : recordedClasses;

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="laptop-chromebook" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Online Classes</Text>
                        <Text style={styles.headerSubtitle}>Live Sessions & Recordings</Text>
                    </View>
                </View>
                
                {isPrivilegedUser && (
                    <TouchableOpacity style={styles.headerBtn} onPress={() => handleOpenModal()}>
                        <MaterialIcons name="add" size={18} color="#fff" />
                        <Text style={styles.headerBtnText}>Add</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* --- TABS --- */}
            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tabButton, view === 'live' && styles.tabButtonActive]} onPress={() => setView('live')}>
                    <Text style={[styles.tabButtonText, view === 'live' && styles.tabButtonTextActive]}>Live Classes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabButton, view === 'recorded' && styles.tabButtonActive]} onPress={() => setView('recorded')}>
                    <Text style={[styles.tabButtonText, view === 'recorded' && styles.tabButtonTextActive]}>Recorded Classes</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={dataToShow}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => <ClassCard classItem={item} onEdit={isPrivilegedUser ? handleOpenModal : undefined} onDelete={isPrivilegedUser ? handleDelete : undefined} onJoinOrWatch={handleJoinOrWatch} userRole={user?.role} />}
                ListEmptyComponent={ <View style={styles.center}> <MaterialIcons name="event-busy" size={60} color="#ccc" /> <Text style={styles.emptyText}>{`No ${view} classes found.`}</Text> </View> }
                contentContainerStyle={styles.listContentContainer}
            />
          
            {/* --- MODAL --- */}
            <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
                <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)}>
                    <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 20}}>
                            <Text style={styles.modalTitle}>{isEditing ? 'Edit Class' : 'New Class'}</Text>
                             {!isEditing && ( <View style={styles.modalTabContainer}>
                                    <TouchableOpacity style={[styles.modalTab, modalClassType === 'live' && styles.modalActiveTab]} onPress={() => setModalClassType('live')}>
                                        <Text style={[styles.modalTabText, modalClassType === 'live' && styles.modalActiveTabText]}>Live</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.modalTab, modalClassType === 'recorded' && styles.modalActiveTab]} onPress={() => setModalClassType('recorded')}>
                                        <Text style={[styles.modalTabText, modalClassType === 'recorded' && styles.modalActiveTabText]}>Recorded</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <Text style={styles.label}>Title</Text>
                            <TextInput 
                                style={styles.input} 
                                placeholder="e.g. Algebra Review" 
                                placeholderTextColor={COLORS.placeholder}
                                value={formData.title} 
                                onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                            />
                            
                            <Text style={styles.label}>Class</Text>
                            <View style={styles.pickerContainer}>
                                <Picker enabled={!isEditing} selectedValue={formData.class_group} onValueChange={(itemValue) => handleClassChange(itemValue)} dropdownIconColor={COLORS.textMain} style={{color: COLORS.textMain}}>
                                    <Picker.Item label="-- Select Class --" value="" color={COLORS.textMain} />
                                    {classGroups.map((c, i) => <Picker.Item key={i} label={c} value={c} color={COLORS.textMain} />)}
                                </Picker>
                            </View>

                            <Text style={styles.label}>Subject</Text>
                            <View style={styles.pickerContainer}>
                                <Picker enabled={!isEditing} selectedValue={formData.subject} onValueChange={(itemValue) => setFormData(prev => ({ ...prev, subject: itemValue }))} dropdownIconColor={COLORS.textMain} style={{color: COLORS.textMain}}>
                                    <Picker.Item label="-- Select Subject --" value="" color={COLORS.textMain} />
                                    {subjects.map((s, i) => <Picker.Item key={i} label={s} value={s} color={COLORS.textMain} />)}
                                </Picker>
                            </View>

                            <Text style={styles.label}>Teacher</Text>
                            <View style={styles.pickerContainer}>
                                <Picker enabled={!isEditing} selectedValue={String(formData.teacher_id)} onValueChange={(itemValue) => setFormData(prev => ({ ...prev, teacher_id: Number(itemValue) }))} dropdownIconColor={COLORS.textMain} style={{color: COLORS.textMain}}>
                                    <Picker.Item label="-- Select Person --" value="" color={COLORS.textMain} />
                                    {teachers.map((t) => <Picker.Item key={t.id} label={t.full_name} value={String(t.id)} color={COLORS.textMain} />)}
                                </Picker>
                            </View>
                            
                            <Text style={styles.label}>Date & Time</Text>
                            <TouchableOpacity disabled={isEditing} onPress={() => setPickerMode('date')} style={styles.input}>
                                <Text style={{ color: COLORS.textMain }}>{formatDateTime(date.toISOString())}</Text>
                            </TouchableOpacity>
                            {pickerMode && <DateTimePicker value={date} mode={pickerMode} is24Hour={true} display="default" onChange={onPickerChange}/>}
                            
                            <Text style={styles.label}>Topic</Text>
                            <TextInput 
                                style={styles.input} 
                                placeholder="e.g. Linear Equations" 
                                placeholderTextColor={COLORS.placeholder}
                                value={formData.topic} 
                                onChangeText={(text) => setFormData(prev => ({ ...prev, topic: text }))}
                            />

                            {modalClassType === 'live' ? (
                                <>
                                    <Text style={styles.label}>Meeting Link</Text>
                                    <TextInput 
                                        style={styles.input} 
                                        placeholder="https://meet.google.com/xyz" 
                                        placeholderTextColor={COLORS.placeholder}
                                        value={formData.meet_link} 
                                        onChangeText={(text) => setFormData(prev => ({ ...prev, meet_link: text }))}
                                    />
                                </>
                            ) : (
                                <>
                                    <Text style={styles.label}>Video File</Text>
                                    {/* This section now allows editing/replacing video */}
                                    <TouchableOpacity style={styles.filePickerButton} onPress={handleSelectVideo}>
                                        <MaterialIcons name={selectedVideo ? "check-circle" : "cloud-upload"} size={20} color={COLORS.blue} />
                                        <Text style={styles.filePickerText} numberOfLines={1}>
                                            {selectedVideo ? selectedVideo.fileName : (isEditing ? 'Change Existing Video' : 'Select Video File')}
                                        </Text>
                                    </TouchableOpacity>
                                    {isEditing && !selectedVideo && <Text style={{fontSize:11, color: COLORS.textSub, marginTop: -10, marginBottom: 10, marginLeft: 5}}>Current video will be kept if you don't select a new one.</Text>}
                                </>
                            )}
                            
                            <Text style={styles.label}>Description</Text>
                            <TextInput 
                                style={[styles.input, {height: 80, textAlignVertical: 'top'}]} 
                                placeholder="Notes..." 
                                placeholderTextColor={COLORS.placeholder}
                                value={formData.description} 
                                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))} 
                                multiline
                            />
                            
                            <View style={styles.modalActions}>
                                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}>
                                    <Text style={{color: COLORS.textMain}}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSave} disabled={isSaving}>
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
                        <Video source={{ uri: currentVideoUrl }} style={styles.videoPlayer} controls={true} resizeMode="contain" onError={(e) => { Alert.alert('Error', 'Could not load video.'); }} onEnd={() => setVideoPlayerVisible(false)} fullscreen={true} />
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const ClassCard = ({ classItem, onEdit, onDelete, onJoinOrWatch, userRole }) => {
    const isFutureClass = new Date(classItem.class_datetime) >= new Date();
    // Logic for who can join: Admins/Teachers always, Students only if future/present
    const canJoin = (userRole === 'admin' || userRole === 'teacher') || (userRole === 'student' && isFutureClass);

    return (
        <Animatable.View animation="fadeInUp" duration={500}>
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={{flex: 1, paddingRight: 8}}>
                        <Text style={styles.cardTitle}>{classItem.title}</Text>
                        <Text style={styles.cardSubtitle}>{formatDateTime(classItem.class_datetime)}</Text>
                    </View>
                    {(userRole === 'admin' || userRole === 'teacher') && (
                    <View style={styles.buttonGroup}>
                        <TouchableOpacity style={styles.iconButton} onPress={() => onEdit(classItem)}>
                            <MaterialIcons name="edit" size={20} color={COLORS.blue} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.iconButton, {backgroundColor: '#fee2e2'}]} onPress={() => onDelete(classItem.id)}>
                            <MaterialIcons name="delete" size={20} color={COLORS.danger} />
                        </TouchableOpacity>
                    </View>
                    )}
                </View>
                <View style={styles.cardBody}>
                    <InfoRow icon="person" text={`By: ${classItem.teacher_name}`} />
                    <InfoRow icon="school" text={`Class: ${classItem.class_group}`} />
                    <InfoRow icon="book" text={`Subject: ${classItem.subject}`} />
                    {classItem.topic && <InfoRow icon="lightbulb" text={`Topic: ${classItem.topic}`} />}
                </View>
                
                {classItem.class_type === 'live' && classItem.meet_link && canJoin && (
                    <TouchableOpacity style={styles.joinButton} onPress={() => onJoinOrWatch(classItem)}>
                        <MaterialIcons name="videocam" size={20} color="white" />
                        <Text style={styles.joinButtonText}>Join Live Class</Text>
                    </TouchableOpacity>
                )}

                {classItem.class_type === 'recorded' && classItem.video_url && (
                    <TouchableOpacity style={[styles.joinButton, styles.watchButton]} onPress={() => onJoinOrWatch(classItem)}>
                        <MaterialIcons name="play-circle-filled" size={20} color="white" />
                        <Text style={styles.joinButtonText}>Watch Recording</Text>
                    </TouchableOpacity>
                )}
            </View>
        </Animatable.View>
    );
};

const InfoRow: React.FC<{icon: string, text: string}> = ({ icon, text }) => (
    <View style={styles.infoRow}>
        <MaterialIcons name={icon} size={18} color={COLORS.textSub} style={styles.icon} />
        <Text style={styles.infoText} numberOfLines={2}>{text}</Text>
    </View>
);

const styles = StyleSheet.create({ 
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: COLORS.background }, 
    container: { flex: 1, backgroundColor: COLORS.background }, 
    listContentContainer: { paddingBottom: 20, paddingHorizontal: 15 }, 
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: COLORS.cardBg,
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
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerIconContainer: {
        backgroundColor: '#E0F2F1', // Teal bg
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
    headerSubtitle: { fontSize: 13, color: COLORS.textSub },
    headerBtn: {
        backgroundColor: COLORS.primary,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 10,
    },
    headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    // Tabs
    tabContainer: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 15, backgroundColor: COLORS.cardBg, borderRadius: 8, overflow: 'hidden', elevation: 2, borderWidth: 1, borderColor: COLORS.border },
    tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabButtonActive: { backgroundColor: '#F0FDF4', borderBottomWidth: 3, borderBottomColor: COLORS.primary },
    tabButtonText: { fontSize: 14, fontWeight: '600', color: COLORS.textSub },
    tabButtonTextActive: { color: COLORS.primary },

    emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16, color: COLORS.textSub }, 
    
    // Card
    card: { backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 15, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 }, 
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10, marginBottom: 10 }, 
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, flexWrap: 'wrap' }, 
    cardSubtitle: { fontSize: 13, color: COLORS.textSub, marginTop: 4 }, 
    buttonGroup: { flexDirection: 'row', gap: 8 }, 
    iconButton: { padding: 6, backgroundColor: '#e0f2f1', borderRadius: 8 }, 
    cardBody: {}, 
    infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 }, 
    icon: { width: 24, textAlign: 'center', marginRight: 8, color: COLORS.textSub }, 
    infoText: { fontSize: 14, color: COLORS.textMain, flex: 1 }, 
    joinButton: { flexDirection: 'row', backgroundColor: COLORS.blue, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 15 }, 
    watchButton: { backgroundColor: '#5a67d8' },
    joinButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold', marginLeft: 8 }, 
    
    // Modal
    modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }, 
    modalContent: { backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 20, width: '90%', maxHeight: '85%' }, 
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: COLORS.textMain }, 
    label: { fontSize: 14, fontWeight: '600', color: COLORS.textSub, marginBottom: 5, marginTop: 10 }, 
    input: { borderWidth: 1, borderColor: COLORS.border, padding: 10, borderRadius: 8, marginBottom: 10, backgroundColor: COLORS.inputBg, fontSize: 16, color: COLORS.textMain }, 
    pickerContainer: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, marginBottom: 10, backgroundColor: COLORS.inputBg, justifyContent: 'center' }, 
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 }, 
    modalButton: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, marginLeft: 10, alignItems: 'center' }, 
    cancelButton: { backgroundColor: '#e0e0e0' }, 
    saveButton: { backgroundColor: COLORS.success }, 
    saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }, 
    
    modalTabContainer: { flexDirection: 'row', backgroundColor: '#e9ecef', borderRadius: 8, padding: 4, marginBottom: 15 },
    modalTab: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
    modalActiveTab: { backgroundColor: 'white', elevation: 2 },
    modalTabText: { color: '#495057', fontWeight: '600' },
    modalActiveTabText: { color: COLORS.blue },
    filePickerButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e9f5ff', borderWidth: 1, borderColor: COLORS.blue, padding: 12, borderRadius: 8, marginBottom: 15 },
    filePickerText: { marginLeft: 10, color: COLORS.blue, flex: 1, fontSize: 14 },
    videoModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
    videoPlayer: { width: '100%', height: '100%' },
    videoCloseButton: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 30, right: 20, zIndex: 1, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 }
});

export default OnlineClassScreen;