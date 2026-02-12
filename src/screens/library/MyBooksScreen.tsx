/**
 * File: src/screens/library/MyBooksScreen.js
 * Purpose: Display a student's borrowed books and their return status/dates.
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI Header.
 */
import React, { useState, useCallback, useLayoutEffect } from 'react';
import { 
    View, Text, StyleSheet, FlatList, ActivityIndicator, 
    RefreshControl, Image, StatusBar, SafeAreaView, TouchableOpacity, useColorScheme, Dimensions
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
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
    iconBg: '#E0F2F1',
    success: '#43A047',
    danger: '#E53935',
    warning: '#D97706',
    blue: '#1E88E5',
    dateContainerBg: '#F8FAFC',
    dateDivider: '#E0E0E0',
    badgePendingBg: '#FEF3C7',
    badgeReturnedBg: '#D1FAE5',
    badgeRejectedBg: '#FEE2E2',
    badgeOverdueBg: '#FEE2E2',
    badgeIssuedBg: '#DBEAFE',
    badgeDefaultBg: '#F1F5F9',
    bookNoText: '#90A4AE',
    white: '#ffffff'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212', 
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    iconBg: '#333333',
    success: '#4CAF50',
    danger: '#EF5350',
    warning: '#FFB300',
    blue: '#42A5F5',
    dateContainerBg: '#252525',
    dateDivider: '#444444',
    badgePendingBg: '#42381A',
    badgeReturnedBg: '#14532D',
    badgeRejectedBg: '#7F1D1D',
    badgeOverdueBg: '#7F1D1D',
    badgeIssuedBg: '#1A365D',
    badgeDefaultBg: '#333333',
    bookNoText: '#64748B',
    white: '#ffffff'
};

const MyBooksScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const navigation = useNavigation();

    // Hide default header
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // --- Fetch Data ---
    const fetchHistory = async () => {
        try {
            const response = await apiClient.get('/library/student/history');
            setData(response.data || []);
        } catch (error) {
            console.error("Error fetching my books:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchHistory();
        }, [])
    );

    // --- Helper: Format Date ---
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const d = new Date(dateString);
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    };

    // --- Helper: Get Status Style ---
    const getStatusStyle = (status, returnDate) => {
        const isOverdue = status === 'approved' && new Date(returnDate) < new Date();
        
        switch (status) {
            case 'pending': return { color: theme.warning, bg: theme.badgePendingBg, label: 'Pending' };
            case 'returned': return { color: theme.success, bg: theme.badgeReturnedBg, label: 'Returned' };
            case 'rejected': return { color: theme.danger, bg: theme.badgeRejectedBg, label: 'Rejected' };
            case 'approved': 
                return isOverdue 
                    ? { color: theme.danger, bg: theme.badgeOverdueBg, label: 'Overdue' }
                    : { color: theme.blue, bg: theme.badgeIssuedBg, label: 'Issued' };
            default: return { color: theme.textSub, bg: theme.badgeDefaultBg, label: status };
        }
    };

    const renderItem = ({ item, index }) => {
        const statusStyle = getStatusStyle(item.status, item.expected_return_date);
        const imageUrl = item.cover_image_url 
            ? `${SERVER_URL}${item.cover_image_url}` 
            : 'https://via.placeholder.com/150/CCCCCC/FFFFFF?text=No+Cover';

        return (
            <Animatable.View animation="fadeInUp" duration={500} delay={index * 50}>
                <View style={[styles.card, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                    {/* Book Image */}
                    <Image source={{ uri: imageUrl }} style={styles.bookCover} resizeMode="cover" />
                    
                    {/* Content */}
                    <View style={styles.content}>
                        <View style={styles.headerRow}>
                            <Text style={[styles.title, { color: theme.textMain }]} numberOfLines={1}>{item.book_title}</Text>
                            <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                                <Text style={[styles.badgeText, { color: statusStyle.color }]}>
                                    {statusStyle.label}
                                </Text>
                            </View>
                        </View>
                        
                        <Text style={[styles.author, { color: theme.textSub }]}>by {item.author}</Text>
                        <Text style={[styles.bookNo, { color: theme.bookNoText }]}>ID: {item.book_no}</Text>

                        {/* Dates Section */}
                        <View style={[styles.dateContainer, { backgroundColor: theme.dateContainerBg, borderColor: theme.border }]}>
                            <View style={styles.dateBox}>
                                <Text style={[styles.dateLabel, { color: theme.textSub }]}>Borrowed</Text>
                                <Text style={[styles.dateValue, { color: theme.textMain }]}>{formatDate(item.borrow_date)}</Text>
                            </View>
                            <View style={[styles.divider, { backgroundColor: theme.dateDivider }]} />
                            <View style={styles.dateBox}>
                                <Text style={[styles.dateLabel, { color: theme.textSub }]}>
                                    {item.status === 'returned' ? 'Returned' : 'Due Date'}
                                </Text>
                                <Text style={[
                                    styles.dateValue, 
                                    { color: theme.textMain },
                                    item.status === 'returned' && { color: theme.success, fontWeight: 'bold' }
                                ]}>
                                    {item.status === 'returned' 
                                        ? formatDate(item.actual_return_date) 
                                        : formatDate(item.expected_return_date)
                                    }
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </Animatable.View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar backgroundColor={theme.background} barStyle={isDark ? 'light-content' : 'dark-content'} />
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    {/* Back Button */}
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={theme.textMain} />
                    </TouchableOpacity>

                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialCommunityIcons name="history" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>My History</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Borrowed Books</Text>
                    </View>
                </View>
            </View>
            
            {loading ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={data}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl 
                            refreshing={refreshing} 
                            onRefresh={() => { setRefreshing(true); fetchHistory(); }} 
                            colors={[theme.primary]} 
                            tintColor={theme.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="book-open-page-variant" size={50} color={theme.border} />
                            <Text style={[styles.emptyText, { color: theme.textSub }]}>You haven't borrowed any books yet.</Text>
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
    headerSubtitle: { fontSize: 13, marginTop: 2 },

    listContent: { paddingHorizontal: width * 0.03, paddingBottom: 20 },
    
    // Card Styles
    card: { 
        flexDirection: 'row',
        borderRadius: 12, 
        marginBottom: 12, 
        padding: 12,
        elevation: 2,
        shadowOpacity: 0.05,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 }
    },
    bookCover: {
        width: 70,
        height: 100,
        borderRadius: 8,
        backgroundColor: '#eee'
    },
    content: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'space-between'
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    title: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
        marginRight: 8
    },
    author: {
        fontSize: 12,
        marginBottom: 2
    },
    bookNo: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 8
    },
    
    // Badge
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase'
    },

    // Dates
    dateContainer: {
        flexDirection: 'row',
        borderRadius: 8,
        padding: 8,
        alignItems: 'center',
        borderWidth: 1,
    },
    dateBox: {
        flex: 1,
        alignItems: 'center'
    },
    divider: {
        width: 1,
        height: '70%',
    },
    dateLabel: {
        fontSize: 10,
        marginBottom: 2,
        textTransform: 'uppercase',
        fontWeight: '600'
    },
    dateValue: {
        fontSize: 12,
        fontWeight: '600'
    },

    // Empty State
    emptyContainer: {
        alignItems: 'center',
        marginTop: 80
    },
    emptyText: {
        fontSize: 16,
        marginTop: 10,
        textAlign: 'center'
    }
});

export default MyBooksScreen;