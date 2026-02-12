import React, { useState, FC, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, Dimensions,
    TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput,
    Button, Platform, SafeAreaView, StatusBar, useColorScheme
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import RNPickerSelect from 'react-native-picker-select';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import LinearGradient from 'react-native-linear-gradient';
import FastImage from 'react-native-fast-image';
import DateTimePicker from '@react-native-community/datetimepicker'; // UPDATED: Imported standard date picker
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';

// --- Types ---
type AlbumType = { title: string; event_date: string; item_count: number; cover_image_path: string | null; };
type RootStackParamList = { AlbumDetail: { title: string }; };
type GalleryScreenNavigationProp = StackNavigationProp<RootStackParamList>;
type DateFilterType = 'month' | 'year';

// --- Constants & Theme ---
const { width, height } = Dimensions.get('window');
const NUM_COLUMNS = 2;
const MARGIN = 12;
const albumSize = (width - MARGIN * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    inputBg: '#f0f2f5'
};
const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C'
};

const monthItems = [
    { label: "January", value: 0 }, { label: "February", value: 1 }, { label: "March", value: 2 },
    { label: "April", value: 3 }, { label: "May", value: 4 }, { label: "June", value: 5 },
    { label: "July", value: 6 }, { label: "August", value: 7 }, { label: "September", value: 8 },
    { label: "October", value: 9 }, { label: "November", value: 10 }, { label: "December", value: 11 },
];

