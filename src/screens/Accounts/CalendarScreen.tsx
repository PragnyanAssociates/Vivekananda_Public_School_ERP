import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal, // ★★★ 1. IMPORT MODAL
    ScrollView, // ★★★ 2. IMPORT SCROLLVIEW
    Linking, // ★★★ 3. IMPORT LINKING
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/client';

// Define the structure for a voucher item
interface Voucher {
    id: number;
    voucher_no: string;
    head_of_account: string;
    total_amount: number;
    voucher_type: 'Debit' | 'Credit' | 'Deposit';
}

const CalendarScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // ★★★ 4. ADD STATE FOR MODAL AND SELECTED VOUCHER (Copied from RegistersScreen) ★★★
    const [selectedVoucher, setSelectedVoucher] = useState(null);
    const [isDetailModalVisible, setDetailModalVisible] = useState(false);

    // Fetch vouchers for the currently selected date
    const fetchVouchersForDate = useCallback(async (date: string) => {
        setIsLoading(true);
        try {
            // NOTE: The backend '/vouchers/list' endpoint MUST return 'voucher_type' for this to work.
            const response = await apiClient.get(`/vouchers/list?date=${date}`);
            setVouchers(response.data);
        } catch (error) {
            console.error("Error fetching vouchers for the selected date:", error);
            Alert.alert("Error", "Could not fetch voucher data for this date.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isFocused) {
            fetchVouchersForDate(selectedDate);
        }
    }, [isFocused, selectedDate, fetchVouchersForDate]);

    // ★★★ 5. ADD VOUCHER DETAIL FETCHING AND PROOF HANDLING (Copied from RegistersScreen) ★★★
    const viewVoucherDetails = async (voucherId) => {
        try {
            const response = await apiClient.get(`/vouchers/details/${voucherId}`);
            setSelectedVoucher(response.data);
            setDetailModalVisible(true);
        } catch (error) {
            Alert.alert("Error", "Could not fetch voucher details.");
        }
    };
    
    const handleViewProof = (attachmentUrl) => {
        if (!attachmentUrl) return;
        const baseUrl = apiClient.defaults.baseURL.replace('/api', '');
        const fullUrl = `${baseUrl}${attachmentUrl}`;
        Linking.openURL(fullUrl).catch(() => Alert.alert("Error", `Cannot open this URL: ${fullUrl}`));
    };


    const handleDayPress = (day: { dateString: string }) => {
        setSelectedDate(day.dateString);
    };

    const changeMonth = (monthOffset: number) => {
        const newDate = new Date(currentMonth);
        newDate.setMonth(newDate.getMonth() + monthOffset);
        setCurrentMonth(newDate);
    };
    
    const markedDates = useMemo(() => ({
        [selectedDate]: {
            selected: true,
            disableTouchEvent: true,
            customStyles: {
                container: { backgroundColor: '#007AFF', borderRadius: 20 },
                text: { color: 'white', fontWeight: 'bold' },
            },
        },
    }), [selectedDate]);
    
    // Renders each row in the voucher list
    const renderVoucherItem = ({ item, index }: { item: Voucher, index: number }) => {
        let amountStyle, amountPrefix;

        // ★★★ 6. FINAL FIX FOR AMOUNT SIGNS (Copied from RegistersScreen logic) ★★★
        switch (item.voucher_type) {
            case 'Debit':
                amountStyle = styles.amountDebit;
                amountPrefix = '- ';
                break;
            case 'Credit':
            case 'Deposit':
                amountStyle = styles.amountCredit;
                amountPrefix = '+ ';
                break;
            default:
                amountStyle = styles.amountDefault;
                amountPrefix = '';
                break;
        }

        return (
            <View style={styles.tableRow}>
                <Text style={[styles.cell, styles.snoCell]}>{index + 1}</Text>
                <Text style={[styles.cell, styles.vchCell]}>{item.voucher_no}</Text>
                <Text style={[styles.cell, styles.headCell]} numberOfLines={1}>{item.head_of_account}</Text>
                <Text style={[styles.cell, styles.amountCell, amountStyle]}>
                    {`${amountPrefix}₹${parseFloat(item.total_amount).toFixed(2)}`}
                </Text>
                {/* Updated to open the modal */}
                <TouchableOpacity style={[styles.cell, styles.actionCell]} onPress={() => viewVoucherDetails(item.id)}>
                    <MaterialIcons name="visibility" size={22} color="#007AFF" />
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Calendar</Text>
            </View>

            <View style={styles.card}>
                <View style={styles.calendarHeader}>
                    <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.arrow}>
                        <MaterialIcons name="chevron-left" size={28} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.monthTitle}>
                        {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </Text>
                    <TouchableOpacity onPress={() => changeMonth(1)} style={styles.arrow}>
                        <MaterialIcons name="chevron-right" size={28} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                <Calendar
                    key={currentMonth.toISOString()}
                    current={currentMonth.toISOString().split('T')[0]}
                    onDayPress={handleDayPress}
                    markingType={'custom'}
                    markedDates={markedDates}
                    hideArrows={true}
                    onMonthChange={(month) => setCurrentMonth(new Date(month.dateString))}
                    theme={{
                        calendarBackground: '#FFFFFF', textSectionTitleColor: '#757575',
                        todayTextColor: '#D9534F', dayTextColor: '#222222', textDisabledColor: '#D3D3D3',
                        monthTextColor: 'transparent', textDayFontWeight: '500',
                        textDayHeaderFontWeight: '600', textDayFontSize: 15, textDayHeaderFontSize: 13,
                    }}
                />
            </View>

            <View style={[styles.card, styles.tableContainer]}>
                <Text style={styles.tableTitle}>
                    Entries for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
                {isLoading ? (
                    <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }}/>
                ) : vouchers.length > 0 ? (
                    <>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.headerText, styles.snoCell]}>S.No</Text>
                            <Text style={[styles.headerText, styles.vchCell]}>VCH No</Text>
                            <Text style={[styles.headerText, styles.headCell]}>Head</Text>
                            <Text style={[styles.headerText, styles.amountCell]}>Amount</Text>
                            <Text style={[styles.headerText, styles.actionCell]}>View</Text>
                        </View>
                        <FlatList data={vouchers} renderItem={renderVoucherItem} keyExtractor={(item) => item.id.toString()} />
                    </>
                ) : (
                    <View style={styles.emptyContainer}><Text style={styles.emptyText}>No entries found for this date.</Text></View>
                )}
            </View>
            
            {/* ★★★ 7. ADD THE MODAL COMPONENT (Copied from RegistersScreen) ★★★ */}
            {selectedVoucher && (
                 <Modal animationType="slide" transparent={true} visible={isDetailModalVisible} onRequestClose={() => setDetailModalVisible(false)}>
                     <View style={styles.modalContainer}>
                         <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>{selectedVoucher.voucher_type} Voucher</Text>
                            <Text style={styles.modalVoucherNo}>{selectedVoucher.voucher_no}</Text>
                            <ScrollView>
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Date:</Text> {new Date(selectedVoucher.voucher_date).toLocaleDateString('en-GB')}</Text>
                                {selectedVoucher.name && <Text style={styles.detailRow}><Text style={styles.detailLabel}>Name:</Text> {selectedVoucher.name}</Text>}
                                {selectedVoucher.phone_no && <Text style={styles.detailRow}><Text style={styles.detailLabel}>Phone No:</Text> {selectedVoucher.phone_no}</Text>}
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Head of A/C:</Text> {selectedVoucher.head_of_account}</Text>
                                {selectedVoucher.sub_head && <Text style={styles.detailRow}><Text style={styles.detailLabel}>Sub Head:</Text> {selectedVoucher.sub_head}</Text>}
                                <Text style={styles.detailRow}><Text style={styles.detailLabel}>Account Type:</Text> {selectedVoucher.account_type}</Text>
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

// ★★★ 8. ADDED ALL STYLES FOR CONSISTENCY ★★★
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F4F8' },
    header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#CFD8DC' },
    backButton: { padding: 5, marginRight: 15 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#263238' },
    card: { backgroundColor: '#FFFFFF', borderRadius: 12, marginHorizontal: 10, marginTop: 15, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6 },
    calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 10, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
    monthTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    arrow: { padding: 5 },
    tableContainer: { flex: 1, marginBottom: 10, padding: 15 },
    tableTitle: { fontSize: 16, fontWeight: 'bold', color: '#263238', marginBottom: 12 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderBottomWidth: 2, borderBottomColor: '#E0E0E0', paddingVertical: 10 },
    headerText: { fontSize: 12, fontWeight: 'bold', color: '#546E7A', textAlign: 'center' },
    tableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#ECEFF1', paddingVertical: 12 },
    cell: { fontSize: 14, textAlign: 'center' },
    snoCell: { width: '10%', color: '#546E7A' },
    vchCell: { width: '25%', color: '#37474F', fontWeight: '500' },
    headCell: { flex: 1, textAlign: 'left', paddingHorizontal: 5, color: '#37474F' },
    amountCell: { width: '28%', fontWeight: 'bold', textAlign: 'right', paddingRight: 5 },
    actionCell: { width: '12%' },
    amountDebit: { color: '#d9534f' },
    amountCredit: { color: '#5cb85c' },
    amountDefault: { color: '#37474F' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 16, color: '#78909C' },

    // Modal Styles (Copied from RegistersScreen)
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

export default CalendarScreen;