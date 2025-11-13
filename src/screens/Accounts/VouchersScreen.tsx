import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    SafeAreaView, Alert, ActivityIndicator, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import apiClient from '../../api/client';

type VoucherType = 'Debit' | 'Credit' | 'Deposit';
interface ParticularRow {
    description: string;
    amount: string;
}

// --- Data for the new dropdowns ---
const headOfAccountOptions = [
    'Fee', 'Salaries', 'Donations', 'Utilities/Bills', 'Transport', 'Assets',
    'Government Grants/Aids', 'Investments', 'Staff Welfare', 'Student Welfare',
    'Repairs', 'Security/CCTV', 'Kitchen', 'Maintenance',
    'Laboratories/Library', 'Miscellaneous'
];

const accountTypeOptions = ['UPI', 'Bank', 'Cheque', 'Cash', 'Kind', 'Others'];

// Helper function to convert number to words
const numberToWords = (num: number): string => {
    if (num === 0) return 'Zero';
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const convert = (n: number): string => {
        if (n < 0) return '';
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
        if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
        if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
        return 'Number too large';
    };
    return convert(num).trim();
};


const VouchersScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    
    // --- State Management ---
    const [voucherType, setVoucherType] = useState<VoucherType>('Debit');
    const [voucherNo, setVoucherNo] = useState<string>('Loading...');
    const [voucherDate, setVoucherDate] = useState<string>(new Date().toLocaleDateString('en-GB')); // DD/MM/YYYY
    const [headOfAccount, setHeadOfAccount] = useState<string>('');
    const [subHead, setSubHead] = useState('');
    const [accountType, setAccountType] = useState<string>('UPI');
    const [particulars, setParticulars] = useState<ParticularRow[]>([{ description: '', amount: '' }]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [amountInWords, setAmountInWords] = useState('Zero Rupees Only');
    const [attachment, setAttachment] = useState<ImagePickerResponse | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
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

    const resetForm = useCallback(() => {
        setVoucherType('Debit');
        setHeadOfAccount('');
        setSubHead('');
        setAccountType('UPI');
        setParticulars([{ description: '', amount: '' }]);
        setAttachment(null);
        fetchNextVoucherNumber(); // Fetch a new number after resetting
    }, [fetchNextVoucherNumber]);
    
    // Fetch new voucher number when the screen is focused
    useEffect(() => {
        if (isFocused) {
            fetchNextVoucherNumber();
        }
    }, [isFocused, fetchNextVoucherNumber]);

    useEffect(() => {
        const total = particulars.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        setTotalAmount(total);
    }, [particulars]);

    useEffect(() => {
        setAmountInWords(`${numberToWords(Math.floor(totalAmount))} Rupees Only`);
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
        });
    };
    
    const handleCancel = () => Alert.alert("Confirm Cancel", "Are you sure you want to clear the form?", [{ text: "No", style: "cancel" }, { text: "Yes", style: "destructive", onPress: resetForm }]);
    const handleDownload = () => Alert.alert("Info", "Download functionality will be implemented soon.");

    const handleSave = async () => {
        const validParticulars = particulars.filter(p => p.description.trim() !== '' && !isNaN(parseFloat(p.amount)) && parseFloat(p.amount) > 0);
        if (!headOfAccount) return Alert.alert('Validation Error', 'Please select a "Head of A/C".');
        if (validParticulars.length === 0) return Alert.alert('Validation Error', 'Please add at least one valid particular.');

        setIsSaving(true);
        const formData = new FormData();
        formData.append('voucherType', voucherType);
        formData.append('voucherNo', voucherNo);
        formData.append('voucherDate', new Date().toISOString().split('T')[0]); // YYYY-MM-DD for backend
        formData.append('headOfAccount', headOfAccount);
        formData.append('subHead', subHead);
        formData.append('accountType', accountType);
        formData.append('totalAmount', totalAmount.toFixed(2));
        formData.append('amountInWords', amountInWords);
        formData.append('particulars', JSON.stringify(validParticulars));

        if (attachment?.assets?.[0]) {
            formData.append('attachment', { uri: Platform.OS === 'android' ? attachment.assets[0].uri : attachment.assets[0].uri!.replace('file://', ''), type: attachment.assets[0].type, name: attachment.assets[0].fileName });
        }
        
        try {
            const response = await apiClient.post('/vouchers/create', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            Alert.alert('Success', response.data.message || 'Voucher saved successfully!');
            resetForm();
        } catch (error: any) {
            console.error(error);
            const errorMessage = error.response?.data?.message || 'An error occurred while saving.';
            Alert.alert('Error', errorMessage);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><MaterialIcons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
                <Text style={styles.headerTitle}>Vouchers</Text>
            </View>
            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
                <View style={styles.tabContainer}>
                    {(['Debit', 'Credit', 'Deposit'] as VoucherType[]).map(type => (
                        <TouchableOpacity key={type} style={[styles.tab, voucherType === type && styles.activeTab]} onPress={() => setVoucherType(type)}>
                            <Text style={[styles.tabText, voucherType === type && styles.activeTabText]}>{type}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.voucherCard}>
                    <Text style={styles.schoolTitle}>Vivekananda Public School</Text>
                    <Text style={styles.managedBy}>Managed By Vivekananda Education Center</Text>
                    <Text style={styles.voucherTitle}>{voucherType} Voucher</Text>

                    {/* --- Voucher Info Row --- */}
                    <View style={styles.infoRow}>
                        <Text style={styles.infoText}>No: {voucherNo}</Text>
                        <Text style={styles.infoText}>Date: {voucherDate}</Text>
                    </View>

                    {/* --- Head of Account Picker --- */}
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={headOfAccount} onValueChange={(itemValue) => setHeadOfAccount(itemValue)}>
                            <Picker.Item label="Select Head of A/C*" value="" />
                            {headOfAccountOptions.map(opt => <Picker.Item key={opt} label={opt} value={opt} />)}
                        </Picker>
                    </View>

                    <TextInput style={styles.input} placeholder="Sub Head" value={subHead} onChangeText={setSubHead} />
                    
                    {/* --- Account Type Picker --- */}
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={accountType} onValueChange={(itemValue) => setAccountType(itemValue)}>
                            {accountTypeOptions.map(opt => <Picker.Item key={opt} label={opt} value={opt} />)}
                        </Picker>
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
                        <View style={styles.totalRow}><Text style={styles.totalText}>Total:</Text><Text style={styles.totalAmount}>{totalAmount.toFixed(2)}</Text></View>
                    </View>

                    <View style={styles.wordsContainer}><Text style={styles.wordsLabel}>Total Amount in Words:</Text><Text style={styles.wordsText}>{amountInWords}</Text></View>
                    <TouchableOpacity style={styles.uploadButton} onPress={handleChooseFile}><MaterialIcons name="cloud-upload" size={24} color="#5bc0de" /><Text style={styles.uploadText} numberOfLines={1}>{attachment?.assets?.[0]?.fileName || 'Upload Proof'}</Text></TouchableOpacity>
                </View>

                <View style={styles.buttonRow}>
                    <TouchableOpacity style={[styles.actionButton, styles.saveButton]} onPress={handleSave} disabled={isSaving}>{isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}</TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={handleCancel}><Text style={styles.buttonText}>Cancel</Text></TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.actionButton, styles.downloadButton]} onPress={handleDownload}><Text style={styles.buttonText}>Download</Text></TouchableOpacity>
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
    tabContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
    tab: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#0275d8' },
    activeTab: { backgroundColor: '#0275d8' },
    tabText: { fontWeight: 'bold', color: '#0275d8' },
    activeTabText: { color: '#FFF' },
    voucherCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 8, elevation: 3 },
    schoolTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
    managedBy: { fontSize: 12, color: '#6c757d', textAlign: 'center', marginBottom: 10 },
    voucherTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginVertical: 8, textTransform: 'uppercase' },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 5 },
    infoText: { fontSize: 14, color: '#495057' },
    input: { borderWidth: 1, borderColor: '#CED4DA', padding: 10, borderRadius: 4, marginBottom: 12, backgroundColor: '#F8F9FA' },
    pickerContainer: { borderWidth: 1, borderColor: '#CED4DA', borderRadius: 4, marginBottom: 12, justifyContent: 'center' },
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
    uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: '#5bc0de', borderStyle: 'dashed', borderRadius: 8, marginTop: 16 },
    uploadText: { marginLeft: 10, color: '#5bc0de', flex: 1 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
    actionButton: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center' },
    saveButton: { backgroundColor: '#5cb85c', marginRight: 8 },
    cancelButton: { backgroundColor: '#f0ad4e', marginLeft: 8 },
    downloadButton: { backgroundColor: '#0275d8', marginTop: 12 },
    buttonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});

export default VouchersScreen;