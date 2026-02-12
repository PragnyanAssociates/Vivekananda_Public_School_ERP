/**
 * File: src/screens/library/BookDetailsScreen.js
 * Purpose: Display detailed information about a book, with admin controls and borrow requests.
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI Header.
 */
import React, { useState, useLayoutEffect } from 'react';
import { 
    View, Text, StyleSheet, Image, ScrollView, 
    TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, 
    useColorScheme, StatusBar, Dimensions 
} from 'react-native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#1E293B',
    textSub: '#64748B',
    border: '#E2E8F0',
    iconBg: '#E0F2F1',
    imageWrapperBg: '#F1F5F9',
    itemBg: '#F8FAFC',
    successBg: '#DCFCE7',
    successText: '#166534',
    dangerBg: '#FEE2E2',
    dangerText: '#991B1B',
    editBtn: '#3B82F6',
    deleteBtn: '#EF4444',
    white: '#FFFFFF',
    disabledBtn: '#94A3B8'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#94A3B8',
    border: '#333333',
    iconBg: '#333333',
    imageWrapperBg: '#1A1A1A',
    itemBg: '#252525',
    successBg: '#14532D',
    successText: '#4ADE80',
    dangerBg: '#7F1D1D',
    dangerText: '#F87171',
    editBtn: '#3B82F6',
    deleteBtn: '#EF4444',
    white: '#FFFFFF',
    disabledBtn: '#475569'
};

const BookDetailsScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const navigation = useNavigation();
    const route = useRoute();
    const { book } = route.params; 
    
    const [loading, setLoading] = useState(false);
    
    // Hide default header to use our custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);
    
    // 1. Get User Role to show Admin buttons
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    // 2. Logic to delete book (Admin Only)
    const handleDelete = () => {
        Alert.alert(
            "Delete Book",
            "Are you sure you want to delete this book? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive", 
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await apiClient.delete(`/library/books/${book.id}`);
                            Alert.alert("Success", "Book deleted successfully.");
                            navigation.goBack();
                        } catch (error) {
                            Alert.alert("Error", error.response?.data?.message || "Delete failed.");
                            setLoading(false);
                        }
                    } 
                }
            ]
        );
    };

    // 3. Logic to Edit Book (Admin Only)
    const handleEdit = () => {
        navigation.navigate('AddBookScreen', { book: book });
    };

    // 4. LOGIC FOR BORROW REQUEST
    const handleBorrowPress = () => {
        if (book.available_copies > 0) {
            navigation.navigate('BorrowRequestScreen', { 
                bookId: book.id, 
                bookTitle: book.title 
            });
        } else {
            Alert.alert("Unavailable", "There are no copies left for this book. Please wait for a return.");
        }
    };

    // Helper for Image URL
    const imageUrl = book.cover_image_url 
        ? `${SERVER_URL}${book.cover_image_url}` 
        : 'https://via.placeholder.com/300/CCCCCC/FFFFFF?text=No+Cover';

    const isAvailable = book.available_copies > 0;

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
                        <MaterialCommunityIcons name="book-open-page-variant" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Book Details</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Library Info</Text>
                    </View>
                </View>
            </View>

            <ScrollView style={styles.container} bounces={false} showsVerticalScrollIndicator={false}>
                {/* --- Cover Image --- */}
                <View style={[styles.imageWrapper, { backgroundColor: theme.imageWrapperBg, borderColor: theme.border }]}>
                    <Image source={{ uri: imageUrl }} style={styles.cover} resizeMode="contain" />
                </View>

                <View style={styles.contentContainer}>
                    
                    {/* --- Admin Action Buttons (Edit/Delete) --- */}
                    {isAdmin && (
                        <View style={styles.adminRow}>
                            <TouchableOpacity style={[styles.adminBtn, { backgroundColor: theme.editBtn }]} onPress={handleEdit}>
                                <Text style={styles.adminBtnText}>Edit Book</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.adminBtn, { backgroundColor: theme.deleteBtn }]} onPress={handleDelete}>
                                <Text style={styles.adminBtnText}>Delete Book</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* --- Header Section (Title, Author, Status) --- */}
                    <View style={[styles.headerSection, { borderColor: theme.imageWrapperBg }]}>
                        <Text style={[styles.title, { color: theme.textMain }]}>{book.title}</Text>
                        <Text style={[styles.author, { color: theme.textSub }]}>by {book.author}</Text>
                        
                        <View style={styles.statusRow}>
                            <View style={[
                                styles.pill, 
                                { backgroundColor: isAvailable ? theme.successBg : theme.dangerBg }
                            ]}>
                                <Text style={[
                                    styles.pillText, 
                                    { color: isAvailable ? theme.successText : theme.dangerText }
                                ]}>
                                    {isAvailable ? 'Available' : 'Out of Stock'}
                                </Text>
                            </View>
                            <Text style={[styles.stockText, { color: theme.textSub }]}>
                                {book.available_copies} of {book.total_copies} copies left
                            </Text>
                        </View>
                    </View>

                    {/* --- Details Grid --- */}
                    <Text style={[styles.sectionHeader, { color: theme.textMain }]}>Book Info</Text>
                    <View style={styles.grid}>
                        <DetailItem label="Book No." value={book.book_no} theme={theme} />
                        <DetailItem label="Rack No." value={book.rack_no} theme={theme} />
                        <DetailItem label="Category" value={book.category} theme={theme} />
                        <DetailItem label="Publisher" value={book.publisher} theme={theme} />
                        <DetailItem label="Language" value={book.language || 'English'} theme={theme} />
                        <DetailItem label="Edition" value={book.edition || 'Standard'} theme={theme} />
                    </View>

                    {/* --- Main Action Button (Borrow) --- */}
                    <TouchableOpacity 
                        style={[
                            styles.btn, 
                            { backgroundColor: theme.primary },
                            (!isAvailable || loading) && { backgroundColor: theme.disabledBtn, elevation: 0 }
                        ]} 
                        onPress={handleBorrowPress}
                        disabled={!isAvailable || loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={theme.white} />
                        ) : (
                            <Text style={[styles.btnText, { color: theme.white }]}>
                                {isAvailable ? "Request to Borrow" : "No copies left, please wait"}
                            </Text>
                        )}
                    </TouchableOpacity>

                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

