/**
 * File: src/screens/store/StoreScreen.tsx
 * Purpose: Manage Permanent Storage Assets (School assets, furniture, etc.)
 * Features: Responsive Design, Dark/Light Mode, Role-based Access, Search, Camera/Gallery uploads, Three-dot action menu.
 */
import React, { useState, useCallback, useEffect, useLayoutEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, SafeAreaView, Modal, TextInput, Platform, Image, UIManager,
    useColorScheme, StatusBar, Dimensions, KeyboardAvoidingView, TouchableWithoutFeedback
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'react-native-image-picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// App integrations
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { SERVER_URL } from '../../../apiConfig'; // Ensure this points to the base without /api if images are stored at root

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080', // Blue-600 to match web theme
    background: '#F8FAFC',
    cardBg: '#FFFFFF',
    textMain: '#1E293B',
    textSub: '#64748B',
    border: '#E2E8F0',
    inputBg: '#F1F5F9',
    inputBorder: '#CBD5E1',
    headerIconBg: '#DBEAFE',
    success: '#16A34A',
    danger: '#D32F2F', // Matches the teal color in your options dialog image
    qtyBg: '#EFF6FF',
    iconBtnBg: '#F1F5F9',
    modalOverlay: 'rgba(0,0,0,0.5)',
    emptyIcon: '#CBD5E1',
    white: '#ffffff',
    cancelBtnBg: '#E2E8F0',
    cancelBtnText: '#334155',
    dialogActionText: '#00796B' // Teal action text for the dialog
};

const DarkColors = {
    primary: '#008080',
    background: '#0F172A',
    cardBg: '#1E293B',
    textMain: '#F1F5F9',
    textSub: '#94A3B8',
    border: '#334155',
    inputBg: '#0F172A',
    inputBorder: '#475569',
    headerIconBg: '#1E3A8A',
    success: '#22C55E',
    danger: '#D32F2F', // Lighter teal for dark mode
    qtyBg: '#1E3A8A',
    iconBtnBg: '#334155',
    modalOverlay: 'rgba(0,0,0,0.7)',
    emptyIcon: '#475569',
    white: '#ffffff',
    cancelBtnBg: '#334155',
    cancelBtnText: '#F1F5F9',
    dialogActionText: '#2DD4BF' // Lighter teal for dark mode
};

// --- IMAGE ENLARGER COMPONENT ---
const ImageEnlargerModal = ({ visible, uri, onClose }) => {
    if (!visible || !uri) return null;
    return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
            <View style={styles.enlargeBackground}>
                <TouchableOpacity style={styles.enlargeClose} onPress={onClose}>
                    <MaterialIcons name="close" size={30} color="#fff" />
                </TouchableOpacity>
                <Image source={{ uri }} style={styles.enlargeImage} resizeMode="contain" />
            </View>
        </Modal>
    );
};

