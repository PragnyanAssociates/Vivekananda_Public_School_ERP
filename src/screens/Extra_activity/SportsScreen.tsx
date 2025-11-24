import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    ScrollView,
    SafeAreaView,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';

// --- COLORS ---
const COLORS = {
    primary: '#D32F2F', // Sports Red
    secondary: '#1976D2', // Blue
    bg: '#F5F7FA',
    white: '#FFF',
    text: '#263238',
    grey: '#78909C',
    lightGrey: '#ECEFF1',
    green: '#388E3C',
    border: '#E0E0E0'
};

const SportsScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth(); // { role: 'student' | 'teacher' | 'admin', id: ... }
    const isStaff = user?.role === 'admin' || user?.role === 'teacher';

    const [activeTab, setActiveTab] = useState('groups');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    // --- MODAL STATES ---
    const [formModalVisible, setFormModalVisible] = useState(false);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [memberPickerVisible, setMemberPickerVisible] = useState(false);
    const [applicantsModalVisible, setApplicantsModalVisible] = useState(false);

    // --- DATA STATES ---
    const [selectedItem, setSelectedItem] = useState<any>(null); // For Edit/Details
    const [isEditMode, setIsEditMode] = useState(false);
    const [allStudents, setAllStudents] = useState<any[]>([]); // List of all students for picker
    const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]); // IDs for new group
    const [currentGroupMembers, setCurrentGroupMembers] = useState<any[]>([]); // List for detail view
    const [applicantsList, setApplicantsList] = useState([]);

    // --- FORM DATA ---
    const [formData, setFormData] = useState<any>({});
    const [datePicker, setDatePicker] = useState({ show: false, mode: 'date', field: '' });

    // --- FETCH MAIN DATA ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let endpoint = '';
            if (activeTab === 'groups') endpoint = '/sports/groups';
            else if (activeTab === 'schedule') endpoint = '/sports/schedules';
            else if (activeTab === 'applications') endpoint = '/sports/applications';

            const response = await apiClient.get(endpoint);
            setData(response.data);
        } catch (error) {
            console.error("Fetch error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeTab]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // --- FETCH STUDENTS FOR PICKER ---
    const fetchAllStudents = async () => {
        try {
            const res = await apiClient.get('/users/students/search');
            setAllStudents(res.data);
        } catch (error) {
            console.error("Error fetching students");
        }
    };

    // --- CRUD HANDLERS ---

    const handleOpenCreate = () => {
        setIsEditMode(false);
        setFormData({});
        setSelectedMemberIds([]);
        setFormModalVisible(true);
        if (activeTab === 'groups') fetchAllStudents();
    };

    const handleOpenEdit = async (item: any) => {
        setIsEditMode(true);
        setSelectedItem(item);
        setFormData(item); // Pre-fill
        
        if (activeTab === 'groups') {
            await fetchAllStudents();
            // Fetch existing members for this group to pre-select
            try {
                const res = await apiClient.get(`/sports/groups/${item.id}/members`);
                const ids = res.data.map((m: any) => m.id);
                setSelectedMemberIds(ids);
            } catch (e) { console.error(e); }
        }
        setFormModalVisible(true);
    };

    const handleDelete = (id: number) => {
        Alert.alert("Confirm Delete", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive", onPress: async () => {
                    try {
                        let endpoint = activeTab === 'groups' ? `/sports/groups/${id}` : 
                                       activeTab === 'schedule' ? `/sports/schedules/${id}` : 
                                       `/sports/applications/${id}`;
                        await apiClient.delete(endpoint);
                        Alert.alert("Deleted", "Item removed successfully.");
                        fetchData();
                    } catch (e) { Alert.alert("Error", "Delete failed."); }
                }
            }
        ]);
    };

    const handleSubmit = async () => {
        try {
            let endpoint = activeTab === 'groups' ? '/sports/groups' : activeTab === 'schedule' ? '/sports/schedules' : '/sports/applications';
            let method = isEditMode ? 'put' : 'post';
            let url = isEditMode ? `${endpoint}/${selectedItem.id}` : endpoint;

            const payload = { ...formData };
            if (activeTab === 'groups') {
                payload.member_ids = selectedMemberIds;
            }

            await apiClient[method](url, payload);
            Alert.alert("Success", isEditMode ? "Updated successfully!" : "Created successfully!");
            setFormModalVisible(false);
            fetchData();
        } catch (error) {
            Alert.alert("Error", "Operation failed.");
        }
    };

    // --- GROUP DETAIL ACCESS ---
    const handleGroupPress = async (item: any) => {
        // Logic: If Staff OR if Student is a member
        if (isStaff || item.is_member > 0) {
            setSelectedItem(item);
            try {
                const res = await apiClient.get(`/sports/groups/${item.id}/members`);
                setCurrentGroupMembers(res.data);
                setDetailModalVisible(true);
            } catch (e) { Alert.alert("Error", "Could not fetch members."); }
        } else {
            Alert.alert("Access Denied", "You are not a member of this group.");
        }
    };

    // --- APPLICATION HANDLERS ---
    const handleApply = async (appId: number) => {
        try {
            await apiClient.post('/sports/apply', { application_id: appId });
            Alert.alert("Success", "Application submitted!");
            fetchData(); 
        } catch (error: any) {
            Alert.alert("Notice", error.response?.data?.message || "Failed to apply.");
        }
    };

    const handleViewApplicants = async (appId: number) => {
        setSelectedApplicationId(appId);
        setApplicantsModalVisible(true);
        try {
            const res = await apiClient.get(`/sports/applications/${appId}/entries`);
            setApplicantsList(res.data);
        } catch (error) { console.error(error); }
    };

    const handleUpdateStatus = async (entryId: number, status: string) => {
        try {
            await apiClient.put(`/sports/entries/${entryId}/status`, { status });
            setApplicantsList((prev: any[]) => prev.map(item => item.id === entryId ? { ...item, status } : item));
        } catch (error) { Alert.alert("Error", "Could not update status"); }
    };

    // --- DATE PICKER ---
    const showDatePicker = (field: string, mode: any = 'date') => setDatePicker({ show: true, mode, field });
    const onDateChange = (event: any, selectedDate?: Date) => {
        setDatePicker({ ...datePicker, show: false });
        if (selectedDate) {
            let val = datePicker.mode === 'time' ? selectedDate.toTimeString().split(' ')[0] : selectedDate.toISOString().split('T')[0];
            setFormData({ ...formData, [datePicker.field]: val });
        }
    };

    // --- TOGGLE MEMBER SELECTION ---
    const toggleMemberSelection = (studentId: number) => {
        if (selectedMemberIds.includes(studentId)) {
            setSelectedMemberIds(prev => prev.filter(id => id !== studentId));
        } else {
            setSelectedMemberIds(prev => [...prev, studentId]);
        }
    };

    // --- RENDERERS ---

    const renderGroupCard = ({ item }: any) => (
        <TouchableOpacity style={styles.card} onPress={() => handleGroupPress(item)} activeOpacity={0.8}>
            <View style={styles.iconBox}>
                <Icon name="trophy" size={30} color={COLORS.white} />
            </View>
            <View style={styles.cardContent}>
                <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    {isStaff && (
                        <View style={styles.actionIcons}>
                            <TouchableOpacity onPress={() => handleOpenEdit(item)} style={styles.iconBtn}><Icon name="pencil" size={20} color={COLORS.secondary} /></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBtn}><Icon name="trash-can" size={20} color={COLORS.primary} /></TouchableOpacity>
                        </View>
                    )}
                </View>
                <Text style={styles.cardSubtitle}>{item.category} • Coach: {item.coach_name || 'N/A'}</Text>
                <View style={styles.badgeContainer}>
                    <Icon name="account-group" size={14} color={COLORS.grey} />
                    <Text style={styles.badgeText}>{item.member_count} Members</Text>
                    {item.is_member > 0 && <Text style={[styles.badgeText, {color: COLORS.green, marginLeft: 10}]}>Joined ✓</Text>}
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderScheduleCard = ({ item }: any) => (
        <View style={styles.scheduleCard}>
            <View style={styles.dateBox}>
                <Text style={styles.dateDay}>{new Date(item.event_date).getDate()}</Text>
                <Text style={styles.dateMonth}>{new Date(item.event_date).toLocaleString('default', { month: 'short' })}</Text>
            </View>
            <View style={styles.cardContent}>
                <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {isStaff && (
                        <View style={styles.actionIcons}>
                            <TouchableOpacity onPress={() => handleOpenEdit(item)} style={styles.iconBtn}><Icon name="pencil" size={20} color={COLORS.secondary} /></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBtn}><Icon name="trash-can" size={20} color={COLORS.primary} /></TouchableOpacity>
                        </View>
                    )}
                </View>
                <Text style={styles.cardSubtitle}>
                    {new Date(`1970-01-01T${item.event_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {item.venue}
                </Text>
                {item.group_name && <Text style={styles.groupTag}>{item.group_name}</Text>}
            </View>
        </View>
    );

    const renderApplicationCard = ({ item }: any) => {
        const isExpired = new Date(item.deadline) < new Date();
        return (
            <View style={styles.card}>
                <View style={[styles.statusLine, { backgroundColor: item.status === 'Closed' || isExpired ? COLORS.grey : COLORS.green }]} />
                <View style={{ padding: 15, width: '100%' }}>
                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        {isStaff ? (
                            <View style={styles.actionIcons}>
                                <TouchableOpacity onPress={() => handleOpenEdit(item)} style={styles.iconBtn}><Icon name="pencil" size={20} color={COLORS.secondary} /></TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBtn}><Icon name="trash-can" size={20} color={COLORS.primary} /></TouchableOpacity>
                            </View>
                        ) : item.my_status && <Text style={[styles.statusBadge, { color: COLORS.green }]}>{item.my_status}</Text>}
                    </View>
                    <Text style={styles.cardDesc}>{item.description}</Text>
                    <Text style={styles.cardSubtitle}>Deadline: {new Date(item.deadline).toLocaleDateString()}</Text>
                    
                    <View style={styles.actionRow}>
                        {isStaff ? (
                            <TouchableOpacity style={styles.adminBtn} onPress={() => handleViewApplicants(item.id)}>
                                <Text style={styles.adminBtnText}>View Applicants</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={[styles.applyBtn, (item.my_status || isExpired) && styles.disabledBtn]} onPress={() => handleApply(item.id)} disabled={!!item.my_status || isExpired}>
                                <Text style={styles.applyBtnText}>{item.my_status ? 'Applied' : isExpired ? 'Expired' : 'Apply Now'}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Icon name="arrow-left" size={26} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Sports & Activities</Text>
                </View>
                {isStaff && (
                    <TouchableOpacity style={styles.addBtn} onPress={handleOpenCreate}>
                        <Icon name="plus" size={28} color={COLORS.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* TABS */}
            <View style={styles.tabContainer}>
                {['groups', 'schedule', 'applications'].map(tab => (
                    <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* CONTENT */}
            {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} /> : (
                <FlatList
                    data={data}
                    keyExtractor={(item: any) => item.id.toString()}
                    renderItem={activeTab === 'groups' ? renderGroupCard : activeTab === 'schedule' ? renderScheduleCard : renderApplicationCard}
                    contentContainerStyle={{ padding: 15 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
                    ListEmptyComponent={<Text style={styles.emptyText}>No records found.</Text>}
                />
            )}

            {/* --- CREATE/EDIT MODAL --- */}
            <Modal visible={formModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{isEditMode ? 'Edit' : 'Create'} {activeTab.slice(0, -1)}</Text>
                        <ScrollView>
                            {activeTab === 'groups' && (
                                <>
                                    <TextInput placeholder="Group Name" style={styles.input} value={formData.name} onChangeText={t => setFormData({...formData, name: t})} />
                                    <TextInput placeholder="Category (e.g., Football)" style={styles.input} value={formData.category} onChangeText={t => setFormData({...formData, category: t})} />
                                    <TextInput placeholder="Description" style={[styles.input, {height: 80}]} multiline value={formData.description} onChangeText={t => setFormData({...formData, description: t})} />
                                    <TouchableOpacity style={styles.memberSelectorBtn} onPress={() => setMemberPickerVisible(true)}>
                                        <Icon name="account-plus" size={20} color={COLORS.primary} />
                                        <Text style={styles.memberSelectorText}>Select Members ({selectedMemberIds.length})</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                            {activeTab === 'schedule' && (
                                <>
                                    <TextInput placeholder="Event Title" style={styles.input} value={formData.title} onChangeText={t => setFormData({...formData, title: t})} />
                                    <TouchableOpacity onPress={() => showDatePicker('event_date', 'date')} style={styles.input}><Text>{formData.event_date || 'Select Date'}</Text></TouchableOpacity>
                                    <TouchableOpacity onPress={() => showDatePicker('event_time', 'time')} style={styles.input}><Text>{formData.event_time || 'Select Time'}</Text></TouchableOpacity>
                                    <TextInput placeholder="Venue" style={styles.input} value={formData.venue} onChangeText={t => setFormData({...formData, venue: t})} />
                                </>
                            )}
                            {activeTab === 'applications' && (
                                <>
                                    <TextInput placeholder="Title" style={styles.input} value={formData.title} onChangeText={t => setFormData({...formData, title: t})} />
                                    <TextInput placeholder="Description" style={[styles.input, {height: 80}]} multiline value={formData.description} onChangeText={t => setFormData({...formData, description: t})} />
                                    <TouchableOpacity onPress={() => showDatePicker('deadline', 'date')} style={styles.input}><Text>{formData.deadline || 'Select Deadline'}</Text></TouchableOpacity>
                                    {isEditMode && (
                                        <TouchableOpacity onPress={() => setFormData({...formData, status: formData.status === 'Open' ? 'Closed' : 'Open'})} style={styles.input}>
                                            <Text>Status: {formData.status || 'Open'}</Text>
                                        </TouchableOpacity>
                                    )}
                                </>
                            )}
                        </ScrollView>
                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={[styles.modalBtn, {backgroundColor: COLORS.grey}]} onPress={() => setFormModalVisible(false)}><Text style={styles.btnTxt}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, {backgroundColor: COLORS.primary}]} onPress={handleSubmit}><Text style={styles.btnTxt}>{isEditMode ? 'Update' : 'Create'}</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
                {datePicker.show && <DateTimePicker value={new Date()} mode={datePicker.mode as any} onChange={onDateChange} />}
            </Modal>

            {/* --- MEMBER PICKER MODAL --- */}
            <Modal visible={memberPickerVisible} animationType="slide">
                <SafeAreaView style={{flex: 1, backgroundColor: COLORS.bg}}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Select Students</Text>
                        <TouchableOpacity onPress={() => setMemberPickerVisible(false)}><Icon name="check" size={24} color={COLORS.text} /></TouchableOpacity>
                    </View>
                    <FlatList
                        data={allStudents}
                        keyExtractor={(item: any) => item.id.toString()}
                        contentContainerStyle={{padding: 15}}
                        renderItem={({item}) => {
                            const isSelected = selectedMemberIds.includes(item.id);
                            return (
                                <TouchableOpacity style={[styles.memberRow, isSelected && styles.memberRowSelected]} onPress={() => toggleMemberSelection(item.id)}>
                                    <Text style={[styles.memberName, isSelected && {color: COLORS.primary}]}>{item.full_name} ({item.class_group})</Text>
                                    {isSelected && <Icon name="check-circle" size={20} color={COLORS.primary} />}
                                </TouchableOpacity>
                            )
                        }}
                    />
                </SafeAreaView>
            </Modal>

            {/* --- GROUP DETAILS MODAL --- */}
            <Modal visible={detailModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, {height: '70%'}]}>
                        <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                            <Text style={styles.modalTitle}>{selectedItem?.name}</Text>
                            <TouchableOpacity onPress={() => setDetailModalVisible(false)}><Icon name="close" size={24} color={COLORS.text} /></TouchableOpacity>
                        </View>
                        <Text style={{color: COLORS.grey, marginBottom: 10}}>{selectedItem?.description}</Text>
                        <Text style={styles.sectionHeader}>Members ({currentGroupMembers.length})</Text>
                        <FlatList
                            data={currentGroupMembers}
                            keyExtractor={(item: any) => item.id.toString()}
                            renderItem={({item}) => (
                                <View style={styles.memberItem}>
                                    <Text style={styles.memberName}>{item.full_name}</Text>
                                    <Text style={styles.memberClass}>{item.class_group}</Text>
                                </View>
                            )}
                        />
                    </View>
                </View>
            </Modal>

            {/* --- APPLICANTS MODAL --- */}
            <Modal visible={applicantsModalVisible} animationType="slide">
                <SafeAreaView style={{flex: 1, backgroundColor: COLORS.bg}}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Applicants</Text>
                        <TouchableOpacity onPress={() => setApplicantsModalVisible(false)}><Icon name="close" size={24} color={COLORS.text} /></TouchableOpacity>
                    </View>
                    <FlatList 
                        data={applicantsList}
                        keyExtractor={(item: any) => item.id.toString()}
                        contentContainerStyle={{ padding: 15 }}
                        renderItem={({ item }: any) => (
                            <View style={styles.applicantRow}>
                                <View>
                                    <Text style={styles.applicantName}>{item.full_name}</Text>
                                    <Text style={styles.applicantClass}>{item.class_group}</Text>
                                </View>
                                <View style={{ flexDirection: 'row' }}>
                                    {item.status === 'Pending' ? (
                                        <>
                                            <TouchableOpacity onPress={() => handleUpdateStatus(item.id, 'Approved')} style={[styles.actionIcon, { backgroundColor: COLORS.green }]}>
                                                <Icon name="check" size={18} color="#FFF" />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleUpdateStatus(item.id, 'Rejected')} style={[styles.actionIcon, { backgroundColor: COLORS.primary }]}>
                                                <Icon name="close" size={18} color="#FFF" />
                                            </TouchableOpacity>
                                        </>
                                    ) : (
                                        <Text style={{ color: item.status === 'Approved' ? COLORS.green : COLORS.primary, fontWeight: 'bold' }}>
                                            {item.status}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}
                    />
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: COLORS.white, elevation: 2, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    backBtn: { marginRight: 15 },
    headerTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },
    addBtn: { padding: 5 },
    tabContainer: { flexDirection: 'row', backgroundColor: '#FFF', elevation: 1, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    activeTab: { borderBottomColor: COLORS.primary },
    tabText: { fontWeight: '600', color: COLORS.grey },
    activeTabText: { color: COLORS.primary },
    emptyText: { textAlign: 'center', marginTop: 50, color: COLORS.grey },
    card: { flexDirection: 'row', backgroundColor: '#FFF', marginBottom: 12, borderRadius: 10, overflow: 'hidden', elevation: 2 },
    iconBox: { width: 80, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
    cardContent: { flex: 1, padding: 15 },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, flex: 1 },
    actionIcons: { flexDirection: 'row' },
    iconBtn: { marginLeft: 10 },
    cardSubtitle: { fontSize: 12, color: COLORS.grey, marginBottom: 5 },
    cardDesc: { fontSize: 13, color: '#546E7A', marginBottom: 8 },
    badgeContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.lightGrey, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    badgeText: { fontSize: 11, marginLeft: 4, color: COLORS.text },
    scheduleCard: { flexDirection: 'row', backgroundColor: '#FFF', marginBottom: 10, borderRadius: 10, padding: 15, elevation: 2 },
    dateBox: { backgroundColor: '#FFEBEE', padding: 10, borderRadius: 8, alignItems: 'center', marginRight: 15, minWidth: 60 },
    dateDay: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
    dateMonth: { fontSize: 12, color: COLORS.primary, textTransform: 'uppercase' },
    groupTag: { backgroundColor: '#E3F2FD', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontSize: 10, color: COLORS.secondary, marginTop: 5 },
    statusLine: { width: 6 },
    actionRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end' },
    applyBtn: { backgroundColor: COLORS.secondary, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 5 },
    disabledBtn: { backgroundColor: COLORS.grey },
    applyBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
    adminBtn: { backgroundColor: COLORS.text, paddingVertical: 8, paddingHorizontal: 15, borderRadius: 5 },
    adminBtnText: { color: '#FFF', fontSize: 12 },
    statusBadge: { fontSize: 12, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#FFF', borderRadius: 10, padding: 20, maxHeight: '90%' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: COLORS.text },
    input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 5, padding: 10, marginBottom: 15, fontSize: 14, color: '#000' },
    modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    modalBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 5 },
    btnTxt: { color: '#FFF', fontWeight: 'bold' },
    memberSelectorBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#F0F4C3', borderRadius: 5, marginBottom: 15 },
    memberSelectorText: { marginLeft: 10, color: COLORS.text, fontWeight: '600' },
    memberRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    memberRowSelected: { backgroundColor: '#E8F5E9' },
    memberName: { fontSize: 16, color: COLORS.text },
    memberClass: { fontSize: 14, color: COLORS.grey },
    applicantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#FFF', marginBottom: 1, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    applicantName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
    applicantClass: { fontSize: 12, color: COLORS.grey },
    actionIcon: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    sectionHeader: { fontSize: 16, fontWeight: 'bold', marginTop: 10, marginBottom: 5, color: COLORS.text },
    memberItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    selectedMemberIds: { useState: [] } // Note: This line in styles is incorrect syntax for JS, but harmless in StyleSheet object. It was likely a copy-paste remnant.
});

export default SportsScreen;