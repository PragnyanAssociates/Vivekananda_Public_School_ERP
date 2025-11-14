// Filename: screens/RegistersScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
    ActivityIndicator, Alert, Modal, ScrollView, Platform, PermissionsAndroid
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
        } else {
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
        setActivePeriod('custom');
    };

    const hideDatePicker = () => setDatePickerVisibility(false);

    const handleConfirmDate = (date) => {
        const formattedDate = date.toISOString().split('T')[0];
        if (datePickerMode === 'start') {
            setDateRange(prev => ({ ...prev, start: formattedDate }));
        } else {
            setDateRange(prev => ({ ...prev, end: formattedDate }));
        }
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
        navigation.navigate('VouchersScreen', { voucherId: voucherId });
    };
    
    const requestStoragePermission = async () => {
        if (Platform.OS !== 'android') return true;
        if (Platform.Version >= 33) return true;
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                {
                    title: "Storage Permission Required",
                    message: "This app needs access to your storage to download PDFs.",
                    buttonPositive: "OK"
                }
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

            const particularsHtml = details.particulars.map(p => `
                <tr class="item">
                    <td>${p.description}</td>
                    <td>₹${parseFloat(p.amount).toFixed(2)}</td>
                </tr>
            `).join('');

            const htmlContent = `
                <html>
                <head>
                    <style>
                        body { font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 24px; color: #555; }
                        .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.15); font-size: 16px; line-height: 24px; }
                        .invoice-box table { width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }
                        .invoice-box table td { padding: 5px; vertical-align: top; }
                        .invoice-box table tr.top table td { padding-bottom: 20px; }
                        .invoice-box table tr.information table td { padding-bottom: 40px; }
                        .invoice-box table tr.heading td { background: #eee; border-bottom: 1px solid #ddd; font-weight: bold; }
                        .invoice-box table tr.item td { border-bottom: 1px solid #eee; }
                        .invoice-box table tr.item.last td { border-bottom: none; }
                        .invoice-box table tr.total td:nth-child(2) { border-top: 2px solid #eee; font-weight: bold; }
                        .school-title { text-align: center; font-size: 20px; font-weight: bold; }
                        .managed-by { text-align: center; font-size: 12px; color: #666; }
                        .voucher-title { text-align: center; font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 10px 0; }
                    </style>
                </head>
                <body>
                    <div class="invoice-box">
                        <div class="school-title">Vivekananda Public School</div>
                        <div class="managed-by">Managed By Vivekananda Education Center</div>
                        <div class="voucher-title">${details.voucher_type} Voucher</div>
                        <table>
                            <tr class="top">
                                <td colspan="2">
                                    <table>
                                        <tr>
                                            <td>
                                                Voucher #: ${details.voucher_no}<br>
                                                Date: ${new Date(details.voucher_date).toLocaleDateString('en-GB')}
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr class="information">
                                <td colspan="2">
                                    <table>
                                        <tr>
                                            <td>
                                                <strong>Head of A/C:</strong> ${details.head_of_account}<br>
                                                ${details.sub_head ? `<strong>Sub Head:</strong> ${details.sub_head}<br>` : ''}
                                                <strong>Account Type:</strong> ${details.account_type}
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr class="heading">
                                <td>Description</td>
                                <td>Amount</td>
                            </tr>
                            ${particularsHtml}
                            <tr class="total">
                                <td></td>
                                <td>Total: ₹${parseFloat(details.total_amount).toFixed(2)}</td>
                            </tr>
                        </table>
                        <div style="margin-top: 20px;">
                            <strong>In Words:</strong> ${details.amount_in_words}
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            const options = {
                html: htmlContent,
                fileName: `Voucher-${details.voucher_no}`,
            };

            const file = await RNHTMLtoPDF.convert(options);
            const sourcePath = file.filePath;
            const fileName = `Voucher-${details.voucher_no}.pdf`;
            const destinationPath = `${RNFS.DownloadDirectoryPath}/${fileName}`;

            await RNFS.moveFile(sourcePath, destinationPath);
            
            Alert.alert(
                "Success",
                `PDF saved to your Downloads folder as ${fileName}`
            );

        } catch (error) {
            console.error("Download error:", error);
            Alert.alert("Error", "Failed to download voucher. Please try again.");
        }
    };

    const renderVoucherItem = ({ item, index }: { item: any, index: number }) => (
        <View style={styles.tableRow}>
            <Text style={[styles.tableCell, {width: 40}]}>{index + 1}</Text>
            <Text style={[styles.tableCell, {width: 90}]}>{item.voucher_no}</Text>
            <Text style={[styles.tableCell, {flex: 1}]} numberOfLines={1}>{item.head_of_account}</Text>
            <Text style={[styles.tableCell, {width: 90, textAlign: 'right'}]}>₹{item.total_amount}</Text>
            <View style={[styles.tableCell, {width: 100, flexDirection: 'row', justifyContent: 'space-around'}]}>
                <TouchableOpacity onPress={() => viewVoucherDetails(item.id)}>
                    <MaterialIcons name="visibility" size={22} color="#0275d8" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => editVoucher(item.id)}>
                    <MaterialIcons name="edit" size={22} color="#f0ad4e" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => downloadVoucher(item.id)}>
                    <MaterialIcons name="download" size={22} color="#5cb85c" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><MaterialIcons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
                <Text style={styles.headerTitle}>Registers</Text>
            </View>

            <View style={styles.filterContainer}>
                <View style={styles.tabContainer}>
                    {['Debit', 'Credit', 'Deposit'].map(type => (
                        <TouchableOpacity key={type} style={[styles.tab, activeVoucherType === type && styles.activeTab]} onPress={() => handleVoucherTypeChange(type)}>
                            <Text style={[styles.tabText, activeVoucherType === type && styles.activeTabText]}>{type}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.tabContainer}>
                    {['Daily', 'Monthly', 'Overall'].map(p => (
                        <TouchableOpacity key={p} style={[styles.tab, activePeriod === p.toLowerCase() && styles.activeTab]} onPress={() => handlePeriodChange(p.toLowerCase())}>
                            <Text style={[styles.tabText, activePeriod === p.toLowerCase() && styles.activeTabText]}>{p}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                 <View style={styles.dateRangeContainer}>
                    <TouchableOpacity style={styles.dateButton} onPress={() => showDatePicker('start')}>
                        <MaterialIcons name="calendar-today" size={16} color="#333" />
                        <Text style={styles.dateText}>{dateRange.start || 'From Date'}</Text>
                    </TouchableOpacity>
                     <TouchableOpacity style={styles.dateButton} onPress={() => showDatePicker('end')}>
                        <MaterialIcons name="calendar-today" size={16} color="#333" />
                        <Text style={styles.dateText}>{dateRange.end || 'To Date'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.goButton} onPress={fetchVouchers}>
                         <Text style={styles.goButtonText}>Go</Text>
                    </TouchableOpacity>
                </View>
            </View>
            
            <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={[styles.tableHeaderText, {width: 40}]}>S.No</Text>
                    <Text style={[styles.tableHeaderText, {width: 90}]}>VCH No</Text>
                    <Text style={[styles.tableHeaderText, {flex: 1}]}>Head</Text>
                    <Text style={[styles.tableHeaderText, {width: 90, textAlign: 'right'}]}>Amount</Text>
                    <Text style={[styles.tableHeaderText, {width: 100, textAlign: 'center'}]}>Actions</Text>
                </View>
                {isLoading ? (
                    <ActivityIndicator size="large" color="#0275d8" style={{ marginTop: 50 }}/>
                ) : (
                    <FlatList
                        data={vouchers}
                        renderItem={renderVoucherItem}
                        keyExtractor={item => item.id.toString()}
                        ListEmptyComponent={<Text style={styles.noDataText}>No vouchers found for the selected filters.</Text>}
                    />
                )}
            </View>
            
            <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirmDate}
                onCancel={hideDatePicker}
            />

            {selectedVoucher && (
                 <Modal
                    animationType="slide"
                    transparent={true}
                    visible={isDetailModalVisible}
                    onRequestClose={() => setDetailModalVisible(false)}
                 >
                     <View style={styles.modalContainer}>
                         <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>{selectedVoucher.voucher_type} Voucher</Text>
                            <Text style={styles.modalVoucherNo}>{selectedVoucher.voucher_no}</Text>
                            <ScrollView>
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Date:</Text> {new Date(selectedVoucher.voucher_date).toLocaleDateString('en-GB')}</Text>
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Head of A/C:</Text> {selectedVoucher.head_of_account}</Text>
                                {selectedVoucher.sub_head && <Text style={styles.detailRow}><Text style={styles.detailLabel}>Sub Head:</Text> {selectedVoucher.sub_head}</Text>}
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Account Type:</Text> {selectedVoucher.account_type}</Text>
                                <Text style={styles.modalSectionTitle}>Particulars</Text>
                                {selectedVoucher.particulars.map((p, i) => (
                                    <View key={i} style={styles.particularRow}>
                                        <Text style={styles.particularDesc}>{p.description}</Text>
                                        <Text style={styles.particularAmt}>₹{p.amount}</Text>
                                    </View>
                                ))}
                                <View style={styles.totalRow}>
                                    <Text style={styles.totalText}>Total Amount:</Text>
                                    <Text style={styles.totalAmount}>₹{selectedVoucher.total_amount}</Text>
                                </View>
                                <View style={styles.userInfoContainer}>
                                    <Text style={styles.userInfoText}>
                                        Created by: {selectedVoucher.creator_name || 'N/A'}
                                    </Text>
                                    {selectedVoucher.updater_name && (
                                        <Text style={styles.userInfoText}>
                                            Last updated by: {selectedVoucher.updater_name} on {new Date(selectedVoucher.updated_at).toLocaleDateString('en-GB')}
                                        </Text>
                                    )}
                                </View>
                            </ScrollView>
                            <TouchableOpacity style={styles.closeButton} onPress={() => setDetailModalVisible(false)}>
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
    container: { flex: 1, backgroundColor: '#F7FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#DDD', elevation: 2 },
    backButton: { padding: 5 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', marginLeft: 10 },
    filterContainer: { padding: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0'},
    tabContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
    tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#F0F0F0', borderWidth: 1, borderColor: '#DDD' },
    activeTab: { backgroundColor: '#0275d8', borderColor: '#0275d8' },
    tabText: { fontWeight: 'bold', color: '#555' },
    activeTabText: { color: '#FFF' },
    dateRangeContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dateButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E9ECEF', padding: 10, borderRadius: 6, flex: 1, marginHorizontal: 4 },
    dateText: { marginLeft: 8, color: '#495057' },
    goButton: { backgroundColor: '#5cb85c', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, marginLeft: 4, elevation: 2},
    goButtonText: { color: '#FFF', fontWeight: 'bold'},
    table: { flex: 1, margin: 12, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#DEE2E6', overflow: 'hidden' },
    tableHeader: { backgroundColor: '#F8F9FA', borderBottomWidth: 2, borderColor: '#DEE2E6' },
    tableRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEE', alignItems: 'center' },
    tableHeaderText: { fontWeight: 'bold', color: '#495057' },
    tableCell: { paddingHorizontal: 4, color: '#333' },
    noDataText: { textAlign: 'center', marginTop: 50, color: '#6c757d', fontSize: 16 },
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { width: '90%', maxHeight: '80%', backgroundColor: 'white', borderRadius: 10, padding: 20, elevation: 10 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5, textAlign: 'center', color: '#1A202C' },
    modalVoucherNo: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 15 },
    detailRow: { fontSize: 16, marginBottom: 8 },
    detailLabel: { fontWeight: 'bold', color: '#4A5568' },
    modalSectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 5, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 10 },
    particularRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5},
    particularDesc: { flex: 1, color: '#4A5568' },
    particularAmt: { fontWeight: 'bold', color: '#1A202C' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 10, borderTopWidth: 2, borderTopColor: '#333' },
    totalText: { fontSize: 16, fontWeight: 'bold', color: '#1A202C' },
    totalAmount: { fontSize: 16, fontWeight: 'bold', color: '#1A202C' },
    userInfoContainer: {
        marginTop: 15,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#EEE',
    },
    userInfoText: {
        fontSize: 12,
        fontStyle: 'italic',
        color: '#6c757d',
        textAlign: 'center',
    },
    closeButton: { backgroundColor: '#d9534f', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },
    closeButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default RegistersScreen;