import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, SafeAreaView, Modal, TextInput, Platform, Image, UIManager,
    useColorScheme, StatusBar, Dimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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

// --- THEME COLORS ---
const LightColors = {
    primary: '#008080',
    background: '#F5F7FA',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#E0E0E0',
    inputBg: '#FFFFFF',
    success: '#43A047',
    danger: '#D32F2F',
    modalOverlay: 'rgba(0,0,0,0.5)',
    headerIconBg: '#E0F2F1',
    qtyBg: '#F0F4F8',
    iconBtnBg: '#F5F5F5'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    success: '#66BB6A',
    danger: '#EF5350',
    modalOverlay: 'rgba(255,255,255,0.1)',
    headerIconBg: '#333',
    qtyBg: '#333333',
    iconBtnBg: '#2C2C2C'
};

// --- IMAGE ENLARGER COMPONENT ---
const ImageEnlargerModal = ({ visible, uri, onClose }: { visible: boolean, uri: string | null, onClose: () => void }) => {
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
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const [activeTab, setActiveTab] = useState<'Daily' | 'Inventory'>('Daily');
    const [provisions, setProvisions] = useState<any[]>([]);
    const [usage, setUsage] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [permanentInventory, setPermanentInventory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal States
    const [itemModalInfo, setItemModalInfo] = useState({ visible: false, mode: null, data: null });
    
    // Image Enlarge State
    const [enlargeImage, setEnlargeImage] = useState<string | null>(null);

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

    const openItemModal = (mode: any, data: any = null) => setItemModalInfo({ visible: true, mode, data });
    const closeItemModal = () => setItemModalInfo({ visible: false, mode: null, data: null });
    
    const handleSaveItem = async (formData: FormData, mode: string, id?: number) => {
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
        } catch (error: any) {
            console.error("Save Error:", error);
            Alert.alert("Error", error.response?.data?.message || "Failed to save.");
        }
    };

    const handleLogUsage = async (inventoryId: number, quantityUsed: number) => {
        try {
            const dateString = selectedDate.toISOString().split('T')[0];
            await apiClient.post('/kitchen/usage', { inventoryId, quantityUsed, usageDate: dateString });
            closeItemModal();
            fetchData();
        } catch (error) { Alert.alert("Error", "Failed to log usage."); }
    };
    
    const handleDeletePermanentItem = (item: any) => {
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

    const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (date) setSelectedDate(date);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />

            {/* Header Card */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                        <MaterialCommunityIcons name="chef-hat" size={26} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Kitchen</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>
                            {activeTab === 'Daily' ? selectedDate.toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'}) : 'Manage Inventory'}
                        </Text>
                    </View>
                </View>
                
                <View style={{flexDirection: 'row', gap: 8}}>
                    {activeTab === 'Daily' && (
                        <TouchableOpacity style={[styles.headerActionBtn, { borderColor: COLORS.border }]} onPress={() => setShowDatePicker(true)}>
                            <MaterialIcons name="calendar-today" size={20} color={COLORS.primary} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.headerBtn, { backgroundColor: COLORS.primary }]} onPress={() => openItemModal(activeTab === 'Daily' ? 'addProvision' : 'addPermanentItem')}>
                        <MaterialIcons name="add" size={18} color="#fff" />
                        <Text style={styles.headerBtnText}>Add</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Tabs */}
            <View style={[styles.tabContainer, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'Daily' && { borderBottomColor: COLORS.primary }]} onPress={() => setActiveTab('Daily')}>
                    <Text style={[styles.tabButtonText, { color: activeTab === 'Daily' ? COLORS.primary : COLORS.textSub }]}>Daily Usage</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabButton, activeTab === 'Inventory' && { borderBottomColor: COLORS.primary }]} onPress={() => setActiveTab('Inventory')}>
                    <Text style={[styles.tabButtonText, { color: activeTab === 'Inventory' ? COLORS.primary : COLORS.textSub }]}>Permanent Inventory</Text>
                </TouchableOpacity>
            </View>

            {/* Content Body */}
            {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} /> :
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    {activeTab === 'Daily' ? (
                        <>
                            <Section title="Daily Usage" colors={COLORS}>
                                {usage.length > 0 ? (
                                    usage.map((item, index) => (
                                        <InventoryItemCard 
                                            key={`usage-${index}`} 
                                            item={item} 
                                            type="usage" 
                                            colors={COLORS}
                                            onImagePress={(uri: string) => setEnlargeImage(uri)} 
                                        />
                                    ))
                                ) : (
                                    <View style={styles.emptyBox}>
                                        <MaterialCommunityIcons name="pot-steam-outline" size={40} color={COLORS.border} />
                                        <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No items used today.</Text>
                                    </View>
                                )}
                            </Section>

                            <Section title="Remaining Provisions" colors={COLORS}>
                                {provisions.length > 0 ? (
                                    provisions.map((item, index) => (
                                        <InventoryItemCard 
                                            key={`prov-${index}`} 
                                            item={item} 
                                            type="provisions" 
                                            colors={COLORS} 
                                            onLogUsage={(data: any) => openItemModal('logUsage', data)} 
                                            onImagePress={(uri: string) => setEnlargeImage(uri)}
                                        />
                                    ))
                                ) : (
                                    <View style={styles.emptyBox}>
                                        <MaterialCommunityIcons name="basket-off-outline" size={40} color={COLORS.border} />
                                        <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No provisions remaining.</Text>
                                    </View>
                                )}
                            </Section>
                        </>
                    ) : (
                        <Section title="Permanent Assets" colors={COLORS}>
                            {permanentInventory.length > 0 ? (
                                permanentInventory.map((item: any, index: number) => (
                                    <InventoryItemCard 
                                        key={`perm-${index}`} 
                                        item={item} 
                                        type="permanent" 
                                        colors={COLORS} 
                                        onEdit={(data: any) => openItemModal('editPermanentItem', data)} 
                                        onDelete={handleDeletePermanentItem}
                                        onImagePress={(uri: string) => setEnlargeImage(uri)} 
                                    />
                                ))
                            ) : (
                                <View style={styles.emptyBox}>
                                    <MaterialCommunityIcons name="archive-off-outline" size={40} color={COLORS.border} />
                                    <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No permanent assets found.</Text>
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
                    colors={COLORS} 
                />
            )}
            
            <ImageEnlargerModal 
                visible={!!enlargeImage} 
                uri={enlargeImage} 
                onClose={() => setEnlargeImage(null)} 
            />

            {showDatePicker && <DateTimePicker value={selectedDate} mode="date" display="default" onChange={onDateChange} />}
        </SafeAreaView>
    );
};

// --- UPDATED CARD COMPONENT ---
const InventoryItemCard = ({ item, type, onLogUsage, onEdit, onDelete, onImagePress, colors }: any) => {
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
        <View style={[styles.itemCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            
            {/* 1. Clickable Image (Left) */}
            <TouchableOpacity 
                style={[styles.imageContainer, { backgroundColor: colors.background }]} 
                onPress={() => imageUri && onImagePress(imageUri)}
                activeOpacity={imageUri ? 0.8 : 1}
            >
                {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.cardImage} />
                ) : (
                    <MaterialCommunityIcons name="food" size={28} color={colors.textSub} />
                )}
            </TouchableOpacity>

            {/* 2. Content (Middle) - Clickable for Log Usage */}
            <TouchableOpacity 
                style={styles.cardInfo} 
                onPress={() => isProvisions && onLogUsage && onLogUsage(item)}
                disabled={!isProvisions}
            >
                <Text style={[styles.cardTitle, { color: colors.textMain }]} numberOfLines={1}>
                    {item.item_name}
                </Text>

                <View style={styles.statsRow}>
                    {/* Unit Chip */}
                    <View style={[styles.miniChip, { backgroundColor: colors.qtyBg }]}>
                        <MaterialCommunityIcons name="scale" size={12} color={colors.textSub} style={{marginRight: 3}} />
                        <Text style={[styles.miniChipText, { color: colors.textSub }]}>{item.unit || 'pcs'}</Text>
                    </View>

                    {/* Quantity Chip */}
                    <View style={[styles.miniChip, { backgroundColor: isUsage ? '#FFF3E0' : '#E0F2F1' }]}>
                        <Text style={[styles.miniChipLabel, { color: isUsage ? '#E65100' : '#00695C' }]}>{qtyLabel}:</Text>
                        <Text style={[styles.miniChipValue, { color: isUsage ? '#E65100' : '#00695C' }]}>{qtyValue}</Text>
                    </View>
                </View>

                {isPermanent && item.notes ? (
                    <Text style={[styles.cardNotes, { color: colors.textSub }]} numberOfLines={1}>{item.notes}</Text>
                ) : null}
            </TouchableOpacity>

            {/* 3. Actions (Right) - Horizontal Layout */}
            {isPermanent ? (
                <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => onEdit && onEdit(item)} style={[styles.actionBtn, { backgroundColor: '#E0F2F1', marginRight: 8 }]}>
                        <MaterialCommunityIcons name="pencil" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete && onDelete(item)} style={[styles.actionBtn, { backgroundColor: '#FFEBEE' }]}>
                        <MaterialCommunityIcons name="trash-can" size={20} color={colors.danger} />
                    </TouchableOpacity>
                </View>
            ) : isProvisions ? (
                <TouchableOpacity style={styles.chevronContainer} onPress={() => onLogUsage(item)}>
                    <MaterialIcons name="chevron-right" size={24} color={colors.border} />
                </TouchableOpacity>
            ) : null}
        </View>
    );
};

