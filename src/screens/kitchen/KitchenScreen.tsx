/**
 * File: src/screens/kitchen/KitchenScreen.tsx
 * Purpose: Manage Kitchen Inventory (Provisions & Permanent Items) and Log Usage.
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI Header.
 */
import React, { useState, useCallback, useEffect, useLayoutEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, SafeAreaView, Modal, TextInput, Platform, Image, UIManager,
    useColorScheme, StatusBar, Dimensions, KeyboardAvoidingView
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'react-native-image-picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F5F7FA',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#E0E0E0',
    inputBg: '#F8FAFC',
    inputBorder: '#E0E0E0',
    headerIconBg: '#E0F2F1',
    success: '#43A047',
    danger: '#D32F2F',
    qtyBg: '#F0F4F8',
    iconBtnBg: '#F5F5F5',
    modalOverlay: 'rgba(0,0,0,0.5)',
    emptyIcon: '#CFD8DC',
    white: '#ffffff',
    cancelBtnBg: '#E0E0E0',
    cancelBtnText: '#333333'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    inputBorder: '#555555',
    headerIconBg: '#333',
    success: '#66BB6A',
    danger: '#EF5350',
    qtyBg: '#333333',
    iconBtnBg: '#2C2C2C',
    modalOverlay: 'rgba(0,0,0,0.7)',
    emptyIcon: '#475569',
    white: '#ffffff',
    cancelBtnBg: '#333333',
    cancelBtnText: '#E0E0E0'
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

const KitchenScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const navigation = useNavigation();

    // Hide default header to use our custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const [activeTab, setActiveTab] = useState('Daily');
    const [provisions, setProvisions] = useState([]);
    const [usage, setUsage] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [permanentInventory, setPermanentInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal States
    const [itemModalInfo, setItemModalInfo] = useState({ visible: false, mode: null, data: null });
    
    // Image Enlarge State
    const [enlargeImage, setEnlargeImage] = useState(null);

    const fetchData = useCallback(() => {
        setLoading(true);
        const dateString = selectedDate.toISOString().split('T')[0];
        
        const dailyProvisionsFetch = apiClient.get('/kitchen/inventory');
        const dailyUsageFetch = apiClient.get(`/kitchen/usage?date=${dateString}`);
        const permanentInventoryFetch = apiClient.get('/permanent-inventory');

        Promise.all([dailyProvisionsFetch, dailyUsageFetch, permanentInventoryFetch])
            .then(([provisionsRes, usageRes, permanentRes]) => {
                setProvisions(provisionsRes.data || []);
                setUsage(usageRes.data || []);
                setPermanentInventory(permanentRes.data || []);
            })
            .catch((err) => Alert.alert("Error", "Could not fetch kitchen data."))
            .finally(() => setLoading(false));
    }, [selectedDate]);

    useFocusEffect(useCallback(() => {
        fetchData();
    }, [fetchData]));

    const openItemModal = (mode, data = null) => setItemModalInfo({ visible: true, mode, data });
    const closeItemModal = () => setItemModalInfo({ visible: false, mode: null, data: null });
    
    const handleSaveItem = async (formData, mode, id) => {
        try {
            if (mode === 'addProvision') {
                await apiClient.post('/kitchen/inventory', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            } else if (mode === 'addPermanentItem') {
                await apiClient.post('/permanent-inventory', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            } else if (mode === 'editPermanentItem' && id) {
                await apiClient.put(`/permanent-inventory/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            }
            closeItemModal();
            fetchData();
        } catch (error) {
            console.error("Save Error:", error);
            Alert.alert("Error", error.response?.data?.message || "Failed to save.");
        }
    };

    const handleLogUsage = async (inventoryId, quantityUsed) => {
        try {
            const dateString = selectedDate.toISOString().split('T')[0];
            await apiClient.post('/kitchen/usage', { inventoryId, quantityUsed, usageDate: dateString });
            closeItemModal();
            fetchData();
        } catch (error) { Alert.alert("Error", "Failed to log usage."); }
    };
    
    const handleDeletePermanentItem = (item) => {
        Alert.alert("Delete", "Delete this item?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    await apiClient.delete(`/permanent-inventory/${item.id}`);
                    fetchData();
                } catch(e) { Alert.alert("Error", "Failed to delete."); }
            }}
        ]);
    };

    const onDateChange = (event, date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (date) setSelectedDate(date);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.headerIconBg }]}>
                        <MaterialCommunityIcons name="chef-hat" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Kitchen</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>
                            {activeTab === 'Daily' 
                                ? selectedDate.toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'}) 
                                : 'Manage Inventory'}
                        </Text>
                    </View>
                </View>
                
                <View style={{flexDirection: 'row', gap: 8}}>
                    {activeTab === 'Daily' && (
                        <TouchableOpacity style={[styles.headerActionBtn, { borderColor: theme.border }]} onPress={() => setShowDatePicker(true)}>
                            <MaterialIcons name="calendar-today" size={20} color={theme.primary} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.headerBtn, { backgroundColor: theme.primary }]} onPress={() => openItemModal(activeTab === 'Daily' ? 'addProvision' : 'addPermanentItem')}>
                        <MaterialIcons name="add" size={18} color={theme.white} />
                        <Text style={styles.headerBtnText}>Add</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Tabs */}
            <View style={[styles.tabContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'Daily' && { borderBottomColor: theme.primary }]} onPress={() => setActiveTab('Daily')}>
                    <Text style={[styles.tabButtonText, { color: activeTab === 'Daily' ? theme.primary : theme.textSub }]}>Daily Usage</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'Inventory' && { borderBottomColor: theme.primary }]} onPress={() => setActiveTab('Inventory')}>
                    <Text style={[styles.tabButtonText, { color: activeTab === 'Inventory' ? theme.primary : theme.textSub }]}>Permanent Inventory</Text>
                </TouchableOpacity>
            </View>

            {/* Content Body */}
            {loading ? <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} /> :
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    {activeTab === 'Daily' ? (
                        <>
                            <Section title="Daily Usage" theme={theme}>
                                {usage.length > 0 ? (
                                    usage.map((item, index) => (
                                        <InventoryItemCard 
                                            key={`usage-${index}`} 
                                            item={item} 
                                            type="usage" 
                                            theme={theme}
                                            onImagePress={(uri) => setEnlargeImage(uri)} 
                                        />
                                    ))
                                ) : (
                                    <View style={[styles.emptyBox, { borderColor: theme.border }]}>
                                        <MaterialCommunityIcons name="pot-steam-outline" size={40} color={theme.emptyIcon} />
                                        <Text style={[styles.emptyText, { color: theme.textSub }]}>No items used today.</Text>
                                    </View>
                                )}
                            </Section>

                            <Section title="Remaining Provisions" theme={theme}>
                                {provisions.length > 0 ? (
                                    provisions.map((item, index) => (
                                        <InventoryItemCard 
                                            key={`prov-${index}`} 
                                            item={item} 
                                            type="provisions" 
                                            theme={theme} 
                                            onLogUsage={(data) => openItemModal('logUsage', data)} 
                                            onImagePress={(uri) => setEnlargeImage(uri)}
                                        />
                                    ))
                                ) : (
                                    <View style={[styles.emptyBox, { borderColor: theme.border }]}>
                                        <MaterialCommunityIcons name="basket-off-outline" size={40} color={theme.emptyIcon} />
                                        <Text style={[styles.emptyText, { color: theme.textSub }]}>No provisions remaining.</Text>
                                    </View>
                                )}
                            </Section>
                        </>
                    ) : (
                        <Section title="Permanent Assets" theme={theme}>
                            {permanentInventory.length > 0 ? (
                                permanentInventory.map((item, index) => (
                                    <InventoryItemCard 
                                        key={`perm-${index}`} 
                                        item={item} 
                                        type="permanent" 
                                        theme={theme} 
                                        onEdit={(data) => openItemModal('editPermanentItem', data)} 
                                        onDelete={handleDeletePermanentItem}
                                        onImagePress={(uri) => setEnlargeImage(uri)} 
                                    />
                                ))
                            ) : (
                                <View style={[styles.emptyBox, { borderColor: theme.border }]}>
                                    <MaterialCommunityIcons name="archive-off-outline" size={40} color={theme.emptyIcon} />
                                    <Text style={[styles.emptyText, { color: theme.textSub }]}>No permanent assets found.</Text>
                                </View>
                            )}
                        </Section>
                    )}
                </ScrollView>
            }

            {itemModalInfo.visible && (
                <EditMenuModal 
                    modalInfo={itemModalInfo} 
                    onClose={closeItemModal} 
                    onSave={handleSaveItem} 
                    onLogUsage={handleLogUsage} 
                    theme={theme} 
                />
            )}
            
            <ImageEnlargerModal 
                visible={!!enlargeImage} 
                uri={enlargeImage} 
                onClose={() => setEnlargeImage(null)} 
            />

            {showDatePicker && (
                <DateTimePicker 
                    value={selectedDate} 
                    mode="date" 
                    display="default" 
                    onChange={onDateChange} 
                />
            )}
        </SafeAreaView>
    );
};

// --- UPDATED CARD COMPONENT ---
const InventoryItemCard = ({ item, type, onLogUsage, onEdit, onDelete, onImagePress, theme }) => {
    const isProvisions = type === 'provisions';
    const isPermanent = type === 'permanent';
    const isUsage = type === 'usage';

    const imageUri = item.image_url ? `${SERVER_URL}${item.image_url}` : null;

    let qtyLabel = 'Qty';
    let qtyValue = item.total_quantity;
    
    if (isUsage) {
        qtyLabel = 'Used';
        qtyValue = item.quantity_used;
    } else if (isProvisions) {
        qtyLabel = 'Left';
        qtyValue = item.quantity_remaining;
    }

    return (
        <View style={[styles.itemCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            
            {/* 1. Clickable Image (Left) */}
            <TouchableOpacity 
                style={[styles.imageContainer, { backgroundColor: theme.background }]} 
                onPress={() => imageUri && onImagePress(imageUri)}
                activeOpacity={imageUri ? 0.8 : 1}
            >
                {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.cardImage} />
                ) : (
                    <MaterialCommunityIcons name="food" size={28} color={theme.textSub} />
                )}
            </TouchableOpacity>

            {/* 2. Content (Middle) - Clickable for Log Usage */}
            <TouchableOpacity 
                style={styles.cardInfo} 
                onPress={() => isProvisions && onLogUsage && onLogUsage(item)}
                disabled={!isProvisions}
            >
                <Text style={[styles.cardTitle, { color: theme.textMain }]} numberOfLines={1}>
                    {item.item_name}
                </Text>

                <View style={styles.statsRow}>
                    {/* Unit Chip */}
                    <View style={[styles.miniChip, { backgroundColor: theme.qtyBg }]}>
                        <MaterialCommunityIcons name="scale" size={12} color={theme.textSub} style={{marginRight: 3}} />
                        <Text style={[styles.miniChipText, { color: theme.textSub }]}>{item.unit || 'g'}</Text>
                    </View>

                    {/* Quantity Chip */}
                    <View style={[styles.miniChip, { backgroundColor: isUsage ? '#FFF3E0' : '#E0F2F1' }]}>
                        <Text style={[styles.miniChipLabel, { color: isUsage ? '#E65100' : '#00695C' }]}>{qtyLabel}:</Text>
                        <Text style={[styles.miniChipValue, { color: isUsage ? '#E65100' : '#00695C' }]}>{qtyValue}</Text>
                    </View>
                </View>

                {isPermanent && item.notes ? (
                    <Text style={[styles.cardNotes, { color: theme.textSub }]} numberOfLines={1}>{item.notes}</Text>
                ) : null}
            </TouchableOpacity>

            {/* 3. Actions (Right) - Horizontal Layout */}
            {isPermanent ? (
                <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => onEdit && onEdit(item)} style={[styles.actionBtn, { backgroundColor: theme.iconBtnBg, marginRight: 8 }]}>
                        <MaterialCommunityIcons name="pencil" size={20} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete && onDelete(item)} style={[styles.actionBtn, { backgroundColor: theme.isDark ? '#3E2723' : '#FFEBEE' }]}>
                        <MaterialCommunityIcons name="trash-can" size={20} color={theme.danger} />
                    </TouchableOpacity>
                </View>
            ) : isProvisions ? (
                <TouchableOpacity style={styles.chevronContainer} onPress={() => onLogUsage(item)}>
                    <MaterialIcons name="chevron-right" size={24} color={theme.border} />
                </TouchableOpacity>
            ) : null}
        </View>
    );
};

const Section = ({ title, children, theme }) => (
    <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textMain }]}>{title}</Text>
        {children}
    </View>
);

const EditMenuModal = ({ modalInfo, onClose, onSave, onLogUsage, theme }) => {
    const { mode, data } = modalInfo;
    const isEdit = mode === 'editPermanentItem';
    const isLogUsage = mode === 'logUsage';

    const [itemName, setItemName] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [unit, setUnit] = useState('g');
    const [notes, setNotes] = useState('');
    const [image, setImage] = useState(null);

    const [initialData, setInitialData] = useState({});
    const UNITS = ['g', 'kg', 'l', 'ml', 'pcs', 'pkt'];

    useEffect(() => {
        if (data) {
            setItemName(data.item_name || '');
            const qty = isLogUsage ? 1 : (data.quantity_remaining || data.total_quantity || 1);
            setQuantity(qty);
            setUnit(data.unit || 'g');
            setNotes(data.notes || '');
            
            setInitialData({
                itemName: data.item_name || '',
                quantity: qty,
                unit: data.unit || 'g',
                notes: data.notes || '',
                image_url: data.image_url
            });
        } else {
            setItemName('');
            setQuantity(1);
            setUnit('g');
            setNotes('');
            setInitialData({});
        }
        setImage(null);
    }, [data, mode, isLogUsage]);

    const handleChooseImage = () => {
         ImagePicker.launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, res => { 
             if (res.assets && res.assets[0]) setImage(res.assets[0]); 
         });
    };

    const handlePressSave = () => {
        if (isLogUsage) {
            onLogUsage(data.id, quantity);
            return;
        }

        const formData = new FormData();
        let hasChanges = false;

        if (!isEdit) {
            formData.append('itemName', itemName);
            formData.append('quantity', String(quantity));
            formData.append('unit', unit);
            if (notes) formData.append('notes', notes);
            if (mode === 'addPermanentItem') formData.append('totalQuantity', String(quantity));
            if (image) {
                formData.append('itemImage', { uri: image.uri, type: image.type, name: image.fileName });
            }
            hasChanges = true;
        } else {
            if (itemName !== initialData.itemName) { formData.append('itemName', itemName); hasChanges = true; }
            if (quantity !== initialData.quantity) { 
                const field = mode === 'editPermanentItem' ? 'totalQuantity' : 'quantity';
                formData.append(field, String(quantity)); 
                hasChanges = true; 
            }
            if (unit !== initialData.unit && mode !== 'editPermanentItem') { formData.append('unit', unit); hasChanges = true; }
            if (notes !== initialData.notes) { formData.append('notes', notes); hasChanges = true; }
            if (image) {
                formData.append('itemImage', { uri: image.uri, type: image.type, name: image.fileName });
                hasChanges = true;
            }
        }

        if (hasChanges) onSave(formData, mode, data?.id);
        else onClose();
    };

    const getTitle = () => {
        switch (mode) {
            case 'addProvision': return 'Add Provision';
            case 'logUsage': return 'Log Usage';
            case 'addPermanentItem': return 'Add Permanent Item';
            case 'editPermanentItem': return 'Edit Item';
            default: return 'Action';
        }
    };

    const imageSource = image ? { uri: image.uri } : (data?.image_url ? { uri: `${SERVER_URL}${data.image_url}` } : null);

    return (
        <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.modalContainer, { backgroundColor: theme.modalOverlay }]}>
                <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
                    <Text style={[styles.modalTitle, { color: theme.textMain }]}>{getTitle()}</Text>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {!isLogUsage && (
                            <>
                                <Text style={[styles.inputLabel, { color: theme.textSub }]}>Item Name</Text>
                                <TextInput 
                                    style={[styles.input, { borderColor: theme.inputBorder, color: theme.textMain, backgroundColor: theme.inputBg }]} 
                                    placeholder="e.g. Rice" 
                                    placeholderTextColor={theme.textPlaceholder}
                                    value={itemName} 
                                    onChangeText={setItemName} 
                                />
                                
                                {mode !== 'editPermanentItem' && (
                                    <>
                                        <Text style={[styles.inputLabel, { color: theme.textSub }]}>Unit</Text>
                                        <View style={styles.unitSelector}>
                                            {UNITS.map(u => (
                                                <TouchableOpacity 
                                                    key={u} 
                                                    style={[styles.unitButton, { borderColor: theme.border }, unit === u && { backgroundColor: theme.primary, borderColor: theme.primary }]} 
                                                    onPress={() => setUnit(u)}
                                                >
                                                    <Text style={[styles.unitButtonText, { color: theme.textSub }, unit === u && { color: '#fff' }]}>{u}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </>
                                )}
                                
                                <TouchableOpacity style={[styles.imagePicker, { borderColor: theme.inputBorder, backgroundColor: theme.inputBg }]} onPress={handleChooseImage}>
                                     {imageSource ? 
                                        <Image source={imageSource} style={styles.previewImage} /> 
                                        : 
                                        <><MaterialCommunityIcons name="camera-plus" size={28} color={theme.textSub}/><Text style={[styles.imagePickerText, { color: theme.textSub }]}>Tap to add Image</Text></>
                                     }
                                </TouchableOpacity>
                            </>
                        )}

                        <Text style={[styles.inputLabel, { color: theme.textSub }]}>{isLogUsage ? 'Quantity Used' : 'Quantity'}</Text>
                        <View style={styles.quantityControl}>
                            <TouchableOpacity onPress={() => setQuantity(q => Math.max(1, q - 1))} style={[styles.quantityButton, { borderColor: theme.border, backgroundColor: theme.inputBg }]}><MaterialCommunityIcons name="minus" size={24} color={theme.primary} /></TouchableOpacity>
                            <TextInput 
                                style={[styles.quantityInput, { borderColor: theme.inputBorder, color: theme.textMain, backgroundColor: theme.inputBg }]} 
                                value={String(quantity)} 
                                onChangeText={t => setQuantity(Number(t) || 0)} 
                                keyboardType="numeric" 
                            />
                            <TouchableOpacity onPress={() => setQuantity(q => q + 1)} style={[styles.quantityButton, { borderColor: theme.border, backgroundColor: theme.inputBg }]}><MaterialCommunityIcons name="plus" size={24} color={theme.primary} /></TouchableOpacity>
                        </View>
                        
                        {(mode === 'addPermanentItem' || mode === 'editPermanentItem') && (
                            <>
                                <Text style={[styles.inputLabel, { color: theme.textSub }]}>Notes</Text>
                                <TextInput 
                                    style={[styles.input, { height: 60, textAlignVertical: 'top', borderColor: theme.inputBorder, color: theme.textMain, backgroundColor: theme.inputBg }]} 
                                    multiline 
                                    placeholder="Details..." 
                                    placeholderTextColor={theme.textPlaceholder}
                                    value={notes} 
                                    onChangeText={setNotes} 
                                />
                            </>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.cancelBtnBg }]} onPress={onClose}>
                                <Text style={{ color: theme.cancelBtnText, fontWeight: 'bold' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, { backgroundColor: theme.primary }]} onPress={handlePressSave}>
                                <Text style={styles.saveButtonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContainer: { paddingHorizontal: width * 0.04, paddingBottom: 30 },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 3,
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },
    headerActionBtn: {
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    // Tabs
    tabContainer: { 
        flexDirection: 'row', 
        marginHorizontal: 15, 
        marginBottom: 15, 
        borderRadius: 8, 
        overflow: 'hidden', 
        elevation: 2, 
        borderWidth: 1 
    },
    tabButton: { 
        flex: 1, 
        paddingVertical: 12, 
        alignItems: 'center', 
        borderBottomWidth: 3, 
        borderBottomColor: 'transparent' 
    },
    tabButtonText: { fontSize: 14, fontWeight: '600' },

    // Sections
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, marginLeft: 5 },
    
    // CARD STYLES
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        marginBottom: 10,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        borderWidth: 1,
    },
    imageContainer: {
        width: 65,
        height: 65,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        overflow: 'hidden',
    },
    cardImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    cardInfo: {
        flex: 1,
        justifyContent: 'center',
        gap: 4
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 2
    },
    miniChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    miniChipText: {
        fontSize: 12,
        fontWeight: '600',
    },
    miniChipLabel: {
        fontSize: 11,
        fontWeight: '500',
        marginRight: 4
    },
    miniChipValue: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    cardNotes: {
        fontSize: 11,
        fontStyle: 'italic',
        marginTop: 2,
        opacity: 0.8
    },
    actionRow: {
        flexDirection: 'row', 
        alignItems: 'center',
        gap: 12, 
        paddingLeft: 5
    },
    actionBtn: {
        padding: 8,
        borderRadius: 8, 
        justifyContent: 'center',
        alignItems: 'center'
    },
    chevronContainer: {
        justifyContent: 'center',
        paddingLeft: 10
    },

    // Empty States
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 30,
        opacity: 0.7,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: 12
    },
    emptyText: {
        fontSize: 14,
        marginTop: 8,
        fontStyle: 'italic',
    },

    // Image Enlarger Styles
    enlargeBackground: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)', justifyContent: 'center', alignItems: 'center' },
    enlargeImage: { width: width, height: height * 0.8 },
    enlargeClose: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(50,50,50,0.8)', borderRadius: 20 },

    // Modal
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', borderRadius: 16, padding: 25, elevation: 10, maxHeight: '80%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
    inputLabel: { fontSize: 14, marginBottom: 5, fontWeight: '600' },
    input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15, marginBottom: 15 },
    unitSelector: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    unitButton: { flex: 1, paddingVertical: 8, borderWidth: 1, borderRadius: 8, alignItems: 'center', marginHorizontal: 2 },
    unitButtonText: { fontWeight: '600', fontSize: 12 },
    imagePicker: { height: 100, borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 20, overflow: 'hidden' },
    imagePickerText: { marginTop: 5, fontSize: 12 },
    previewImage: { width: '100%', height: '100%', borderRadius: 8, resizeMode: 'cover' },
    quantityControl: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    quantityButton: { padding: 8, borderRadius: 8, borderWidth: 1 },
    quantityInput: { borderWidth: 1, borderRadius: 8, width: 70, textAlign: 'center', fontSize: 18, fontWeight: 'bold', marginHorizontal: 15, paddingVertical: 8 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    modalButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, flex: 1, alignItems: 'center', elevation: 2 },
    cancelButton: { marginRight: 10 },
    saveButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
});

export default KitchenScreen;