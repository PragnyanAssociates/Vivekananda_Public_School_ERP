import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Alert } from 'react-native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useNavigation } from '@react-navigation/native';
// 1. Import useAuth
import { useAuth } from '../../context/AuthContext'; 

const BookDetailsScreen = ({ route }) => {
    const navigation = useNavigation();
    const { book } = route.params;
    const [loading, setLoading] = useState(false);
    
    // 2. Get User Role
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

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
                            Alert.alert("Success", "Book deleted.");
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

    const handleEdit = () => {
        navigation.navigate('AddBookScreen', { book: book });
    };

    const handleReserve = async () => {
        setLoading(true);
        try {
            await apiClient.post('/library/reserve', { book_id: book.id });
            Alert.alert("Success", "Reservation request sent to Librarian.");
        } catch (error) {
            Alert.alert("Error", error.response?.data?.message || "Failed to reserve.");
        } finally { setLoading(false); }
    };

    const imageUrl = book.cover_image_url 
        ? `${SERVER_URL}${book.cover_image_url}` 
        : 'https://via.placeholder.com/300/CCCCCC/FFFFFF?text=No+Cover';

    const isAvailable = book.available_copies > 0;

    return (
        <ScrollView style={styles.container} bounces={false}>
            <View style={styles.imageWrapper}>
                <Image source={{ uri: imageUrl }} style={styles.cover} resizeMode="contain" />
            </View>

            <View style={styles.contentContainer}>
                
                {/* 3. CONDITIONALLY RENDER ADMIN BUTTONS */}
                {isAdmin && (
                    <View style={styles.adminRow}>
                        <TouchableOpacity style={[styles.adminBtn, styles.editBtn]} onPress={handleEdit}>
                            <Text style={styles.adminBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.adminBtn, styles.deleteBtn]} onPress={handleDelete}>
                            <Text style={styles.adminBtnText}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.headerSection}>
                    <Text style={styles.title}>{book.title}</Text>
                    <Text style={styles.author}>by {book.author}</Text>
                    
                    <View style={styles.statusRow}>
                        <View style={[styles.pill, isAvailable ? styles.bgGreen : styles.bgRed]}>
                            <Text style={styles.pillText}>{isAvailable ? 'Available' : 'Out of Stock'}</Text>
                        </View>
                        <Text style={styles.stockText}>{book.available_copies} of {book.total_copies} copies left</Text>
                    </View>
                </View>

                <Text style={styles.sectionHeader}>Book Details</Text>
                <View style={styles.grid}>
                    <DetailItem label="Book No." value={book.book_no} />
                    <DetailItem label="Rack No." value={book.rack_no} />
                    <DetailItem label="Category" value={book.category} />
                    <DetailItem label="Publisher" value={book.publisher} />
                    <DetailItem label="Language" value={book.language || 'English'} />
                    <DetailItem label="Edition" value={book.edition || 'Standard'} />
                </View>

                {/* Reservation Button (Available to all) */}
                <TouchableOpacity 
                    style={[styles.btn, (!isAvailable || loading) && styles.disabledBtn]} 
                    onPress={handleReserve}
                    disabled={!isAvailable || loading}
                >
                    <Text style={styles.btnText}>
                        {loading ? "Processing..." : (isAvailable ? "Request to Borrow" : "Currently Unavailable")}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const DetailItem = ({ label, value }) => (
    <View style={styles.item}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} numberOfLines={1}>{value || '-'}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    imageWrapper: { backgroundColor: '#F1F5F9', paddingVertical: 20, alignItems: 'center', borderBottomWidth: 1, borderColor: '#E2E8F0' },
    cover: { width: 160, height: 240, borderRadius: 8, elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
    contentContainer: { padding: 24 },
    
    // Admin Styles
    adminRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
    adminBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, marginLeft: 10 },
    editBtn: { backgroundColor: '#3B82F6' },
    deleteBtn: { backgroundColor: '#EF4444' },
    adminBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },

    headerSection: { marginBottom: 24, borderBottomWidth: 1, borderColor: '#F1F5F9', paddingBottom: 20 },
    title: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
    author: { fontSize: 16, color: '#64748B', fontWeight: '500' },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginRight: 10 },
    bgGreen: { backgroundColor: '#DCFCE7' }, 
    bgRed: { backgroundColor: '#FEE2E2' },
    pillText: { fontSize: 12, fontWeight: 'bold', color: '#1E293B' },
    stockText: { fontSize: 13, color: '#64748B' },
    sectionHeader: { fontSize: 16, fontWeight: '700', color: '#334155', marginBottom: 12 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    item: { width: '48%', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, marginBottom: 12 },
    label: { fontSize: 11, color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase' },
    value: { fontSize: 14, fontWeight: '600', color: '#334155' },
    btn: { backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 20, elevation: 2 },
    disabledBtn: { backgroundColor: '#94A3B8', elevation: 0 },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});

export default BookDetailsScreen;