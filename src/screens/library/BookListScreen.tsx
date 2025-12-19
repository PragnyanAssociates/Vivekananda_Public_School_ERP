import React, { useState, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TextInput, Image, 
    TouchableOpacity, ActivityIndicator, RefreshControl 
} from 'react-native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const BookListScreen = () => {
    const navigation = useNavigation();
    const [books, setBooks] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Fetch books when screen focuses or search changes
    useFocusEffect(
        useCallback(() => {
            fetchBooks();
        }, [search])
    );

    const fetchBooks = async () => {
        try {
            const res = await apiClient.get('/library/books', { params: { search } });
            setBooks(res.data);
        } catch (error) { 
            console.error(error); 
        } finally { 
            setLoading(false); 
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchBooks();
    };

    const renderBookCard = ({ item }) => {
        const imageUrl = item.cover_image_url 
            ? `${SERVER_URL}${item.cover_image_url}` 
            : 'https://via.placeholder.com/150/CCCCCC/FFFFFF?text=No+Cover';
        
        const isAvailable = item.available_copies > 0;

        return (
            <TouchableOpacity 
                style={styles.card} 
                onPress={() => navigation.navigate('BookDetailsScreen', { book: item })}
                activeOpacity={0.8}
            >
                {/* Book Cover */}
                <View style={styles.imageContainer}>
                    <Image source={{ uri: imageUrl }} style={styles.coverImage} resizeMode="cover" />
                    <View style={[styles.badge, isAvailable ? styles.bgGreen : styles.bgRed]}>
                        <Text style={styles.badgeText}>{isAvailable ? 'Available' : 'Out'}</Text>
                    </View>
                </View>

                {/* Book Info */}
                <View style={styles.infoContainer}>
                    <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.author} numberOfLines={1}>{item.author}</Text>
                    <Text style={styles.bookNo}>No: {item.book_no}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Search Header */}
            <View style={styles.headerContainer}>
                <Text style={styles.screenTitle}>Library Collection</Text>
                <View style={styles.searchBox}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput 
                        style={styles.input} 
                        placeholder="Search by Title, Author, or No..." 
                        placeholderTextColor="#94A3B8"
                        value={search} 
                        onChangeText={setSearch} 
                    />
                </View>
                {/* Add Button Shortcut (Optional) */}
                <TouchableOpacity 
                    style={styles.fab}
                    onPress={() => navigation.navigate('AddBookScreen')}
                >
                    <Text style={styles.fabText}>+</Text>
                </TouchableOpacity>
            </View>

            {loading && !refreshing ? (
                <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 50 }} />
            ) : (
                <FlatList 
                    data={books} 
                    renderItem={renderBookCard} 
                    keyExtractor={(item) => item.id.toString()} 
                    numColumns={2} 
                    columnWrapperStyle={styles.rowWrapper} 
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No books found.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    headerContainer: { padding: 20, backgroundColor: '#FFF', paddingBottom: 15, elevation: 2 },
    screenTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B', marginBottom: 15 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 12 },
    searchIcon: { fontSize: 16, marginRight: 8 },
    input: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#334155' },
    
    // FAB for adding
    fab: { position: 'absolute', right: 20, top: 20, backgroundColor: '#2563EB', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 4 },
    fabText: { color: '#FFF', fontSize: 24, marginTop: -2 },

    listContent: { padding: 12, paddingBottom: 40 },
    rowWrapper: { justifyContent: 'space-between' },
    
    card: { 
        width: '48%', 
        backgroundColor: '#FFF', 
        borderRadius: 12, 
        marginBottom: 16, 
        elevation: 3, 
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 5,
        overflow: 'hidden'
    },
    imageContainer: { height: 180, width: '100%', position: 'relative' },
    coverImage: { width: '100%', height: '100%' },
    badge: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    bgGreen: { backgroundColor: 'rgba(34, 197, 94, 0.9)' },
    bgRed: { backgroundColor: 'rgba(239, 68, 68, 0.9)' },
    badgeText: { fontSize: 10, fontWeight: 'bold', color: '#FFF' },
    
    infoContainer: { padding: 10 },
    title: { fontSize: 14, fontWeight: 'bold', color: '#1E293B', marginBottom: 4, height: 40 },
    author: { fontSize: 12, color: '#64748B', marginBottom: 2 },
    bookNo: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
    
    emptyState: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: '#94A3B8', fontSize: 16 }
});

export default BookListScreen;