// Helper Component for Grid Items
const DetailItem = ({ label, value, theme }) => (
    <View style={[styles.item, { backgroundColor: theme.itemBg }]}>
        <Text style={[styles.label, { color: theme.textSub }]}>{label}</Text>
        <Text style={[styles.value, { color: theme.textMain }]} numberOfLines={1}>{value || '-'}</Text>
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
        marginBottom: 0, // 0 to stick seamlessly with the scrollview
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 3,
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
        zIndex: 10
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
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13, marginTop: 2 },

    imageWrapper: { 
        paddingVertical: 30, 
        alignItems: 'center', 
        borderBottomWidth: 1, 
        marginTop: 10
    },
    cover: { 
        width: width * 0.45, // Responsive width
        height: width * 0.65, // Responsive height based on aspect ratio
        borderRadius: 8, 
        elevation: 10, 
        shadowColor: '#000', 
        shadowOpacity: 0.3, 
        shadowRadius: 10 
    },
    contentContainer: { padding: width * 0.06 }, // Responsive padding
    
    // Admin Styles
    adminRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 20 },
    adminBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, marginLeft: 10 },
    adminBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },

    // Details Header Styles
    headerSection: { marginBottom: 24, borderBottomWidth: 1, paddingBottom: 20 },
    title: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
    author: { fontSize: 16, fontWeight: '500' },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
    pill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginRight: 10 },
    pillText: { fontSize: 12, fontWeight: 'bold' },
    stockText: { fontSize: 14 },
    
    // Details Grid Styles
    sectionHeader: { fontSize: 18, fontWeight: '700', marginBottom: 15 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    item: { width: '48%', padding: 15, borderRadius: 12, marginBottom: 12 },
    label: { fontSize: 11, marginBottom: 4, textTransform: 'uppercase', fontWeight:'700' },
    value: { fontSize: 14, fontWeight: '600' },
    
    // Main Button Styles
    btn: { 
        paddingVertical: 18, 
        borderRadius: 14, 
        alignItems: 'center', 
        marginTop: 30, 
        marginBottom: 20,
        elevation: 4,
        shadowOpacity: 0.3,
        shadowOffset: {width:0, height:4}
    },
    btnText: { fontWeight: 'bold', fontSize: 16, letterSpacing: 0.5 }
});

export default BookDetailsScreen;