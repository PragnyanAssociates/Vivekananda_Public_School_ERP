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

// --- THEME DEFINITIONS ---
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
    balanceCard: '#008080',
    inputBg: '#F8F9FA',
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
    balanceCard: '#004D40', // Darker Teal
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

const TransactionsScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    
    // Theme Hook
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

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
            const htmlContent = `<h1>Voucher #${details.voucher_no}</h1>`; // Placeholder for PDF logic
            const options = { html: htmlContent, fileName: `Voucher-${details.voucher_no}`, directory: 'Download' };
            const file = await RNHTMLtoPDF.convert(options);
            Alert.alert("Success", `PDF saved to: ${file.filePath}`);
        } catch (error) {
            Alert.alert("Error", "Failed to download voucher.");
        }
    };
    
    // --- MENU HANDLER ---
    const handleMenuPress = (item) => {
        Alert.alert(
            "Manage Transaction",
            `Options for #${item.voucher_no}`,
            [
                { text: "View Details", onPress: () => viewVoucherDetails(item.id) },
                { text: "Download PDF", onPress: () => downloadVoucher(item.id) },
                { text: "Cancel", style: "cancel" }
            ],
            { cancelable: true }
        );
    };

    const renderTransactionItem = ({ item, index }) => {
        let amountStyle, amountPrefix;
        switch (item.voucher_type) {
            case 'Debit': amountStyle = { color: COLORS.danger }; amountPrefix = '- '; break;
            case 'Credit': amountStyle = { color: COLORS.success }; amountPrefix = '+ '; break;
            default: amountStyle = { color: COLORS.textMain }; amountPrefix = ''; break;
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

    const ListHeader = () => (
        <>
            <View style={[styles.balanceCard, { backgroundColor: COLORS.balanceCard }]}>
                <Text style={styles.balanceLabel}>TOTAL ACCOUNT BALANCE</Text>
                <Text style={styles.balanceAmount}>₹{formatCurrency(summaryData.total_balance)}</Text>
            </View>

            <View style={styles.subBalanceContainer}>
                <View style={[styles.subBalanceBox, { backgroundColor: COLORS.cardBg }]}>
                    <Text style={[styles.subBalanceLabel, { color: COLORS.textSub }]}>Opening Balance</Text>
                    <Text style={[styles.subBalanceAmount, { color: COLORS.textMain }]}>₹{formatCurrency(summaryData.opening_balance)}</Text>
                </View>
                <View style={[styles.subBalanceBox, { backgroundColor: COLORS.cardBg }]}>
                    <Text style={[styles.subBalanceLabel, { color: COLORS.textSub }]}>Cash Balance</Text>
                    <Text style={[styles.subBalanceAmount, { color: COLORS.textMain }]}>₹{formatCurrency(summaryData.cash_balance)}</Text>
                </View>
            </View>

            <View style={[styles.filterCard, { backgroundColor: COLORS.cardBg }]}>
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
                    <TouchableOpacity style={[styles.goButton, { backgroundColor: COLORS.success }]} onPress={fetchTransactionData}>
                        <Text style={styles.goButtonText}>Go</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {!isLoading && (
                <View style={styles.summaryContainer}>
                    <View style={[styles.summaryBox, { backgroundColor: COLORS.cardBg, borderColor: COLORS.success }]}>
                        <Text style={[styles.summaryLabel, { color: COLORS.textSub }]}>Credit</Text>
                        <Text style={[styles.summaryAmount, { color: COLORS.success }]}>+ ₹{formatCurrency(summaryData.period_summary.credit)}</Text>
                    </View>
                    <View style={[styles.summaryBox, { backgroundColor: COLORS.cardBg, borderColor: COLORS.danger }]}>
                        <Text style={[styles.summaryLabel, { color: COLORS.textSub }]}>Debit</Text>
                        <Text style={[styles.summaryAmount, { color: COLORS.danger }]}>- ₹{formatCurrency(summaryData.period_summary.debit)}</Text>
                    </View>
                </View>
            )}

            <View style={styles.historyContainer}>
                <Text style={[styles.historyTitle, { color: COLORS.textMain }]}>Transaction History</Text>
                <View style={[styles.tableHeader, { backgroundColor: COLORS.inputBg, borderBottomColor: COLORS.border }]}>
                    <Text style={[styles.headerText, { width: 40, color: COLORS.textSub }]}>S.NO</Text>
                    <Text style={[styles.headerText, { width: 85, color: COLORS.textSub }]}>VCH NO</Text>
                    <Text style={[styles.headerText, { flex: 1, color: COLORS.textSub }]}>HEAD</Text>
                    <Text style={[styles.headerText, { width: 90, textAlign: 'right', color: COLORS.textSub }]}>AMOUNT</Text>
                    <Text style={[styles.headerText, { width: 50, textAlign: 'center', color: COLORS.textSub }]}>ACT</Text>
                </View>
            </View>
        </>
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
                        <MaterialCommunityIcons name="bank-transfer" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Transactions</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Financial Overview</Text>
                    </View>
                </View>
            </View>

            <View style={styles.listContainer}>
                {isLoading ? (
                    <ActivityIndicator size="large" color={COLORS.primary} style={{flex: 1, justifyContent: 'center'}}/>
                ) : (
                    <FlatList
                        ListHeaderComponent={ListHeader}
                        data={transactions}
                        renderItem={renderTransactionItem}
                        keyExtractor={item => item.id.toString()}
                        ListEmptyComponent={
                            <View style={[styles.emptyContainer, { backgroundColor: COLORS.cardBg }]}>
                                <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No transactions found for this period.</Text>
                            </View>
                        }
                        contentContainerStyle={styles.scrollContent}
                    />
                )}
            </View>

            <DateTimePickerModal isVisible={isDatePickerVisible} mode="date" onConfirm={handleConfirmDate} onCancel={hideDatePicker} />
            
            {/* Detail Modal */}
            {selectedVoucher && (
                 <Modal animationType="slide" transparent={true} visible={isDetailModalVisible} onRequestClose={() => setDetailModalVisible(false)}>
                      <View style={[styles.modalContainer, { backgroundColor: COLORS.modalOverlay }]}>
                          <View style={[styles.modalContent, { backgroundColor: COLORS.cardBg }]}>
                            <Text style={[styles.modalTitle, { color: COLORS.textMain }]}>{selectedVoucher.voucher_type} Voucher</Text>
                            <Text style={[styles.modalVoucherNo, { color: COLORS.textSub }]}>{selectedVoucher.voucher_no}</Text>
                            <ScrollView>
                                <Text style={[styles.detailRow, { color: COLORS.textMain }]}><Text style={[styles.detailLabel, { color: COLORS.textSub }]}>Date:</Text> {new Date(selectedVoucher.voucher_date).toLocaleDateString('en-GB')}</Text>
                                <Text style={[styles.detailRow, { color: COLORS.textMain }]}><Text style={[styles.detailLabel, { color: COLORS.textSub }]}>Head:</Text> {selectedVoucher.head_of_account}</Text>
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

    listContainer: { flex: 1 },
    scrollContent: { padding: 10, paddingBottom: 20 },
    
    // Balance Cards
    balanceCard: { borderRadius: 12, padding: 20, alignItems: 'center', elevation: 4, marginBottom: 10, marginHorizontal: 2 },
    balanceLabel: { color: '#E0F2F1', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
    balanceAmount: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginTop: 5 },
    
    subBalanceContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, gap: 10, marginHorizontal: 2 },
    subBalanceBox: { flex: 1, borderRadius: 10, padding: 15, alignItems: 'center', elevation: 2 },
    subBalanceLabel: { fontSize: 12, fontWeight: '600' },
    subBalanceAmount: { fontSize: 15, fontWeight: 'bold', marginTop: 5 },
    
    // Filters
    filterCard: { marginVertical: 5, borderRadius: 12, padding: 15, elevation: 3, marginHorizontal: 2 },
    segmentControl: { flexDirection: 'row', borderRadius: 8, marginBottom: 12 },
    segmentButton: { flex: 1, paddingVertical: 10, borderRadius: 7 },
    segmentText: { textAlign: 'center', fontWeight: '600', fontSize: 13 },
    
    dateRangeContainer: { flexDirection: 'row', alignItems: 'center' },
    dateButton: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, marginRight: 10 },
    dateText: { marginLeft: 8, fontSize: 12 },
    goButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
    goButtonText: { color: '#FFF', fontWeight: 'bold' },
    
    // Summary
    summaryContainer: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 15, gap: 10, marginHorizontal: 2 },
    summaryBox: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center', elevation: 2, borderLeftWidth: 4 },
    summaryLabel: { fontSize: 13, fontWeight: '500' },
    summaryAmount: { fontSize: 16, fontWeight: 'bold', marginTop: 4 },
    
    // History Table
    historyContainer: { marginTop: 10 },
    historyTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, paddingHorizontal: 5 },
    tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingHorizontal: 5 },
    headerText: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', paddingVertical: 12, paddingHorizontal: 5 },
    
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, alignItems: 'center', paddingHorizontal: 5 },
    snoCell: { width: 40, paddingVertical: 10, textAlign: 'center', fontSize: 12 },
    vchCell: { width: 85, paddingVertical: 10, fontWeight: '500', fontSize: 12 },
    headCell: { flex: 1, paddingVertical: 10, fontSize: 13 },
    amountCell: { width: 90, paddingVertical: 10, fontWeight: 'bold', fontSize: 13, textAlign: 'right' },
    actionCell: { width: 50, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
    
    menuButton: { padding: 5 },
    
    emptyContainer: { alignItems: 'center', padding: 20, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
    emptyText: { fontSize: 14 },

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
    closeButton: { padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },
    closeButtonText: { color: 'white', fontWeight: 'bold' },
});

export default TransactionsScreen;