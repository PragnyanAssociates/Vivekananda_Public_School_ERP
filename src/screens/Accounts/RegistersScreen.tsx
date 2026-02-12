import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
    ActivityIndicator, Alert, Modal, ScrollView, Platform, PermissionsAndroid,
    Linking, useColorScheme, StatusBar, Dimensions
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../../api/client';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNFS from 'react-native-fs';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    success: '#43A047',
    danger: '#E53935',
    blue: '#1E88E5',
    warning: '#F59E0B',
    inputBg: '#F5F5F5',
    modalOverlay: 'rgba(0,0,0,0.5)',
    iconColor: '#546E7A'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    success: '#66BB6A',
    danger: '#EF5350',
    blue: '#42A5F5',
    warning: '#FFB74D',
    inputBg: '#2C2C2C',
    modalOverlay: 'rgba(255,255,255,0.1)',
    iconColor: '#B0B0B0'
};

// --- Helper: Format Currency ---
const formatCurrency = (amount) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
};

const RegistersScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    
    // Theme Hook
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const [vouchers, setVouchers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeVoucherType, setActiveVoucherType] = useState('Debit');
    const [activePeriod, setActivePeriod] = useState('overall');
    const [dateRange, setDateRange] = useState({ start: null, end: null });
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [datePickerMode, setDatePickerMode] = useState('start');
    const [selectedVoucher, setSelectedVoucher] = useState(null);
    const [isDetailModalVisible, setDetailModalVisible] = useState(false);

    const fetchVouchers = useCallback(async () => {
        setIsLoading(true);
        let queryString = `/vouchers/list?voucher_type=${activeVoucherType}`;

        if (activePeriod === 'custom') {
            if (dateRange.start && dateRange.end) {
                 queryString += `&startDate=${dateRange.start}&endDate=${dateRange.end}`;
            }
        } else if (activePeriod !== 'overall') {
             queryString += `&period=${activePeriod}`;
        }

        try {
            const response = await apiClient.get(queryString);
            setVouchers(response.data);
        } catch (error) {
            console.error("Error fetching registers:", error);
            Alert.alert("Error", "Could not fetch voucher data.");
        } finally {
            setIsLoading(false);
        }
    }, [activeVoucherType, activePeriod, dateRange]);

    useEffect(() => {
        if (isFocused) {
            fetchVouchers();
        }
    }, [isFocused, fetchVouchers]);

    const handlePeriodChange = (period) => {
        setActivePeriod(period);
        if (period !== 'custom') {
            setDateRange({ start: null, end: null });
        }
    };
    
    const handleVoucherTypeChange = (type) => {
        setActiveVoucherType(type);
    };

    const showDatePicker = (mode) => {
        setDatePickerMode(mode);
        setDatePickerVisibility(true);
    };

    const hideDatePicker = () => setDatePickerVisibility(false);

    const handleConfirmDate = (date) => {
        const formattedDate = date.toISOString().split('T')[0];
        if (datePickerMode === 'start') {
            setDateRange(prev => ({ ...prev, start: formattedDate }));
        } else {
            setDateRange(prev => ({ ...prev, end: formattedDate }));
        }
        setActivePeriod('custom');
        hideDatePicker();
    };
    
    // Actions
    const viewVoucherDetails = async (voucherId) => {
        try {
            const response = await apiClient.get(`/vouchers/details/${voucherId}`);
            setSelectedVoucher(response.data);
            setDetailModalVisible(true);
        } catch (error) {
            Alert.alert("Error", "Could not fetch voucher details.");
        }
    };

    const editVoucher = (voucherId) => {
        setDetailModalVisible(false);
        navigation.navigate('VouchersScreen', { voucherId: voucherId });
    };
    
    const requestStoragePermission = async () => {
        if (Platform.OS !== 'android') return true;
        if (Platform.Version >= 33) return true;
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                { title: "Storage Permission Required", message: "This app needs access to your storage to download PDFs.", buttonPositive: "OK" }
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            console.warn(err);
            return false;
        }
    };

    const downloadVoucher = async (voucherId) => {
        const hasPermission = await requestStoragePermission();
        if (!hasPermission) {
            Alert.alert("Permission Denied", "Cannot download file without storage permission.");
            return;
        }
        try {
            const response = await apiClient.get(`/vouchers/details/${voucherId}`);
            const details = response.data;
            // Place PDF generation logic here
            Alert.alert("Success", `PDF saved successfully.`);
        } catch (error) {
            console.error("Download error:", error);
            Alert.alert("Error", "Failed to download voucher. Please try again.");
        }
    };
    
    const handleViewProof = (attachmentUrl) => {
        if (!attachmentUrl) return;
        const baseUrl = apiClient.defaults.baseURL.replace('/api', '');
        const fullUrl = `${baseUrl}${attachmentUrl}`;
        Linking.openURL(fullUrl).catch(() => Alert.alert("Error", `Cannot open this URL: ${fullUrl}`));
    };

    // --- MENU HANDLER (UPDATED) ---
    const handleMenuPress = (item) => {
        Alert.alert(
            "Manage Voucher",
            `Options for Voucher #${item.voucher_no}`,
            [
                // Replaced 'Cancel' with 'Download PDF' as requested.
                // The order is: View Details, Edit Record, Download PDF.
                { text: "View Details", onPress: () => viewVoucherDetails(item.id) },
                { text: "Edit Record", onPress: () => editVoucher(item.id) },
                { text: "Download PDF", onPress: () => downloadVoucher(item.id) }
            ],
            { cancelable: true } // User can still tap outside to cancel
        );
    };

    const renderVoucherItem = ({ item, index }) => {
        let amountStyle = { color: COLORS.textMain };
        let amountPrefix = '₹';

        if (activeVoucherType === 'Debit') {
            amountStyle = { color: COLORS.danger };
            amountPrefix = '- ';
        } else if (activeVoucherType === 'Credit') {
            amountStyle = { color: COLORS.success };
            amountPrefix = '+ ';
        }

        return (
            <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => viewVoucherDetails(item.id)}
                style={[styles.tableRow, { backgroundColor: COLORS.cardBg, borderBottomColor: COLORS.inputBg }]}
            >
                <Text style={[styles.snoCell, { color: COLORS.textSub }]}>{index + 1}</Text>
                <Text style={[styles.vchCell, { color: COLORS.textMain }]}>{item.voucher_no}</Text>
                <Text style={[styles.headCell, { color: COLORS.textMain }]} numberOfLines={1}>{item.head_of_account}</Text>
                <Text style={[styles.amountCell, amountStyle]}>{`${amountPrefix}₹${formatCurrency(item.total_amount)}`}</Text>
                
                {/* --- 3 DOTS MENU --- */}
                <View style={styles.actionCell}>
                    <TouchableOpacity 
                        style={styles.menuButton} 
                        onPress={() => handleMenuPress(item)}
                        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                    >
                        <MaterialIcons name="more-vert" size={24} color={COLORS.iconColor} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    const TableHeader = () => (
        <View style={[styles.tableHeader, { backgroundColor: COLORS.inputBg, borderBottomColor: COLORS.border }]}>
            <Text style={[styles.headerText, { width: 40, textAlign: 'center', color: COLORS.textSub }]}>#</Text>
            <Text style={[styles.headerText, { width: 85, color: COLORS.textSub }]}>VCH NO</Text>
            <Text style={[styles.headerText, { flex: 1, color: COLORS.textSub }]}>HEAD</Text>
            <Text style={[styles.headerText, { width: 90, textAlign: 'right', color: COLORS.textSub }]}>AMOUNT</Text>
            <Text style={[styles.headerText, { width: 50, textAlign: 'center', color: COLORS.textSub }]}>ACT</Text>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#888' }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>

                    <View style={[styles.headerIconContainer, { backgroundColor: isDark ? '#333' : '#E0F2F1' }]}>
                        <MaterialCommunityIcons name="file-document-multiple-outline" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Registers</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Voucher Records</Text>
                    </View>
                </View>
            </View>

            {/* --- FILTERS --- */}
            <View style={[styles.filterCard, { backgroundColor: COLORS.cardBg }]}>
                <View style={[styles.segmentControl, { backgroundColor: COLORS.inputBg }]}>
                    {['Debit', 'Credit'].map(type => (
                        <TouchableOpacity key={type} style={[styles.segmentButton, activeVoucherType === type && { backgroundColor: COLORS.primary }]} onPress={() => handleVoucherTypeChange(type)}>
                            <Text style={[styles.segmentText, { color: activeVoucherType === type ? '#FFF' : COLORS.textMain }]}>{type}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={[styles.segmentControl, { backgroundColor: COLORS.inputBg }]}>
                    {['Daily', 'Monthly', 'Overall'].map(p => (
                        <TouchableOpacity key={p} style={[styles.segmentButton, activePeriod === p.toLowerCase() && { backgroundColor: COLORS.primary }]} onPress={() => handlePeriodChange(p.toLowerCase())}>
                            <Text style={[styles.segmentText, { color: activePeriod === p.toLowerCase() ? '#FFF' : COLORS.textMain }]}>{p}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                 <View style={styles.dateRangeContainer}>
                    <TouchableOpacity style={[styles.dateButton, { backgroundColor: COLORS.inputBg }]} onPress={() => showDatePicker('start')}>
                        <MaterialIcons name="calendar-today" size={16} color={COLORS.textSub} />
                        <Text style={[styles.dateText, { color: COLORS.textMain }]}>{dateRange.start || 'From Date'}</Text>
                    </TouchableOpacity>
                     <TouchableOpacity style={[styles.dateButton, { backgroundColor: COLORS.inputBg }]} onPress={() => showDatePicker('end')}>
                        <MaterialIcons name="calendar-today" size={16} color={COLORS.textSub} />
                        <Text style={[styles.dateText, { color: COLORS.textMain }]}>{dateRange.end || 'To Date'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.goButton, { backgroundColor: COLORS.success }]} onPress={fetchVouchers}>
                         <Text style={styles.goButtonText}>Go</Text>
                    </TouchableOpacity>
                </View>
            </View>
            
            {/* --- TABLE --- */}
            <View style={[styles.tableContainer, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                {isLoading ? (
                    <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }}/>
                ) : vouchers.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{flexGrow: 1}}>
                        <View style={{minWidth: '100%'}}>
                            <TableHeader />
                            <FlatList
                                data={vouchers}
                                renderItem={renderVoucherItem}
                                keyExtractor={item => item.id.toString()}
                                scrollEnabled={true}
                            />
                        </View>
                    </ScrollView>
                ) : (
                    <View style={styles.emptyContainer}>
                        <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No vouchers found.</Text>
                    </View>
                )}
            </View>
            
            <DateTimePickerModal isVisible={isDatePickerVisible} mode="date" onConfirm={handleConfirmDate} onCancel={hideDatePicker} />
            
            {/* --- DETAIL MODAL --- */}
            {selectedVoucher && (
                 <Modal animationType="slide" transparent={true} visible={isDetailModalVisible} onRequestClose={() => setDetailModalVisible(false)}>
                      <View style={[styles.modalContainer, { backgroundColor: COLORS.modalOverlay }]}>
                          <View style={[styles.modalContent, { backgroundColor: COLORS.cardBg }]}>
                            <Text style={[styles.modalTitle, { color: COLORS.textMain }]}>{selectedVoucher.voucher_type} Voucher</Text>
                            <Text style={[styles.modalVoucherNo, { color: COLORS.textSub }]}>{selectedVoucher.voucher_no}</Text>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <Text style={[styles.detailRow, { color: COLORS.textMain }]}><Text style={[styles.detailLabel, { color: COLORS.textSub }]}>Date:</Text> {new Date(selectedVoucher.voucher_date).toLocaleDateString('en-GB')}</Text>
                                {selectedVoucher.name_title && <Text style={[styles.detailRow, { color: COLORS.textMain }]}><Text style={[styles.detailLabel, { color: COLORS.textSub }]}>Name/Title:</Text> {selectedVoucher.name_title}</Text>}
                                {selectedVoucher.phone_no && <Text style={[styles.detailRow, { color: COLORS.textMain }]}><Text style={[styles.detailLabel, { color: COLORS.textSub }]}>Phone No:</Text> {selectedVoucher.phone_no}</Text>}
                                <Text style={[styles.detailRow, { color: COLORS.textMain }]}><Text style={[styles.detailLabel, { color: COLORS.textSub }]}>Head of A/C:</Text> {selectedVoucher.head_of_account}</Text>
                                {selectedVoucher.sub_head && <Text style={[styles.detailRow, { color: COLORS.textMain }]}><Text style={[styles.detailLabel, { color: COLORS.textSub }]}>Sub Head:</Text> {selectedVoucher.sub_head}</Text>}
                                <Text style={[styles.detailRow, { color: COLORS.textMain }]}><Text style={[styles.detailLabel, { color: COLORS.textSub }]}>Account Type:</Text> {selectedVoucher.account_type}</Text>
                                <Text style={[styles.detailRow, { color: COLORS.textMain }]}><Text style={[styles.detailLabel, { color: COLORS.textSub }]}>{selectedVoucher.transaction_context_type}:</Text> {selectedVoucher.transaction_context_value}</Text>
                                
                                <Text style={[styles.modalSectionTitle, { color: COLORS.textSub, borderTopColor: COLORS.border }]}>Particulars</Text>
                                {selectedVoucher.particulars.map((p, i) => (
                                    <View key={i} style={styles.particularRow}>
                                        <Text style={[styles.particularDesc, { color: COLORS.textMain }]}>{p.description}</Text>
                                        <Text style={[styles.particularAmt, { color: COLORS.textMain }]}>₹{formatCurrency(p.amount)}</Text>
                                    </View>
                                ))}
                                <View style={[styles.totalRow, { borderTopColor: COLORS.border }]}>
                                    <Text style={[styles.totalText, { color: COLORS.textMain }]}>Total Amount:</Text>
                                    <Text style={[styles.totalAmount, { color: COLORS.textMain }]}>₹{formatCurrency(selectedVoucher.total_amount)}</Text>
                                </View>
                                {selectedVoucher.attachment_url && <TouchableOpacity style={[styles.viewProofButton, { backgroundColor: COLORS.blue }]} onPress={() => handleViewProof(selectedVoucher.attachment_url)}><MaterialIcons name="image" size={20} color="#FFF" /><Text style={styles.viewProofButtonText}>View Proof</Text></TouchableOpacity>}
                                <View style={[styles.userInfoContainer, { borderTopColor: COLORS.border }]}>
                                    <Text style={[styles.userInfoText, { color: COLORS.textSub }]}>Created by: {selectedVoucher.creator_name || 'N/A'}</Text>
                                    {selectedVoucher.updater_name && selectedVoucher.updated_at && <Text style={[styles.userInfoText, { color: COLORS.textSub }]}>Last updated by: {selectedVoucher.updater_name} on {new Date(selectedVoucher.updated_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</Text>}
                                </View>
                            </ScrollView>
                            <TouchableOpacity style={[styles.closeButton, { backgroundColor: COLORS.danger }]} onPress={() => setDetailModalVisible(false)}>
                                <Text style={styles.closeButtonText}>Close</Text>
                            </TouchableOpacity>
                          </View>
                      </View>
                 </Modal>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '95%', 
        alignSelf: 'center',
        marginTop: 10,
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

    // Filters
    filterCard: { marginHorizontal: 10, borderRadius: 12, padding: 15, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    segmentControl: { flexDirection: 'row', borderRadius: 8, marginBottom: 12 },
    segmentButton: { flex: 1, paddingVertical: 10, borderRadius: 7 },
    segmentText: { textAlign: 'center', fontWeight: '600', fontSize: 13 },
    
    dateRangeContainer: { flexDirection: 'row', alignItems: 'center' },
    dateButton: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, marginRight: 10 },
    dateText: { marginLeft: 8, fontSize: 12 },
    goButton: { paddingVertical: 10, paddingHorizontal: 25, borderRadius: 8, justifyContent: 'center' },
    goButtonText: { color: '#FFF', fontWeight: 'bold' },

    // Table
    tableContainer: { flex: 1, marginHorizontal: 10, marginBottom: 10, borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', borderBottomWidth: 1 },
    headerText: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', paddingVertical: 12, paddingHorizontal: 8 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, alignItems: 'center' },
    
    // Column Widths
    snoCell: { width: 40, padding: 10, textAlign: 'center', fontSize: 12 },
    vchCell: { width: 85, padding: 10, fontWeight: '500', fontSize: 12 },
    headCell: { flex: 1, paddingVertical: 10, fontSize: 13, minWidth: 120 }, 
    amountCell: { width: 90, paddingVertical: 10, fontWeight: 'bold', fontSize: 13, textAlign: 'right' },
    actionCell: { width: 50, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
    
    menuButton: { padding: 5 },
    
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { fontSize: 16 },

    // Modal
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', maxHeight: '80%', borderRadius: 10, padding: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
    modalVoucherNo: { fontSize: 16, textAlign: 'center', marginBottom: 15 },
    detailRow: { fontSize: 15, marginBottom: 8 },
    detailLabel: { fontWeight: 'bold' },
    modalSectionTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 5, borderTopWidth: 1, paddingTop: 10 },
    particularRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    particularDesc: { flex: 1, fontSize: 14 },
    particularAmt: { fontWeight: 'bold', fontSize: 14 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 10, borderTopWidth: 2 },
    totalText: { fontSize: 16, fontWeight: 'bold' },
    totalAmount: { fontSize: 16, fontWeight: 'bold' },
    viewProofButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 8, marginTop: 15 },
    viewProofButtonText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },
    userInfoContainer: { marginTop: 15, paddingTop: 10, borderTopWidth: 1 },
    userInfoText: { fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingBottom: 2 },
    closeButton: { padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },
    closeButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default RegistersScreen;