/**
 * File: src/screens/labs/StudentLabsScreen.tsx
 * Purpose: Display list of Digital Labs assigned to the student's class.
 * Updated: 
 * - Fixed Responsive Layout for all screen sizes.
 * - Consistent Dark/Light mode colors.
 * - Full code provided with comments.
 */

import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { 
    View, Text, FlatList, StyleSheet, ActivityIndicator, 
    RefreshControl, SafeAreaView, useColorScheme, StatusBar, Dimensions 
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { LabCard, Lab } from './LabCard';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';

// Get screen dimensions to help with responsiveness
const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION (Master Style Guide) ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    iconBg: '#E0F2F1',
    danger: '#E53935',
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
    danger: '#EF5350',
    emptyIcon: '#475569'
};

const StudentLabsScreen = () => {
    // --- THEME HOOKS ---
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const { user } = useAuth();
    const navigation = useNavigation();
    
    // --- STATE MANAGEMENT ---
    const [labs, setLabs] = useState<Lab[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Hide default header to use our custom responsive header
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    // --- API CALLS ---
    const fetchLabs = useCallback(async () => {
        if (!user || !user.class_group) {
            setError('Could not determine your class. Please log in again.');
            setIsLoading(false);
            setIsRefreshing(false);
            return;
        }
        try {
            setError(null);
            // Fetch labs specific to student's class group
            const response = await apiClient.get(`/labs/student/${user.class_group}`);
            setLabs(response.data);
        } catch (e: any) {
            console.error("Fetch Labs Error:", e);
            setError(e.response?.data?.message || 'Failed to fetch Digital Labs.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [user]);

    // Initial Load
    useEffect(() => {
        fetchLabs();
    }, [fetchLabs]);

    // Pull-to-Refresh Handler
    const onRefresh = () => {
        setIsRefreshing(true);
        fetchLabs();
    };

    // --- LOADING STATE ---
    if (isLoading) {
        return (
            <SafeAreaView style={[styles.centered, { backgroundColor: theme.background }]}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
                <ActivityIndicator size="large" color={theme.primary} />
            </SafeAreaView>
        );
    }

    // --- ERROR STATE ---
    if (error) {
        return (
            <SafeAreaView style={[styles.centered, { backgroundColor: theme.background }]}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
                <MaterialIcons name="error-outline" size={40} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
                <Text style={[styles.retryText, { color: theme.primary }]} onPress={fetchLabs}>Tap to Retry</Text>
            </SafeAreaView>
        );
    }

    // --- MAIN RENDER ---
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialCommunityIcons name="monitor-dashboard" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>My Labs</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Course Resources</Text>
                    </View>
                </View>
            </View>

            {/* --- LAB LIST --- */}
            <FlatList
                data={labs}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.cardWrapper}>
                        {/* Render LabCard passing theme implicitly handled inside LabCard */}
                        <LabCard lab={item} />
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="beaker-outline" size={50} color={theme.emptyIcon} />
                        <Text style={[styles.emptyText, { color: theme.textSub }]}>No digital labs available for your class yet.</Text>
                    </View>
                }
                refreshControl={
                    <RefreshControl 
                        refreshing={isRefreshing} 
                        onRefresh={onRefresh} 
                        colors={[theme.primary]} 
                        tintColor={theme.primary}
                    />
                }
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
};

// --- STYLES ---
const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    
    // Header
    headerCard: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: width > 600 ? '90%' : '96%', // Responsive width
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 8,
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

    // List
    cardWrapper: {
        width: '100%', 
        alignItems: 'center',
        marginBottom: 5,
    },

    // Empty/Error States
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
    emptyText: { fontSize: 16, textAlign: 'center', marginTop: 10 },
    errorText: { fontSize: 16, textAlign: 'center', marginTop: 10, fontWeight: '500' },
    retryText: { fontSize: 14, marginTop: 10, textDecorationLine: 'underline' }
});

export default StudentLabsScreen;