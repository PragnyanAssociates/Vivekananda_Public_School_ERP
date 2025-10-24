import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image, Keyboard, Modal, Pressable, PermissionsAndroid, Dimensions } from 'react-native';
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
import { v4 as uuidv4 } from 'uuid';
import RNFS from 'react-native-fs';
import { pick, types, isCancel } from '@react-native-documents/picker';
import FileViewer from 'react-native-file-viewer';
import ImageViewing from 'react-native-image-viewing';

const THEME = { primary: '#007bff', text: '#212529', muted: '#86909c', border: '#dee2e6', myMessageBg: '#dcf8c6', otherMessageBg: '#ffffff', white: '#ffffff', destructive: '#dc3545' };

const formatDateSeparator = (dateString: string) => {
    const messageDate = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    messageDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    if (messageDate.getTime() === today.getTime()) return 'Today';
    if (messageDate.getTime() === yesterday.getTime()) return 'Yesterday';
    return messageDate.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
};

const getFileIcon = (fileName: string) => {
    const extension = fileName?.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'pdf': return { name: 'file-pdf-box', color: '#E53E3E' };
        case 'doc': case 'docx': return { name: 'file-word-box', color: '#2B579A' };
        case 'xls': case 'xlsx': return { name: 'file-excel-box', color: '#1D6F42' };
        case 'ppt': case 'pptx': return { name: 'file-powerpoint-box', color: '#D04423' };
        case 'zip': case 'rar': return { name: 'folder-zip', color: '#fbc02d' };
        default: return { name: 'file-document-outline', color: '#6c757d' };
    }
};

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
    const [isOptionsModalVisible, setOptionsModalVisible] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<any>(null);

    const [isImageViewerVisible, setImageViewerVisible] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);

    const socketRef = useRef<Socket | null>(null);
    const flatListRef = useRef<FlatList | null>(null);
    const initialLoadDone = useRef(false);

    const imageMessages = useMemo(() =>
        messages
            .filter(msg => msg.message_type === 'image' && msg.file_url)
            .map(msg => ({ uri: SERVER_URL + msg.file_url })),
        [messages]
    );

    const markAsSeen = useCallback(async () => {
        try { await apiClient.post(`/groups/${group.id}/seen`); } 
        catch (error) { console.log("Failed to mark group as seen."); }
    }, [group.id]);

    useFocusEffect(useCallback(() => {
        markAsSeen();
        const fetchGroupDetails = async () => {
            try {
                const response = await apiClient.get(`/groups/${group.id}/details`);
                const updatedGroup = response.data;
                if (updatedGroup) setGroup(updatedGroup);
            } catch (error) { console.log("Could not refetch group details."); }
        };
        fetchGroupDetails();
    }, [markAsSeen]));

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const response = await apiClient.get(`/groups/${group.id}/history`);
                setMessages(response.data);
            } catch (error) { Alert.alert("Error", "Could not load chat history."); } 
            finally { setLoading(false); }
        };
        fetchHistory();

        socketRef.current = io(SERVER_URL, { transports: ['websocket'] });
        socketRef.current.on('connect', () => socketRef.current?.emit('joinGroup', { groupId: group.id }));
        socketRef.current.on('newMessage', (msg) => {
            if (msg.group_id === group.id) {
                setMessages(prev => {
                    const tempMessageExists = prev.some(m => m.clientMessageId === msg.clientMessageId);
                    if (tempMessageExists) return prev.map(m => m.clientMessageId === msg.clientMessageId ? msg : m);
                    else return [...prev, msg];
                });
            }
        });
        socketRef.current.on('messageDeleted', (id) => setMessages(prev => prev.filter(msg => msg.id !== id)));
        socketRef.current.on('messageEdited', (msg) => {
            if (msg.group_id === group.id) setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
        });
        return () => { socketRef.current?.disconnect(); };
    }, [group.id, user?.id]);

    useEffect(() => {
        if (!loading && messages.length > 0 && !initialLoadDone.current) {
            flatListRef.current?.scrollToEnd({ animated: false });
            initialLoadDone.current = true;
        }
    }, [loading, messages]);

    const messagesWithDates = useMemo(() => {
        if (messages.length === 0) return [];
        const processed = [];
        let lastDate = '';
        messages.forEach(message => {
            const messageDate = new Date(message.timestamp).toLocaleDateString();
            if (messageDate !== lastDate) {
                processed.push({ type: 'date', id: `date-${messageDate}`, date: formatDateSeparator(message.timestamp) });
                lastDate = messageDate;
            }
            processed.push({ ...message, type: 'message' });
        });
        return processed;
    }, [messages]);

    const sendMessage = (type: 'text' | 'image' | 'video' | 'file', text: string | null, url: string | null, clientMessageId?: string, fileName?: string) => {
        if (!user || !socketRef.current) return;
        socketRef.current.emit('sendMessage', {
            userId: user.id, groupId: group.id, messageType: type,
            messageText: text, fileUrl: url, fileName: fileName,
            replyToMessageId: replyingTo ? replyingTo.id : null, clientMessageId: clientMessageId,
        });
        if (type === 'text') setNewMessage('');
        setReplyingTo(null);
    };

    const uploadFile = async (file: Asset, type: 'image' | 'video' | 'file') => {
        if (!user) return;
        const clientMessageId = uuidv4();
        const tempMessage = {
            id: clientMessageId, clientMessageId, user_id: user.id, full_name: user.fullName, profile_image_url: user.profileImageUrl,
            group_id: group.id, message_type: type, file_url: null, localUri: file.uri, file_name: file.fileName,
            message_text: null, timestamp: new Date().toISOString(), status: 'uploading', progress: 0,
        };
        setMessages(prev => [...prev, tempMessage]);
        flatListRef.current?.scrollToEnd({ animated: true });

        const formData = new FormData();
        formData.append('media', { uri: file.uri, type: file.type, name: file.fileName });

        try {
            const res = await apiClient.post('/groups/media', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setMessages(prev => prev.map(msg => msg.clientMessageId === clientMessageId ? { ...msg, progress: percentCompleted } : msg));
                    }
                }
            });
            sendMessage(type, null, res.data.fileUrl, clientMessageId, file.fileName);
        } catch (error) {
            Alert.alert("Upload Failed", "Could not send the file.");
            setMessages(prev => prev.map(msg => msg.clientMessageId === clientMessageId ? { ...msg, status: 'failed' } : msg));
        }
    };

    const handlePickImageVideo = () => {
        launchImageLibrary({ mediaType: 'mixed' }, (response) => {
            if (response.didCancel || !response.assets) return;
            const file = response.assets[0];
            const type = file.type?.startsWith('video') ? 'video' : 'image';
            uploadFile(file, type);
        });
    };
    
    const handlePickDocument = async () => {
        try {
            const results = await pick({ type: [types.allFiles], allowMultiSelection: false });
            if (results && results.length > 0) {
                const doc = results[0];
                const file = { uri: doc.uri, type: doc.type, fileName: doc.name };
                uploadFile(file, 'file');
            }
        } catch (err) {
            if (!isCancel(err)) { Alert.alert("Error", "Could not pick the document."); }
        }
    };

    const showAttachmentMenu = () => {
        Alert.alert("Attach a file", "What would you like to send?",
            [{ text: "Image or Video", onPress: handlePickImageVideo }, { text: "Document", onPress: handlePickDocument }, { text: "Cancel", style: "cancel" }]
        );
    };

    const handleSend = () => {
        if (!newMessage.trim()) return;
        if (editingMessage) {
            socketRef.current?.emit('editMessage', { messageId: editingMessage.id, newText: newMessage.trim(), userId: user?.id, groupId: group.id });
            setEditingMessage(null);
        } else {
            sendMessage('text', newMessage.trim(), null);
        }
        setNewMessage(''); Keyboard.dismiss();
    };

    const onLongPressMessage = (message: any) => {
        if (!user || message.status === 'uploading') return;
        setSelectedMessage(message);
        setOptionsModalVisible(true);
    };

    const handleMediaPress = (item: any) => {
        if (item.status === 'uploading' || item.status === 'failed' || !item.file_url) return;
        if (item.message_type === 'image') {
            const index = imageMessages.findIndex(img => img.uri === SERVER_URL + item.file_url);
            if (index > -1) {
                setCurrentImageIndex(index);
                setImageViewerVisible(true);
            }
        } else if (item.message_type === 'video') {
            setSelectedVideoUri(SERVER_URL + item.file_url);
        }
    };

    const handleDeleteMessage = (messageId: number) => {
        socketRef.current?.emit('deleteMessage', { messageId, userId: user?.id, groupId: group.id });
    };

    const downloadAndOpenFile = async (fileUrl: string, fileName: string, action: 'open' | 'download') => {
        if (!fileUrl) return Alert.alert("Error", "No file available.");
        const fullUrl = SERVER_URL + fileUrl;
        const localPath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
        try {
            if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) return Alert.alert("Permission Denied", "Storage permission is required.");
            }
            closeOptionsModal(); // Close the modal before starting download
            const fileExists = await RNFS.exists(localPath);
            if (fileExists) {
                if (action === 'open') FileViewer.open(localPath);
                else Alert.alert("Already Downloaded", `File is already in your Downloads folder.`);
                return;
            }
            Alert.alert(action === 'open' ? "Opening..." : "Downloading...", "Please wait while the file is being downloaded.");
            await RNFS.downloadFile({ fromUrl: fullUrl, toFile: localPath }).promise;
            if (action === 'open') FileViewer.open(localPath);
            else Alert.alert("Download Complete", `File saved as ${fileName} in your Downloads folder.`);
            if (Platform.OS === 'android') RNFS.scanFile(localPath);
        } catch (err) { Alert.alert("Error", "An error occurred during the file operation."); }
    };
    
    const cancelReply = () => setReplyingTo(null);
    const cancelEdit = () => { setEditingMessage(null); setNewMessage(''); Keyboard.dismiss(); };
    
    // --- MODIFIED: New function to close modal and clear selection ---
    const closeOptionsModal = () => {
        setOptionsModalVisible(false);
        setSelectedMessage(null); // This is key to remove the highlight
    };

    const renderMessageItem = ({ item }: { item: any }) => {
        if (item.type === 'date') return <View style={styles.dateSeparator}><Text style={styles.dateSeparatorText}>{item.date}</Text></View>;
        
        const isMyMessage = item.user_id === user?.id;
        const messageTime = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        // --- MODIFIED: Check if the current item is the one that was long-pressed ---
        const isSelected = selectedMessage && selectedMessage.id === item.id;

        const renderContent = () => {
            const sourceUri = item.localUri || (SERVER_URL + item.file_url);
            const isUploading = item.status === 'uploading';
            const isFailed = item.status === 'failed';

            const renderUploadOverlay = () => {
                if (!isUploading && !isFailed) return null;
                return (
                    <View style={styles.mediaOverlay}>
                        {isUploading && <><ActivityIndicator size="large" color={THEME.white} /><Text style={styles.uploadProgressText}>{item.progress || 0}%</Text></>}
                        {isFailed && <><Icon name="alert-circle-outline" size={40} color={THEME.white} /><Text style={styles.uploadProgressText}>Failed</Text></>}
                    </View>
                );
            };

            switch (item.message_type) {
                case 'image':
                    return (
                        <TouchableOpacity disabled={isUploading || isFailed} onPress={() => handleMediaPress(item)}>
                            <Image source={{ uri: sourceUri }} style={styles.mediaMessage} />
                            {renderUploadOverlay()}
                        </TouchableOpacity>
                    );
                case 'video':
                    return (
                        <TouchableOpacity disabled={isUploading || isFailed} onPress={() => handleMediaPress(item)}>
                            <Video source={{ uri: sourceUri }} style={styles.mediaMessage} controls={false} paused resizeMode="cover" />
                            <View style={styles.videoPlayIconContainer}><Icon name="play-circle" size={50} color="rgba(255, 255, 255, 0.8)" /></View>
                            {renderUploadOverlay()}
                        </TouchableOpacity>
                    );
                case 'file': {
                    const iconInfo = getFileIcon(item.file_name);
                    return (
                        <TouchableOpacity disabled={isUploading || isFailed} onPress={() => downloadAndOpenFile(item.file_url, item.file_name, 'open')}>
                            <View style={styles.fileContainer}>
                                <Icon name={iconInfo.name} size={48} color={iconInfo.color} />
                                <View style={styles.fileInfo}><Text style={styles.fileName} numberOfLines={2}>{item.file_name}</Text></View>
                                {renderUploadOverlay()}
                            </View>
                        </TouchableOpacity>
                    );
                }
                default: return <Text style={styles.messageText}>{item.message_text}</Text>;
            }
        };

        return (
            <TouchableOpacity onLongPress={() => onLongPressMessage(item)} activeOpacity={0.8} style={isSelected ? styles.highlightedMessage : null}>
                <View style={[styles.messageRow, isMyMessage ? styles.myMessageRow : styles.otherMessageRow]}>
                    {!isMyMessage && <Image source={getProfileImageSource(item.profile_image_url)} style={styles.senderDp} />}
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
                        <Text style={[styles.messageTime, (item.message_type === 'image' || item.message_type === 'video') && !item.status ? styles.mediaTime : {}]}>
                            {item.is_edited ? 'Edited • ' : ''}{messageTime}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderOptionsModal = () => {
        if (!selectedMessage) return null;
        const isMyMessage = selectedMessage.user_id === user?.id;
        const isMedia = ['image', 'video', 'file'].includes(selectedMessage.message_type);

        return (
            <Modal animationType="fade" transparent={true} visible={isOptionsModalVisible} onRequestClose={closeOptionsModal}>
                <Pressable style={styles.modalOverlay} onPress={closeOptionsModal}>
                    <Pressable style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Message Options</Text>
                        <TouchableOpacity style={styles.modalOption} onPress={() => { setReplyingTo(selectedMessage); closeOptionsModal(); }}><Text style={styles.modalOptionText}>Reply</Text></TouchableOpacity>
                        {isMedia && (<TouchableOpacity style={styles.modalOption} onPress={() => downloadAndOpenFile(selectedMessage.file_url, selectedMessage.file_name, 'download')}><Text style={styles.modalOptionText}>Download</Text></TouchableOpacity>)}
                        {isMyMessage && selectedMessage.message_type === 'text' && (<TouchableOpacity style={styles.modalOption} onPress={() => { setEditingMessage(selectedMessage); setNewMessage(selectedMessage.message_text); closeOptionsModal(); }}><Text style={styles.modalOptionText}>Edit</Text></TouchableOpacity>)}
                        {isMyMessage && (<TouchableOpacity style={styles.modalOption} onPress={() => { handleDeleteMessage(selectedMessage.id); closeOptionsModal(); }}><Text style={[styles.modalOptionText, styles.destructiveText]}>Delete</Text></TouchableOpacity>)}
                        <TouchableOpacity style={styles.modalOption} onPress={closeOptionsModal}><Text style={styles.modalOptionText}>Cancel</Text></TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        );
    };

    const renderVideoPlayer = () => (
        <Modal visible={!!selectedVideoUri} transparent={true} onRequestClose={() => setSelectedVideoUri(null)}>
            <View style={styles.videoModalContainer}>
                <TouchableOpacity style={styles.videoCloseButton} onPress={() => setSelectedVideoUri(null)}>
                    <Icon name="close" size={32} color={THEME.white} />
                </TouchableOpacity>
                {selectedVideoUri && (
                    <Video source={{ uri: selectedVideoUri }} style={styles.fullScreenVideo} controls={true} resizeMode="contain" />
                )}
            </View>
        </Modal>
    );

    return (
        <SafeAreaView style={{flex: 1, backgroundColor: THEME.white}}>
            {renderOptionsModal()}
            {renderVideoPlayer()}
            <ImageViewing
                images={imageMessages}
                imageIndex={currentImageIndex}
                visible={isImageViewerVisible}
                onRequestClose={() => setImageViewerVisible(false)}
            />
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
                    ref={flatListRef} data={messagesWithDates} renderItem={renderMessageItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ paddingVertical: 10, paddingBottom: 20 }}
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
                        <TouchableOpacity onPress={showAttachmentMenu} style={styles.iconButton}><Icon name="paperclip" size={24} color={THEME.muted} /></TouchableOpacity>
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
    dateSeparator: { alignSelf: 'center', backgroundColor: '#e1f3fb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginVertical: 10, elevation: 1 },
    dateSeparatorText: { color: '#5a7a8a', fontSize: 12, fontWeight: '600' },
    messageRow: { flexDirection: 'row', marginVertical: 5, paddingHorizontal: 10, alignItems: 'flex-end' },
    myMessageRow: { justifyContent: 'flex-end' },
    otherMessageRow: { justifyContent: 'flex-start' },
    senderDp: { width: 36, height: 36, borderRadius: 18, marginRight: 8, marginBottom: 5, backgroundColor: '#eee' },
    messageContainer: { maxWidth: '80%', padding: 10, borderRadius: 12, elevation: 1, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 1 },
    myMessageContainer: { backgroundColor: THEME.myMessageBg, borderBottomRightRadius: 2 },
    otherMessageContainer: { backgroundColor: THEME.otherMessageBg, borderBottomLeftRadius: 2 },
    mediaContainer: { padding: 5, backgroundColor: 'transparent' },
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
    mediaOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
    uploadProgressText: { color: THEME.white, marginTop: 8, fontWeight: 'bold', fontSize: 16 },
    fileContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, width: 220, overflow: 'hidden' },
    fileInfo: { flex: 1, marginLeft: 10, justifyContent: 'center' },
    fileName: { fontSize: 15, fontWeight: '500', color: THEME.text },
    fileSize: { fontSize: 12, color: THEME.muted, marginTop: 2 },
    // MODIFIED: modalOverlay is now transparent to let the highlight show through
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
    modalContent: { width: '80%', backgroundColor: 'white', borderRadius: 10, paddingVertical: 10, elevation: 5 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15, color: THEME.text },
    modalOption: { paddingVertical: 15, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: THEME.border },
    modalOptionText: { fontSize: 16, color: THEME.primary },
    destructiveText: { color: THEME.destructive },
    videoPlayIconContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    videoModalContainer: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
    fullScreenVideo: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
    videoCloseButton: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, left: 20, zIndex: 1, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 5 },
    // --- NEW: Style for the message highlight ---
    highlightedMessage: {
        backgroundColor: 'rgba(0, 80, 255, 0.15)', // A subtle blueish highlight
        borderRadius: 15, // Should roughly match the message bubble's curvature
    },
});

export default GroupChatScreen;