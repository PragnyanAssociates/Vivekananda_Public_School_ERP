import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput, ScrollView } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

// --- Reusable Components ---
const defaultRow = { date: '', subject: '', time: '', block: '' };
const defaultSpecialRow = { type: 'special', mainText: 'Teacher Work Day', subText: '(No school for students)' };

const ScheduleTableView = ({ schedule }: { schedule: any }) => (
    <View style={styles.scheduleContainer}>
        <Text style={styles.scheduleTitle}>{schedule.title}</Text>
        {schedule.exam_type && <Text style={styles.examTypeLabel}>{schedule.exam_type} Exam</Text>}
        <Text style={styles.scheduleSubtitle}>{schedule.subtitle}</Text>
        <View style={styles.table}>
            <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, styles.dateCol]}>Date</Text>
                <Text style={[styles.headerCell, styles.subjectCol]}>Subject</Text>
                <Text style={[styles.headerCell, styles.timeCol]}>Time</Text>
                <Text style={[styles.headerCell, styles.blockCol]}>Block</Text>
            </View>
            {schedule.schedule_data.map((row: any, index: number) => {
                if (row.type === 'special') {
                    return (
                        <View key={index} style={styles.specialRow}>
                            <Text style={styles.specialRowText}>{row.mainText}</Text>
                            {row.subText && <Text style={styles.specialRowSubText}>{row.subText}</Text>}
                        </View>
                    );
                }
                const rowStyle = index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd;
                return (
                    <View key={index} style={[styles.tableRow, rowStyle]}>
                        <Text style={[styles.dataCell, styles.dateCol]}>{row.date}</Text>
                        <Text style={[styles.dataCell, styles.subjectCol]}>{row.subject}</Text>
                        <Text style={[styles.dataCell, styles.timeCol]}>{row.time}</Text>
                        <Text style={[styles.dataCell, styles.blockCol]}>{row.block}</Text>
                    </View>
                );
            })}
        </View>
    </View>
);

