import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import TeacherReportView from './TeacherReportView'; // Import the new reusable component

const TeacherAttendanceReportScreen = () => {
  const { user } = useAuth();
  const TEACHER_ID = user?.id?.toString();

  if (!TEACHER_ID) {
    return <View style={styles.center}><Text style={styles.errorText}>User not logged in or ID missing.</Text></View>;
  }

  // Use the reusable viewer component
  return (
    <TeacherReportView 
        teacherId={TEACHER_ID} 
        headerTitle="My Attendance Report"
        onBack={undefined} // No back button needed for the user's main report
    />
  );
};

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: 'red', fontSize: 16, textAlign: 'center' },
});

export default TeacherAttendanceReportScreen;