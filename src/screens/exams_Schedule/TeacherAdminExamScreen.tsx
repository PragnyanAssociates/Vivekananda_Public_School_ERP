import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput, ScrollView, Platform } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

// --- Reusable Components ---
const defaultRowInternal = { date: '', subject: '', time: '09:00 AM - 12:00 PM', block: '' };
const defaultRowExternal = { examName: '', fromDate: '', toDate: '' };
const defaultSpecialRow = { type: 'special', mainText: 'Teacher Work Day', subText: '(No school for students)' };

// ★ FINAL VERSION: ScheduleTableView
const ScheduleTableView = ({ schedule }: { schedule: any }) => {
    const isExternal = schedule.exam_type === 'External';

    return (
        <View style={styles.scheduleContainer}>
            <Text style={styles.scheduleTitle}>{schedule.title}</Text>
            {schedule.exam_type && (
                <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>
                        {isExternal ? 'Govt Schedule' : 'School Exam'}
                    </Text>
                </View>
            )}
            <Text style={styles.scheduleSubtitle}>{schedule.subtitle}</Text>

            <View style={styles.table}>
                {/* --- HEADER --- */}
                <View style={styles.tableRow}>
                    {isExternal ? (
                        <>
                            <View style={[styles.tableCell, styles.headerCell, { flex: 3 }]}>
                                <Text style={styles.headerCellText}>Exam Name</Text>
                            </View>
                            <View style={[styles.tableCell, styles.headerCell, { flex: 1.5 }]}>
                                <Text style={styles.headerCellText}>Class</Text>
                            </View>
                            <View style={[styles.tableCell, styles.headerCell, { flex: 2.5 }]}>
                                <Text style={styles.headerCellText}>From Date</Text>
                            </View>
                            <View style={[styles.tableCell, styles.headerCell, { flex: 2.5, borderRightWidth: 0 }]}>
                                <Text style={styles.headerCellText}>To Date</Text>
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={[styles.tableCell, styles.headerCell, { flex: 2.5 }]}>
                                <Text style={styles.headerCellText}>Date</Text>
                            </View>
                            <View style={[styles.tableCell, styles.headerCell, { flex: 3 }]}>
                                <Text style={styles.headerCellText}>Subject</Text>
                            </View>
                            <View style={[styles.tableCell, styles.headerCell, { flex: 3.5 }]}>
                                <Text style={styles.headerCellText}>Time</Text>
                            </View>
                            <View style={[styles.tableCell, styles.headerCell, { flex: 1.5, borderRightWidth: 0 }]}>
                                <Text style={styles.headerCellText}>Block</Text>
                            </View>
                        </>
                    )}
                </View>

                {/* --- BODY --- */}
                {schedule.schedule_data.map((row: any, index: number) => {
                    if (row.type === 'special') {
                        return (
                            <View key={index} style={styles.specialRow}>
                                <Text style={styles.specialRowText}>{row.mainText}</Text>
                                {row.subText && <Text style={styles.specialRowSubText}>{row.subText}</Text>}
                            </View>
                        );
                    }
                    const isLastRow = index === schedule.schedule_data.length - 1;
                    
                    if (isExternal) {
                        return (
                             <View key={index} style={[styles.tableRow, isLastRow && { borderBottomWidth: 0 }]}>
                                <View style={[styles.tableCell, { flex: 3 }]}>
                                    <Text style={[styles.dataCellText, {fontWeight: 'bold'}]}>{row.examName || '-'}</Text>
                                </View>
                                <View style={[styles.tableCell, { flex: 1.5 }]}>
                                    <Text style={styles.dataCellText}>{schedule.class_group}</Text>
                                </View>
                                <View style={[styles.tableCell, { flex: 2.5 }]}>
                                    <Text style={styles.dataCellText}>{row.fromDate || '—'}</Text>
                                </View>
                                <View style={[styles.tableCell, { flex: 2.5, borderRightWidth: 0 }]}>
                                    <Text style={styles.dataCellText}>{row.toDate || '—'}</Text>
                                </View>
                            </View>
                        );
                    } else {
                        return (
                            <View key={index} style={[styles.tableRow, isLastRow && { borderBottomWidth: 0 }]}>
                                <View style={[styles.tableCell, { flex: 2.5 }]}>
                                    <Text style={styles.dataCellText}>{row.date}</Text>
                                </View>
                                <View style={[styles.tableCell, { flex: 3 }]}>
                                    <Text style={styles.dataCellText}>{row.subject}</Text>
                                </View>
                                <View style={[styles.tableCell, { flex: 3.5 }]}>
                                    <Text style={styles.dataCellText}>{row.time}</Text>
                                </View>
                                <View style={[styles.tableCell, { flex: 1.5, borderRightWidth: 0 }]}>
                                    <Text style={styles.dataCellText}>{row.block}</Text>
                                </View>
                            </View>
                        );
                    }
                })}
            </View>
        </View>
    );
};

