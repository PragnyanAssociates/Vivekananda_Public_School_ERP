import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, ScrollView, Linking } from 'react-native';
import { MeetingCard, Meeting } from './MeetingCard';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../context/AuthContext';

interface Teacher {
  id: number;
  full_name: string;
}

const TeacherAdminPTMScreen = () => {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const initialFormState = { meeting_datetime: '', teacher_id: '', class_group: '', subject_focus: '', status: 'Scheduled', notes: '', meeting_link: '' };
  const [formData, setFormData] = useState(initialFormState);
  const [date, setDate] = useState(new Date());
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);

  const fetchAllData = useCallback(async () => {
      try {
          const [meetingsRes, teachersRes, classesRes] = await Promise.all([
            apiClient.get('/ptm'),
            apiClient.get('/ptm/teachers'),
            apiClient.get('/ptm/classes')
          ]);
          setMeetings(meetingsRes.data);
          setTeachers(teachersRes.data);
          setClasses(['All', ...classesRes.data]);
      } catch (error: any) {
          Alert.alert("Error", error.response?.data?.message || "Failed to load data.");
      } finally {
          setIsLoading(false);
      }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const onPickerChange = (event, selectedValue) => {
    setPickerMode(null);
    if (event.type === 'set') {
      const currentDate = selectedValue || date;
      if (pickerMode === 'date') {
        setDate(currentDate);
        setPickerMode('time');
      } else if (pickerMode === 'time') {
        const finalDate = new Date(date);
        finalDate.setHours(currentDate.getHours());
        finalDate.setMinutes(currentDate.getMinutes());
        setDate(finalDate);
        const formattedDate = finalDate.getFullYear() + '-' + ('0' + (finalDate.getMonth() + 1)).slice(-2) + '-' + ('0' + finalDate.getDate()).slice(-2) + ' ' + ('0' + finalDate.getHours()).slice(-2) + ':' + ('0' + finalDate.getMinutes()).slice(-2);
        setFormData({ ...formData, meeting_datetime: formattedDate });
      }
    }
  };
  
  const handleOpenModal = (meeting: Meeting | null = null) => {
    setEditingMeeting(meeting);
    if (meeting) {
      setDate(new Date(meeting.meeting_datetime));
      setFormData({
          meeting_datetime: new Date(meeting.meeting_datetime).toISOString().substring(0, 16).replace('T', ' '),
          teacher_id: meeting.teacher_id.toString(),
          class_group: meeting.class_group,
          subject_focus: meeting.subject_focus,
          status: meeting.status,
          notes: meeting.notes || '',
          meeting_link: meeting.meeting_link || '',
      });
    } else {
      setDate(new Date());
      setFormData(initialFormState);
    }
    setIsModalOpen(true);
  };
  
  const handleSave = async () => {
    if (!user) return Alert.alert("Error", "Authentication session not found.");
    const body = editingMeeting 
      ? { status: formData.status, notes: formData.notes, meeting_link: formData.meeting_link } 
      : { ...formData, created_by: user.id };
    try {
        if(editingMeeting) {
            await apiClient.put(`/ptm/${editingMeeting.id}`, body);
        } else {
            await apiClient.post('/ptm', body);
        }
      await fetchAllData();
      setIsModalOpen(false);
    } catch (error: any) { Alert.alert("Save Error", error.response?.data?.message || 'Failed to save meeting.'); }
  };

  const handleDelete = (id: number) => {
    Alert.alert( "Confirm Deletion", "Are you sure you want to delete this meeting?",
      [ { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
          try {
            await apiClient.delete(`/ptm/${id}`);
            await fetchAllData();
          } catch (error: any) { Alert.alert("Error", error.response?.data?.message || 'Failed to delete.'); }
        }}]
    );
  };

  const handleJoinMeeting = (link: string) => {
      if (link) {
          Linking.openURL(link).catch(() => Alert.alert("Error", "Could not open the meeting link."));
      }
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#008080" /></View>;
  }

  return (
    <View style={styles.container}>
        <FlatList
            data={meetings}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
                <MeetingCard 
                    meeting={item} 
                    isAdmin={true} 
                    onEdit={handleOpenModal}
                    onDelete={handleDelete}
                    onJoin={handleJoinMeeting}
                />
            )}
            ListHeaderComponent={
                <>
                    <View style={styles.header}><Text style={styles.headerIcon}>👥</Text><View><Text style={styles.headerTitle}>Manage PTMs</Text><Text style={styles.headerSubtitle}>Schedule, update, and review all meetings.</Text></View></View>
                    <TouchableOpacity style={styles.scheduleBtn} onPress={() => handleOpenModal()}><Text style={styles.scheduleBtnText}>+ Schedule New Meeting</Text></TouchableOpacity>
                </>
            }
            ListEmptyComponent={<Text style={styles.emptyText}>No meetings found.</Text>}
            contentContainerStyle={{ flexGrow: 1 }}
        />
        <Modal visible={isModalOpen} animationType="slide" transparent={true} onRequestClose={() => setIsModalOpen(false)}>
            <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setIsModalOpen(false)}>
                <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
                    <ScrollView>
                        <Text style={styles.modalTitle}>{editingMeeting ? "Edit Meeting" : "New Meeting"}</Text>
                        <Text style={styles.label}>Teacher / Admin:</Text>
                        <View style={styles.pickerContainer}><Picker selectedValue={formData.teacher_id} onValueChange={itemValue => setFormData({...formData, teacher_id: itemValue})} enabled={!editingMeeting}><Picker.Item label="-- Select Person --" value="" />{teachers.map(t => <Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} />)}</Picker></View>
                        <Text style={styles.label}>Class:</Text>
                        <View style={styles.pickerContainer}><Picker selectedValue={formData.class_group} onValueChange={itemValue => setFormData({...formData, class_group: itemValue})} enabled={!editingMeeting}><Picker.Item label="-- Select a Class --" value="" />{classes.map(c => <Picker.Item key={c} label={c} value={c} />)}</Picker></View>
                        <Text style={styles.label}>Subject Focus:</Text>
                        <TextInput style={styles.input} value={formData.subject_focus} onChangeText={text => setFormData({...formData, subject_focus: text})} placeholder="e.g., Math Performance" editable={!editingMeeting}/>
                        <Text style={styles.label}>Date & Time:</Text>
                        <TouchableOpacity onPress={() => setPickerMode('date')} style={styles.input}>
                            <Text style={{ color: formData.meeting_datetime ? '#000' : '#999' }}>{formData.meeting_datetime || 'e.g., 2024-11-20 15:00'}</Text>
                        </TouchableOpacity>
                        {pickerMode && <DateTimePicker testID="dateTimePicker" value={date} mode={pickerMode} is24Hour={true} display="default" onChange={onPickerChange} />}
                        <Text style={styles.label}>Meeting Link (Optional):</Text>
                        <TextInput style={styles.input} value={formData.meeting_link} onChangeText={text => setFormData({...formData, meeting_link: text})} placeholder="e.g., https://meet.google.com/xyz"/>
                        <Text style={styles.label}>Notes:</Text>
                        <TextInput style={[styles.input, {height: 100}]} multiline value={formData.notes} onChangeText={text => setFormData({...formData, notes: text})} placeholder="Discussion points..."/>
                        {editingMeeting && (<><Text style={styles.label}>Status:</Text><View style={styles.pickerContainer}><Picker selectedValue={formData.status} onValueChange={itemValue => setFormData({...formData, status: itemValue})}><Picker.Item label="Scheduled" value="Scheduled" /><Picker.Item label="Completed" value="Completed" /></Picker></View></>)}
                        <View style={styles.modalActions}><TouchableOpacity onPress={() => setIsModalOpen(false)} style={[styles.modalButton, styles.cancelButton]}><Text>Cancel</Text></TouchableOpacity><TouchableOpacity onPress={handleSave} style={[styles.modalButton, styles.saveButton]}><Text style={styles.saveButtonText}>Save</Text></TouchableOpacity></View>
                    </ScrollView>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    </View>
  );
};

const styles = StyleSheet.create({ center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }, container: { flex: 1, backgroundColor: '#f0f4f7' }, header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: 'white' }, headerIcon: { fontSize: 32, marginRight: 15, color: '#5a67d8' }, headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#2d3748' }, headerSubtitle: { fontSize: 14, color: '#718096' }, scheduleBtn: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 8, marginHorizontal: 20, marginVertical: 10, alignItems: 'center' }, scheduleBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' }, emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16, color: '#718096' }, modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }, modalContent: { backgroundColor: 'white', borderRadius: 10, padding: 20, width: '90%', maxHeight: '80%' }, modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }, label: { fontSize: 16, fontWeight: '500', color: '#333', marginBottom: 5, marginTop: 5 }, input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5, marginBottom: 15, backgroundColor: '#fff', minHeight: 40, justifyContent: 'center' }, pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, marginBottom: 15, backgroundColor: '#fff' }, modalActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 20 }, modalButton: { paddingVertical: 10, paddingHorizontal: 30, borderRadius: 5 }, cancelButton: { backgroundColor: '#e0e0e0' }, saveButton: { backgroundColor: '#4CAF50' }, saveButtonText: { color: 'white', fontWeight: 'bold' }});
export default TeacherAdminPTMScreen;