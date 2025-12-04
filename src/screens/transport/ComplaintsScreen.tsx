import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
    SafeAreaView,
    Image,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// Icons
const SEND_ICON = 'https://cdn-icons-png.flaticon.com/128/60/60525.png';
const BACK_ICON = 'https://cdn-icons-png.flaticon.com/128/271/271220.png';

const ComplaintsScreen = () => {
    const { user } = useAuth();
    
    // --- STATE ---
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Create Modal State
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [newSubject, setNewSubject] = useState('');
    const [newDescription, setNewDescription] = useState('');

    // Chat Modal State
    const [chatModalVisible, setChatModalVisible] = useState(false);
    const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingChat, setLoadingChat] = useState(false);
    
    const flatListRef = useRef<FlatList>(null);

    // --- 1. ACCESS CONTROL ---
    if (user?.role === 'teacher') {
        return (
            <View style={styles.restrictedContainer}>
                <Text style={styles.restrictedTitle}>Access Restricted</Text>
                <Text style={styles.restrictedText}>Teachers are not authorized to view this page.</Text>
            </View>
        );
    }

    // --- 2. DATA FETCHING ---
    useEffect(() => {
        fetchComplaints();
    }, []);

    const fetchComplaints = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/complaints');
            setComplaints(res.data);
        } catch (error) {
            console.error("Fetch Error", error);
        } finally {
            setLoading(false);
        }
    };

    // --- 3. ACTIONS ---
    const handleCreateComplaint = async () => {
        if (!newSubject || !newDescription) return Alert.alert('Error', 'Please fill all fields');
        try {
            await apiClient.post('/complaints', { subject: newSubject, description: newDescription });
            setCreateModalVisible(false);
            setNewSubject('');
            setNewDescription('');
            fetchComplaints();
            Alert.alert('Success', 'Complaint submitted.');
        } catch (error) {
            Alert.alert('Error', 'Failed to submit.');
        }
    };

    const handleUpdateStatus = async (status: string) => {
        if (!selectedComplaint) return;
        try {
            await apiClient.put(`/complaints/${selectedComplaint.id}/status`, { status });
            
            // Update local state
            setSelectedComplaint({ ...selectedComplaint, status });
            
            // Update list state
            setComplaints((prev: any) => 
                prev.map((item: any) => item.id === selectedComplaint.id ? { ...item, status } : item)
            );
            
            Alert.alert("Updated", `Complaint marked as ${status}`);
        } catch (error) {
            Alert.alert('Error', 'Failed to update status');
        }
    };

    // --- 4. CHAT LOGIC ---
    const openChat = (complaint: any) => {
        setSelectedComplaint(complaint);
        setChatModalVisible(true);
        fetchMessages(complaint.id);
    };

    const fetchMessages = async (complaintId: number) => {
        setLoadingChat(true);
        try {
            const res = await apiClient.get(`/complaints/${complaintId}/messages`);
            setMessages(res.data);
        } catch (error) {
            console.log(error);
        } finally {
            setLoadingChat(false);
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedComplaint) return;
        
        try {
            await apiClient.post(`/complaints/${selectedComplaint.id}/messages`, { message: newMessage });
            setNewMessage('');
            fetchMessages(selectedComplaint.id); // Refresh chat
        } catch (error) {
            Alert.alert("Error", "Chat is closed or message failed.");
        }
    };

    // --- 5. RENDERERS ---
    
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'resolved': return '#38A169'; // Green
            case 'dismissed': return '#E53E3E'; // Red
            default: return '#D69E2E'; // Yellow
        }
    };

    // Main List Item
    const renderComplaintItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.card} onPress={() => openChat(item)}>
            <View style={styles.cardHeader}>
                <View style={{flex: 1}}>
                    {user?.role === 'admin' && (
                        <Text style={styles.userInfo}>{item.full_name} ({item.user_role})</Text>
                    )}
                    <Text style={styles.subject}>{item.subject}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
                </View>
            </View>
            <Text numberOfLines={2} style={styles.descriptionPreview}>{item.description}</Text>
            <Text style={styles.date}>{new Date(item.created_at).toDateString()}</Text>
        </TouchableOpacity>
    );

    // Chat Message Item
    const renderMessageItem = ({ item }: { item: any }) => {
        const isMe = item.sender_id === user?.id;
        return (
            <View style={[styles.msgWrapper, isMe ? styles.msgRight : styles.msgLeft]}>
                {!isMe && <Text style={styles.senderName}>{item.full_name}</Text>}
                <View style={[styles.msgBubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
                    <Text style={[styles.msgText, isMe ? {color:'white'} : {color:'#2D3748'}]}>{item.message}</Text>
                </View>
                <Text style={styles.msgTime}>
                    {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>
                    {user?.role === 'admin' ? 'Complaint Inbox' : 'My Complaints'}
                </Text>
            </View>

            {loading ? <ActivityIndicator size="large" color="#4A5568" style={{marginTop: 50}} /> : (
                <FlatList 
                    data={complaints}
                    keyExtractor={(item: any) => item.id.toString()}
                    renderItem={renderComplaintItem}
                    contentContainerStyle={{ padding: 16 }}
                    ListEmptyComponent={<Text style={styles.emptyText}>No complaints found.</Text>}
                />
            )}

            {/* Raise Complaint FAB (Non-Admins) */}
            {user?.role !== 'admin' && (
                <TouchableOpacity style={styles.fab} onPress={() => setCreateModalVisible(true)}>
                    <Text style={styles.fabText}>+</Text>
                </TouchableOpacity>
            )}

            {/* --- MODAL 1: Create Complaint --- */}
            <Modal visible={createModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Raise Complaint</Text>
                        <TextInput placeholder="Subject" style={styles.input} value={newSubject} onChangeText={setNewSubject} />
                        <TextInput 
                            placeholder="Description..." 
                            style={[styles.input, styles.textArea]} 
                            value={newDescription} 
                            onChangeText={setNewDescription}
                            multiline 
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.cancelBtn}><Text>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={handleCreateComplaint} style={styles.submitBtn}><Text style={styles.submitText}>Submit</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* --- MODAL 2: Chat / Details --- */}
            <Modal visible={chatModalVisible} animationType="slide" onRequestClose={() => setChatModalVisible(false)}>
                <SafeAreaView style={styles.chatContainer}>
                    {/* Chat Header */}
                    <View style={styles.chatHeader}>
                        <TouchableOpacity onPress={() => setChatModalVisible(false)} style={{padding:5}}>
                            <Image source={{ uri: BACK_ICON }} style={{ width: 24, height: 24, tintColor:'#2D3748' }} />
                        </TouchableOpacity>
                        <View style={{flex:1, marginLeft: 15}}>
                            <Text style={styles.chatTitle}>{selectedComplaint?.subject}</Text>
                            <Text style={{color: getStatusColor(selectedComplaint?.status), fontWeight:'bold', fontSize:12}}>
                                {selectedComplaint?.status?.toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    {/* Admin Actions (Only if Pending) */}
                    {user?.role === 'admin' && selectedComplaint?.status === 'pending' && (
                        <View style={styles.adminPanel}>
                            <Text style={{fontSize:12, color:'#718096', marginBottom:5}}>Admin Actions:</Text>
                            <View style={{flexDirection:'row'}}>
                                <TouchableOpacity onPress={() => handleUpdateStatus('resolved')} style={[styles.statusBtn, {backgroundColor:'#38A169'}]}>
                                    <Text style={{color:'white', fontWeight:'bold'}}>Mark Solved</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleUpdateStatus('dismissed')} style={[styles.statusBtn, {backgroundColor:'#E53E3E'}]}>
                                    <Text style={{color:'white', fontWeight:'bold'}}>Reject</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Original Complaint Description */}
                    <View style={styles.originalPost}>
                        <Text style={{color:'#718096', fontSize:12, marginBottom:4}}>Description:</Text>
                        <Text style={{color:'#2D3748'}}>{selectedComplaint?.description}</Text>
                    </View>

                    {/* Chat Messages */}
                    {loadingChat ? <ActivityIndicator color="#3182CE" style={{marginTop:20}} /> : (
                        <FlatList 
                            ref={flatListRef}
                            data={messages}
                            keyExtractor={(item: any) => item.id.toString()}
                            renderItem={renderMessageItem}
                            contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
                            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        />
                    )}

                    {/* Input Area */}
                    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
                        {selectedComplaint?.status === 'pending' ? (
                            <View style={styles.inputArea}>
                                <TextInput 
                                    style={styles.chatInput} 
                                    placeholder="Type a message..." 
                                    value={newMessage}
                                    onChangeText={setNewMessage}
                                />
                                <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
                                    <Image source={{ uri: SEND_ICON }} style={{ width: 20, height: 20, tintColor:'white' }} />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.closedBanner}>
                                <Text style={{color:'white', fontWeight:'bold'}}>Chat Closed ({selectedComplaint?.status})</Text>
                            </View>
                        )}
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F7FAFC' },
    restrictedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    restrictedTitle: { fontSize: 22, fontWeight: 'bold', color: '#E53E3E' },
    restrictedText: { fontSize: 16, color: '#4A5568', marginTop: 5 },

    // Header
    header: { padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#2D3748' },

    // List Item
    card: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 12, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
    userInfo: { fontSize: 11, color: '#718096', fontStyle: 'italic' },
    subject: { fontSize: 16, fontWeight: 'bold', color: '#2D3748' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    statusText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
    descriptionPreview: { fontSize: 13, color: '#4A5568', marginBottom: 5 },
    date: { fontSize: 11, color: '#A0AEC0', textAlign: 'right' },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#A0AEC0' },

    // FAB
    fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#E53E3E', justifyContent: 'center', alignItems: 'center', elevation: 5 },
    fabText: { fontSize: 30, color: 'white', paddingBottom: 3 },

    // Create Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 10, padding: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 5, padding: 10, marginBottom: 15 },
    textArea: { height: 100, textAlignVertical: 'top' },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    cancelBtn: { padding: 10 },
    submitBtn: { backgroundColor: '#E53E3E', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 5 },
    submitText: { color: 'white', fontWeight: 'bold' },

    // --- CHAT STYLES ---
    chatContainer: { flex: 1, backgroundColor: '#F7FAFC' },
    chatHeader: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#E2E8F0' },
    chatTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D3748' },
    
    adminPanel: { padding: 10, backgroundColor: '#FEFCBF', borderBottomWidth: 1, borderColor: '#F6E05E' },
    statusBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 5, marginRight: 10 },
    
    originalPost: { padding: 15, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#E2E8F0' },

    // Messages
    msgWrapper: { marginBottom: 15, maxWidth: '80%' },
    msgLeft: { alignSelf: 'flex-start' },
    msgRight: { alignSelf: 'flex-end' },
    senderName: { fontSize: 10, color: '#718096', marginBottom: 2, marginLeft: 2 },
    msgBubble: { padding: 10, borderRadius: 12 },
    bubbleLeft: { backgroundColor: 'white', borderBottomLeftRadius: 0, borderWidth: 1, borderColor: '#E2E8F0' },
    bubbleRight: { backgroundColor: '#3182CE', borderBottomRightRadius: 0 },
    msgText: { fontSize: 14 },
    msgTime: { fontSize: 10, color: '#A0AEC0', alignSelf: 'flex-end', marginTop: 2, marginRight: 2 },

    // Input Area
    inputArea: { flexDirection: 'row', padding: 10, backgroundColor: 'white', borderTopWidth: 1, borderColor: '#E2E8F0' },
    chatInput: { flex: 1, backgroundColor: '#EDF2F7', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, marginRight: 10 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3182CE', justifyContent: 'center', alignItems: 'center' },
    
    closedBanner: { padding: 15, backgroundColor: '#718096', alignItems: 'center' }
});

export default ComplaintsScreen;