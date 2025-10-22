import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';

// --- Local Interfaces ---
interface AttendanceRecord {
  date: string; // YYYY-MM-DD
  status: 'P' | 'A' | 'L';
}

interface AttendanceReport {
  stats: {
    overallPercentage: string;
    daysPresent: number;
    daysAbsent: number;
  };
  detailedHistory: AttendanceRecord[];
}
// --- End Local Interfaces ---

const API_BASE_URL = '/teacher-attendance';

const TeacherAttendanceReportScreen = () => {
  const { user } = useAuth();
  const TEACHER_ID = user?.id?.toString(); // Get logged-in user ID
  
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'overall'>('overall');
  const [dateContext, setDateContext] = useState(new Date()); // Used for Daily/Monthly filtering
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Memoize the API parameters based on current state
  const apiParams = useMemo(() => {
    const params: { period: string; targetDate?: string; targetMonth?: string } = { period };
    const dateString = dateContext.toISOString().slice(0, 10);

    if (period === 'daily') {
      params.targetDate = dateString;
    } else if (period === 'monthly') {
      params.targetMonth = dateString.slice(0, 7); // YYYY-MM
    }
    return params;
  }, [period, dateContext]);

  const fetchReport = useCallback(async () => {
    if (!TEACHER_ID) return;
    setIsLoading(true);
    
    try {
      // Endpoint 3: GET /api/teacher-attendance/report/:teacherId
      const response = await apiClient.get<AttendanceReport>(`${API_BASE_URL}/report/${TEACHER_ID}`, { params: apiParams });
      setReport(response.data);
    } catch (error: any) {
      console.error("Attendance Report Error:", error);
      Alert.alert("Error", error.response?.data?.message || "Failed to load attendance report.");
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [TEACHER_ID, apiParams]);

  useEffect(() => {
    // Initial fetch when component mounts or params change
    fetchReport();
  }, [fetchReport]);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDateContext(selectedDate);
    }
  };

  const openDatePicker = () => {
    setShowDatePicker(true);
  }

  const getHeaderContext = () => {
    const dateStr = dateContext.toISOString().slice(0, 10);
    if (period === 'daily') return `Showing for: ${dateStr}`;
    if (period === 'monthly') return `Showing for: ${dateStr.slice(0, 7)}`;
    return 'Overall History';
  };

  const renderAttendanceItem = ({ item }: { item: AttendanceRecord }) => {
    const statusText = item.status === 'P' ? 'Present' : (item.status === 'A' ? 'Absent' : 'Leave/Late');
    
    let statusStyle = styles.statusA;
    if (item.status === 'P') statusStyle = styles.statusP;

    return (
      <View style={styles.historyItem}>
        <Text style={styles.historyDate}>{item.date}</Text>
        <Text style={[styles.historyStatus, statusStyle]}>
          {statusText}
        </Text>
      </View>
    );
  };

  if (TEACHER_ID === undefined) {
    return <View style={styles.center}><Text style={styles.errorText}>User not logged in or ID missing.</Text></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Attendance Report</Text>
        <Text style={styles.headerContext}>{getHeaderContext()}</Text>
      </View>

      <View style={styles.tabs}>
        <TabButton title="Daily" currentPeriod={period} targetPeriod="daily" onPress={setPeriod} />
        <TabButton title="Monthly" currentPeriod={period} targetPeriod="monthly" onPress={setPeriod} />
        <TabButton title="Overall" currentPeriod={period} targetPeriod="overall" onPress={setPeriod} />
      </View>
      
      {period !== 'overall' && (
        <View style={styles.datePickerContainer}>
            <TouchableOpacity onPress={openDatePicker} style={styles.datePickerButton}>
                <Text>📅 Select {period === 'daily' ? 'Date' : 'Month'}</Text>
            </TouchableOpacity>
        </View>
      )}

      {showDatePicker && (
        <DateTimePicker
          value={dateContext}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
      
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#00796b" /></View>
      ) : (
        <ScrollView contentContainerStyle={{flexGrow: 1}}>
        <View style={styles.summaryStats}>
          <StatBox title="Overall" value={`${report?.stats.overallPercentage || '0.0'}%`} color="#00796b" />
          <StatBox title="Days Present" value={report?.stats.daysPresent || 0} color="#388e3c" />
          <StatBox title="Days Absent" value={report?.stats.daysAbsent || 0} color="#d32f2f" />
        </View>

        <Text style={styles.detailedTitle}>Detailed History ({period.charAt(0).toUpperCase() + period.slice(1)})</Text>
        
        <FlatList
          data={report?.detailedHistory || []}
          keyExtractor={(item, index) => `${item.date}-${index}`}
          renderItem={renderAttendanceItem}
          ListEmptyComponent={<Text style={styles.emptyText}>No records found for this period.</Text>}
          scrollEnabled={false} // Allow parent ScrollView to handle scrolling
          contentContainerStyle={{paddingHorizontal: 20}}
        />
        </ScrollView>
      )}
    </View>
  );
};

// Reusable components
const TabButton = ({ title, currentPeriod, targetPeriod, onPress }: { title: string, currentPeriod: string, targetPeriod: string, onPress: (period: any) => void }) => (
  <TouchableOpacity
    style={[styles.tabButton, currentPeriod === targetPeriod && styles.tabActive]}
    onPress={() => onPress(targetPeriod)}
  >
    <Text style={[styles.tabText, currentPeriod === targetPeriod && styles.tabActiveText]}>
      {title}
    </Text>
  </TouchableOpacity>
);

const StatBox = ({ title, value, color }: { title: string, value: string | number, color: string }) => (
  <View style={styles.statBox}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
  </View>
);


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: 'red', fontSize: 16, textAlign: 'center' },
  header: { padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  headerContext: { fontSize: 14, color: '#777', marginTop: 5 },

  tabs: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'white' },
  tabButton: { flex: 1, paddingVertical: 15, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#00796b' },
  tabText: { textAlign: 'center', color: '#555', fontWeight: '500' },
  tabActiveText: { color: '#00796b', fontWeight: '600' },

  datePickerContainer: { paddingHorizontal: 20, paddingVertical: 10, alignItems: 'flex-end' },
  datePickerButton: { padding: 8, borderWidth: 1, borderColor: '#ccc', borderRadius: 4, backgroundColor: 'white' },

  summaryStats: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee' },
  statBox: { alignItems: 'center', width: '30%' },
  statValue: { fontSize: 28, fontWeight: '700' },
  statTitle: { fontSize: 12, color: '#777', textTransform: 'uppercase', marginTop: 5 },

  detailedTitle: { padding: 15, fontSize: 16, fontWeight: 'bold', backgroundColor: '#e2e8f0', color: '#2d3748', borderTopWidth: 1, borderTopColor: '#eee' },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  historyDate: { fontSize: 15, color: '#555' },
  historyStatus: { fontSize: 15, fontWeight: '600' },
  statusP: { color: '#388e3c' },
  statusA: { color: '#d32f2f' },
  emptyText: { textAlign: 'center', paddingVertical: 50, color: '#999', fontStyle: 'italic' },
});

export default TeacherAttendanceReportScreen;