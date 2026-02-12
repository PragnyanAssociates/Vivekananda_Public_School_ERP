/**
 * File: src/screens/study-materials/StudentMaterialsScreen.tsx
 * Purpose: View study materials assigned to the student's class group.
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI Header.
 */
import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    ActivityIndicator, Alert, Linking, SafeAreaView, Dimensions,
    useColorScheme, StatusBar
} from 'react-native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useIsFocused } from '@react-navigation/native';
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
    iconBoxBg: '#F0F2F5',
    blue: '#1E88E5',
    purple: '#8E24AA',
    white: '#ffffff',
    emptyIcon: '#CFD8DC'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212', 
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    iconBg: '#333333',
    iconBoxBg: '#2C2C2C',
    blue: '#42A5F5',
    purple: '#AB47BC',
    white: '#ffffff',
    emptyIcon: '#475569'
};

const StudentMaterialsScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const { user } = useAuth();
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    const [materials, setMaterials] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Hide default header to use our custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const fetchMaterials = useCallback(async () => {
        if (!user?.class_group) return;
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/study-materials/student/${user.class_group}`);
            setMaterials(response.data);
        } catch (error) {
            Alert.alert("Error", error.response?.data?.message || "Failed to fetch study materials.");
        } finally {
            setIsLoading(false);
        }
    }, [user?.class_group]);

    useEffect(() => {
        if (isFocused) {
            fetchMaterials();
        }
    }, [isFocused, fetchMaterials]);

    const getIconForType = (type) => {
        switch (type) {
            case 'Notes': return 'note-text-outline';
            case 'Presentation': return 'projector-screen';
            case 'Video Lecture': return 'video-outline';
            case 'Worksheet': return 'file-document-edit-outline';
            case 'Link': return 'link-variant';
            default: return 'folder-outline';
        }
    };

    const renderItem = ({ item, index }) => (
        <Animatable.View animation="fadeInUp" duration={500} delay={index * 100} style={styles.cardWrapper}>
            <View style={[styles.card, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.cardTop}>
                    <View style={[styles.iconBox, { backgroundColor: theme.iconBoxBg }]}>
                        <MaterialCommunityIcons name={getIconForType(item.material_type)} size={22} color={theme.primary} />
                    </View>
                    <Text style={[styles.cardDate, { color: theme.textSub }]}>
                        {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                    </Text>
                </View>
                
                <Text style={[styles.cardTitle, { color: theme.textMain }]} numberOfLines={2}>{item.title}</Text>
                <Text style={[styles.cardInfo, { color: theme.primary }]}>{item.subject} • {item.material_type}</Text>
                
                {item.description ? (
                    <Text style={[styles.cardDescription, { color: theme.textSub }]} numberOfLines={3}>{item.description}</Text>
                ) : <View style={{flex: 1}} />}
                
                <View style={styles.buttonContainer}>
                    {item.file_path && (
                        <TouchableOpacity 
                            style={[styles.actionButton, { backgroundColor: theme.blue }]} 
                            onPress={() => Linking.openURL(`${SERVER_URL}${item.file_path}`)}
                        >
                            <MaterialIcons name="cloud-download" size={18} color={theme.white} />
                            <Text style={[styles.actionButtonText, { color: theme.white }]}>Download</Text>
                        </TouchableOpacity>
                    )}
                    {item.external_link && (
                        <TouchableOpacity 
                            style={[styles.actionButton, { backgroundColor: theme.purple, marginTop: item.file_path ? 8 : 0 }]}
                            onPress={() => Linking.openURL(item.external_link)}
                        >
                            <MaterialIcons name="open-in-new" size={18} color={theme.white} />
                            <Text style={[styles.actionButtonText, { color: theme.white }]}>Visit Link</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Animatable.View>
    );

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
                        <MaterialCommunityIcons name="bookshelf" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Study Materials</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Notes & Resources</Text>
                    </View>
                </View>
            </View>

            {isLoading ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={materials}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.material_id.toString()}
                    numColumns={2}
                    contentContainerStyle={styles.listContentContainer}
                    onRefresh={fetchMaterials}
                    refreshing={isLoading}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="folder-open-outline" size={50} color={theme.emptyIcon} />
                            <Text style={[styles.emptyText, { color: theme.textSub }]}>No study materials found for your class.</Text>
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

    // --- GRID LIST ---
    listContentContainer: { paddingHorizontal: 8, paddingBottom: 20 },
    cardWrapper: {
        width: '50%', // Ensures exactly 2 columns perfectly spaced
        padding: 6,
    },
    card: {
        borderRadius: 12,
        padding: 12,
        elevation: 2,
        shadowOpacity: 0.08,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
        height: 240, // Fixed height for uniformity
        flexDirection: 'column',
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    iconBox: { padding: 6, borderRadius: 8 },
    cardDate: { fontSize: 11, fontWeight: '500' },
    
    cardTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4, lineHeight: 18 },
    cardInfo: { fontSize: 11, marginBottom: 6, fontWeight: '600' },
    cardDescription: { fontSize: 12, lineHeight: 16, marginBottom: 10, flex: 1 },
    
    buttonContainer: { marginTop: 'auto' },
    actionButton: { 
        flexDirection: 'row', 
        paddingVertical: 8, 
        borderRadius: 6, 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    actionButtonText: { fontWeight: 'bold', marginLeft: 6, fontSize: 12 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
    emptyText: { textAlign: 'center', fontSize: 16, marginTop: 10 },
});

export default StudentMaterialsScreen;