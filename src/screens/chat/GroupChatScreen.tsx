import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image, Keyboard } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig'; // IMPORTANT: Make sure this points to your backend URL (e.g., http://192.168.1.10:3001)
import { io, Socket } from 'socket.io-client';
import { launchImageLibrary, ImageLibraryOptions, ImagePickerResponse } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import EmojiPicker, { EmojiType } from 'rn-emoji-keyboard';
import { useRoute, useNavigation } from '@react-navigation/native';

const THEME = { primary: '#007bff', background: '#e5ddd5', text: '#212529', muted: '#86909c', border: '#dee2e6', myMessageBg: '#dcf8c6', otherMessageBg: '#ffffff', white: '#ffffff' };

const GroupChatScreen = () => {
    const { user } = useAuth();
    const route = useRoute();
    const navigation = useNavigation();
    const { group } = route.params as { group: { id: number; name: string } };

    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

    const socketRef = useRef<Socket | null>(null);
    const flatListRef = useRef<FlatList | null>(null);

    useEffect(() => {
        if (!group?.id) return;
        
        const fetchHistory = async () => {
            try {
                const response = await apiClient.get(`/groups/${group.id}/history`);
                setMessages(response.data);
            } catch (error: any) {
                Alert.alert("Error", error.response?.data?.message || "Could not load chat history.");
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();

        socketRef.current = io(SERVER_URL, { transports: ['websocket'] });
        
        socketRef.current.on('connect', () => {
            console.log(`Connected to chat server with socket ID: ${socketRef.current?.id}`);
            socketRef.current?.emit('joinGroup', { groupId: group.id });
        });

        socketRef.current.on('newMessage', (receivedMessage) => {
            if (receivedMessage.group_id === group.id) {
                setMessages(prevMessages => [...prevMessages, receivedMessage]);
            }
        });

        socketRef.current.on('messageDeleted', (deletedMessageId) => {
            setMessages(prevMessages => prevMessages.filter(message => message.id !== deletedMessageId));
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [group.id]);

    const sendMessage = (type: 'text' | 'image', text: string | null, url: string | null) => {
        if (!user || !socketRef.current || !group) return;
        
        const optimisticMessage = {
            id: Date.now(),
            user_id: user.id,
            full_name: user.full_name,
            role: user.role,
            message_type: type,
            message_text: text,
            file_url: url,
            timestamp: new Date().toISOString(),
            group_id: group.id,
        };
        setMessages(prevMessages => [...prevMessages, optimisticMessage]);
        
        socketRef.current.emit('sendMessage', {
            userId: user.id,
            groupId: group.id,
            messageType: type,
            messageText: text,
            fileUrl: url,
        });

        if (type === 'text') setNewMessage('');
    };

    const handleSendText = () => {
        if (newMessage.trim() === '') return;
        sendMessage('text', newMessage.trim(), null);
    };

    const handlePickImage = () => {
        const options: ImageLibraryOptions = { mediaType: 'photo', quality: 0.7 };
        launchImageLibrary(options, async (response: ImagePickerResponse) => {
            if (response.didCancel || !response.assets || response.assets.length === 0) return;
            
            setIsUploading(true);
            const image = response.assets[0];
            const formData = new FormData();
            formData.append('media', { uri: image.uri!, type: image.type!, name: image.fileName! });

            try {
                const res = await apiClient.post('/group-chat/upload-media', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                sendMessage('image', null, res.data.fileUrl);
            } catch (error: any) {
                Alert.alert("Upload Failed", error.response?.data?.message || 'An unknown error occurred.');
            } finally {
                setIsUploading(false);
            }
        });
    };
    
    const handleDeleteMessage = (messageId: number) => {
        Alert.alert(
            "Delete Message", "Are you sure you want to permanently delete this message for everyone?",
            [{ text: "Cancel", style: "cancel" }, {
                text: "Delete", style: "destructive", onPress: () => {
                    if (socketRef.current && user && group) {
                        socketRef.current.emit('deleteMessage', { messageId, userId: user.id, groupId: group.id });
                    }
                },
            }]
        );
    };

    const handleEmojiSelect = (emoji: EmojiType) => setNewMessage(prev => prev + emoji.emoji);
    const openEmojiPicker = () => { Keyboard.dismiss(); setIsEmojiPickerOpen(true); };
    
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages]);

    const renderMessageItem = ({ item }: { item: any }) => {
        if (!user) return null;
        const isMyMessage = item.user_id === user.id;
        const messageTime = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

        const renderContent = () => {
            switch (item.message_type) {
                case 'image':
                    return <Image source={{ uri: `${SERVER_URL}${item.file_url}` }} style={styles.imageMessage} resizeMode="cover" />;
                default:
                    return <Text style={styles.messageText}>{item.message_text}</Text>;
            }
        };

        return (
            <TouchableOpacity activeOpacity={0.8} onLongPress={isMyMessage ? () => handleDeleteMessage(item.id) : undefined} delayLongPress={400}>
                <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer]}>
                    <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble, item.message_type === 'image' && styles.imageBubble]}>
                        {!isMyMessage && ( <Text style={[styles.senderName, { color: getRoleColor(item.role) }]}>{item.full_name}</Text> )}
                        {renderContent()}
                        <Text style={[styles.messageTime, item.message_type === 'image' && styles.imageTime]}>{messageTime}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return <ActivityIndicator size="large" color={THEME.primary} style={{ flex: 1 }} />;
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Icon name="arrow-left" size={24} color={THEME.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{group.name}</Text>
                <View style={{ width: 24 }} />
            </View>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}>
                <FlatList
                    ref={flatListRef} data={messages} renderItem={renderMessageItem} keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.messageList}
                    onStartShouldSetResponder={() => { if (isEmojiPickerOpen) { setIsEmojiPickerOpen(false); return true; } return false; }}
                />
                <View style={styles.inputContainer}>
                    <TouchableOpacity style={styles.iconButton} onPress={openEmojiPicker}><Icon name="emoticon-happy-outline" size={24} color={THEME.muted} /></TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={handlePickImage} disabled={isUploading}>
                        {isUploading ? <ActivityIndicator size="small" color={THEME.primary} /> : <Icon name="paperclip" size={24} color={THEME.muted} />}
                    </TouchableOpacity>
                    <TextInput style={styles.input} value={newMessage} onChangeText={setNewMessage} placeholder="Type a message..." placeholderTextColor={THEME.muted} multiline onFocus={() => setIsEmojiPickerOpen(false)} />
                    <TouchableOpacity style={styles.sendButton} onPress={handleSendText}><Icon name="send" size={24} color={THEME.white} /></TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
            <EmojiPicker onEmojiSelected={handleEmojiSelect} open={isEmojiPickerOpen} onClose={() => setIsEmojiPickerOpen(false)} />
        </SafeAreaView>
    );
};