const Section = ({ title, children, colors }: any) => (
    <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMain }]}>{title}</Text>
        {children}
    </View>
);

const EditMenuModal = ({ modalInfo, onClose, onSave, onLogUsage, colors }: any) => {
    const { mode, data } = modalInfo;
    const isEdit = mode === 'editPermanentItem';
    const isLogUsage = mode === 'logUsage';

    const [itemName, setItemName] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [unit, setUnit] = useState('g');
    const [notes, setNotes] = useState('');
    const [image, setImage] = useState<any>(null);

    const [initialData, setInitialData] = useState<any>({});
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
            <View style={styles.modalContainer}>
                <View style={[styles.modalContent, { backgroundColor: colors.cardBg }]}>
                    <Text style={[styles.modalTitle, { color: colors.textMain }]}>{getTitle()}</Text>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {!isLogUsage && (
                            <>
                                <Text style={[styles.inputLabel, { color: colors.textSub }]}>Item Name</Text>
                                <TextInput 
                                    style={[styles.input, { borderColor: colors.border, color: colors.textMain, backgroundColor: colors.inputBg }]} 
                                    placeholder="e.g. Rice" 
                                    placeholderTextColor={colors.textSub}
                                    value={itemName} 
                                    onChangeText={setItemName} 
                                />
                                
                                {mode !== 'editPermanentItem' && (
                                    <>
                                        <Text style={[styles.inputLabel, { color: colors.textSub }]}>Unit</Text>
                                        <View style={styles.unitSelector}>
                                            {UNITS.map(u => (
                                                <TouchableOpacity 
                                                    key={u} 
                                                    style={[styles.unitButton, { borderColor: colors.border }, unit === u && { backgroundColor: colors.primary, borderColor: colors.primary }]} 
                                                    onPress={() => setUnit(u)}
                                                >
                                                    <Text style={[styles.unitButtonText, { color: colors.textSub }, unit === u && { color: '#fff' }]}>{u}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </>
                                )}
                                
                                <TouchableOpacity style={[styles.imagePicker, { borderColor: colors.border, backgroundColor: colors.inputBg }]} onPress={handleChooseImage}>
                                     {imageSource ? 
                                        <Image source={imageSource} style={styles.previewImage} /> 
                                        : 
                                        <><MaterialCommunityIcons name="camera-plus" size={28} color={colors.textSub}/><Text style={[styles.imagePickerText, { color: colors.textSub }]}>Tap to add Image</Text></>
                                     }
                                </TouchableOpacity>
                            </>
                        )}

                        <Text style={[styles.inputLabel, { color: colors.textSub }]}>{isLogUsage ? 'Quantity Used' : 'Quantity'}</Text>
                        <View style={styles.quantityControl}>
                            <TouchableOpacity onPress={() => setQuantity(q => Math.max(1, q - 1))} style={[styles.quantityButton, { borderColor: colors.border }]}><MaterialCommunityIcons name="minus" size={24} color={colors.primary} /></TouchableOpacity>
                            <TextInput 
                                style={[styles.quantityInput, { borderColor: colors.border, color: colors.textMain, backgroundColor: colors.inputBg }]} 
                                value={String(quantity)} 
                                onChangeText={t => setQuantity(Number(t) || 0)} 
                                keyboardType="numeric" 
                            />
                            <TouchableOpacity onPress={() => setQuantity(q => q + 1)} style={[styles.quantityButton, { borderColor: colors.border }]}><MaterialCommunityIcons name="plus" size={24} color={colors.primary} /></TouchableOpacity>
                        </View>
                        
                        {(mode === 'addPermanentItem' || mode === 'editPermanentItem') && (
                            <>
                                <Text style={[styles.inputLabel, { color: colors.textSub }]}>Notes</Text>
                                <TextInput 
                                    style={[styles.input, { height: 60, textAlignVertical: 'top', borderColor: colors.border, color: colors.textMain, backgroundColor: colors.inputBg }]} 
                                    multiline 
                                    placeholder="Details..." 
                                    placeholderTextColor={colors.textSub}
                                    value={notes} 
                                    onChangeText={setNotes} 
                                />
                            </>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose}><Text style={{color: '#333'}}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.primary }]} onPress={handlePressSave}><Text style={styles.saveButtonText}>Save</Text></TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContainer: { paddingHorizontal: 15, paddingBottom: 30 },
    
    // Header
    headerCard: { paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },
    headerActionBtn: { padding: 8, borderRadius: 8, borderWidth: 1 },
    headerBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    // Tabs
    tabContainer: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 15, borderRadius: 8, overflow: 'hidden', elevation: 2, borderWidth: 1 },
    tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
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
        flexDirection: 'row', // Horizontal
        alignItems: 'center',
        gap: 12, // Space between buttons
        paddingLeft: 5
    },
    actionBtn: {
        padding: 8,
        borderRadius: 8, // Square-ish rounded
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
        borderColor: '#ccc',
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
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
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
    quantityButton: { backgroundColor: '#f0f0f0', padding: 8, borderRadius: 8, borderWidth: 1 },
    quantityInput: { borderWidth: 1, borderRadius: 8, width: 70, textAlign: 'center', fontSize: 18, fontWeight: 'bold', marginHorizontal: 15, paddingVertical: 8 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    modalButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, flex: 1, alignItems: 'center', elevation: 2 },
    cancelButton: { backgroundColor: '#e0e0e0', marginRight: 10 },
    saveButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
});

export default KitchenScreen;