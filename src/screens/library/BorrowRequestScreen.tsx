/**
 * File: src/screens/library/BorrowRequestScreen.js
 * Purpose: Form to request borrowing a library book.
 * Updated: Added Role Selection, Conditional Fields, Responsive & Dark Mode.
 */
import React, { useState, useLayoutEffect } from 'react';
import { 
    View, Text, StyleSheet, TextInput, TouchableOpacity, 
    ScrollView, Alert, ActivityIndicator, Platform,
    SafeAreaView, useColorScheme, StatusBar, KeyboardAvoidingView, Dimensions 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker'; // Ensure this is installed
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#cbd5e1',
    inputBg: '#F8FAFC',
    inputBorder: '#E2E8F0',
    iconBg: '#E0F2F1',
    textPlaceholder: '#94A3B8',
    white: '#ffffff',
    disabledBtn: '#94A3B8'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    inputBorder: '#555555',
    iconBg: '#333333',
    textPlaceholder: '#64748b',
    white: '#ffffff',
    disabledBtn: '#475569'
};

const BorrowRequestScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const route = useRoute();
    const navigation = useNavigation();
    const { bookId, bookTitle } = route.params;
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    // Hide default header to use our custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const [form, setForm] = useState({
        full_name: user?.full_name || '',
        user_role: 'student', // Default Role
        roll_no: '', // Acts as Roll No for students, User ID for others
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
        // Validation
        if(!form.full_name) return Alert.alert("Required", "Full Name is required.");
        if(!form.roll_no) return Alert.alert("Required", form.user_role === 'student' ? "Roll No is required." : "User ID is required.");
        if(!form.mobile) return Alert.alert("Required", "Mobile Number is required.");
        if(form.user_role === 'student' && !form.class_name) return Alert.alert("Required", "Class is required for students.");

        setLoading(true);
        try {
            const payload = {
                ...form,
                book_id: bookId,
                borrow_date: formatDateBackend(borrowDate),
                return_date: formatDateBackend(returnDate),
            };

            await apiClient.post('/library/request', payload);
            
            Alert.alert("Success", "Request submitted! Check Action Center/History.", [
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
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={theme.textMain} />
                    </TouchableOpacity>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialIcons name="library-add-check" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]} numberOfLines={1}>Borrow Request</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]} numberOfLines={1}>{bookTitle}</Text>
                    </View>
                </View>
            </View>

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                style={styles.container}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={[styles.card, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                        
                        {/* 1. Full Name */}
                        <InputField label="Full Name *" value={form.full_name} onChangeText={t=>setForm({...form, full_name:t})} theme={theme} />

                        {/* 2. Role Selector (Picker) */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.textSub }]}>Role *</Text>
                            <View style={[styles.pickerContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                                <Picker
                                    selectedValue={form.user_role}
                                    onValueChange={(itemValue) => setForm({...form, user_role: itemValue, class_name: ''})} // Reset class on change
                                    dropdownIconColor={theme.textMain}
                                    style={{ color: theme.textMain }}
                                >
                                    <Picker.Item label="Student" value="student" style={{color: theme.textMain}} />
                                    <Picker.Item label="Teacher" value="teacher" style={{color: theme.textMain}} />
                                    <Picker.Item label="Admin" value="admin" style={{color: theme.textMain}} />
                                    <Picker.Item label="Other" value="other" style={{color: theme.textMain}} />
                                </Picker>
                            </View>
                        </View>

                        {/* 3. Dynamic Field: Roll No (Student) OR User ID (Others) */}
                        <InputField 
                            label={form.user_role === 'student' ? "Roll No *" : "User ID *"} 
                            value={form.roll_no} 
                            onChangeText={t=>setForm({...form, roll_no:t})} 
                            placeholder={form.user_role === 'student' ? "e.g. 101" : "e.g. T-550"} 
                            theme={theme} 
                        />

                        {/* 4. Class (Only visible if Role is Student) */}
                        {form.user_role === 'student' && (
                            <InputField 
                                label="Class *" 
                                value={form.class_name} 
                                onChangeText={t=>setForm({...form, class_name:t})} 
                                placeholder="e.g. 10-A" 
                                theme={theme} 
                            />
                        )}

                        <InputField label="Mobile *" keyboardType="phone-pad" value={form.mobile} onChangeText={t=>setForm({...form, mobile:t})} placeholder="9876543210" theme={theme} />
                        <InputField label="Email" value={form.email} onChangeText={t=>setForm({...form, email:t})} theme={theme} />

                        {/* Borrow Date Picker */}
                        <Text style={[styles.label, { color: theme.textSub }]}>Borrow Date</Text>
                        <TouchableOpacity 
                            style={[styles.dateBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]} 
                            onPress={() => setShowBorrowPicker(true)}
                        >
                            <Text style={[styles.dateTxt, { color: theme.textMain }]}>{formatDateDisplay(borrowDate)}</Text>
                            <MaterialIcons name="calendar-today" size={20} color={theme.textSub} />
                        </TouchableOpacity>
                        {showBorrowPicker && (
                            <DateTimePicker 
                                value={borrowDate} 
                                mode="date" 
                                display="default"
                                onChange={(e, d) => { setShowBorrowPicker(Platform.OS === 'ios'); if(d) setBorrowDate(d); }}
                            />
                        )}

                        {/* Return Date Picker */}
                        <Text style={[styles.label, { color: theme.textSub, marginTop: 10 }]}>Return Date</Text>
                        <TouchableOpacity 
                            style={[styles.dateBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]} 
                            onPress={() => setShowReturnPicker(true)}
                        >
                            <Text style={[styles.dateTxt, { color: theme.textMain }]}>{formatDateDisplay(returnDate)}</Text>
                            <MaterialIcons name="calendar-today" size={20} color={theme.textSub} />
                        </TouchableOpacity>
                        {showReturnPicker && (
                            <DateTimePicker 
                                value={returnDate} 
                                mode="date" 
                                display="default" 
                                minimumDate={borrowDate}
                                onChange={(e, d) => { setShowReturnPicker(Platform.OS === 'ios'); if(d) setReturnDate(d); }}
                            />
                        )}

                        {/* Submit Button */}
                        <TouchableOpacity 
                            style={[
                                styles.submitBtn, 
                                { backgroundColor: theme.primary },
                                loading && { backgroundColor: theme.disabledBtn }
                            ]} 
                            onPress={handleRequest} 
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={theme.white}/>
                            ) : (
                                <Text style={[styles.submitTxt, { color: theme.white }]}>Submit Request</Text>
                            )}
                        </TouchableOpacity>

                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// Helper Input Field Component
