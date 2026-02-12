import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    SafeAreaView, 
    FlatList, 
    TextInput, 
    TouchableOpacity, 
    ActivityIndicator, 
    KeyboardAvoidingView, 
    Platform, 
    Alert, 
    Image, 
    Keyboard, 
    Modal, 
    Pressable, 
    PermissionsAndroid, 
    Dimensions, 
    useColorScheme,
    StatusBar
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { io, Socket } from 'socket.io-client';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'; 
import { useRoute, useNavigation } from '@react-navigation/native';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { getProfileImageSource } from '../../utils/imageHelpers';
import Video from 'react-native-video';
import EmojiPicker from 'rn-emoji-keyboard';
import { v4 as uuidv4 } from 'uuid';
import RNFS from 'react-native-fs';
import { pick, types } from '@react-native-documents/picker';
import FileViewer from 'react-native-file-viewer';
import ImageViewing from 'react-native-image-viewing';

// --- THEME CONFIGURATION ---
const lightTheme = {
    mode: 'light',
    primary: '#008080',
    text: '#212529',
    muted: '#86909c',
    border: '#dee2e6',
    myMessageBg: '#dcf8c6',
    otherMessageBg: '#ffffff',
    white: '#ffffff',
    destructive: '#dc3545',
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    unreadBannerBg: '#e1f5fe',
    unreadBannerText: '#0288d1',
    inputBg: '#f0f0f0',
    headerTitle: '#212529',
    modalBg: '#ffffff',
    fileIconBg: '#eee'
};

const darkTheme = {
    mode: 'dark',
    primary: '#4db6ac', 
    text: '#ececec',
    muted: '#b0b3b8',
    border: '#2f3336',
    myMessageBg: '#005c4b', 
    otherMessageBg: '#202c33',
    white: '#ececec',
    destructive: '#ff6b6b',
    background: '#0b141a', 
    cardBg: '#202c33',
    unreadBannerBg: '#1f2c34',
    unreadBannerText: '#64b5f6',
    inputBg: '#2a3942',
    headerTitle: '#ececec',
    modalBg: '#202c33',
    fileIconBg: '#2a3942'
};

// --- HELPER FUNCTIONS ---
const getLocalISOString = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    const localTime = new Date(now.getTime() - offsetMs);
    return localTime.toISOString().slice(0, 19); 
};

