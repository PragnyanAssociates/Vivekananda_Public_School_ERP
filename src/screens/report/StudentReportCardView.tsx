// 📂 File: src/screens/reports/StudentReportCardView.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext'; // Assuming you have this
import apiClient from '../../api/client'; // Assuming you have this

// --- Constants ---
const SUBJECTS_BY_CLASS: { [key: string]: string[] } = {
    'LKG': ['All subjects'], 'UKG': ['All subjects'],
    'Class 1': ['Telugu', 'English', 'Hindi', 'EVS', 'Math'],'Class 2': ['Telugu', 'English', 'Hindi', 'EVS', 'Math'],'Class 3': ['Telugu', 'English', 'Hindi', 'EVS', 'Math'],'Class 4': ['Telugu', 'English', 'Hindi', 'EVS', 'Math'],'Class 5': ['Telugu', 'English', 'Hindi', 'EVS', 'Math'],
    'Class 6': ['Telugu', 'English', 'Hindi', 'Math', 'Science', 'Social'],'Class 7': ['Telugu', 'English', 'Hindi', 'Math', 'Science', 'Social'],'Class 8': ['Telugu', 'English', 'Hindi', 'Math', 'Science', 'Social'],'Class 9': ['Telugu', 'English', 'Hindi', 'Math', 'Science', 'Social'],'Class 10': ['Telugu', 'English', 'Hindi', 'Math', 'Science', 'Social'],
};
const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
const FA_COLUMNS: { name: string; at: string; ut: string }[] = [
    { name: 'F.A. I', at: 'Assignment 1', ut: 'Unit Test 1' }, { name: 'F.A. II', at: 'Assignment 2', ut: 'Unit Test 2' },
    { name: 'F.A. III', at: 'Assignment 3', ut: 'Unit Test 3' }, { name: 'F.A. IV', at: 'Assignment 4', ut: 'Unit Test 4' },
];

// --- Interfaces ---
interface StudentInfo { fullName: string; rollNo: string; classGroup: string; }
interface Mark { subject: string; exam_type: string; marks_obtained: number | null; }
interface Attendance { month: string; working_days: number | null; present_days: number | null; }
interface ReportCardData { studentInfo: any; marks: Mark[]; attendance: Attendance[]; }

// --- Reusable Components ---
const ScreenHeader = ({ icon, title, subtitle }) => (
  <View style={styles.headerCard}>
    <View style={styles.headerContent}>
      <View style={styles.headerIconContainer}>
        <MaterialIcons name={icon} size={28} color={styles.primaryColor.color} />
      </View>
      <View style={styles.headerTextContainer}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>
    </View>
  </View>
);