const getRoleColor = (role: string) => { switch (role) { case 'admin': return '#d9534f'; case 'teacher': return '#5cb85c'; case 'student': return '#0275d8'; default: return THEME.muted; }};
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: THEME.background }, header: { paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: THEME.border, backgroundColor: THEME.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, backButton: { marginRight: 15 }, headerTitle: { fontSize: 18, fontWeight: 'bold' }, messageList: { padding: 10 }, messageContainer: { marginVertical: 4, maxWidth: '80%' }, myMessageContainer: { alignSelf: 'flex-end' }, otherMessageContainer: { alignSelf: 'flex-start' }, messageBubble: { borderRadius: 12, padding: 10, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 1 }, myMessageBubble: { backgroundColor: THEME.myMessageBg, borderBottomRightRadius: 2 }, otherMessageBubble: { backgroundColor: THEME.otherMessageBg, borderBottomLeftRadius: 2 }, senderName: { fontWeight: 'bold', marginBottom: 4, fontSize: 13 }, messageText: { fontSize: 16, color: THEME.text }, messageTime: { fontSize: 11, color: THEME.muted, alignSelf: 'flex-end', marginTop: 5, marginLeft: 8 }, inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: THEME.border, backgroundColor: THEME.white }, input: { flex: 1, maxHeight: 100, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 16, marginHorizontal: 5 }, sendButton: { backgroundColor: THEME.primary, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }, iconButton: { padding: 8 }, imageMessage: { width: 220, height: 220, borderRadius: 12 }, imageBubble: { padding: 3, backgroundColor: 'transparent' }, imageTime: { position: 'absolute', bottom: 8, right: 8, color: THEME.white, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, fontSize: 10 }});

export default GroupChatScreen;