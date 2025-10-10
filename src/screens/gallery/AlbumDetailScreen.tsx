import React, { useState, useEffect, FC, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, Dimensions,
    TouchableOpacity, Modal, SafeAreaView, Alert, ActivityIndicator,
    PermissionsAndroid, Platform, StatusBar
} from 'react-native';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import Video from 'react-native-video';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import RNFetchBlob from 'rn-fetch-blob';
import * as Animatable from 'react-native-animatable';
import FastImage from 'react-native-fast-image'; // Import FastImage for performance
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useAuth } from '../../context/AuthContext';

// --- Type Definitions (Updated for new API structure) ---
type GalleryItemType = { id: number; title: string; event_date: string; file_path: string; file_type: 'photo' | 'video'; };
type RootStackParamList = { AlbumDetail: { title: string }; }; // Now only receives the title
type AlbumDetailScreenRouteProp = RouteProp<RootStackParamList, 'AlbumDetail'>;
type FilterType = 'all' | 'photo' | 'video';

// --- Style Constants ---
const { width } = Dimensions.get('window');
const ITEM_MARGIN = 6;
const NUM_COLUMNS = 3;
const imageSize = (width - (ITEM_MARGIN * (NUM_COLUMNS + 1))) / NUM_COLUMNS;
const ACCENT_COLOR = '#5A33C8';

// --- Animatable Components ---
const AnimatableVideo = Animatable.createAnimatableComponent(Video);
const AnimatableFastImage = Animatable.createAnimatableComponent(FastImage);

// --- Download Helper (Unchanged from your original) ---
const handleDownloadItem = async (item: GalleryItemType) => { if (!item) return; const url = `${SERVER_URL}${item.file_path}`; const fileName = item.file_path.split('/').pop() || `gallery-item-${Date.now()}`; if (Platform.OS === 'android') { try { const permission = Platform.Version >= 33 ? (item.file_type === 'video' ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO : PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES) : PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE; const granted = await PermissionsAndroid.request(permission); if (granted !== PermissionsAndroid.RESULTS.GRANTED) { Alert.alert('Permission Denied'); return; } } catch (err) { console.warn(err); return; } } const { dirs } = RNFetchBlob.fs; const path = Platform.OS === 'ios' ? `${dirs.DocumentDir}/${fileName}` : `${dirs.PictureDir}/${fileName}`; RNFetchBlob.config({ path, fileCache: true, addAndroidDownloads: { useDownloadManager: true, notification: true, path, description: 'Downloading media.' } }).fetch('GET', url).then(() => Alert.alert('Success', 'Download complete.')).catch(() => Alert.alert('Download Failed')); };

