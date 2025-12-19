import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Alert } from 'react-native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';

const BookDetailsScreen = ({ route }) => {
    const { book } = route.params;
    const [loading, setLoading] = useState(false);

    const handleReserve = async () => {
        setLoading(true);
        try {
            await apiClient.post('/library/reserve', { book_id: book.id });
            Alert.alert("Success", "Request sent to Librarian.");
        } catch (error) {
            Alert.alert("Error", error.response?.data?.message || "Failed to reserve.");
        } finally { setLoading(false); }
    };

    const imageUrl = book.cover_image_url ? `${SERVER_URL}${book.cover_image_url}` : 'https://via.placeholder.com/300';

    return (
        <ScrollView style={styles.container}>
            <Image source={{ uri: imageUrl }} style={styles.cover} />
            <View style={styles.content}>
                <Text style={styles.title}>{book.title}</Text>
                <Text style={styles.author}>{book.author}</Text>
                
                <View style={styles.grid}>
                    <DetailItem label="ISBN" value={book.isbn} />
                    <DetailItem label="Publisher" value={book.publisher} />
                    <DetailItem label="Category" value={book.category} />
                    <DetailItem label="Rack No" value={book.rack_no} />
                    <DetailItem label="Edition" value={book.edition || 'N/A'} />
                    <DetailItem label="Language" value={book.language || 'English'} />
                </View>

                {/* Reservation Button */}
                <TouchableOpacity 
                    style={[styles.btn, book.available_copies === 0 && styles.disabledBtn]} 
                    onPress={handleReserve}
                    disabled={book.available_copies === 0 || loading}
                >
                    <Text style={styles.btnText}>
                        {loading ? "Processing..." : (book.available_copies > 0 ? "Request to Borrow" : "Currently Unavailable")}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const DetailItem = ({ label, value }) => (
    <View style={styles.item}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    cover: { width: '100%', height: 250, resizeMode: 'contain', backgroundColor: '#F1F5F9' },
    content: { padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1E293B' },
    author: { fontSize: 16, color: '#64748B', marginBottom: 20 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    item: { width: '48%', marginBottom: 15, padding: 10, backgroundColor: '#F8FAFC', borderRadius: 8 },
    label: { fontSize: 12, color: '#94A3B8' },
    value: { fontSize: 14, fontWeight: '600', color: '#334155' },
    btn: { marginTop: 20, backgroundColor: '#2563EB', padding: 15, borderRadius: 8, alignItems: 'center' },
    disabledBtn: { backgroundColor: '#CBD5E1' },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});

export default BookDetailsScreen;