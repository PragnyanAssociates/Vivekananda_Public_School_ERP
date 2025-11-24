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
import { useNavigation } from '@react-navigation/native'; // Import navigation hook
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
    green: '#388E3C',
    border: '#E0E0E0'
};

const SportsScreen = () => {
    const navigation = useNavigation(); // Initialize navigation
    const { user } = useAuth(); 
    const isStaff = user?.role === 'admin' || user?.role === 'teacher';

    const [activeTab, setActiveTab] = useState('groups'); // groups | schedule | applications
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    // Modals
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [applicantsModalVisible, setApplicantsModalVisible] = useState(false);
    const [selectedApplicationId, setSelectedApplicationId] = useState(null);
    const [applicantsList, setApplicantsList] = useState([]);

    // Form States
    const [formData, setFormData] = useState<any>({});
    const [datePicker, setDatePicker] = useState({ show: false, mode: 'date', field: '' });

    // --- FETCH DATA ---
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

    // --- ACTIONS ---

    const handleCreate = async () => {
        try {
            let endpoint = '';
            if (activeTab === 'groups') endpoint = '/sports/groups';
            else if (activeTab === 'schedule') endpoint = '/sports/schedules';
            else if (activeTab === 'applications') endpoint = '/sports/applications';

            await apiClient.post(endpoint, formData);
            Alert.alert("Success", "Created successfully!");
            setCreateModalVisible(false);
            setFormData({});
            fetchData();
        } catch (error) {
            Alert.alert("Error", "Failed to create.");
        }
    };

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
        } catch (error) {
            console.error(error);
        }
    };

    const handleUpdateStatus = async (entryId: number, status: string) => {
        try {
            await apiClient.put(`/sports/entries/${entryId}/status`, { status });
            setApplicantsList((prev: any[]) => prev.map(item => item.id === entryId ? { ...item, status } : item));
        } catch (error) {
            Alert.alert("Error", "Could not update status");
        }
    };

    // --- RENDER CARDS ---

    const renderGroupCard = ({ item }: any) => (
        <View style={styles.card}>
            <View style={styles.iconBox}>
                <Icon name={getSportIcon(item.category)} size={30} color={COLORS.white} />
            </View>
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSubtitle}>{item.category} • Coach: {item.coach_name}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                <View style={styles.badgeContainer}>
                    <Icon name="account-group" size={14} color={COLORS.grey} />
                    <Text style={styles.badgeText}>{item.member_count} Members</Text>
                </View>
            </View>
        </View>
    );

    const renderScheduleCard = ({ item }: any) => (
        <View style={styles.scheduleCard}>
            <View style={styles.dateBox}>
                <Text style={styles.dateDay}>{new Date(item.event_date).getDate()}</Text>
                <Text style={styles.dateMonth}>{new Date(item.event_date).toLocaleString('default', { month: 'short' })}</Text>
            </View>
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>
                    {new Date(`1970-01-01T${item.event_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' • '}{item.venue}
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
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        {item.my_status && (
                            <Text style={[styles.statusBadge, { 
                                color: item.my_status === 'Approved' ? COLORS.green : item.my_status === 'Rejected' ? COLORS.primary : COLORS.secondary 
                            }]}>
                                {item.my_status}
                            </Text>
                        )}
                    </View>
                    <Text style={styles.cardDesc}>{item.description}</Text>
                    <Text style={styles.cardSubtitle}>Deadline: {new Date(item.deadline).toLocaleDateString()}</Text>
                    
                    <View style={styles.actionRow}>
                        {isStaff ? (
                            <TouchableOpacity style={styles.adminBtn} onPress={() => handleViewApplicants(item.id)}>
                                <Text style={styles.adminBtnText}>View Applicants</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity 
                                style={[styles.applyBtn, (item.my_status || item.status === 'Closed' || isExpired) && styles.disabledBtn]} 
                                onPress={() => handleApply(item.id)}
                                disabled={!!item.my_status || item.status === 'Closed' || isExpired}
                            >
                                <Text style={styles.applyBtnText}>
                                    {item.my_status ? 'Applied' : isExpired ? 'Expired' : 'Apply Now'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    const getSportIcon = (cat: string) => {
        const map: any = { 'Football': 'soccer', 'Cricket': 'cricket', 'Volleyball': 'volleyball', 'Chess': 'chess-king', 'Swimming': 'swim' };
        return map[cat] || 'trophy';
    };

    const showDatePicker = (field: string, mode: any = 'date') => {
        setDatePicker({ show: true, mode, field });
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        setDatePicker({ ...datePicker, show: false });
        if (selectedDate) {
            let valString = '';
            if (datePicker.mode === 'date') valString = selectedDate.toISOString().split('T')[0];
            if (datePicker.mode === 'time') valString = selectedDate.toTimeString().split(' ')[0];
            setFormData({ ...formData, [datePicker.field]: valString });
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* --- UPDATED HEADER (White Background + Back Button) --- */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Icon name="arrow-left" size={26} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Sports & Activities</Text>
                </View>
                
                {isStaff && (
                    <TouchableOpacity style={styles.addBtn} onPress={() => setCreateModalVisible(true)}>
                        <Icon name="plus" size={28} color={COLORS.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                {['groups', 'schedule', 'applications'].map(tab => (
                    <TouchableOpacity 
                        key={tab} 
                        style={[styles.tab, activeTab === tab && styles.activeTab]} 
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* List Content */}
            {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={data}
                    keyExtractor={(item: any) => item.id.toString()}
                    renderItem={activeTab === 'groups' ? renderGroupCard : activeTab === 'schedule' ? renderScheduleCard : renderApplicationCard}
                    contentContainerStyle={{ padding: 15 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[COLORS.primary]}
                            tintColor={COLORS.primary}
                        />
                    }
                    ListEmptyComponent={<Text style={styles.emptyText}>No records found.</Text>}
                />
            )}

            {/* --- CREATE MODAL (ADMIN/TEACHER) --- */}
            <Modal visible={createModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Create {activeTab.slice(0, -1)}</Text>
                        
                        <ScrollView>
                            {activeTab === 'groups' && (
                                <>
                                    <TextInput placeholder="Group Name" style={styles.input} onChangeText={t => setFormData({...formData, name: t})} />
                                    <TextInput placeholder="Category (e.g., Football)" style={styles.input} onChangeText={t => setFormData({...formData, category: t})} />
                                    <TextInput placeholder="Description" style={[styles.input, {height: 80}]} multiline onChangeText={t => setFormData({...formData, description: t})} />
                                </>
                            )}

                            {activeTab === 'schedule' && (
                                <>
                                    <TextInput placeholder="Event Title" style={styles.input} onChangeText={t => setFormData({...formData, title: t})} />
                                    <TouchableOpacity onPress={() => showDatePicker('event_date', 'date')} style={styles.input}><Text>{formData.event_date || 'Select Date'}</Text></TouchableOpacity>
                                    <TouchableOpacity onPress={() => showDatePicker('event_time', 'time')} style={styles.input}><Text>{formData.event_time || 'Select Time'}</Text></TouchableOpacity>
                                    <TextInput placeholder="Venue" style={styles.input} onChangeText={t => setFormData({...formData, venue: t})} />
                                </>
                            )}

                            {activeTab === 'applications' && (
                                <>
                                    <TextInput placeholder="Title" style={styles.input} onChangeText={t => setFormData({...formData, title: t})} />
                                    <TextInput placeholder="Description" style={[styles.input, {height: 80}]} multiline onChangeText={t => setFormData({...formData, description: t})} />
                                    <TouchableOpacity onPress={() => showDatePicker('deadline', 'date')} style={styles.input}><Text>{formData.deadline || 'Select Deadline'}</Text></TouchableOpacity>
                                </>
                            )}
                        </ScrollView>

                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={[styles.modalBtn, {backgroundColor: COLORS.grey}]} onPress={() => setCreateModalVisible(false)}>
                                <Text style={styles.btnTxt}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, {backgroundColor: COLORS.primary}]} onPress={handleCreate}>
                                <Text style={styles.btnTxt}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
                {datePicker.show && <DateTimePicker value={new Date()} mode={datePicker.mode as any} onChange={onDateChange} />}
            </Modal>

            {/* --- APPLICANTS MODAL --- */}
            <Modal visible={applicantsModalVisible} animationType="slide">
                <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
                    <View style={[styles.header, { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
                        <Text style={styles.headerTitle}>Applicants</Text>
                        <TouchableOpacity onPress={() => setApplicantsModalVisible(false)}>
                            <Icon name="close" size={24} color={COLORS.text} />
                        </TouchableOpacity>
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
    
    // --- HEADER STYLES ---
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: 15, 
        backgroundColor: COLORS.white, // White Background
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        zIndex: 10
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    backBtn: {
        marginRight: 15
    },
    headerTitle: { 
        color: COLORS.text, // Dark Text
        fontSize: 20, 
        fontWeight: 'bold' 
    },
    addBtn: { 
        padding: 5 
    },
    
    // Tabs
    tabContainer: { flexDirection: 'row', backgroundColor: '#FFF', elevation: 1, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    activeTab: { borderBottomColor: COLORS.primary },
    tabText: { fontWeight: '600', color: COLORS.grey },
    activeTabText: { color: COLORS.primary },

    emptyText: { textAlign: 'center', marginTop: 50, color: COLORS.grey },

    // Card Styles
    card: { flexDirection: 'row', backgroundColor: '#FFF', marginBottom: 12, borderRadius: 10, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    iconBox: { width: 80, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
    cardContent: { flex: 1, padding: 15 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
    cardSubtitle: { fontSize: 12, color: COLORS.grey, marginBottom: 5 },
    cardDesc: { fontSize: 13, color: '#546E7A', marginBottom: 8 },
    badgeContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECEFF1', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    badgeText: { fontSize: 11, marginLeft: 4, color: COLORS.text },

    // Schedule Card
    scheduleCard: { flexDirection: 'row', backgroundColor: '#FFF', marginBottom: 10, borderRadius: 10, padding: 15, elevation: 2 },
    dateBox: { backgroundColor: '#FFEBEE', padding: 10, borderRadius: 8, alignItems: 'center', marginRight: 15, minWidth: 60 },
    dateDay: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
    dateMonth: { fontSize: 12, color: COLORS.primary, textTransform: 'uppercase' },
    groupTag: { backgroundColor: '#E3F2FD', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontSize: 10, color: COLORS.secondary, marginTop: 5 },

    // Application Styles
    statusLine: { width: 6 },
    actionRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end' },
    applyBtn: { backgroundColor: COLORS.secondary, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 5 },
    disabledBtn: { backgroundColor: COLORS.grey },
    applyBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
    adminBtn: { backgroundColor: COLORS.text, paddingVertical: 8, paddingHorizontal: 15, borderRadius: 5 },
    adminBtnText: { color: '#FFF', fontSize: 12 },
    statusBadge: { fontSize: 12, fontWeight: 'bold' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#FFF', borderRadius: 10, padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: COLORS.text },
    input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 5, padding: 10, marginBottom: 15, fontSize: 14, color: '#000' },
    modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    modalBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 5 },
    btnTxt: { color: '#FFF', fontWeight: 'bold' },

    // Applicants List
    applicantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#FFF', marginBottom: 1, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    applicantName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
    applicantClass: { fontSize: 12, color: COLORS.grey },
    actionIcon: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginLeft: 10 }
});

export default SportsScreen;