// --- Main Component ---
const TeacherAdminExamScreen = () => {
    const { user } = useAuth();
    const [view, setView] = useState('list');
    const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
    const [schedules, setSchedules] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<any>(null);
    // Form State
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [examType, setExamType] = useState('Internal'); // ★ NEW: State for exam type
    const [rows, setRows] = useState<any[]>([defaultRow]);
    const [isSaving, setIsSaving] = useState(false);
    const [studentClasses, setStudentClasses] = useState([]);
    // ★ NEW: State for tabs
    const [activeTab, setActiveTab] = useState('Internal');

    const fetchSchedules = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.get('/exam-schedules');
            setSchedules(response.data);
        } catch (e: any) { Alert.alert("Error", e.response?.data?.message || "Failed to fetch schedules."); }
        finally { setIsLoading(false); }
    }, []);

    const fetchStudentClasses = async () => {
        try {
            const response = await apiClient.get('/student-classes');
            setStudentClasses(response.data);
        } catch (e) { console.error("Error fetching student classes:", e); }
    };

    useEffect(() => {
        if (view === 'list') {
            fetchSchedules();
        }
        fetchStudentClasses();
    }, [view]);

    const viewDetails = async (scheduleItem: any) => {
        try {
            const response = await apiClient.get(`/exam-schedules/${scheduleItem.id}`);
            setSelectedSchedule(response.data);
            setView('detail');
        } catch(e: any) {
            Alert.alert("Error", e.response?.data?.message || "Could not fetch schedule details");
        }
    };

    const backToList = () => {
        setSelectedSchedule(null);
        setView('list');
    };

    const handleRowChange = (index: number, field: string, value: string) => {
        const newRows = [...rows];
        newRows[index][field] = value;
        setRows(newRows);
    };
    const addRow = (type = 'normal') => setRows(prev => [...prev, type === 'special' ? defaultSpecialRow : { ...defaultRow }]);
    const removeRow = (index: number) => setRows(prev => prev.filter((_, i) => i !== index));

    const resetForm = () => {
        setEditingSchedule(null);
        setTitle('');
        setSubtitle('');
        setSelectedClass('');
        setExamType('Internal'); // ★ NEW: Reset exam type
        setRows([defaultRow]);
    };

    const openCreateModal = () => {
        resetForm();
        setIsModalVisible(true);
    };

    const openEditModal = async (schedule: any) => {
        try {
            const response = await apiClient.get(`/exam-schedules/${schedule.id}`);
            const data = response.data;
            setEditingSchedule(data);
            setTitle(data.title);
            setSubtitle(data.subtitle);
            setSelectedClass(data.class_group);
            setExamType(data.exam_type || 'Internal'); // ★ NEW: Set exam type for editing
            setRows(data.schedule_data || [defaultRow]);
            setIsModalVisible(true);
        } catch (e: any) { Alert.alert("Error", "Could not load schedule for editing."); }
    };

    const handleDelete = (schedule: any) => {
        Alert.alert("Confirm Delete", `Delete "${schedule.title}" for ${schedule.class_group}?`, [
            { text: "Cancel", style: 'cancel' },
            { text: "Delete", style: 'destructive', onPress: async () => {
                try {
                    await apiClient.delete(`/exam-schedules/${schedule.id}`);
                    Alert.alert("Success", "Schedule deleted.");
                    fetchSchedules();
                } catch(e: any) { Alert.alert("Error", e.response?.data?.message || e.message); }
            }},
        ]);
    };

    const handleSave = async () => {
        if (!title || !selectedClass || rows.length === 0) {
            return Alert.alert("Validation Error", "Title, Class, and at least one row are required.");
        }
        setIsSaving(true);
        // ★ MODIFIED: Add exam_type to payload
        const payload = { title, subtitle, class_group: selectedClass, exam_type: examType, schedule_data: rows, created_by_id: user?.id };
        try {
            if (editingSchedule) {
                await apiClient.put(`/exam-schedules/${editingSchedule.id}`, payload);
            } else {
                await apiClient.post('/exam-schedules', payload);
            }
            Alert.alert("Success", `Schedule ${editingSchedule ? 'updated' : 'created'}!`);
            setIsModalVisible(false);
            fetchSchedules();
        } catch (e: any) { Alert.alert("Error", e.response?.data?.message || e.message); }
        finally { setIsSaving(false); }
    };

    // ★ NEW: Filter schedules based on the active tab
    const filteredSchedules = schedules.filter(schedule => schedule.exam_type === activeTab);

    if (view === 'detail' && selectedSchedule) {
        return (
            <ScrollView style={styles.container}>
                <TouchableOpacity onPress={backToList} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color="#333" />
                    <Text style={styles.backButtonText}>Back to List</Text>
                </TouchableOpacity>
                <ScheduleTableView schedule={selectedSchedule} />
            </ScrollView>
        )
    }

    return (
        <View style={styles.container}>
            {/* ★ NEW: Tab Container */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'Internal' && styles.tabButtonActive]}
                    onPress={() => setActiveTab('Internal')}
                >
                    <Text style={[styles.tabText, activeTab === 'Internal' && styles.tabTextActive]}>Internal Exams</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'External' && styles.tabButtonActive]}
                    onPress={() => setActiveTab('External')}
                >
                    <Text style={[styles.tabText, activeTab === 'External' && styles.tabTextActive]}>External Exams</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredSchedules} // ★ MODIFIED: Use filtered data
                keyExtractor={(item: any) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.cardContent}>
                            <Text style={styles.cardTitle}>{item.title}</Text>
                            <Text style={styles.cardSubtitle}>Class: {item.class_group}</Text>
                            <Text style={styles.cardCreator}>By: {item.created_by}</Text>
                        </View>
                        <View style={styles.cardActions}>
                             <TouchableOpacity style={styles.actionButton} onPress={() => viewDetails(item)}>
                                <MaterialIcons name="visibility" size={22} color="#546e7a" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(item)}>
                                <MaterialIcons name="edit" size={22} color="#0288d1" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item)}>
                                <MaterialIcons name="delete" size={22} color="#d32f2f" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                // ★ MODIFIED: Updated empty text message
                ListEmptyComponent={!isLoading && <Text style={styles.emptyText}>No {activeTab.toLowerCase()} schedules created yet.</Text>}
                onRefresh={fetchSchedules}
                refreshing={isLoading}
                contentContainerStyle={{ paddingBottom: 80 }}
            />
            <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
                <MaterialIcons name="add" size={28} color="#fff" />
            </TouchableOpacity>

            <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} animationType="slide">
                <ScrollView style={styles.modalView} contentContainerStyle={{ paddingBottom: 50 }}>
                    <Text style={styles.modalTitle}>{editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}</Text>
                    <Text style={styles.label}>Title</Text>
                    <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g., Final Term Exam" />
                    <Text style={styles.label}>Subtitle</Text>
                    <TextInput style={styles.input} value={subtitle} onChangeText={setSubtitle} placeholder="e.g., March 2025" />
                    <Text style={styles.label}>Class</Text>
                    <View style={styles.pickerContainer}><Picker selectedValue={selectedClass} onValueChange={itemValue => setSelectedClass(itemValue)}><Picker.Item label="-- Select a class --" value="" />{studentClasses.map((c: string) => <Picker.Item key={c} label={c} value={c} />)}</Picker></View>
                    
                    {/* ★ NEW: Exam Type Picker */}
                    <Text style={styles.label}>Exam Type</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={examType} onValueChange={itemValue => setExamType(itemValue)}>
                            <Picker.Item label="Internal Exam" value="Internal" />
                            <Picker.Item label="External Exam" value="External" />
                        </Picker>
                    </View>

                    <Text style={styles.label}>Schedule Rows</Text>
                    {rows.map((row, index) => (
                        <View key={index} style={styles.rowEditor}>
                            <TouchableOpacity style={styles.deleteRowBtn} onPress={() => removeRow(index)}><MaterialIcons name="close" size={18} color="#fff" /></TouchableOpacity>
                            {row.type === 'special' ? (
                                <><TextInput style={styles.input} value={row.mainText} onChangeText={val => handleRowChange(index, 'mainText', val)} placeholder="Special Text" /><TextInput style={styles.input} value={row.subText} onChangeText={val => handleRowChange(index, 'subText', val)} placeholder="Sub-text (Optional)" /></>
                            ) : (
                                <View style={{flexDirection: 'row', flexWrap: 'wrap'}}><TextInput style={[styles.input, styles.halfInput]} value={row.date} onChangeText={val => handleRowChange(index, 'date', val)} placeholder="Date" /><TextInput style={[styles.input, styles.halfInput]} value={row.subject} onChangeText={val => handleRowChange(index, 'subject', val)} placeholder="Subject" /><TextInput style={[styles.input, styles.halfInput]} value={row.time} onChangeText={val => handleRowChange(index, 'time', val)} placeholder="Time" /><TextInput style={[styles.input, styles.halfInput]} value={row.block} onChangeText={val => handleRowChange(index, 'block', val)} placeholder="Block" /></View>
                            )}
                        </View>
                    ))}
                    <View style={styles.addRowButtons}><TouchableOpacity style={[styles.modalBtn, styles.addBtn]} onPress={() => addRow('normal')}><Text style={styles.btnText}>Add Exam Row</Text></TouchableOpacity><TouchableOpacity style={[styles.modalBtn, styles.addSpecialBtn]} onPress={() => addRow('special')}><Text style={styles.btnText}>Add Special Row</Text></TouchableOpacity></View>
                    <View style={styles.modalActions}><TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsModalVisible(false)}><Text style={styles.btnText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleSave} disabled={isSaving}>{isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{editingSchedule ? 'Save Changes' : 'Create'}</Text>}</TouchableOpacity></View>
                </ScrollView>
            </Modal>
        </View>
    );
};