// --- Main Component ---
const TeacherAdminExamScreen = ({ navigation }: any) => {
    const { user } = useAuth();
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
    const [rows, setRows] = useState<any[]>([defaultRowInternal]);
    const [isSaving, setIsSaving] = useState(false);
    
    // Data State
    const [studentClasses, setStudentClasses] = useState([]);
    const [activeTab, setActiveTab] = useState('Internal'); 
    const [selectedClassFilter, setSelectedClassFilter] = useState('All');

    // --- PICKER STATE ---
    const [showPicker, setShowPicker] = useState(false);
    const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
    const [activeRowIndex, setActiveRowIndex] = useState(-1);
    const [activeField, setActiveField] = useState<'date' | 'start' | 'end' | 'fromDate' | 'toDate'>('date'); 
    const [tempDate, setTempDate] = useState(new Date());

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

    const addRow = (type = 'normal') => {
        const rowTemplate = examType === 'Internal' ? defaultRowInternal : defaultRowExternal;
        setRows(prev => [...prev, type === 'special' ? defaultSpecialRow : { ...rowTemplate }]);
    };

    const removeRow = (index: number) => setRows(prev => prev.filter((_, i) => i !== index));

    const resetForm = () => {
        setEditingSchedule(null); setTitle(''); setSubtitle(''); setSelectedClass('');
        setExamType('Internal'); setRows([defaultRowInternal]);
    };

    const openCreateModal = () => {
        resetForm();
        setIsModalVisible(true);
    };

    const openEditModal = async (schedule: any) => {
        try {
            const response = await apiClient.get(`/exam-schedules/${schedule.id}`);
            const data = response.data;
            setEditingSchedule(data); setTitle(data.title); setSubtitle(data.subtitle);
            setSelectedClass(data.class_group); setExamType(data.exam_type || 'Internal');
            setRows(data.schedule_data || (data.exam_type === 'External' ? [defaultRowExternal] : [defaultRowInternal])); 
            setIsModalVisible(true);
        } catch (e: any) { Alert.alert("Error", "Could not load schedule for editing."); }
    };

    const handleExamTypeChange = (type: string) => {
        setExamType(type);
        if (!editingSchedule || editingSchedule.exam_type !== type) {
            setRows([type === 'Internal' ? defaultRowInternal : defaultRowExternal]);
        } else if (editingSchedule && editingSchedule.exam_type === type) {
            setRows(editingSchedule.schedule_data);
        }
    }

    const handleDelete = (schedule: any) => {
        Alert.alert("Confirm Delete", `Delete "${schedule.title}" for ${schedule.class_group}?`, [
            { text: "Cancel", style: 'cancel' },
            { text: "Delete", style: 'destructive', onPress: async () => {
                try {
                    await apiClient.delete(`/exam-schedules/${schedule.id}`);
                    Alert.alert("Success", "Schedule deleted."); fetchSchedules();
                } catch(e: any) { Alert.alert("Error", e.response?.data?.message || e.message); }
            }},
        ]);
    };

    // --- UNIFIED PICKER LOGIC ---
    const openPicker = (index: number, field: 'date' | 'start' | 'end' | 'fromDate' | 'toDate') => {
        setActiveRowIndex(index);
        setActiveField(field);
        setTempDate(new Date()); 
        if (field === 'start' || field === 'end') {
            setPickerMode('time');
        } else {
            setPickerMode('date');
        }
        setShowPicker(true);
    };

    const onPickerChange = (event: any, selectedDate?: Date) => {
        setShowPicker(Platform.OS === 'ios'); 
        if (selectedDate && activeRowIndex !== -1) {
            setTempDate(selectedDate);
            if (Platform.OS === 'android') {
                confirmPickerSelection(selectedDate);
            }
        } else {
            setShowPicker(false);
        }
    };

    const confirmPickerSelection = (date: Date) => {
        const newRows = [...rows];
        const formatDate = (d: Date) => {
            const day = d.getDate().toString().padStart(2, '0');
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        };
        const formatTime = (d: Date) => {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        };

        if (activeField === 'date') newRows[activeRowIndex].date = formatDate(date);
        else if (activeField === 'fromDate') newRows[activeRowIndex].fromDate = formatDate(date);
        else if (activeField === 'toDate') newRows[activeRowIndex].toDate = formatDate(date);
        else {
            const formattedTime = formatTime(date);
            const currentStr = newRows[activeRowIndex].time || " - ";
            const [currentStart, currentEnd] = currentStr.includes(' - ') ? currentStr.split(' - ') : ["", ""];
            let newTimeStr = "";
            if (activeField === 'start') newTimeStr = `${formattedTime} - ${currentEnd || '...'}`;
            else newTimeStr = `${currentStart || '...'} - ${formattedTime}`;
            newRows[activeRowIndex].time = newTimeStr;
        }

        setRows(newRows);
        setShowPicker(false);
    };

    const handleSave = async () => {
        if (!title || !selectedClass || rows.length === 0) {
            return Alert.alert("Validation Error", "Title, Class, and at least one row are required.");
        }
        setIsSaving(true);
        const payload = { title, subtitle, class_group: selectedClass, exam_type: examType, schedule_data: rows, created_by_id: user?.id };
        try {
            if (editingSchedule) {
                await apiClient.put(`/exam-schedules/${editingSchedule.id}`, payload);
            } else {
                await apiClient.post('/exam-schedules', payload);
            }
            Alert.alert("Success", `Schedule ${editingSchedule ? 'updated' : 'created'}!`);
            setIsModalVisible(false); fetchSchedules();
        } catch (e: any) { Alert.alert("Error", e.response?.data?.message || e.message); }
        finally { setIsSaving(false); }
    };

    const filteredSchedules = schedules.filter(schedule => {
        const matchesType = schedule.exam_type === activeTab;
        const matchesClass = selectedClassFilter === 'All' || schedule.class_group === selectedClassFilter;
        return matchesType && matchesClass;
    });

    if (view === 'detail' && selectedSchedule) {
        return (
            <ScrollView style={styles.container}>
                {/* Header Card (Back Variant) */}
                <View style={styles.headerCard}>
                    <View style={styles.headerContentWrapper}>
                        <TouchableOpacity onPress={backToList} style={{marginRight: 10, padding: 4}}>
                            <MaterialIcons name="arrow-back" size={24} color="#333333" />
                        </TouchableOpacity>
                        <View style={styles.headerIconContainer}>
                            <MaterialIcons name="event-note" size={24} color="#008080" />
                        </View>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.headerTitle}>Exam Details</Text>
                            <Text style={styles.headerSubtitle}>{selectedSchedule.class_group} • {selectedSchedule.title}</Text>
                        </View>
                    </View>
                </View>
                <ScheduleTableView schedule={selectedSchedule} />
            </ScrollView>
        )
    }

    return (
        <View style={styles.container}>
            {/* --- Header Card with Add Button --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerContentWrapper}>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="event-note" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Exam Manager</Text>
                        <Text style={styles.headerSubtitle}>Manage schedules & exams</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.headerBtn} onPress={openCreateModal}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.headerBtnText}>Add</Text>
                </TouchableOpacity>
            </View>

            {/* Top Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'Internal' && styles.tabButtonActive]} onPress={() => setActiveTab('Internal')}>
                    <Text style={[styles.tabText, activeTab === 'Internal' && styles.tabTextActive]}>Exams</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'External' && styles.tabButtonActive]} onPress={() => setActiveTab('External')}>
                    <Text style={[styles.tabText, activeTab === 'External' && styles.tabTextActive]}>Govt Schedule</Text>
                </TouchableOpacity>
            </View>

            {/* List View Class Filter */}
            <View style={styles.filterContainer}>
                <View style={styles.pickerWrapper}>
                    <Picker
                        selectedValue={selectedClassFilter}
                        onValueChange={(itemValue) => setSelectedClassFilter(itemValue)}
                        mode="dropdown"
                        style={styles.pickerStyle}
                        dropdownIconColor="#546e7a"
                    >
                        <Picker.Item label="Select a Class... (All)" value="All" color="#546e7a" />
                        {studentClasses.map((cls, index) => (
                             <Picker.Item key={index} label={cls} value={cls} color="#000" />
                        ))}
                    </Picker>
                </View>
            </View>

            <FlatList
                data={filteredSchedules}
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
                ListEmptyComponent={!isLoading && <Text style={styles.emptyText}>No {activeTab === 'Internal' ? 'exams' : 'govt schedules'} found.</Text>}
                onRefresh={fetchSchedules} refreshing={isLoading} contentContainerStyle={{ paddingBottom: 80 }}
            />

            {/* Create/Edit Modal */}
            <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} animationType="slide">
                <ScrollView style={styles.modalView} contentContainerStyle={{ paddingBottom: 50 }}>
                    <Text style={styles.modalTitle}>{editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}</Text>
                    
                    <Text style={styles.label}>Title</Text>
                    <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder={examType === 'External' ? "e.g., Annual Plan" : "e.g., Final Term Exam"} />
                    
                    <Text style={styles.label}>Subtitle</Text>
                    <TextInput style={styles.input} value={subtitle} onChangeText={setSubtitle} placeholder="e.g., 2025-2026" />
                    
                    <Text style={styles.label}>Class</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={selectedClass} onValueChange={itemValue => setSelectedClass(itemValue)}>
                            <Picker.Item label="-- Select a class --" value="" />
                            <Picker.Item label="All Classes" value="All Classes" />
                            {studentClasses.map((c: string) => <Picker.Item key={c} label={c} value={c} />)}
                        </Picker>
                    </View>
                    
                    <Text style={styles.label}>Exam Type</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={examType} onValueChange={itemValue => handleExamTypeChange(itemValue)}>
                            <Picker.Item label="School Exam" value="Internal" />
                            <Picker.Item label="Govt Schedule" value="External" />
                        </Picker>
                    </View>
                    
                    <Text style={styles.label}>Schedule Rows</Text>
                    {rows.map((row, index) => {
                        const timeParts = row.time ? row.time.split(' - ') : ['', ''];
                        const fromTime = timeParts[0] || "Start Time";
                        const toTime = timeParts[1] || "End Time";

                        return (
                            <View key={index} style={styles.rowEditor}>
                                <TouchableOpacity style={styles.deleteRowBtn} onPress={() => removeRow(index)}>
                                    <MaterialIcons name="close" size={18} color="#fff" />
                                </TouchableOpacity>
                                
                                {row.type === 'special' ? (
                                    <>
                                        <TextInput style={styles.input} value={row.mainText} onChangeText={val => handleRowChange(index, 'mainText', val)} placeholder="Special Text" />
                                        <TextInput style={styles.input} value={row.subText} onChangeText={val => handleRowChange(index, 'subText', val)} placeholder="Sub-text (Optional)" />
                                    </>
                                ) : (
                                    <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
                                        {examType === 'External' ? (
                                            <>
                                                <TextInput 
                                                    style={[styles.input, {width: '100%'}]} 
                                                    value={row.examName} 
                                                    onChangeText={val => handleRowChange(index, 'examName', val)} 
                                                    placeholder="Exam Name (e.g. FA-1)" 
                                                />
                                                <TouchableOpacity style={[styles.input, styles.halfInput, styles.iconInput]} onPress={() => openPicker(index, 'fromDate')}>
                                                    <Text style={row.fromDate ? styles.valueText : styles.placeholderText}>{row.fromDate || "From Date"}</Text>
                                                    <MaterialIcons name="event" size={18} color="#777" />
                                                </TouchableOpacity>
                                                <TouchableOpacity style={[styles.input, styles.halfInput, styles.iconInput]} onPress={() => openPicker(index, 'toDate')}>
                                                    <Text style={row.toDate ? styles.valueText : styles.placeholderText}>{row.toDate || "To Date"}</Text>
                                                    <MaterialIcons name="event" size={18} color="#777" />
                                                </TouchableOpacity>
                                            </>
                                        ) : (
                                            <>
                                                <TouchableOpacity style={[styles.input, styles.halfInput, styles.iconInput]} onPress={() => openPicker(index, 'date')}>
                                                    <Text style={row.date ? styles.valueText : styles.placeholderText}>{row.date || "Date (DD/MM)"}</Text>
                                                    <MaterialIcons name="event" size={18} color="#777" />
                                                </TouchableOpacity>

                                                <TextInput style={[styles.input, styles.halfInput]} value={row.subject} onChangeText={val => handleRowChange(index, 'subject', val)} placeholder="Subject" />
                                                
                                                <TouchableOpacity style={[styles.input, styles.halfInput, styles.iconInput]} onPress={() => openPicker(index, 'start')}>
                                                    <Text style={fromTime === "Start Time" ? styles.placeholderText : styles.valueText}>{fromTime}</Text>
                                                    <MaterialIcons name="access-time" size={18} color="#777" />
                                                </TouchableOpacity>
                                                
                                                <TouchableOpacity style={[styles.input, styles.halfInput, styles.iconInput]} onPress={() => openPicker(index, 'end')}>
                                                     <Text style={toTime === "End Time" ? styles.placeholderText : styles.valueText}>{toTime}</Text>
                                                     <MaterialIcons name="access-time" size={18} color="#777" />
                                                </TouchableOpacity>

                                                <TextInput style={[styles.input, styles.halfInput]} value={row.block} onChangeText={val => handleRowChange(index, 'block', val)} placeholder="Block" />
                                            </>
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                    
                    <View style={styles.addRowButtons}>
                        <TouchableOpacity style={[styles.modalBtn, styles.addBtn]} onPress={() => addRow('normal')}><Text style={styles.btnText}>Add Exam Row</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.modalBtn, styles.addSpecialBtn]} onPress={() => addRow('special')}><Text style={styles.btnText}>Add Special Row</Text></TouchableOpacity>
                    </View>
                    
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsModalVisible(false)}><Text style={styles.btnText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleSave} disabled={isSaving}>
                            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{editingSchedule ? 'Save Changes' : 'Create'}</Text>}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </Modal>

            {/* Native Date/Time Picker */}
            {showPicker && (
                <DateTimePicker
                    value={tempDate}
                    mode={pickerMode} 
                    is24Hour={false}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onPickerChange}
                />
            )}
        </View>
    );
};

// ★ FINAL STYLESHEET
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F5F8' }, // Matching Background
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 15,
        paddingVertical: 10,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerContentWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    headerIconContainer: {
        backgroundColor: '#E0F2F1', // Teal bg
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: {
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333333',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666666',
        marginTop: 1,
    },
    headerBtn: {
        backgroundColor: '#10b981', // Green Pill Button
        paddingVertical: 6, 
        paddingHorizontal: 12,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 10,
    },
    headerBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    // ----------------------------

    tabContainer: { flexDirection: 'row', paddingHorizontal: 15, paddingTop: 15, backgroundColor: '#fff', elevation: 2 },
    tabButton: { flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', alignItems: 'center' },
    tabButtonActive: { borderBottomColor: '#1e88e5' },
    tabText: { fontSize: 16, color: '#546e7a', fontWeight: '500' },
    tabTextActive: { color: '#1e88e5', fontWeight: 'bold' },
    
    // Filter
    filterContainer: { backgroundColor: '#fff', padding: 15, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
    pickerWrapper: { borderWidth: 1, borderColor: '#cfd8dc', borderRadius: 8, backgroundColor: '#fcfcfc', height: 50, justifyContent: 'center' },
    pickerStyle: { width: '100%', color: '#333' },

    // General UI
    card: { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 15, marginVertical: 8, padding: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardContent: { flex: 1 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#37474f' },
    cardSubtitle: { fontSize: 14, color: '#546e7a', marginTop: 4 },
    cardCreator: { fontSize: 13, color: '#78909c', fontStyle: 'italic', marginTop: 8 },
    cardActions: { flexDirection: 'row', alignItems: 'center' },
    actionButton: { padding: 8, marginLeft: 8 },
    
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#777' },
    
    // Modal Styles
    modalView: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    label: { fontSize: 16, fontWeight: '500', color: '#444', marginBottom: 5, marginLeft: 5, marginTop: 10 },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 5, justifyContent: 'center' },
    halfInput: { width: '48%', margin: '1%'},
    iconInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    placeholderText: { color: '#aaa' },
    valueText: { color: '#000' },
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

    // Schedule View
    scheduleContainer: { backgroundColor: '#ffffff', borderRadius: 24, marginHorizontal: 15, marginVertical: 10, padding: 20, elevation: 4, shadowColor: '#999', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }},
    scheduleTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#111', marginBottom: 8 },
    badgeContainer: { alignSelf: 'center', backgroundColor: '#FEF1F2', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 16, marginBottom: 8 },
    badgeText: { color: '#E53E3E', fontSize: 15, fontWeight: 'bold' },
    scheduleSubtitle: { fontSize: 15, color: '#0d0d0dff', textAlign: 'center', marginBottom: 20 },
    
    // Table Grid
    table: { backgroundColor: '#f8f9fa', borderRadius: 16, borderWidth: 1, borderColor: '#e9ecef', overflow: 'hidden' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e9ecef' },
    tableCell: { paddingVertical: 14, paddingHorizontal: 10, borderRightWidth: 1, borderRightColor: '#e9ecef', justifyContent: 'center' },
    headerCell: { backgroundColor: '#f8f9fa' },
    headerCellText: { color: '#3e0cf4ff', fontSize: 14, fontWeight: '500', textAlign: 'left' },
    dataCellText: { color: '#212121', fontSize: 12, textAlign: 'left' },
    specialRow: { padding: 20, backgroundColor: '#e3f2fd', justifyContent: 'center', alignItems: 'center', margin: 10, borderRadius: 16 },
    specialRowText: { fontWeight: 'bold', fontSize: 15, color: '#1e88e5' },
    specialRowSubText: { fontSize: 13, color: '#64b5f6', fontStyle: 'italic', marginTop: 4 },
});

export default TeacherAdminExamScreen;