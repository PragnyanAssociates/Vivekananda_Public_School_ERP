// 📂 File: src/screens/gallery/AlbumDetailScreen.tsx (FULLY OPTIMIZED)

import React, { useState, useEffect, FC, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, Dimensions,
    TouchableOpacity, Modal, SafeAreaView, Alert, ActivityIndicator,
    PermissionsAndroid, Platform, StatusBar
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import Video from 'react-native-video';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import RNFetchBlob from 'rn-fetch-blob';
import * as Animatable from 'react-native-animatable';
import FastImage from 'react-native-fast-image'; // ✨ IMPORT FASTIMAGE
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useAuth } from '../../context/AuthContext';

// --- Type Definitions ---
type GalleryItemType = { id: number; title: string; event_date: string; file_path: string; file_type: 'photo' | 'video'; };
type RootStackParamList = { AlbumDetail: { title: string; items: GalleryItemType[]; onRefresh: () => void; }; };
type AlbumDetailScreenRouteProp = RouteProp<RootStackParamList, 'AlbumDetail'>;
type FilterType = 'all' | 'photo' | 'video';

const { width } = Dimensions.get('window');
const ITEM_MARGIN = 6;
const NUM_COLUMNS = 3;
const imageSize = (width - (ITEM_MARGIN * (NUM_COLUMNS + 1))) / NUM_COLUMNS;
const ACCENT_COLOR = '#5A33C8';

const AnimatableVideo = Animatable.createAnimatableComponent(Video);

const handleDownloadItem = async (item: GalleryItemType) => {
    if (!item) return;
    const filename = item.file_path.split('/').pop() || `gallery-item-${Date.now()}`;
    const url = `${SERVER_URL}/api/image/${filename}`; // ✨ Use API route for downloads too

    if (Platform.OS === 'android') {
        try {
            const permission = Platform.Version >= 33 ? (item.file_type === 'video' ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO : PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES) : PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
            const granted = await PermissionsAndroid.request(permission);
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                Alert.alert('Permission Denied', 'Storage permission is required to download files.');
                return;
            }
        } catch (err) {
            console.warn(err);
            return;
        }
    }

    const { dirs } = RNFetchBlob.fs;
    const dir = Platform.OS === 'ios' ? dirs.DocumentDir : dirs.DownloadDir;
    const path = `${dir}/${filename}`;

    RNFetchBlob.config({
        path,
        fileCache: true,
        addAndroidDownloads: {
            useDownloadManager: true,
            notification: true,
            path,
            description: 'Downloading media from school app.',
            mime: item.file_type === 'video' ? 'video/mp4' : 'image/jpeg',
        }
    })
    .fetch('GET', url)
    .then(() => Alert.alert('Success', 'Download complete.'))
    .catch((error) => {
        console.error('Download error:', error);
        Alert.alert('Error', 'Download failed. Please try again.');
    });
};

