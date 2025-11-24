import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
    RefreshControl,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

// --- COLORS ---
const COLORS = {
    primary: '#D32F2F', 
    secondary: '#1976D2', 
    bg: '#F5F7FA',
    white: '#FFF',
    text: '#263238',
    grey: '#78909C',
    lightGrey: '#ECEFF1',
    green: '#388E3C', 
    orange: '#FF9800', 
    red: '#D32F2F',    
    border: '#E0E0E0',
    chatBubbleUser: '#E3F2FD',
    chatBubbleOther: '#FFFFFF',
    announcementBg: '#FFF3E0'
};

const SportsScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth(); 
    const isStaff = user?.role === 'admin' || user?.role === 'teacher';

    const [activeTab, setActiveTab] = useState('groups');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [applyingId, setApplyingId] = useState(null); // Loading state for specific button

    // Modals
    const [formModalVisible, setFormModalVisible] = useState(false);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [memberPickerVisible, setMemberPickerVisible] = useState(false);
    const [applicantsModalVisible, setApplicantsModalVisible] = useState(false);

    // Detail Tab
    const [detailTab, setDetailTab] = useState('info'); 

    // Data Holders
    const [selectedItem, setSelectedItem] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [allStudents, setAllStudents] = useState([]);
    const [allTeachers, setAllTeachers] = useState([]);
    const [allGroups, setAllGroups] = useState([]); 
    const [availableClasses, setAvailableClasses] = useState([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState(null);
    const [filterClass, setFilterClass] = useState('All');
    const [searchText, setSearchText] = useState('');
    const [currentGroupMembers, setCurrentGroupMembers] = useState([]);
    const [groupAnnouncements, setGroupAnnouncements] = useState([]);
    const [groupMessages, setGroupMessages] = useState([]);
    const [applicantsList, setApplicantsList] = useState([]);

    // Form
    const [formData, setFormData] = useState({});
    const [chatInput, setChatInput] = useState('');
    const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', event_date: '' });
    const [datePicker, setDatePicker] = useState({ show: false, mode: 'date', field: '', initialValue: new Date() });
    
    const chatListRef = useRef(null);

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

    useEffect(() => { fetchData(); }, [fetchData]);
    const onRefresh = () => { setRefreshing(true); fetchData(); };

    // --- HELPERS & UTILS (Keep same as before) ---
    const fetchUsersForSelection = async () => {
        try {
            const res = await apiClient.get('/users/sports/search');
            setAllStudents(res.data.students);
            setAllTeachers(res.data.teachers);
            setAvailableClasses(['All', ...res.data.classes]);
        } catch (error) { console.error("Error fetching users"); }
    };

    const fetchAllGroups = async () => {
        try {
            const res = await apiClient.get('/sports/groups');
            setAllGroups(res.data);
        } catch (error) { console.error("Error fetching groups"); }
    };

    const handleGroupPress = async (item) => {
        if (isStaff || item.is_member > 0) {
            setSelectedItem(item);
            setDetailTab('info');
            setDetailModalVisible(true);
            await fetchGroupDetails(item.id);
        } else {
            Alert.alert("Access Denied", "Join the group to view details.");
        }
    };

    const fetchGroupDetails = async (groupId) => {
        try {
            const membersRes = await apiClient.get(`/sports/groups/${groupId}/members`);
            setCurrentGroupMembers(membersRes.data);
            const annRes = await apiClient.get(`/sports/groups/${groupId}/announcements`);
            setGroupAnnouncements(annRes.data);
            const chatRes = await apiClient.get(`/sports/groups/${groupId}/messages`);
            setGroupMessages(chatRes.data);
            setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 500);
        } catch (e) { console.error(e); }
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;
        try {
            await apiClient.post(`/sports/groups/${selectedItem.id}/messages`, {
                message_text: chatInput,
                message_type: 'text' 
            });
            setChatInput('');
            const chatRes = await apiClient.get(`/sports/groups/${selectedItem.id}/messages`);
            setGroupMessages(chatRes.data);
        } catch (e) { Alert.alert("Error", "Failed to send"); }
    };

    const handleDeleteMessage = (msgId) => {
        Alert.alert("Delete Message", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    await apiClient.delete(`/sports/messages/${msgId}`);
                    setGroupMessages(prev => prev.filter(msg => msg.id !== msgId));
                } catch (e) { Alert.alert("Error", "Could not delete message."); }
            }}
        ]);
    };

    const handlePostAnnouncement = async () => {
        if (!announcementForm.title || !announcementForm.message) return Alert.alert("Error", "Title and Message required");
        try {
            await apiClient.post(`/sports/groups/${selectedItem.id}/announcements`, announcementForm);
            Alert.alert("Success", "Announcement Posted");
            setAnnouncementForm({ title: '', message: '', event_date: '' });
            const annRes = await apiClient.get(`/sports/groups/${selectedItem.id}/announcements`);
            setGroupAnnouncements(annRes.data);
        } catch (e) { Alert.alert("Error", "Failed to post"); }
    };

    // --- APPLICATION LOGIC ---

    const handleViewApplicants = async (applicationId) => {
        try {
            setLoading(true);
            const res = await apiClient.get(`/sports/applications/${applicationId}/entries`);
            setApplicantsList(res.data);
            setApplicantsModalVisible(true);
        } catch (error) {
            Alert.alert("Error", "Failed to fetch applicants");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (entryId, newStatus) => {
        try {
            await apiClient.put(`/sports/entries/${entryId}/status`, { status: newStatus });
            setApplicantsList(prev => prev.map(item => 
                item.id === entryId ? { ...item, status: newStatus } : item
            ));
        } catch (error) {
            Alert.alert("Error", "Failed to update status");
        }
    };

    // *** FIX: Apply Handler ***
    const handleApply = async (applicationId) => {
        setApplyingId(applicationId); // Start loading
        try {
            // This matches the UPDATED backend logic
            await apiClient.post('/sports/apply', { application_id: applicationId });
            
            Alert.alert("Success", "Application Submitted!");

            // Update local state to show 'Pending' immediately without reload
            setData(prevData => prevData.map(item => {
                if (item.id === applicationId) {
                    return { ...item, my_status: 'Pending' }; 
                }
                return item;
            }));

        } catch (error) {
            // Check for the specific 400 error from backend
            if (error.response && error.response.status === 400) {
                Alert.alert("Notice", "You have already applied.");
                fetchData(); // Sync if out of sync
            } else {
                console.error("Apply Error", error);
                Alert.alert("Error", "Could not submit application. Check connection.");
            }
        } finally {
            setApplyingId(null); // Stop loading
        }
    };

    // --- CRUD ---
    const handleOpenCreate = async () => {
        setIsEditMode(false); 
        setFormData({}); 
        setSelectedMemberIds([]); 
        setSelectedTeacherId(user?.role === 'teacher' ? user.id : null);
        
        if (activeTab === 'groups') await fetchUsersForSelection();
        if (activeTab === 'schedule') await fetchAllGroups(); 
        
        setFormModalVisible(true);
    };

    const handleOpenEdit = async (item) => {
        setIsEditMode(true); 
        setSelectedItem(item); 
        setFormData(item);
        
        if (activeTab === 'groups') {
            await fetchUsersForSelection();
            try {
                const res = await apiClient.get(`/sports/groups/${item.id}/members`);
                setSelectedMemberIds(res.data.map(m => m.id));
                setSelectedTeacherId(item.coach_id || null);
            } catch (e) { console.error(e); }
        }
        if (activeTab === 'schedule') {
             await fetchAllGroups();
        }
        setFormModalVisible(true);
    };

    const handleDelete = (id) => {
        Alert.alert("Delete?", "Confirm delete?", [{ text: "Cancel" }, { text: "Delete", onPress: async () => {
            try {
                let ep = activeTab === 'groups' ? `/sports/groups/${id}` : activeTab === 'schedule' ? `/sports/schedules/${id}` : `/sports/applications/${id}`;
                await apiClient.delete(ep); fetchData();
            } catch (e) { Alert.alert("Error"); }
        }}]);
    };

    const handleSubmit = async () => {
        try {
            let ep = activeTab === 'groups' ? '/sports/groups' : activeTab === 'schedule' ? '/sports/schedules' : '/sports/applications';
            let url = isEditMode ? `${ep}/${selectedItem.id}` : ep;
            let method = isEditMode ? 'put' : 'post';
            
            const pl = { ...formData };
            if (activeTab === 'groups') { pl.member_ids = selectedMemberIds; if (selectedTeacherId) pl.coach_id = selectedTeacherId; }
            if (activeTab === 'schedule') { if(!pl.event_date || !pl.event_time) return Alert.alert("Error", "Date and Time are required"); }

            await apiClient[method](url, pl);
            setFormModalVisible(false); 
            fetchData();
        } catch (e) { 
            console.error(e);
            Alert.alert("Error", "Operation Failed"); 
        }
    };

    const toggleMemberSelection = (studentId) => {
        if (selectedMemberIds.includes(studentId)) setSelectedMemberIds(prev => prev.filter(id => id !== studentId));
        else setSelectedMemberIds(prev => [...prev, studentId]);
    };

    const filteredStudents = useMemo(() => {
        return allStudents.filter(student => {
            const matchesClass = filterClass === 'All' || student.class_group === filterClass;
            const matchesSearch = student.full_name.toLowerCase().includes(searchText.toLowerCase()) || 
                                  (student.roll_no && student.roll_no.includes(searchText));
            return matchesClass && matchesSearch;
        });
    }, [allStudents, filterClass, searchText]);

    const showDatePicker = (field, mode = 'date', currentValue = '') => {
        let initial = new Date();
        if (mode === 'time' && currentValue) {
            const [hours, minutes] = currentValue.split(':');
            if(hours && minutes) initial.setHours(parseInt(hours), parseInt(minutes), 0);
        } else if (currentValue && currentValue.includes('-')) {
            const d = new Date(currentValue);
            if (!isNaN(d.getTime())) initial = d;
        }
        setDatePicker({ show: true, mode, field, initialValue: initial });
    };

    const onDateChange = (event, selectedDate) => {
        setDatePicker({ ...datePicker, show: false });
        if (selectedDate) {
            let val = datePicker.mode === 'time' ? selectedDate.toTimeString().split(' ')[0] : selectedDate.toISOString().split('T')[0];
            if(datePicker.field === 'ann_event_date') setAnnouncementForm({...announcementForm, event_date: val});
            else setFormData({ ...formData, [datePicker.field]: val });
        }
    };

    const getSportIcon = (cat) => {
        const map = { 'Football': 'soccer', 'Cricket': 'cricket', 'Volleyball': 'volleyball', 'Chess': 'chess-king', 'Swimming': 'swim' };
        return map[cat] || 'trophy';
    };

    // --- CARD RENDERERS ---
    const renderGroupCard = ({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => handleGroupPress(item)} activeOpacity={0.8}>
            <View style={styles.iconBox}><Icon name={getSportIcon(item.category)} size={30} color={COLORS.white} /></View>
            <View style={styles.cardContent}>
                <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    {isStaff && <View style={styles.actionIcons}>
                        <TouchableOpacity onPress={() => handleOpenEdit(item)}><Icon name="pencil" size={20} color={COLORS.secondary} style={{marginRight:10}} /></TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(item.id)}><Icon name="trash-can" size={20} color={COLORS.primary} /></TouchableOpacity>
                    </View>}
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

    const renderScheduleCard = ({ item }) => (
        <View style={styles.scheduleCard}>
            <View style={styles.dateBox}>
                <Text style={styles.dateDay}>{item.event_date ? new Date(item.event_date).getDate() : '--'}</Text>
                <Text style={styles.dateMonth}>{item.event_date ? new Date(item.event_date).toLocaleString('default', { month: 'short' }) : '--'}</Text>
            </View>
            <View style={styles.cardContent}>
                <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {isStaff && (
                        <View style={styles.actionIcons}>
                            <TouchableOpacity onPress={() => handleOpenEdit(item)} style={{marginRight: 10}}><Icon name="pencil" size={20} color={COLORS.secondary} /></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}><Icon name="trash-can" size={20} color={COLORS.primary} /></TouchableOpacity>
                        </View>
                    )}
                </View>
                <Text style={styles.cardSubtitle}>{(item.event_time ? item.event_time.toString().slice(0,5) : 'N/A')} • {item.group_name || 'General'}</Text>
                <Text style={styles.cardDesc}><Icon name="map-marker" size={12}/> {item.venue}</Text>
            </View>
        </View>
    );

    const renderApplicationCard = ({ item }) => {
        const isExpired = item.deadline ? new Date(item.deadline) < new Date() : false;
        
        // Status from backend: 'Pending', 'Approved', 'Rejected'
        const myStatus = item.my_status;
        const isProcessing = applyingId === item.id;

        let statusColor = COLORS.green; 
        if (myStatus === 'Pending') statusColor = COLORS.orange;
        if (myStatus === 'Rejected') statusColor = COLORS.red;

        return (
            <View style={styles.card}>
                <View style={[styles.statusLine, { backgroundColor: item.status === 'Closed' || isExpired ? COLORS.grey : COLORS.green }]} />
                <View style={{ padding: 15, width: '100%' }}>
                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        {isStaff ? (
                            <View style={styles.actionIcons}>
                                <TouchableOpacity onPress={() => handleOpenEdit(item)}><Icon name="pencil" size={20} color={COLORS.secondary} style={{marginRight:10}} /></TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(item.id)}><Icon name="trash-can" size={20} color={COLORS.primary} /></TouchableOpacity>
                            </View>
                        ) : (
                            myStatus && <Text style={[styles.statusBadge, { color: statusColor }]}>{myStatus}</Text>
                        )}
                    </View>
                    <Text style={styles.cardDesc}>{item.description}</Text>
                    <Text style={styles.cardSubtitle}>Deadline: {item.deadline ? new Date(item.deadline).toLocaleDateString() : 'No Deadline'}</Text>
                    <View style={styles.actionRow}>
                        {isStaff ? (
                            <TouchableOpacity style={styles.adminBtn} onPress={() => handleViewApplicants(item.id)}><Text style={styles.adminBtnText}>View Applicants</Text></TouchableOpacity>
                        ) : (
                            <TouchableOpacity 
                                style={[styles.applyBtn, (myStatus || isExpired || isProcessing) && styles.disabledBtn]} 
                                onPress={() => handleApply(item.id)} 
                                disabled={!!myStatus || isExpired || isProcessing}
                            >
                                {isProcessing ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.applyBtnText}>{myStatus ? (myStatus === 'Approved' ? 'Joined' : 'Applied') : isExpired ? 'Expired' : 'Apply Now'}</Text>}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Icon name="arrow-left" size={26} color={COLORS.text} /></TouchableOpacity>
                    <Text style={styles.headerTitle}>Sports & Activities</Text>
                </View>
                {isStaff && <TouchableOpacity onPress={handleOpenCreate}><Icon name="plus" size={28} color={COLORS.primary} /></TouchableOpacity>}
            </View>
            <View style={styles.tabContainer}>
                {['groups', 'schedule', 'applications'].map(tab => (
                    <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop:50}}/> : (
                <FlatList
                    data={data}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={activeTab === 'groups' ? renderGroupCard : activeTab === 'schedule' ? renderScheduleCard : renderApplicationCard}
                    contentContainerStyle={{ padding: 15 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
                    ListEmptyComponent={<Text style={styles.emptyText}>No records found.</Text>}
                />
            )}

            {/* Modals omitted for brevity, they remain unchanged from the previous correct version */}
             <Modal visible={detailModalVisible} animationType="slide" transparent={false}>
                <SafeAreaView style={{flex: 1, backgroundColor: COLORS.bg}}>
                    <View style={styles.modalFullHeader}>
                        <TouchableOpacity onPress={() => setDetailModalVisible(false)}><Icon name="arrow-left" size={24} color={COLORS.white} /></TouchableOpacity>
                        <Text style={styles.modalFullTitle}>{selectedItem?.name}</Text>
                        <View style={{width:24}} />
                    </View>
                    <View style={styles.detailTabRow}>
                        {['info', 'announcements', 'chat'].map(t => (
                            <TouchableOpacity key={t} style={[styles.detailTab, detailTab === t && styles.detailTabActive]} onPress={() => setDetailTab(t)}>
                                <Icon name={t === 'info' ? 'information-outline' : t === 'announcements' ? 'bullhorn-outline' : 'chat-outline'} size={20} color={detailTab === t ? COLORS.primary : COLORS.grey} />
                                <Text style={[styles.detailTabText, detailTab === t && {color: COLORS.primary}]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={{flex: 1, padding: 10}}>
                        {detailTab === 'info' && (
                            <ScrollView>
                                <View style={styles.infoCard}>
                                    <Text style={styles.sectionHeader}>Description</Text>
                                    <Text style={styles.infoText}>{selectedItem?.description || 'No description.'}</Text>
                                </View>
                                <Text style={styles.sectionHeader}>Coach</Text>
                                <View style={[styles.memberItem, {borderLeftWidth: 4, borderLeftColor: COLORS.primary}]}>
                                    <View style={[styles.avatarPlaceholder, {backgroundColor: COLORS.primary}]}><Text style={styles.avatarText}>{selectedItem?.coach_name ? selectedItem.coach_name.charAt(0) : '?'}</Text></View>
                                    <View><Text style={styles.memberName}>{selectedItem?.coach_name || 'No Coach Assigned'}</Text><Text style={styles.memberClass}>Teacher / Admin</Text></View>
                                </View>
                                <Text style={styles.sectionHeader}>Members ({currentGroupMembers.length})</Text>
                                {currentGroupMembers.map((m) => (
                                    <View key={m.id} style={styles.memberItem}>
                                        <View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>{m.full_name.charAt(0)}</Text></View>
                                        <View><Text style={styles.memberName}>{m.full_name}</Text><Text style={styles.memberClass}>{m.class_group}</Text></View>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                        {detailTab === 'announcements' && (
                            <View style={{flex: 1}}>
                                {isStaff && (
                                    <View style={styles.postAnnounceBox}>
                                        <TextInput placeholder="Title" style={styles.inputSmall} value={announcementForm.title} onChangeText={t => setAnnouncementForm({...announcementForm, title: t})} />
                                        <TextInput placeholder="Message / Game Details" style={[styles.inputSmall, {height: 60}]} multiline value={announcementForm.message} onChangeText={t => setAnnouncementForm({...announcementForm, message: t})} />
                                        <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                                            <TouchableOpacity onPress={() => showDatePicker('ann_event_date', 'date')}><Text style={{color:COLORS.secondary, marginTop:5}}>{announcementForm.event_date ? announcementForm.event_date : '+ Add Game Date'}</Text></TouchableOpacity>
                                            <TouchableOpacity style={styles.postBtn} onPress={handlePostAnnouncement}><Text style={{color:'#FFF', fontWeight:'bold'}}>Post</Text></TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                                <FlatList
                                    data={groupAnnouncements}
                                    keyExtractor={(item) => item.id.toString()}
                                    renderItem={({item}) => (
                                        <View style={styles.announceCard}>
                                            <View style={{flexDirection:'row', justifyContent:'space-between'}}><Text style={styles.announceTitle}>{item.title}</Text><Text style={styles.announceDate}>{new Date(item.created_at).toLocaleDateString()}</Text></View>
                                            <Text style={styles.announceMsg}>{item.message}</Text>
                                            {item.event_date && <View style={styles.eventBadge}><Icon name="calendar-clock" size={16} color={COLORS.primary} /><Text style={{color: COLORS.primary, marginLeft:5, fontWeight:'bold'}}>Game: {new Date(item.event_date).toLocaleDateString()}</Text></View>}
                                        </View>
                                    )}
                                />
                            </View>
                        )}
                        {detailTab === 'chat' && (
                            <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                                <FlatList
                                    ref={chatListRef}
                                    data={groupMessages}
                                    keyExtractor={(item) => item.id.toString()}
                                    contentContainerStyle={{paddingBottom: 10}}
                                    onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: false })}
                                    renderItem={({item}) => {
                                        const isMe = item.sender_id === user.id;
                                        return (
                                            <TouchableOpacity onLongPress={() => isMe ? handleDeleteMessage(item.id) : null} activeOpacity={isMe ? 0.7 : 1} style={[styles.msgRow, isMe ? {alignSelf:'flex-end'} : {alignSelf:'flex-start'}]}>
                                                {!isMe && <Text style={styles.msgSender}>{item.sender_name}</Text>}
                                                <View style={[styles.msgBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}><Text style={styles.msgText}>{item.message_text}</Text><Text style={styles.msgTime}>{new Date(item.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Text></View>
                                            </TouchableOpacity>
                                        );
                                    }}
                                />
                                <View style={styles.chatInputBar}>
                                    <TextInput style={styles.chatInput} placeholder="Type a message..." value={chatInput} onChangeText={setChatInput} />
                                    <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}><Icon name="send" size={24} color={COLORS.white} /></TouchableOpacity>
                                </View>
                            </KeyboardAvoidingView>
                        )}
                    </View>
                </SafeAreaView>
                {datePicker.show && <DateTimePicker value={datePicker.initialValue} mode={datePicker.mode} onChange={onDateChange} is24Hour={true} />}
            </Modal>

            <Modal visible={formModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{isEditMode ? 'Edit' : 'Create'} {activeTab.slice(0, -1)}</Text>
                        <ScrollView>
                            {activeTab === 'groups' && (
                                <>
                                    <TextInput placeholder="Group Name" style={styles.input} value={formData.name} onChangeText={t => setFormData({...formData, name: t})} />
                                    <TextInput placeholder="Category (e.g., Football)" style={styles.input} value={formData.category} onChangeText={t => setFormData({...formData, category: t})} />
                                    <TextInput placeholder="Description" style={[styles.input, {height: 60}]} multiline value={formData.description} onChangeText={t => setFormData({...formData, description: t})} />
                                    <View style={styles.pickerContainer}>
                                        <Text style={styles.label}>Assign Coach (Optional):</Text>
                                        <View style={styles.pickerBox}>
                                            <Picker selectedValue={selectedTeacherId} onValueChange={setSelectedTeacherId} style={styles.picker}>
                                                <Picker.Item label="-- Select Teacher --" value={null} />
                                                {allTeachers.map((t) => <Picker.Item key={t.id} label={t.full_name} value={t.id} />)}
                                            </Picker>
                                        </View>
                                    </View>
                                    <TouchableOpacity style={styles.memberSelectorBtn} onPress={() => setMemberPickerVisible(true)}>
                                        <Icon name="account-plus" size={20} color={COLORS.primary} /><Text style={styles.memberSelectorText}>Select Members ({selectedMemberIds.length})</Text><Icon name="chevron-right" size={20} color={COLORS.grey} />
                                    </TouchableOpacity>
                                </>
                            )}
                            {activeTab === 'schedule' && (
                                <>
                                    <TextInput placeholder="Event Title (e.g. Cricket Match)" style={styles.input} value={formData.title} onChangeText={t => setFormData({...formData, title: t})} />
                                    <View style={styles.pickerContainer}>
                                        <Text style={styles.label}>Select Sports Group:</Text>
                                        <View style={styles.pickerBox}>
                                            <Picker 
                                                selectedValue={formData.group_id} 
                                                onValueChange={(val) => setFormData({...formData, group_id: val})} 
                                                style={styles.picker}>
                                                <Picker.Item label="-- General Event --" value={null} />
                                                {allGroups.map((g) => <Picker.Item key={g.id} label={g.name} value={g.id} />)}
                                            </Picker>
                                        </View>
                                    </View>
                                    <TouchableOpacity onPress={() => showDatePicker('event_date', 'date', formData.event_date)} style={styles.input}>
                                        <View style={{flexDirection:'row', alignItems:'center'}}>
                                            <Icon name="calendar" size={20} color={COLORS.grey} style={{marginRight:10}} />
                                            <Text style={{color: formData.event_date ? COLORS.text : '#999'}}>
                                                {formData.event_date || 'Select Date'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => showDatePicker('event_time', 'time', formData.event_time)} style={styles.input}>
                                        <View style={{flexDirection:'row', alignItems:'center'}}>
                                            <Icon name="clock-outline" size={20} color={COLORS.grey} style={{marginRight:10}} />
                                            <Text style={{color: formData.event_time ? COLORS.text : '#999'}}>
                                                {formData.event_time ? formData.event_time.slice(0,5) : 'Select Time'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                    <TextInput placeholder="Venue" style={styles.input} value={formData.venue} onChangeText={t => setFormData({...formData, venue: t})} />
                                </>
                            )}
                            {activeTab === 'applications' && (
                                <>
                                    <TextInput placeholder="Title" style={styles.input} value={formData.title} onChangeText={t => setFormData({...formData, title: t})} />
                                    <TextInput placeholder="Description" style={[styles.input, {height: 80}]} multiline value={formData.description} onChangeText={t => setFormData({...formData, description: t})} />
                                    <TouchableOpacity onPress={() => showDatePicker('deadline', 'date', formData.deadline)} style={styles.input}>
                                        <Text style={{color: formData.deadline ? COLORS.text : '#999'}}>{formData.deadline || 'Select Deadline'}</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </ScrollView>
                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={[styles.modalBtn, {backgroundColor: COLORS.grey}]} onPress={() => setFormModalVisible(false)}><Text style={styles.btnTxt}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, {backgroundColor: COLORS.primary}]} onPress={handleSubmit}><Text style={styles.btnTxt}>{isEditMode ? 'Update' : 'Create'}</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
                {datePicker.show && <DateTimePicker value={datePicker.initialValue} mode={datePicker.mode} onChange={onDateChange} is24Hour={true} />}
            </Modal>

            <Modal visible={memberPickerVisible} animationType="slide">
                <SafeAreaView style={{flex: 1, backgroundColor: COLORS.bg}}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Select Students</Text>
                        <TouchableOpacity onPress={() => setMemberPickerVisible(false)}><Icon name="check" size={28} color={COLORS.primary} /></TouchableOpacity>
                    </View>
                    <View style={styles.filterSection}>
                        <View style={styles.pickerBoxSmall}>
                            <Picker selectedValue={filterClass} onValueChange={setFilterClass} style={styles.picker}>
                                {availableClasses.map(c => <Picker.Item key={c} label={c === 'All' ? 'All Classes' : c} value={c} />)}
                            </Picker>
                        </View>
                        <View style={styles.searchBox}>
                            <Icon name="magnify" size={20} color={COLORS.grey} />
                            <TextInput placeholder="Search..." style={styles.searchInput} value={searchText} onChangeText={setSearchText} />
                        </View>
                    </View>
                    <FlatList
                        data={filteredStudents}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={{padding: 15}}
                        initialNumToRender={20}
                        maxToRenderPerBatch={20}
                        renderItem={({item}) => {
                            const isSelected = selectedMemberIds.includes(item.id);
                            return (
                                <TouchableOpacity style={[styles.memberRow, isSelected && styles.memberRowSelected]} onPress={() => toggleMemberSelection(item.id)}>
                                    <View>
                                        <Text style={[styles.memberName, isSelected && {color: COLORS.primary}]}>{item.full_name}</Text>
                                        <Text style={styles.memberInfo}>{item.class_group} • Roll: {item.roll_no || 'N/A'}</Text>
                                    </View>
                                    {isSelected ? <Icon name="checkbox-marked-circle" size={24} color={COLORS.primary} /> : <Icon name="checkbox-blank-circle-outline" size={24} color={COLORS.grey} />}
                                </TouchableOpacity>
                            )
                        }}
                        ListHeaderComponent={<Text style={styles.listHeader}>{selectedMemberIds.length} Students Selected</Text>}
                    />
                </SafeAreaView>
            </Modal>

            <Modal visible={applicantsModalVisible} animationType="slide">
                <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
                    <View style={[styles.header, { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
                        <Text style={styles.headerTitle}>Applicants</Text>
                        <TouchableOpacity onPress={() => setApplicantsModalVisible(false)}><Icon name="close" size={24} color={COLORS.text} /></TouchableOpacity>
                    </View>
                    <FlatList 
                        data={applicantsList}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={{ padding: 15 }}
                        ListEmptyComponent={<Text style={styles.emptyText}>No applicants yet.</Text>}
                        renderItem={({ item }) => (
                            <View style={styles.applicantRow}>
                                <View><Text style={styles.applicantName}>{item.full_name}</Text><Text style={styles.applicantClass}>{item.class_group}</Text></View>
                                <View style={{ flexDirection: 'row' }}>
                                    {item.status === 'Pending' ? (
                                        <>
                                            <TouchableOpacity onPress={() => handleUpdateStatus(item.id, 'Approved')} style={[styles.actionIcon, { backgroundColor: COLORS.green }]}><Icon name="check" size={18} color="#FFF" /></TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleUpdateStatus(item.id, 'Rejected')} style={[styles.actionIcon, { backgroundColor: COLORS.primary }]}><Icon name="close" size={18} color="#FFF" /></TouchableOpacity>
                                        </>
                                    ) : <Text style={{ color: item.status === 'Approved' ? COLORS.green : COLORS.primary, fontWeight: 'bold' }}>{item.status}</Text>}
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
    card: { flexDirection: 'row', backgroundColor: '#FFF', marginBottom: 12, borderRadius: 10, overflow: 'hidden', elevation: 2, marginHorizontal: 15 },
    iconBox: { width: 70, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
    cardContent: { flex: 1, padding: 12 },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, flex: 1 },
    actionIcons: { flexDirection: 'row' },
    iconBtn: { marginLeft: 10 },
    cardSubtitle: { fontSize: 12, color: COLORS.grey, marginBottom: 5 },
    cardDesc: { fontSize: 13, color: '#546E7A', marginBottom: 8 },
    badgeContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.lightGrey, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    badgeText: { fontSize: 11, marginLeft: 4, color: COLORS.text },
    scheduleCard: { flexDirection: 'row', backgroundColor: '#FFF', marginBottom: 10, borderRadius: 10, padding: 15, elevation: 2, marginHorizontal: 15 },
    dateBox: { backgroundColor: '#FFEBEE', padding: 10, borderRadius: 8, alignItems: 'center', marginRight: 15, minWidth: 55 },
    dateDay: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
    dateMonth: { fontSize: 12, color: COLORS.primary },
    modalFullHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, backgroundColor: COLORS.primary },
    modalFullTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    detailTabRow: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: COLORS.border },
    detailTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 5 },
    detailTabActive: { borderBottomWidth: 3, borderBottomColor: COLORS.primary },
    detailTabText: { fontWeight: '600', color: COLORS.grey, fontSize: 12 },
    infoCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 8, marginBottom: 15 },
    infoText: { color: COLORS.text, marginBottom: 5 },
    sectionHeader: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 5, color: COLORS.text },
    memberItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', backgroundColor: '#FFF', paddingHorizontal: 10 },
    avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    avatarText: { color: '#FFF', fontWeight: 'bold' },
    memberName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
    memberClass: { fontSize: 12, color: COLORS.grey },
    msgRow: { flexDirection: 'row', marginBottom: 10, maxWidth: '80%' },
    msgBubble: { padding: 10, borderRadius: 10, elevation: 1 },
    bubbleMe: { backgroundColor: COLORS.chatBubbleUser, borderBottomRightRadius: 0 },
    bubbleOther: { backgroundColor: COLORS.chatBubbleOther, borderBottomLeftRadius: 0 },
    msgSender: { fontSize: 10, color: COLORS.grey, marginBottom: 2, marginLeft: 5 },
    msgText: { color: COLORS.text, fontSize: 14 },
    msgTime: { fontSize: 10, color: COLORS.grey, alignSelf: 'flex-end', marginTop: 2 },
    chatInputBar: { flexDirection: 'row', padding: 10, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: COLORS.border },
    chatInput: { flex: 1, backgroundColor: COLORS.lightGrey, borderRadius: 20, paddingHorizontal: 15, height: 40 },
    sendBtn: { marginLeft: 10, backgroundColor: COLORS.primary, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    postAnnounceBox: { backgroundColor: '#FFF', padding: 10, marginBottom: 10, borderRadius: 8 },
    announceCard: { backgroundColor: COLORS.announcementBg, padding: 15, borderRadius: 8, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: 'orange' },
    announceTitle: { fontWeight: 'bold', fontSize: 16, color: COLORS.text },
    announceDate: { fontSize: 12, color: COLORS.grey },
    announceMsg: { marginVertical: 5, color: COLORS.text },
    announceAuthor: { fontSize: 11, fontStyle: 'italic', color: COLORS.grey, marginTop: 5 },
    eventBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 5, backgroundColor: 'rgba(255,255,255,0.6)', padding: 4, alignSelf: 'flex-start', borderRadius: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#FFF', borderRadius: 10, padding: 20, maxHeight: '90%' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 5, padding: 10, marginBottom: 15, color: COLORS.text },
    inputSmall: { borderWidth: 1, borderColor: '#DDD', borderRadius: 5, padding: 8, marginBottom: 8, color: COLORS.text },
    modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    modalBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 5 },
    btnTxt: { color: '#FFF', fontWeight: 'bold' },
    memberSelectorBtn: { flexDirection: 'row', alignItems: 'center', justifyContent:'space-between', padding: 12, backgroundColor: '#E3F2FD', borderRadius: 5, marginBottom: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.secondary },
    memberSelectorText: { color: COLORS.secondary, fontWeight: '600', flex: 1, marginLeft: 10 },
    postBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 5 },
    statusLine: { width: 6 },
    actionRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end' },
    applyBtn: { backgroundColor: COLORS.secondary, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 5 },
    disabledBtn: { backgroundColor: COLORS.grey },
    applyBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
    adminBtn: { backgroundColor: COLORS.text, paddingVertical: 8, paddingHorizontal: 15, borderRadius: 5 },
    adminBtnText: { color: '#FFF', fontSize: 12 },
    statusBadge: { fontSize: 12, fontWeight: 'bold' },
    pickerContainer: { marginBottom: 15 },
    label: { fontSize: 14, color: COLORS.grey, marginBottom: 5 },
    pickerBox: { borderWidth: 1, borderColor: '#DDD', borderRadius: 5 },
    pickerBoxSmall: { flex: 1, borderWidth: 1, borderColor: '#DDD', borderRadius: 5, height: 45, justifyContent: 'center', marginRight: 10 },
    picker: { width: '100%', color: '#000' },
    filterSection: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    searchBox: { flex: 1.5, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DDD', borderRadius: 5, paddingHorizontal: 10, height: 45 },
    searchInput: { flex: 1, marginLeft: 5, color: '#000' },
    memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    memberRowSelected: { backgroundColor: '#E8F5E9' },
    memberInfo: { fontSize: 12, color: COLORS.grey },
    listHeader: { padding: 10, fontSize: 14, fontWeight: 'bold', color: COLORS.secondary, backgroundColor: '#E3F2FD' },
    sectionTitleBox: { backgroundColor: '#F5F5F5', padding: 8, borderRadius: 4, marginBottom: 10 },
    sectionTitleText: { fontWeight: 'bold', color: COLORS.text },
    applicantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#FFF', marginBottom: 1, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    applicantName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
    applicantClass: { fontSize: 12, color: COLORS.grey },
    actionIcon: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginLeft: 10 }
});

export default SportsScreen;