const InputField = ({ label, theme, ...props }) => (
    <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.textSub }]}>{label}</Text>
        <TextInput 
            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
            placeholderTextColor={theme.textPlaceholder} 
            {...props} 
        />
    </View>
);

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { flex: 1 },
    
    // --- HEADER CARD STYLES ---
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
        elevation: 3,
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    backButton: { marginRight: 10, padding: 4 },
    headerIconContainer: {
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center', flex: 1, paddingRight: 10 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13, marginTop: 2 },

    scrollContent: { paddingHorizontal: width * 0.04, paddingBottom: 30 },
    
    card: { 
        padding: 20, 
        borderRadius: 12, 
        elevation: 3,
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
        marginTop: 10
    },
    
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 13, marginBottom: 6, fontWeight: '600' },
    input: { 
        borderWidth: 1, 
        padding: 12, 
        borderRadius: 8, 
        fontSize: 15 
    },
    pickerContainer: {
        borderWidth: 1,
        borderRadius: 8,
        overflow: 'hidden', // Ensures picker rounded corners on Android
    },
    
    dateBtn: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: 12, 
        borderWidth: 1, 
        borderRadius: 8, 
        marginBottom: 12 
    },
    dateTxt: { fontSize: 15 },
    
    submitBtn: { 
        padding: 16, 
        borderRadius: 12, 
        alignItems: 'center', 
        marginTop: 20,
        elevation: 3
    },
    submitTxt: { fontWeight: 'bold', fontSize: 16 }
});

export default BorrowRequestScreen;