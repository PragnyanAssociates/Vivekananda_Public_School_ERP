import React, { useState } from 'react';
import { 
    View, Text, StyleSheet, TextInput, TouchableOpacity, 
    ScrollView, Alert, ActivityIndicator, Platform 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const BorrowRequestScreen = ({ route, navigation }) => {
    const { bookId, bookTitle } = route.params;
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        full_name: user?.full_name || '',
        roll_no: '',
        class_name: '',
        mobile: '',
        email: user?.email || '',
    });

    const [borrowDate, setBorrowDate] = useState(new Date());
    // Default return date is today + 7 days
    const [returnDate, setReturnDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    
    const [showBorrowPicker, setShowBorrowPicker] = useState(false);
    const [showReturnPicker, setShowReturnPicker] = useState(false);

    // DISPLAY FORMAT: DD/MM/YYYY
    const formatDateDisplay = (date) => {
        if (!date) return '';
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // BACKEND FORMAT: YYYY-MM-DD
    const formatDateBackend = (date) => {
        if (!date) return null;
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleRequest = async () => {
        if(!form.roll_no || !form.mobile) {
            return Alert.alert("Required", "Please fill Roll No and Mobile Number.");
        }

        setLoading(true);
        try {
            const payload = {
                ...form,
                book_id: bookId,
                borrow_date: formatDateBackend(borrowDate),
                return_date: formatDateBackend(returnDate),
            };

            console.log("Sending Payload:", payload); // Debug in React Native Console

            await apiClient.post('/library/request', payload);
            
            Alert.alert("Success", "Request submitted! Check Admin Panel.", [
                { text: "OK", onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", error.response?.data?.message || "Request failed");
        } finally { 
            setLoading(false); 
        }
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.header}>Request: {bookTitle}</Text>
            <View style={styles.card}>
                <InputField label="Full Name" value={form.full_name} onChangeText={t=>setForm({...form, full_name:t})} />
                <InputField label="Roll No / ID *" value={form.roll_no} onChangeText={t=>setForm({...form, roll_no:t})} placeholder="12345" />
                <InputField label="Class" value={form.class_name} onChangeText={t=>setForm({...form, class_name:t})} placeholder="10-A" />
                <InputField label="Mobile *" keyboardType="phone-pad" value={form.mobile} onChangeText={t=>setForm({...form, mobile:t})} placeholder="9876543210" />
                <InputField label="Email" value={form.email} onChangeText={t=>setForm({...form, email:t})} />

                <Text style={styles.label}>Borrow Date</Text>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowBorrowPicker(true)}>
                    <Text style={styles.dateTxt}>{formatDateDisplay(borrowDate)}</Text>
                    <Text>📅</Text>
                </TouchableOpacity>
                {showBorrowPicker && (
                    <DateTimePicker value={borrowDate} mode="date" display="default"
                        onChange={(e, d) => { setShowBorrowPicker(Platform.OS === 'ios'); if(d) setBorrowDate(d); }}
                    />
                )}

                <Text style={styles.label}>Return Date</Text>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowReturnPicker(true)}>
                    <Text style={styles.dateTxt}>{formatDateDisplay(returnDate)}</Text>
                    <Text>📅</Text>
                </TouchableOpacity>
                {showReturnPicker && (
                    <DateTimePicker value={returnDate} mode="date" display="default" minimumDate={borrowDate}
                        onChange={(e, d) => { setShowReturnPicker(Platform.OS === 'ios'); if(d) setReturnDate(d); }}
                    />
                )}

                <TouchableOpacity style={styles.submitBtn} onPress={handleRequest} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.submitTxt}>Submit Request</Text>}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const InputField = ({label, ...props}) => (
    <View style={{marginBottom:12}}>
        <Text style={styles.label}>{label}</Text>
        <TextInput style={styles.input} placeholderTextColor="#999" {...props} />
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC', padding: 20 },
    header: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#334155' },
    card: { backgroundColor: '#FFF', padding: 20, borderRadius: 12, elevation: 3 },
    label: { fontSize: 12, color: '#64748B', marginBottom: 4, fontWeight:'600' },
    input: { borderWidth: 1, borderColor: '#E2E8F0', padding: 12, borderRadius: 8, color: '#1E293B', fontSize: 14 },
    dateBtn: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, marginBottom: 12 },
    dateTxt: { fontSize: 14, color: '#1E293B' },
    submitBtn: { backgroundColor: '#2563EB', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 10 },
    submitTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});

export default BorrowRequestScreen;