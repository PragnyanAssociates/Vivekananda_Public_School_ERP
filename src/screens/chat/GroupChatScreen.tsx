import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image, Keyboard } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { io, Socket } from 'socket.io-client';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { getProfileImageSource } from '../../utils/imageHelpers';
import Video from 'react-native-video';
import EmojiPicker from 'rn-emoji-keyboard';

const THEME = { primary: '#007bff', text: '#212529', muted: '#86909c', border: '#dee2e6', myMessageBg: '#dcf8c6', otherMessageBg: '#ffffff', white: '#ffffff' };

const GroupChatScreen = () => {
    const { user } = useAuth();
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    
    const [group, setGroup] = useState(route.params.group);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [editingMessage, setEditingMessage] = useState<any>(null);
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

    const socketRef = useRef<Socket | null>(null);
    const flatListRef = useRef<FlatList | null>(null);

    const markAsSeen = useCallback(async () => {
        try {
            await apiClient.post(`/groups/${group.id}/seen`);
        } catch (error) {
            console.log("Failed to mark group as seen.");
        }
    }, [group.id]);

    useFocusEffect(useCallback(() => {
        markAsSeen();
        const fetchGroupDetails = async () => {
            try {
                const response = await apiClient.get(`/groups/${group.id}/details`);
                const updatedGroup = response.data;
                if (updatedGroup) {
                    setGroup(updatedGroup);
                }
            } catch (error) {
                console.log("Could not refetch group details.");
            }
        };
        fetchGroupDetails();
    }, [markAsSeen]));

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const response = await apiClient.get(`/groups/${group.id}/history`);
                setMessages(response.data);
            } catch (error) {
                Alert.alert("Error", "Could not load chat history.");
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();

        socketRef.current = io(SERVER_URL, { transports: ['websocket'] });
        socketRef.current.on('connect', () => {
            socketRef.current?.emit('joinGroup', { groupId: group.id });
        });
        socketRef.current.on('newMessage', (msg) => {
            if (msg.group_id === group.id) {
                setMessages(prev => [...prev, msg]);
            }
        });
        socketRef.current.on('messageDeleted', (id) => {
            setMessages(prev => prev.filter(msg => msg.id !== id));
        });
        socketRef.current.on('messageEdited', (msg) => {
            if (msg.group_id === group.id) {
                setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
            }
        });

        return () => {
            socketRef.current?.disconnect();
        };
    }, [group.id]);

    const sendMessage = (type: 'text' | 'image' | 'video', text: string | null, url: string | null) => {
        if (!user || !socketRef.current) return;
        
        socketRef.current.emit('sendMessage', {
            userId: user.id,
            groupId: group.id,
            messageType: type,
            messageText: text,
            fileUrl: url,
            replyToMessageId: replyingTo ? replyingTo.id : null,
        });

        if (type === 'text') setNewMessage('');
        setReplyingTo(null);
    };

    const uploadFileAndSendMessage = async (file: Asset, type: 'image' | 'video') => {
        const formData = new FormData();
        formData.append('media', { uri: file.uri, type: file.type, name: file.fileName });
        try {
            const res = await apiClient.post('/groups/media', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
            sendMessage(type, null, res.data.fileUrl);
        } catch (error) {
            Alert.alert("Upload Failed", "Could not send the file.");
        }
    };
    
    const handlePickMedia = () => {
        launchImageLibrary({ mediaType: 'mixed' }, (response) => {
            if (response.didCancel || !response.assets) return;
            const file = response.assets[0];
            const type = file.type?.startsWith('video') ? 'video' : 'image';
            uploadFileAndSendMessage(file, type);
        });
    };
    
    const handleSend = () => {
        if (!newMessage.trim()) return;
        if (editingMessage) {
            socketRef.current?.emit('editMessage', { messageId: editingMessage.id, newText: newMessage.trim(), userId: user?.id, groupId: group.id });
            setEditingMessage(null);
        } else {
            sendMessage('text', newMessage.trim(), null);
        }
        setNewMessage('');
        Keyboard.dismiss();
    };
    
    const onLongPressMessage = (message: any) => {
        if (!user) return;
        const options: any[] = [{ text: 'Cancel', style: 'cancel' }];
        options.push({ text: 'Reply', onPress: () => setReplyingTo(message) });
        if (message.user_id === user.id) {
            if (message.message_type === 'text') {
                options.push({ text: 'Edit', onPress: () => { setEditingMessage(message); setNewMessage(message.message_text); }});
            }
            options.push({ text: 'Delete for Everyone', style: 'destructive', onPress: () => handleDeleteMessage(message.id) });
        }
        Alert.alert('Message Options', '', options);
    };

    const handleDeleteMessage = (messageId: number) => {
        socketRef.current?.emit('deleteMessage', { messageId, userId: user?.id, groupId: group.id });
    };

    const cancelReply = () => setReplyingTo(null);
    const cancelEdit = () => { setEditingMessage(null); setNewMessage(''); Keyboard.dismiss(); };

    const renderMessageItem = ({ item }: { item: any }) => {
        const isMyMessage = item.user_id === user?.id;
        const messageTime = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const renderContent = () => {
            switch (item.message_type) {
                case 'image': return <Image source={{ uri: SERVER_URL + item.file_url }} style={styles.mediaMessage} />;
                case 'video': return <Video source={{ uri: SERVER_URL + item.file_url }} style={styles.mediaMessage} controls={false} paused resizeMode="cover" />;
                default: return <Text style={styles.messageText}>{item.message_text}</Text>;
            }
        };

        return (
            <TouchableOpacity onLongPress={() => onLongPressMessage(item)} activeOpacity={0.8}>
                <View style={[styles.messageRow, isMyMessage ? styles.myMessageRow : styles.otherMessageRow]}>
                    {!isMyMessage && (<Image source={getProfileImageSource(item.profile_image_url)} style={styles.senderDp} />)}
                    <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer, item.message_type !== 'text' && styles.mediaContainer]}>
                        {!isMyMessage && (
                            <View style={styles.senderInfo}>
                                <Text style={styles.senderName}>{item.full_name}</Text>
                                {item.role === 'student' && item.class_group && <Text style={styles.senderDetails}> ({item.class_group}{item.roll_no ? `, Roll: ${item.roll_no}` : ''})</Text>}
                            </View>
                        )}
                        {item.reply_to_message_id && (
                            <View style={[styles.replyContainer, isMyMessage ? styles.myReplyContainer : styles.otherReplyContainer]}>
                                <Text style={styles.replySenderName}>{item.reply_sender_name}</Text>
                                <Text style={styles.replyText} numberOfLines={1}>{item.reply_type === 'text' ? item.reply_text : 'Media'}</Text>
                            </View>
                        )}
                        {renderContent()}
                        <Text style={[styles.messageTime, (item.message_type === 'image' || item.message_type === 'video') ? styles.mediaTime : {}]}>
                            {item.is_edited ? 'Edited • ' : ''}{messageTime}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={{flex: 1, backgroundColor: THEME.white}}>
            <View style={styles.header}>
                <Icon name="arrow-left" size={24} color={THEME.primary} onPress={() => navigation.goBack()} style={{padding: 5}}/>
                <TouchableOpacity style={styles.headerContent} onPress={() => navigation.navigate('GroupSettings', { group })}>
                    <Image source={getProfileImageSource(group.group_dp_url)} style={styles.headerDp} />
                    <Text style={styles.headerTitle}>{group.name}</Text>
                </TouchableOpacity>
                <View style={{width: 34}} />
            </View>
            <KeyboardAvoidingView style={{flex: 1, backgroundColor: group.background_color || '#e5ddd5'}} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
                {loading ? <ActivityIndicator style={{flex: 1}} size="large" /> :
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessageItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ paddingVertical: 10, paddingBottom: 20 }}
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                />}
                <View>
                    {replyingTo && (
                        <View style={styles.replyingBanner}>
                            <Icon name="reply" size={18} color={THEME.primary} />
                            <View style={styles.replyingTextContainer}>
                                <Text style={styles.replyingToName}>{replyingTo.user_id === user?.id ? 'You' : replyingTo.full_name}</Text>
                                <Text numberOfLines={1}>{replyingTo.message_text || 'Media'}</Text>
                            </View>
                            <Icon name="close" size={20} color={THEME.muted} onPress={cancelReply} />
                        </View>
                    )}
                    {editingMessage && (<View style={styles.editingBanner}><Icon name="pencil" size={16} color={THEME.primary} /><Text style={styles.editingText}>Editing Message</Text><Icon name="close" size={20} color={THEME.muted} onPress={cancelEdit} /></View>)}
                    <View style={styles.inputContainer}>
                        <TouchableOpacity onPress={() => { Keyboard.dismiss(); setIsEmojiPickerOpen(true); }} style={styles.iconButton}><Icon name="emoticon-outline" size={24} color={THEME.muted} /></TouchableOpacity>
                        <TextInput style={styles.input} value={newMessage} onChangeText={setNewMessage} placeholder="Type a message..." multiline onFocus={()=>setIsEmojiPickerOpen(false)} />
                        <TouchableOpacity onPress={handlePickMedia} style={styles.iconButton}><Icon name="paperclip" size={24} color={THEME.muted} /></TouchableOpacity>
                        <TouchableOpacity style={styles.sendButton} onPress={handleSend}><Icon name={editingMessage ? "check" : "send"} size={24} color={THEME.white} /></TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
            <EmojiPicker onEmojiSelected={(emoji) => setNewMessage(prev => prev + emoji.emoji)} open={isEmojiPickerOpen} onClose={() => setIsEmojiPickerOpen(false)} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: THEME.border, backgroundColor: THEME.white, justifyContent: 'space-between' },
    headerContent: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', paddingVertical: 5 },
    headerDp: { width: 40, height: 40, borderRadius: 20, marginHorizontal: 10, backgroundColor: '#eee' },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    messageRow: { flexDirection: 'row', marginVertical: 5, paddingHorizontal: 10, alignItems: 'flex-end' },
    myMessageRow: { justifyContent: 'flex-end' },
    otherMessageRow: { justifyContent: 'flex-start' },
    senderDp: { width: 36, height: 36, borderRadius: 18, marginRight: 8, marginBottom: 5, backgroundColor: '#eee' },
    messageContainer: { maxWidth: '80%', padding: 10, borderRadius: 12, elevation: 1, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 1 },
    myMessageContainer: { backgroundColor: THEME.myMessageBg, borderBottomRightRadius: 2 },
    otherMessageContainer: { backgroundColor: THEME.otherMessageBg, borderBottomLeftRadius: 2 },
    mediaContainer: { padding: 5 },
    senderInfo: { flexDirection: 'row', marginBottom: 4, alignItems: 'baseline' },
    senderName: { fontWeight: 'bold', color: THEME.primary },
    senderDetails: { fontSize: 11, color: THEME.muted, marginLeft: 4 },
    messageText: { fontSize: 16, color: THEME.text },
    messageTime: { fontSize: 11, color: THEME.muted, alignSelf: 'flex-end', marginTop: 5, marginLeft: 10 },
    mediaTime: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', color: THEME.white, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, fontSize: 10 },
    editingBanner: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#eef', borderTopWidth: 1, borderColor: THEME.border },
    editingText: { flex: 1, marginLeft: 10, color: THEME.primary },
    replyingBanner: { flexDirection: 'row', alignItems: 'center', padding: 10, paddingLeft: 15, backgroundColor: '#f0f0f0', borderTopWidth: 1, borderColor: THEME.border },
    replyingTextContainer: { flex: 1, marginLeft: 10, borderLeftWidth: 3, borderLeftColor: THEME.primary, paddingLeft: 10 },
    replyingToName: { fontWeight: 'bold', color: THEME.primary },
    inputContainer: { flexDirection: 'row', padding: 8, backgroundColor: THEME.white, alignItems: 'center' },
    input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 16, maxHeight: 100 },
    sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.primary, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
    iconButton: { padding: 8 },
    mediaMessage: { width: 220, height: 220, borderRadius: 10 },
    replyContainer: { marginBottom: 5, padding: 8, borderRadius: 6, opacity: 0.8 },
    myReplyContainer: { backgroundColor: '#c5eec2' },
    otherReplyContainer: { backgroundColor: '#e9e9e9' },
    replySenderName: { fontWeight: 'bold', fontSize: 13, color: THEME.primary },
    replyText: { fontSize: 13, color: THEME.muted },
});

export default GroupChatScreen;