const formatDateSeparator = (dateString: string) => {
    const messageDate = new Date(dateString); 
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (messageDate.toDateString() === today.toDateString()) return 'Today';
    if (messageDate.toDateString() === yesterday.toDateString()) return 'Yesterday';
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
    
    // Theme Hook
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

    const [group, setGroup] = useState(route.params.group);
    const [messages, setMessages] = useState<any[]>([]);
    const [lastSeenTime, setLastSeenTime] = useState<string | null>(null);
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
    const [initialScrollDone, setInitialScrollDone] = useState(false);

    const socketRef = useRef<Socket | null>(null);
    const flatListRef = useRef<FlatList | null>(null);

    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

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

    // 1. Fetch History
    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const response = await apiClient.get(`/groups/${group.id}/history`);
                const fetchedMessages = response.data.messages || [];
                const fetchedLastSeen = response.data.lastSeen;

                setMessages(fetchedMessages);
                setLastSeenTime(fetchedLastSeen);
                markAsSeen(); 
            } catch (error) { 
                Alert.alert("Error", "Could not load chat history."); 
            } finally { 
                setLoading(false); 
            }
        };
        fetchHistory();

        // Socket Setup
        socketRef.current = io(SERVER_URL, { transports: ['websocket'] });
        socketRef.current.on('connect', () => socketRef.current?.emit('joinGroup', { groupId: group.id }));
        socketRef.current.on('newMessage', (msg) => {
            if (msg.group_id === group.id) {
                setMessages(prev => {
                    const tempIndex = prev.findIndex(m => m.clientMessageId === msg.clientMessageId);
                    if (tempIndex !== -1) {
                        const newMsgs = [...prev];
                        newMsgs[tempIndex] = msg;
                        return newMsgs;
                    }
                    return [...prev, msg];
                });
            }
        });
        socketRef.current.on('messageDeleted', (id) => setMessages(prev => prev.filter(msg => msg.id !== id)));
        socketRef.current.on('messageEdited', (msg) => {
            if (msg.group_id === group.id) setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
        });
        return () => { socketRef.current?.disconnect(); };
    }, [group.id, user?.id]);

    // 2. Prepare Data (REVERSED)
    const processedData = useMemo(() => {
        if (messages.length === 0) return [];
        const processed = [];
        let lastDate = '';
        let unreadBannerAdded = false;

        messages.forEach((message, index) => {
            const messageDate = new Date(message.timestamp).toDateString();
            if (messageDate !== lastDate) {
                processed.push({ type: 'date', id: `date-${messageDate}`, date: formatDateSeparator(message.timestamp) });
                lastDate = messageDate;
            }
            if (!unreadBannerAdded && lastSeenTime && message.user_id !== user?.id) {
                const msgTime = new Date(message.timestamp).getTime();
                const seenTime = new Date(lastSeenTime).getTime();
                if (msgTime > seenTime) {
                    processed.push({ type: 'unread_banner', id: 'unread-banner' });
                    unreadBannerAdded = true;
                }
            }
            processed.push({ ...message, type: 'message' });
        });
        return processed.reverse();
    }, [messages, lastSeenTime, user?.id]);

    // 3. Scroll Logic
    const handleContentSizeChange = () => {
        if (!initialScrollDone && processedData.length > 0 && flatListRef.current) {
            const bannerIndex = processedData.findIndex(item => item.type === 'unread_banner');
            if (bannerIndex !== -1) {
                setTimeout(() => {
                    flatListRef.current?.scrollToIndex({ index: bannerIndex, animated: false, viewPosition: 0.5 });
                }, 100);
            } 
            setInitialScrollDone(true);
        }
    };

    const sendMessage = (type: any, text: any, url: any, clientMessageId?: any, fileName?: any) => {
        if (!user || !socketRef.current) return;
        const tempId = clientMessageId || uuidv4();
        if (!clientMessageId) {
            const tempMessage = {
                id: tempId, clientMessageId: tempId, user_id: user.id, full_name: user.fullName, profile_image_url: user.profileImageUrl,
                group_id: group.id, message_type: type, file_url: url, file_name: fileName, message_text: text,
                timestamp: getLocalISOString(), status: 'sending',
                reply_to_message_id: replyingTo ? replyingTo.id : null,
                reply_sender_name: replyingTo ? replyingTo.full_name : null,
                reply_text: replyingTo ? (replyingTo.message_type === 'text' ? replyingTo.message_text : 'Media') : null,
                reply_type: replyingTo ? replyingTo.message_type : null
            };
            setMessages(prev => [...prev, tempMessage]);
        }
        socketRef.current.emit('sendMessage', {
            userId: user.id, groupId: group.id, messageType: type, messageText: text, fileUrl: url, fileName: fileName,
            replyToMessageId: replyingTo ? replyingTo.id : null, clientMessageId: tempId,
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
            message_text: null, timestamp: getLocalISOString(), status: 'uploading', progress: 0,
        };
        setMessages(prev => [...prev, tempMessage]);
        
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

    const downloadAndOpenFile = async (fileUrl: string, fileName: string, action: 'open' | 'download') => { 
        if (!fileUrl) return Alert.alert("Error", "No file available."); 
        
        const fullUrl = SERVER_URL + fileUrl; 
        const localPath = `${RNFS.DownloadDirectoryPath}/${fileName}`; 
        
        try { 
            if (Platform.OS === 'android') { 
                await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE); 
            } 
            
            closeOptionsModal(); 
            const fileExists = await RNFS.exists(localPath); 
            
            // Logic for 'open' action: If exists, just open. If not, download then open.
            if (action === 'open') {
                if (fileExists) {
                    try {
                        await FileViewer.open(localPath);
                    } catch (e) {
                        Alert.alert("Error", "No app found to open this file.");
                    }
                    return;
                }
                // If not exists, fall through to download logic
                Alert.alert("Opening...", "Downloading file to view...");
            } else {
                // Action is 'download'
                if (fileExists) {
                    Alert.alert("Already Downloaded", `File is saved in your Downloads folder.`); 
                    return; 
                }
                Alert.alert("Downloading...", "Please wait..."); 
            }

            // Perform Download
            const options = {
                fromUrl: fullUrl,
                toFile: localPath,
                background: true,
            };
            
            await RNFS.downloadFile(options).promise; 
            
            if (action === 'open') {
                try {
                    await FileViewer.open(localPath);
                } catch(e) {
                    Alert.alert("Error", "File downloaded but no app found to open it.");
                }
            } else {
                Alert.alert("Download Complete", `File saved as ${fileName}`); 
            }

            if (Platform.OS === 'android') RNFS.scanFile(localPath); 

        } catch (err) { 
            Alert.alert("Error", "An error occurred while downloading."); 
            console.error(err);
        } 
    };

    const handlePickImageVideo = () => { launchImageLibrary({ mediaType: 'mixed' }, (response) => { if (!response.didCancel && response.assets) uploadFile(response.assets[0], response.assets[0].type?.startsWith('video') ? 'video' : 'image'); }); };
    const handlePickDocument = async () => { try { const results = await pick({ type: [types.allFiles], allowMultiSelection: false }); if (results && results.length > 0) uploadFile({ uri: results[0].uri, type: results[0].type, fileName: results[0].name }, 'file'); } catch (err) {} };
    const showAttachmentMenu = () => { Alert.alert("Attach a file", "What would you like to send?", [{ text: "Image or Video", onPress: handlePickImageVideo }, { text: "Document", onPress: handlePickDocument }, { text: "Cancel", style: "cancel" }]); };
    const handleSend = () => { if (!newMessage.trim()) return; if (editingMessage) { socketRef.current?.emit('editMessage', { messageId: editingMessage.id, newText: newMessage.trim(), userId: user?.id, groupId: group.id }); setEditingMessage(null); } else { sendMessage('text', newMessage.trim(), null); } setNewMessage(''); Keyboard.dismiss(); };
    const onLongPressMessage = (message: any) => { if (!user || message.status === 'uploading') return; setSelectedMessage(message); setOptionsModalVisible(true); };
    
    // Updated Handler for Media Press
    const handleMediaPress = (item: any) => { 
        if (item.status === 'uploading' || item.status === 'failed' || !item.file_url) return; 
        
        if (item.message_type === 'image') { 
            const index = imageMessages.findIndex(img => img.uri === SERVER_URL + item.file_url); 
            if (index > -1) { setCurrentImageIndex(index); setImageViewerVisible(true); } 
        } else if (item.message_type === 'video') { 
            setSelectedVideoUri(SERVER_URL + item.file_url); 
        } else if (item.message_type === 'file') {
            // TAP ACTION: OPEN FILE
            downloadAndOpenFile(item.file_url, item.file_name, 'open');
        }
    };
    
    const handleDeleteMessage = (messageId: number) => { socketRef.current?.emit('deleteMessage', { messageId, userId: user?.id, groupId: group.id }); };
    const cancelReply = () => setReplyingTo(null);
    const cancelEdit = () => { setEditingMessage(null); setNewMessage(''); Keyboard.dismiss(); };
    const closeOptionsModal = () => { setOptionsModalVisible(false); setSelectedMessage(null); };

    // --- RENDER ITEMS ---
    const renderMessageItem = ({ item }: { item: any }) => {
        if (item.type === 'date') return <View style={[styles.dateSeparator, {backgroundColor: theme.mode === 'dark' ? '#1f2c34' : '#e1f3fb'}]}><Text style={[styles.dateSeparatorText, {color: theme.muted}]}>{item.date}</Text></View>;
        
        if (item.type === 'unread_banner') return (
            <View style={[styles.unreadBanner, {backgroundColor: theme.unreadBannerBg}]}>
                <Text style={[styles.unreadBannerText, {color: theme.unreadBannerText}]}>{item.unread_count ? `${item.unread_count} Unread Messages` : 'Unread Messages'}</Text>
            </View>
        );

        const isMyMessage = item.user_id === user?.id;
        const messageTime = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isSelected = selectedMessage && selectedMessage.id === item.id;

        const renderContent = () => {
            const sourceUri = item.localUri || (SERVER_URL + item.file_url);
            const isUploading = item.status === 'uploading';
            const isFailed = item.status === 'failed';
            const renderOverlay = () => { if (!isUploading && !isFailed) return null; return (<View style={styles.mediaOverlay}>{isUploading && <ActivityIndicator size="large" color={theme.white} />}{isFailed && <Icon name="alert-circle-outline" size={40} color={theme.white} />}</View>); };

            switch (item.message_type) {
                case 'image': return (<TouchableOpacity disabled={isUploading} onPress={() => handleMediaPress(item)}><Image source={{ uri: sourceUri }} style={styles.mediaMessage} />{renderOverlay()}</TouchableOpacity>);
                case 'video': return (<TouchableOpacity disabled={isUploading} onPress={() => handleMediaPress(item)}><Video source={{ uri: sourceUri }} style={styles.mediaMessage} controls={false} paused resizeMode="cover" /><View style={styles.videoPlayIconContainer}><Icon name="play-circle" size={50} color="rgba(255, 255, 255, 0.8)" /></View>{renderOverlay()}</TouchableOpacity>);
                case 'file': { 
                    const iconInfo = getFileIcon(item.file_name); 
                    return (
                        <TouchableOpacity 
                            disabled={isUploading} 
                            onPress={() => handleMediaPress(item)} 
                            onLongPress={() => onLongPressMessage(item)} // Enable Long Press for files
                            activeOpacity={0.7}
                        >
                            <View style={styles.fileContainer}>
                                <View style={[styles.fileIconWrapper, {backgroundColor: theme.fileIconBg}]}>
                                    <Icon name={iconInfo.name} size={32} color={iconInfo.color} />
                                </View>
                                <View style={styles.fileInfo}>
                                    <Text style={[styles.fileName, {color: theme.text}]} numberOfLines={1}>{item.file_name}</Text>
                                    <Text style={[styles.fileSubText, {color: theme.muted}]}>PDF • Tap to view</Text>
                                </View>
                                {renderOverlay()}
                            </View>
                        </TouchableOpacity>
                    ); 
                }
                default: return <Text style={[styles.messageText, {color: theme.text}]}>{item.message_text}</Text>;
            }
        };

        return (
            <TouchableOpacity onLongPress={() => onLongPressMessage(item)} activeOpacity={0.9} style={isSelected ? styles.highlightedMessage : null}>
                <View style={[styles.messageRow, isMyMessage ? styles.myMessageRow : styles.otherMessageRow]}>
                    {!isMyMessage && <Image source={getProfileImageSource(item.profile_image_url)} style={styles.senderDp} />}
                    <View style={[
                        styles.messageContainer, 
                        { backgroundColor: isMyMessage ? theme.myMessageBg : theme.otherMessageBg },
                        // FIX: Remove padding for files/media so they fill the bubble
                        (item.message_type !== 'text') && { padding: 4, paddingBottom: 4 } 
                    ]}>
                        {!isMyMessage && (
                            <View style={[styles.senderInfo, {paddingHorizontal: item.message_type !== 'text' ? 5 : 0}]}>
                                <Text style={[styles.senderName, {color: theme.primary}]}>{item.full_name}</Text>
                                {item.role === 'student' && item.class_group && <Text style={[styles.senderDetails, {color: theme.muted}]}> ({item.class_group}{item.roll_no ? `, Roll: ${item.roll_no}` : ''})</Text>}
                            </View>
                        )}
                        {item.reply_to_message_id && (
                            <View style={[styles.replyContainer, {backgroundColor: isMyMessage ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)', marginHorizontal: item.message_type !== 'text' ? 5 : 0}]}>
                                <Text style={[styles.replySenderName, {color: theme.primary}]}>{item.reply_sender_name}</Text>
                                <Text style={[styles.replyText, {color: theme.muted}]} numberOfLines={1}>{item.reply_type === 'text' ? item.reply_text : 'Media'}</Text>
                            </View>
                        )}
                        
                        {renderContent()}
                        
                        <View style={{flexDirection:'row', alignItems:'center', justifyContent: 'flex-end', marginTop: 2, paddingRight: item.message_type !== 'text' ? 5 : 0}}>
                             <Text style={[
                                 styles.messageTime, 
                                 {color: theme.muted},
                                 (item.message_type === 'image' || item.message_type === 'video') && !item.status ? styles.mediaTime : {}
                             ]}>
                                {item.is_edited ? 'Edited • ' : ''}{messageTime}
                            </Text>
                            {isMyMessage && (<Icon name="check" size={14} color={theme.muted} style={{marginLeft: 3}} />)}
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderOptionsModal = () => { 
        if (!selectedMessage) return null; 
        const isMy = selectedMessage.user_id === user?.id; 
        const isMedia = ['image', 'video', 'file'].includes(selectedMessage.message_type); 
        return (
            <Modal animationType="fade" transparent visible={isOptionsModalVisible} onRequestClose={closeOptionsModal}>
                <Pressable style={styles.modalOverlay} onPress={closeOptionsModal}>
                    <Pressable style={[styles.modalContent, {backgroundColor: theme.modalBg}]}>
                        <Text style={[styles.modalTitle, {color: theme.text}]}>Message Options</Text>
                        <TouchableOpacity style={[styles.modalOption, {borderTopColor: theme.border}]} onPress={() => { setReplyingTo(selectedMessage); closeOptionsModal(); }}>
                            <Text style={[styles.modalOptionText, {color: theme.primary}]}>Reply</Text>
                        </TouchableOpacity>
                        
                        {/* FIX: DOWNLOAD BUTTON SHOWS FOR FILES NOW */}
                        {isMedia && (
                            <TouchableOpacity style={[styles.modalOption, {borderTopColor: theme.border}]} onPress={() => downloadAndOpenFile(selectedMessage.file_url, selectedMessage.file_name, 'download')}>
                                <Text style={[styles.modalOptionText, {color: theme.primary}]}>Download</Text>
                            </TouchableOpacity>
                        )}
                        
                        {isMy && selectedMessage.message_type === 'text' && (
                            <TouchableOpacity style={[styles.modalOption, {borderTopColor: theme.border}]} onPress={() => { setEditingMessage(selectedMessage); setNewMessage(selectedMessage.message_text); closeOptionsModal(); }}>
                                <Text style={[styles.modalOptionText, {color: theme.primary}]}>Edit</Text>
                            </TouchableOpacity>
                        )}
                        {isMy && (
                            <TouchableOpacity style={[styles.modalOption, {borderTopColor: theme.border}]} onPress={() => { handleDeleteMessage(selectedMessage.id); closeOptionsModal(); }}>
                                <Text style={[styles.modalOptionText, styles.destructiveText]}>Delete</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={[styles.modalOption, {borderTopColor: theme.border}]} onPress={closeOptionsModal}>
                            <Text style={[styles.modalOptionText, {color: theme.text}]}>Cancel</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        ); 
    };
    
    const renderVideoPlayer = () => (<Modal visible={!!selectedVideoUri} transparent onRequestClose={() => setSelectedVideoUri(null)}><View style={styles.videoModalContainer}><TouchableOpacity style={styles.videoCloseButton} onPress={() => setSelectedVideoUri(null)}><Icon name="close" size={32} color={theme.white} /></TouchableOpacity>{selectedVideoUri && <Video source={{ uri: selectedVideoUri }} style={styles.fullScreenVideo} controls resizeMode="contain" />}</View></Modal>);

    return (
        <SafeAreaView style={{flex: 1, backgroundColor: theme.background}}>
            <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            {renderOptionsModal()}{renderVideoPlayer()}
            <ImageViewing images={imageMessages} imageIndex={currentImageIndex} visible={isImageViewerVisible} onRequestClose={() => setImageViewerVisible(false)} />
            
            <View style={[styles.headerCard, {backgroundColor: theme.cardBg, shadowColor: theme.mode === 'dark' ? '#000' : '#888'}]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color={theme.headerTitle} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('GroupSettings', { group })} style={{flexDirection:'row', alignItems:'center'}}>
                        <Image source={getProfileImageSource(group.group_dp_url)} style={styles.headerDp} />
                        <View>
                            <Text style={[styles.headerTitle, {color: theme.headerTitle}]}>{group.name}</Text>
                            <Text style={[styles.headerSubtitle, {color: theme.muted}]}>Tap for info</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            <KeyboardAvoidingView style={{flex: 1, backgroundColor: theme.background}} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
                {loading ? <ActivityIndicator style={{flex: 1}} size="large" color={theme.primary} /> :
                <FlatList
                    ref={flatListRef}
                    data={processedData}
                    inverted={true} 
                    renderItem={renderMessageItem}
                    keyExtractor={(item) => item.id?.toString() || item.clientMessageId}
                    contentContainerStyle={{ paddingVertical: 10, paddingBottom: 20, flexGrow: 1, justifyContent: 'flex-end' }}
                    onContentSizeChange={handleContentSizeChange}
                    onScrollToIndexFailed={(info) => {
                        flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
                    }}
                />}
                <View>
                    {replyingTo && (
                        <View style={[styles.replyingBanner, {backgroundColor: theme.inputBg, borderColor: theme.border}]}>
                            <Icon name="reply" size={18} color={theme.primary} />
                            <View style={[styles.replyingTextContainer, {borderLeftColor: theme.primary}]}>
                                <Text style={[styles.replyingToName, {color: theme.primary}]}>{replyingTo.user_id === user?.id ? 'You' : replyingTo.full_name}</Text>
                                <Text numberOfLines={1} style={{color: theme.text}}>{replyingTo.message_text || 'Media'}</Text>
                            </View>
                            <Icon name="close" size={20} color={theme.muted} onPress={cancelReply} />
                        </View>
                    )}
                    {editingMessage && (
                        <View style={[styles.editingBanner, {backgroundColor: theme.inputBg, borderColor: theme.border}]}>
                            <Icon name="pencil" size={16} color={theme.primary} />
                            <Text style={[styles.editingText, {color: theme.primary}]}>Editing Message</Text>
                            <Icon name="close" size={20} color={theme.muted} onPress={cancelEdit} />
                        </View>
                    )}
                    <View style={[styles.inputContainer, {backgroundColor: theme.cardBg}]}>
                        <TouchableOpacity onPress={() => { Keyboard.dismiss(); setIsEmojiPickerOpen(true); }} style={styles.iconButton}>
                            <Icon name="emoticon-outline" size={24} color={theme.muted} />
                        </TouchableOpacity>
                        <TextInput 
                            style={[styles.input, {backgroundColor: theme.inputBg, color: theme.text}]} 
                            value={newMessage} 
                            onChangeText={setNewMessage} 
                            placeholder="Type a message..." 
                            placeholderTextColor={theme.muted}
                            multiline 
                            onFocus={()=>setIsEmojiPickerOpen(false)} 
                        />
                        <TouchableOpacity onPress={showAttachmentMenu} style={styles.iconButton}>
                            <Icon name="paperclip" size={24} color={theme.muted} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.sendButton, {backgroundColor: theme.primary}]} onPress={handleSend}>
                            <Icon name={editingMessage ? "check" : "send"} size={24} color={'#ffffff'} />
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
            <EmojiPicker onEmojiSelected={(emoji) => setNewMessage(prev => prev + emoji.emoji)} open={isEmojiPickerOpen} onClose={() => setIsEmojiPickerOpen(false)} />
        </SafeAreaView>
    );
};

// Static Styles (Responsive)
const styles = StyleSheet.create({
    headerCard: { paddingHorizontal: 15, paddingVertical: 10, width: '95%', alignSelf: 'center', marginTop: 10, marginBottom: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, zIndex: 10 },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerDp: { width: 40, height: 40, borderRadius: 20, marginRight: 10, backgroundColor: '#eee' },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 12 },
    
    unreadBanner: { paddingVertical: 8, marginVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8, width: '90%', alignSelf: 'center', elevation: 1 },
    unreadBannerText: { fontWeight: 'bold', fontSize: 13 },
    dateSeparator: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginVertical: 10, elevation: 1 },
    dateSeparatorText: { fontSize: 12, fontWeight: '600' },

    messageRow: { flexDirection: 'row', marginVertical: 5, paddingHorizontal: 10, alignItems: 'flex-end' },
    myMessageRow: { justifyContent: 'flex-end' },
    otherMessageRow: { justifyContent: 'flex-start' },
    senderDp: { width: 36, height: 36, borderRadius: 18, marginRight: 8, marginBottom: 5, backgroundColor: '#eee' },
    
    // Updated Message Container: Padding is dynamically adjusted in render for files
    messageContainer: { maxWidth: '80%', padding: 10, borderRadius: 12, elevation: 1, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 1 },
    
    mediaContainer: { backgroundColor: 'transparent' },
    senderInfo: { flexDirection: 'row', marginBottom: 4, alignItems: 'baseline' },
    senderName: { fontWeight: 'bold' },
    senderDetails: { fontSize: 11, marginLeft: 4 },
    messageText: { fontSize: 16 },
    messageTime: { fontSize: 11, marginLeft: 5 },
    mediaTime: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, fontSize: 10 },
    
    inputContainer: { flexDirection: 'row', padding: 8, alignItems: 'center' },
    input: { flex: 1, borderRadius: 20, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 16, maxHeight: 100 },
    sendButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
    iconButton: { padding: 8 },
    editingBanner: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1 },
    editingText: { flex: 1, marginLeft: 10 },
    replyingBanner: { flexDirection: 'row', alignItems: 'center', padding: 10, paddingLeft: 15, borderTopWidth: 1 },
    replyingTextContainer: { flex: 1, marginLeft: 10, borderLeftWidth: 3, paddingLeft: 10 },
    replyingToName: { fontWeight: 'bold' },
    
    mediaMessage: { width: 220, height: 220, borderRadius: 10 },
    replyContainer: { marginBottom: 5, padding: 8, borderRadius: 6, opacity: 0.8 },
    replySenderName: { fontWeight: 'bold', fontSize: 13 },
    replyText: { fontSize: 13 },
    mediaOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
    
    // Updated File Container Styles for slimmer look
    fileContainer: { flexDirection: 'row', alignItems: 'center', padding: 6, width: 230, borderRadius: 10 },
    fileIconWrapper: { padding: 8, borderRadius: 8, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
    fileInfo: { flex: 1, justifyContent: 'center' },
    fileName: { fontSize: 15, fontWeight: '500', marginBottom: 2 },
    fileSubText: { fontSize: 11 },
    
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { width: '80%', borderRadius: 10, paddingVertical: 10, elevation: 5 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
    modalOption: { paddingVertical: 15, paddingHorizontal: 20, borderTopWidth: 1 },
    modalOptionText: { fontSize: 16 },
    destructiveText: { color: '#dc3545' },
    videoPlayIconContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    videoModalContainer: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
    fullScreenVideo: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
    videoCloseButton: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, left: 20, zIndex: 1, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 5 },
    highlightedMessage: { backgroundColor: 'rgba(0, 80, 255, 0.15)', borderRadius: 15 },
});

export default GroupChatScreen;