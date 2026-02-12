/**
 * File: src/screens/library/DigitalLibraryScreen.js
 * Purpose: Display and search digital library resources (E-Books, PDFs, etc.).
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI Header.
 */
import React, { useState, useCallback, useLayoutEffect } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    ActivityIndicator, Image, TextInput, RefreshControl, SafeAreaView, Dimensions,
    useColorScheme, StatusBar
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
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
    imageBg: '#EFF6FF',
    categoryBg: '#E0F2F1',
    categoryText: '#008080',
    bookNoText: '#94A3B8',
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
    imageBg: '#252525',
    categoryBg: '#0f3d3d', // Darker teal
    categoryText: '#4dd0e1', // Lighter teal for text
    bookNoText: '#64748B',
    emptyIcon: '#475569'
};

const DigitalLibraryScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const navigation = useNavigation();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');

    // Hide default header to use our custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    useFocusEffect(
        useCallback(() => {
            fetchResources();
        }, [search])
    );

    const fetchResources = async () => {
        try {
            const res = await apiClient.get('/library/digital', { params: { search } });
            setResources(res.data);
        } catch (e) { 
            console.error(e); 
        } finally { 
            setLoading(false); 
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchResources();
    };

    const renderCard = ({ item, index }) => {
        const coverUrl = item.cover_image_url 
            ? `${SERVER_URL}${item.cover_image_url}` 
            : 'https://via.placeholder.com/150/CCCCCC/FFFFFF?text=E-Book';

        return (
            <Animatable.View animation="fadeInUp" duration={500} delay={index * 50} style={styles.cardWrapper}>
                <TouchableOpacity 
                    style={[styles.card, { backgroundColor: theme.cardBg, shadowColor: theme.border }]} 
                    onPress={() => navigation.navigate('DigitalResourceDetailsScreen', { resource: item })} 
                    activeOpacity={0.9}
                >
                    <View style={[styles.imageContainer, { backgroundColor: theme.imageBg }]}>
                        <Image source={{ uri: coverUrl }} style={styles.coverImage} resizeMode="cover" />
                        <View style={styles.typeBadge}>
                            <Text style={styles.typeText}>E-BOOK</Text>
                        </View>
                    </View>
                    
                    <View style={styles.info}>
                        <Text style={[styles.title, { color: theme.textMain }]} numberOfLines={2}>{item.title}</Text>
                        <Text style={[styles.author, { color: theme.textSub }]} numberOfLines={1}>by {item.author}</Text>
                        
                        <View style={styles.metaRow}>
                            {item.category ? (
                                <View style={[styles.categoryBadge, { backgroundColor: theme.categoryBg }]}>
                                    <Text style={[styles.categoryText, { color: theme.categoryText }]} numberOfLines={1}>{item.category}</Text>
                                </View>
                            ) : <View/>}
                            <Text style={[styles.bookNo, { color: theme.bookNoText }]}>ID: {item.book_no || 'N/A'}</Text>
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
                        <MaterialCommunityIcons name="cloud-download-outline" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Digital Library</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>E-Books & Resources</Text>
                    </View>
                </View>

                {/* Add Button (Admin Only) */}
                {isAdmin && (
                    <TouchableOpacity 
                        style={[styles.headerBtn, { backgroundColor: theme.primary }]} 
                        onPress={() => navigation.navigate('AddDigitalResourceScreen')}
                    >
                        <MaterialIcons name="add" size={18} color="#fff" />
                        <Text style={styles.headerBtnText}>Add</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* --- SEARCH BAR --- */}
            <View style={[styles.searchContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                <MaterialIcons name="search" size={22} color={theme.textSub} style={styles.searchIcon} />
                <TextInput 
                    style={[styles.searchInput, { color: theme.textMain }]} 
                    placeholder="Search by Title, Author..." 
                    placeholderTextColor={theme.textPlaceholder}
                    value={search} 
                    onChangeText={setSearch} 
                />
            </View>

            {loading && !refreshing ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList 
                    data={resources} 
                    renderItem={renderCard} 
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
                            <MaterialCommunityIcons name="file-document-outline" size={60} color={theme.emptyIcon} />
                            <Text style={[styles.emptyText, { color: theme.textSub }]}>No digital resources found.</Text>
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
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13, marginTop: 2 },
    headerBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 10,
    },
    headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

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
        maxWidth: '50%', // Ensures exact 2-column fit across devices
        padding: 6,
    },
    card: { 
        borderRadius: 12, 
        elevation: 3, 
        shadowOpacity: 0.1, 
        shadowRadius: 5, 
        overflow: 'hidden',
        height: 250, // Fixed uniform height
        flexDirection: 'column',
        shadowOffset: { width: 0, height: 2 }
    },
    imageContainer: { 
        height: 140, 
        justifyContent: 'center', 
        alignItems: 'center', 
        position: 'relative' 
    },
    coverImage: { width: '100%', height: '100%' },
    typeBadge: { 
        position: 'absolute', 
        top: 8, 
        left: 8, 
        backgroundColor: 'rgba(0,0,0,0.6)', 
        paddingHorizontal: 6, 
        paddingVertical: 2, 
        borderRadius: 4 
    },
    typeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    
    info: { padding: 10, flex: 1, justifyContent: 'space-between' },
    title: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
    author: { fontSize: 12 },
    
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
    categoryBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, flexShrink: 1, marginRight: 5 },
    categoryText: { fontSize: 10, fontWeight: '600' },
    bookNo: { fontSize: 10, fontWeight: 'bold' },

    emptyState: { alignItems: 'center', marginTop: 50 },
    emptyText: { textAlign: 'center', fontSize: 16, marginTop: 10 }
});

export default DigitalLibraryScreen;