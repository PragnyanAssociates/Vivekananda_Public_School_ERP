import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
    ActivityIndicator, Alert, Modal, ScrollView, Platform, PermissionsAndroid,
    Linking
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/client';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNFS from 'react-native-fs';

const RegistersScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();

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
        } else if (activePeriod !== 'overall') { // Add condition to not send 'overall'
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
        // For Android 13+ (API 33+), WRITE_EXTERNAL_STORAGE is not needed for non-media files.
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
            let imageHtml = '';
            if (details.attachment_url) {
                const baseUrl = apiClient.defaults.baseURL.replace('/api', '');
                const fullImageUrl = `${baseUrl}${details.attachment_url}`;
                const tempImagePath = `${RNFS.CachesDirectoryPath}/voucher_proof_${Date.now()}.jpg`;
                const downloadResult = await RNFS.downloadFile({ fromUrl: fullImageUrl, toFile: tempImagePath }).promise;
                if (downloadResult.statusCode === 200) {
                    imageHtml = `<div class="section-title">Proof Attachment</div><div class="image-container"><img src="file://${tempImagePath}" alt="Proof Attachment" /></div>`;
                }
            }
            const particularsHtml = details.particulars.map(p => `<tr class="item-row"><td>${p.description}</td><td class="align-right">₹${parseFloat(p.amount).toFixed(2)}</td></tr>`).join('');
            const htmlContent = `
                <!DOCTYPE html><html><head><meta charset="utf-8"><title>Voucher</title><style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #333; } .voucher-box { max-width: 800px; margin: auto; padding: 25px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.15); } .header { text-align: center; margin-bottom: 15px; } .school-name { font-size: 22px; font-weight: bold; } .managed-by { font-size: 9px; color: #666; } .voucher-title { font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 15px 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee; padding: 8px 0; } .details-table { width: 100%; margin-bottom: 20px; } .details-table td { padding: 4px 0; } .details-table .label { font-weight: bold; width: 110px; } .particulars-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; } .particulars-table th, .particulars-table td { border-bottom: 1px solid #eee; padding: 6px; } .particulars-table th { background-color: #f8f8f8; text-align: left; } .total-row td { border-top: 2px solid #333; font-weight: bold; } .align-right { text-align: right; } .in-words { margin-bottom: 20px; } .section-title { font-size: 13px; font-weight: bold; margin-top: 15px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; } .image-container { text-align: center; margin-bottom: 15px; } .image-container img { max-width: 100%; max-height: 280px; height: auto; border: 1px solid #ddd; } .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #eee; font-size: 9px; color: #777; text-align: center; }
                </style></head><body><div class="voucher-box"><div class="header"><div class="school-name">Vivekananda Public School</div><div class="managed-by">Managed By Vivekananda Education Center</div><div class="voucher-title">${details.voucher_type} Voucher</div></div><table class="details-table">
                <tr><td class="label">Voucher #:</td><td>${details.voucher_no}</td></tr><tr><td class="label">Date:</td><td>${new Date(details.voucher_date).toLocaleDateString('en-GB')}</td></tr>
                ${details.name_title ? `<tr><td class="label">Name/Title:</td><td>${details.name_title}</td></tr>` : ''} ${details.phone_no ? `<tr><td class="label">Phone No:</td><td>${details.phone_no}</td></tr>` : ''}
                <tr><td class="label">Head of A/C:</td><td>${details.head_of_account}</td></tr> ${details.sub_head ? `<tr><td class="label">Sub Head:</td><td>${details.sub_head}</td></tr>` : ''}
                <tr><td class="label">Account Type:</td><td>${details.account_type}</td></tr></table><table class="particulars-table"><thead><tr><th>Description</th><th class="align-right">Amount</th></tr></thead><tbody>
                ${particularsHtml}<tr class="total-row"><td><strong>Total:</strong></td><td class="align-right"><strong>₹${parseFloat(details.total_amount).toFixed(2)}</strong></td></tr></tbody></table>
                <div class="in-words"><strong>In Words:</strong> ${details.amount_in_words}</div> ${imageHtml}
                <div class="footer"><div>Created by: ${details.creator_name || 'N/A'} on ${new Date(details.created_at).toLocaleString('en-GB')}</div>
                ${details.updater_name ? `<div>Last updated by: ${details.updater_name} on ${new Date(details.updated_at).toLocaleString('en-GB')}</div>` : ''}</div></div></body></html>
            `;
            const options = { html: htmlContent, fileName: `Voucher-${details.voucher_no}`, directory: 'Documents', width: 595, height: 842 };
            const file = await RNHTMLtoPDF.convert(options);
            const destinationPath = `${RNFS.DownloadDirectoryPath}/Voucher-${details.voucher_no}.pdf`;
            await RNFS.moveFile(file.filePath, destinationPath);
            Alert.alert("Success", `PDF saved to your Downloads folder as Voucher-${details.voucher_no}.pdf`);
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

    const renderVoucherItem = ({ item, index }: { item: any, index: number }) => {
        let amountStyle = styles.amountDefault;
        let amountPrefix = '₹';

        if (activeVoucherType === 'Debit') {
            amountStyle = styles.amountDebit;
            amountPrefix = '- ';
        } else if (activeVoucherType === 'Credit') {
            amountStyle = styles.amountCredit;
            amountPrefix = '+ ';
        }

        return (
            <View style={styles.tableRow}>
                <Text style={styles.snoCell}>{index + 1}</Text>
                <Text style={styles.vchCell}>{item.voucher_no}</Text>
                <Text style={styles.headCell}>{item.head_of_account}</Text>
                <Text style={[styles.amountCell, amountStyle]}>{`${amountPrefix}₹${parseFloat(item.total_amount).toFixed(2)}`}</Text>
                <View style={styles.actionCell}>
                    <TouchableOpacity style={styles.iconButton} onPress={() => viewVoucherDetails(item.id)}><MaterialIcons name="visibility" size={22} color="#3498db" /></TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => editVoucher(item.id)}><MaterialIcons name="edit" size={20} color="#f1c40f" /></TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => downloadVoucher(item.id)}><MaterialIcons name="download" size={22} color="#27ae60" /></TouchableOpacity>
                </View>
            </View>
        );
    };

    const TableHeader = () => (
        <View style={styles.tableHeader}>
            <Text style={[styles.headerText, { width: 50, textAlign: 'center' }]}>S.NO</Text>
            <Text style={[styles.headerText, { width: 110 }]}>VCH NO</Text>
            <Text style={[styles.headerText, { width: 150 }]}>HEAD</Text>
            <Text style={[styles.headerText, { width: 120, textAlign: 'right' }]}>AMOUNT</Text>
            <Text style={[styles.headerText, { width: 110, textAlign: 'center' }]}>ACTIONS</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><MaterialIcons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
                <Text style={styles.headerTitle}>Registers</Text>
            </View>

            <View style={styles.filterCard}>
                <View style={styles.segmentControl}>
                    {['Debit', 'Credit'].map(type => (
                        <TouchableOpacity key={type} style={[styles.segmentButton, activeVoucherType === type && styles.segmentActive]} onPress={() => handleVoucherTypeChange(type)}>
                            <Text style={[styles.segmentText, activeVoucherType === type && styles.segmentTextActive]}>{type}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.segmentControl}>
                    {['Daily', 'Monthly', 'Overall'].map(p => (
                        <TouchableOpacity key={p} style={[styles.segmentButton, activePeriod === p.toLowerCase() && styles.segmentActive]} onPress={() => handlePeriodChange(p.toLowerCase())}>
                            <Text style={[styles.segmentText, activePeriod === p.toLowerCase() && styles.segmentTextActive]}>{p}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                 <View style={styles.dateRangeContainer}>
                    <TouchableOpacity style={styles.dateButton} onPress={() => showDatePicker('start')}>
                        <MaterialIcons name="calendar-today" size={16} color="#546E7A" />
                        <Text style={styles.dateText}>{dateRange.start || 'From Date'}</Text>
                    </TouchableOpacity>
                     <TouchableOpacity style={styles.dateButton} onPress={() => showDatePicker('end')}>
                        <MaterialIcons name="calendar-today" size={16} color="#546E7A" />
                        <Text style={styles.dateText}>{dateRange.end || 'To Date'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.goButton} onPress={fetchVouchers}>
                         <Text style={styles.goButtonText}>Go</Text>
                    </TouchableOpacity>
                </View>
            </View>
            
            <View style={styles.tableContainer}>
                {isLoading ? (
                    <ActivityIndicator size="large" color="#007AFF" style={{ flex: 1 }}/>
                ) : vouchers.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View>
                            <TableHeader />
                            <FlatList
                                data={vouchers}
                                renderItem={renderVoucherItem}
                                keyExtractor={item => item.id.toString()}
                            />
                        </View>
                    </ScrollView>
                ) : (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No vouchers found.</Text>
                    </View>
                )}
            </View>
            
            <DateTimePickerModal isVisible={isDatePickerVisible} mode="date" onConfirm={handleConfirmDate} onCancel={hideDatePicker} />

            {selectedVoucher && (
                 <Modal animationType="slide" transparent={true} visible={isDetailModalVisible} onRequestClose={() => setDetailModalVisible(false)}>
                     <View style={styles.modalContainer}>
                         <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>{selectedVoucher.voucher_type} Voucher</Text>
                            <Text style={styles.modalVoucherNo}>{selectedVoucher.voucher_no}</Text>
                            <ScrollView>
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Date:</Text> {new Date(selectedVoucher.voucher_date).toLocaleDateString('en-GB')}</Text>
                                {selectedVoucher.name_title && <Text style={styles.detailRow}><Text style={styles.detailLabel}>Name/Title:</Text> {selectedVoucher.name_title}</Text>}
                                {selectedVoucher.phone_no && <Text style={styles.detailRow}><Text style={styles.detailLabel}>Phone No:</Text> {selectedVoucher.phone_no}</Text>}
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Head of A/C:</Text> {selectedVoucher.head_of_account}</Text>
                                {selectedVoucher.sub_head && <Text style={styles.detailRow}><Text style={styles.detailLabel}>Sub Head:</Text> {selectedVoucher.sub_head}</Text>}
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Account Type:</Text> {selectedVoucher.account_type}</Text>
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>{selectedVoucher.transaction_context_type}:</Text> {selectedVoucher.transaction_context_value}</Text>
                                <Text style={styles.modalSectionTitle}>Particulars</Text>
                                {selectedVoucher.particulars.map((p, i) => (
                                    <View key={i} style={styles.particularRow}><Text style={styles.particularDesc}>{p.description}</Text><Text style={styles.particularAmt}>₹{p.amount}</Text></View>
                                ))}
                                <View style={styles.totalRow}><Text style={styles.totalText}>Total Amount:</Text><Text style={styles.totalAmount}>₹{selectedVoucher.total_amount}</Text></View>
                                {selectedVoucher.attachment_url && <TouchableOpacity style={styles.viewProofButton} onPress={() => handleViewProof(selectedVoucher.attachment_url)}><MaterialIcons name="image" size={20} color="#FFF" /><Text style={styles.viewProofButtonText}>View Proof</Text></TouchableOpacity>}
                                <View style={styles.userInfoContainer}>
                                    <Text style={styles.userInfoText}>Created by: {selectedVoucher.creator_name || 'N/A'}</Text>
                                    {selectedVoucher.updater_name && selectedVoucher.updated_at && <Text style={styles.userInfoText}>Last updated by: {selectedVoucher.updater_name} on {new Date(selectedVoucher.updated_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</Text>}
                                </View>
                            </ScrollView>
                            <TouchableOpacity style={styles.closeButton} onPress={() => setDetailModalVisible(false)}><Text style={styles.closeButtonText}>Close</Text></TouchableOpacity>
                         </View>
                     </View>
                 </Modal>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F4F8' },
    header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#CFD8DC' },
    backButton: { padding: 5, marginRight: 15 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#263238' },
    
    filterCard: { backgroundColor: '#FFFFFF', margin: 10, borderRadius: 12, padding: 15, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    segmentControl: { flexDirection: 'row', backgroundColor: '#ECEFF1', borderRadius: 8, marginBottom: 12 },
    segmentButton: { flex: 1, paddingVertical: 10, borderRadius: 7 },
    segmentActive: { backgroundColor: '#007AFF' },
    segmentText: { textAlign: 'center', fontWeight: '600', color: '#37474F', fontSize: 13 },
    segmentTextActive: { color: '#FFFFFF' },
    dateRangeContainer: { flexDirection: 'row', alignItems: 'center' },
    dateButton: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECEFF1', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, marginRight: 10 },
    dateText: { marginLeft: 8, color: '#37474F', fontWeight: '500' },
    goButton: { backgroundColor: '#27ae60', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 8, justifyContent: 'center' },
    goButtonText: { color: '#FFF', fontWeight: 'bold' },

    tableContainer: { flex: 1, marginHorizontal: 10, marginBottom: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFD8DC', borderRadius: 8 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderBottomWidth: 2, borderBottomColor: '#B0BEC5' },
    headerText: { fontSize: 11, fontWeight: 'bold', color: '#546E7A', textTransform: 'uppercase', paddingVertical: 12, paddingHorizontal: 8 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ECEFF1', alignItems: 'center' },
    
    snoCell: { width: 50, padding: 10, textAlign: 'center', borderRightWidth: 1, borderRightColor: '#ECEFF1', color: '#546E7A' },
    vchCell: { width: 110, padding: 10, borderRightWidth: 1, borderRightColor: '#ECEFF1', color: '#37474F', fontWeight: '500' },
    headCell: { width: 150, padding: 10, borderRightWidth: 1, borderRightColor: '#ECEFF1', color: '#37474F' },
    amountCell: { width: 120, padding: 10, borderRightWidth: 1, borderRightColor: '#ECEFF1', fontWeight: 'bold', fontSize: 14, textAlign: 'right' },
    actionCell: { width: 110, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 10 },
    iconButton: { padding: 4 },

    amountDebit: { color: '#d9534f' },
    amountCredit: { color: '#5cb85c' },
    amountDefault: { color: '#37474F' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { fontSize: 16, color: '#78909C' },

    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { width: '90%', maxHeight: '80%', backgroundColor: 'white', borderRadius: 10, padding: 20, elevation: 10 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5, textAlign: 'center', color: '#1A202C' },
    modalVoucherNo: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 15 },
    detailRow: { fontSize: 16, marginBottom: 8 },
    detailLabel: { fontWeight: 'bold', color: '#4A5568' },
    modalSectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 5, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 10 },
    particularRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    particularDesc: { flex: 1, color: '#4A5568' },
    particularAmt: { fontWeight: 'bold', color: '#1A202C' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 10, borderTopWidth: 2, borderTopColor: '#333' },
    totalText: { fontSize: 16, fontWeight: 'bold', color: '#1A202C' },
    totalAmount: { fontSize: 16, fontWeight: 'bold', color: '#1A202C' },
    viewProofButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#5bc0de', padding: 10, borderRadius: 8, marginTop: 15, },
    viewProofButtonText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },
    userInfoContainer: { marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEE', },
    userInfoText: { fontSize: 12, fontStyle: 'italic', color: '#6c757d', textAlign: 'center', paddingBottom: 2, },
    closeButton: { backgroundColor: '#d9534f', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },
    closeButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default RegistersScreen;