// ★ ADDED NEW STYLES AND MODIFIED EXISTING ONES
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f8' },
    // Tab styles
    tabContainer: { flexDirection: 'row', paddingHorizontal: 15, paddingTop: 15, backgroundColor: '#f4f6f8', },
    tabButton: { flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', alignItems: 'center' },
    tabButtonActive: { borderBottomColor: '#1e88e5' },
    tabText: { fontSize: 16, color: '#546e7a', fontWeight: '500' },
    tabTextActive: { color: '#1e88e5', fontWeight: 'bold' },

    backButton: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    backButtonText: { marginLeft: 5, fontSize: 18, color: '#333', fontWeight: '500' },
    card: { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 15, marginVertical: 8, padding: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardContent: { flex: 1 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#37474f' },
    cardSubtitle: { fontSize: 14, color: '#546e7a', marginTop: 4 },
    cardCreator: { fontSize: 13, color: '#78909c', fontStyle: 'italic', marginTop: 8 },
    cardActions: { flexDirection: 'row', alignItems: 'center' },
    actionButton: { padding: 8, marginLeft: 8 },
    fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#1e88e5', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 4 },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#777' },
    modalView: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    label: { fontSize: 16, fontWeight: '500', color: '#444', marginBottom: 5, marginLeft: 5, marginTop: 10 },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 5 },
    halfInput: { width: '48%', margin: '1%'},
    pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, backgroundColor: '#fff', marginBottom: 5 },
    rowEditor: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 10, backgroundColor: '#fafafa', paddingTop: 30 },
    deleteRowBtn: { position: 'absolute', top: 0, right: 0, backgroundColor: '#ef5350', width: 28, height: 28, borderTopRightRadius: 8, justifyContent: 'center', alignItems: 'center' },
    addRowButtons: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 10 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 30 },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 5, elevation: 2 },
    addBtn: { backgroundColor: '#0288d1' },
    addSpecialBtn: { backgroundColor: '#ffa000' },
    saveBtn: { backgroundColor: '#388e3c' },
    cancelBtn: { backgroundColor: '#6c757d' },
    btnText: { color: '#fff', fontWeight: 'bold' },
    scheduleContainer: { backgroundColor: '#ffffff', borderRadius: 12, margin: 15, marginTop: 0, padding: 15, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }},
    scheduleTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#212121' },
    examTypeLabel: { textAlign: 'center', color: '#FF6347', fontSize: 14, fontWeight: 'bold', marginTop: 4, backgroundColor: '#ffebee', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 15, alignSelf: 'center' },
    scheduleSubtitle: { fontSize: 16, color: '#757575', textAlign: 'center', marginBottom: 20, marginTop: 4 },
    table: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f7f9fc', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
    headerCell: { paddingVertical: 14, paddingHorizontal: 6, fontWeight: 'bold', textAlign: 'center', color: '#455a64', fontSize: 14 },
    tableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eef2f5' },
    tableRowEven: { backgroundColor: '#ffffff' },
    tableRowOdd: { backgroundColor: '#f7f9fc' },
    dataCell: { paddingVertical: 16, paddingHorizontal: 6, textAlign: 'center', color: '#37474f', fontSize: 14 },
    dateCol: { flex: 2.5 },
    subjectCol: { flex: 3 },
    timeCol: { flex: 2 },
    blockCol: { flex: 1 },
    specialRow: { padding: 20, backgroundColor: '#e3f2fd', justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
    specialRowText: { fontWeight: 'bold', fontSize: 15, color: '#1e88e5' },
    specialRowSubText: { fontSize: 13, color: '#64b5f6', fontStyle: 'italic', marginTop: 4 },
});

export default TeacherAdminExamScreen;