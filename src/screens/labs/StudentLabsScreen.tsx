/**
 * File: src/screens/labs/StudentLabsScreen.tsx
 * Purpose: Display list of Digital Labs assigned to the student's class.
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI Header.
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

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
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
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const { user } = useAuth();
    const navigation = useNavigation();
    
    const [labs, setLabs] = useState<Lab[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Hide default header to use our custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const fetchLabs = useCallback(async () => {
        if (!user || !user.class_group) {
            setError('Could not determine your class. Please log in again.');
            setIsLoading(false);
            setIsRefreshing(false);
            return;
        }
        try {
            setError(null);
            const response = await apiClient.get(`/labs/student/${user.class_group}`);
            setLabs(response.data);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to fetch Digital Labs.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [user]);

    useEffect(() => {
        fetchLabs();
    }, [fetchLabs]);

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchLabs();
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.centered, { backgroundColor: theme.background }]}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
                <ActivityIndicator size="large" color={theme.primary} />
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={[styles.centered, { backgroundColor: theme.background }]}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
                <MaterialIcons name="error-outline" size={40} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            </SafeAreaView>
        );
    }

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
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Digital Labs</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Interactive Resources</Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={labs}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    // Wrapper ensures exact alignment with Header Card width
                    <View style={styles.cardWrapper}>
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
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 10,    // Reduced top margin
        marginBottom: 8,  // Reduced bottom margin
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

    // --- LIST STYLES ---
    cardWrapper: {
        width: '100%', 
        alignSelf: 'center',
        marginBottom: 5,   // Space between cards
    },

    // --- STATES ---
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
    emptyText: { fontSize: 16, textAlign: 'center', marginTop: 10 },
    errorText: { fontSize: 16, textAlign: 'center', marginTop: 10 },
});

export default StudentLabsScreen;