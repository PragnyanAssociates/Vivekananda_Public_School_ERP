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

const { width } = Dimensions.get('window');

// --- THEME COLORS ---
const LightColors = {
    primary: '#008080',
    background: '#F5F7FA',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    inputBg: '#FFFFFF',
    success: '#43A047',
    danger: '#E53935',
    modalOverlay: 'rgba(0,0,0,0.5)',
    headerIconBg: '#E0F2F1'
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
    headerIconBg: '#333'
};

const KitchenScreen = () => {
    // Theme Hook
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
    
    // --- OPTIMIZED SAVE HANDLER (PARTIAL UPDATES) ---
    const handleSaveItem = async (formData: FormData, mode: string, id?: number) => {
        try {
            let response;
            if (mode === 'addProvision') {
                response = await apiClient.post('/kitchen/inventory', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            } else if (mode === 'logUsage') {
                // Usage doesn't use FormData usually, but standardized here
                // Extract JSON from FormData if needed, but easier to just use standard JSON post for logUsage
                // Keeping it consistent with logic:
                // Note: logUsage typically doesn't upload image/edit name, just ID & Qty
                // We'll handle logUsage separately or ensure endpoint accepts JSON
            } else if (mode === 'addPermanentItem') {
                response = await apiClient.post('/permanent-inventory', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            } else if (mode === 'editPermanentItem' && id) {
                response = await apiClient.put(`/permanent-inventory/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            }

            // Simple Alert or Toast
            // Alert.alert("Success", "Saved successfully");
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
                        <MaterialCommunityIcons name="chef-hat" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Kitchen</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>
                            {activeTab === 'Daily' ? selectedDate.toLocaleDateString() : 'Inventory'}
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

            {/* Content */}
            {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} /> :
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    {activeTab === 'Daily' ? (
                        <>
                            <Section title="Daily Usage" colors={COLORS}>
                                {usage.length > 0 ? <DataTable type="usage" data={usage} colors={COLORS} /> : <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No items used on this date.</Text>}
                            </Section>
                            <Section title="Remaining Provisions" colors={COLORS}>
                                {provisions.length > 0 ? <DataTable type="provisions" data={provisions} colors={COLORS} onLogUsage={(item: any) => openItemModal('logUsage', item)} /> : <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No provisions remaining.</Text>}
                            </Section>
                        </>
                    ) : (
                        <Section title="Permanent Assets" colors={COLORS}>
                            {permanentInventory.length > 0 ?
                                <DataTable type="permanent" data={permanentInventory} colors={COLORS} onEdit={(item: any) => openItemModal('editPermanentItem', item)} onDelete={handleDeletePermanentItem} />
                                : <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No permanent items found.</Text>}
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
            
            {showDatePicker && <DateTimePicker value={selectedDate} mode="date" display="default" onChange={onDateChange} />}
        </SafeAreaView>
    );
};

const DataTable = ({ type, data, onLogUsage, onEdit, onDelete, colors }: any) => (
    <View style={[styles.table, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <View style={[styles.tableHeaderRow, { backgroundColor: colors.primary }]}>
            <Text style={[styles.tableHeader, { flex: 0.4 }]}>#</Text>
            <Text style={[styles.tableHeader, { flex: 2, textAlign: 'left', paddingLeft: 10 }]}>Item Name</Text>
            <Text style={[styles.tableHeader, { flex: 1, textAlign: 'center' }]}>{type === 'usage' ? 'Used' : 'Qty'}</Text>
            {type === 'permanent' && <Text style={[styles.tableHeader, { flex: 1.2, textAlign: 'right' }]}>Action</Text>}
        </View>

        {data.map((item: any, index: number) => (
            <View key={`${type}-${item.id}`} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.tableCell, { flex: 0.4, color: colors.textSub }]}>{index + 1}</Text>
                
                <TouchableOpacity style={[styles.tableCell, { flex: 2, flexDirection: 'row', alignItems: 'center' }]} onPress={() => type === 'provisions' && onLogUsage && onLogUsage(item)} disabled={type !== 'provisions'}>
                    {item.image_url ?
                        <Image source={{ uri: `${SERVER_URL}${item.image_url}` }} style={styles.itemImage} />
                        : <View style={[styles.itemImage, styles.imagePlaceholder]}><MaterialCommunityIcons name="food-variant" size={20} color={colors.textSub} /></View>
                    }
                    <Text style={[styles.itemName, { color: colors.textMain }]} numberOfLines={1}>{item.item_name}</Text>
                </TouchableOpacity>
                
                <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontWeight: '600', color: colors.textMain }]}>
                    {type === 'usage' ? `${item.quantity_used} ${item.unit || ''}` : type === 'provisions' ? `${item.quantity_remaining} ${item.unit || ''}` : `${item.total_quantity}`}
                </Text>
                
                {type === 'permanent' && (
                    <View style={[styles.tableCell, { flex: 1.2, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }]}>
                        <TouchableOpacity onPress={() => onEdit && onEdit(item)}><MaterialCommunityIcons name="pencil-outline" size={20} color={colors.primary} /></TouchableOpacity>
                        <TouchableOpacity onPress={() => onDelete && onDelete(item)}><MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.danger} /></TouchableOpacity>
                    </View>
                )}
            </View>
        ))}
    </View>
);

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

    // State
    const [itemName, setItemName] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [unit, setUnit] = useState('g');
    const [notes, setNotes] = useState('');
    const [image, setImage] = useState<any>(null);

    // Store initial state to detect changes
    const [initialData, setInitialData] = useState<any>({});

    const UNITS = ['g', 'kg', 'l', 'ml', 'pcs'];

    useEffect(() => {
        if (data) {
            setItemName(data.item_name || '');
            const qty = isLogUsage ? 1 : (data.quantity_remaining || data.total_quantity || 1);
            setQuantity(qty);
            setUnit(data.unit || 'g');
            setNotes(data.notes || '');
            // For image, we don't set the file object, but we know if there was a URL
            setInitialData({
                itemName: data.item_name || '',
                quantity: qty,
                unit: data.unit || 'g',
                notes: data.notes || '',
                image_url: data.image_url
            });
        } else {
            // Add Mode
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
            // For log usage, we just send ID and Qty used
            onLogUsage(data.id, quantity);
            return;
        }

        const formData = new FormData();
        let hasChanges = false;

        // Compare and append only changed fields
        if (!isEdit) {
            // For ADD mode, send everything
            formData.append('itemName', itemName);
            formData.append('quantity', String(quantity));
            formData.append('unit', unit);
            if (notes) formData.append('notes', notes);
            if (mode === 'addPermanentItem') formData.append('totalQuantity', String(quantity)); // Permanent uses totalQuantity
            if (image) {
                formData.append('itemImage', { uri: image.uri, type: image.type, name: image.fileName });
            }
            hasChanges = true;
        } else {
            // For EDIT mode, compare
            if (itemName !== initialData.itemName) { formData.append('itemName', itemName); hasChanges = true; }
            if (quantity !== initialData.quantity) { 
                // Determine field name based on mode
                const field = mode === 'editPermanentItem' ? 'totalQuantity' : 'quantity';
                formData.append(field, String(quantity)); 
                hasChanges = true; 
            }
            if (unit !== initialData.unit && mode !== 'editPermanentItem') { formData.append('unit', unit); hasChanges = true; } // Permanent items usually don't change unit often, but okay
            if (notes !== initialData.notes) { formData.append('notes', notes); hasChanges = true; }
            
            if (image) {
                formData.append('itemImage', { uri: image.uri, type: image.type, name: image.fileName });
                hasChanges = true;
            }
        }

        if (hasChanges) {
            onSave(formData, mode, data?.id);
        } else {
            onClose(); // No changes, just close
        }
    };

    const getTitle = () => {
        switch (mode) {
            case 'addProvision': return 'Add Provision';
            case 'logUsage': return 'Log Usage';
            case 'addPermanentItem': return 'Add Permanent Item';
            case 'editPermanentItem': return 'Edit Permanent Item';
            default: return 'Action';
        }
    };

    // Determine Image Source for Preview
    // 1. New picked image? Use that.
    // 2. No new image, but existing data has URL? Use Server URL.
    // 3. Neither? Show placeholder.
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
                                        <><MaterialCommunityIcons name="camera-plus" size={28} color={colors.textSub}/><Text style={[styles.imagePickerText, { color: colors.textSub }]}>Image</Text></>
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
    scrollContainer: { paddingHorizontal: 15, paddingBottom: 20 },
    
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
    tabContainer: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 10, borderRadius: 8, overflow: 'hidden', elevation: 2, borderWidth: 1 },
    tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabButtonText: { fontSize: 14, fontWeight: '600' },

    // Sections
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginLeft: 5 },
    table: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', elevation: 2 },
    tableHeaderRow: { flexDirection: 'row', paddingVertical: 10 },
    tableHeader: { fontWeight: 'bold', color: '#FFF', fontSize: 13, paddingHorizontal: 5 },
    tableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingVertical: 12, paddingHorizontal: 5 },
    tableCell: { fontSize: 13, paddingHorizontal: 5 },
    itemImage: { width: 35, height: 35, borderRadius: 6, marginRight: 10, backgroundColor: '#eee' },
    imagePlaceholder: { width: 35, height: 35, borderRadius: 6, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
    itemName: { fontWeight: '600', flex: 1, fontSize: 14 },
    emptyText: { textAlign: 'center', paddingVertical: 20, fontStyle: 'italic' },

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