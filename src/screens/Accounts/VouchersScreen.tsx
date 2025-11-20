import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, FlatList,
    SafeAreaView, Alert, ActivityIndicator, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useIsFocused, useRoute } from '@react-navigation/native';
import apiClient from '../../api/client';

type VoucherType = 'Debit' | 'Credit';
interface ParticularRow {
    description: string;
    amount: string;
}
interface RecentVoucher {
    id: number;
    voucher_no: string;
    head_of_account: string;
    sub_head: string | null;
    account_type: string;
    total_amount: number;
}

const headOfAccountOptions = [
    'Fee', 'Salaries', 'Donations', 'Utilities/Bills', 'Transport', 'Assets',
    'Government Grants/Aids', 'Investments', 'Staff Welfare', 'Student Welfare',
    'Repairs', 'Security/CCTV', 'Kitchen', 'Maintenance',
    'Laboratories/Library', 'Miscellaneous'
];

const accountTypeOptions = ['UPI', 'Bank', 'Cheque', 'Cash', 'Kind', 'Others'];
const transactionContextOptions = ['Opening Balance', 'Cash'];

// --- Helper: Format Currency (Indian System with Commas) ---
const formatCurrency = (amount: number | string) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
};

// --- Helper: Number to Words (Indian System up to Crores) ---
const numberToWords = (num: number): string => {
    if (num === 0) return 'Zero';
    
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convert = (n: number): string => {
        if (n === 0) return '';
        if (n < 20) return units[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : '');
        if (n < 1000) return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
        if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
        if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
        // Crores
        return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
    };

    return convert(Math.floor(num)).trim();
};

const VouchersScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const route = useRoute();
    const voucherId = route.params?.voucherId;

    const [mode, setMode] = useState(voucherId ? 'edit' : 'create');
    const [isLoading, setIsLoading] = useState(!!voucherId);
    const [voucherType, setVoucherType] = useState<VoucherType>('Debit');
    const [voucherNo, setVoucherNo] = useState<string>('Loading...');
    const [voucherDate, setVoucherDate] = useState<string>(new Date().toLocaleDateString('en-GB'));
    const [nameTitle, setNameTitle] = useState('');
    const [phoneNo, setPhoneNo] = useState('');
    const [headOfAccount, setHeadOfAccount] = useState<string>('');
    const [subHead, setSubHead] = useState('');
    const [accountType, setAccountType] = useState<string>('UPI');
    const [transactionContextValue, setTransactionContextValue] = useState<string>('Opening Balance');
    const [particulars, setParticulars] = useState<ParticularRow[]>([{ description: '', amount: '' }]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [amountInWords, setAmountInWords] = useState('Zero Rupees Only');
    const [attachment, setAttachment] = useState<ImagePickerResponse | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [recentVouchers, setRecentVouchers] = useState<RecentVoucher[]>([]);
    const [isLoadingRecent, setIsLoadingRecent] = useState(false);
    
    const [existingAttachmentUrl, setExistingAttachmentUrl] = useState<string | null>(null);
    const [isAttachmentRemoved, setIsAttachmentRemoved] = useState(false);

    const fetchVoucherDetails = useCallback(async (id) => {
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/vouchers/details/${id}`);
            const data = response.data;
            setVoucherType(data.voucher_type);
            setVoucherNo(data.voucher_no);
            setVoucherDate(new Date(data.voucher_date).toLocaleDateString('en-GB'));
            setNameTitle(data.name_title || '');
            setPhoneNo(data.phone_no || '');
            setHeadOfAccount(data.head_of_account);
            setSubHead(data.sub_head || '');
            setAccountType(data.account_type);
            setTransactionContextValue(data.transaction_context_value);
            setParticulars(data.particulars.map(p => ({ description: p.description, amount: String(p.amount) })));
            setExistingAttachmentUrl(data.attachment_url);
        } catch (error) {
            console.error("Failed to fetch voucher details:", error);
            Alert.alert("Error", "Failed to load voucher details for editing.", [{ text: "OK", onPress: () => navigation.goBack() }]);
        } finally {
            setIsLoading(false);
        }
    }, [navigation]);

    const fetchNextVoucherNumber = useCallback(async () => {
        try {
            const response = await apiClient.get('/vouchers/next-number');
            setVoucherNo(response.data.nextVoucherNo);
        } catch (error) {
            console.error(error);
            setVoucherNo('VCH-Error');
            Alert.alert('Error', 'Could not fetch the next voucher number.');
        }
    }, []);

    const fetchRecentVouchers = useCallback(async () => {
        setIsLoadingRecent(true);
        try {
            const response = await apiClient.get('/vouchers/list?limit=5');
            setRecentVouchers(response.data);
        } catch (error) {
            console.error("Failed to fetch recent vouchers:", error);
        } finally {
            setIsLoadingRecent(false);
        }
    }, []);

    const initializeCreateMode = useCallback(() => {
        setMode('create');
        setVoucherType('Debit');
        setVoucherDate(new Date().toLocaleDateString('en-GB'));
        setNameTitle('');
        setPhoneNo('');
        setHeadOfAccount('');
        setSubHead('');
        setAccountType('UPI');
        setTransactionContextValue('Opening Balance');
        setParticulars([{ description: '', amount: '' }]);
        setAttachment(null);
        setExistingAttachmentUrl(null);
        setIsAttachmentRemoved(false);
        fetchNextVoucherNumber();
        fetchRecentVouchers();
    }, [fetchNextVoucherNumber, fetchRecentVouchers]);

    useEffect(() => {
        if (isFocused) {
            const currentVoucherId = route.params?.voucherId;
            if (currentVoucherId) {
                setMode('edit');
                fetchVoucherDetails(currentVoucherId);
            } else {
                initializeCreateMode();
            }
        }
    }, [isFocused, route.params?.voucherId, fetchVoucherDetails, initializeCreateMode]);

    useEffect(() => {
        const total = particulars.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        setTotalAmount(total);
    }, [particulars]);

    useEffect(() => {
        setAmountInWords(`${numberToWords(totalAmount)} Rupees Only`);
    }, [totalAmount]);

    const handleAddRow = () => setParticulars([...particulars, { description: '', amount: '' }]);
    const handleRemoveRow = (index: number) => { if (particulars.length > 1) setParticulars(particulars.filter((_, i) => i !== index)); };
    const handleParticularChange = (index: number, field: keyof ParticularRow, value: string) => {
        const newParticulars = [...particulars];
        newParticulars[index][field] = value;
        setParticulars(newParticulars);
    };

    const handleChooseFile = () => {
        launchImageLibrary({ mediaType: 'photo' }, (response) => {
            if (response.didCancel || response.errorCode) return;
            setAttachment(response);
            setExistingAttachmentUrl(null); 
            setIsAttachmentRemoved(false);
        });
    };

    const handleRemoveExistingAttachment = () => {
        setExistingAttachmentUrl(null);
        setIsAttachmentRemoved(true);
    };
    
    const handleCancel = () => Alert.alert("Confirm Cancel", "Are you sure you want to clear the form?", [{ text: "No", style: "cancel" }, { text: "Yes", style: "destructive", onPress: initializeCreateMode }]);

    const handleSave = async () => {
        const validParticulars = particulars.filter(p => p.description.trim() !== '' && !isNaN(parseFloat(p.amount)) && parseFloat(p.amount) > 0);
        if (!headOfAccount) return Alert.alert('Validation Error', 'Please select a "Head of A/C".');
        if (!transactionContextValue) return Alert.alert('Validation Error', 'Please select a source/destination for the transaction.');
        if (validParticulars.length === 0 && totalAmount !== 0) return Alert.alert('Validation Error', 'Please add at least one valid particular if the amount is not zero.');

        setIsSaving(true);
        const formData = new FormData();
        formData.append('voucherType', voucherType);
        formData.append('name_title', nameTitle);
        formData.append('phoneNo', phoneNo);
        formData.append('headOfAccount', headOfAccount);
        formData.append('subHead', subHead);
        formData.append('accountType', accountType);
        formData.append('transaction_context_type', voucherType === 'Debit' ? 'Deduction From' : 'Adding to');
        formData.append('transaction_context_value', transactionContextValue);
        formData.append('totalAmount', totalAmount.toFixed(2));
        formData.append('amountInWords', amountInWords);
        formData.append('particulars', JSON.stringify(validParticulars));

        const dateParts = voucherDate.split('/');
        const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        formData.append('voucherDate', isoDate);
        
        if (mode === 'create') {
            formData.append('voucherNo', voucherNo);
        }

        if (attachment?.assets?.[0]) {
            formData.append('attachment', { uri: Platform.OS === 'android' ? attachment.assets[0].uri : attachment.assets[0].uri!.replace('file://', ''), type: attachment.assets[0].type, name: attachment.assets[0].fileName });
        }

        if (isAttachmentRemoved) {
            formData.append('removeAttachment', 'true');
        }

        try {
            let response;
            if (mode === 'edit') {
                response = await apiClient.put(`/vouchers/update/${voucherId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                Alert.alert('Success', response.data.message || 'Voucher updated successfully!', [{ text: 'OK', onPress: () => navigation.navigate('RegistersScreen') }]);
            } else {
                response = await apiClient.post('/vouchers/create', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                Alert.alert('Success', response.data.message, [{ text: 'OK', onPress: initializeCreateMode }]);
            }
        } catch (error: any) {
            console.error("Save error response:", error.response?.data);
            const errorMessage = error.response?.data?.message || 'An error occurred while saving.';
            Alert.alert('Error', errorMessage);
        } finally {
            setIsSaving(false);
        }
    };
    
    const getFilenameFromUrl = (url: string | null) => {
        if (!url) return 'Upload Proof';
        return url.split('/').pop();
    };

    const renderRecentVoucherItem = ({ item, index }: { item: RecentVoucher, index: number }) => (
        <View style={styles.recentVoucherRow}>
            <Text style={styles.recentVoucherCellSNo}>{index + 1}</Text>
            <Text style={styles.recentVoucherCell}>{item.voucher_no}</Text>
            <Text style={styles.recentVoucherCell} numberOfLines={1}>{item.head_of_account}</Text>
            <Text style={styles.recentVoucherCellAmount}>₹{formatCurrency(item.total_amount)}</Text>
        </View>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><MaterialIcons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
                    <Text style={styles.headerTitle}>Loading Voucher...</Text>
                </View>
                <ActivityIndicator size="large" color="#0275d8" style={{ flex: 1, justifyContent: 'center' }} />
            </SafeAreaView>
        );
    }

    let uploadButtonText = 'Upload Proof';
    if (attachment?.assets?.[0]?.fileName) {
        uploadButtonText = attachment.assets[0].fileName;
    } else if (existingAttachmentUrl) {
        uploadButtonText = getFilenameFromUrl(existingAttachmentUrl);
    }

    const transactionContextLabel = voucherType === 'Debit' ? 'Deduction From*:' : 'Adding to*:';

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><MaterialIcons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
                <Text style={styles.headerTitle}>{mode === 'edit' ? `Edit Voucher (${voucherNo})` : 'Create Voucher'}</Text>
            </View>
            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
                <View style={styles.tabContainer}>
                    {(['Debit', 'Credit'] as VoucherType[]).map(type => (
                        <TouchableOpacity key={type} style={styles.tab} onPress={() => setVoucherType(type)}>
                            <Text style={[styles.tabText, voucherType === type && styles.activeTabText]}>{type}</Text>
                            {voucherType === type && <View style={styles.activeTabIndicator} />}
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.voucherCard}>
                    <Text style={styles.schoolTitle}>Vivekananda Public School</Text>
                    <Text style={styles.managedBy}>Managed By Vivekananda Education Center</Text>
                    <Text style={styles.voucherTitle}>{voucherType} Voucher</Text>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoText}>No: {voucherNo}</Text>
                        <Text style={styles.infoText}>Date: {voucherDate}</Text>
                    </View>

                    <View style={styles.formRow}>
                        <Text style={styles.label}>{transactionContextLabel}</Text>
                        <View style={styles.pickerWrapper}>
                            <Picker selectedValue={transactionContextValue} onValueChange={(itemValue) => setTransactionContextValue(itemValue)}>
                                {transactionContextOptions.map(opt => <Picker.Item key={opt} label={opt} value={opt} />)}
                            </Picker>
                        </View>
                    </View>
                    
                    <View style={styles.formRow}>
                        <Text style={styles.label}>Name/Title:</Text>
                        <TextInput style={styles.input} value={nameTitle} onChangeText={setNameTitle} />
                    </View>

                    <View style={styles.formRow}>
                        <Text style={styles.label}>Phone No:</Text>
                        <TextInput style={styles.input} value={phoneNo} onChangeText={setPhoneNo} keyboardType="phone-pad"/>
                    </View>
                    
                    <View style={styles.formRow}>
                        <Text style={styles.label}>Head of A/C*:</Text>
                        <View style={styles.pickerWrapper}>
                            <Picker selectedValue={headOfAccount} onValueChange={(itemValue) => setHeadOfAccount(itemValue)}>
                                <Picker.Item label="Select Head of A/C" value="" />
                                {headOfAccountOptions.map(opt => <Picker.Item key={opt} label={opt} value={opt} />)}
                            </Picker>
                        </View>
                    </View>

                    <View style={styles.formRow}>
                        <Text style={styles.label}>Sub Head:</Text>
                        <TextInput style={styles.input} value={subHead} onChangeText={setSubHead} />
                    </View>
                    
                    <View style={styles.formRow}>
                        <Text style={styles.label}>Account Type:</Text>
                         <View style={styles.pickerWrapper}>
                            <Picker selectedValue={accountType} onValueChange={(itemValue) => setAccountType(itemValue)}>
                                {accountTypeOptions.map(opt => <Picker.Item key={opt} label={opt} value={opt} />)}
                            </Picker>
                        </View>
                    </View>

                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={styles.tableHeaderText}>Particulars / Description</Text>
                            <Text style={[styles.tableHeaderText, { flex: 0.5, textAlign: 'right' }]}>Amount (Rs)</Text>
                        </View>
                        {particulars.map((row, index) => (
                            <View key={index} style={styles.tableRow}>
                                <TextInput style={[styles.tableInput, styles.descriptionInput]} placeholder="Enter Description" value={row.description} onChangeText={(val) => handleParticularChange(index, 'description', val)} />
                                <TextInput style={[styles.tableInput, styles.amountInput]} placeholder="0.00" value={row.amount} onChangeText={(val) => handleParticularChange(index, 'amount', val)} keyboardType="numeric" />
                                {particulars.length > 1 && (<TouchableOpacity onPress={() => handleRemoveRow(index)} style={styles.removeButton}><MaterialIcons name="remove-circle-outline" size={22} color="#d9534f" /></TouchableOpacity>)}
                            </View>
                        ))}
                        <TouchableOpacity style={styles.addRowButton} onPress={handleAddRow}><MaterialIcons name="add-circle-outline" size={22} color="#0275d8" /><Text style={styles.addRowText}>Add Row</Text></TouchableOpacity>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalText}>Total:</Text>
                            <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
                        </View>
                    </View>

                    <View style={styles.wordsContainer}><Text style={styles.wordsLabel}>Total Amount in Words:</Text><Text style={styles.wordsText}>{amountInWords}</Text></View>
                    
                    <View style={styles.uploadContainer}>
                         <TouchableOpacity style={styles.uploadButton} onPress={handleChooseFile}>
                            <MaterialIcons name="cloud-upload" size={24} color="#5bc0de" />
                            <Text style={styles.uploadText} numberOfLines={1}>{uploadButtonText}</Text>
                        </TouchableOpacity>
                        {existingAttachmentUrl && !attachment && (
                            <TouchableOpacity style={styles.removeAttachmentButton} onPress={handleRemoveExistingAttachment}>
                                <MaterialIcons name="close" size={22} color="#d9534f" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View style={styles.buttonRow}>
                    <TouchableOpacity style={[styles.actionButton, styles.saveButton]} onPress={handleSave} disabled={isSaving}>{isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}</TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={handleCancel}><Text style={styles.buttonText}>Cancel</Text></TouchableOpacity>
                </View>
                
                {mode === 'create' && (
                    <View style={styles.recentVouchersContainer}>
                        <Text style={styles.recentVouchersTitle}>Recent Vouchers</Text>
                        <View style={styles.recentVouchersTable}>
                            <View style={[styles.recentVoucherRow, styles.recentVoucherHeader]}>
                                <Text style={[styles.recentVoucherCellSNo, styles.recentVoucherHeaderText]}>S.No</Text>
                                <Text style={[styles.recentVoucherCell, styles.recentVoucherHeaderText]}>VCH No</Text>
                                <Text style={[styles.recentVoucherCell, styles.recentVoucherHeaderText]}>Head</Text>
                                <Text style={[styles.recentVoucherCellAmount, styles.recentVoucherHeaderText]}>Amount</Text>
                            </View>
                            {isLoadingRecent ? (
                                <ActivityIndicator size="large" color="#0275d8" style={{ marginVertical: 20 }} />
                            ) : (
                                <FlatList
                                    data={recentVouchers}
                                    renderItem={renderRecentVoucherItem}
                                    keyExtractor={(item) => item.id.toString()}
                                    ListEmptyComponent={<Text style={styles.noDataText}>No recent vouchers found.</Text>}
                                />
                            )}
                        </View>
                        <TouchableOpacity style={styles.viewMoreButton} onPress={() => navigation.navigate('RegistersScreen')}>
                            <Text style={styles.viewMoreText}>View Full Register</Text>
                            <MaterialIcons name="arrow-forward" size={16} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#E9ECEF' },
    header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#DDD' },
    backButton: { padding: 5 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', marginLeft: 10 },
    scrollContainer: { padding: 16 },
    tabContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#DDD' },
    tab: { paddingVertical: 12, alignItems: 'center', flex: 1 },
    tabText: { fontWeight: 'bold', color: '#6c757d', fontSize: 16 },
    activeTabText: { color: '#0275d8' },
    activeTabIndicator: { height: 3, backgroundColor: '#0275d8', position: 'absolute', bottom: -1, left: 0, right: 0 },
    voucherCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 8, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.22, shadowRadius: 2.22 },
    schoolTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
    managedBy: { fontSize: 12, color: '#6c757d', textAlign: 'center', marginBottom: 10 },
    voucherTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginVertical: 8, textTransform: 'uppercase', color: '#333' },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 5 },
    infoText: { fontSize: 14, color: '#495057' },
    formRow: { marginBottom: 12 },
    label: { fontSize: 14, fontWeight: 'bold', color: '#495057', marginBottom: 6 },
    input: { borderWidth: 1, borderColor: '#CED4DA', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 4, backgroundColor: '#F8F9FA', fontSize: 15 },
    pickerWrapper: { borderWidth: 1, borderColor: '#CED4DA', borderRadius: 4, backgroundColor: '#F8F9FA' },
    table: { borderWidth: 1, borderColor: '#DEE2E6', borderRadius: 4, marginTop: 10 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#F8F9FA', padding: 10, borderBottomWidth: 1, borderColor: '#DEE2E6' },
    tableHeaderText: { fontWeight: 'bold', flex: 1 },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 5, borderBottomWidth: 1, borderColor: '#DEE2E6' },
    tableInput: { height: 40, paddingHorizontal: 10 },
    descriptionInput: { flex: 1 },
    amountInput: { flex: 0.5, textAlign: 'right' },
    removeButton: { paddingLeft: 5 },
    addRowButton: { flexDirection: 'row', alignItems: 'center', padding: 10, justifyContent: 'center' },
    addRowText: { color: '#0275d8', marginLeft: 8, fontWeight: 'bold' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: '#F8F9FA', borderTopWidth: 1, borderColor: '#DEE2E6' },
    totalText: { fontWeight: 'bold', fontSize: 16 },
    totalAmount: { fontWeight: 'bold', fontSize: 16 },
    wordsContainer: { marginTop: 16, padding: 10, backgroundColor: '#F8F9FA', borderRadius: 4 },
    wordsLabel: { fontWeight: 'bold', color: '#6c757d' },
    wordsText: { fontSize: 14 },
    uploadContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
    uploadButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: '#5bc0de', borderStyle: 'dashed', borderRadius: 8 },
    uploadText: { marginLeft: 10, color: '#5bc0de', flex: 1 },
    removeAttachmentButton: { marginLeft: 10, padding: 5, },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
    actionButton: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center' },
    saveButton: { backgroundColor: '#5cb85c', marginRight: 8 },
    cancelButton: { backgroundColor: '#f0ad4e', marginLeft: 8 },
    buttonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
    recentVouchersContainer: { marginTop: 24, backgroundColor: '#FFF', borderRadius: 8, padding: 16, elevation: 3, },
    recentVouchersTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#333', },
    recentVouchersTable: { borderWidth: 1, borderColor: '#DEE2E6', borderRadius: 4, },
    recentVoucherRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#EEE', alignItems: 'center', },
    recentVoucherHeader: { backgroundColor: '#F8F9FA', borderBottomWidth: 2, borderColor: '#DEE2E6', },
    recentVoucherHeaderText: { fontWeight: 'bold', color: '#495057', },
    recentVoucherCellSNo: { width: 40, },
    recentVoucherCell: { flex: 1, paddingHorizontal: 4, },
    recentVoucherCellAmount: { width: 90, textAlign: 'right', fontWeight: 'bold', },
    noDataText: { textAlign: 'center', padding: 20, color: '#6c757d', },
    viewMoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0275d8', paddingVertical: 12, borderRadius: 8, marginTop: 16, },
    viewMoreText: { color: '#FFF', fontWeight: 'bold', marginRight: 8, },
});

export default VouchersScreen;