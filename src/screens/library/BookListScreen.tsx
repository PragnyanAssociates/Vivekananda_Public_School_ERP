import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Image, ActivityIndicator } from 'react-native';
// ★ IMPORT YOUR CLIENT AND CONFIG ★
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';

const BookListScreen = () => {
    const [books, setBooks] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchBooks = async () => {
        setLoading(true);
        try {
            // apiClient automatically handles the Base URL and Token
            const response = await apiClient.get(`/library/books`, {
                params: { search }
            });
            setBooks(response.data);
        } catch (error) {
            console.error("Error fetching books:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => fetchBooks(), 500);
        return () => clearTimeout(timer);
    }, [search]);

    const renderBook = ({ item }) => {
        // Construct full image URL
        const imageUrl = item.cover_image_url ? `${SERVER_URL}${item.cover_image_url}` : 'https://via.placeholder.com/100';

        return (
            <View style={styles.bookCard}>
                <Image source={{ uri: imageUrl }} style={styles.bookCover} />
                <View style={styles.bookInfo}>
                    <Text style={styles.bookTitle}>{item.title}</Text>
                    <Text style={styles.bookAuthor}>{item.author}</Text>
                    <Text style={styles.bookMeta}>ISBN: {item.isbn}</Text>
                    <View style={styles.statusRow}>
                        <Text style={[styles.badge, item.available_copies > 0 ? styles.avail : styles.out]}>
                            {item.available_copies > 0 ? 'Available' : 'Out of Stock'}
                        </Text>
                        <Text style={styles.rack}>Rack: {item.rack_no}</Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.searchBox}>
                <TextInput 
                    style={styles.input} 
                    placeholder="Search Title, Author..." 
                    value={search} 
                    onChangeText={setSearch} 
                />
            </View>
            {loading ? <ActivityIndicator size="large" color="#000" style={{marginTop: 20}} /> : (
                <FlatList
                    data={books}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderBook}
                    contentContainerStyle={{ padding: 10 }}
                    ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 20}}>No books found.</Text>}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    searchBox: { padding: 15, backgroundColor: '#FFF' },
    input: { backgroundColor: '#F0F2F5', borderRadius: 8, padding: 12, fontSize: 16 },
    bookCard: { flexDirection: 'row', backgroundColor: '#FFF', marginBottom: 12, borderRadius: 10, padding: 10, elevation: 2 },
    bookCover: { width: 70, height: 100, borderRadius: 6, backgroundColor: '#eee' },
    bookInfo: { flex: 1, marginLeft: 15, justifyContent: 'center' },
    bookTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    bookAuthor: { fontSize: 14, color: '#666', marginBottom: 4 },
    bookMeta: { fontSize: 12, color: '#999', marginBottom: 6 },
    statusRow: { flexDirection: 'row', alignItems: 'center' },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontSize: 11, fontWeight: 'bold', overflow: 'hidden' },
    avail: { backgroundColor: '#DEF7EC', color: '#03543F' },
    out: { backgroundColor: '#FDE8E8', color: '#9B1C1C' },
    rack: { marginLeft: 10, fontSize: 12, color: '#555' }
});

export default BookListScreen;