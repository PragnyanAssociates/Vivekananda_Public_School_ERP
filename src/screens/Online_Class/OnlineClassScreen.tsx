// 📂 File: src/screens/Online_Class/OnlineClassScreen.tsx (MODIFIED & CORRECTED)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  FlatList
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext'; 
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
// ★★★ 1. IMPORT apiClient AND REMOVE API_BASE_URL ★★★
import apiClient from '../../api/client';

// --- TYPE DEFINITIONS ---
interface OnlineClass {
  id: number;
  title: string;
  class_group: string;
  subject: string;
  teacher_id: number;
  teacher_name: string;
  class_datetime: string;
  meet_link: string;
  description?: string | null;
  created_by?: number;
}
interface Teacher { id: number; full_name: string; }
interface FormData {
  title: string;
  class_group: string;
  subject: string;
  teacher_id: number | '';
  meet_link: string;
  description: string;
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
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [currentClass, setCurrentClass] = useState<OnlineClass | null>(null);

    const initialFormState: FormData = { title: '', class_group: '', subject: '', teacher_id: '', meet_link: '', description: '' };
    const [formData, setFormData] = useState<FormData>(initialFormState);
    
    const [date, setDate] = useState(new Date());
    const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);

    const isPrivilegedUser = user?.role === 'admin' || user?.role === 'teacher';

    const fetchInitialData = useCallback(async () => {
        try {
            setLoading(true);
            // ★★★ 2. USE apiClient FOR ALL FETCH CALLS ★★★
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

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    useEffect(() => {
        const fetchClassSpecificData = async () => {
            if (formData.class_group && !isEditing) {
                try {
                    const [subjectsRes, teachersRes] = await Promise.all([
                        apiClient.get(`/subjects-for-class/${formData.class_group}`),
                        apiClient.get(`/teachers-for-class/${formData.class_group}`)
                    ]);
                    let fetchedSubjects = subjectsRes.data;
                    if (fetchedSubjects.length === 0) {
                        const allSubjectsRes = await apiClient.get('/subjects/all-unique');
                        fetchedSubjects = allSubjectsRes.data;
                    }
                    setSubjects(fetchedSubjects);
                    setTeachers(teachersRes.data);
                } catch (error: any) {
                    Alert.alert("Error fetching details", error.response?.data?.message || 'Could not load class details.');
                    setSubjects([]); setTeachers([]);
                }
            } else if (!formData.class_group) {
                setSubjects([]); setTeachers([]);
            }
        };
        if (modalVisible) fetchClassSpecificData();
    }, [formData.class_group, modalVisible, isEditing]);

    const handleClassChange = (classValue: string) => {
        setFormData({ ...formData, class_group: classValue, subject: '', teacher_id: '' });
    };

    const filteredClasses = useMemo(() => {
        if (!user) return [];
        if (user.role === 'admin') return allClasses;
        if (user.role === 'teacher') return allClasses.filter(c => String(c.teacher_id) === String(user.id) || String(c.created_by) === String(user.id));
        if (user.role === 'student') return allClasses.filter(c => c.class_group === user.class_group);
        return [];
    }, [user, allClasses]);

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
            setFormData({
                title: classItem.title, class_group: classItem.class_group,
                subject: classItem.subject, teacher_id: classItem.teacher_id,
                meet_link: classItem.meet_link, description: classItem.description || '',
            });
            setDate(new Date(classItem.class_datetime));
        } else {
            setIsEditing(false);
            setCurrentClass(null);
            setFormData(initialFormState);
            setDate(new Date());
        }
        setModalVisible(true);
    };
    
    const handleSave = async () => {
        if (!user) return Alert.alert("Error", "User not found.");
        const bodyPayload = isEditing
            ? { title: formData.title, meet_link: formData.meet_link, description: formData.description }
            : { ...formData, teacher_id: Number(formData.teacher_id), class_datetime: date.toISOString(), created_by: user.id };
        if (!isEditing && (!bodyPayload.title || !bodyPayload.class_group || !bodyPayload.subject || !bodyPayload.teacher_id)) {
            Alert.alert("Validation Error", "Please fill in Title, Class, Subject, and Teacher.");
            return;
        }
        try {
            if (isEditing) {
                await apiClient.put(`/online-classes/${currentClass?.id}`, bodyPayload);
            } else {
                await apiClient.post('/online-classes', bodyPayload);
            }
            Alert.alert("Success", `Class ${isEditing ? 'updated' : 'scheduled'} successfully.`);
            fetchInitialData();
            setModalVisible(false);
        } catch (error: any) { Alert.alert("Save Error", error.response?.data?.message || 'Failed to save class.'); }
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
    
    const handleJoinClass = (url: string) => {
        if (url) {
            Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open the meeting link."));
        }
    };

    if (loading) {
        return <View style={styles.center}><ActivityIndicator size="large" color="#007bff" /></View>;
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={filteredClasses}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <ClassCard 
                        classItem={item} 
                        onEdit={isPrivilegedUser ? handleOpenModal : undefined} 
                        onDelete={isPrivilegedUser ? handleDelete : undefined}
                        onJoin={user?.role === 'student' ? handleJoinClass : undefined}
                        userRole={user?.role}
                    />
                )}
                ListHeaderComponent={
                    <>
                        <View style={styles.header}>
                            <FontAwesome name="laptop" size={28} color="#4a4a4a" />
                            <View style={styles.headerTextContainer}>
                                <Text style={styles.headerTitle}>Online Classes</Text>
                                <Text style={styles.headerSubtitle}>View and manage all online sessions.</Text>
                            </View>
                        </View>
                        {isPrivilegedUser && (
                            <TouchableOpacity style={styles.scheduleButton} onPress={() => handleOpenModal()}>
                                <FontAwesome name="plus" size={16} color="white" />
                                <Text style={styles.scheduleButtonText}>Schedule New Class</Text>
                            </TouchableOpacity>
                        )}
                    </>
                }
                ListEmptyComponent={
                    <View style={styles.center}>
                        <MaterialIcons name="event-busy" size={60} color="#cccccc" />
                        <Text style={styles.emptyText}>No Online Classes Found</Text>
                    </View>
                }
                contentContainerStyle={styles.listContentContainer}
            />
          
            <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
                <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)}>
                    <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
                        <ScrollView>
                            <Text style={styles.modalTitle}>{isEditing ? 'Edit Online Class' : 'Schedule New Class'}</Text>
                            <Text style={styles.label}>Title:</Text>
                            <TextInput style={styles.input} placeholder="e.g., Algebra Review" value={formData.title} onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}/>
                            <Text style={styles.label}>Class:</Text>
                            <View style={styles.pickerContainer}>
                                <Picker enabled={!isEditing} selectedValue={formData.class_group} onValueChange={(itemValue) => handleClassChange(itemValue)}>
                                    <Picker.Item label="-- Select Class --" value="" />
                                    {classGroups.map((c, i) => <Picker.Item key={i} label={c} value={c} />)}
                                </Picker>
                            </View>
                            <Text style={styles.label}>Subject:</Text>
                            <View style={styles.pickerContainer}>
                                <Picker enabled={!isEditing && !!formData.class_group} selectedValue={formData.subject} onValueChange={(itemValue) => setFormData(prev => ({ ...prev, subject: itemValue }))}>
                                    <Picker.Item label="-- Select Subject --" value="" />
                                    {subjects.map((s, i) => <Picker.Item key={i} label={s} value={s} />)}
                                </Picker>
                            </View>
                            <Text style={styles.label}>Teacher:</Text>
                            <View style={styles.pickerContainer}>
                                <Picker enabled={!isEditing && !!formData.class_group} selectedValue={String(formData.teacher_id)} onValueChange={(itemValue) => setFormData(prev => ({ ...prev, teacher_id: Number(itemValue) }))}>
                                    <Picker.Item label="-- Select Teacher --" value="" />
                                    {teachers.map((t) => <Picker.Item key={t.id} label={t.full_name} value={String(t.id)} />)}
                                </Picker>
                            </View>
                            <Text style={styles.label}>Date & Time:</Text>
                            <TouchableOpacity disabled={isEditing} onPress={() => setPickerMode('date')} style={styles.input}><Text style={{ color: '#333' }}>{formatDateTime(date.toISOString())}</Text></TouchableOpacity>
                            {pickerMode && <DateTimePicker value={date} mode={pickerMode} is24Hour={true} display="default" onChange={onPickerChange}/>}
                            <Text style={styles.label}>Meeting Link:</Text>
                            <TextInput style={styles.input} placeholder="https://meet.google.com/xyz" value={formData.meet_link} onChangeText={(text) => setFormData(prev => ({ ...prev, meet_link: text }))} keyboardType="url"/>
                            <Text style={styles.label}>Description (Optional):</Text>
                            <TextInput style={[styles.input, styles.textArea]} placeholder="Topics to be covered..." value={formData.description} onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))} multiline/>
                            <View style={styles.modalActions}>
                                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}><Text style={styles.saveButtonText}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSave}><Text style={styles.saveButtonText}>Save</Text></TouchableOpacity>
                            </View>
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const ClassCard = ({ classItem, onEdit, onDelete, onJoin, userRole }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
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
          <InfoRow icon="user" text={`Teacher: ${classItem.teacher_name}`} />
          <InfoRow icon="university" text={`Class: ${classItem.class_group}`} />
          <InfoRow icon="book" text={`Subject: ${classItem.subject}`} />
          {classItem.description && <InfoRow icon="info-circle" text={`Notes: ${classItem.description}`} />}
      </View>
      {userRole === 'student' && (
          <TouchableOpacity style={styles.joinButton} onPress={() => onJoin(classItem.meet_link)}>
              <FontAwesome name="video-camera" size={18} color="white" />
              <Text style={styles.joinButtonText}>Join Class</Text>
          </TouchableOpacity>
      )}
    </View>
);