const StudentReportCardView = () => {
    const { user, isLoading: isAuthLoading } = useAuth();
    const [reportData, setReportData] = useState<ReportCardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReportCard = async () => {
            if (isAuthLoading || !user) return;
            try {
                const response = await apiClient.get('/reports/my-report-card');
                setReportData(response.data);
            } catch (error: any) {
                Alert.alert("Error", error.response?.data?.message || "Could not load your report card.");
            } finally {
                setLoading(false);
            }
        };
        fetchReportCard();
    }, [user, isAuthLoading]);

    const processedMarks = useMemo(() => {
        if (!reportData) return {};
        return reportData.marks.reduce((acc, mark) => {
            if (!acc[mark.subject]) acc[mark.subject] = {};
            acc[mark.subject][mark.exam_type] = mark.marks_obtained;
            return acc;
        }, {} as Record<string, Record<string, number | null>>);
    }, [reportData]);

    const processedAttendance = useMemo(() => {
        if (!reportData) return {};
        const monthMap: Record<string, any> = {};
        MONTHS.forEach(month => {
            const key = month.toLowerCase();
            const data = reportData.attendance.find(a => a.month.toLowerCase().startsWith(key));
            monthMap[month] = data || { working_days: null, present_days: null };
        });
        return monthMap;
    }, [reportData]);


    if (loading || isAuthLoading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={styles.primaryColor.color} /></View>;
    }

    if (!reportData?.studentInfo) {
        return (
            <View style={styles.fullScreenContainer}>
                <ScreenHeader icon="description" title="Progress Card" subtitle="Your academic performance record" />
                <View style={styles.centered}>
                    <Text style={styles.errorText}>Your report card is not yet available.</Text>
                </View>
            </View>
        );
    }
    
    const { studentInfo } = reportData;
    const subjects = SUBJECTS_BY_CLASS[studentInfo.class_group] || [];
    const getMark = (subject: string, exam: string) => processedMarks[subject]?.[exam] ?? '';
    const calculateTotal = (val1: any, val2: any) => {
        const num1 = parseFloat(val1); const num2 = parseFloat(val2);
        return (!isNaN(num1) && !isNaN(num2)) ? num1 + num2 : '';
    };

    return (
        <View style={styles.fullScreenContainer}>
            <ScreenHeader icon="description" title="Progress Card" subtitle="Your academic performance record" />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.card}>
                    <View style={styles.schoolHeader}>
                        <View style={styles.logoPlaceholder}><Text style={styles.logoText}>LOGO</Text></View>
                        <View style={styles.schoolDetails}>
                            <Text style={styles.schoolName}>VIVEKANANDA PUBLIC SCHOOL</Text>
                            <Text style={styles.schoolAddress}>Hyderabad - 500072</Text>
                        </View>
                    </View>
                    <View style={styles.studentInfoContainer}>
                         <Text style={styles.infoText}><Text style={styles.infoLabel}>Name:</Text> {studentInfo.full_name}</Text>
                         <Text style={styles.infoText}><Text style={styles.infoLabel}>Class:</Text> {studentInfo.class_group}</Text>
                         <Text style={styles.infoText}><Text style={styles.infoLabel}>Roll No:</Text> {studentInfo.roll_no}</Text>
                         <Text style={styles.infoText}><Text style={styles.infoLabel}>Year:</Text> 2023-2024</Text>
                    </View>
                    
                    {/* Marks Table */}
                    <Text style={styles.sectionTitle}>Academic Performance</Text>
                    <ScrollView horizontal>
                        <View>
                            <View style={[styles.tableRow, styles.tableHeader]}>
                                <Text style={[styles.cell, styles.subjectCell, styles.headerText]}>Subject</Text>
                                {FA_COLUMNS.map(fa => <Text key={fa.name} style={[styles.cell, styles.faCell, styles.headerText]}>{fa.name}</Text>)}
                                <Text style={[styles.cell, styles.saCell, styles.headerText]}>SA 1</Text>
                                <Text style={[styles.cell, styles.saCell, styles.headerText]}>SA 2</Text>
                            </View>
                            <View style={[styles.tableRow, styles.tableHeader]}>
                                <Text style={[styles.cell, styles.subjectCell, styles.headerText]}></Text>
                                {FA_COLUMNS.map(fa => (<View key={fa.name} style={styles.faSubHeader}><Text style={[styles.subCell, styles.headerText]}>AT</Text><Text style={[styles.subCell, styles.headerText]}>UT</Text><Text style={[styles.subCell, styles.headerText]}>Total</Text></View>))}
                                <Text style={[styles.cell, styles.saCell, styles.headerText]}></Text>
                                <Text style={[styles.cell, styles.saCell, styles.headerText]}></Text>
                            </View>

                            {subjects.map(subject => (
                                <View key={subject} style={styles.tableRow}>
                                    <Text style={[styles.cell, styles.subjectCell]}>{subject}</Text>
                                    {FA_COLUMNS.map(fa => {
                                        const at = getMark(subject, fa.at); const ut = getMark(subject, fa.ut);
                                        return (<View key={fa.name} style={styles.faSubHeader}><Text style={styles.subCell}>{at}</Text><Text style={styles.subCell}>{ut}</Text><Text style={[styles.subCell, styles.totalCell]}>{calculateTotal(at, ut)}</Text></View>)
                                    })}
                                    <Text style={[styles.cell, styles.saCell]}>{getMark(subject, 'SA 1')}</Text>
                                    <Text style={[styles.cell, styles.saCell]}>{getMark(subject, 'SA 2')}</Text>
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    {/* Attendance Table */}
                    <Text style={styles.sectionTitle}>Attendance Particulars</Text>
                     <View>
                        <View style={[styles.tableRow, styles.tableHeader]}>
                            <Text style={[styles.attCell, styles.attHeaderCell, styles.headerText]}>Month</Text>
                            {MONTHS.map(m => <Text key={m} style={[styles.attCell, styles.headerText]}>{m}</Text>)}
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={[styles.attCell, styles.attHeaderCell]}>Working Days</Text>
                            {MONTHS.map(m => <Text key={m} style={styles.attCell}>{processedAttendance[m]?.working_days ?? '-'}</Text>)}
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={[styles.attCell, styles.attHeaderCell]}>Present Days</Text>
                            {MONTHS.map(m => <Text key={m} style={styles.attCell}>{processedAttendance[m]?.present_days ?? '-'}</Text>)}
                        </View>
                     </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Teacher's Signature</Text>
                        <Text style={styles.footerText}>Principal's Signature</Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    primaryColor: { color: '#008080' },
    fullScreenContainer: { flex: 1, backgroundColor: '#f0f4f7' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    errorText: { fontSize: 16, color: '#555', textAlign: 'center' },
    scrollContent: { padding: 10, },
    headerCard: { backgroundColor: '#fff', padding: 15, marginHorizontal: 10, marginTop: 10, borderRadius: 10, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
    headerContent: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: { backgroundColor: '#e0f2f1', borderRadius: 25, width: 50, height: 50, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    headerTextContainer: { flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    headerSubtitle: { fontSize: 14, color: '#555', marginTop: 2 },
    card: { backgroundColor: '#fff', borderRadius: 10, padding: 15, elevation: 2, },
    schoolHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    logoPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#ddd', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    logoText: { fontWeight: 'bold', color: '#555' },
    schoolDetails: { flex: 1 },
    schoolName: { fontSize: 18, fontWeight: 'bold', color: '#003366' },
    schoolAddress: { fontSize: 12, color: '#555' },
    studentInfoContainer: { paddingVertical: 15, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    infoText: { fontSize: 14, color: '#333', width: '48%', marginBottom: 5 },
    infoLabel: { fontWeight: 'bold' },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#008080', marginTop: 20, marginBottom: 10, borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 5 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee' },
    tableHeader: { backgroundColor: '#f8f9fa' },
    headerText: { fontWeight: 'bold', color: '#333' },
    cell: { paddingVertical: 10, paddingHorizontal: 5, textAlign: 'center', borderWidth: 1, borderColor: '#eee' },
    subjectCell: { width: 100, textAlign: 'left', paddingLeft: 8 },
    faCell: { width: 120 },
    saCell: { width: 60 },
    faSubHeader: { flexDirection: 'row', width: 120, },
    subCell: { width: 40, paddingVertical: 10, textAlign: 'center', borderWidth: 1, borderColor: '#eee' },
    totalCell: { fontWeight: 'bold' },
    attCell: { width: 55, paddingVertical: 8, textAlign: 'center', borderWidth: 1, borderColor: '#eee'},
    attHeaderCell: { width: 100, fontWeight: 'bold' },
    footer: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 20, marginTop: 20, borderTopWidth: 1, borderTopColor: '#ddd' },
    footerText: { fontSize: 14, fontWeight: 'bold', color: '#555' },
});

export default StudentReportCardView;