/**
 * File: src/screens/library/BookListScreen.js
 * Purpose: View the library catalog with search and availability status.
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI Header.
 */
import React, { useState, useCallback, useLayoutEffect } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TextInput, Image, 
    TouchableOpacity, ActivityIndicator, RefreshControl, SafeAreaView, Dimensions,
    useColorScheme, StatusBar
} from 'react-native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#cbd5e1',
    inputBg: '#FFFFFF',
    inputBorder: '#cbd5e1',
    iconBg: '#E0F2F1',
    textPlaceholder: '#94a3b8',
    white: '#ffffff',
    badgeGreen: 'rgba(34, 197, 94, 0.9)',
    badgeRed: 'rgba(239, 68, 68, 0.9)',
    bookNoText: '#90A4AE',
    imageBg: '#EEEEEE',
    emptyIcon: '#CFD8DC'
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
    badgeGreen: 'rgba(21, 128, 61, 0.9)',
    badgeRed: 'rgba(185, 28, 28, 0.9)',
    bookNoText: '#64748b',
    imageBg: '#252525',
    emptyIcon: '#475569'
};

const BookListScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const navigation = useNavigation();
    const [books, setBooks] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    // Hide default header to use our custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

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

    const renderBookCard = ({ item, index }) => {
        const imageUrl = item.cover_image_url 
            ? `${SERVER_URL}${item.cover_image_url}` 
            : 'https://via.placeholder.com/150/CCCCCC/FFFFFF?text=No+Cover';
        
        const isAvailable = item.available_copies > 0;

        return (
            <Animatable.View animation="fadeInUp" duration={500} delay={index * 50} style={styles.cardWrapper}>
                <TouchableOpacity 
                    style={[styles.card, { backgroundColor: theme.cardBg, shadowColor: theme.border }]} 
                    onPress={() => navigation.navigate('BookDetailsScreen', { book: item })}
                    activeOpacity={0.9}
                >
                    <View style={[styles.imageContainer, { backgroundColor: theme.imageBg }]}>
                        <Image source={{ uri: imageUrl }} style={styles.coverImage} resizeMode="cover" />
                        <View style={[styles.badge, { backgroundColor: isAvailable ? theme.badgeGreen : theme.badgeRed }]}>
                            <Text style={[styles.badgeText, { color: '#ffffff' }]}>{isAvailable ? 'Available' : 'Out'}</Text>
                        </View>
                    </View>

                    <View style={styles.infoContainer}>
                        <Text style={[styles.title, { color: theme.textMain }]} numberOfLines={2}>{item.title}</Text>
                        <Text style={[styles.author, { color: theme.textSub }]} numberOfLines={1}>{item.author}</Text>
                        <View style={styles.footerRow}>
                            <Text style={[styles.bookNo, { color: theme.bookNoText }]}>ID: {item.book_no}</Text>
                            {/* Visual indicator for copies */}
                            <Text style={[styles.copiesText, { color: theme.primary }]}>{item.available_copies} Left</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </Animatable.View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    {/* Back Button */}
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={theme.textMain} />
                    </TouchableOpacity>

                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialCommunityIcons name="library" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Library</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Books Collection</Text>
                    </View>
                </View>
                
                {/* Add Button (Admin Only) */}
                {isAdmin && (
                    <TouchableOpacity 
                        style={[styles.headerBtn, { backgroundColor: theme.primary }]}
                        onPress={() => navigation.navigate('AddBookScreen')}
                    >
                        <MaterialIcons name="add" size={18} color="#ffffff" />
                        <Text style={[styles.headerBtnText, { color: '#ffffff' }]}>Add</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* --- SEARCH BAR --- */}
            <View style={[styles.searchContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                <MaterialIcons name="search" size={22} color={theme.textSub} style={styles.searchIcon} />
                <TextInput 
                    style={[styles.searchInput, { color: theme.textMain }]} 
                    placeholder="Search by Title, Author, or No..." 
                    placeholderTextColor={theme.textPlaceholder}
                    value={search} 
                    onChangeText={setSearch} 
                />
            </View>

            {loading && !refreshing ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList 
                    data={books} 
                    renderItem={renderBookCard} 
                    keyExtractor={(item) => item.id.toString()} 
                    numColumns={2} 
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl 
                            refreshing={refreshing} 
                            onRefresh={onRefresh} 
                            colors={[theme.primary]} 
                            tintColor={theme.primary} 
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MaterialIcons name="menu-book" size={60} color={theme.emptyIcon} />
                            <Text style={[styles.emptyText, { color: theme.textSub }]}>No books found.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
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
        justifyContent: 'space-between',
        elevation: 3,
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
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
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },
    headerBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 10,
    },
    headerBtnText: { fontSize: 12, fontWeight: '600' },

    // --- SEARCH BAR ---
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        marginHorizontal: 15,
        marginBottom: 10,
        paddingHorizontal: 10,
        height: 45,
        borderWidth: 1,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 16 },

    // --- GRID LIST ---
    listContent: { paddingHorizontal: 8, paddingBottom: 40 },
    cardWrapper: {
        flex: 1,
        maxWidth: '50%', // Ensures exactly 2 columns perfectly spaced
        padding: 6,
    },
    card: { 
        borderRadius: 12, 
        elevation: 3, 
        shadowOpacity: 0.1, 
        shadowRadius: 5, 
        overflow: 'hidden',
        height: 250, // Fixed height for uniformity
        flexDirection: 'column',
        shadowOffset: { width: 0, height: 2 },
    },
    imageContainer: { 
        height: 160, 
        width: '100%', 
        position: 'relative' 
    },
    coverImage: { width: '100%', height: '100%' },
    badge: { 
        position: 'absolute', 
        top: 8, 
        right: 8, 
        paddingHorizontal: 8, 
        paddingVertical: 4, 
        borderRadius: 6 
    },
    badgeText: { fontSize: 10, fontWeight: 'bold' },
    
    infoContainer: { padding: 10, flex: 1, justifyContent: 'space-between' },
    title: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
    author: { fontSize: 12 },
    
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
    bookNo: { fontSize: 11, fontWeight: '600' },
    copiesText: { fontSize: 11, fontWeight: 'bold' },

    emptyState: { alignItems: 'center', marginTop: 50 },
    emptyText: { fontSize: 16, marginTop: 10 }
});

export default BookListScreen;