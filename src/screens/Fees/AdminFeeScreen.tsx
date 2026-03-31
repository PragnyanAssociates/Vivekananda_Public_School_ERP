import React, { useState, useMemo } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
    Modal, TextInput, Alert, ScrollView, ActivityIndicator, Platform, UIManager
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../api/client'; 

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CLASS_LIST =['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

const FEE_TYPES =[
    "ADD +", "Tuition Fee", "Examination Fee", "Lab Fee", "Library Fee",
    "LMS / Online Fee", "Digital Fee", "Maintenance Fee", "Medical Fee",
    "Sports Fee", "Activity Fee", "Training Fee", "Transport Fee",
    "Uniform Fee", "Tour Fee", "Hostel Fee", "Food / Mess Fee"
];

interface FeeSchedule {
    id: number; title: string; total_amount: number; due_date: string; 
    allow_installments: number; max_installments: number;
}

interface StudentFeeStatus {
    student_id: number; full_name: string; roll_no: string;
    submission_id: number | null;
    status: 'unpaid' | 'pending' | 'paid' | 'failed';
    payment_mode: string | null;
    installment_number: number | null;
    amount_paid: number | null;
    submitted_at: string | null;
}

interface InstallmentItem {
    title: string; amount: string; due_date: string; dateObject: Date; 
}

const AdminFeeScreen = () => {
    const [viewMode, setViewMode] = useState<'dashboard' | 'fee_list' | 'student_list'>('dashboard');
    const[selectedClass, setSelectedClass] = useState<string>('');
    const [selectedFee, setSelectedFee] = useState<FeeSchedule | null>(null);
    const [feeList, setFeeList] = useState<FeeSchedule[]>([]);
    const [studentStatuses, setStudentStatuses] = useState<StudentFeeStatus[]>([]);
    const[loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'unpaid' | 'paid'>('all');

    const [isCreateModalVisible, setCreateModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false); 
    const [editId, setEditId] = useState<number | null>(null); 
    
    // Fee Creation States
    const [selectedFeeType, setSelectedFeeType] = useState(FEE_TYPES[0]);
    const [customTitle, setCustomTitle] = useState('');
    const [newFee, setNewFee] = useState({ amount: '', dueDate: '', dateObject: new Date(), installments: false });
    const[numberOfInstallments, setNumberOfInstallments] = useState('');
    const[installmentBreakdown, setInstallmentBreakdown] = useState<InstallmentItem[]>([]);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerType, setDatePickerType] = useState<'main' | 'installment'>('main');
    const [activeInstallmentIndex, setActiveInstallmentIndex] = useState<number>(-1);

    const filteredStudents = useMemo(() => {
        if (activeTab === 'paid') return studentStatuses.filter(s => s.status === 'paid');
        else if (activeTab === 'unpaid') return studentStatuses.filter(s => s.status !== 'paid');
        return studentStatuses;
    },[studentStatuses, activeTab]);

    const sanitizeAmount = (amountStr: string) => amountStr ? amountStr.toString().replace(/,/g, '').trim() : '';
    const formatDateForDisplay = (date: Date) => `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    const formatDateForDB = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const formatDBStringForDisplay = (dateString: string) => { if (!dateString) return ''; const date = new Date(dateString); return formatDateForDisplay(date); };

    const fetchFeesForClass = async (className: string) => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/fees/list/${className}`);
            setFeeList(res.data); setSelectedClass(className); setViewMode('fee_list');
        } catch (error) { Alert.alert("Error", "Failed to fetch fees"); }
        finally { setLoading(false); }
    };

    const handleDeleteFee = (id: number) => {
        Alert.alert("Delete Fee", "Are you sure?",[{ text: "Cancel", style: "cancel" }, { text: "Delete", style: 'destructive', onPress: async () => {
            try {
                setLoading(true); await apiClient.delete(`/fees/${id}`);
                fetchFeesForClass(selectedClass); 
            } catch (error) { Alert.alert("Error", "Failed to delete fee"); setLoading(false); }
        }}]);
    };

    const openEditModal = async (item: FeeSchedule) => {
        setEditId(item.id); setIsEditing(true);
        if (FEE_TYPES.includes(item.title) && item.title !== "ADD +") { setSelectedFeeType(item.title); setCustomTitle(''); } 
        else { setSelectedFeeType("ADD +"); setCustomTitle(item.title); }

        setNewFee({ amount: item.total_amount.toString(), dueDate: formatDBStringForDisplay(item.due_date), dateObject: new Date(item.due_date), installments: item.allow_installments === 1 });

        if (item.allow_installments === 1) {
            setNumberOfInstallments(item.max_installments.toString());
            try {
                const res = await apiClient.get(`/fees/installments/${item.id}`);
                if (res.data && res.data.length > 0) {
                    const mapped = res.data.map((inst: any) => ({ title: inst.title || '', amount: inst.amount.toString(), due_date: formatDBStringForDisplay(inst.due_date), dateObject: new Date(inst.due_date) }));
                    setInstallmentBreakdown(mapped);
                } else { handleInstallmentCountChange(item.max_installments.toString()); }
            } catch (error) { handleInstallmentCountChange(item.max_installments.toString()); }
        } else { setNumberOfInstallments(''); setInstallmentBreakdown([]); }
        setCreateModalVisible(true);
    };

    const openCreateModal = () => { resetForm(); setCreateModalVisible(true); };

    const handleSaveFee = async () => {
        const finalTitle = selectedFeeType === "ADD +" ? customTitle.trim() : selectedFeeType;
        if (!finalTitle) return Alert.alert("Error", "Please select or enter a Fee Type");
        if (!newFee.amount || !newFee.dueDate) return Alert.alert("Error", "Fill all main fields");
        const cleanTotalAmount = sanitizeAmount(newFee.amount);
        
        if (newFee.installments) {
            if (installmentBreakdown.length === 0) return Alert.alert("Error", "Please specify number of installments");
            for (let i = 0; i < installmentBreakdown.length; i++) {
                if (!installmentBreakdown[i].amount || !installmentBreakdown[i].due_date) return Alert.alert("Error", `Fill Amount and Date for Installment ${i + 1}`);
            }
        }

        try {
            const payload = { 
                class_group: selectedClass, title: finalTitle, description: 'School Fee', total_amount: cleanTotalAmount, 
                due_date: formatDateForDB(newFee.dateObject), allow_installments: newFee.installments, 
                installment_details: newFee.installments ? installmentBreakdown.map(inst => ({ title: inst.title || '', amount: sanitizeAmount(inst.amount), due_date: formatDateForDB(inst.dateObject) })) :[] 
            };
            if (isEditing && editId) { await apiClient.put(`/fees/${editId}`, payload); Alert.alert("Success", "Updated"); } 
            else { await apiClient.post('/fees/create', payload); Alert.alert("Success", "Created"); }
            setCreateModalVisible(false); resetForm(); fetchFeesForClass(selectedClass); 
        } catch (error: any) { Alert.alert("Error", "Operation failed"); }
    };

    const resetForm = () => { setSelectedFeeType(FEE_TYPES[0]); setCustomTitle(''); setNewFee({ amount: '', dueDate: '', dateObject: new Date(), installments: false }); setNumberOfInstallments(''); setInstallmentBreakdown([]); setIsEditing(false); setEditId(null); };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) {
            const displayDate = formatDateForDisplay(selectedDate);
            if (datePickerType === 'main') setNewFee({ ...newFee, dueDate: displayDate, dateObject: selectedDate });
            else if (datePickerType === 'installment' && activeInstallmentIndex > -1) {
                const updatedList = [...installmentBreakdown]; updatedList[activeInstallmentIndex].due_date = displayDate; updatedList[activeInstallmentIndex].dateObject = selectedDate; setInstallmentBreakdown(updatedList);
            }
        }
    };

    const openDatePicker = (type: 'main' | 'installment', index: number = -1) => { setDatePickerType(type); setActiveInstallmentIndex(index); setShowDatePicker(true); };

    const handleInstallmentCountChange = (text: string) => { 
        setNumberOfInstallments(text); 
        const count = parseInt(text); 
        if (!isNaN(count) && count > 0 && count <= 12) { 
            const arr: InstallmentItem[] =[]; 
            for (let i = 0; i < count; i++) { 
                if (installmentBreakdown[i]) arr.push(installmentBreakdown[i]); 
                else arr.push({ title: '', amount: '', due_date: '', dateObject: new Date() }); 
            } 
            setInstallmentBreakdown(arr); 
        } else { setInstallmentBreakdown([]); }
    };

    const updateInstallmentField = (index: number, field: 'title' | 'amount', val: string) => { 
        const updatedList = [...installmentBreakdown]; updatedList[index][field] = val; setInstallmentBreakdown(updatedList); 
    };

    const fetchStudentStatusForFee = async (fee: FeeSchedule) => {
        setLoading(true); setSelectedFee(fee); setActiveTab('all');
        try { const res = await apiClient.get(`/fees/status/${fee.id}`); setStudentStatuses(res.data); setViewMode('student_list'); } 
        catch (error) { Alert.alert("Error", "Failed to fetch student data"); } finally { setLoading(false); }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerCard}>
                <View style={styles.headerIconContainer}><Icon name="admin-panel-settings" size={28} color="#008080" /></View>
                <View style={styles.headerTextContainer}><Text style={styles.headerTitle}>Admin Fee Manager</Text><Text style={styles.headerSubtitle}>Assign & Monitor Fees</Text></View>
            </View>

            {loading && <ActivityIndicator size="large" color="#008080" style={{marginTop: 50}} />}

            {!loading && viewMode === 'dashboard' && (
                <FlatList data={CLASS_LIST} numColumns={2} keyExtractor={item => item} contentContainerStyle={styles.gridContainer} renderItem={({ item }) => (
                    <TouchableOpacity style={styles.classCard} onPress={() => fetchFeesForClass(item)}>
                        <View style={styles.classIconBg}><Icon name="class" size={24} color="#008080" /></View><Text style={styles.classTitle}>{item}</Text>
                    </TouchableOpacity>
                )} />
            )}

            {!loading && viewMode === 'fee_list' && (
                <View style={{flex: 1}}>
                    <View style={styles.subHeader}>
                        <TouchableOpacity onPress={() => setViewMode('dashboard')}><Icon name="arrow-back" size={24} color="#333" /></TouchableOpacity>
                        <Text style={styles.subHeaderTitle}>{selectedClass} - Fees</Text>
                        <TouchableOpacity onPress={openCreateModal} style={styles.addBtn}><Text style={styles.addBtnText}>+ Add</Text></TouchableOpacity>
                    </View>
                    <FlatList data={feeList} keyExtractor={item => item.id.toString()} contentContainerStyle={{padding: 10}} renderItem={({ item }) => (
                        <View style={styles.feeCard}>
                            <TouchableOpacity style={{flex: 1}} onPress={() => fetchStudentStatusForFee(item)}>
                                <Text style={styles.feeTitle}>{item.title}</Text><Text style={styles.feeAmount}>₹{item.total_amount}</Text><Text style={styles.feeDate}>Due: {formatDBStringForDisplay(item.due_date)}</Text>
                            </TouchableOpacity>
                            <View style={styles.actionButtonsContainer}>
                                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#E0F7FA'}]} onPress={() => openEditModal(item)}><Icon name="edit" size={20} color="#008080" /></TouchableOpacity>
                                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#FFEBEE'}]} onPress={() => handleDeleteFee(item.id)}><Icon name="delete" size={20} color="#E74C3C" /></TouchableOpacity>
                            </View>
                        </View>
                    )} ListEmptyComponent={<Text style={styles.emptyText}>No fees scheduled yet.</Text>} />
                </View>
            )}

            {!loading && viewMode === 'student_list' && (
                <View style={{flex: 1}}>
                     <View style={styles.subHeader}>
                        <TouchableOpacity onPress={() => setViewMode('fee_list')} style={{width: 40}}><Icon name="arrow-back" size={24} color="#333" /></TouchableOpacity>
                        <Text style={[styles.subHeaderTitle, {textAlign: 'center'}]}>{selectedFee?.title}</Text>
                        <View style={{width: 40}} /> 
                    </View>

                    <View style={styles.tabContainer}>
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]} onPress={() => setActiveTab('all')}>
                            <Text style={[styles.tabText, activeTab === 'all' && {color:'#008080'}]}>All List</Text>
                        </TouchableOpacity>
                        <View style={styles.tabDivider} />
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'unpaid' && styles.tabBtnActive]} onPress={() => setActiveTab('unpaid')}>
                            <Text style={[styles.tabText, activeTab === 'unpaid' && {color:'#E74C3C'}]}>Unpaid</Text>
                        </TouchableOpacity>
                        <View style={styles.tabDivider} />
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'paid' && styles.tabBtnActive]} onPress={() => setActiveTab('paid')}>
                            <Text style={[styles.tabText, activeTab === 'paid' && {color:'#2ECC71'}]}>Paid</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{padding: 10}}>
                         {filteredStudents.length === 0 ? <Text style={styles.emptyText}>No students in this list.</Text> : 
                         filteredStudents.map((student, index) => (
                             <View key={`${student.student_id}-${index}`} style={[styles.studentCard, { borderLeftColor: student.status === 'paid' ? '#2ECC71' : (student.status === 'pending' ? '#F39C12' : '#E74C3C') }]}>
                                <View style={{flex:1}}>
                                    <Text style={styles.studentName}>{student.full_name} ({student.roll_no})</Text>
                                    <Text style={[styles.statusText, { color: student.status === 'paid' ? '#2ECC71' : (student.status === 'pending' ? '#F39C12' : '#E74C3C') }]}>
                                        {student.status.toUpperCase()} 
                                        {student.installment_number && student.installment_number > 0 ? ` (Inst ${student.installment_number})` : ''}
                                    </Text>
                                    {student.status === 'paid' && student.amount_paid && (
                                        <Text style={{fontSize: 12, color: '#666', marginTop: 2}}>Paid: ₹{student.amount_paid}</Text>
                                    )}
                                </View>
                             </View>
                         ))}
                    </ScrollView>
                </View>
            )}

            {/* Create/Edit Modal with DROPDOWN */}
            <Modal visible={isCreateModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{isEditing ? `Edit Fee` : `Assign Fee`}</Text>
                        <ScrollView contentContainerStyle={{paddingBottom: 20}}>
                            <Text style={styles.label}>Fee Type</Text>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={selectedFeeType} onValueChange={(itemValue) => setSelectedFeeType(itemValue)} style={styles.picker}>
                                    {FEE_TYPES.map((type) => <Picker.Item key={type} label={type} value={type} /> )}
                                </Picker>
                            </View>

                            {selectedFeeType === "ADD +" && (
                                <View style={{marginTop: 5, marginBottom: 10}}>
                                    <Text style={[styles.label, {fontSize: 12}]}>Enter Custom Fee Name:</Text>
                                    <TextInput placeholder="e.g. Picnic Fee" style={styles.input} value={customTitle} onChangeText={setCustomTitle} />
                                </View>
                            )}

                            <Text style={styles.label}>Total Amount</Text>
                            <TextInput placeholder="Total Amount" style={styles.input} keyboardType="numeric" value={newFee.amount} onChangeText={t => setNewFee({...newFee, amount: t})} />
                            
                            <Text style={styles.label}>Due Date</Text>
                            <TouchableOpacity onPress={() => openDatePicker('main')} style={styles.dateInput}>
                                <Text style={{color: newFee.dueDate ? '#333' : '#999'}}>{newFee.dueDate || "Select Due Date"}</Text>
                                <Icon name="calendar-today" size={20} color="#666" />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.checkboxRow} onPress={() => setNewFee({...newFee, installments: !newFee.installments})}>
                                <Text style={styles.label}>Allow Installments?</Text>
                                <Icon name={newFee.installments ? "check-box" : "check-box-outline-blank"} size={24} color="#008080" />
                            </TouchableOpacity>

                            {newFee.installments && (
                                <View style={styles.installmentContainer}>
                                    <Text style={styles.label}>Number of Installments:</Text>
                                    <TextInput placeholder="e.g. 3" style={styles.input} keyboardType="numeric" value={numberOfInstallments} onChangeText={handleInstallmentCountChange} />
                                    
                                    {installmentBreakdown.length > 0 && (
                                        <View style={{flexDirection: 'row', paddingLeft: 35, marginBottom: 5}}>
                                            <Text style={{flex: 1.5, fontSize: 10, fontWeight:'bold', color: '#666'}}>Title</Text>
                                            <Text style={{flex: 1, fontSize: 10, fontWeight:'bold', color: '#666'}}>Amount</Text>
                                            <Text style={{flex: 1, fontSize: 10, fontWeight:'bold', color: '#666'}}>Due Date</Text>
                                        </View>
                                    )}

                                    {installmentBreakdown.map((item, index) => (
                                        <View key={index} style={styles.instRow}>
                                            <Text style={styles.instLabel}>{index + 1}.</Text>
                                            <TextInput placeholder="Title" style={[styles.input, styles.instInput, {flex: 1.5, marginRight: 5}]} value={item.title} onChangeText={(val) => updateInstallmentField(index, 'title', val)} />
                                            <TextInput placeholder="Amt" style={[styles.input, styles.instInput, {flex: 1, marginRight: 5}]} keyboardType="numeric" value={item.amount} onChangeText={(val) => updateInstallmentField(index, 'amount', val)} />
                                            <TouchableOpacity onPress={() => openDatePicker('installment', index)} style={[styles.dateInput, styles.instDateInput, {flex: 1}]}>
                                                <Text style={{fontSize: 11, color: item.due_date ? '#333' : '#999'}}>{item.due_date || "DD/MM"}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </ScrollView>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveFee}><Text style={styles.btnText}>{isEditing ? 'Update Fee' : 'Assign Fee'}</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModalVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {showDatePicker && <DateTimePicker value={datePickerType === 'main' ? newFee.dateObject : (activeInstallmentIndex > -1 ? installmentBreakdown[activeInstallmentIndex].dateObject : new Date())} mode="date" display="default" onChange={handleDateChange} />}
        </SafeAreaView>
    );
};

// ... keep existing styles object exact same ... (omitted for brevity as styles haven't changed)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F5F8' },
    headerCard: { backgroundColor: '#FFF', padding: 15, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', elevation: 3 },
    headerIconContainer: { backgroundColor: '#E0F2F1', borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
    headerSubtitle: { fontSize: 13, color: '#666' },
    gridContainer: { paddingHorizontal: 8 },
    classCard: { flex: 1, margin: 8, padding: 20, backgroundColor: '#FFF', borderRadius: 12, alignItems: 'center', elevation: 2, height: 120, justifyContent: 'center' },
    classIconBg: { backgroundColor: '#F0F4F8', padding: 12, borderRadius: 50, marginBottom: 10 },
    classTitle: { fontSize: 15, fontWeight: 'bold', color: '#2C3E50' },
    subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, backgroundColor: '#FFF', elevation: 2, marginBottom: 10 },
    subHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', flex: 1 },
    addBtn: { backgroundColor: '#008080', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
    addBtnText: { color: '#FFF', fontWeight: 'bold' },
    feeCard: { backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 10, marginBottom: 10, marginHorizontal: 10, elevation: 2 },
    feeTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    feeAmount: { fontSize: 18, color: '#2ECC71', fontWeight: 'bold', marginTop: 4 },
    feeDate: { color: '#777', fontSize: 12, marginTop: 2 },
    actionButtonsContainer: { flexDirection: 'row' },
    actionBtn: { width: 35, height: 35, borderRadius: 17.5, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
    studentCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 8, marginBottom: 8, borderLeftWidth: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
    studentName: { fontSize: 15, fontWeight: '600', color: '#333' },
    statusText: { fontSize: 12, fontWeight: 'bold', marginTop: 2 },
    emptyText: { textAlign: 'center', marginTop: 20, color: '#999' },
    tabContainer: { flexDirection: 'row', marginHorizontal: 10, marginBottom: 10, backgroundColor: '#FFF', borderRadius: 8, elevation: 1 },
    tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabBtnActive: { borderBottomWidth: 3, borderBottomColor: '#333' },
    tabText: { fontWeight: 'bold', color: '#777' },
    tabDivider: { width: 1, backgroundColor: '#EEE', marginVertical: 10 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#FFF', width: '90%', maxHeight:'85%', borderRadius: 12, padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#008080', marginBottom: 15, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 10, marginBottom: 10, backgroundColor: '#FAFAFA' },
    pickerContainer: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, backgroundColor: '#FAFAFA', marginBottom: 10, overflow: 'hidden' },
    picker: { height: 50, width: '100%' },
    dateInput: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 10, marginBottom: 10, backgroundColor: '#FAFAFA', flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
    checkboxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 5 },
    label: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 5 },
    installmentContainer: { backgroundColor: '#F0F4F8', padding: 10, borderRadius: 8, marginBottom: 10 },
    instRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
    instLabel: { width: 25, fontSize: 12, fontWeight: 'bold', color: '#555' },
    instInput: { marginBottom: 0, paddingVertical: 5, fontSize: 13, height: 40 },
    instDateInput: { marginBottom: 0, paddingVertical: 8, height: 40, justifyContent:'center' },
    saveBtn: { backgroundColor: '#008080', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    btnText: { color: '#FFF', fontWeight: 'bold' },
    cancelBtn: { padding: 10, alignItems: 'center', marginTop: 5 },
    cancelText: { color: '#777' },
});

export default AdminFeeScreen;