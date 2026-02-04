import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  ActivityIndicator, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  Alert, 
  ScrollView, 
  Linking, 
  SafeAreaView, 
  useColorScheme, 
  Platform,
  Dimensions,
  KeyboardAvoidingView
} from 'react-native';
import { MeetingCard, Meeting } from './MeetingCard';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../context/AuthContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'; 

const { width, height } = Dimensions.get('window');

interface Teacher {
  id: number;
  full_name: string;
}

// --- DYNAMIC THEME HELPERS ---
const getTheme = (scheme: string | null | undefined) => {
    const isDark = scheme === 'dark';
    return {
        isDark,
        primary: '#008080',    // Teal (Brand)
        background: isDark ? '#121212' : '#F2F5F8', 
        cardBg: isDark ? '#1E1E1E' : '#FFFFFF',
        textMain: isDark ? '#E0E0E0' : '#263238',
        textSub: isDark ? '#B0BEC5' : '#546E7A',
        inputBg: isDark ? '#2C2C2C' : '#f9f9f9',
        border: isDark ? '#424242' : '#CFD8DC',
        success: '#43A047',
        danger: '#e53935',
        modalOverlay: 'rgba(0,0,0,0.6)'
    };
};

const TeacherAdminPTMScreen = () => {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  
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

  // --- FIXED DATE HANDLER (SQL COMPATIBLE) ---
  const onPickerChange = (event: any, selectedValue?: Date) => {
    if (Platform.OS === 'android') {
        setPickerMode(null);
    }
    
    if (event.type === 'set' && selectedValue) {
      const currentDate = selectedValue;
      
      if (pickerMode === 'date') {
        const newDate = new Date(date);
        newDate.setFullYear(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        setDate(newDate);
        
        if (Platform.OS === 'android') {
            setPickerMode('time');
        }
      } else if (pickerMode === 'time') {
        const finalDate = new Date(date);
        finalDate.setHours(currentDate.getHours());
        finalDate.setMinutes(currentDate.getMinutes());
        setDate(finalDate);

        // --- CRITICAL FIX: Format to 'YYYY-MM-DD HH:mm:ss' (Local Time) ---
        // This prevents MySQL errors and Timezone shifts
        const year = finalDate.getFullYear();
        const month = String(finalDate.getMonth() + 1).padStart(2, '0');
        const day = String(finalDate.getDate()).padStart(2, '0');
        const hours = String(finalDate.getHours()).padStart(2, '0');
        const minutes = String(finalDate.getMinutes()).padStart(2, '0');
        
        const sqlDateString = `${year}-${month}-${day} ${hours}:${minutes}:00`;
        
        setFormData({ ...formData, meeting_datetime: sqlDateString });
        
        if (Platform.OS === 'android') {
            setPickerMode(null);
        }
      }
    } else {
        setPickerMode(null);
    }
  };
  
  const handleOpenModal = (meeting: Meeting | null = null) => {
    setEditingMeeting(meeting);
    if (meeting) {
      const existingDate = new Date(meeting.meeting_datetime);
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
      // Set initial format
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const sqlDateString = `${year}-${month}-${day} ${hours}:${minutes}:00`;

      setFormData({ ...initialFormState, meeting_datetime: sqlDateString });
    }
    setIsModalOpen(true);
  };
  
  const handleSave = async () => {
    if (!user) return Alert.alert("Error", "Authentication session not found.");
    
    // Validation
    if(!formData.meeting_datetime || !formData.teacher_id || !formData.class_group || !formData.subject_focus) {
        return Alert.alert("Required", "Please fill in all required fields (Teacher, Class, Subject, Date).");
    }

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
    } catch (error: any) { 
        Alert.alert("Save Error", error.response?.data?.message || 'Failed to save meeting.'); 
        console.error(error);
    }
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

  // Helper to display date nicely in the form input
  const getDisplayDate = () => {
      if (!formData.meeting_datetime) return 'Select Date & Time';
      // Handle both ISO and SQL string formats safely
      const d = new Date(formData.meeting_datetime.replace(' ', 'T')); 
      if (isNaN(d.getTime())) return formData.meeting_datetime;
      
      return d.toLocaleString('en-US', { 
          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true 
      });
  };

  if (isLoading) {
    return <View style={[styles.center, {backgroundColor: theme.background}]}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

  const dynamicStyles = StyleSheet.create({
      container: { flex: 1, backgroundColor: theme.background },
      headerCard: {
          backgroundColor: theme.cardBg,
          borderColor: theme.border,
          borderWidth: theme.isDark ? 1 : 0,
      },
      headerTitle: { color: theme.textMain },
      headerSubtitle: { color: theme.textSub },
      emptyText: { color: theme.textSub },
      modalContent: { backgroundColor: theme.cardBg },
      modalTitle: { color: theme.textMain },
      label: { color: theme.textMain },
      input: { 
          backgroundColor: theme.inputBg, 
          borderColor: theme.border, 
          color: theme.textMain 
      },
      pickerWrapper: {
        borderWidth: 1, 
        borderColor: theme.border, 
        borderRadius: 8, 
        marginBottom: 10, 
        backgroundColor: theme.inputBg,
        justifyContent: 'center',
        height: 50 
      }
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
        <View style={[styles.headerCard, dynamicStyles.headerCard]}>
            <View style={styles.headerLeft}>
                <View style={styles.headerIconContainer}>
                    <MaterialIcons name="groups" size={24} color={theme.primary} />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>PTM Manager</Text>
                    <Text style={[styles.headerSubtitle, dynamicStyles.headerSubtitle]}>Schedule & Review</Text>
                </View>
            </View>
            <TouchableOpacity style={[styles.headerBtn, {backgroundColor: theme.primary}]} onPress={() => handleOpenModal()}>
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
                        onJoin={handleJoinMeeting}
                    />
                </View>
            )}
            ListEmptyComponent={<Text style={[styles.emptyText, dynamicStyles.emptyText]}>No meetings found.</Text>}
            contentContainerStyle={{ paddingBottom: 20 }}
        />

        <Modal visible={isModalOpen} animationType="slide" transparent={true} onRequestClose={() => setIsModalOpen(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackdrop}>
                <TouchableOpacity style={styles.modalTouchable} activeOpacity={1} onPress={() => setIsModalOpen(false)}>
                    <TouchableOpacity activeOpacity={1} style={[styles.modalContent, dynamicStyles.modalContent]}>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 20}}>
                            <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>{editingMeeting ? "Edit Meeting" : "New Meeting"}</Text>
                            
                            <Text style={[styles.label, dynamicStyles.label]}>Teacher / Admin:</Text>
                            <View style={dynamicStyles.pickerWrapper}>
                                <Picker 
                                    selectedValue={formData.teacher_id} 
                                    onValueChange={itemValue => setFormData({...formData, teacher_id: itemValue})} 
                                    enabled={!editingMeeting}
                                    style={{color: theme.textMain}}
                                    dropdownIconColor={theme.textMain}
                                >
                                    <Picker.Item label="-- Select Person --" value="" color={theme.textSub} />
                                    {teachers.map(t => <Picker.Item key={t.id} label={t.full_name} value={t.id.toString()} color={theme.textMain} />)}
                                </Picker>
                            </View>

                            <Text style={[styles.label, dynamicStyles.label]}>Class:</Text>
                            <View style={dynamicStyles.pickerWrapper}>
                                <Picker 
                                    selectedValue={formData.class_group} 
                                    onValueChange={itemValue => setFormData({...formData, class_group: itemValue})} 
                                    enabled={!editingMeeting}
                                    style={{color: theme.textMain}}
                                    dropdownIconColor={theme.textMain}
                                >
                                    <Picker.Item label="-- Select Class --" value="" color={theme.textSub} />
                                    {classes.map(c => <Picker.Item key={c} label={c} value={c} color={theme.textMain} />)}
                                </Picker>
                            </View>

                            <Text style={[styles.label, dynamicStyles.label]}>Subject Focus:</Text>
                            <TextInput 
                                style={[styles.input, dynamicStyles.input]} 
                                placeholderTextColor={theme.textSub}
                                value={formData.subject_focus} 
                                onChangeText={text => setFormData({...formData, subject_focus: text})} 
                                placeholder="e.g., Math Performance" 
                                editable={!editingMeeting}
                            />
                            
                            <Text style={[styles.label, dynamicStyles.label]}>Date & Time:</Text>
                            <TouchableOpacity onPress={() => setPickerMode('date')} style={[styles.input, dynamicStyles.input]}>
                                <Text style={{ color: formData.meeting_datetime ? theme.textMain : theme.textSub, fontSize: 16 }}>
                                    {getDisplayDate()}
                                </Text>
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
                            
                            <Text style={[styles.label, dynamicStyles.label]}>Meeting Link (Optional):</Text>
                            <TextInput 
                                style={[styles.input, dynamicStyles.input]} 
                                placeholderTextColor={theme.textSub}
                                value={formData.meeting_link} 
                                onChangeText={text => setFormData({...formData, meeting_link: text})} 
                                placeholder="e.g., https://meet.google.com/xyz"
                            />
                            
                            <Text style={[styles.label, dynamicStyles.label]}>Notes:</Text>
                            <TextInput 
                                style={[styles.input, dynamicStyles.input, {height: 80, textAlignVertical: 'top'}]} 
                                multiline 
                                placeholderTextColor={theme.textSub}
                                value={formData.notes} 
                                onChangeText={text => setFormData({...formData, notes: text})} 
                                placeholder="Discussion points..."
                            />
                            
                            {editingMeeting && (
                                <>
                                    <Text style={[styles.label, dynamicStyles.label]}>Status:</Text>
                                    <View style={dynamicStyles.pickerWrapper}>
                                        <Picker 
                                            selectedValue={formData.status} 
                                            onValueChange={itemValue => setFormData({...formData, status: itemValue})}
                                            style={{color: theme.textMain}}
                                            dropdownIconColor={theme.textMain}
                                        >
                                            <Picker.Item label="Scheduled" value="Scheduled" color={theme.textMain} />
                                            <Picker.Item label="Completed" value="Completed" color={theme.textMain} />
                                        </Picker>
                                    </View>
                                </>
                            )}

                            <View style={styles.modalActions}>
                                <TouchableOpacity onPress={() => setIsModalOpen(false)} style={[styles.modalButton, styles.cancelButton]}>
                                    <Text style={{color: '#333'}}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleSave} style={[styles.modalButton, {backgroundColor: theme.success}]}>
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
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerCard: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '95%', 
        alignSelf: 'center',
        marginTop: 10,      
        marginBottom: 5,    
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
        backgroundColor: 'rgba(0, 128, 128, 0.1)', 
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 12 },
    headerBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    cardWrapper: { width: '100%', alignItems: 'center', marginBottom: -1 },
    emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' },
    modalTouchable: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalContent: { 
        borderRadius: 12, 
        padding: 20, 
        width: width * 0.9, 
        maxHeight: height * 0.85, 
        elevation: 5 
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 5, marginTop: 10 },
    input: { borderWidth: 1, padding: 10, borderRadius: 8, marginBottom: 10, minHeight: 45, justifyContent: 'center', fontSize: 16 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#eee' },
    modalButton: { paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, alignItems: 'center', minWidth: 100 },
    cancelButton: { backgroundColor: '#e0e0e0' },
    saveButtonText: { color: 'white', fontWeight: 'bold' }
});

export default TeacherAdminPTMScreen;