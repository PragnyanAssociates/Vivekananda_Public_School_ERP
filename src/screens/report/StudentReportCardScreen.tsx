/**
 * File: src/screens/report/StudentReportCardScreen.js
 * Purpose: Displays the final, formatted progress report for the logged-in student.
 * Fetches all necessary data from '/api/reports/my-report-card'.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, ActivityIndicator } from 'react-native';
import apiClient from '../../api/client'; // Adjust path if needed

const config = {
    subjects: {
        'LKG': ['All Subjects'], 'UKG': ['All Subjects'],
        '1st Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], '2nd Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
        '3rd Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], '4th Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
        '5th Class': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
        '6th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], '7th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
        '8th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], '9th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
        '10th Class': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    },
    exams: { 'FA-1': 'F.A. I', 'FA-2': 'F.A. II', 'SA-1': 'SA-1'}, // Shortened for better mobile view
    attendanceMonths: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']
};

const StudentReportCardScreen = () => {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const { data } = await apiClient.get('/reports/my-report-card');
                setReportData(processReportData(data));
            } catch (error) {
                console.error("Failed to fetch report card:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, []);

    const processReportData = (data) => {
        const marksBySubject = {};
        data.marks.forEach(mark => {
            if (!marksBySubject[mark.subject]) {
                marksBySubject[mark.subject] = {};
            }
            marksBySubject[mark.subject][mark.exam_type] = mark.marks_obtained;
        });

        const attendanceByMonth = {};
        const monthMap = {'June':'Jun', 'July':'Jul', 'August':'Aug', 'September':'Sep', 'October':'Oct', 'November':'Nov', 'December':'Dec', 'January':'Jan', 'February':'Feb', 'March':'Mar', 'April':'Apr', 'May':'May'};
        data.attendance.forEach(a => {
            const shortMonth = monthMap[a.month];
            if (shortMonth) {
                attendanceByMonth[shortMonth] = { working_days: a.working_days, present_days: a.present_days };
            }
        });

        return { ...data, marksBySubject, attendanceByMonth };
    };

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#0000ff" /></View>;
    }

    if (!reportData) {
        return <View style={styles.loaderContainer}><Text>No report card data available for this year.</Text></View>;
    }

    const { studentInfo, marksBySubject, attendanceByMonth, academicYear } = reportData;
    const subjectsForClass = config.subjects[studentInfo.class_group] || [];
    
    const calculateTotal = (subjectMarks) => {
        if (!subjectMarks) return 0;
        return Object.values(subjectMarks).reduce((acc, val) => acc + (parseInt(val, 10) || 0), 0);
    }
    
    let grandTotal = subjectsForClass.reduce((total, subject) => total + calculateTotal(marksBySubject[subject]), 0);

    return (
        <ScrollView style={styles.container}>
            <View style={styles.card}>
                <View style={styles.header}>
                    {/* Use a placeholder or your actual asset */}
                    <Image source={{ uri: 'https://via.placeholder.com/80' }} style={styles.logo} /> 
                    <View style={styles.schoolInfo}>
                        <Text style={styles.schoolName}>VIVEKANANDA PUBLIC SCHOOL</Text>
                        <Text style={styles.schoolAddress}>Hyderabad - 500072</Text>
                    </View>
                </View>
                <Text style={styles.title}>PROGRESS CARD ({academicYear})</Text>
                
                <View style={styles.studentDetailsContainer}>
                    <View style={styles.studentInfo}>
                        <Text style={styles.detailText}><Text style={styles.detailLabel}>Name:</Text> {studentInfo.full_name}</Text>
                        <Text style={styles.detailText}><Text style={styles.detailLabel}>Class:</Text> {studentInfo.class_group}</Text>
                        <Text style={styles.detailText}><Text style={styles.detailLabel}>Roll No:</Text> {studentInfo.roll_no || studentInfo.username}</Text>
                    </View>
                    {studentInfo.profile_image_url && 
                        <Image source={{ uri: `http://YOUR_SERVER_IP:PORT${studentInfo.profile_image_url}` }} style={styles.profilePic} />
                    }
                </View>

                <Text style={styles.sectionTitle}>Academic Performance</Text>
                <View style={styles.table}>
                    <View style={styles.tableRowHeader}>
                        <Text style={[styles.tableCell, styles.subjectCell, styles.headerText]}>Subjects</Text>
                        {Object.values(config.exams).map(exam => <Text key={exam} style={[styles.tableCell, styles.headerText]}>{exam}</Text>)}
                        <Text style={[styles.tableCell, styles.headerText]}>Total</Text>
                    </View>
                    {subjectsForClass.map(subject => (
                        <View key={subject} style={styles.tableRow}>
                            <Text style={[styles.tableCell, styles.subjectCell]}>{subject}</Text>
                            {Object.keys(config.exams).map(examKey => <Text key={examKey} style={styles.tableCell}>{marksBySubject[subject]?.[examKey] ?? '-'}</Text>)}
                            <Text style={[styles.tableCell, styles.totalCell]}>{calculateTotal(marksBySubject[subject])}</Text>
                        </View>
                    ))}
                     <View style={styles.tableRowHeader}>
                        <Text style={[styles.tableCell, styles.subjectCell, styles.headerText]}>Grand Total</Text>
                        <Text style={[styles.tableCell, {flex: Object.keys(config.exams).length + 1}, styles.totalCell, styles.headerText]}>{grandTotal}</Text>
                    </View>
                </View>
                
                <Text style={styles.sectionTitle}>Attendance Particulars</Text>
                 <View style={styles.table}>
                     <View style={styles.tableRowHeader}>
                        <Text style={[styles.tableCell, styles.headerText, {flex: 2}]}>Month</Text>
                        {config.attendanceMonths.map(h => <Text key={h} style={[styles.tableCell, styles.headerText]}>{h}</Text>)}
                     </View>
                      <View style={styles.tableRow}>
                        <Text style={[styles.tableCell, styles.headerText, {flex: 2, textAlign: 'left'}]}>Working Days</Text>
                        {config.attendanceMonths.map(m => <Text key={m} style={styles.tableCell}>{attendanceByMonth[m]?.working_days ?? '-'}</Text>)}
                     </View>
                     <View style={styles.tableRow}>
                        <Text style={[styles.tableCell, styles.headerText, {flex: 2, textAlign: 'left'}]}>Present Days</Text>
                        {config.attendanceMonths.map(m => <Text key={m} style={styles.tableCell}>{attendanceByMonth[m]?.present_days ?? '-'}</Text>)}
                     </View>
                 </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { flex: 1, backgroundColor: '#e9ecef', padding: 10 },
    card: { backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 4, borderColor: '#0056b3', padding: 15, shadowColor: "#000", shadowOffset: { width: 0, height: 2, }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderBottomWidth: 2, borderColor: '#0056b3', paddingBottom: 10 },
    logo: { width: 60, height: 60, marginRight: 15, borderRadius: 30 },
    schoolInfo: { flex: 1 },
    schoolName: { fontSize: 18, fontWeight: 'bold', color: '#004085' },
    schoolAddress: { fontSize: 12, color: '#555' },
    title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, textDecorationLine: 'underline', color: '#004085' },
    studentDetailsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, padding: 10, backgroundColor: '#f8f9fa', borderRadius: 8 },
    studentInfo: { flex: 1 },
    detailLabel: { fontWeight: 'bold' },
    detailText: { fontSize: 14, marginBottom: 4 },
    profilePic: { width: 80, height: 80, borderRadius: 8, borderWidth: 2, borderColor: '#dee2e6' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10, color: '#333' },
    table: { borderWidth: 1, borderColor: '#dee2e6' },
    tableRowHeader: { flexDirection: 'row', backgroundColor: '#e0e9f5' },
    tableRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#dee2e6' },
    tableCell: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, textAlign: 'center', borderWidth: 0.5, borderColor: '#dee2e6', fontSize: 12 },
    subjectCell: { flex: 2.5, textAlign: 'left', paddingLeft: 8 },
    headerText: { fontWeight: 'bold', color: '#004085' },
    totalCell: { fontWeight: 'bold', backgroundColor: '#f8f9fa' },
});

export default StudentReportCardScreen;