import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, FlatList, ActivityIndicator, StyleSheet, RefreshControl, 
    Linking, Alert, SafeAreaView, useColorScheme, Dimensions, StatusBar 
} from 'react-native';
import apiClient from '../../api/client';
import { MeetingCard, Meeting } from './MeetingCard'; // Ensure this path is correct
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F5F7FA',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    iconGrey: '#90A4AE',
    placeholder: '#B0BEC5'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    iconGrey: '#757575',
    placeholder: '#616161'
};

const StudentPTMScreen = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const colors = isDark ? DarkColors : LightColors;

    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchMeetings = useCallback(async () => {
        try {
            setError(null);
            const response = await apiClient.get('/ptm');
            setMeetings(response.data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Could not fetch meeting schedules.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchMeetings();
    }, [fetchMeetings]);

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchMeetings();
    };

    const handleJoinMeeting = (link: string) => {
        if (link) {
            Linking.openURL(link).catch(() => Alert.alert("Error", "Could not open the meeting link."));
        }
    };

    if (isLoading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <MaterialIcons name="error-outline" size={40} color="#ef4444" />
                <Text style={[styles.errorText, { color: colors.textMain }]}>{error}</Text>
                <Text style={[styles.retryText, { color: colors.textSub }]} onPress={fetchMeetings}>Tap to Retry</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: colors.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: isDark ? '#333' : '#E0F2F1' }]}>
                        <MaterialIcons name="groups" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: colors.textMain }]}>PTM Schedules</Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSub }]}>Parent-Teacher Meetings</Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={meetings}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.cardWrapper}>
                        <MeetingCard 
                            meeting={item} 
                            isAdmin={false} 
                            onJoin={handleJoinMeeting}
                        />
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.center}>
                        <MaterialIcons name="event-busy" size={50} color={colors.border} />
                        <Text style={[styles.emptyText, { color: colors.textSub }]}>No meetings scheduled.</Text>
                    </View>
                }
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
                }
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    
    // Header
    headerCard: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '95%',
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 3,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
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
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },

    // List
    cardWrapper: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 5,
    },
    
    emptyText: { textAlign: 'center', fontSize: 16, marginTop: 10 },
    errorText: { fontSize: 16, textAlign: 'center', marginTop: 10 },
    retryText: { fontSize: 14, marginTop: 5, textDecorationLine: 'underline' }
});

export default StudentPTMScreen;