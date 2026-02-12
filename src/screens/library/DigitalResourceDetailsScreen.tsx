/**
 * File: src/screens/library/DigitalResourceDetailsScreen.js
 * Purpose: View details of a digital resource, download, or view it. Admin actions included.
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI Header.
 */
import React, { useState, useLayoutEffect } from 'react';
import { 
    View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, 
    Alert, ActivityIndicator, Linking, SafeAreaView, 
    useColorScheme, StatusBar, Dimensions 
} from 'react-native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useAuth } from '../../context/AuthContext'; 
import { useNavigation, useRoute } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

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
    imageHeaderBg: '#F1F5F9',
    tagBg: '#E0F2F1',
    tagText: '#008080',
    tagGrayBg: '#F1F5F9',
    tagGrayText: '#64748B',
    editBtn: '#F59E0B',
    deleteBtn: '#EF4444',
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
    imageHeaderBg: '#1A1A1A',
    tagBg: '#0f3d3d',
    tagText: '#4dd0e1',
    tagGrayBg: '#252525',
    tagGrayText: '#94A3B8',
    editBtn: '#F59E0B',
    deleteBtn: '#EF4444',
    white: '#ffffff'
};

const DigitalResourceDetailsScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const route = useRoute();
    const navigation = useNavigation();
    const { resource } = route.params;
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [loading, setLoading] = useState(false);

    // Hide default header
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const coverUrl = resource.cover_image_url 
        ? `${SERVER_URL}${resource.cover_image_url}` 
        : 'https://via.placeholder.com/300/CCCCCC/FFFFFF?text=No+Cover';

    const fullFileUrl = `${SERVER_URL}${resource.file_url}`;

    // --- 1. VIEW FUNCTION (Opens inside App) ---
    const handleView = () => {
        if (!resource.file_url) return;
        navigation.navigate('DocumentViewerScreen', { url: fullFileUrl });
    };

    // --- 2. DOWNLOAD FUNCTION (Opens in Browser/Download Manager) ---
    const handleDownload = () => {
        if (!resource.file_url) return;
        Linking.openURL(fullFileUrl);
    };

    const handleDelete = async () => {
        Alert.alert("Confirm Delete", "Are you sure you want to delete this resource?", [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete", 
                style: 'destructive', 
                onPress: async () => {
                    setLoading(true);
                    try {
                        await apiClient.delete(`/library/digital/${resource.id}`);
                        Alert.alert("Success", "Resource deleted successfully.");
                        navigation.goBack();
                    } catch (error) {
                        Alert.alert("Error", "Failed to delete.");
                    } finally { setLoading(false); }
                }
            }
        ]);
    };

    const handleEdit = () => {
        navigation.navigate('AddDigitalResourceScreen', { resource: resource });
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
                        <MaterialCommunityIcons name="file-document-outline" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Resource Details</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Digital Library</Text>
                    </View>
                </View>
            </View>

            <ScrollView style={styles.container} bounces={false} showsVerticalScrollIndicator={false}>
                {/* Cover Image Header */}
                <View style={[styles.imageHeader, { backgroundColor: theme.imageHeaderBg, borderColor: theme.border }]}>
                    <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="contain" />
                </View>

                <View style={styles.content}>
                    {/* Book Info */}
                    <Text style={[styles.title, { color: theme.textMain }]}>{resource.title}</Text>
                    <Text style={[styles.author, { color: theme.textSub }]}>by {resource.author}</Text>

                    <View style={styles.tags}>
                        {resource.category && (
                            <Text style={[styles.tag, { backgroundColor: theme.tagBg, color: theme.tagText }]}>
                                {resource.category}
                            </Text>
                        )}
                        {resource.book_no && (
                            <Text style={[styles.tag, { backgroundColor: theme.tagGrayBg, color: theme.tagGrayText }]}>
                                Ref: {resource.book_no}
                            </Text>
                        )}
                    </View>

                    <View style={[styles.divider, { backgroundColor: theme.border }]} />

                    <Text style={[styles.label, { color: theme.textSub }]}>Publisher</Text>
                    <Text style={[styles.value, { color: theme.textMain }]}>{resource.publisher || 'N/A'}</Text>

                    {/* --- ACTION BUTTONS (View / Download) --- */}
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={[styles.viewBtn, { backgroundColor: theme.primary }]} onPress={handleView}>
                            <Text style={[styles.viewBtnText, { color: theme.white }]}>👁 View</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={[styles.downloadBtn, { backgroundColor: theme.cardBg, borderColor: theme.primary }]} 
                            onPress={handleDownload}
                        >
                            <Text style={[styles.downloadBtnText, { color: theme.primary }]}>⬇ Download</Text>
                        </TouchableOpacity>
                    </View>

                    {/* --- ADMIN ACTIONS (Edit / Delete) --- */}
                    {isAdmin && (
                        <View style={[styles.adminSection, { borderColor: theme.border }]}>
                            <Text style={[styles.adminHeader, { color: theme.textSub }]}>Admin Actions</Text>
                            <View style={styles.adminRow}>
                                <TouchableOpacity style={[styles.editBtn, { backgroundColor: theme.editBtn }]} onPress={handleEdit}>
                                    <Text style={styles.btnTextWhite}>✏ Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: theme.deleteBtn }]} onPress={handleDelete}>
                                    {loading ? <ActivityIndicator color={theme.white} /> : <Text style={styles.btnTextWhite}>🗑 Delete</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

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
        marginBottom: 0, // No margin to connect with image header smoothly
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

    imageHeader: { 
        height: 260, 
        justifyContent: 'center', 
        alignItems: 'center', 
        borderBottomWidth: 1, 
        marginTop: 10 
    },
    cover: { 
        width: width * 0.45, // Responsive width
        height: width * 0.60, 
        borderRadius: 8, 
        shadowColor: '#000', 
        shadowOpacity: 0.2, 
        shadowRadius: 10, 
        elevation: 5 
    },
    
    content: { padding: width * 0.06 }, // Responsive padding
    title: { fontSize: 22, fontWeight: '800', marginBottom: 5 },
    author: { fontSize: 16, fontWeight: '500', marginBottom: 15 },
    
    tags: { flexDirection: 'row', marginBottom: 20, flexWrap: 'wrap' },
    tag: { 
        paddingHorizontal: 10, 
        paddingVertical: 5, 
        borderRadius: 6, 
        fontSize: 12, 
        fontWeight: 'bold', 
        marginRight: 10,
        marginBottom: 5
    },
    
    divider: { height: 1, marginVertical: 15 },
    label: { fontSize: 12, textTransform: 'uppercase', marginBottom: 4 },
    value: { fontSize: 16, fontWeight: '500', marginBottom: 20 },
    
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    viewBtn: { 
        flex: 1, 
        padding: 15, 
        borderRadius: 10, 
        marginRight: 10, 
        alignItems: 'center',
        elevation: 2
    },
    viewBtnText: { fontWeight: 'bold' },
    downloadBtn: { 
        flex: 1, 
        borderWidth: 2, 
        padding: 15, 
        borderRadius: 10, 
        alignItems: 'center' 
    },
    downloadBtnText: { fontWeight: 'bold' },

    adminSection: { marginTop: 40, borderTopWidth: 1, paddingTop: 20 },
    adminHeader: { fontSize: 14, fontWeight: 'bold', marginBottom: 15 },
    adminRow: { flexDirection: 'row', justifyContent: 'space-between' },
    editBtn: { flex: 1, padding: 15, borderRadius: 10, marginRight: 10, alignItems: 'center' },
    deleteBtn: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center' },
    btnTextWhite: { color: '#FFF', fontWeight: 'bold' },
});

export default DigitalResourceDetailsScreen;