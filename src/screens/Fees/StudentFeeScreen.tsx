import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
    Modal, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import RazorpayCheckout from 'react-native-razorpay'; 
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface FeeSchedule {
    id: number; title: string; total_amount: number; due_date: string; allow_installments: number;
}

interface InstallmentDetail {
    id: number; installment_number: number; title?: string; amount: number; due_date: string;
    status: 'unpaid' | 'pending' | 'paid' | 'failed';
    submission_id?: number;
}

const FeeCard = ({ item, user, onPayPress }: { item: FeeSchedule, user: any, onPayPress: (fee: FeeSchedule) => void }) => {
    const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
    const [historyData, setHistoryData] = useState<InstallmentDetail[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await apiClient.get('/student/fee-details', { params: { fee_schedule_id: item.id, student_id: user?.id } });
            setHistoryData(res.data.installments);
        } catch (error) { console.error("Error fetching history", error); } 
        finally { setLoadingHistory(false); }
    };

    const handleTabChange = (tab: 'details' | 'history') => { setActiveTab(tab); if (tab === 'history') fetchHistory(); };

    const formatDate = (dateStr: string) => {
        if(!dateStr) return "-";
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    };

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'paid': return '#2ECC71';
            case 'pending': return '#F39C12';
            case 'failed': return '#E74C3C';
            default: return '#95A5A6';
        }
    };

    return (
        <View style={styles.feeCard}>
            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tabBtn, activeTab === 'details' && styles.tabBtnActive]} onPress={() => handleTabChange('details')}>
                    <Text style={[styles.tabText, activeTab === 'details' && styles.tabTextActive]}>Fee Details</Text>
                </TouchableOpacity>
                <View style={styles.tabDivider} />
                <TouchableOpacity style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]} onPress={() => handleTabChange('history')}>
                    <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>History</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'details' && (
                <View style={styles.cardContent}>
                    <View style={styles.feeHeader}>
                        <Text style={styles.feeTitle}>{item.title}</Text>
                        <Text style={styles.feeAmount}>₹{item.total_amount.toLocaleString()}</Text>
                    </View>
                    <Text style={styles.feeDate}>Due Date: {formatDate(item.due_date)}</Text>
                    {item.allow_installments === 1 && <Text style={styles.installmentText}>Installments Allowed</Text>}
                    <TouchableOpacity style={styles.payBtn} onPress={() => onPayPress(item)}>
                        <Icon name="payment" size={20} color="#FFF" style={{marginRight: 8}} />
                        <Text style={styles.payBtnText}>Pay Now</Text>
                    </TouchableOpacity>
                </View>
            )}

            {activeTab === 'history' && (
                <View style={styles.cardContent}>
                    {loadingHistory ? <ActivityIndicator size="small" color="#008080" style={{marginVertical: 20}} /> : (
                        <View>
                            {historyData.length === 0 ? <Text style={{textAlign:'center', color:'#999'}}>No history found.</Text> : (
                                historyData.map((inst, index) => (
                                    <View key={index} style={styles.historyRow}>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.historyLabel}>Inst. {inst.installment_number} {inst.title ? `- ${inst.title}` : ''}</Text>
                                            <Text style={styles.historyDate}>{formatDate(inst.due_date)}</Text>
                                        </View>
                                        <View style={{alignItems: 'flex-end', minWidth: 80}}>
                                            <Text style={styles.historyAmount}>₹{inst.amount.toLocaleString()}</Text>
                                            <Text style={[styles.statusBadge, { color: getStatusColor(inst.status) }]}>{inst.status.toUpperCase()}</Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

const StudentFeeScreen = () => {
    const { user } = useAuth();
    const [feeList, setFeeList] = useState<FeeSchedule[]>([]);
    const [loading, setLoading] = useState(false);
    
    const[isSubmitModalVisible, setSubmitModalVisible] = useState(false);
    const [selectedFee, setSelectedFee] = useState<FeeSchedule | null>(null);

    const [paymentMode, setPaymentMode] = useState<'one_time' | 'installment'>('one_time');
    
    const [installments, setInstallments] = useState<InstallmentDetail[]>([]);
    const [selectedInstNumber, setSelectedInstNumber] = useState<number | null>(null); 
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        if (user?.class_group) fetchMyFees(user.class_group);
    }, [user]);

    useEffect(() => {
        if (isSubmitModalVisible && selectedFee && paymentMode === 'installment') {
            fetchFeeDetailsForModal(selectedFee.id);
        }
    }, [paymentMode, isSubmitModalVisible]);

    const fetchMyFees = async (className: string) => {
        setLoading(true);
        try { const res = await apiClient.get(`/fees/list/${className}`); setFeeList(res.data); } 
        catch (error) { Alert.alert("Error", "Failed to fetch fees"); }
        finally { setLoading(false); }
    };

    const fetchFeeDetailsForModal = async (feeId: number) => {
        setLoadingDetails(true);
        try {
            const res = await apiClient.get('/student/fee-details', { params: { fee_schedule_id: feeId, student_id: user?.id } });
            setInstallments(res.data.installments);
        } catch (e) { console.error(e); }
        finally { setLoadingDetails(false); }
    };

    const openPayModal = (fee: FeeSchedule) => {
        setSelectedFee(fee);
        setPaymentMode('one_time');
        setSelectedInstNumber(null);
        setInstallments([]); 
        setSubmitModalVisible(true);
    };

    const handleProceedToPay = async () => {
        if (!selectedFee) return;
        if (paymentMode === 'installment' && selectedInstNumber === null) return Alert.alert("Required", "Please select an installment.");

        try {
            // 1. Ask Backend to Generate Razorpay Order
            const orderPayload = {
                fee_schedule_id: selectedFee.id,
                student_id: user?.id,
                payment_mode: paymentMode,
                installment_number: paymentMode === 'installment' ? selectedInstNumber : 0
            };

            const orderResponse = await apiClient.post('/fees/create-order', orderPayload);
            const { order_id, amount, key } = orderResponse.data;

            setSubmitModalVisible(false); // Close modal before opening Razorpay

            // 2. Open Razorpay Checkout SDK
            const options = {
                description: selectedFee.title,
                image: 'https://cdn.iconscout.com/icon/free/png-256/school-2358899-1971168.png',
                currency: 'INR',
                key: key, 
                amount: amount * 100, // Amount in Paise
                name: 'Your School Name',
                order_id: order_id,
                prefill: {
                    email: user?.email || 'student@school.com',
                    contact: user?.phone || '9999999999',
                    name: user?.full_name || 'Student'
                },
                theme: {color: '#008080'}
            };

            RazorpayCheckout.open(options).then(async (data: any) => {
                // 3. Success -> Verify Signature in Backend
                try {
                    await apiClient.post('/fees/verify-payment', {
                        razorpay_order_id: data.razorpay_order_id,
                        razorpay_payment_id: data.razorpay_payment_id,
                        razorpay_signature: data.razorpay_signature,
                        fee_schedule_id: selectedFee.id,
                        student_id: user?.id,
                        installment_number: paymentMode === 'installment' ? selectedInstNumber : 0
                    });
                    Alert.alert("Success", "Payment successful! Receipt generated.");
                    fetchMyFees(user?.class_group || ''); 
                } catch (verifyError) {
                    Alert.alert("Error", "Payment captured, but verification failed.");
                }
            }).catch((error: any) => {
                Alert.alert("Payment Cancelled or Failed", `Code: ${error.code} | Description: ${error.description}`);
            });

        } catch (error) { 
            Alert.alert("Error", "Failed to initiate payment gateway."); 
        }
    };

    const getOrdinal = (n: number) => {
        const s =["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    
    const formatDate = (dateStr: string) => {
        if(!dateStr) return "-";
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerCard}>
                <View style={styles.headerIconContainer}><Icon name="account-balance-wallet" size={28} color="#008080" /></View>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>My Fees</Text>
                    <Text style={styles.headerSubtitle}>Class: {user?.class_group}</Text>
                </View>
            </View>

            {loading ? <ActivityIndicator size="large" color="#008080" style={{marginTop: 50}} /> : (
                <FlatList
                    data={feeList}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => <FeeCard item={item} user={user} onPayPress={openPayModal} />}
                    contentContainerStyle={{padding: 10}}
                    ListEmptyComponent={<Text style={styles.emptyText}>No fees assigned to you yet.</Text>}
                />
            )}

            {/* PAYMENT TYPE SELECTION MODAL */}
            <Modal visible={isSubmitModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Initiate Payment</Text>
                        <View style={styles.infoBox}>
                            <Text style={styles.infoText}>Fee: {selectedFee?.title}</Text>
                            <Text style={[styles.infoText, {fontWeight: 'bold'}]}>Total: ₹{selectedFee?.total_amount.toLocaleString()}</Text>
                        </View>
                        <Text style={styles.label}>Select Payment Type:</Text>
                        <View style={styles.pickerBox}>
                            <Picker selectedValue={paymentMode} onValueChange={(v) => setPaymentMode(v)} enabled={selectedFee?.allow_installments === 1}>
                                <Picker.Item label="One Time Payment" value="one_time" />
                                {selectedFee?.allow_installments === 1 && <Picker.Item label="Installment" value="installment" />}
                            </Picker>
                        </View>
                        {paymentMode === 'installment' && (
                            <ScrollView style={styles.scrollArea}>
                                {loadingDetails ? <ActivityIndicator color="#008080" style={{marginTop: 20}} /> : (
                                    <>
                                        <Text style={styles.sectionHeader}>Select Installment to Pay:</Text>
                                        {installments.filter(i => i.status !== 'paid').map((inst, index) => {
                                            const isSelected = selectedInstNumber === inst.installment_number;
                                            return (
                                                <TouchableOpacity key={index} style={[styles.instRow, isSelected && styles.instRowSelected]} onPress={() => setSelectedInstNumber(inst.installment_number)}>
                                                    <View style={{flex: 1}}>
                                                        <Text style={styles.instTitle}>
                                                            {getOrdinal(inst.installment_number)} Installment 
                                                            {inst.title ? ` - ${inst.title}` : ''}
                                                        </Text>
                                                        <Text style={styles.instAmount}>₹{inst.amount.toLocaleString()}</Text>
                                                        <Text style={styles.instDate}>Due: {formatDate(inst.due_date)}</Text>
                                                    </View>
                                                    {isSelected ? <Icon name="radio-button-checked" size={24} color="#008080" /> : <Icon name="radio-button-unchecked" size={24} color="#777" />}
                                                </TouchableOpacity>
                                            )
                                        })}
                                    </>
                                )}
                            </ScrollView>
                        )}
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 20}}>
                            <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setSubmitModalVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, styles.submitBtn]} onPress={handleProceedToPay}>
                                <Text style={styles.submitText}>Proceed To Pay</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F5F8' },
    headerCard: { backgroundColor: '#FFF', padding: 15, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', elevation: 3 },
    headerIconContainer: { backgroundColor: '#E0F2F1', borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
    headerSubtitle: { fontSize: 13, color: '#666' },
    feeCard: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 15, elevation: 2, marginHorizontal: 10, overflow: 'hidden' },
    tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEE' },
    tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FAFAFA' },
    tabBtnActive: { backgroundColor: '#FFF', borderBottomWidth: 2, borderBottomColor: '#008080' },
    tabText: { fontSize: 14, fontWeight: '600', color: '#777' },
    tabTextActive: { color: '#008080', fontWeight: 'bold' },
    tabDivider: { width: 1, backgroundColor: '#EEE' },
    cardContent: { padding: 15 },
    feeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    feeTitle: { fontSize: 18, fontWeight: 'bold', color: '#2C3E50' },
    feeAmount: { fontSize: 18, fontWeight: 'bold', color: '#27AE60' },
    feeDate: { color: '#7F8C8D', fontSize: 13, marginBottom: 5 },
    installmentText: { color: '#2980B9', fontSize: 12, fontWeight: '500', marginBottom: 10 },
    payBtn: { backgroundColor: '#008080', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 8, marginTop: 10 },
    payBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
    historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
    historyLabel: { fontSize: 14, fontWeight: 'bold', color: '#444' },
    historyDate: { fontSize: 12, color: '#888', marginTop: 2 },
    historyAmount: { fontSize: 14, fontWeight: 'bold', color: '#333' },
    statusBadge: { fontSize: 11, fontWeight: 'bold', marginTop: 2 },
    emptyText: { textAlign: 'center', marginTop: 30, color: '#999' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#FFF', width: '90%', borderRadius: 12, padding: 20, maxHeight: '85%' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#008080', marginBottom: 15, textAlign: 'center' },
    infoBox: { backgroundColor: '#F0F2F5', padding: 10, borderRadius: 8, marginBottom: 15 },
    infoText: { fontSize: 14, color: '#333', marginBottom: 2 },
    label: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 5 },
    pickerBox: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, marginBottom: 10 },
    scrollArea: { maxHeight: 250, marginBottom: 10 },
    sectionHeader: { fontSize: 13, fontWeight: 'bold', color: '#555', marginTop: 10, marginBottom: 5 },
    instRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EEE', marginBottom: 8, backgroundColor: '#FFF' },
    instRowSelected: { borderColor: '#008080', backgroundColor: '#E0F2F1' },
    instTitle: { fontSize: 14, fontWeight: 'bold', color: '#333' },
    instAmount: { fontSize: 14, fontWeight: '600', color: '#27AE60' },
    instDate: { fontSize: 11, color: '#777' },
    modalBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
    submitBtn: { backgroundColor: '#008080', marginLeft: 5 },
    cancelBtn: { backgroundColor: '#FFF', marginRight: 5, borderWidth: 1, borderColor: '#DDD' },
    submitText: { color: '#FFF', fontWeight: 'bold' },
    cancelText: { color: '#777', fontWeight: 'bold' },
});

export default StudentFeeScreen;