const InfoRow: React.FC<{icon: string, text: string}> = ({ icon, text }) => (
    <View style={styles.infoRow}><FontAwesome name={icon} size={16} color="#555" style={styles.icon} /><Text style={styles.infoText} numberOfLines={2}>{text}</Text></View>
);

// Styles remain the same
const styles = StyleSheet.create({ center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }, container: { flex: 1, backgroundColor: '#f0f2f5' }, listContentContainer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 }, header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: '#f0f2f5' }, headerTextContainer: { marginLeft: 15 }, headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' }, headerSubtitle: { fontSize: 15, color: '#666' }, scheduleButton: { flexDirection: 'row', backgroundColor: '#28a745', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 }, scheduleButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginLeft: 10 }, emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16, color: '#999' }, card: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5 }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 12, marginBottom: 12 }, cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50' }, cardSubtitle: { fontSize: 14, color: '#7f8c8d', marginTop: 4 }, buttonGroup: { flexDirection: 'row' }, iconButton: { marginLeft: 16, padding: 5 }, cardBody: { marginBottom: 15 }, infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 }, icon: { width: 24, textAlign: 'center', marginRight: 12, color: '#34495e' }, infoText: { fontSize: 16, color: '#34495e', flex: 1 }, joinButton: { flexDirection: 'row', backgroundColor: '#007bff', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10, elevation: 2, shadowColor: '#007bff', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }, joinButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginLeft: 10 }, modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }, modalContent: { backgroundColor: 'white', borderRadius: 10, padding: 20, width: '90%', maxHeight: '85%' }, modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#333' }, label: { fontSize: 16, fontWeight: '500', color: '#555', marginBottom: 8, marginTop: 12 }, input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 15, backgroundColor: '#f9f9f9', fontSize: 16, color: '#333' }, pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 15, backgroundColor: '#f9f9f9', justifyContent: 'center' }, textArea: { height: 100, textAlignVertical: 'top' }, modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 }, modalButton: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, marginLeft: 10, alignItems: 'center' }, cancelButton: { backgroundColor: '#6c757d' }, saveButton: { backgroundColor: '#28a745' }, saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }});

export default OnlineClassScreen;