// 📂 File: src/screens/Online_Class/OnlineClassScreen.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking,
  ActivityIndicator, Modal, TextInput, FlatList, Platform
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext'; 
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';
import DocumentPicker, { DocumentPickerResponse } from '@react-native-documents/picker';
import Video from 'react-native-video';

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

// --- MAIN SCREEN COMPONENT ---
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
    const [selectedVideo, setSelectedVideo] = useState<DocumentPickerResponse | null>(null);
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
            setClassGroups(['All', ...classGroupsRes.data]);
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || 'An unknown error occurred.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);
    
    useEffect(() => {
        const fetchClassSpecificData = async () => {
            if (!modalVisible || isEditing) return;

            setSubjects([]); 
            setTeachers([]);

            if (formData.class_group === 'All') {
                try {
                    const [subjectsRes, teachersRes] = await Promise.all([
                        apiClient.get('/subjects/all-unique'),
                        apiClient.get('/all-teachers-and-admins')
                    ]);
                    setSubjects(subjectsRes.data);
                    setTeachers(teachersRes.data);
                } catch (error: any) {
                    Alert.alert("Error fetching details", error.response?.data?.message || 'Could not load details for "All" classes.');
                }
            } else if (formData.class_group) {
                try {
                    const [subjectsRes, teachersRes] = await Promise.all([
                        apiClient.get(`/subjects-for-class/${formData.class_group}`),
                        apiClient.get(`/teachers-for-class/${formData.class_group}`)
                    ]);
                    setSubjects(subjectsRes.data);
                    setTeachers(teachersRes.data);
                } catch (error: any) {
                    Alert.alert("Error fetching details", error.response?.data?.message || 'Could not load class details.');
                }
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

        return { liveClasses, recordedClasses };
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
                title: classItem.title, class_group: classItem.class_group,
                subject: classItem.subject, teacher_id: classItem.teacher_id,
                meet_link: classItem.meet_link || '', description: classItem.description || '',
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
        try {
            const res = await DocumentPicker.pickSingle({ type: [DocumentPicker.types.video] });
            setSelectedVideo(res);
        } catch (err) {
            if (!DocumentPicker.isCancel(err)) {
                Alert.alert("Error", "Could not select video file.");
            }
        }
    };
    
    const handleSave = async () => {
        if (!user) return Alert.alert("Error", "User not found.");
        setIsSaving(true);
        
        const data = new FormData();
        data.append('title', formData.title);
        data.append('class_group', formData.class_group);
        data.append('subject', formData.subject);
        data.append('teacher_id', String(formData.teacher_id));
        data.append('class_datetime', date.toISOString());
        data.append('description', formData.description);

        if (isEditing) {
            data.append('topic', formData.topic);
            data.append('meet_link', formData.meet_link);
            try {
                await apiClient.put(`/online-classes/${currentClass?.id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
                Alert.alert("Success", "Class updated.");
            } catch (error: any) { Alert.alert("Save Error", error.response?.data?.message || 'Failed to update.'); }
        } else {
            data.append('class_type', modalClassType);
            if (modalClassType === 'live') {
                if (!formData.meet_link) { setIsSaving(false); return Alert.alert("Validation Error", "Meeting Link is required."); }
                data.append('meet_link', formData.meet_link);
            } else {
                if (!selectedVideo || !formData.topic) { setIsSaving(false); return Alert.alert("Validation Error", "Topic and a video file are required."); }
                data.append('topic', formData.topic);
                data.append('videoFile', { uri: selectedVideo.uri, type: selectedVideo.type, name: selectedVideo.name, });
            }
            try {
                await apiClient.post('/online-classes', data, { headers: { 'Content-Type': 'multipart/form-data' } });
                Alert.alert("Success", `Class ${modalClassType === 'live' ? 'scheduled' : 'uploaded'}.`);
            } catch (error: any) { Alert.alert("Save Error", error.response?.data?.message || 'Failed to save.'); }
        }
        
        setIsSaving(false);
        setModalVisible(false);
        fetchInitialData();
    };

    const handleDelete = (classId: number) => {
        Alert.alert("Confirm Deletion", "Are you sure you want to delete this class?", [
             { text: "Cancel", style: "cancel" },
             { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    await apiClient.delete(`/online-classes/${classId}`);
                    Alert.alert("Success", "Class deleted successfully.");
                    fetchInitialData();
                } catch (error: any) { Alert.alert("Error", error.response?.data?.message || 'Failed to delete.'); }
            }}]
        );
    };
    
    const handleJoinOrWatch = (classItem: OnlineClass) => {
        if (classItem.class_type === 'live' && classItem.meet_link) {
            Linking.openURL(classItem.meet_link).catch(() => Alert.alert("Error", "Could not open the link."));
        } else if (classItem.class_type === 'recorded' && classItem.video_url) {
            setCurrentVideoUrl(classItem.video_url);
            setVideoPlayerVisible(true);
        }
    };

    if (loading) { return <View style={styles.center}><ActivityIndicator size="large" color="#007bff" /></View>; }

    const dataToShow = view === 'live' ? liveClasses : recordedClasses;

    return (
        <View style={styles.container}>
            <FlatList
                data={dataToShow}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => <ClassCard classItem={item} onEdit={isPrivilegedUser ? handleOpenModal : undefined} onDelete={isPrivilegedUser ? handleDelete : undefined} onJoinOrWatch={handleJoinOrWatch} userRole={user?.role} />}
                ListHeaderComponent={
                    <>
                        <View style={styles.header}>
                            <FontAwesome name="laptop" size={28} color="#4a4a4a" />
                            <View style={styles.headerTextContainer}>
                                <Text style={styles.headerTitle}>Online Classes</Text>
                                <Text style={styles.headerSubtitle}>View and manage all online sessions.</Text>
                            </View>
                        </View>
                        <View style={styles.tabContainer}>
                            <TouchableOpacity style={[styles.tab, view === 'live' && styles.activeTab]} onPress={() => setView('live')}>
                                <Text style={[styles.tabText, view === 'live' && styles.activeTabText]}>Live Classes</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.tab, view === 'recorded' && styles.activeTab]} onPress={() => setView('recorded')}>
                                <Text style={[styles.tabText, view === 'recorded' && styles.activeTabText]}>Recorded Classes</Text>
                            </TouchableOpacity>
                        </View>
                        {isPrivilegedUser && (
                            <TouchableOpacity style={styles.scheduleButton} onPress={() => handleOpenModal()}>
                                <FontAwesome name="plus" size={16} color="white" />
                                <Text style={styles.scheduleButtonText}>Add New Class</Text>
                            </TouchableOpacity>
                        )}
                    </>
                }
                ListEmptyComponent={ <View style={styles.center}> <MaterialIcons name="event-busy" size={60} color="#cccccc" /> <Text style={styles.emptyText}>{`No ${view} classes found.`}</Text> </View> }
                contentContainerStyle={styles.listContentContainer}
            />
          
            <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
                <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)}>
                    <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
                        <ScrollView>
                            <Text style={styles.modalTitle}>{isEditing ? 'Edit Class' : 'Add New Class'}</Text>
                             {!isEditing && ( <View style={styles.modalTabContainer}>
                                    <TouchableOpacity style={[styles.modalTab, modalClassType === 'live' && styles.modalActiveTab]} onPress={() => setModalClassType('live')}>
                                        <Text style={[styles.modalTabText, modalClassType === 'live' && styles.modalActiveTabText]}>Live Class</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.modalTab, modalClassType === 'recorded' && styles.modalActiveTab]} onPress={() => setModalClassType('recorded')}>
                                        <Text style={[styles.modalTabText, modalClassType === 'recorded' && styles.modalActiveTabText]}>Recorded Class</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <Text style={styles.label}>Title:</Text>
                            <TextInput style={styles.input} placeholder="e.g., Algebra Chapter 5 Review" value={formData.title} onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}/>
                            
                            <Text style={styles.label}>Class:</Text>
                            <View style={styles.pickerContainer}>
                                <Picker enabled={!isEditing} selectedValue={formData.class_group} onValueChange={(itemValue) => handleClassChange(itemValue)}>
                                    <Picker.Item label="-- Select Class --" value="" />
                                    {classGroups.map((c, i) => <Picker.Item key={i} label={c} value={c} />)}
                                </Picker>
                            </View>

                            <Text style={styles.label}>Subject:</Text>
                            <View style={styles.pickerContainer}>
                                <Picker enabled={!isEditing} selectedValue={formData.subject} onValueChange={(itemValue) => setFormData(prev => ({ ...prev, subject: itemValue }))}>
                                    <Picker.Item label="-- Select Subject --" value="" />
                                    {subjects.map((s, i) => <Picker.Item key={i} label={s} value={s} />)}
                                </Picker>
                            </View>

                            <Text style={styles.label}>Teacher / Admin:</Text>
                            <View style={styles.pickerContainer}>
                                <Picker enabled={!isEditing} selectedValue={String(formData.teacher_id)} onValueChange={(itemValue) => setFormData(prev => ({ ...prev, teacher_id: Number(itemValue) }))}>
                                    <Picker.Item label="-- Select Person --" value="" />
                                    {teachers.map((t) => <Picker.Item key={t.id} label={t.full_name} value={String(t.id)} />)}
                                </Picker>
                            </View>
                            
                            <Text style={styles.label}>Date & Time:</Text>
                            <TouchableOpacity disabled={isEditing} onPress={() => setPickerMode('date')} style={styles.input}><Text style={{ color: '#333' }}>{formatDateTime(date.toISOString())}</Text></TouchableOpacity>
                            {pickerMode && <DateTimePicker value={date} mode={pickerMode} is24Hour={true} display="default" onChange={onPickerChange}/>}
                            
                            {modalClassType === 'live' ? (
                                <>
                                    <Text style={styles.label}>Meeting Link:</Text>
                                    <TextInput style={styles.input} placeholder="https://meet.google.com/xyz" value={formData.meet_link} onChangeText={(text) => setFormData(prev => ({ ...prev, meet_link: text }))}/>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.label}>Topic:</Text>
                                    <TextInput style={styles.input} placeholder="e.g., Solving Linear Equations" value={formData.topic} onChangeText={(text) => setFormData(prev => ({ ...prev, topic: text }))}/>
                                    
                                    <Text style={styles.label}>Video File:</Text>
                                    <TouchableOpacity style={styles.filePickerButton} onPress={handleSelectVideo} disabled={isEditing}>
                                        <FontAwesome name="upload" size={16} color="#007bff" />
                                        <Text style={styles.filePickerText} numberOfLines={1}>{selectedVideo ? selectedVideo.name : (isEditing ? 'Cannot change existing video' : 'Select Video File')}</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                            
                            <Text style={styles.label}>Description (Optional):</Text>
                            <TextInput style={[styles.input, styles.textArea]} placeholder="Topics to be covered..." value={formData.description} onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))} multiline/>
                            
                            <View style={styles.modalActions}>
                                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}><Text style={styles.saveButtonText}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSave} disabled={isSaving}>
                                    {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            <Modal visible={videoPlayerVisible} transparent={true} onRequestClose={() => { setCurrentVideoUrl(null); setVideoPlayerVisible(false); }}>
                <View style={styles.videoModalContainer}>
                    <TouchableOpacity style={styles.videoCloseButton} onPress={() => { setCurrentVideoUrl(null); setVideoPlayerVisible(false); }}>
                         <FontAwesome name="close" size={24} color="white" />
                    </TouchableOpacity>
                    {currentVideoUrl && (
                        <Video
                            source={{ uri: currentVideoUrl }}
                            style={styles.videoPlayer}
                            controls={true}
                            resizeMode="contain"
                            onError={(e) => { console.error('Video Error:', e); Alert.alert('Video Error', 'Could not load the video.'); }}
                            onEnd={() => setVideoPlayerVisible(false)}
                            fullscreen={true}
                        />
                    )}
                </View>
            </Modal>
        </View>
    );
};

const ClassCard = ({ classItem, onEdit, onDelete, onJoinOrWatch, userRole }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{flex: 1, paddingRight: 8}}>
            <Text style={styles.cardTitle}>{classItem.title}</Text>
            <Text style={styles.cardSubtitle}>{formatDateTime(classItem.class_datetime)}</Text>
        </View>
        {(userRole === 'admin' || userRole === 'teacher') && (
           <View style={styles.buttonGroup}>
              <TouchableOpacity style={styles.iconButton} onPress={() => onEdit(classItem)}>
                  <FontAwesome name="pencil" size={18} color="#ffc107" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => onDelete(classItem.id)}>
                  <FontAwesome name="trash" size={18} color="#dc3545" />
              </TouchableOpacity>
           </View>
        )}
      </View>
      <View style={styles.cardBody}>
          <InfoRow icon="user" text={`By: ${classItem.teacher_name}`} />
          <InfoRow icon="university" text={`Class: ${classItem.class_group}`} />
          <InfoRow icon="book" text={`Subject: ${classItem.subject}`} />
          {classItem.topic && <InfoRow icon="lightbulb-o" text={`Topic: ${classItem.topic}`} />}
          {classItem.description && <InfoRow icon="info-circle" text={`Notes: ${classItem.description}`} />}
      </View>
      {userRole === 'student' && classItem.class_type === 'live' && new Date(classItem.class_datetime) >= new Date() && (
          <TouchableOpacity style={styles.joinButton} onPress={() => onJoinOrWatch(classItem)}>
              <FontAwesome name="video-camera" size={18} color="white" />
              <Text style={styles.joinButtonText}>Join Live Class</Text>
          </TouchableOpacity>
      )}
      {classItem.class_type === 'recorded' && classItem.video_url && (
           <TouchableOpacity style={[styles.joinButton, styles.watchButton]} onPress={() => onJoinOrWatch(classItem)}>
              <FontAwesome name="play-circle" size={18} color="white" />
              <Text style={styles.joinButtonText}>Watch Recording</Text>
           </TouchableOpacity>
      )}
    </View>
);

const InfoRow: React.FC<{icon: string, text: string}> = ({ icon, text }) => (
    <View style={styles.infoRow}><FontAwesome name={icon} size={16} color="#555" style={styles.icon} /><Text style={styles.infoText} numberOfLines={2}>{text}</Text></View>
);

const styles = StyleSheet.create({ 
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }, 
    container: { flex: 1, backgroundColor: '#f0f2f5' }, 
    listContentContainer: { paddingBottom: 20 }, 
    header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f2f5', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, }, 
    headerTextContainer: { marginLeft: 15 }, 
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' }, 
    headerSubtitle: { fontSize: 15, color: '#666' }, 
    scheduleButton: { flexDirection: 'row', backgroundColor: '#28a745', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginBottom: 10, elevation: 3 }, 
    scheduleButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginLeft: 10 }, 
    emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16, color: '#999' }, 
    card: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginHorizontal: 16, marginBottom: 16, elevation: 4 }, 
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 12, marginBottom: 12 }, 
    cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50' }, 
    cardSubtitle: { fontSize: 14, color: '#7f8c8d', marginTop: 4 }, 
    buttonGroup: { flexDirection: 'row' }, 
    iconButton: { marginLeft: 16, padding: 5 }, 
    cardBody: {}, 
    infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 }, 
    icon: { width: 24, textAlign: 'center', marginRight: 12, color: '#34495e' }, 
    infoText: { fontSize: 16, color: '#34495e', flex: 1 }, 
    joinButton: { flexDirection: 'row', backgroundColor: '#007bff', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 15, elevation: 2 }, 
    watchButton: { backgroundColor: '#5a67d8' },
    joinButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginLeft: 10 }, 
    modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }, 
    modalContent: { backgroundColor: 'white', borderRadius: 10, padding: 20, width: '90%', maxHeight: '85%' }, 
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' }, 
    label: { fontSize: 16, fontWeight: '500', color: '#555', marginBottom: 8, marginTop: 12 }, 
    input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 15, backgroundColor: '#f9f9f9', fontSize: 16, color: '#333' }, 
    pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 15, backgroundColor: '#f9f9f9', justifyContent: 'center' }, 
    textArea: { height: 100, textAlignVertical: 'top' }, 
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 }, 
    modalButton: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, marginLeft: 10, alignItems: 'center' }, 
    cancelButton: { backgroundColor: '#6c757d' }, 
    saveButton: { backgroundColor: '#28a745' }, 
    saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    tabContainer: { flexDirection: 'row', justifyContent: 'center', marginHorizontal: 16, marginBottom: 20, backgroundColor: '#e4e7ed', borderRadius: 12, },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12, },
    activeTab: { backgroundColor: '#007bff', elevation: 3 },
    tabText: { fontSize: 16, fontWeight: '600', color: '#606266' },
    activeTabText: { color: '#ffffff' },
    modalTabContainer: { flexDirection: 'row', backgroundColor: '#e9ecef', borderRadius: 8, padding: 4, marginBottom: 15 },
    modalTab: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
    modalActiveTab: { backgroundColor: 'white', elevation: 2 },
    modalTabText: { color: '#495057', fontWeight: '600' },
    modalActiveTabText: { color: '#007bff' },
    filePickerButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e9f5ff', borderWidth: 1, borderColor: '#007bff', padding: 12, borderRadius: 8, marginBottom: 15 },
    filePickerText: { marginLeft: 10, color: '#007bff', flex: 1, fontSize: 16 },
    videoModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
    videoPlayer: { width: '100%', height: '100%' },
    videoCloseButton: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 30, right: 20, zIndex: 1, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 }
});

export default OnlineClassScreen;