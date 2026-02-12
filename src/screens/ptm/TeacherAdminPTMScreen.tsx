import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, Modal, 
  TextInput, Alert, ScrollView, Linking, SafeAreaView, useColorScheme, Platform, 
  Dimensions, KeyboardAvoidingView, StatusBar
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'; 

import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { MeetingCard, Meeting } from './MeetingCard'; // Ensure correct path

const { width, height } = Dimensions.get('window');

interface Teacher { id: number; full_name: string; }

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F5F7FA',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    inputBg: '#FAFAFA',
    border: '#CFD8DC',
    success: '#10b981',
    danger: '#ef4444',
    placeholder: '#B0BEC5'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    inputBg: '#2C2C2C',
    border: '#333333',
    success: '#10b981',
    danger: '#ef4444',
    placeholder: '#616161'
};

const TeacherAdminPTMScreen = () => {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? DarkColors : LightColors;
  
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
            apiClient.get('/ptm'), apiClient.get('/ptm/teachers'), apiClient.get('/ptm/classes')
          ]);
          setMeetings(meetingsRes.data);
          setTeachers(teachersRes.data);
          setClasses(['All', ...classesRes.data]);
      } catch (error: any) {
          Alert.alert("Error", error.response?.data?.message || "Failed to load data.");
      } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const onPickerChange = (event: any, selectedValue?: Date) => {
    if (Platform.OS === 'android') setPickerMode(null);
    
    if (event.type === 'set' && selectedValue) {
      const currentDate = selectedValue;
      if (pickerMode === 'date') {
        const newDate = new Date(date);
        newDate.setFullYear(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        setDate(newDate);
        if (Platform.OS === 'android') setPickerMode('time');
      } else if (pickerMode === 'time') {
        const finalDate = new Date(date);
        finalDate.setHours(currentDate.getHours());
        finalDate.setMinutes(currentDate.getMinutes());
        setDate(finalDate);

        const year = finalDate.getFullYear();
        const month = String(finalDate.getMonth() + 1).padStart(2, '0');
        const day = String(finalDate.getDate()).padStart(2, '0');
        const hours = String(finalDate.getHours()).padStart(2, '0');
        const minutes = String(finalDate.getMinutes()).padStart(2, '0');
        const sqlDateString = `${year}-${month}-${day} ${hours}:${minutes}:00`;
        
        setFormData(prev => ({ ...prev, meeting_datetime: sqlDateString }));
        if (Platform.OS === 'android') setPickerMode(null);
      }
    } else { setPickerMode(null); }
  };
  
  const handleOpenModal = (meeting: Meeting | null = null) => {
    setEditingMeeting(meeting);
    if (meeting) {
      const existingDate = new Date(meeting.meeting_datetime.replace(' ', 'T'));
      setDate(existingDate);
      setFormData({
          meeting_datetime: meeting.meeting_datetime, 
          teacher_id: meeting.teacher_id.toString(),
          class_group: meeting.class_group,
          subject_focus: meeting.subject_focus,
          status: meeting.status,
          notes: meeting.notes || '',
          meeting_link: meeting.meeting_link || '',
      });
    } else {
      const now = new Date();
      setDate(now);
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setFormData({ ...initialFormState, meeting_datetime: `${year}-${month}-${day} ${hours}:${minutes}:00` });
    }
    setIsModalOpen(true);
  };
  
  const handleSave = async () => {
    if (!user) return Alert.alert("Error", "Authentication session not found.");
    if(!formData.meeting_datetime || !formData.teacher_id || !formData.class_group || !formData.subject_focus) {
        return Alert.alert("Required", "Please fill in all required fields.");
    }

    const body = editingMeeting 
      ? { ...formData } 
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
    Alert.alert( "Confirm", "Delete this meeting?",
      [ { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
          try { await apiClient.delete(`/ptm/${id}`); await fetchAllData(); } 
          catch (error: any) { Alert.alert("Error", "Failed to delete."); }
        }}]
    );
  };

  const getDisplayDate = () => {
      if (!formData.meeting_datetime) return 'Select Date & Time';
      const d = new Date(formData.meeting_datetime.replace(" ", "T")); 
      if (isNaN(d.getTime())) return formData.meeting_datetime;
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  };

  if (isLoading) return <View style={[styles.center, {backgroundColor: colors.background}]}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
        
        {/* Header */}
        <View style={[styles.headerCard, { backgroundColor: colors.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
            <View style={styles.headerLeft}>
                <View style={[styles.headerIconContainer, { backgroundColor: isDark ? '#333' : '#E0F2F1' }]}>
                    <MaterialIcons name="groups" size={24} color={colors.primary} />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={[styles.headerTitle, { color: colors.textMain }]}>PTM Manager</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSub }]}>Schedule & Review</Text>
                </View>
            </View>
            <TouchableOpacity style={[styles.headerBtn, {backgroundColor: colors.primary}]} onPress={() => handleOpenModal()}>
                <MaterialIcons name="add" size={18} color="#fff" />
                <Text style={styles.headerBtnText}>Add</Text>
            </TouchableOpacity>
        </View>

        <FlatList
            data={meetings}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
                <View style={styles.cardWrapper}>
                    <MeetingCard 
                      meeting={item} 
                      isAdmin={true} 
                      onEdit={handleOpenModal} 
                      onDelete={handleDelete} 
                      onJoin={(link) => Linking.openURL(link)} 
                    />
                </View>
            )}
            ListEmptyComponent={
              <View style={styles.center}>
                  <MaterialIcons name="event-busy" size={50} color={colors.border} />
                  <Text style={[styles.emptyText, { color: colors.textSub }]}>No meetings found.</Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 30 }}
        />

        {/* Modal */}
        <Modal visible={isModalOpen} animationType="slide" transparent={true} onRequestClose={() => setIsModalOpen(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackdrop}>
                <TouchableOpacity style={styles.modalTouchable} activeOpacity={1} onPress={() => setIsModalOpen(false)}>
                    <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 20}}>
                            <View style={styles.modalHeaderRow}>
                                <Text style={[styles.modalTitle, { color: colors.textMain }]}>{editingMeeting ? "Edit Meeting" : "New Meeting"}</Text>
                                <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                                    <MaterialIcons name="close" size={24} color={colors.textMain} />
                                </TouchableOpacity>
                            </View>
                            
                            <Text style={[styles.label, { color: colors.textMain }]}>Teacher / Admin:</Text>
                            <View style={[styles.pickerWrapper, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                                <Picker selectedValue={formData.teacher_id} onValueChange={val => setFormData({...formData, teacher_id: val})} style={{color: colors.textMain}} dropdownIconColor={colors.textSub}>
                                    <Picker.Item label="-- Select Person --" value="" color={colors.textSub} />
                                    {teachers.map(t => <Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} color={colors.textMain} />)}
                                </Picker>
                            </View>

                            <Text style={[styles.label, { color: colors.textMain }]}>Class:</Text>
                            <View style={[styles.pickerWrapper, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                                <Picker selectedValue={formData.class_group} onValueChange={val => setFormData({...formData, class_group: val})} style={{color: colors.textMain}} dropdownIconColor={colors.textSub}>
                                    <Picker.Item label="-- Select Class --" value="" color={colors.textSub} />
                                    {classes.map(c => <Picker.Item key={c} label={c} value={c} color={colors.textMain} />)}
                                </Picker>
                            </View>

                            <Text style={[styles.label, { color: colors.textMain }]}>Subject Focus:</Text>
                            <TextInput 
                              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]} 
                              placeholderTextColor={colors.placeholder} 
                              value={formData.subject_focus} 
                              onChangeText={t => setFormData({...formData, subject_focus: t})} 
                              placeholder="e.g., Math Performance" 
                            />
                            
                            <Text style={[styles.label, { color: colors.textMain }]}>Date & Time:</Text>
                            <TouchableOpacity onPress={() => setPickerMode('date')} style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                <Text style={{ color: formData.meeting_datetime ? colors.textMain : colors.placeholder, fontSize: 16 }}>{getDisplayDate()}</Text>
                            </TouchableOpacity>
                            
                            {pickerMode && (
                                <DateTimePicker 
                                  testID="dateTimePicker" 
                                  value={date} 
                                  mode={pickerMode} 
                                  is24Hour={false} 
                                  display={Platform.OS === 'ios' ? 'spinner' : 'default'} 
                                  onChange={onPickerChange} 
                                />
                            )}
                            
                            <Text style={[styles.label, { color: colors.textMain }]}>Meeting Link:</Text>
                            <TextInput 
                              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]} 
                              placeholderTextColor={colors.placeholder} 
                              value={formData.meeting_link} 
                              onChangeText={t => setFormData({...formData, meeting_link: t})} 
                              placeholder="Link (Optional)" 
                            />
                            
                            <Text style={[styles.label, { color: colors.textMain }]}>Notes:</Text>
                            <TextInput 
                              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain, height: 80, textAlignVertical: 'top' }]} 
                              multiline 
                              placeholderTextColor={colors.placeholder} 
                              value={formData.notes} 
                              onChangeText={t => setFormData({...formData, notes: t})} 
                              placeholder="Discussion points..." 
                            />
                            
                            {editingMeeting && (
                                <>
                                    <Text style={[styles.label, { color: colors.textMain }]}>Status:</Text>
                                    <View style={[styles.pickerWrapper, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                                        <Picker selectedValue={formData.status} onValueChange={val => setFormData({...formData, status: val})} style={{color: colors.textMain}} dropdownIconColor={colors.textSub}>
                                            <Picker.Item label="Scheduled" value="Scheduled" color={colors.textMain} />
                                            <Picker.Item label="Completed" value="Completed" color={colors.textMain} />
                                        </Picker>
                                    </View>
                                </>
                            )}

                            <View style={styles.modalActions}>
                                <TouchableOpacity onPress={() => setIsModalOpen(false)} style={[styles.modalButton, { backgroundColor: colors.border }]}>
                                  <Text style={{color: colors.textMain}}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleSave} style={[styles.modalButton, { backgroundColor: colors.primary }]}>
                                  <Text style={styles.saveButtonText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Header
    headerCard: {
        paddingHorizontal: 15, paddingVertical: 12, width: '95%', alignSelf: 'center', marginTop: 15, marginBottom: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 12 },
    headerBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    
    // List
    cardWrapper: { width: '100%', marginBottom: 5, alignItems:'center' },
    emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16 },
    
    // Modal
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' },
    modalTouchable: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalContent: { borderRadius: 12, padding: 20, width: width * 0.9, maxHeight: height * 0.85, elevation: 5 },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 5, marginTop: 10 },
    input: { borderWidth: 1, padding: 10, borderRadius: 8, marginBottom: 10, minHeight: 45, justifyContent: 'center', fontSize: 16 },
    pickerWrapper: { borderWidth: 1, borderRadius: 8, marginBottom: 10, justifyContent: 'center', height: 50, overflow: 'hidden' },
    modalActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#eee' },
    modalButton: { paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, alignItems: 'center', minWidth: 100 },
    saveButtonText: { color: 'white', fontWeight: 'bold' }
});

export default TeacherAdminPTMScreen;