const AlbumDetailScreen: FC = () => {
    const route = useRoute<AlbumDetailScreenRouteProp>();
    const navigation = useNavigation();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [albumItems, setAlbumItems] = useState<GalleryItemType[]>(route.params.items);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [filteredItems, setFilteredItems] = useState<GalleryItemType[]>(albumItems);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isImageModalVisible, setImageModalVisible] = useState(false);
    const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
    const [isVideoModalVisible, setVideoModalVisible] = useState(false);
    const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);

    useEffect(() => { navigation.setOptions({ title: route.params.title }); }, [navigation, route.params.title]);
    useEffect(() => { if (activeFilter === 'all') setFilteredItems(albumItems); else setFilteredItems(albumItems.filter(item => item.file_type === activeFilter)); }, [albumItems, activeFilter]);

    const handleItemPress = (item: GalleryItemType) => {
        const filename = item.file_path.split('/').pop() || '';
        if (item.file_type === 'photo') {
            setSelectedImageUri(`${SERVER_URL}/api/image/${filename}`); // ✨ Use full-size image API
            setImageModalVisible(true);
        } else {
            setSelectedVideoUri(`${SERVER_URL}/api/image/${filename}`); // ✨ Use API for video too
            setVideoModalVisible(true);
        }
    };

    const confirmDeleteItem = (itemToDelete: GalleryItemType) => Alert.alert("Delete Item", "Are you sure this action cannot be undone?", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteItem(itemToDelete.id) }]);
    const deleteItem = async (itemId: number) => { if (!user) return; try { await apiClient.delete(`/gallery/${itemId}`, { data: { role: user.role } }); setAlbumItems(prev => prev.filter(item => item.id !== itemId)); route.params.onRefresh(); } catch (e) { Alert.alert("Error", "Could not delete item."); } };
    
    const handleAddItem = () => launchImageLibrary({ mediaType: 'mixed', selectionLimit: 5 }, async (res) => {
        if (res.didCancel || !res.assets) return;
        setIsSubmitting(true);
        const newItems = await Promise.all(res.assets.map(uploadItem));
        const validNewItems = newItems.filter(Boolean) as GalleryItemType[];
        if (validNewItems.length > 0) {
            setAlbumItems(prev => [...validNewItems.reverse(), ...prev]);
            route.params.onRefresh(); // ✨ Call onRefresh to update the main screen
        }
        setIsSubmitting(false);
    });

    const uploadItem = async (asset: Asset): Promise<GalleryItemType | null> => { const originalEventDate = route.params.items[0]?.event_date; if (!user || !originalEventDate) return null; const fd = new FormData(); fd.append('title', route.params.title); fd.append('event_date', originalEventDate.split('T')[0]); fd.append('role', user.role); fd.append('adminId', String(user.id)); fd.append('media', { uri: asset.uri, type: asset.type, name: asset.fileName || `m-${Date.now()}` }); try { const { data } = await apiClient.post('/gallery/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); return { id: data.insertId, title: route.params.title, event_date: originalEventDate, file_path: data.filePath, file_type: asset.type?.startsWith('image') ? 'photo' : 'video' }; } catch (e) { console.error('Upload item failed:', e); return null; } };
    
    const closeModals = () => { setImageModalVisible(false); setVideoModalVisible(false); setSelectedImageUri(null); setSelectedVideoUri(null); };
    
    const renderGridItem = ({ item, index }: { item: GalleryItemType; index: number }) => {
        const filename = item.file_path.split('/').pop() || '';
        return (
            <Animatable.View animation="zoomIn" duration={500} delay={index * 50} useNativeDriver={true}>
                <TouchableOpacity style={styles.gridItemContainer} onPress={() => handleItemPress(item)}>
                    <FastImage
                        source={{
                            uri: `${SERVER_URL}/api/image/${filename}?w=300`, // ✨ Use Thumbnail API
                            priority: FastImage.priority.normal,
                        }}
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
    };

    // ✨ Layout calculation for FlatList performance
    const getItemLayout = (data, index) => ({
        length: imageSize + ITEM_MARGIN, // Item size + margin
        offset: (imageSize + ITEM_MARGIN) * Math.floor(index / NUM_COLUMNS),
        index,
    });

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
            <FlatList
                data={filteredItems}
                keyExtractor={(item) => item.id.toString()}
                numColumns={NUM_COLUMNS}
                renderItem={renderGridItem}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={<View style={styles.emptyContainer}><Icon name="images-outline" size={60} color="#ccc" /><Text style={styles.emptyText}>No items found.</Text></View>}
                // ✨ PERFORMANCE PROPS
                initialNumToRender={15}
                maxToRenderPerBatch={9}
                windowSize={11}
                getItemLayout={getItemLayout}
                removeClippedSubviews={true}
            />
            {isAdmin && (<Animatable.View animation="zoomIn" duration={400} delay={300} style={styles.fabContainer}><TouchableOpacity style={styles.fab} onPress={handleAddItem} disabled={isSubmitting}>{isSubmitting ? <ActivityIndicator color="#fff" /> : <Icon name="add" size={30} color="white" />}</TouchableOpacity></Animatable.View>)}
            <Modal visible={isImageModalVisible} transparent={true} animationType="fade" onRequestClose={closeModals}><Animatable.View style={styles.modalContainer} animation="fadeIn"><TouchableOpacity style={styles.closeButton} onPress={closeModals}><Icon name="close" size={32} color="white" /></TouchableOpacity>{selectedImageUri && <FastImage source={{ uri: selectedImageUri, priority: FastImage.priority.high }} style={styles.fullscreenImage} resizeMode={FastImage.resizeMode.contain} />}</Animatable.View></Modal>
            <Modal visible={isVideoModalVisible} transparent={true} animationType="fade" onRequestClose={closeModals}><Animatable.View style={styles.modalContainer} animation="fadeIn"><TouchableOpacity style={styles.closeButton} onPress={closeModals}><Icon name="close" size={32} color="white" /></TouchableOpacity>{selectedVideoUri && (<AnimatableVideo source={{ uri: selectedVideoUri }} style={styles.fullscreenVideo} controls={true} resizeMode="contain" animation="zoomIn" />)}</Animatable.View></Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    filterContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    filterButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginHorizontal: 8, backgroundColor: '#f0f2f5' },
    activeFilterButton: { backgroundColor: ACCENT_COLOR, elevation: 2 },
    filterButtonText: { color: '#555', fontWeight: '600', fontSize: 14 },
    activeFilterButtonText: { color: '#FFFFFF' },
    listContainer: { padding: ITEM_MARGIN / 2, paddingBottom: 80 },
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
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100, width: width },
    emptyText: { textAlign: 'center', fontSize: 18, color: '#888', marginTop: 16, fontWeight: '600' }
});
export default AlbumDetailScreen;