// --- Sub Component: Album Cover ---
const AlbumCover: FC<{ album: AlbumType; onPress: () => void; onOptionPress: () => void; isAdmin: boolean; index: number; colors: any; }> = ({ album, onPress, onOptionPress, isAdmin, index, colors }) => {
    return (
        <Animatable.View animation="zoomIn" duration={500} delay={index * 100} useNativeDriver={true}>
            <TouchableOpacity style={[styles.albumContainer, { backgroundColor: colors.cardBg }]} onPress={onPress} activeOpacity={0.9}>
                {!album.cover_image_path ? (
                    <View style={styles.albumImage}>
                        <Icon name="film-outline" size={40} color="rgba(255,255,255,0.6)" />
                    </View>
                ) : (
                    <FastImage
                        source={{ uri: `${SERVER_URL}${album.cover_image_path}` }}
                        style={styles.albumImage}
                        resizeMode={FastImage.resizeMode.cover}
                    />
                )}
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.gradientOverlay} />
                <View style={styles.albumInfo}>
                    <Text style={styles.albumTitle} numberOfLines={2}>{album.title}</Text>
                    <Text style={styles.albumDate}>{new Date(album.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                    <Text style={styles.albumCount}>{album.item_count} items</Text>
                </View>
                
                {/* --- Three Dots Function --- */}
                {isAdmin && (
                    <TouchableOpacity style={styles.optionButton} onPress={(e) => { e.stopPropagation(); onOptionPress(); }}>
                        <Icon name="ellipsis-vertical" size={18} color="white" />
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        </Animatable.View>
    );
};

// --- Main Component ---
const GalleryScreen: FC = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const { user } = useAuth();
    const navigation = useNavigation<GalleryScreenNavigationProp>();
    const isAdmin = user?.role === 'admin';

    // Data State
    const [allAlbums, setAllAlbums] = useState<AlbumType[]>([]);
    const [filteredAlbums, setFilteredAlbums] = useState<AlbumType[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Filter State
    const [isFilterModalVisible, setFilterModalVisible] = useState(false);
    const [activeDateFilterType, setActiveDateFilterType] = useState<DateFilterType | null>(null);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [availableYears, setAvailableYears] = useState<{ label: string; value: number }[]>([]);

    // Temp Filter State (for Modal)
    const [tempFilterType, setTempFilterType] = useState<DateFilterType | null>(null);
    const [tempYear, setTempYear] = useState<number | null>(null);
    const [tempMonth, setTempMonth] = useState<number | null>(null);

    // Upload State
    const [isUploadModalVisible, setUploadModalVisible] = useState(false);
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadDate, setUploadDate] = useState<Date>(new Date());
    const [asset, setAsset] = useState<Asset | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // UPDATED: Date Picker State
    const [showDatePicker, setShowDatePicker] = useState(false);

    // --- Fetch & Filter Logic ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiClient.get<AlbumType[]>('/gallery');
            setAllAlbums(response.data);
        } catch (error) {
            Alert.alert("Error", "Failed to load albums.");
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    useEffect(() => {
        let filtered = [...allAlbums];
        if (activeDateFilterType === 'year' && selectedYear) {
            filtered = filtered.filter(a => new Date(a.event_date).getFullYear() === selectedYear);
        } else if (activeDateFilterType === 'month' && selectedMonth !== null && selectedYear) {
            filtered = filtered.filter(a => {
                const d = new Date(a.event_date);
                return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
            });
        }
        setFilteredAlbums(filtered);
    }, [allAlbums, activeDateFilterType, selectedYear, selectedMonth]);

    useEffect(() => {
        const years = [...new Set(allAlbums.map(a => new Date(a.event_date).getFullYear()))];
        setAvailableYears(years.sort((a, b) => b - a).map(y => ({ label: String(y), value: y })));
    }, [allAlbums]);

    // --- Filter Modal Handlers ---
    const openFilterModal = () => {
        setTempFilterType(activeDateFilterType);
        setTempYear(selectedYear);
        setTempMonth(selectedMonth);
        setFilterModalVisible(true);
    };

    const applyFilter = () => {
        setActiveDateFilterType(tempFilterType);
        setSelectedYear(tempYear);
        setSelectedMonth(tempMonth);
        setFilterModalVisible(false);
    };

    const clearFilter = () => {
        setTempFilterType(null);
        setTempYear(null);
        setTempMonth(null);
    };

    // --- Album Options Logic ---
    const handleAlbumOptions = (title: string) => {
        Alert.alert(
            "Album Options",
            `Manage "${title}"`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete Album",
                    style: "destructive",
                    onPress: () => {
                        Alert.alert(
                            "Confirm Delete",
                            `Are you sure you want to delete "${title}"? This cannot be undone.`,
                            [
                                { text: "Cancel", style: "cancel" },
                                { text: "Yes, Delete", style: "destructive", onPress: () => deleteAlbum(title) }
                            ]
                        );
                    }
                }
            ]
        );
    };

    const deleteAlbum = async (title: string) => {
        try {
            await apiClient.delete('/gallery/album', { data: { title, role: user?.role } });
            fetchData();
        } catch (e) {
            Alert.alert("Error", "Could not delete album.");
        }
    };

    // --- Upload Logic ---
    const openUploadModal = () => {
        setUploadTitle('');
        setUploadDate(new Date());
        setAsset(null);
        setUploadModalVisible(true);
    };

    const handleUpload = async () => {
        if (!user || !uploadTitle.trim() || !asset) {
            Alert.alert('Validation Error', 'Title and Media are required.');
            return;
        }
        setIsSubmitting(true);
        const fd = new FormData();
        fd.append('title', uploadTitle.trim());
        fd.append('event_date', uploadDate.toISOString().split('T')[0]);
        fd.append('role', user.role);
        fd.append('adminId', String(user.id));
        fd.append('media', { uri: asset.uri, type: asset.type, name: asset.fileName || `m-${Date.now()}` });

        try {
            await apiClient.post('/gallery/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            Alert.alert('Success', 'Album created successfully!');
            setUploadModalVisible(false);
            fetchData();
        } catch (e) {
            Alert.alert('Error', 'Upload failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Dynamic styles for PickerSelect
    const pickerStyle = {
        inputIOS: {
            fontSize: 16, paddingVertical: 12, paddingHorizontal: 10, borderWidth: 1,
            borderColor: COLORS.border, borderRadius: 8, color: COLORS.textMain, backgroundColor: COLORS.inputBg,
        },
        inputAndroid: {
            fontSize: 16, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1,
            borderColor: COLORS.border, borderRadius: 8, color: COLORS.textMain, backgroundColor: COLORS.inputBg,
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={COLORS.background} />

            {/* --- Header --- */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                {/* Left Side: Icon & Title */}
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: isDark ? '#333' : '#E0F2F1' }]}>
                        <MaterialIcons name="collections" size={24} color={COLORS.primary} />
                    </View>
                    <View>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Gallery</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Events & Memories</Text>
                    </View>
                </View>

                {/* Right Side: Actions (Filter & Add) */}
                <View style={styles.headerRightActions}>
                    {/* Filter Button */}
                    <TouchableOpacity
                        style={[
                            styles.filterTriggerButton,
                            { borderColor: COLORS.border, backgroundColor: activeDateFilterType ? (isDark ? '#333' : '#E0F2F1') : 'transparent' }
                        ]}
                        onPress={openFilterModal}
                    >
                        <Icon name="funnel-outline" size={16} color={activeDateFilterType ? COLORS.primary : COLORS.textSub} />
                        <Text style={[styles.filterTriggerText, { color: activeDateFilterType ? COLORS.primary : COLORS.textMain }]}>Filter</Text>
                    </TouchableOpacity>

                    {/* Add Button */}
                    {isAdmin && (
                        <TouchableOpacity 
                            style={[styles.headerAddButton, { backgroundColor: COLORS.primary }]} 
                            onPress={openUploadModal}
                        >
                            <Icon name="add" size={18} color="#FFF" />
                            <Text style={styles.headerAddText}>Add</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* --- Album List --- */}
            <FlatList
                data={filteredAlbums}
                numColumns={NUM_COLUMNS}
                keyExtractor={(item) => item.title}
                renderItem={({ item, index }) => (
                    <AlbumCover
                        album={item}
                        onPress={() => navigation.navigate('AlbumDetail', { title: item.title })}
                        onOptionPress={() => handleAlbumOptions(item.title)}
                        isAdmin={isAdmin}
                        index={index}
                        colors={COLORS}
                    />
                )}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                    !loading ?
                        <View style={styles.emptyContainer}>
                            <Icon name="images-outline" size={60} color={COLORS.border} />
                            <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No Albums Found</Text>
                            <Text style={[styles.emptySubText, { color: COLORS.textSub }]}>Try adjusting filters or upload new media.</Text>
                        </View>
                        : null
                }
                refreshing={loading}
                onRefresh={fetchData}
            />

            {/* --- FILTER MODAL --- */}
            <Modal visible={isFilterModalVisible} transparent={true} animationType="slide" onRequestClose={() => setFilterModalVisible(false)}>
                <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setFilterModalVisible(false)}>
                    <Animatable.View animation="fadeInUpBig" duration={400} style={[styles.bottomSheet, { backgroundColor: COLORS.cardBg }]} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: COLORS.textMain }]}>Filter Gallery</Text>
                            <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                                <Icon name="close" size={24} color={COLORS.textSub} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.modalSectionTitle, { color: COLORS.textSub }]}>Filter Type</Text>
                        <View style={styles.filterGroup}>
                            {(['month', 'year'] as DateFilterType[]).map(type => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.filterButton,
                                        { backgroundColor: COLORS.inputBg },
                                        tempFilterType === type && { backgroundColor: COLORS.primary }
                                    ]}
                                    onPress={() => setTempFilterType(type)}
                                >
                                    <Text style={[
                                        styles.filterText,
                                        { color: COLORS.textMain },
                                        tempFilterType === type && { color: '#FFF' }
                                    ]}>
                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={{ marginVertical: 15 }}>
                            {tempFilterType === 'month' && (
                                <View style={{ flexDirection: 'row' }}>
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <RNPickerSelect placeholder={{ label: 'Month', value: null }} items={monthItems} onValueChange={setTempMonth} style={pickerStyle} value={tempMonth} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 8 }}>
                                        <RNPickerSelect placeholder={{ label: 'Year', value: null }} items={availableYears} onValueChange={setTempYear} style={pickerStyle} value={tempYear} />
                                    </View>
                                </View>
                            )}
                            {tempFilterType === 'year' && (
                                <RNPickerSelect placeholder={{ label: 'Select a year...', value: null }} items={availableYears} onValueChange={setTempYear} style={pickerStyle} value={tempYear} />
                            )}
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.clearFilterButton} onPress={clearFilter}>
                                <Text style={[styles.clearFilterButtonText, { color: COLORS.textSub }]}>CLEAR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.applyFilterButton, { backgroundColor: COLORS.primary }]} onPress={applyFilter}>
                                <Text style={styles.applyFilterButtonText}>APPLY</Text>
                            </TouchableOpacity>
                        </View>
                    </Animatable.View>
                </TouchableOpacity>
            </Modal>

            {/* --- UPLOAD MODAL --- */}
            <Modal visible={isUploadModalVisible} transparent={true} animationType="fade" onRequestClose={() => setUploadModalVisible(false)}>
                <View style={styles.modalBackdrop}>
                    <Animatable.View animation="zoomInUp" duration={500} style={[styles.uploadModalView, { backgroundColor: COLORS.cardBg }]}>
                        <Text style={[styles.modalTitle, { color: COLORS.textMain }]}>New Album</Text>

                        <TextInput
                            style={[styles.input, { backgroundColor: COLORS.inputBg, color: COLORS.textMain }]}
                            placeholder="Album Title"
                            placeholderTextColor={COLORS.textSub}
                            value={uploadTitle}
                            onChangeText={setUploadTitle}
                        />

                        {/* UPDATED: Date Display with Click Action */}
                        <TouchableOpacity 
                            style={[styles.dateDisplay, { backgroundColor: COLORS.inputBg }]}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Icon name="calendar-outline" size={20} color={COLORS.textSub} />
                            <Text style={{ marginLeft: 10, color: COLORS.textMain }}>{uploadDate.toLocaleDateString()}</Text>
                        </TouchableOpacity>

                        {/* Date Picker Logic */}
                        {showDatePicker && (
                            <DateTimePicker
                                value={uploadDate}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={(event, date) => {
                                    if (Platform.OS === 'android') setShowDatePicker(false);
                                    if (date) setUploadDate(date);
                                }}
                            />
                        )}

                        <TouchableOpacity
                            style={[styles.selectButton, { backgroundColor: COLORS.primary + '20' }]}
                            onPress={() => launchImageLibrary({ mediaType: 'mixed' }, r => r.assets && setAsset(r.assets[0]))}
                        >
                            <Icon name={asset ? "checkmark-circle" : "attach"} size={20} color={COLORS.primary} />
                            <Text style={{ color: COLORS.primary, fontWeight: 'bold', marginLeft: 8 }}>
                                {asset ? "Media Selected" : "Select Cover Media"}
                            </Text>
                        </TouchableOpacity>

                        {asset?.fileName && <Text style={{ color: COLORS.textSub, fontSize: 12, marginBottom: 15 }}>{asset.fileName}</Text>}

                        <View style={styles.modalActions}>
                            <Button title="Cancel" onPress={() => setUploadModalVisible(false)} color={COLORS.textSub} />
                            <View style={{ width: 20 }} />
                            <Button title={isSubmitting ? "Wait..." : "Create"} onPress={handleUpload} disabled={isSubmitting} color={COLORS.primary} />
                        </View>
                    </Animatable.View>
                </View>
            </Modal>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    
    // Header
    headerCard: {
        paddingHorizontal: 15, paddingVertical: 12, width: '94%',
        alignSelf: 'center', marginTop: 15, marginBottom: 10, borderRadius: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        elevation: 3
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 12 },

    // Header Right Actions (Container for Filter + Add)
    headerRightActions: { flexDirection: 'row', alignItems: 'center' },
    
    filterTriggerButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 18, borderWidth: 1 },
    filterTriggerText: { marginLeft: 4, fontWeight: '600', fontSize: 12 },

    // Add Button in Header
    headerAddButton: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 7, paddingHorizontal: 12,
        borderRadius: 20, marginLeft: 8, elevation: 2
    },
    headerAddText: { color: '#FFF', fontWeight: 'bold', fontSize: 13, marginLeft: 4 },

    // List
    listContainer: { paddingHorizontal: MARGIN / 2, paddingTop: MARGIN, paddingBottom: 100 },
    emptyContainer: { justifyContent: 'center', alignItems: 'center', height: height * 0.5 },
    emptyText: { fontSize: 18, marginTop: 16, fontWeight: '600' },
    emptySubText: { marginTop: 8, fontSize: 14, textAlign: 'center' },
    
    // Grid Item
    albumContainer: { width: albumSize, height: albumSize + 30, marginHorizontal: MARGIN / 2, marginBottom: MARGIN, borderRadius: 12, elevation: 2, overflow: 'hidden' },
    albumImage: { width: '100%', height: '100%', backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
    gradientOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
    albumInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10 },
    albumTitle: { fontSize: 14, fontWeight: 'bold', color: '#fff', textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 10 },
    albumDate: { fontSize: 10, color: '#eee' },
    albumCount: { fontSize: 10, color: '#eee', fontWeight: '600' },
    
    // Option Button
    optionButton: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },

    // Modals
    modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    bottomSheet: { width: '100%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
    uploadModalView: { width: '90%', borderRadius: 20, padding: 25, alignSelf: 'center', marginBottom: height * 0.25 },
    
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    modalSectionTitle: { fontSize: 14, fontWeight: '600', marginTop: 10, marginBottom: 12 },
    
    filterGroup: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
    filterButton: { paddingVertical: 10, flex: 1, marginHorizontal: 8, borderRadius: 10, alignItems: 'center' },
    filterText: { fontWeight: '600' },

    modalActions: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#eee' },
    clearFilterButton: { paddingVertical: 12, paddingHorizontal: 20 },
    clearFilterButtonText: { fontWeight: 'bold', fontSize: 16 },
    applyFilterButton: { paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 },
    applyFilterButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

    // Inputs
    input: { width: '100%', height: 50, borderRadius: 8, marginBottom: 15, paddingHorizontal: 15 },
    dateDisplay: { width: '100%', height: 50, borderRadius: 8, marginBottom: 15, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center' },
    selectButton: { width: '100%', height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginBottom: 10, flexDirection: 'row' },
});

export default GalleryScreen;