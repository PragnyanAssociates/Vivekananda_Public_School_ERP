import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useNavigation } from '@react-navigation/native';

const BookListScreen = () => {
    const navigation = useNavigation();
    const [books, setBooks] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const timeout = setTimeout(() => fetchBooks(), 500);
        return () => clearTimeout(timeout);
    }, [search]);

    const fetchBooks = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/library/books', { params: { search } });
            setBooks(res.data);
        } catch (error) { console.error(error); } 
        finally { setLoading(false); }
    };

    const renderBook = ({ item }: {item:any}) => {
        const imageUrl = item.cover_image_url ? `${SERVER_URL}${item.cover_image_url}` : 'https://via.placeholder.com/150';
        return (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('BookDetailsScreen' as never, { book: item } as never)}>
                <Image source={{ uri: imageUrl }} style={styles.cover} />
                <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.author}>{item.author}</Text>
                    <View style={styles.row}>
                        <View style={[styles.badge, item.available_copies > 0 ? styles.bgGreen : styles.bgRed]}>
                            <Text style={styles.badgeText}>{item.available_copies > 0 ? 'Available' : 'Out of Stock'}</Text>
                        </View>
                        <Text style={styles.rack}>Rack: {item.rack_no}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.searchBox}>
                <TextInput style={styles.input} placeholder="Search books..." value={search} onChangeText={setSearch} />
            </View>
            {loading && <ActivityIndicator size="small" color="#2563EB" style={{margin:10}} />}
            <FlatList data={books} renderItem={renderBook} keyExtractor={(i:any) => i.id.toString()} contentContainerStyle={{ padding: 10 }} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F1F5F9' },
    searchBox: { padding: 15, backgroundColor: '#FFF' },
    input: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    card: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 10, marginBottom: 10, padding: 10, elevation: 2 },
    cover: { width: 70, height: 100, borderRadius: 5, backgroundColor: '#EEE' },
    info: { flex: 1, marginLeft: 15, justifyContent: 'center' },
    title: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
    author: { color: '#64748B', fontSize: 14, marginBottom: 6 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    bgGreen: { backgroundColor: '#DCFCE7' }, 
    bgRed: { backgroundColor: '#FEE2E2' },
    badgeText: { fontSize: 11, fontWeight: 'bold', color: '#334155' },
    rack: { fontSize: 12, color: '#94A3B8' }
});

export default BookListScreen;