/**
 * File: src/screens/library/BorrowRequestScreen.js
 * Purpose: Form to request borrowing a library book.
 * Updated: Added Strict Validation (Mobile, Dates, Required Fields), Error Handling UI.
 */
import React, { useState, useLayoutEffect } from 'react';
import { 
    View, Text, StyleSheet, TextInput, TouchableOpacity, 
    ScrollView, Alert, ActivityIndicator, Platform,
    SafeAreaView, useColorScheme, StatusBar, KeyboardAvoidingView, Dimensions 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker'; 
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
    disabledBtn: '#94A3B8',
    error: '#E53935'
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
    disabledBtn: '#475569',
    error: '#FF5252'
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
    
    // Validation State
    const [errors, setErrors] = useState({});

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

    // --- VALIDATION LOGIC ---
    const validateForm = () => {
        let isValid = true;
        let newErrors = {};

        // 1. Full Name
        if (!form.full_name.trim()) {
            newErrors.full_name = "Full Name is required.";
            isValid = false;
        }

        // 2. Mobile Validation (As requested)
        // Rule: Exactly 10 digits, Numbers only, Cannot start with 0
        const mobileRegex = /^[1-9][0-9]{9}$/;
        if (!form.mobile) {
            newErrors.mobile = "Mobile Number is required.";
            isValid = false;
        } else if (!mobileRegex.test(form.mobile)) {
            newErrors.mobile = "Invalid Mobile: Must be 10 digits, cannot start with 0.";
            isValid = false;
        }

        // 3. Roll No / ID Validation
        if (!form.roll_no.trim()) {
            newErrors.roll_no = form.user_role === 'student' ? "Roll No is required." : "User ID is required.";
            isValid = false;
        }

        // 4. Class Validation (Only for Students)
        if (form.user_role === 'student') {
            // Grade Validation: 1-12 (Optional Check based on request, strictly checking presence here)
            if (!form.class_name.trim()) {
                newErrors.class_name = "Class is required for students.";
                isValid = false;
            }
        }

        // 5. Date Validation
        // Return Date must be >= Borrow Date
        // Set times to 00:00:00 to compare dates only
        const bDate = new Date(borrowDate).setHours(0,0,0,0);
        const rDate = new Date(returnDate).setHours(0,0,0,0);

        if (rDate < bDate) {
            Alert.alert("Date Error", "Return Date cannot be before Borrow Date.");
            isValid = false;
        }

        /* 
           --- REFERENCE VALIDATIONS (Requested in Prompt) ---
           These fields are not currently in the UI, but here are the regex patterns 
           if you decide to add inputs for 'pen_no', 'aadhaar', or 'tc_no'.

           // Pen No: Alphanumeric, 6-20 chars, No special chars
           const penRegex = /^[a-zA-Z0-9]{6,20}$/;

           // Aadhaar No: Exactly 12 digits, Numbers only
           const aadhaarRegex = /^\d{12}$/;

           // TC Number: Alphanumeric, 5-20 chars
           const tcRegex = /^[a-zA-Z0-9]{5,20}$/;
        */

        setErrors(newErrors);
        return isValid;
    };

    const handleRequest = async () => {
        if (!validateForm()) return;

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
                        <InputField 
                            label="Full Name *" 
                            value={form.full_name} 
                            onChangeText={t => {
                                setForm({...form, full_name:t});
                                if (errors.full_name) setErrors({...errors, full_name: null});
                            }} 
                            theme={theme} 
                            error={errors.full_name}
                        />

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
                            onChangeText={t => {
                                setForm({...form, roll_no:t});
                                if (errors.roll_no) setErrors({...errors, roll_no: null});
                            }} 
                            placeholder={form.user_role === 'student' ? "e.g. 101" : "e.g. T-550"} 
                            theme={theme} 
                            error={errors.roll_no}
                        />

                        {/* 4. Class (Only visible if Role is Student) */}
                        {form.user_role === 'student' && (
                            <InputField 
                                label="Class *" 
                                value={form.class_name} 
                                onChangeText={t => {
                                    setForm({...form, class_name:t});
                                    if (errors.class_name) setErrors({...errors, class_name: null});
                                }} 
                                placeholder="e.g. 10-A" 
                                theme={theme} 
                                error={errors.class_name}
                            />
                        )}

                        {/* 5. Mobile Number (Strict Validation) */}
                        <InputField 
                            label="Mobile *" 
                            keyboardType="phone-pad" 
                            value={form.mobile} 
                            onChangeText={t => {
                                // Only allow numeric input as per requirements
                                if (/^\d*$/.test(t)) {
                                    setForm({...form, mobile:t});
                                    if (errors.mobile) setErrors({...errors, mobile: null});
                                }
                            }} 
                            placeholder="e.g. 9876543210" 
                            maxLength={10}
                            theme={theme} 
                            error={errors.mobile}
                        />

                        <InputField 
                            label="Email" 
                            value={form.email} 
                            onChangeText={t=>setForm({...form, email:t})} 
                            theme={theme} 
                        />

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

// Helper Input Field Component (Updated with Error Prop)
const InputField = ({ label, theme, error, ...props }) => (
    <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.textSub }]}>{label}</Text>
        <TextInput 
            style={[
                styles.input, 
                { backgroundColor: theme.inputBg, borderColor: error ? theme.error : theme.inputBorder, color: theme.textMain }
            ]} 
            placeholderTextColor={theme.textPlaceholder} 
            {...props} 
        />
        {/* Error Message Display */}
        {error && (
            <Text style={[styles.errorText, { color: theme.error }]}>
                {error}
            </Text>
        )}
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
        overflow: 'hidden', 
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
    submitTxt: { fontWeight: 'bold', fontSize: 16 },
    
    // New Error Text Style
    errorText: {
        fontSize: 12,
        marginTop: 4,
        marginLeft: 2
    }
});

export default BorrowRequestScreen;