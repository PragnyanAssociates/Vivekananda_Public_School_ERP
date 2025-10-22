import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';

// --- Local Interfaces ---
interface Teacher {
  id: number;
  full_name: string;
  username: string;
}

// Extend Teacher interface for the marking state
interface TeacherMarking extends Teacher {
  status: 'P' | 'A' | 'L'; 
}
// --- End Local Interfaces ---

const API_BASE_URL = '/teacher-attendance'; // Base URL for the module (relative to your client's root)

const TeacherAttendanceMarkingScreen = () => {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<TeacherMarking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [attendanceDate, setAttendanceDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const fetchTeachers = useCallback(async () => {
    setIsLoading(true);
    try {
      // Endpoint 1: GET /api/teacher-attendance/teachers
      const response = await apiClient.get<Teacher[]>(`${API_BASE_URL}/teachers`);
      const initialTeachers: TeacherMarking[] = response.data.map(t => ({
        ...t,
        status: 'P', // Default to Present
      }));
      setTeachers(initialTeachers);
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to load teachers.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const handleStatusChange = (teacherId: number, status: 'P' | 'A' | 'L') => {
    setTeachers(prev =>
      prev.map(t => (t.id === teacherId ? { ...t, status } : t))
    );
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setAttendanceDate(selectedDate);
    }
  };

  const handleSubmitAttendance = async () => {
    if (!user || user.role !== 'admin') {
      return Alert.alert("Error", "Only Admins can submit attendance.");
    }
    
    const dateString = attendanceDate.toISOString().slice(0, 10);
    
    const attendanceData = teachers.map(t => ({
      teacher_id: t.id,
      status: t.status,
    }));

    if (attendanceData.length === 0) {
      return Alert.alert("Error", "No teachers selected.");
    }

    try {
      setIsLoading(true);
      // Endpoint 2: POST /api/teacher-attendance/mark
      await apiClient.post(`${API_BASE_URL}/mark`, {
        date: dateString,
        attendanceData,
      });

      Alert.alert("Success", "Attendance marked successfully!");
    } catch (error: any) {
      Alert.alert("Submission Error", error.response?.data?.message || 'Failed to submit attendance.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderTeacherItem = ({ item }: { item: TeacherMarking }) => (
    <View style={styles.teacherRow}>
      <View>
        <Text style={styles.teacherName}>{item.full_name}</Text>
        <Text style={styles.teacherId}>ID: {item.id}</Text>
      </View>
      <View style={styles.statusButtons}>
        {/* Present Button */}
        <TouchableOpacity
          style={[
            styles.statusButton,
            styles.presentButton,
            item.status === 'P' && styles.presentActive,
          ]}
          onPress={() => handleStatusChange(item.id, 'P')}
        >
          <Text style={item.status === 'P' ? styles.activeText : styles.presentText}>P</Text>
        </TouchableOpacity>
        {/* Absent Button */}
        <TouchableOpacity
          style={[
            styles.statusButton,
            styles.absentButton,
            item.status === 'A' && styles.absentActive,
          ]}
          onPress={() => handleStatusChange(item.id, 'A')}
        >
          <Text style={item.status === 'A' ? styles.activeText : styles.absentText}>A</Text>
        </TouchableOpacity>
        {/* Optional: Add Leave/Late button if 'L' status is required for marking */}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mark Teacher Attendance</Text>
        <View style={styles.dateSelector}>
          <Text style={styles.label}>Date:</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateInput}>
            <Text>{attendanceDate.toLocaleDateString()}</Text>
          </TouchableOpacity>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={attendanceDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}
      </View>

      <Text style={styles.listTitle}>Teacher List ({teachers.length})</Text>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#008080" /></View>
      ) : (
        <FlatList
          data={teachers}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTeacherItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No teacher records found.</Text>}
        />
      )}

      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitAttendance} disabled={isLoading}>
        <Text style={styles.submitBtnText}>SUBMIT ATTENDANCE</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#2d3748', marginBottom: 10 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 },
  label: { fontSize: 16, fontWeight: '500', color: '#555' },
  dateInput: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5, width: '60%', backgroundColor: '#fff' },
  listTitle: { fontSize: 16, fontWeight: 'bold', padding: 10, backgroundColor: '#e2e8f0', color: '#2d3748' },
  
  teacherRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: 'white' },
  teacherName: { fontSize: 16, fontWeight: '600' },
  teacherId: { fontSize: 12, color: '#777' },
  statusButtons: { flexDirection: 'row' },
  statusButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 10, borderWidth: 1.5 },
  
  presentButton: { borderColor: '#388e3c' },
  absentButton: { borderColor: '#d32f2f' },

  presentText: { color: '#388e3c', fontWeight: 'bold' },
  absentText: { color: '#d32f2f', fontWeight: 'bold' },

  presentActive: { backgroundColor: '#388e3c', borderColor: '#388e3c' },
  absentActive: { backgroundColor: '#d32f2f', borderColor: '#d32f2f' },
  activeText: { color: 'white', fontWeight: 'bold' },

  submitBtn: { backgroundColor: '#00796b', padding: 15, alignItems: 'center', position: 'absolute', bottom: 0, left: 0, right: 0 },
  submitBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 20, color: '#777' },
});

export default TeacherAttendanceMarkingScreen;