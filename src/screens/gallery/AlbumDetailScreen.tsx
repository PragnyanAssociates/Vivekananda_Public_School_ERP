import React, { useState, useEffect, FC, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, Dimensions,
    TouchableOpacity, Modal, SafeAreaView, Alert, ActivityIndicator,
    PermissionsAndroid, Platform, StatusBar, useColorScheme
} from 'react-native';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import Video from 'react-native-video';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import RNFetchBlob from 'rn-fetch-blob';
import * as Animatable from 'react-native-animatable';
import FastImage from 'react-native-fast-image';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useAuth } from '../../context/AuthContext';

// --- Type Definitions ---
type GalleryItemType = { 
    id: number; 
    title: string; 
    event_date: string; 
    file_path: string; 
    file_type: 'photo' | 'video'; 
};
type RootStackParamList = { AlbumDetail: { title: string }; };
type AlbumDetailScreenRouteProp = RouteProp<RootStackParamList, 'AlbumDetail'>;
type FilterType = 'all' | 'photo' | 'video';

// --- Theme Configuration ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#E0E0E0',
    overlay: 'rgba(0,0,0,0.3)',
    iconColor: '#333333'
};
const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    overlay: 'rgba(0,0,0,0.5)',
    iconColor: '#FFFFFF'
};

// --- Responsive Grid Constants ---
const { width, height } = Dimensions.get('window');
const ITEM_MARGIN = 6;
const NUM_COLUMNS = 3;
const imageSize = (width - (ITEM_MARGIN * (NUM_COLUMNS + 1))) / NUM_COLUMNS;

// --- Animatable Components ---
const AnimatableVideo = Animatable.createAnimatableComponent(Video);
const AnimatableFastImage = Animatable.createAnimatableComponent(FastImage);

