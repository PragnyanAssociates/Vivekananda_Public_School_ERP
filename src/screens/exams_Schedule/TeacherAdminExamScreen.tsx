import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity,
    Alert, Modal, TextInput, ScrollView, Platform, SafeAreaView,
    useColorScheme, StatusBar, Dimensions
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#E0E0E0',
    inputBg: '#FAFAFA',
    iconGrey: '#90A4AE',
    danger: '#E53935',
    success: '#43A047',
    blue: '#1E88E5',
    warning: '#F59E0B',
    headerIconBg: '#E0F2F1',
    placeholder: '#B0BEC5',
    modalOverlay: 'rgba(0,0,0,0.6)',
    divider: '#f0f2f5',
    tableHeaderBg: '#F8F9FA'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    iconGrey: '#757575',
    danger: '#EF5350',
    success: '#66BB6A',
    blue: '#42A5F5',
    warning: '#FFCA28',
    headerIconBg: '#333333',
    placeholder: '#616161',
    modalOverlay: 'rgba(255,255,255,0.1)',
    divider: '#2C2C2C',
    tableHeaderBg: '#252525'
};

// --- Reusable Detail View Component ---
const ScheduleTableView = ({ schedule, theme }: { schedule: any, theme: any }) => {
    const isExternal = schedule.exam_type === 'External';

    return (
        <View style={[styles.scheduleContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.scheduleHeaderCenter}>
                <Text style={[styles.scheduleTitle, { color: theme.textMain }]}>{schedule.title}</Text>
                {schedule.subtitle ? <Text style={[styles.scheduleSubtitle, { color: theme.textSub }]}>{schedule.subtitle}</Text> : null}

                <View style={[styles.badgeContainer, { backgroundColor: theme.headerIconBg }]}>
                    <Text style={[styles.badgeText, { color: theme.primary }]}>
                        {isExternal ? 'Govt Schedule' : 'School Exam (Internal)'}
                    </Text>
                </View>

                {schedule.created_by && (
                    <Text style={[styles.scheduledByText, { color: theme.textSub }]}>
                        Scheduled By: <Text style={{ fontWeight: 'bold', color: theme.textMain }}>{schedule.created_by}</Text>
                    </Text>
                )}
            </View>

            <View style={[styles.table, { borderColor: theme.border }]}>
                {/* Table Header */}
                <View style={[styles.tableRow, { backgroundColor: theme.tableHeaderBg, borderBottomColor: theme.border }]}>
                    {isExternal ? (
                        <>
                            <View style={[styles.tableCell, { flex: 3, borderRightColor: theme.border }]}><Text style={[styles.headerCellText, { color: theme.textMain }]}>Exam Name</Text></View>
                            <View style={[styles.tableCell, { flex: 2.5, borderRightColor: theme.border }]}><Text style={[styles.headerCellText, { color: theme.textMain }]}>From</Text></View>
                            <View style={[styles.tableCell, { flex: 2.5, borderRightWidth: 0 }]}><Text style={[styles.headerCellText, { color: theme.textMain }]}>To</Text></View>
                        </>
                    ) : (
                        <>
                            <View style={[styles.tableCell, { flex: 2.5, borderRightColor: theme.border }]}><Text style={[styles.headerCellText, { color: theme.textMain }]}>Date</Text></View>
                            <View style={[styles.tableCell, { flex: 3, borderRightColor: theme.border }]}><Text style={[styles.headerCellText, { color: theme.textMain }]}>Subject</Text></View>
                            <View style={[styles.tableCell, { flex: 3, borderRightColor: theme.border }]}><Text style={[styles.headerCellText, { color: theme.textMain }]}>Time</Text></View>
                            <View style={[styles.tableCell, { flex: 1.5, borderRightWidth: 0 }]}><Text style={[styles.headerCellText, { color: theme.textMain }]}>Block</Text></View>
                        </>
                    )}
                </View>

                {/* Table Rows */}
                {schedule.schedule_data.map((row: any, index: number) => {
                    if (row.type === 'special') {
                        return (
                            <View key={index} style={[styles.specialRow, { backgroundColor: theme.headerIconBg }]}>
                                <Text style={[styles.specialRowText, { color: theme.blue }]}>{row.mainText}</Text>
                                {row.subText ? <Text style={[styles.specialRowSubText, { color: theme.textSub }]}>{row.subText}</Text> : null}
                            </View>
                        );
                    }
                    const isLastRow = index === schedule.schedule_data.length - 1;
                    return (
                        <View key={index} style={[styles.tableRow, isLastRow && { borderBottomWidth: 0 }, { borderBottomColor: theme.border }]}>
                            <View style={[styles.tableCell, { flex: isExternal ? 3 : 2.5, borderRightColor: theme.border }]}><Text style={[styles.dataCellText, { color: theme.textMain }]}>{isExternal ? row.examName : row.date}</Text></View>
                            <View style={[styles.tableCell, { flex: isExternal ? 2.5 : 3, borderRightColor: theme.border }]}><Text style={[styles.dataCellText, { color: theme.textMain }]}>{isExternal ? row.fromDate : row.subject}</Text></View>
                            <View style={[styles.tableCell, { flex: isExternal ? 2.5 : 3, borderRightColor: isExternal ? 'transparent' : theme.border, borderRightWidth: isExternal ? 0 : 1 }]}><Text style={[styles.dataCellText, { color: theme.textMain }]}>{isExternal ? row.toDate : row.time}</Text></View>
                            {!isExternal && <View style={[styles.tableCell, { flex: 1.5, borderRightWidth: 0 }]}><Text style={[styles.dataCellText, { color: theme.textMain }]}>{row.block}</Text></View>}
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

// --- Main Component ---
const TeacherAdminExamScreen = () => {
    const { user } = useAuth();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const [view, setView] = useState('list');
    const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
    const [schedules, setSchedules] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Form State
    const [editingSchedule, setEditingSchedule] = useState<any>(null);
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [examType, setExamType] = useState('Internal');
    const [rows, setRows] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Data State
    const [studentClasses, setStudentClasses] = useState([]);
    const [activeTab, setActiveTab] = useState('Internal');
    const [selectedClassFilter, setSelectedClassFilter] = useState('All');

    // Picker State
    const [showPicker, setShowPicker] = useState(false);
    const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
    const [activeRowIndex, setActiveRowIndex] = useState(-1);
    const [activeField, setActiveField] = useState<string>('');
    const [tempDate, setTempDate] = useState(new Date());

    const defaultRowInternal = { type: 'exam', date: '', subject: '', startTime: '09:00', endTime: '12:00', block: '' };
    const defaultSpecialRow = { type: 'special', mainText: '', subText: '' };

    const fetchSchedules = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.get('/exam-schedules');
            setSchedules(response.data);
        } catch (e: any) { Alert.alert("Error", "Failed to fetch schedules."); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => {
        const fetchStudentClasses = async () => {
            try {
                const response = await apiClient.get('/student-classes');
                setStudentClasses(response.data);
            } catch (e) { console.error(e); }
        };
        if (view === 'list') fetchSchedules();
        fetchStudentClasses();
    }, [view, fetchSchedules]);

    const handleMenuPress = (item: any) => {
        Alert.alert(
            "Manage Schedule",
            `Options for "${item.title}"`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Edit", onPress: () => openEditModal(item) },
                { text: "Delete", style: "destructive", onPress: () => handleDelete(item) }
            ]
        );
    };

    const openView = async (scheduleItem: any) => {
        try {
            const response = await apiClient.get(`/exam-schedules/${scheduleItem.id}`);
            setSelectedSchedule(response.data);
            setView('detail');
        } catch (e: any) { Alert.alert("Error", "Could not fetch details."); }
    };

    const openEditModal = async (schedule: any) => {
        try {
            const response = await apiClient.get(`/exam-schedules/${schedule.id}`);
            const data = response.data;
            setEditingSchedule(data);
            setTitle(data.title);
            setSubtitle(data.subtitle || '');
            setSelectedClass(data.class_group);
            setExamType(data.exam_type || 'Internal');

            // Parse schedule data
            const parsedRows = (data.schedule_data || []).map((row: any) => {
                if (row.type === 'special') return row;
                if (row.time && row.time.includes(' - ')) {
                    const [start, end] = row.time.split(' - ');
                    return { ...row, startTime: start, endTime: end };
                }
                return { ...row, startTime: '09:00', endTime: '12:00' };
            });

            setRows(parsedRows);
            setIsModalVisible(true);
        } catch (e: any) { Alert.alert("Error", "Could not load schedule."); }
    };

    const openCreateModal = () => {
        setEditingSchedule(null);
        setTitle('');
        setSubtitle('');
        setSelectedClass('');
        setExamType('Internal');
        setRows([{ ...defaultRowInternal }]);
        setIsModalVisible(true);
    };

    const handleDelete = (schedule: any) => {
        Alert.alert("Confirm Delete", `Permanently delete "${schedule.title}"?`, [
            { text: "Cancel", style: 'cancel' },
            { text: "Delete", style: "destructive", onPress: async () => {
                    try {
                        await apiClient.delete(`/exam-schedules/${schedule.id}`);
                        fetchSchedules();
                    } catch (e: any) { Alert.alert("Error", "Failed to delete."); }
                }
            },
        ]);
    };

    // --- Date/Time Picker Logic ---
    const openPicker = (index: number, field: string, mode: 'date' | 'time') => {
        setActiveRowIndex(index);
        setActiveField(field);
        setPickerMode(mode);
        setTempDate(new Date());
        setShowPicker(true);
    };

    const onPickerChange = (event: any, selectedDate?: Date) => {
        setShowPicker(Platform.OS === 'ios');
        if (selectedDate && activeRowIndex !== -1) {
            setTempDate(selectedDate);
            if (Platform.OS === 'android') confirmPickerSelection(selectedDate);
        } else { setShowPicker(false); }
    };

    const confirmPickerSelection = (date: Date) => {
        const newRows = [...rows];
        const formatDate = (d: any) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
        const formatTime = (d: any) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

        if (activeField === 'date') newRows[activeRowIndex].date = formatDate(date);
        else if (activeField === 'fromDate') newRows[activeRowIndex].fromDate = formatDate(date);
        else if (activeField === 'toDate') newRows[activeRowIndex].toDate = formatDate(date);
        else {
            const parts = (newRows[activeRowIndex].time || " - ").split(' - ');
            if (activeField === 'startTime') newRows[activeRowIndex].startTime = formatTime(date);
            else if (activeField === 'endTime') newRows[activeRowIndex].endTime = formatTime(date);
            else if (activeField === 'start') newRows[activeRowIndex].time = `${formatTime(date)} - ${parts[1] || '...'}`;
            else newRows[activeRowIndex].time = `${parts[0] || '...'} - ${formatTime(date)}`;
        }
        setRows(newRows);
        setShowPicker(false);
    };

    const updateRow = (index: number, field: string, value: string) => {
        const newRows = [...rows];
        newRows[index][field] = value;
        setRows(newRows);
    };

    const removeRow = (index: number) => {
        const newRows = rows.filter((_, i) => i !== index);
        setRows(newRows);
    };

    const handleSave = async () => {
        if (!title || !selectedClass || rows.length === 0) return Alert.alert("Error", "Title and Class are required.");
        setIsSaving(true);

        const formattedRows = rows.map(r => {
            if (r.type === 'special') return r;
            const timeStr = r.time ? r.time : `${r.startTime || ''} - ${r.endTime || ''}`;
            return { ...r, time: timeStr };
        });

        const payload = {
            title, subtitle, class_group: selectedClass, exam_type: examType,
            schedule_data: formattedRows, created_by_id: user?.id
        };

        try {
            if (editingSchedule) await apiClient.put(`/exam-schedules/${editingSchedule.id}`, payload);
            else await apiClient.post('/exam-schedules', payload);
            setIsModalVisible(false); fetchSchedules();
        } catch (e: any) { Alert.alert("Error", "Failed to save."); }
        finally { setIsSaving(false); }
    };

    const filteredSchedules = schedules.filter(s =>
        (s.exam_type === activeTab) &&
        (selectedClassFilter === 'All' || s.class_group === selectedClassFilter)
    );

    if (view === 'detail' && selectedSchedule) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
                <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                    <TouchableOpacity onPress={() => setView('list')} style={{ padding: 4, marginRight: 10 }}>
                        <MaterialIcons name="arrow-back" size={24} color={theme.textMain} />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Exam Details</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>{selectedSchedule.class_group}</Text>
                    </View>
                </View>
                <ScrollView contentContainerStyle={{ padding: 15 }}>
                    <ScheduleTableView schedule={selectedSchedule} theme={theme} />
                </ScrollView>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

            {/* Header */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerContentWrapper}>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.headerIconBg }]}>
                        <MaterialIcons name="event-note" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Exam Manager</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Manage schedules</Text>
                    </View>
                </View>
                <TouchableOpacity style={[styles.headerBtn, { backgroundColor: theme.primary }]} onPress={openCreateModal}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.headerBtnText}>Add</Text>
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={[styles.tabContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'Internal' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]} onPress={() => setActiveTab('Internal')}>
                    <Text style={[styles.tabText, { color: activeTab === 'Internal' ? theme.primary : theme.textSub }]}>Exams</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'External' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]} onPress={() => setActiveTab('External')}>
                    <Text style={[styles.tabText, { color: activeTab === 'External' ? theme.primary : theme.textSub }]}>Govt Schedule</Text>
                </TouchableOpacity>
            </View>

            {/* Filter */}
            <View style={[styles.filterContainer, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
                <View style={[styles.pickerWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                    <Picker
                        selectedValue={selectedClassFilter}
                        onValueChange={(itemValue) => setSelectedClassFilter(itemValue)}
                        style={{ color: theme.textMain }}
                        dropdownIconColor={theme.textMain}
                    >
                        <Picker.Item label="All Classes" value="All" color={theme.textMain} />
                        {studentClasses.map((c, i) => <Picker.Item key={i} label={c} value={c} color={theme.textMain} />)}
                    </Picker>
                </View>
            </View>

            <FlatList
                data={filteredSchedules}
                keyExtractor={(item: any) => item.id.toString()}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        activeOpacity={0.9}
                        style={[styles.card, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}
                        onPress={() => openView(item)}
                    >
                        <View style={styles.cardContent}>
                            <Text style={[styles.cardTitle, { color: theme.textMain }]}>{item.title}</Text>
                            <Text style={[styles.cardSubtitle, { color: theme.textSub }]}>Class: {item.class_group}</Text>
                            {item.created_by && <Text style={[styles.scheduledBy, { color: theme.blue }]}>By: {item.created_by}</Text>}
                        </View>
                        <TouchableOpacity
                            onPress={() => handleMenuPress(item)}
                            style={styles.menuButton}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        >
                            <MaterialIcons name="more-vert" size={26} color={theme.iconGrey} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSub }]}>No schedules found.</Text>}
                onRefresh={fetchSchedules}
                refreshing={isLoading}
                contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 15 }}
            />

            {/* Modal */}
            <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} animationType="slide">
                <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: theme.textMain }]}>{editingSchedule ? 'Edit Schedule' : 'Create Schedule'}</Text>
                    </View>
                    <ScrollView style={styles.modalView} contentContainerStyle={{ paddingBottom: 40 }}>
                        <TextInput style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain }]} value={title} onChangeText={setTitle} placeholder="e.g., Final Term Exam" placeholderTextColor={theme.placeholder} />
                        <TextInput style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain }]} value={subtitle} onChangeText={setSubtitle} placeholder="Subtitle (e.g., 2025-2026)" placeholderTextColor={theme.placeholder} />

                        <View style={[styles.pickerContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                            <Picker selectedValue={selectedClass} onValueChange={setSelectedClass} style={{ color: theme.textMain }} dropdownIconColor={theme.textMain}>
                                <Picker.Item label="-- Select Class --" value="" color={theme.textMain} />
                                {studentClasses.map((c: any) => <Picker.Item key={c} label={c} value={c} color={theme.textMain} />)}
                            </Picker>
                        </View>

                        <View style={[styles.pickerContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                            <Picker selectedValue={examType} onValueChange={setExamType} style={{ color: theme.textMain }} dropdownIconColor={theme.textMain}>
                                <Picker.Item label="School Exam (Internal)" value="Internal" color={theme.textMain} />
                                <Picker.Item label="Govt Schedule (External)" value="External" color={theme.textMain} />
                            </Picker>
                        </View>

                        {/* Rows Editor */}
                        {rows.map((row, index) => (
                            <View key={index} style={[styles.rowEditor, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
                                {row.type === 'special' ? (
                                    // SPECIAL ROW LAYOUT
                                    <View style={styles.rowEditorContent}>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain, marginBottom: 5 }]}
                                            value={row.mainText} onChangeText={t => updateRow(index, 'mainText', t)} placeholder="Main Text (e.g. Holiday)" placeholderTextColor={theme.placeholder}
                                        />
                                        <TextInput
                                            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain }]}
                                            value={row.subText} onChangeText={t => updateRow(index, 'subText', t)} placeholder="Sub Text" placeholderTextColor={theme.placeholder}
                                        />
                                    </View>
                                ) : (
                                    // EXAM ROW LAYOUT
                                    <View style={styles.rowEditorContent}>
                                        {/* Row 1: Subject (Full Width) */}
                                        <View style={styles.inputRow}>
                                            <TextInput
                                                style={[styles.input, { flex: 1, backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain, marginBottom: 0 }]}
                                                value={row.subject} onChangeText={t => updateRow(index, 'subject', t)} placeholder="Subject" placeholderTextColor={theme.placeholder}
                                            />
                                        </View>

                                        {/* Row 2: Date and Block */}
                                        <View style={styles.inputRow}>
                                            <TouchableOpacity onPress={() => openPicker(index, 'date', 'date')} style={[styles.dateInput, { backgroundColor: theme.inputBg, borderColor: theme.border, flex: 1, marginRight: 8 }]}>
                                                <Text style={{ color: row.date ? theme.textMain : theme.placeholder, fontSize: 13 }}>{row.date || 'dd-mm-yyyy'}</Text>
                                                <MaterialIcons name="event" size={18} color={theme.textSub} />
                                            </TouchableOpacity>

                                            <TextInput
                                                style={[styles.input, { flex: 1, backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textMain, marginBottom: 0 }]}
                                                value={row.block} onChangeText={t => updateRow(index, 'block', t)} placeholder="Block" placeholderTextColor={theme.placeholder}
                                            />
                                        </View>

                                        {/* Row 3: Start Time and End Time */}
                                        <View style={styles.inputRow}>
                                            <TouchableOpacity onPress={() => openPicker(index, 'startTime', 'time')} style={[styles.timeInput, { backgroundColor: theme.inputBg, borderColor: theme.border, flex: 1, marginRight: 8 }]}>
                                                <Text style={{ color: row.startTime ? theme.textMain : theme.placeholder, fontSize: 13 }}>{row.startTime || '09:00'}</Text>
                                                <MaterialIcons name="schedule" size={16} color={theme.textSub} />
                                            </TouchableOpacity>

                                            <TouchableOpacity onPress={() => openPicker(index, 'endTime', 'time')} style={[styles.timeInput, { backgroundColor: theme.inputBg, borderColor: theme.border, flex: 1 }]}>
                                                <Text style={{ color: row.endTime ? theme.textMain : theme.placeholder, fontSize: 13 }}>{row.endTime || '12:00'}</Text>
                                                <MaterialIcons name="schedule" size={16} color={theme.textSub} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                                <TouchableOpacity onPress={() => removeRow(index)} style={styles.removeRowBtn}>
                                    <MaterialIcons name="close" size={20} color={theme.danger} />
                                </TouchableOpacity>
                            </View>
                        ))}

                        <View style={styles.addRowContainer}>
                            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#2563EB' }]} onPress={() => setRows([...rows, { ...defaultRowInternal }])}>
                                <Text style={styles.addBtnText}>+ Add Exam Row</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#F59E0B' }]} onPress={() => setRows([...rows, { ...defaultSpecialRow }])}>
                                <MaterialIcons name="event" size={16} color="#fff" style={{ marginRight: 4 }} />
                                <Text style={styles.addBtnText}>Add Special Row</Text>
                            </TouchableOpacity>
                        </View>

                        {/* --- FOOTER ACTIONS MODIFIED HERE --- */}
                        <View style={styles.footerActions}>
                            <TouchableOpacity style={[styles.footerBtn, { backgroundColor: theme.iconGrey }]} onPress={() => setIsModalVisible(false)}>
                                <Text style={styles.footerBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.footerBtn, { backgroundColor: theme.success }]} onPress={handleSave}>
                                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.footerBtnText}>Save Changes</Text>}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {showPicker && <DateTimePicker value={tempDate} mode={pickerMode} display="default" onChange={onPickerChange} />}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },

    // Header
    headerCard: { paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
    headerContentWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13, marginTop: 1 },
    headerBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    // Tabs
    tabContainer: { flexDirection: 'row', paddingHorizontal: 15, paddingTop: 5, borderBottomWidth: 1 },
    tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabText: { fontSize: 15, fontWeight: '600' },

    // Filter
    filterContainer: { paddingHorizontal: 15, paddingVertical: 10 },
    pickerWrapper: { borderWidth: 1, borderRadius: 8, height: 50, justifyContent: 'center' },

    // List Card
    card: { borderRadius: 12, marginBottom: 10, padding: 18, elevation: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
    cardContent: { flex: 1 },
    cardTitle: { fontSize: 17, fontWeight: 'bold' },
    cardSubtitle: { fontSize: 14, marginTop: 4 },
    scheduledBy: { fontSize: 12, marginTop: 4, fontWeight: '500' },
    menuButton: { padding: 8 },

    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16 },

    // Modal
    modalHeader: { paddingVertical: 20, alignItems: 'center' },
    modalView: { flex: 1, padding: 20 },
    modalTitle: { fontSize: 22, fontWeight: 'bold' },
    input: { borderWidth: 1, padding: 10, borderRadius: 8, marginBottom: 10, fontSize: 14, height: 45 },
    pickerContainer: { borderWidth: 1, borderRadius: 8, marginBottom: 10 },

    // Row Editor (Updated Layout)
    rowEditor: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, padding: 10, borderWidth: 1, borderRadius: 8 },
    rowEditorContent: { flex: 1 },
    inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    dateInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, padding: 10, borderRadius: 8, height: 45 },
    timeInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, padding: 10, borderRadius: 8, height: 45 },
    removeRowBtn: { padding: 5, marginLeft: 5, marginTop: 5 },

    // Add Buttons
    addRowContainer: { flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 30 },
    addBtn: { flex: 1, flexDirection: 'row', paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

    // Footer Actions (UPDATED FOR 50-50 LAYOUT)
    footerActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 15, marginTop: 10, marginBottom: 20 },
    footerBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', elevation: 2 },
    footerBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    // Schedule Detail View
    scheduleContainer: { borderRadius: 12, padding: 15, elevation: 2, borderWidth: 1 },
    scheduleHeaderCenter: { alignItems: 'center', marginBottom: 15 },
    scheduleTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 },
    scheduleSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 10 },
    badgeContainer: { borderRadius: 16, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 8 },
    badgeText: { fontSize: 13, fontWeight: 'bold' },
    scheduledByText: { fontSize: 12, marginTop: 5 },

    // Table
    table: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, alignItems: 'center', minHeight: 45 },
    tableCell: { paddingVertical: 10, paddingHorizontal: 5, borderRightWidth: 1, justifyContent: 'center', alignItems: 'center' },
    headerCellText: { fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
    dataCellText: { fontSize: 11, textAlign: 'center' },

    specialRow: { padding: 12, justifyContent: 'center', alignItems: 'center', margin: 10, borderRadius: 8 },
    specialRowText: { fontWeight: 'bold', fontSize: 14 },
    specialRowSubText: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
});

export default TeacherAdminExamScreen;