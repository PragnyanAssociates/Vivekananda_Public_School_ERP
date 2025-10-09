// 📂 File: src/screens/gallery/GalleryScreen.tsx (FULLY OPTIMIZED)

import React, { useState, FC, useCallback, useEffect, memo } from 'react';
import {
    View, Text, StyleSheet, FlatList, Dimensions,
    TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput,
    Button, Platform, SafeAreaView, StatusBar
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import RNPickerSelect from 'react-native-picker-select';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import LinearGradient from 'react-native-linear-gradient';
import FastImage from 'react-native-fast-image'; // ✨ IMPORT FASTIMAGE
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';

// --- Type Definitions ---
type GalleryItemType = { id: number; title: string; event_date: string; file_path: string; file_type: 'photo' | 'video'; uploader_name: string; };
type AlbumSection = { title: string; date: string; items: GalleryItemType[]; };
type RootStackParamList = { AlbumDetail: { title: string; items: GalleryItemType[]; onRefresh: () => void; } }; // ✨ Pass onRefresh prop
type GalleryScreenNavigationProp = StackNavigationProp<RootStackParamList>;
type DateFilterType = 'month' | 'year';

// --- Style Constants ---
const { width, height } = Dimensions.get('window');
const ACCENT_COLOR = '#5A33C8';
const NUM_COLUMNS = 2;
const MARGIN = 12;
const albumSize = (width - MARGIN * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

// --- AlbumCover Component (Optimized & Memoized) ---
const AlbumCover: FC<{ section: AlbumSection; onPress: () => void; onDelete: () => void; isAdmin: boolean; index: number; }> = memo(({ section, onPress, onDelete, isAdmin, index }) => {
    const coverItem = section.items.find(i => i.file_type === 'photo') || section.items[0];
    const coverPath = coverItem ? coverItem.file_path : '';
    const filename = coverPath ? coverPath.split('/').pop() : '';

    return (
        <Animatable.View animation="zoomIn" duration={500} delay={index * 100} useNativeDriver={true}>
            <TouchableOpacity style={styles.albumContainer} onPress={onPress}>
                {section.items.every(i => i.file_type === 'video') ? (
                    <View style={styles.albumImage}><Icon name="film-outline" size={40} color="rgba(255,255,255,0.6)" /></View>
                ) : (
                    <FastImage
                        source={{
                            uri: `${SERVER_URL}/api/image/${filename}?w=400`, // ✨ Use Thumbnail API
                            priority: FastImage.priority.normal,
                        }}
                        style={styles.albumImage}
                        resizeMode={FastImage.resizeMode.cover}
                    />
                )}
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.gradientOverlay} />
                <View style={styles.albumInfo}>
                    <Text style={styles.albumTitle} numberOfLines={2}>{section.title}</Text>
                    <Text style={styles.albumDate}>{new Date(section.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                    <Text style={styles.albumCount}>{section.items.length} items</Text>
                </View>
                {isAdmin && <TouchableOpacity style={styles.deleteButton} onPress={(e) => { e.stopPropagation(); onDelete(); }}><Icon name="trash-outline" size={18} color="white" /></TouchableOpacity>}
            </TouchableOpacity>
        </Animatable.View>
    );
});


// --- Main GalleryScreen Component ---
const GalleryScreen: FC = () => {
    const { user } = useAuth();
    const navigation = useNavigation<GalleryScreenNavigationProp>();
    const isAdmin = user?.role === 'admin';
    const [allAlbums, setAllAlbums] = useState<AlbumSection[]>([]);
    const [filteredAlbums, setFilteredAlbums] = useState<AlbumSection[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isFilterModalVisible, setFilterModalVisible] = useState(false);

    const [activeDateFilterType, setActiveDateFilterType] = useState<DateFilterType | null>(null);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [tempActiveDateFilterType, setTempActiveDateFilterType] = useState<DateFilterType | null>(null);
    const [tempSelectedYear, setTempSelectedYear] = useState<number | null>(null);
    const [tempSelectedMonth, setTempSelectedMonth] = useState<number | null>(null);
    const [availableYears, setAvailableYears] = useState<{ label: string; value: number }[]>([]);

    useEffect(() => {
        let albumsToFilter = [...allAlbums];
        if (activeDateFilterType && selectedYear) {
            if (activeDateFilterType === 'year') {
                albumsToFilter = albumsToFilter.filter(album => new Date(album.date).getFullYear() === selectedYear);
            } else if (activeDateFilterType === 'month' && selectedMonth !== null) {
                albumsToFilter = albumsToFilter.filter(album => {
                    const albumDate = new Date(album.date);
                    return albumDate.getFullYear() === selectedYear && albumDate.getMonth() === selectedMonth;
                });
            }
        }
        setFilteredAlbums(albumsToFilter);
    }, [allAlbums, activeDateFilterType, selectedYear, selectedMonth]);

    useEffect(() => {
        if (allAlbums.length > 0) {
            const years = [...new Set(allAlbums.map(album => new Date(album.date).getFullYear()))];
            setAvailableYears(years.sort((a, b) => b - a).map(y => ({ label: String(y), value: y })));
        }
    }, [allAlbums]);

    const groupDataByTitle = (data: GalleryItemType[]): AlbumSection[] => {
        if (!data) return [];
        const grouped = data.reduce((acc, item) => { if (!acc[item.title]) { acc[item.title] = { title: item.title, date: item.event_date, items: [] }; } acc[item.title].items.push(item); return acc; }, {} as Record<string, AlbumSection>);
        return Object.values(grouped).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    const fetchData = useCallback(async () => { setLoading(true); try { const response = await apiClient.get<GalleryItemType[]>('/gallery'); setAllAlbums(groupDataByTitle(response.data)); } catch (error: any) { Alert.alert("Error", "Failed to load albums."); } finally { setLoading(false); } }, []);
    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const handleApplyFilter = () => { setActiveDateFilterType(tempActiveDateFilterType); setSelectedYear(tempSelectedYear); setSelectedMonth(tempSelectedMonth); setFilterModalVisible(false); };
    const handleClearFilter = () => { setTempActiveDateFilterType(null); setTempSelectedYear(null); setTempSelectedMonth(null); };
    const handleOpenFilterModal = () => { setTempActiveDateFilterType(activeDateFilterType); setTempSelectedYear(selectedYear); setTempSelectedMonth(selectedMonth); setFilterModalVisible(true); };

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isUploadModalVisible, setUploadModalVisible] = useState<boolean>(false);
    const [title, setTitle] = useState<string>('');
    const [eventDate, setEventDate] = useState<Date>(new Date());
    const [asset, setAsset] = useState<Asset | null>(null);
    const handleOpenUploadModal = () => { setTitle(''); setEventDate(new Date()); setAsset(null); setUploadModalVisible(true); };
    const handleDeleteAlbum = (albumTitle: string) => Alert.alert("Delete Album", `Are you sure?`, [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: async () => { try { await apiClient.delete('/gallery/album', { data: { title: albumTitle, role: user?.role } }); fetchData(); } catch (e) { Alert.alert("Error", "Could not delete."); } } }]);
    
    // ✨ PASS onRefresh function to AlbumDetail screen
    const handleAlbumPress = (section: AlbumSection) => navigation.navigate('AlbumDetail', { title: section.title, items: section.items, onRefresh: fetchData });
    
    const handleUpload = async () => { if (!user || !title.trim() || !eventDate || !asset) { Alert.alert('Validation Error', 'All fields required.'); return; } setIsSubmitting(true); const fd = new FormData(); fd.append('title', title.trim()); fd.append('event_date', eventDate.toISOString().split('T')[0]); fd.append('role', user.role); fd.append('adminId', String(user.id)); fd.append('media', { uri: asset.uri, type: asset.type, name: asset.fileName || `m-${Date.now()}` }); try { await apiClient.post('/gallery/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); Alert.alert('Success', 'Uploaded!'); setUploadModalVisible(false); fetchData(); } catch (e) { Alert.alert('Error', 'Upload failed.'); } finally { setIsSubmitting(false); } };

    const monthItems = [{ label: "January", value: 0 }, { label: "February", value: 1 }, { label: "March", value: 2 }, { label: "April", value: 3 }, { label: "May", value: 4 }, { label: "June", value: 5 }, { label: "July", value: 6 }, { label: "August", value: 7 }, { label: "September", value: 8 }, { label: "October", value: 9 }, { label: "November", value: 10 }, { label: "December", value: 11 }];
    
    // ✨ Memoized render function for FlatList performance
    const renderAlbumCover = useCallback(({ item, index }) => (
        <AlbumCover
            section={item}
            onPress={() => handleAlbumPress(item)}
            onDelete={() => handleDeleteAlbum(item.title)}
            isAdmin={!!isAdmin}
            index={index}
        />
    ), [isAdmin]);
    
    // ✨ Layout calculation for FlatList performance
    const getItemLayout = (data, index) => ({
        length: albumSize + 20 + MARGIN, // Item height + margin
        offset: (albumSize + 20 + MARGIN) * Math.floor(index / NUM_COLUMNS),
        index,
    });

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Photos & Videos</Text>
                <TouchableOpacity style={[styles.filterTriggerButton, activeDateFilterType && styles.filterActive]} onPress={handleOpenFilterModal}>
                    <Icon name="funnel-outline" size={18} color={activeDateFilterType ? ACCENT_COLOR : '#333'} />
                    <Text style={[styles.filterTriggerText, activeDateFilterType && { color: ACCENT_COLOR }]}>Filter</Text>
                    {activeDateFilterType && <View style={styles.activeFilterIndicator} />}
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredAlbums}
                numColumns={NUM_COLUMNS}
                keyExtractor={(item) => item.title}
                renderItem={renderAlbumCover}
                ListEmptyComponent={<View style={styles.emptyContainer}><Icon name="images-outline" size={60} color="#ccc" /><Text style={styles.emptyText}>No Albums Found</Text><Text style={styles.emptySubText}>Try adjusting your filters or create a new album.</Text></View>}
                contentContainerStyle={styles.listContainer}
                onRefresh={fetchData}
                refreshing={loading}
                // ✨ PERFORMANCE PROPS
                initialNumToRender={6}
                maxToRenderPerBatch={4}
                windowSize={7}
                getItemLayout={getItemLayout}
            />

            {isAdmin && <Animatable.View animation="zoomIn" duration={400} delay={300} style={styles.fabContainer}><TouchableOpacity style={styles.fab} onPress={handleOpenUploadModal}><Icon name="add" size={30} color="white" /></TouchableOpacity></Animatable.View>}

            <Modal visible={isFilterModalVisible} transparent={true} animationType="slide" onRequestClose={() => setFilterModalVisible(false)}>
                <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setFilterModalVisible(false)}>
                    <Animatable.View animation="fadeInUpBig" duration={400} style={styles.filterModalView} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}><Text style={styles.modalTitle}>Filter by Date</Text><TouchableOpacity onPress={() => setFilterModalVisible(false)}><Icon name="close" size={24} color="#555" /></TouchableOpacity></View>
                        <Text style={styles.modalSectionTitle}>Filter Type</Text>
                        <View style={styles.filterGroup}>
                            {(['month', 'year'] as DateFilterType[]).map(type => (
                                <TouchableOpacity key={type} style={[styles.filterButton, tempActiveDateFilterType === type && styles.activeFilterButton]} onPress={() => setTempActiveDateFilterType(type)}>
                                    <Text style={[styles.filterText, tempActiveDateFilterType === type && styles.activeFilterText]}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {tempActiveDateFilterType === 'month' && (
                            <>
                                <Text style={styles.modalSectionTitle}>Select Month & Year</Text>
                                <View style={{ flexDirection: 'row' }}>
                                    <View style={{ flex: 1, marginRight: 8 }}><RNPickerSelect placeholder={{ label: 'Month', value: null }} items={monthItems} onValueChange={(value) => setTempSelectedMonth(value)} style={pickerSelectStyles} value={tempSelectedMonth} /></View>
                                    <View style={{ flex: 1, marginLeft: 8 }}><RNPickerSelect placeholder={{ label: 'Year', value: null }} items={availableYears} onValueChange={(value) => setTempSelectedYear(value)} style={pickerSelectStyles} value={tempSelectedYear} /></View>
                                </View>
                            </>
                        )}

                        {tempActiveDateFilterType === 'year' && (
                            <>
                                <Text style={styles.modalSectionTitle}>Select Year</Text>
                                <RNPickerSelect placeholder={{ label: 'Select a year...', value: null }} items={availableYears} onValueChange={(value) => setTempSelectedYear(value)} style={pickerSelectStyles} value={tempSelectedYear} />
                            </>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.clearFilterButton} onPress={handleClearFilter}><Text style={styles.clearFilterButtonText}>CLEAR FILTER</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.applyFilterButton} onPress={handleApplyFilter}><Text style={styles.applyFilterButtonText}>APPLY</Text></TouchableOpacity>
                        </View>
                    </Animatable.View>
                </TouchableOpacity>
            </Modal>

            <Modal visible={isUploadModalVisible} transparent={true} animationType="fade" onRequestClose={() => setUploadModalVisible(false)}><View style={styles.modalBackdrop}><Animatable.View animation="zoomInUp" duration={500} style={styles.uploadModalView}><Text style={styles.modalTitle}>Create New Album</Text><TextInput style={styles.input} placeholder="Album Title" value={title} onChangeText={setTitle} /><TouchableOpacity style={styles.datePickerButton}><Icon name="calendar-outline" size={20} color="#555" style={{ marginRight: 10 }} /><Text style={styles.datePickerText}>Event Date: {eventDate.toLocaleDateString()}</Text></TouchableOpacity><TouchableOpacity style={styles.selectButton} onPress={() => launchImageLibrary({ mediaType: 'mixed' }, r => r.assets && setAsset(r.assets[0]))}><Icon name={asset ? "checkmark-circle" : "attach"} size={20} color={asset ? '#4CAF50' : ACCENT_COLOR} /><Text style={styles.selectButtonText}>{asset ? "Media Selected" : "Select Cover"}</Text></TouchableOpacity>{asset?.fileName && <Text style={styles.fileName}>{asset.fileName}</Text>}<View style={styles.modalActions}><Button title="Cancel" onPress={() => setUploadModalVisible(false)} color="#888" /><View style={{ width: 20 }} /><Button title={isSubmitting ? "Uploading..." : 'Upload'} onPress={handleUpload} disabled={isSubmitting} color={ACCENT_COLOR} /></View></Animatable.View></View></Modal>
        </SafeAreaView>
    );
};

const pickerSelectStyles = StyleSheet.create({ inputIOS: { fontSize: 16, paddingVertical: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, color: 'black', backgroundColor: '#f0f2f5', }, inputAndroid: { fontSize: 16, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, color: 'black', backgroundColor: '#f0f2f5', } });
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F2F5' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EAEAEA' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111' },
    filterTriggerButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#f0f2f5', borderRadius: 18 },
    filterTriggerText: { marginLeft: 6, fontWeight: '600', color: '#333' },
    filterActive: { backgroundColor: '#E8E1FF' },
    activeFilterIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT_COLOR, marginLeft: 8 },
    listContainer: { paddingHorizontal: MARGIN / 2, paddingTop: MARGIN, paddingBottom: 100 },
    emptyContainer: { justifyContent: 'center', alignItems: 'center', height: height * 0.6 },
    emptyText: { fontSize: 18, color: '#888', marginTop: 16, fontWeight: '600' },
    emptySubText: { marginTop: 8, fontSize: 14, color: '#aaa', paddingHorizontal: 20, textAlign: 'center' },
    albumContainer: { width: albumSize, height: albumSize + 20, marginHorizontal: MARGIN / 2, marginBottom: MARGIN, borderRadius: 16, backgroundColor: '#fff', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, overflow: 'hidden' },
    albumImage: { width: '100%', height: '100%', backgroundColor: '#444', justifyContent: 'center', alignItems: 'center' },
    gradientOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
    albumInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12 },
    albumTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', textShadowColor: 'rgba(0,0,0,0.75)', textShadowOffset: { width: -1, height: 1 }, textShadowRadius: 10 },
    albumDate: { fontSize: 12, color: '#eee', marginTop: 2 },
    albumCount: { fontSize: 12, color: '#eee', marginTop: 2, fontWeight: '600' },
    deleteButton: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    fabContainer: { position: 'absolute', right: 25, bottom: 25 },
    fab: { width: 60, height: 60, borderRadius: 30, backgroundColor: ACCENT_COLOR, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: ACCENT_COLOR, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
    modalBackdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    filterModalView: { width: '100%', backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
    uploadModalView: { width: '90%', backgroundColor: 'white', borderRadius: 20, padding: 25, alignItems: 'center', elevation: 5, alignSelf: 'center', bottom: height * 0.2 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
    modalSectionTitle: { fontSize: 16, fontWeight: '600', color: '#555', marginTop: 10, marginBottom: 12 },
    filterGroup: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 25 },
    filterButton: { paddingVertical: 10, flex: 1, marginHorizontal: 8, borderRadius: 10, backgroundColor: '#f0f2f5', alignItems: 'center' },
    activeFilterButton: { backgroundColor: ACCENT_COLOR },
    filterText: { color: '#444', fontWeight: '600' },
    activeFilterText: { color: '#FFF' },
    input: { width: '100%', height: 50, backgroundColor: '#f0f0f0', borderRadius: 8, marginBottom: 15, paddingHorizontal: 15, fontSize: 16 },
    datePickerButton: { width: '100%', height: 50, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, marginBottom: 15, paddingHorizontal: 15 },
    datePickerText: { fontSize: 16, color: '#333' },
    selectButton: { width: '100%', height: 50, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8E1FF', borderRadius: 8, marginBottom: 8 },
    selectButtonText: { color: ACCENT_COLOR, fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
    fileName: { fontSize: 12, color: 'gray', textAlign: 'center', marginBottom: 20, paddingHorizontal: 10 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 30, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 15 },
    clearFilterButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
    clearFilterButtonText: { color: '#555', fontWeight: 'bold', fontSize: 16 },
    applyFilterButton: { paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, backgroundColor: ACCENT_COLOR },
    applyFilterButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});
export default GalleryScreen;