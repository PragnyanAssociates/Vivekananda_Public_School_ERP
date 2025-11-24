import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    primary: '#D32F2F', // Sports Red
    secondary: '#1976D2', // Blue
    bg: '#F5F7FA',
    white: '#FFF',
    text: '#263238',
    grey: '#78909C',
    lightGrey: '#ECEFF1',
    green: '#388E3C',
    border: '#E0E0E0',
    chatBubbleUser: '#E3F2FD',
    chatBubbleOther: '#FFFFFF',
    announcementBg: '#FFF3E0'
};

const SportsScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth(); 
    const isStaff = user?.role === 'admin' || user?.role === 'teacher';

    // Main Screen State
    const [activeTab, setActiveTab] = useState('groups');
    const [showMyGroupsOnly, setShowMyGroupsOnly] = useState(false);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    // --- MODAL STATES ---
    const [formModalVisible, setFormModalVisible] = useState(false);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [memberPickerVisible, setMemberPickerVisible] = useState(false);
    const [applicantsModalVisible, setApplicantsModalVisible] = useState(false);

    // --- GROUP DETAIL SUB-TABS ---
    const [detailTab, setDetailTab] = useState('info'); // info, announcements, chat

    // --- DATA STATES ---
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [allTeachers, setAllTeachers] = useState<any[]>([]);
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    
    const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
    const [filterClass, setFilterClass] = useState<string>('All');
    const [searchText, setSearchText] = useState('');

    const [currentGroupMembers, setCurrentGroupMembers] = useState<any[]>([]);
    const [groupAnnouncements, setGroupAnnouncements] = useState<any[]>([]);
    const [groupMessages, setGroupMessages] = useState<any[]>([]);
    const [applicantsList, setApplicantsList] = useState([]);

    // --- FORM DATA ---
    const [formData, setFormData] = useState<any>({});
    const [chatInput, setChatInput] = useState('');
    const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', event_date: '' });
    const [datePicker, setDatePicker] = useState({ show: false, mode: 'date', field: '' });
    
    const chatListRef = useRef<FlatList>(null);

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

    useEffect(() => { fetchData(); }, [fetchData]);

    const onRefresh = () => { setRefreshing(true); fetchData(); };

    // --- GROUP INTERACTION DATA FETCHERS ---
    const fetchGroupDetails = async (groupId: number) => {
        try {
            const membersRes = await apiClient.get(`/sports/groups/${groupId}/members`);
            setCurrentGroupMembers(membersRes.data);
            
            const annRes = await apiClient.get(`/sports/groups/${groupId}/announcements`);
            setGroupAnnouncements(annRes.data);

            const chatRes = await apiClient.get(`/sports/groups/${groupId}/messages`);
            setGroupMessages(chatRes.data);
        } catch (e) { console.error(e); }
    };

    // --- SEND MESSAGE ---
    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;
        try {
            await apiClient.post(`/sports/groups/${selectedItem.id}/messages`, {
                message_text: chatInput,
                message_type: 'text' 
            });
            setChatInput('');
            // Refresh chat without closing keyboard or full reload
            const chatRes = await apiClient.get(`/sports/groups/${selectedItem.id}/messages`);
            setGroupMessages(chatRes.data);
        } catch (e) { Alert.alert("Error", "Failed to send"); }
    };

    // --- DELETE MESSAGE ---
    const handleDeleteMessage = (msgId: number) => {
        Alert.alert(
            "Delete Message", 
            "Are you sure you want to delete this message?", 
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: async () => {
                    try {
                        await apiClient.delete(`/sports/messages/${msgId}`);
                        // Remove locally to update UI immediately
                        setGroupMessages(prev => prev.filter(msg => msg.id !== msgId));
                    } catch (e) {
                        Alert.alert("Error", "Could not delete message.");
                    }
                }}
            ]
        );
    };

    // --- POST ANNOUNCEMENT ---
    const handlePostAnnouncement = async () => {
        if (!announcementForm.title || !announcementForm.message) return Alert.alert("Error", "Title and Message required");
        try {
            await apiClient.post(`/sports/groups/${selectedItem.id}/announcements`, announcementForm);
            Alert.alert("Success", "Announcement Posted");
            setAnnouncementForm({ title: '', message: '', event_date: '' });
            // Refresh
            const annRes = await apiClient.get(`/sports/groups/${selectedItem.id}/announcements`);
            setGroupAnnouncements(annRes.data);
        } catch (e) { Alert.alert("Error", "Failed to post"); }
    };

    // --- UTILS ---
    const fetchUsersForSelection = async () => {
        try {
            const res = await apiClient.get('/users/sports/search');
            setAllStudents(res.data.students);
            setAllTeachers(res.data.teachers);
            setAvailableClasses(['All', ...res.data.classes]);
        } catch (error) { console.error("Error fetching users"); }
    };

    const handleGroupPress = async (item: any) => {
        if (isStaff || item.is_member > 0) {
            setSelectedItem(item);
            setDetailTab('info'); // Reset to info tab
            setDetailModalVisible(true);
            await fetchGroupDetails(item.id);
        } else {
            Alert.alert("Access Denied", "Join the group to view details.");
        }
    };

    // --- CRUD HANDLERS ---
    const handleOpenCreate = async () => {
        setIsEditMode(false); setFormData({}); setSelectedMemberIds([]); setSelectedTeacherId(user?.role === 'teacher' ? user.id : null);
        setFormModalVisible(true);
        if (activeTab === 'groups') await fetchUsersForSelection();
    };
    const handleOpenEdit = async (item: any) => {
        setIsEditMode(true); setSelectedItem(item); setFormData(item);
        if (activeTab === 'groups') {
            await fetchUsersForSelection();
            try {
                const res = await apiClient.get(`/sports/groups/${item.id}/members`);
                setSelectedMemberIds(res.data.map((m: any) => m.id));
                setSelectedTeacherId(item.coach_id || null);
            } catch (e) { console.error(e); }
        }
        setFormModalVisible(true);
    };
    const handleDelete = (id: number) => {
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
            await apiClient[method](url, pl);
            setFormModalVisible(false); fetchData();
        } catch (e) { Alert.alert("Error"); }
    };

    const toggleMemberSelection = (studentId: number) => {
        if (selectedMemberIds.includes(studentId)) setSelectedMemberIds(prev => prev.filter(id => id !== studentId));
        else setSelectedMemberIds(prev => [...prev, studentId]);
    };

    // Filter Data for "My Groups"
    const filteredData = showMyGroupsOnly && activeTab === 'groups' 
        ? data.filter((item: any) => item.is_member > 0) 
        : data;

    // Filter Students for Picker
    const filteredStudents = useMemo(() => {
        return allStudents.filter(student => {
            const matchesClass = filterClass === 'All' || student.class_group === filterClass;
            const matchesSearch = student.full_name.toLowerCase().includes(searchText.toLowerCase()) || 
                                  (student.roll_no && student.roll_no.includes(searchText));
            return matchesClass && matchesSearch;
        });
    }, [allStudents, filterClass, searchText]);

    // Date Picker logic
    const showDatePicker = (field: string, mode: any = 'date') => setDatePicker({ show: true, mode, field });
    const onDateChange = (event: any, selectedDate?: Date) => {
        setDatePicker({ ...datePicker, show: false });
        if (selectedDate) {
            let val = datePicker.mode === 'time' ? selectedDate.toTimeString().split(' ')[0] : selectedDate.toISOString().split('T')[0];
            if(datePicker.field === 'ann_event_date') setAnnouncementForm({...announcementForm, event_date: val});
            else setFormData({ ...formData, [datePicker.field]: val });
        }
    };

    const getSportIcon = (cat: string) => {
        const map: any = { 'Football': 'soccer', 'Cricket': 'cricket', 'Volleyball': 'volleyball', 'Chess': 'chess-king', 'Swimming': 'swim' };
        return map[cat] || 'trophy';
    };

    // --- CARD RENDERERS ---
    const renderGroupCard = ({ item }: any) => (
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

    const renderScheduleCard = ({ item }: any) => (
        <View style={styles.scheduleCard}>
            <View style={styles.dateBox}><Text style={styles.dateDay}>{new Date(item.event_date).getDate()}</Text><Text style={styles.dateMonth}>{new Date(item.event_date).toLocaleString('default', { month: 'short' })}</Text></View>
            <View style={styles.cardContent}><View style={styles.cardHeaderRow}><Text style={styles.cardTitle}>{item.title}</Text>{isStaff && <TouchableOpacity onPress={() => handleDelete(item.id)}><Icon name="trash-can" size={20} color={COLORS.primary} /></TouchableOpacity>}</View><Text style={styles.cardSubtitle}>{item.event_time} • {item.venue}</Text></View>
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
                        {isStaff ? <View style={styles.actionIcons}><TouchableOpacity onPress={() => handleOpenEdit(item)}><Icon name="pencil" size={20} color={COLORS.secondary} style={{marginRight:10}} /></TouchableOpacity><TouchableOpacity onPress={() => handleDelete(item.id)}><Icon name="trash-can" size={20} color={COLORS.primary} /></TouchableOpacity></View> : item.my_status && <Text style={[styles.statusBadge, { color: COLORS.green }]}>{item.my_status}</Text>}
                    </View>
                    <Text style={styles.cardDesc}>{item.description}</Text>
                    <Text style={styles.cardSubtitle}>Deadline: {new Date(item.deadline).toLocaleDateString()}</Text>
                    <View style={styles.actionRow}>
                        {isStaff ? (
                            <TouchableOpacity style={styles.adminBtn} onPress={() => handleViewApplicants(item.id)}><Text style={styles.adminBtnText}>View Applicants</Text></TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={[styles.applyBtn, (item.my_status || isExpired) && styles.disabledBtn]} onPress={() => handleApply(item.id)} disabled={!!item.my_status || isExpired}><Text style={styles.applyBtnText}>{item.my_status ? 'Applied' : isExpired ? 'Expired' : 'Apply Now'}</Text></TouchableOpacity>
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
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Icon name="arrow-left" size={26} color={COLORS.text} /></TouchableOpacity>
                    <Text style={styles.headerTitle}>Sports & Activities</Text>
                </View>
                {isStaff && <TouchableOpacity onPress={handleOpenCreate}><Icon name="plus" size={28} color={COLORS.primary} /></TouchableOpacity>}
            </View>

            {/* TABS */}
            <View style={styles.tabContainer}>
                {['groups', 'schedule', 'applications'].map(tab => (
                    <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* FILTER TOGGLE (Groups) */}
            {activeTab === 'groups' && (
                <View style={styles.filterRow}>
                    <TouchableOpacity style={[styles.filterChip, !showMyGroupsOnly && styles.filterChipActive]} onPress={() => setShowMyGroupsOnly(false)}><Text style={[styles.filterText, !showMyGroupsOnly && styles.filterTextActive]}>All Groups</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.filterChip, showMyGroupsOnly && styles.filterChipActive]} onPress={() => setShowMyGroupsOnly(true)}><Text style={[styles.filterText, showMyGroupsOnly && styles.filterTextActive]}>My Groups</Text></TouchableOpacity>
                </View>
            )}

            {/* LIST */}
            {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop:50}}/> : (
                <FlatList
                    data={filteredData}
                    keyExtractor={(item: any) => item.id.toString()}
                    renderItem={activeTab === 'groups' ? renderGroupCard : activeTab === 'schedule' ? renderScheduleCard : renderApplicationCard}
                    contentContainerStyle={{ padding: 15 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
                    ListEmptyComponent={<Text style={styles.emptyText}>No records found.</Text>}
                />
            )}

            {/* --- GROUP DETAIL MODAL (TABS: INFO, ANNOUNCE, CHAT) --- */}
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
                        {/* INFO TAB */}
                        {detailTab === 'info' && (
                            <ScrollView>
                                <View style={styles.infoCard}>
                                    <Text style={styles.sectionHeader}>Description</Text>
                                    <Text style={styles.infoText}>{selectedItem?.description || 'No description.'}</Text>
                                    <Text style={styles.infoText}>Coach: {selectedItem?.coach_name}</Text>
                                </View>
                                <Text style={styles.sectionHeader}>Members ({currentGroupMembers.length})</Text>
                                {currentGroupMembers.map((m: any) => (
                                    <View key={m.id} style={styles.memberItem}>
                                        <View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>{m.full_name.charAt(0)}</Text></View>
                                        <View><Text style={styles.memberName}>{m.full_name}</Text><Text style={styles.memberClass}>{m.class_group}</Text></View>
                                    </View>
                                ))}
                            </ScrollView>
                        )}

                        {/* ANNOUNCEMENTS TAB */}
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
                                    keyExtractor={(item: any) => item.id.toString()}
                                    renderItem={({item}) => (
                                        <View style={styles.announceCard}>
                                            <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                                                <Text style={styles.announceTitle}>{item.title}</Text>
                                                <Text style={styles.announceDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                                            </View>
                                            <Text style={styles.announceMsg}>{item.message}</Text>
                                            {item.event_date && <View style={styles.eventBadge}><Icon name="calendar-clock" size={16} color={COLORS.primary} /><Text style={{color: COLORS.primary, marginLeft:5, fontWeight:'bold'}}>Game: {new Date(item.event_date).toLocaleDateString()}</Text></View>}
                                            <Text style={styles.announceAuthor}>Posted by: {item.creator_name}</Text>
                                        </View>
                                    )}
                                />
                            </View>
                        )}

                        {/* CHAT TAB */}
                        {detailTab === 'chat' && (
                            <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                                <FlatList
                                    ref={chatListRef}
                                    data={groupMessages}
                                    keyExtractor={(item: any) => item.id.toString()}
                                    contentContainerStyle={{paddingBottom: 10}}
                                    onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: false })} // Auto-scroll to bottom
                                    renderItem={({item}) => {
                                        const isMe = item.sender_id === user.id;
                                        return (
                                            <TouchableOpacity 
                                                onLongPress={() => isMe ? handleDeleteMessage(item.id) : null}
                                                activeOpacity={isMe ? 0.7 : 1}
                                                style={[styles.msgRow, isMe ? {alignSelf:'flex-end'} : {alignSelf:'flex-start'}]}
                                            >
                                                {!isMe && <Text style={styles.msgSender}>{item.sender_name}</Text>}
                                                <View style={[styles.msgBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                                                    <Text style={[styles.msgText, isMe ? {color: COLORS.text} : {color: COLORS.text}]}>{item.message_text}</Text>
                                                    <Text style={styles.msgTime}>{new Date(item.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Text>
                                                </View>
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
                {datePicker.show && <DateTimePicker value={new Date()} mode={datePicker.mode as any} onChange={onDateChange} />}
            </Modal>

            {/* --- CREATE/EDIT MODAL (Groups/Schedule/Apps) --- */}
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
                                    
                                    {/* Teacher Selection */}
                                    <View style={styles.pickerContainer}>
                                        <Text style={styles.label}>Assign Coach (Optional):</Text>
                                        <View style={styles.pickerBox}>
                                            <Picker selectedValue={selectedTeacherId} onValueChange={setSelectedTeacherId} style={styles.picker}>
                                                <Picker.Item label="-- Select Teacher --" value={null} />
                                                {allTeachers.map((t: any) => <Picker.Item key={t.id} label={t.full_name} value={t.id} />)}
                                            </Picker>
                                        </View>
                                    </View>

                                    <TouchableOpacity style={styles.memberSelectorBtn} onPress={() => setMemberPickerVisible(true)}>
                                        <Icon name="account-plus" size={20} color={COLORS.primary} /><Text style={styles.memberSelectorText}>Select Members ({selectedMemberIds.length})</Text><Icon name="chevron-right" size={20} color={COLORS.grey} />
                                    </TouchableOpacity>
                                </>
                            )}
                            {/* Schedule Fields */}
                            {activeTab === 'schedule' && (
                                <>
                                    <TextInput placeholder="Event Title" style={styles.input} value={formData.title} onChangeText={t => setFormData({...formData, title: t})} />
                                    <TouchableOpacity onPress={() => showDatePicker('event_date', 'date')} style={styles.input}><Text>{formData.event_date || 'Select Date'}</Text></TouchableOpacity>
                                    <TouchableOpacity onPress={() => showDatePicker('event_time', 'time')} style={styles.input}><Text>{formData.event_time || 'Select Time'}</Text></TouchableOpacity>
                                    <TextInput placeholder="Venue" style={styles.input} value={formData.venue} onChangeText={t => setFormData({...formData, venue: t})} />
                                </>
                            )}
                            {/* Application Fields */}
                            {activeTab === 'applications' && (
                                <>
                                    <TextInput placeholder="Title" style={styles.input} value={formData.title} onChangeText={t => setFormData({...formData, title: t})} />
                                    <TextInput placeholder="Description" style={[styles.input, {height: 80}]} multiline value={formData.description} onChangeText={t => setFormData({...formData, description: t})} />
                                    <TouchableOpacity onPress={() => showDatePicker('deadline', 'date')} style={styles.input}><Text>{formData.deadline || 'Select Deadline'}</Text></TouchableOpacity>
                                </>
                            )}
                        </ScrollView>
                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={[styles.modalBtn, {backgroundColor: COLORS.grey}]} onPress={() => setFormModalVisible(false)}><Text style={styles.btnTxt}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, {backgroundColor: COLORS.primary}]} onPress={handleSubmit}><Text style={styles.btnTxt}>{isEditMode ? 'Update' : 'Create'}</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* --- MEMBER PICKER MODAL (Advanced) --- */}
            <Modal visible={memberPickerVisible} animationType="slide">
                <SafeAreaView style={{flex: 1, backgroundColor: COLORS.bg}}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Select Students</Text>
                        <TouchableOpacity onPress={() => setMemberPickerVisible(false)}><Icon name="check" size={28} color={COLORS.primary} /></TouchableOpacity>
                    </View>
                    
                    {/* Filters */}
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
                        keyExtractor={(item: any) => item.id.toString()}
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

            {/* --- APPLICANTS MODAL --- */}
            <Modal visible={applicantsModalVisible} animationType="slide">
                <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
                    <View style={[styles.header, { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
                        <Text style={styles.headerTitle}>Applicants</Text>
                        <TouchableOpacity onPress={() => setApplicantsModalVisible(false)}><Icon name="close" size={24} color={COLORS.text} /></TouchableOpacity>
                    </View>
                    <FlatList 
                        data={applicantsList}
                        keyExtractor={(item: any) => item.id.toString()}
                        contentContainerStyle={{ padding: 15 }}
                        renderItem={({ item }: any) => (
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
    filterRow: { flexDirection: 'row', padding: 10, gap: 10 },
    filterChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: COLORS.lightGrey },
    filterChipActive: { backgroundColor: COLORS.primary },
    filterText: { color: COLORS.text, fontSize: 12 },
    filterTextActive: { color: COLORS.white },
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
    input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 5, padding: 10, marginBottom: 15 },
    inputSmall: { borderWidth: 1, borderColor: '#DDD', borderRadius: 5, padding: 8, marginBottom: 8 },
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