// --- Main AlbumDetailScreen Component ---
const AlbumDetailScreen: FC = () => {
    const route = useRoute<AlbumDetailScreenRouteProp>();
    const navigation = useNavigation();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const albumTitle = route.params.title; // Get album title from navigation parameters

    // --- State Management (Updated) ---
    const [loading, setLoading] = useState(true); // Add loading state
    const [albumItems, setAlbumItems] = useState<GalleryItemType[]>([]); // Start with an empty array
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [filteredItems, setFilteredItems] = useState<GalleryItemType[]>([]);
    
    // Modal and submission state (unchanged)
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isImageModalVisible, setImageModalVisible] = useState(false);
    const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
    const [isVideoModalVisible, setVideoModalVisible] = useState(false);
    const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);

    // --- Data Fetching ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch items for this specific album using the new API endpoint
            const response = await apiClient.get<GalleryItemType[]>(`/gallery/album/${encodeURIComponent(albumTitle)}`);
            setAlbumItems(response.data);
        } catch (error) {
            Alert.alert("Error", "Could not load album items.");
        } finally {
            setLoading(false);
        }
    }, [albumTitle]);

    // Fetch data when the screen comes into focus
    useFocusEffect(fetchData);

    // Set screen title and filter items when data changes
    useEffect(() => { navigation.setOptions({ title: albumTitle }); }, [navigation, albumTitle]);
    useEffect(() => { if (activeFilter === 'all') setFilteredItems(albumItems); else setFilteredItems(albumItems.filter(item => item.file_type === activeFilter)); }, [albumItems, activeFilter]);

    // --- Handlers (Logic remains the same, just adapted for local state) ---
    const handleItemPress = (item: GalleryItemType) => { if (item.file_type === 'photo') { setSelectedImageUri(`${SERVER_URL}${item.file_path}`); setImageModalVisible(true); } else { setSelectedVideoUri(`${SERVER_URL}${item.file_path}`); setVideoModalVisible(true); } };
    const confirmDeleteItem = (itemToDelete: GalleryItemType) => Alert.alert("Delete Item", "Are you sure?", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteItem(itemToDelete.id) }]);
    const deleteItem = async (itemId: number) => { if (!user) return; try { await apiClient.delete(`/gallery/${itemId}`, { data: { role: user.role } }); setAlbumItems(prev => prev.filter(item => item.id !== itemId)); } catch (e) { Alert.alert("Error", "Could not delete item."); } };
    const handleAddItem = () => launchImageLibrary({ mediaType: 'mixed', selectionLimit: 10 }, async (res) => { if (res.didCancel || !res.assets) return; setIsSubmitting(true); const newItems = await Promise.all(res.assets.map(uploadItem)); setAlbumItems(prev => [...newItems.filter(Boolean).reverse() as GalleryItemType[], ...prev]); setIsSubmitting(false); });
    const uploadItem = async (asset: Asset): Promise<GalleryItemType | null> => { const originalEventDate = albumItems[0]?.event_date; if (!user || !originalEventDate) { Alert.alert("Error", "Cannot add to an empty album. Please upload from the main gallery screen first."); return null; } const fd = new FormData(); fd.append('title', albumTitle); fd.append('event_date', originalEventDate.split('T')[0]); fd.append('role', user.role); fd.append('adminId', String(user.id)); fd.append('media', { uri: asset.uri, type: asset.type, name: asset.fileName || `m-${Date.now()}` }); try { const { data } = await apiClient.post('/gallery/upload', fd); return { id: data.insertId, title: albumTitle, event_date: originalEventDate, file_path: data.filePath, file_type: asset.type?.startsWith('image') ? 'photo' : 'video' }; } catch (e) { Alert.alert("Upload Failed", "Could not upload the selected item."); return null; } };
    const closeModals = () => { setImageModalVisible(false); setVideoModalVisible(false); };
    
    // --- Grid Item Renderer (Using FastImage) ---
    const renderGridItem = ({ item, index }: { item: GalleryItemType; index: number }) => (
        <Animatable.View animation="zoomIn" duration={500} delay={index * 50} useNativeDriver={true}>
            <TouchableOpacity style={styles.gridItemContainer} onPress={() => handleItemPress(item)}>
                <FastImage 
                    source={{ uri: `${SERVER_URL}${item.file_path}`, priority: FastImage.priority.normal }} 
                    style={styles.image} 
                    resizeMode={FastImage.resizeMode.cover}
                />
                {item.file_type === 'video' && (<View style={styles.videoOverlay}><Icon name="play-circle" size={30} color="rgba(255,255,255,0.8)" /></View>)}
                <View style={styles.iconOverlay}>
                    {isAdmin && (<TouchableOpacity style={styles.iconButton} onPress={(e) => { e.stopPropagation(); confirmDeleteItem(item); }}><Icon name="trash-outline" size={18} color="white" /></TouchableOpacity>)}
                    <TouchableOpacity style={styles.iconButton} onPress={(e) => { e.stopPropagation(); handleDownloadItem(item); }}><Icon name="download-outline" size={18} color="white" /></TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Animatable.View>
    );

    // Show a loading spinner while fetching data
    if (loading) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={ACCENT_COLOR} /></View>;
    }

    // --- Main JSX ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
            <View style={styles.filterContainer}>
                {(['all', 'photo', 'video'] as FilterType[]).map(type => (
                    <TouchableOpacity key={type} style={[styles.filterButton, activeFilter === type && styles.activeFilterButton]} onPress={() => setActiveFilter(type)}>
                        <Text style={[styles.filterButtonText, activeFilter === type && styles.activeFilterButtonText]}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <FlatList data={filteredItems} keyExtractor={(item) => item.id.toString()} numColumns={NUM_COLUMNS} renderItem={renderGridItem} contentContainerStyle={styles.listContainer} ListEmptyComponent={<View style={styles.emptyContainer}><Icon name="images-outline" size={60} color="#ccc" /><Text style={styles.emptyText}>No items found in this album.</Text></View>} />
            {isAdmin && (<Animatable.View animation="zoomIn" duration={400} delay={300} style={styles.fabContainer}><TouchableOpacity style={styles.fab} onPress={handleAddItem} disabled={isSubmitting}>{isSubmitting ? <ActivityIndicator color="#fff" /> : <Icon name="add" size={30} color="white" />}</TouchableOpacity></Animatable.View>)}
            <Modal visible={isImageModalVisible} transparent={true} animationType="none" onRequestClose={closeModals}><Animatable.View style={styles.modalContainer} animation="fadeIn"><TouchableOpacity style={styles.closeButton} onPress={closeModals}><Icon name="close" size={32} color="white" /></TouchableOpacity><AnimatableFastImage source={{ uri: selectedImageUri!, priority: FastImage.priority.high }} style={styles.fullscreenImage} resizeMode={FastImage.resizeMode.contain} animation="zoomIn" /></Animatable.View></Modal>
            <Modal visible={isVideoModalVisible} transparent={true} animationType="none" onRequestClose={closeModals}><Animatable.View style={styles.modalContainer} animation="fadeIn"><TouchableOpacity style={styles.closeButton} onPress={closeModals}><Icon name="close" size={32} color="white" /></TouchableOpacity>{selectedVideoUri && ( <AnimatableVideo source={{ uri: selectedVideoUri }} style={styles.fullscreenVideo} controls={true} resizeMode="contain" animation="zoomIn" /> )}</Animatable.View></Modal>
        </SafeAreaView>
    );
};
// Styles are the same as your original, with a new loadingContainer style
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
    filterContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    filterButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginHorizontal: 8, backgroundColor: '#f0f2f5' },
    activeFilterButton: { backgroundColor: ACCENT_COLOR, elevation: 2 },
    filterButtonText: { color: '#555', fontWeight: '600', fontSize: 14 },
    activeFilterButtonText: { color: '#FFFFFF' },
    listContainer: { padding: ITEM_MARGIN, paddingBottom: 80 },
    gridItemContainer: { width: imageSize, height: imageSize, margin: ITEM_MARGIN / 2, borderRadius: 8, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: '#e0e0e0' },
    image: { width: '100%', height: '100%' },
    videoOverlay: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.2)', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    iconOverlay: { position: 'absolute', bottom: 0, right: 0, left: 0, padding: 6, flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    iconButton: { marginLeft: 10 },
    modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    fullscreenImage: { width: '100%', height: '100%' },
    fullscreenVideo: { width: '100%', height: '80%' },
    closeButton: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 20, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
    fabContainer: { position: 'absolute', right: 25, bottom: 25 },
    fab: { width: 60, height: 60, borderRadius: 30, backgroundColor: ACCENT_COLOR, justifyContent: 'center', alignItems: 'center', elevation: 8 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
    emptyText: { textAlign: 'center', fontSize: 18, color: '#888', marginTop: 16, fontWeight: '600' }
});
export default AlbumDetailScreen;