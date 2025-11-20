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

// --- Helper: Format Currency ---
const formatCurrency = (amount) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
};

const TransactionsScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    const [summaryData, setSummaryData] = useState({
        total_balance: 0,
        opening_balance: 0,
        cash_balance: 0,
        period_summary: { credit: 0, debit: 0 }
    });
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activePeriod, setActivePeriod] = useState('overall');
    const [dateRange, setDateRange] = useState({ start: null, end: null });
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [datePickerMode, setDatePickerMode] = useState('start');
    const [selectedVoucher, setSelectedVoucher] = useState(null);
    const [isDetailModalVisible, setDetailModalVisible] = useState(false);

    const fetchTransactionData = useCallback(async () => {
        setIsLoading(true);
        let queryString = '/transactions/summary?';

        if (activePeriod === 'custom' && dateRange.start && dateRange.end) {
            queryString += `startDate=${dateRange.start}&endDate=${dateRange.end}`;
        } else if (activePeriod !== 'overall') {
            queryString += `period=${activePeriod}`;
        }
        
        try {
            const response = await apiClient.get(queryString);
            setSummaryData({
                total_balance: response.data.total_balance,
                opening_balance: response.data.opening_balance,
                cash_balance: response.data.cash_balance,
                period_summary: response.data.period_summary
            });
            setTransactions(response.data.transactions);
        } catch (error) {
            console.error("Error fetching transaction data:", error);
            Alert.alert("Error", "Could not fetch transaction data.");
        } finally {
            setIsLoading(false);
        }
    }, [activePeriod, dateRange]);

    useEffect(() => {
        if (isFocused) {
            fetchTransactionData();
        }
    }, [isFocused, fetchTransactionData]);

    const handlePeriodChange = (period) => {
        setActivePeriod(period);
        if (period !== 'custom') {
            setDateRange({ start: null, end: null });
        }
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
    
    const requestStoragePermission = async () => {
        if (Platform.OS !== 'android' || Platform.Version >= 33) return true;
        try {
            const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            return false;
        }
    };

    const downloadVoucher = async (voucherId) => {
        if (!(await requestStoragePermission())) {
            Alert.alert("Permission Denied", "Storage permission is required to download files.");
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
                const { statusCode } = await RNFS.downloadFile({ fromUrl: fullImageUrl, toFile: tempImagePath }).promise;
                if (statusCode === 200) {
                    imageHtml = `<div class="section-title">Proof Attachment</div><div class="image-container"><img src="file://${tempImagePath}" alt="Proof Attachment" /></div>`;
                }
            }
            // Format amounts in PDF
            const particularsHtml = details.particulars.map(p => `<tr><td>${p.description}</td><td class="align-right">₹${formatCurrency(p.amount)}</td></tr>`).join('');
            const htmlContent = `<!DOCTYPE html><html><head><style>body{font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#333}.voucher-box{max-width:800px;margin:auto;padding:25px;border:1px solid #eee;box-shadow:0 0 10px rgba(0,0,0,.15)}.header{text-align:center;margin-bottom:15px}.school-name{font-size:22px;font-weight:700}.voucher-title{font-size:18px;font-weight:700;text-transform:uppercase;margin:15px 0;border-top:1px solid #eee;border-bottom:1px solid #eee;padding:8px 0}.details-table{width:100%;margin-bottom:20px}.details-table .label{font-weight:700;width:110px}.particulars-table{width:100%;border-collapse:collapse;margin-bottom:15px}.particulars-table th,.particulars-table td{border-bottom:1px solid #eee;padding:6px}.total-row td{border-top:2px solid #333;font-weight:700}.align-right{text-align:right}.footer{margin-top:20px;padding-top:8px;border-top:1px solid #eee;font-size:9px;color:#777;text-align:center}</style></head><body><div class="voucher-box"><div class="header"><div class="school-name">Vivekananda Public School</div><div class="voucher-title">${details.voucher_type} Voucher</div></div><table class="details-table"><tr><td class="label">Voucher #:</td><td>${details.voucher_no}</td></tr><tr><td class="label">Date:</td><td>${new Date(details.voucher_date).toLocaleDateString('en-GB')}</td></tr><tr><td class="label">Head of A/C:</td><td>${details.head_of_account}</td></tr></table><table class="particulars-table"><thead><tr><th>Description</th><th class="align-right">Amount</th></tr></thead><tbody>${particularsHtml}<tr class="total-row"><td><strong>Total:</strong></td><td class="align-right"><strong>₹${formatCurrency(details.total_amount)}</strong></td></tr></tbody></table><div class="in-words"><strong>In Words:</strong> ${details.amount_in_words}</div>${imageHtml}<div class="footer">Created by: ${details.creator_name||'N/A'}</div></div></body></html>`;
            const options = { html: htmlContent, fileName: `Voucher-${details.voucher_no}`, directory: 'Download' };
            const file = await RNHTMLtoPDF.convert(options);
            Alert.alert("Success", `PDF saved to your Downloads folder: ${file.filePath}`);
        } catch (error) {
            console.log(error);
            Alert.alert("Error", "Failed to download voucher.");
        }
    };
    
    const renderTransactionItem = ({ item, index }) => {
        let amountStyle, amountPrefix;
        switch (item.voucher_type) {
            case 'Debit': amountStyle = styles.amountDebit; amountPrefix = '- '; break;
            case 'Credit': amountStyle = styles.amountCredit; amountPrefix = '+ '; break;
            default: amountStyle = styles.amountDefault; amountPrefix = ''; break;
        }
        return (
            <View style={styles.tableRow}>
                <Text style={styles.snoCell}>{index + 1}</Text>
                <Text style={styles.vchCell}>{item.voucher_no}</Text>
                <Text style={styles.headCell} numberOfLines={1}>{item.head_of_account}</Text>
                <Text style={[styles.amountCell, amountStyle]}>{`${amountPrefix}₹${formatCurrency(item.total_amount)}`}</Text>
                <View style={styles.actionCell}>
                    <TouchableOpacity onPress={() => viewVoucherDetails(item.id)}><MaterialIcons name="visibility" size={22} color="#3498db" /></TouchableOpacity>
                    <TouchableOpacity onPress={() => downloadVoucher(item.id)}><MaterialIcons name="download" size={22} color="#27ae60" /></TouchableOpacity>
                </View>
            </View>
        );
    };

    const ListHeader = () => (
        <>
            <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>TOTAL ACCOUNT BALANCE</Text>
                <Text style={styles.balanceAmount}>₹{formatCurrency(summaryData.total_balance)}</Text>
            </View>

            <View style={styles.subBalanceContainer}>
                <View style={styles.subBalanceBox}>
                    <Text style={styles.subBalanceLabel}>Opening Balance</Text>
                    <Text style={styles.subBalanceAmount}>₹{formatCurrency(summaryData.opening_balance)}</Text>
                </View>
                <View style={styles.subBalanceBox}>
                    <Text style={styles.subBalanceLabel}>Cash Balance</Text>
                    <Text style={styles.subBalanceAmount}>₹{formatCurrency(summaryData.cash_balance)}</Text>
                </View>
            </View>

            <View style={styles.filterCard}>
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
                    <TouchableOpacity style={styles.goButton} onPress={fetchTransactionData}>
                        <Text style={styles.goButtonText}>Go</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {isLoading ? <ActivityIndicator size="large" color="#007AFF" style={{marginVertical: 20}} /> : (
                <View style={styles.summaryContainer}>
                    <View style={[styles.summaryBox, { borderColor: '#5cb85c' }]}>
                        <Text style={styles.summaryLabel}>Credit</Text>
                        <Text style={[styles.summaryAmount, styles.amountCredit]}>+ ₹{formatCurrency(summaryData.period_summary.credit)}</Text>
                    </View>
                    <View style={[styles.summaryBox, { borderColor: '#d9534f' }]}>
                        <Text style={styles.summaryLabel}>Debit</Text>
                        <Text style={[styles.summaryAmount, styles.amountDebit]}>- ₹{formatCurrency(summaryData.period_summary.debit)}</Text>
                    </View>
                </View>
            )}

            <View style={styles.historyContainer}>
                <Text style={styles.historyTitle}>Transaction History</Text>
                <View style={styles.tableHeader}>
                    <Text style={[styles.headerText, { width: 40 }]}>S.NO</Text>
                    <Text style={[styles.headerText, { width: 100 }]}>VCH NO</Text>
                    <Text style={[styles.headerText, { flex: 1 }]}>HEAD</Text>
                    <Text style={[styles.headerText, { width: 110, textAlign: 'right' }]}>AMOUNT</Text>
                    <Text style={[styles.headerText, { width: 70, textAlign: 'center' }]}>ACTIONS</Text>
                </View>
            </View>
        </>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><MaterialIcons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
                <Text style={styles.headerTitle}>Transactions</Text>
            </View>

            <View style={styles.listContainer}>
                {isLoading && transactions.length === 0 ? (
                    <ActivityIndicator size="large" color="#007AFF" style={{flex: 1, justifyContent: 'center'}}/>
                ) : (
                    <FlatList
                        ListHeaderComponent={ListHeader}
                        data={transactions}
                        renderItem={renderTransactionItem}
                        keyExtractor={item => item.id.toString()}
                        ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No transactions found for this period.</Text></View>}
                        contentContainerStyle={styles.scrollContent}
                    />
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
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Head of A/C:</Text> {selectedVoucher.head_of_account}</Text>
                                {selectedVoucher.sub_head && <Text style={styles.detailRow}><Text style={styles.detailLabel}>Sub Head:</Text> {selectedVoucher.sub_head}</Text>}
                                <Text style={styles.modalSectionTitle}>Particulars</Text>
                                {selectedVoucher.particulars.map((p, i) => (
                                    <View key={i} style={styles.particularRow}>
                                        <Text style={styles.particularDesc}>{p.description}</Text>
                                        <Text style={styles.particularAmt}>₹{formatCurrency(p.amount)}</Text>
                                    </View>
                                ))}
                                <View style={styles.totalRow}>
                                    <Text style={styles.totalText}>Total Amount:</Text>
                                    <Text style={styles.totalAmount}>₹{formatCurrency(selectedVoucher.total_amount)}</Text>
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
    container: { flex: 1, backgroundColor: '#F0F4F8' },
    header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#CFD8DC' },
    backButton: { padding: 5, marginRight: 15 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#263238' },
    listContainer: { flex: 1 },
    scrollContent: { padding: 10, paddingBottom: 20 },
    balanceCard: { backgroundColor: '#50b9f6ff', borderRadius: 12, padding: 20, alignItems: 'center', elevation: 4, marginBottom: 10 },
    balanceLabel: { color: '#0e0e0fff', fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
    balanceAmount: { color: '#FFFFFF', fontSize: 32, fontWeight: '700', marginTop: 5 },
    subBalanceContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, gap: 10 },
    subBalanceBox: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, padding: 15, alignItems: 'center', elevation: 2 },
    subBalanceLabel: { color: '#546E7A', fontSize: 14, fontWeight: '600' },
    subBalanceAmount: { color: '#263238', fontSize: 18, fontWeight: 'bold', marginTop: 5 },
    filterCard: { backgroundColor: '#FFFFFF', marginVertical: 5, borderRadius: 12, padding: 15, elevation: 3 },
    segmentControl: { flexDirection: 'row', backgroundColor: '#ECEFF1', borderRadius: 8, marginBottom: 12 },
    segmentButton: { flex: 1, paddingVertical: 10, borderRadius: 7 },
    segmentActive: { backgroundColor: '#007AFF' },
    segmentText: { textAlign: 'center', fontWeight: '600', color: '#37474F', fontSize: 13 },
    segmentTextActive: { color: '#FFFFFF' },
    dateRangeContainer: { flexDirection: 'row', alignItems: 'center' },
    dateButton: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECEFF1', padding: 10, borderRadius: 8, marginRight: 10 },
    dateText: { marginLeft: 8, color: '#37474F' },
    goButton: { backgroundColor: '#27ae60', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
    goButtonText: { color: '#FFF', fontWeight: 'bold' },
    summaryContainer: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 15, gap: 10 },
    summaryBox: { flex: 1, backgroundColor: '#FFF', borderRadius: 10, padding: 12, alignItems: 'center', elevation: 2, borderLeftWidth: 4 },
    summaryLabel: { fontSize: 13, color: '#546E7A', fontWeight: '500' },
    summaryAmount: { fontSize: 16, fontWeight: 'bold', marginTop: 4 },
    historyContainer: { marginTop: 10 },
    historyTitle: { fontSize: 18, fontWeight: 'bold', color: '#263238', marginBottom: 10, paddingHorizontal: 5 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 2, borderBottomColor: '#B0BEC5', borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingHorizontal: 5 },
    headerText: { fontSize: 11, fontWeight: 'bold', color: '#546E7A', textTransform: 'uppercase', paddingVertical: 12, paddingHorizontal: 5 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ECEFF1', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 5 },
    snoCell: { width: 40, paddingVertical: 10, textAlign: 'center', color: '#546E7A' },
    vchCell: { width: 100, paddingVertical: 10, color: '#37474F', fontWeight: '500' },
    headCell: { flex: 1, paddingVertical: 10, color: '#37474F' },
    amountCell: { width: 110, paddingVertical: 10, fontWeight: 'bold', fontSize: 14, textAlign: 'right' },
    actionCell: { width: 70, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 10 },
    amountDebit: { color: '#d9534f' },
    amountCredit: { color: '#5cb85c' },
    amountDefault: { color: '#37474F' },
    emptyContainer: { alignItems: 'center', padding: 20, backgroundColor: '#FFFFFF', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
    emptyText: { color: '#78909C' },
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { width: '90%', maxHeight: '80%', backgroundColor: 'white', borderRadius: 10, padding: 20 },
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
    closeButton: { backgroundColor: '#d9534f', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },
    closeButtonText: { color: 'white', fontWeight: 'bold' },
});

export default TransactionsScreen;