const AlbumDetailScreen: FC = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const route = useRoute<AlbumDetailScreenRouteProp>();
    const navigation = useNavigation();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const albumTitle = route.params.title;

    // --- State ---
    const [loading, setLoading] = useState(true);
    const [albumItems, setAlbumItems] = useState<GalleryItemType[]>([]);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [filteredItems, setFilteredItems] = useState<GalleryItemType[]>([]);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Modal State
    const [isImageModalVisible, setImageModalVisible] = useState(false);
    const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
    const [isVideoModalVisible, setVideoModalVisible] = useState(false);
    const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);

    // --- Fetch Data ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiClient.get<GalleryItemType[]>(`/gallery/album/${encodeURIComponent(albumTitle)}`);
            setAlbumItems(response.data);
        } catch (error) {
            Alert.alert("Error", "Could not load album items.");
        } finally {
            setLoading(false);
        }
    }, [albumTitle]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    useEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]);

    useEffect(() => {
        if (activeFilter === 'all') setFilteredItems(albumItems);
        else setFilteredItems(albumItems.filter(item => item.file_type === activeFilter));
    }, [albumItems, activeFilter]);

    // --- UPDATED Download Logic ---
    const handleDownloadItem = async (item: GalleryItemType) => {
        if (!item) return;
        
        const fileUrl = `${SERVER_URL}${item.file_path}`;
        // Extract extension or default to jpg/mp4
        const extension = item.file_path.split('.').pop() || (item.file_type === 'video' ? 'mp4' : 'jpg');
        const fileName = `download_${Date.now()}.${extension}`;
        
        // Define Mime Type
        const mimeType = item.file_type === 'video' ? 'video/mp4' : 'image/jpeg';

        // 1. Permission Check (Only needed for Android < 10)
        if (Platform.OS === 'android' && Platform.Version < 29) {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                    {
                        title: 'Storage Permission Required',
                        message: 'App needs access to your storage to download photos.',
                        buttonPositive: 'OK',
                    }
                );
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    Alert.alert('Permission Denied', 'Storage permission is required to download.');
                    return;
                }
            } catch (err) {
                console.warn(err);
                return;
            }
        }

        // 2. Configure Download Path
        const { dirs } = RNFetchBlob.fs;
        // Use DownloadDir for Android to ensure visibility in "Files" and Gallery
        const path = Platform.OS === 'android' ? `${dirs.DownloadDir}/${fileName}` : `${dirs.DocumentDir}/${fileName}`;

        // 3. Start Download
        RNFetchBlob.config({
            fileCache: true,
            path: path,
            addAndroidDownloads: {
                useDownloadManager: true, // Use built-in Android Manager
                notification: true,       // Show notification in status bar
                title: fileName,
                description: 'Downloading media...',
                mime: mimeType,           // Help Android classify the file
                mediaScannable: true,     // Scan immediately so it shows in Gallery
                path: path,               // Explicit path
            }
        })
        .fetch('GET', fileUrl)
        .then((res) => {
            // Success
            Alert.alert('Success', 'Image downloaded successfully.');
            
            // For iOS, you might want to explicitly save to camera roll here if needed
            // if (Platform.OS === 'ios') { CameraRoll.save(res.path()) ... }
        })
        .catch((errorMessage) => {
            console.error(errorMessage);
            Alert.alert('Download Failed', 'Could not download the file.');
        });
    };

    // --- Action Handlers ---
    const handleItemPress = (item: GalleryItemType) => {
        if (item.file_type === 'photo') {
            setSelectedImageUri(`${SERVER_URL}${item.file_path}`);
            setImageModalVisible(true);
        } else {
            setSelectedVideoUri(`${SERVER_URL}${item.file_path}`);
            setVideoModalVisible(true);
        }
    };

    const confirmManageItem = (item: GalleryItemType) => {
        Alert.alert(
            "Manage Media",
            "Choose an action",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Download", onPress: () => handleDownloadItem(item) },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        Alert.alert(
                            "Delete Item",
                            "Are you sure you want to delete this item?",
                            [
                                { text: "No", style: "cancel" },
                                { text: "Yes, Delete", style: "destructive", onPress: () => deleteItem(item.id) }
                            ]
                        );
                    }
                }
            ]
        );
    };

    const deleteItem = async (itemId: number) => {
        if (!user) return;
        try {
            await apiClient.delete(`/gallery/${itemId}`, { data: { role: user.role } });
            setAlbumItems(prev => prev.filter(item => item.id !== itemId));
        } catch (e) {
            Alert.alert("Error", "Could not delete item.");
        }
    };

    // --- Upload Logic ---
    const handleAddItem = () => launchImageLibrary({ mediaType: 'mixed', selectionLimit: 10 }, async (res) => {
        if (res.didCancel || !res.assets) return;
        setIsSubmitting(true);
        const newItems = await Promise.all(res.assets.map(uploadItem));
        setAlbumItems(prev => [...newItems.filter(Boolean).reverse() as GalleryItemType[], ...prev]);
        setIsSubmitting(false);
    });

    const uploadItem = async (asset: Asset): Promise<GalleryItemType | null> => {
        const originalEventDate = albumItems[0]?.event_date;
        if (!user || !originalEventDate) {
            Alert.alert("Error", "Cannot add to an empty album.");
            return null;
        }
        const fd = new FormData();
        fd.append('title', albumTitle);
        fd.append('event_date', originalEventDate.split('T')[0]);
        fd.append('role', user.role);
        fd.append('adminId', String(user.id));
        fd.append('media', { uri: asset.uri, type: asset.type, name: asset.fileName || `m-${Date.now()}` });

        try {
            const { data } = await apiClient.post('/gallery/upload', fd);
            return {
                id: data.insertId,
                title: albumTitle,
                event_date: originalEventDate,
                file_path: data.filePath,
                file_type: asset.type?.startsWith('image') ? 'photo' : 'video'
            };
        } catch (e) {
            Alert.alert("Upload Failed", "Could not upload one or more items.");
            return null;
        }
    };

    const closeModals = () => {
        setImageModalVisible(false);
        setVideoModalVisible(false);
    };

    // --- Render Item ---
    const renderGridItem = ({ item, index }: { item: GalleryItemType; index: number }) => (
        <Animatable.View animation="zoomIn" duration={500} delay={index * 50} useNativeDriver={true}>
            <TouchableOpacity
                style={[styles.gridItemContainer, { backgroundColor: COLORS.border }]}
                onPress={() => handleItemPress(item)}
                onLongPress={() => isAdmin && confirmManageItem(item)}
                activeOpacity={0.9}
            >
                <FastImage
                    source={{ uri: `${SERVER_URL}${item.file_path}`, priority: FastImage.priority.normal }}
                    style={styles.image}
                    resizeMode={FastImage.resizeMode.cover}
                />

                {item.file_type === 'video' && (
                    <View style={styles.videoOverlay}>
                        <Icon name="play-circle" size={30} color="rgba(255,255,255,0.8)" />
                    </View>
                )}

                <View style={styles.iconOverlay}>
                    <TouchableOpacity
                        style={[styles.iconButton, { backgroundColor: COLORS.overlay }]}
                        onPress={(e) => {
                            e.stopPropagation();
                            isAdmin ? confirmManageItem(item) : handleDownloadItem(item);
                        }}
                    >
                        <Icon name={isAdmin ? "ellipsis-vertical" : "download-outline"} size={16} color="white" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Animatable.View>
    );

    if (loading) {
        return <View style={[styles.loadingContainer, { backgroundColor: COLORS.background }]}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={COLORS.background} />

            {/* --- HEADER --- */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                {/* Left Side: Back & Title */}
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 8, padding: 4 }}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>
                    <View style={[styles.headerIconContainer, { backgroundColor: isDark ? '#333' : '#E0F2F1' }]}>
                        <MaterialIcons name="photo-library" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]} numberOfLines={1}>{albumTitle}</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>{albumItems.length} items</Text>
                    </View>
                </View>

                {/* Right Side: ADD BUTTON (New Placement) */}
                {isAdmin && (
                    <TouchableOpacity 
                        style={[styles.headerAddButton, { backgroundColor: COLORS.primary }]} 
                        onPress={handleAddItem}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <>
                                <Icon name="add" size={18} color="#FFF" />
                                <Text style={styles.headerAddText}>Add</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {/* --- FILTERS --- */}
            <View style={styles.filterContainer}>
                {(['all', 'photo', 'video'] as FilterType[]).map(type => (
                    <TouchableOpacity
                        key={type}
                        style={[
                            styles.filterButton,
                            { backgroundColor: isDark ? '#333' : '#E0E0E0' },
                            activeFilter === type && { backgroundColor: COLORS.primary }
                        ]}
                        onPress={() => setActiveFilter(type)}
                    >
                        <Text style={[
                            styles.filterButtonText,
                            { color: isDark ? '#BBB' : '#555' },
                            activeFilter === type && { color: '#FFF' }
                        ]}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* --- LIST --- */}
            <FlatList
                data={filteredItems}
                keyExtractor={(item) => item.id.toString()}
                numColumns={NUM_COLUMNS}
                renderItem={renderGridItem}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="images-outline" size={60} color={COLORS.border} />
                        <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No items found.</Text>
                    </View>
                }
            />

            {/* --- IMAGE MODAL --- */}
            <Modal visible={isImageModalVisible} transparent={true} animationType="none" onRequestClose={closeModals}>
                <Animatable.View style={styles.modalContainer} animation="fadeIn">
                    <TouchableOpacity style={styles.closeButton} onPress={closeModals}>
                        <Icon name="close" size={32} color="white" />
                    </TouchableOpacity>
                    {selectedImageUri && (
                        <AnimatableFastImage
                            source={{ uri: selectedImageUri, priority: FastImage.priority.high }}
                            style={styles.fullscreenMedia}
                            resizeMode={FastImage.resizeMode.contain}
                            animation="zoomIn"
                        />
                    )}
                </Animatable.View>
            </Modal>

            {/* --- VIDEO MODAL --- */}
            <Modal visible={isVideoModalVisible} transparent={true} animationType="none" onRequestClose={closeModals}>
                <Animatable.View style={styles.modalContainer} animation="fadeIn">
                    <TouchableOpacity style={styles.closeButton} onPress={closeModals}>
                        <Icon name="close" size={32} color="white" />
                    </TouchableOpacity>
                    {selectedVideoUri && (
                        <AnimatableVideo
                            source={{ uri: selectedVideoUri }}
                            style={styles.fullscreenMedia}
                            controls={true}
                            resizeMode="contain"
                            animation="zoomIn"
                            muted={false}
                            ignoreSilentSwitch="ignore"
                        />
                    )}
                </Animatable.View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Header
    headerCard: {
        paddingHorizontal: 15, paddingVertical: 12, width: '94%',
        alignSelf: 'center', marginTop: 15, marginBottom: 10,
        borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        elevation: 3, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 12 },

    // Header Action Button (Add)
    headerAddButton: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 8, paddingHorizontal: 16,
        borderRadius: 20, elevation: 2
    },
    headerAddText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, marginLeft: 4 },

    // Filters
    filterContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10 },
    filterButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginHorizontal: 5 },
    filterButtonText: { fontWeight: '600', fontSize: 13 },

    // Grid
    listContainer: { padding: ITEM_MARGIN, paddingBottom: 100 },
    gridItemContainer: { width: imageSize, height: imageSize, margin: ITEM_MARGIN / 2, borderRadius: 8, overflow: 'hidden', elevation: 1 },
    image: { width: '100%', height: '100%' },
    videoOverlay: { position: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
    
    // Icons on top of image
    iconOverlay: { position: 'absolute', top: 5, right: 5, zIndex: 5 },
    iconButton: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

    // Modals
    modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    fullscreenMedia: { width: width, height: height * 0.8 },
    closeButton: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 30, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },

    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
    emptyText: { textAlign: 'center', fontSize: 16, marginTop: 16, fontWeight: '600' }
});

export default AlbumDetailScreen;