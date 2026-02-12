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
    Modal,
    ScrollView,
    Linking,
    Dimensions,
    Platform,
    useColorScheme,
    StatusBar
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../../api/client';

// --- THEME COLORS ---
const LightColors = {
    primary: '#008080',    // Teal
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC', // Light Gray for separators
    iconBg: '#E0F2F1',
    detailBlockBg: '#F9FAFB',
    success: '#439da0',
    danger: '#E53935',
    blue: '#1E88E5',
    shadow: '#000',
    modalOverlay: 'rgba(0,0,0,0.5)'
};

const DarkColors = {
    primary: '#008080',    // Teal (Same for brand consistency)
    background: '#121212', 
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333', // Dark Gray for separators
    iconBg: '#2C2C2C',
    detailBlockBg: '#252525',
    success: '#66BB6A', // Slightly lighter green for dark mode
    danger: '#EF5350',  // Slightly lighter red for dark mode
    blue: '#42A5F5',
    shadow: '#000',
    modalOverlay: 'rgba(255,255,255,0.1)'
};

// --- Helper: Format Currency ---
const formatCurrency = (amount: any) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
};

// --- Helper: Get Local Date String ---
const getLocalDateString = () => {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
};

const CalendarScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    
    // --- THEME LOGIC ---
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    // Use local date to ensure current day is accurate
    const [selectedDate, setSelectedDate] = useState(getLocalDateString());
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [vouchers, setVouchers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // State for modal and selected voucher details
    const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
    const [isDetailModalVisible, setDetailModalVisible] = useState(false);

    // Fetch vouchers for the currently selected date
    const fetchVouchersForDate = useCallback(async (date: string) => {
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/vouchers/list`, {
                params: { date: date }
            });
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

    // Fetch full details for a specific voucher
    const viewVoucherDetails = async (voucherId: number) => {
        try {
            const response = await apiClient.get(`/vouchers/details/${voucherId}`);
            setSelectedVoucher(response.data);
            setDetailModalVisible(true);
        } catch (error) {
            Alert.alert("Error", "Could not fetch voucher details.");
        }
    };
    
    const handleViewProof = (attachmentUrl: string) => {
        if (!attachmentUrl) return;
        const baseUrl = apiClient.defaults.baseURL?.replace('/api', '');
        const fullUrl = `${baseUrl}${attachmentUrl}`;
        Linking.openURL(fullUrl).catch(() => Alert.alert("Error", `Cannot open this URL: ${fullUrl}`));
    };

    const handleDayPress = (day: any) => {
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
                container: { backgroundColor: COLORS.primary, borderRadius: 8 },
                text: { color: 'white', fontWeight: 'bold' },
            },
        },
    }), [selectedDate, COLORS.primary]);
    
    const renderVoucherItem = ({ item, index }: { item: any, index: number }) => {
        let amountStyle, amountPrefix;

        switch (item.voucher_type) {
            case 'Debit':
                amountStyle = { color: COLORS.danger };
                amountPrefix = '- ';
                break;
            case 'Credit':
            case 'Deposit':
                amountStyle = { color: COLORS.success };
                amountPrefix = '+ ';
                break;
            default:
                amountStyle = { color: COLORS.textMain };
                amountPrefix = '';
                break;
        }

        return (
            <TouchableOpacity 
                style={[styles.tableRow, { borderBottomColor: COLORS.border }]} 
                onPress={() => viewVoucherDetails(item.id)}
            >
                <View style={styles.rowLeft}>
                    <View style={[styles.snoBadge, { backgroundColor: isDark ? '#333' : '#F5F5F5' }]}>
                        <Text style={[styles.snoText, { color: COLORS.textSub }]}>{index + 1}</Text>
                    </View>
                    <View style={styles.rowTextContent}>
                        <Text style={[styles.vchText, { color: COLORS.textSub }]}>VCH: {item.voucher_no}</Text>
                        <Text style={[styles.headText, { color: COLORS.textMain }]} numberOfLines={1}>{item.head_of_account}</Text>
                    </View>
                </View>
                <View style={styles.rowRight}>
                    <Text style={[styles.amountText, amountStyle]}>
                        {`${amountPrefix}₹${formatCurrency(item.total_amount)}`}
                    </Text>
                    <MaterialIcons name="chevron-right" size={20} color={COLORS.border} />
                </View>
            </TouchableOpacity>
        );
    };

    // Helper component for Modal Details (Inside to access COLORS)
    const DetailItem = ({ label, value }: { label: string, value: string }) => (
        <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: COLORS.textSub }]}>{label}:</Text>
            <Text style={[styles.detailValue, { color: COLORS.textMain }]}>{value}</Text>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar 
                barStyle={isDark ? 'light-content' : 'dark-content'} 
                backgroundColor={COLORS.background} 
            />
            
            {/* --- HEADER --- */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.shadow }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>

                    <View style={[styles.headerIconContainer, { backgroundColor: COLORS.iconBg }]}>
                        <MaterialCommunityIcons name="calendar-month" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Calendar</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Daily Transactions</Text>
                    </View>
                </View>
            </View>

            <View style={styles.mainContent}>
                {/* --- CALENDAR CARD --- */}
                <View style={[styles.calendarCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.shadow }]}>
                    <View style={[styles.calendarHeaderBar, { backgroundColor: COLORS.primary }]}>
                        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.arrowButton}>
                            <MaterialIcons name="chevron-left" size={28} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.monthTitle}>
                            {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </Text>
                        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.arrowButton}>
                            <MaterialIcons name="chevron-right" size={28} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    <Calendar
                        key={currentMonth.toISOString() + (isDark ? 'dark' : 'light')}
                        current={currentMonth.toISOString().split('T')[0]}
                        onDayPress={handleDayPress}
                        markingType={'custom'}
                        markedDates={markedDates}
                        hideArrows={true}
                        onMonthChange={(month: any) => setCurrentMonth(new Date(month.dateString))}
                        theme={{
                            calendarBackground: COLORS.cardBg,
                            textSectionTitleColor: COLORS.textSub,
                            todayTextColor: COLORS.danger,
                            dayTextColor: COLORS.textMain,
                            textDisabledColor: COLORS.border,
                            monthTextColor: 'transparent', // Hidden because we use custom header
                            textDayFontWeight: '500',
                            textDayHeaderFontWeight: '600',
                            textDayFontSize: 14,
                            textDayHeaderFontSize: 12,
                        }}
                    />
                </View>

                {/* --- ENTRIES LIST CARD --- */}
                <View style={[styles.entriesCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.shadow }]}>
                    <Text style={[styles.entriesTitle, { color: COLORS.textMain, borderBottomColor: COLORS.border }]}>
                        Entries for {new Date(selectedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                    
                    {isLoading ? (
                        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }}/>
                    ) : vouchers.length > 0 ? (
                        <FlatList 
                            data={vouchers} 
                            renderItem={renderVoucherItem} 
                            keyExtractor={(item) => item.id.toString()}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{paddingBottom: 20}}
                        />
                    ) : (
                        <View style={styles.emptyContainer}>
                            <MaterialIcons name="event-busy" size={50} color={COLORS.border} />
                            <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No entries found for this date.</Text>
                        </View>
                    )}
                </View>
            </View>
            
            {/* --- MODAL FOR VOUCHER DETAILS --- */}
            {selectedVoucher && (
                 <Modal animationType="slide" transparent={true} visible={isDetailModalVisible} onRequestClose={() => setDetailModalVisible(false)}>
                     <View style={[styles.modalOverlay, { backgroundColor: COLORS.modalOverlay }]}>
                         <View style={[styles.modalContent, { backgroundColor: COLORS.cardBg }]}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: COLORS.textMain }]}>{selectedVoucher.voucher_type} Voucher</Text>
                                <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                                    <MaterialIcons name="close" size={24} color={COLORS.textSub} />
                                </TouchableOpacity>
                            </View>
                            
                            <Text style={[styles.modalVoucherNo, { color: COLORS.primary }]}>#{selectedVoucher.voucher_no}</Text>
                            
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={[styles.detailBlock, { backgroundColor: COLORS.detailBlockBg }]}>
                                    <DetailItem label="Date" value={new Date(selectedVoucher.voucher_date).toLocaleDateString('en-GB')} />
                                    {selectedVoucher.name_title && <DetailItem label="Name" value={selectedVoucher.name_title} />}
                                    {selectedVoucher.phone_no && <DetailItem label="Phone" value={selectedVoucher.phone_no} />}
                                    <DetailItem label="Head" value={selectedVoucher.head_of_account} />
                                    {selectedVoucher.sub_head && <DetailItem label="Sub Head" value={selectedVoucher.sub_head} />}
                                    <DetailItem label="Type" value={selectedVoucher.account_type} />
                                    <DetailItem label={selectedVoucher.transaction_context_type} value={selectedVoucher.transaction_context_value} />
                                </View>

                                <Text style={[styles.sectionHeader, { color: COLORS.textMain }]}>Particulars</Text>
                                {selectedVoucher.particulars.map((p: any, i: number) => (
                                    <View key={i} style={[styles.particularRow, { borderBottomColor: COLORS.border }]}>
                                        <Text style={[styles.particularDesc, { color: COLORS.textSub }]}>{p.description}</Text>
                                        <Text style={[styles.particularAmt, { color: COLORS.textMain }]}>₹{formatCurrency(p.amount)}</Text>
                                    </View>
                                ))}

                                <View style={[styles.totalRow, { borderTopColor: COLORS.border }]}>
                                    <Text style={[styles.totalText, { color: COLORS.textMain }]}>Total Amount</Text>
                                    <Text style={[styles.totalAmount, { color: COLORS.primary }]}>₹{formatCurrency(selectedVoucher.total_amount)}</Text>
                                </View>
                                
                                {selectedVoucher.attachment_url && (
                                    <TouchableOpacity style={[styles.viewProofButton, { backgroundColor: COLORS.blue }]} onPress={() => handleViewProof(selectedVoucher.attachment_url)}>
                                        <MaterialCommunityIcons name="paperclip" size={20} color="#FFF" />
                                        <Text style={styles.viewProofButtonText}>View Attachment</Text>
                                    </TouchableOpacity>
                                )}
                                
                                <View style={[styles.userInfoContainer, { borderTopColor: COLORS.border }]}>
                                    <Text style={[styles.userInfoText, { color: COLORS.textSub }]}>Created by: {selectedVoucher.creator_name || 'N/A'}</Text>
                                    {selectedVoucher.updater_name && (
                                        <Text style={[styles.userInfoText, { color: COLORS.textSub }]}>Updated: {selectedVoucher.updater_name} ({new Date(selectedVoucher.updated_at).toLocaleDateString()})</Text>
                                    )}
                                </View>
                            </ScrollView>
                         </View>
                     </View>
                 </Modal>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    
    // --- Header Style ---
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
    backButton: { marginRight: 10, padding: 4 },
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

    mainContent: { flex: 1, paddingHorizontal: 10 },

    // --- Calendar Card ---
    calendarCard: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 15,
        elevation: 3,
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    calendarHeaderBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 15,
    },
    monthTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    arrowButton: { padding: 5 },

    // --- Entries List Card ---
    entriesCard: {
        flex: 1,
        borderRadius: 12,
        padding: 15,
        marginBottom: 10,
        elevation: 3,
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    entriesTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, borderBottomWidth: 1, paddingBottom: 8 },
    
    // List Item
    tableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    snoBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10
    },
    snoText: { fontSize: 12, fontWeight: 'bold' },
    rowTextContent: { flex: 1 },
    vchText: { fontSize: 12, marginBottom: 2 },
    headText: { fontSize: 14, fontWeight: '500' },
    
    rowRight: { flexDirection: 'row', alignItems: 'center' },
    amountText: { fontSize: 14, fontWeight: 'bold', marginRight: 5 },
    
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
    emptyText: { fontSize: 15, marginTop: 10 },

    // --- Modal Styles ---
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalContent: { 
        borderTopLeftRadius: 20, 
        borderTopRightRadius: 20, 
        padding: 20, 
        maxHeight: '85%',
        elevation: 10
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    modalTitle: { fontSize: 22, fontWeight: 'bold' },
    modalVoucherNo: { fontSize: 16, fontWeight: '600', marginBottom: 20 },
    
    detailBlock: { padding: 15, borderRadius: 10, marginBottom: 15 },
    detailRow: { flexDirection: 'row', marginBottom: 8 },
    detailLabel: { width: 100, fontSize: 14, fontWeight: '600' },
    detailValue: { flex: 1, fontSize: 14 },
    
    sectionHeader: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 5 },
    particularRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
    particularDesc: { flex: 1, fontSize: 14 },
    particularAmt: { fontWeight: 'bold' },
    
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 1 },
    totalText: { fontSize: 18, fontWeight: 'bold' },
    totalAmount: { fontSize: 18, fontWeight: 'bold' },
    
    viewProofButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, marginTop: 20 },
    viewProofButtonText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },
    
    userInfoContainer: { marginTop: 20, paddingTop: 15, borderTopWidth: 1, alignItems: 'center' },
    userInfoText: { fontSize: 12, marginBottom: 4 },
});

export default CalendarScreen;