const StoreScreen = () => {
    const { user } = useAuth();
    const navigation = useNavigation();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const [items, setItems] = useState([]);
    const[searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    
    // Modals
    const [itemModalInfo, setItemModalInfo] = useState({ visible: false, mode: null, data: null });
    const [actionMenuInfo, setActionMenuInfo] = useState({ visible: false, item: null });
    const [enlargeImage, setEnlargeImage] = useState(null);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/permanent-storage');
            setItems(res.data ||[]);
        } catch (error) {
            console.error("Error fetching items:", error);
            Alert.alert("Error", "Could not fetch storage items.");
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        fetchItems();
    },[fetchItems]));

    // Modal Helpers
    const openItemModal = (mode, data = null) => setItemModalInfo({ visible: true, mode, data });
    const closeItemModal = () => setItemModalInfo({ visible: false, mode: null, data: null });
    
    const openActionMenu = (item) => setActionMenuInfo({ visible: true, item });
    const closeActionMenu = () => setActionMenuInfo({ visible: false, item: null });

    const handleSaveItem = async (formData, mode, id) => {
        try {
            if (mode === 'add') {
                await apiClient.post('/permanent-storage', formData, { 
                    headers: { 'Content-Type': 'multipart/form-data' } 
                });
            } else if (mode === 'edit' && id) {
                await apiClient.put(`/permanent-storage/${id}`, formData, { 
                    headers: { 'Content-Type': 'multipart/form-data' } 
                });
            }
            closeItemModal();
            fetchItems();
        } catch (error) {
            console.error("Save Error:", error);
            Alert.alert("Error", error.response?.data?.error || "Failed to save asset.");
        }
    };

    const handleDeleteItem = (item) => {
        Alert.alert("Delete Asset", `Are you sure you want to delete ${item.item_name}?`,[
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    await apiClient.delete(`/permanent-storage/${item.id}`);
                    fetchItems();
                } catch(e) { 
                    Alert.alert("Error", "Failed to delete asset."); 
                }
            }}
        ]);
    };

    // Action Menu Handlers
    const handleMenuEdit = () => {
        const itemToEdit = actionMenuInfo.item;
        closeActionMenu();
        // Slight delay to allow the action menu to close before opening the edit modal
        setTimeout(() => openItemModal('edit', itemToEdit), 300);
    };

    const handleMenuDelete = () => {
        const itemToDelete = actionMenuInfo.item;
        closeActionMenu();
        setTimeout(() => handleDeleteItem(itemToDelete), 300);
    };

    const filteredItems = items.filter(item => 
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

            {/* --- HEADER --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    {/* Back arrow removed as requested */}
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.headerIconBg }]}>
                        <MaterialCommunityIcons name="warehouse" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Storage</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Manage assets & furniture</Text>
                    </View>
                </View>
                
                {user?.role === 'admin' && (
                    <TouchableOpacity style={[styles.headerBtn, { backgroundColor: theme.primary }]} onPress={() => openItemModal('add')}>
                        <MaterialIcons name="add" size={18} color={theme.white} />
                        <Text style={styles.headerBtnText}>Asset</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* --- SEARCH BAR --- */}
            <View style={[styles.searchContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <MaterialIcons name="search" size={22} color={theme.textSub} style={{marginLeft: 10}} />
                <TextInput
                    style={[styles.searchInput, { color: theme.textMain }]}
                    placeholder="Search assets..."
                    placeholderTextColor={theme.textSub}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={{paddingRight: 10}}>
                        <MaterialIcons name="close" size={20} color={theme.textSub} />
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* --- LIST CONTENT --- */}
            {loading ? <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} /> :
                <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                    {filteredItems.length > 0 ? (
                        filteredItems.map((item, index) => (
                            <AssetItemCard 
                                key={`asset-${item.id}-${index}`} 
                                item={item} 
                                theme={theme}
                                isAdmin={user?.role === 'admin'}
                                onOptionsPress={() => openActionMenu(item)}
                                onImagePress={(uri) => setEnlargeImage(uri)} 
                            />
                        ))
                    ) : (
                        <View style={[styles.emptyBox, { borderColor: theme.border }]}>
                            <MaterialCommunityIcons name="archive-off-outline" size={50} color={theme.emptyIcon} />
                            <Text style={[styles.emptyText, { color: theme.textSub }]}>
                                {searchQuery ? 'No assets match your search.' : 'No assets found in storage.'}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            }

            {/* --- THREE-DOT ACTION MENU MODAL --- */}
            {actionMenuInfo.visible && (
                <Modal visible={true} transparent animationType="fade" onRequestClose={closeActionMenu}>
                    <TouchableWithoutFeedback onPress={closeActionMenu}>
                        <View style={[styles.optionsModalOverlay, { backgroundColor: theme.modalOverlay }]}>
                            <TouchableWithoutFeedback>
                                <View style={[styles.optionsModalContent, { backgroundColor: theme.cardBg }]}>
                                    <Text style={[styles.optionsModalTitle, { color: theme.textMain }]}>Manage Asset</Text>
                                    <Text style={[styles.optionsModalSubtitle, { color: theme.textSub }]}>
                                        Options for "{actionMenuInfo.item?.item_name}"
                                    </Text>
                                    
                                    <View style={styles.optionsModalActions}>
                                        <TouchableOpacity onPress={closeActionMenu} style={styles.optionsActionBtn}>
                                            <Text style={[styles.optionsActionText, { color: theme.dialogActionText }]}>CANCEL</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={handleMenuEdit} style={styles.optionsActionBtn}>
                                            <Text style={[styles.optionsActionText, { color: theme.dialogActionText }]}>EDIT</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={handleMenuDelete} style={styles.optionsActionBtn}>
                                            <Text style={[styles.optionsActionText, { color: theme.dialogActionText }]}>DELETE</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>
            )}

            {/* --- ADD / EDIT ASSET MODAL --- */}
            {itemModalInfo.visible && (
                <AssetModal 
                    modalInfo={itemModalInfo} 
                    onClose={closeItemModal} 
                    onSave={handleSaveItem} 
                    theme={theme} 
                />
            )}
            
            <ImageEnlargerModal 
                visible={!!enlargeImage} 
                uri={enlargeImage} 
                onClose={() => setEnlargeImage(null)} 
            />
        </SafeAreaView>
    );
};

// --- ASSET ITEM CARD ---
const AssetItemCard = ({ item, theme, isAdmin, onOptionsPress, onImagePress }) => {
    const imageUri = item.image_url ? `${SERVER_URL}${item.image_url}` : null;

    return (
        <View style={[styles.itemCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            
            {/* Clickable Image (Left) */}
            <TouchableOpacity 
                style={[styles.imageContainer, { backgroundColor: theme.background }]} 
                onPress={() => imageUri && onImagePress(imageUri)}
                activeOpacity={imageUri ? 0.8 : 1}
            >
                {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.cardImage} />
                ) : (
                    <MaterialCommunityIcons name="archive" size={28} color={theme.textSub} />
                )}
            </TouchableOpacity>

            {/* Content (Middle) */}
            <View style={styles.cardInfo}>
                <Text style={[styles.cardTitle, { color: theme.textMain }]} numberOfLines={1}>
                    {item.item_name}
                </Text>

                <View style={styles.statsRow}>
                    {/* Location/Rack Chip */}
                    <View style={[styles.miniChip, { backgroundColor: theme.inputBg }]}>
                        <MaterialCommunityIcons name="map-marker-outline" size={12} color={theme.textSub} style={{marginRight: 3}} />
                        <Text style={[styles.miniChipText, { color: theme.textSub }]} numberOfLines={1} ellipsizeMode="tail">
                            {item.rack || 'Unassigned'}
                        </Text>
                    </View>

                    {/* Quantity Chip */}
                    <View style={[styles.miniChip, { backgroundColor: theme.qtyBg }]}>
                        <Text style={[styles.miniChipLabel, { color: theme.primary }]}>Total:</Text>
                        <Text style={[styles.miniChipValue, { color: theme.primary }]}>{item.quantity}</Text>
                    </View>
                </View>
            </View>

            {/* Actions (Right) - Three Dots menu */}
            {isAdmin && (
                <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => onOptionsPress(item)} style={styles.moreButton}>
                        <MaterialCommunityIcons name="dots-vertical" size={24} color={theme.textSub} />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

// --- ADD / EDIT ASSET MODAL ---
const AssetModal = ({ modalInfo, onClose, onSave, theme }) => {
    const { mode, data } = modalInfo;
    const isEdit = mode === 'edit';

    const [itemName, setItemName] = useState('');
    const[rack, setRack] = useState('');
    const [quantity, setQuantity] = useState(0);
    const [image, setImage] = useState(null);

    useEffect(() => {
        if (data) {
            setItemName(data.item_name || '');
            setRack(data.rack || '');
            setQuantity(Number(data.quantity) || 0);
        } else {
            setItemName('');
            setRack('');
            setQuantity(0);
        }
        setImage(null);
    },[data]);

    const handleChooseImage = () => {
         ImagePicker.launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, res => { 
             if (res.assets && res.assets[0]) setImage(res.assets[0]); 
         });
    };

    const handlePressSave = () => {
        if (!itemName.trim()) {
            Alert.alert("Validation", "Item name is required.");
            return;
        }

        const formData = new FormData();
        formData.append('item_name', itemName);
        formData.append('quantity', String(quantity));
        formData.append('rack', rack);
        
        if (image) {
            formData.append('image', { 
                uri: image.uri, 
                type: image.type || 'image/jpeg', 
                name: image.fileName || 'asset.jpg' 
            });
        }

        onSave(formData, mode, data?.id);
    };

    const imageSource = image ? { uri: image.uri } : (data?.image_url ? { uri: `${SERVER_URL}${data.image_url}` } : null);

    return (
        <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.modalContainer, { backgroundColor: theme.modalOverlay }]}>
                <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
                    
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: theme.textMain }]}>
                            {isEdit ? 'Edit Asset' : 'Add New Asset'}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={{padding: 5}}>
                            <MaterialIcons name="close" size={24} color={theme.textSub} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <Text style={[styles.inputLabel, { color: theme.textSub }]}>Asset Name</Text>
                        <TextInput 
                            style={[styles.input, { borderColor: theme.inputBorder, color: theme.textMain, backgroundColor: theme.inputBg }]} 
                            placeholder="e.g. Wooden Chairs, Staff Tables" 
                            placeholderTextColor={theme.textSub}
                            value={itemName} 
                            onChangeText={setItemName} 
                        />
                        
                        <View style={{flexDirection: 'row', gap: 15}}>
                            <View style={{flex: 1}}>
                                <Text style={[styles.inputLabel, { color: theme.textSub }]}>Quantity</Text>
                                <View style={styles.quantityControl}>
                                    <TouchableOpacity onPress={() => setQuantity(q => Math.max(0, q - 1))} style={[styles.quantityButton, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
                                        <MaterialCommunityIcons name="minus" size={20} color={theme.primary} />
                                    </TouchableOpacity>
                                    <TextInput 
                                        style={[styles.quantityInput, { borderColor: theme.inputBorder, color: theme.textMain, backgroundColor: theme.inputBg }]} 
                                        value={String(quantity)} 
                                        onChangeText={t => setQuantity(Number(t) || 0)} 
                                        keyboardType="numeric" 
                                    />
                                    <TouchableOpacity onPress={() => setQuantity(q => q + 1)} style={[styles.quantityButton, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
                                        <MaterialCommunityIcons name="plus" size={20} color={theme.primary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            
                            <View style={{flex: 1.5}}>
                                <Text style={[styles.inputLabel, { color: theme.textSub }]}>Location / Rack</Text>
                                <TextInput 
                                    style={[styles.input, { borderColor: theme.inputBorder, color: theme.textMain, backgroundColor: theme.inputBg }]} 
                                    placeholder="e.g. Room 101" 
                                    placeholderTextColor={theme.textSub}
                                    value={rack} 
                                    onChangeText={setRack} 
                                />
                            </View>
                        </View>
                        
                        <Text style={[styles.inputLabel, { color: theme.textSub, marginTop: 5 }]}>Upload Image</Text>
                        <TouchableOpacity style={[styles.imagePicker, { borderColor: theme.inputBorder, backgroundColor: theme.inputBg }]} onPress={handleChooseImage}>
                            {imageSource ? 
                                <Image source={imageSource} style={styles.previewImage} /> 
                                : 
                                <><MaterialCommunityIcons name="camera-plus" size={28} color={theme.textSub}/><Text style={[styles.imagePickerText, { color: theme.textSub }]}>Tap to add Image</Text></>
                            }
                        </TouchableOpacity>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.cancelBtnBg }]} onPress={onClose}>
                                <Text style={{ color: theme.cancelBtnText, fontWeight: 'bold' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, { backgroundColor: theme.primary }]} onPress={handlePressSave}>
                                <Text style={styles.saveButtonText}>{isEdit ? 'Update Asset' : 'Add Asset'}</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// --- STYLES ---
const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContainer: { paddingHorizontal: width * 0.04, paddingBottom: 30, paddingTop: 10 },
    
    // Header
    headerCard: {
        paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center',
        marginTop: Platform.OS === 'ios' ? 0 : 15, marginBottom: 10, borderRadius: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        elevation: 3, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },
    headerBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

    // Search Box
    searchContainer: {
        flexDirection: 'row', alignItems: 'center', marginHorizontal: width * 0.02,
        marginBottom: 10, borderRadius: 12, borderWidth: 1, paddingVertical: Platform.OS === 'ios' ? 10 : 2,
    },
    searchInput: { flex: 1, fontSize: 15, paddingHorizontal: 10, paddingVertical: 8 },

    // Cards
    itemCard: {
        flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16,
        marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 3, borderWidth: 1,
    },
    imageContainer: { width: 60, height: 60, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15, overflow: 'hidden' },
    cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    cardInfo: { flex: 1, justifyContent: 'center', gap: 6 },
    cardTitle: { fontSize: 16, fontWeight: 'bold' },
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    miniChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, maxWidth: '65%' },
    miniChipText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
    miniChipLabel: { fontSize: 11, fontWeight: '600', marginRight: 4 },
    miniChipValue: { fontSize: 12, fontWeight: 'bold' },
    
    // Card Actions (Three dots)
    actionRow: { paddingLeft: 10, justifyContent: 'center' },
    moreButton: { padding: 6 },

    // Empty state
    emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, opacity: 0.7, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12 },
    emptyText: { fontSize: 15, marginTop: 12, fontStyle: 'italic' },

    // Enlarger Image
    enlargeBackground: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)', justifyContent: 'center', alignItems: 'center' },
    enlargeImage: { width: width, height: height * 0.8 },
    enlargeClose: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(50,50,50,0.8)', borderRadius: 20 },

    // Options Modal (Three dots click)
    optionsModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    optionsModalContent: { width: '85%', borderRadius: 8, padding: 24, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
    optionsModalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
    optionsModalSubtitle: { fontSize: 15, marginBottom: 28 },
    optionsModalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
    optionsActionBtn: { marginLeft: 20, paddingVertical: 6, paddingHorizontal: 4 },
    optionsActionText: { fontSize: 14, fontWeight: '700' },

    // Modals
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', borderRadius: 16, padding: 20, elevation: 10, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    inputLabel: { fontSize: 13, marginBottom: 5, fontWeight: '600' },
    input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15, marginBottom: 15 },
    quantityControl: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    quantityButton: { padding: 8, borderRadius: 8, borderWidth: 1, flexShrink: 0 },
    quantityInput: { flex: 1, borderWidth: 1, borderRadius: 8, textAlign: 'center', fontSize: 16, fontWeight: 'bold', marginHorizontal: 8, paddingVertical: Platform.OS === 'ios' ? 10 : 8 },
    imagePicker: { height: 120, borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 20, overflow: 'hidden' },
    imagePickerText: { marginTop: 5, fontSize: 12 },
    previewImage: { width: '100%', height: '100%', borderRadius: 8, resizeMode: 'cover' },
    
    // Modal buttons
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    modalButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, flex: 1, alignItems: 'center', elevation: 2 },
    cancelButton: { marginRight: 10 },
    saveButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
});

export default StoreScreen;