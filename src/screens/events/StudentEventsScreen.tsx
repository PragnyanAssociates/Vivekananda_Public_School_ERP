/**
 * File: src/screens/events/StudentEventsScreen.tsx
 * Purpose: Display list of school events with details view.
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI Header.
 */
import React, { useState, useCallback, useLayoutEffect } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, 
    ActivityIndicator, ScrollView, SafeAreaView, useColorScheme, 
    StatusBar, Dimensions 
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import * as Animatable from 'react-native-animatable';

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
    dateBlockBg: '#E0F2F1',
    dateTextMain: '#004D40',
    dateTextSub: '#00695C',
    tagBg: '#f0fdfa',
    tagBorder: '#ccfbf1',
    tagText: '#00796B',
    divider: '#F0F0F0',
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
    dateBlockBg: '#004D40',
    dateTextMain: '#E0F2F1',
    dateTextSub: '#80CBC4',
    tagBg: '#134e4a',
    tagBorder: '#115e59',
    tagText: '#2dd4bf',
    divider: '#333333',
    white: '#ffffff',
    emptyIcon: '#475569'
};

const StudentEventsScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const navigation = useNavigation();
    const [view, setView] = useState('list');
    const [selectedEventId, setSelectedEventId] = useState(null);
    
    // Hide default header
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const handleViewDetails = (eventId) => { setSelectedEventId(eventId); setView('details'); };
    const handleBackToList = () => { setSelectedEventId(null); setView('list'); };
    
    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            {view === 'list' && <EventListView onViewDetails={handleViewDetails} theme={theme} />}
            {view === 'details' && <EventDetailsView eventId={selectedEventId} onBack={handleBackToList} theme={theme} />}
        </SafeAreaView>
    );
};

const EventListView = ({ onViewDetails, theme }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const navigation = useNavigation();

    const fetchEvents = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const response = await apiClient.get(`/events/all-for-user/${user.id}`);
            setEvents(response.data);
        } catch (error) { Alert.alert("Error", "Could not load school events."); }
        finally { setLoading(false); }
    }, [user]);

    useFocusEffect(
        useCallback(() => {
            fetchEvents();
        }, [])
    );

    return (
        <View style={styles.container}>
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={theme.textMain} />
                    </TouchableOpacity>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialCommunityIcons name="calendar-star" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>School Events</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Activities & Updates</Text>
                    </View>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={theme.primary} style={{marginTop: 40}} />
            ) : (
                <FlatList
                    data={events}
                    keyExtractor={item => item.id.toString()}
                    renderItem={({ item, index }) => (
                        <Animatable.View animation="fadeInUp" duration={500} delay={index * 100}>
                            <EventCard event={item} onViewDetails={onViewDetails} theme={theme} />
                        </Animatable.View>
                    )}
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <MaterialCommunityIcons name="calendar-remove" size={50} color={theme.emptyIcon} />
                            <Text style={[styles.emptyText, { color: theme.textSub }]}>No upcoming events found.</Text>
                        </View>
                    }
                    contentContainerStyle={styles.listContainer}
                />
            )}
        </View>
    );
};

const EventCard = ({ event, onViewDetails, theme }) => {
    const date = new Date(event.event_datetime);
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate();

    return (
        <View style={[styles.cardWrapper]}>
            <TouchableOpacity 
                activeOpacity={0.9} 
                onPress={() => onViewDetails(event.id)}
                style={[styles.card, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}
            >
                <View style={styles.cardContent}>
                    <View style={[styles.dateBlock, { backgroundColor: theme.dateBlockBg }]}>
                        <Text style={[styles.dateMonth, { color: theme.dateTextSub }]}>{month}</Text>
                        <Text style={[styles.dateDay, { color: theme.dateTextMain }]}>{day}</Text>
                    </View>
                    <View style={styles.detailsBlock}>
                        {event.category && (
                            <View style={[styles.tagContainer, { backgroundColor: theme.tagBg, borderColor: theme.tagBorder }]}>
                                <Text style={[styles.tagText, { color: theme.tagText }]}>{event.category}</Text>
                            </View>
                        )}
                        <Text style={[styles.cardTitle, { color: theme.textMain }]} numberOfLines={2}>{event.title}</Text>
                        <View style={styles.detailRow}>
                            <MaterialCommunityIcons name="map-marker-outline" size={14} color={theme.textSub} />
                            <Text style={[styles.detailText, { color: theme.textSub }]}>{event.location || 'TBD'}</Text>
                        </View>
                    </View>
                    <View style={styles.arrowContainer}>
                        <MaterialIcons name="chevron-right" size={24} color={theme.textSub} />
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    );
};

const EventDetailsView = ({ eventId, onBack, theme }) => {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchDetails = useCallback(async () => {
        if (!eventId) return;
        setLoading(true);
        try {
            const response = await apiClient.get(`/events/details/${eventId}`);
            setDetails(response.data);
        } finally { setLoading(false); }
    }, [eventId]);

    useFocusEffect(
        useCallback(() => {
            fetchDetails();
        }, [])
    );
    
    if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={theme.primary} /></View>;
    if (!details || !details.event) return ( <View style={styles.centered}><Text style={{color: theme.textMain}}>Event not found.</Text></View> );
    
    const { event } = details;
    const eventDate = new Date(event.event_datetime).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <View style={styles.container}>
            {/* --- HEADER CARD (With Back) --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={theme.textMain} />
                    </TouchableOpacity>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialCommunityIcons name="information-outline" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Event Details</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]} numberOfLines={1}>{event.title}</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.detailsPageContainer}>
                {event.category && (
                    <View style={[styles.tagContainerLarge, { backgroundColor: theme.iconBg }]}>
                        <Text style={[styles.tagTextLarge, { color: theme.primary }]}>{event.category}</Text>
                    </View>
                )}
                
                <Text style={[styles.detailsTitle, { color: theme.textMain }]}>{event.title}</Text>
                
                <View style={[styles.infoBox, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                    <InfoRow icon="calendar-clock" text={eventDate} theme={theme} />
                    <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                    <InfoRow icon="map-marker-outline" text={event.location || 'To be determined'} theme={theme} />
                    <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                    <InfoRow icon="account-group-outline" text={`For: ${event.target_class}`} theme={theme} />
                </View>
                
                <Text style={[styles.descriptionTitle, { color: theme.textMain }]}>About this Event</Text>
                <Text style={[styles.descriptionFull, { color: theme.textSub }]}>{event.description || 'No further details available.'}</Text>
            </ScrollView>
        </View>
    );
};

const InfoRow = ({ icon, text, theme }) => (
    <View style={styles.infoRow}>
        <MaterialCommunityIcons name={icon} size={20} color={theme.primary} style={{marginRight: 15}} />
        <Text style={[styles.infoText, { color: theme.textMain }]}>{text}</Text>
    </View>
);

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
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

    // List & Cards
    listContainer: { paddingHorizontal: width * 0.02, paddingBottom: 40 },
    cardWrapper: {
        width: '100%',
        paddingHorizontal: 10,
        marginBottom: 15
    },
    card: { 
        borderRadius: 12, 
        elevation: 2, 
        shadowOffset: { width: 0, height: 1 }, 
        shadowOpacity: 0.08, 
        shadowRadius: 3 
    },
    cardContent: { flexDirection: 'row', padding: 15, alignItems: 'center' },
    
    dateBlock: { 
        alignItems: 'center', 
        justifyContent: 'center', 
        borderRadius: 10, 
        paddingVertical: 8, 
        width: 60, 
        height: 65, 
        marginRight: 15 
    },
    dateMonth: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    dateDay: { fontSize: 22, fontWeight: 'bold', marginTop: -2 },
    
    detailsBlock: { flex: 1, justifyContent: 'center' },
    arrowContainer: { justifyContent: 'center', marginLeft: 5 },
    
    cardTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 4, marginBottom: 4 },
    
    tagContainer: { 
        alignSelf: 'flex-start', 
        paddingHorizontal: 8, 
        paddingVertical: 2, 
        borderRadius: 4, 
        marginBottom: 4, 
        borderWidth: 1 
    },
    tagText: { fontSize: 10, fontWeight: '700' },
    
    detailRow: { flexDirection: 'row', alignItems: 'center' },
    detailText: { fontSize: 13, marginLeft: 5 },

    emptyText: { textAlign: 'center', marginTop: 10, fontSize: 16 },

    // Details View
    detailsPageContainer: { paddingHorizontal: 20, paddingBottom: 40 },
    tagContainerLarge: { 
        alignSelf: 'flex-start', 
        paddingHorizontal: 12, 
        paddingVertical: 6, 
        borderRadius: 6, 
        marginBottom: 10, 
        marginTop: 10 
    },
    tagTextLarge: { fontSize: 12, fontWeight: 'bold' },
    
    detailsTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    
    infoBox: { 
        borderRadius: 12, 
        paddingVertical: 5, 
        paddingHorizontal: 15, 
        marginBottom: 25, 
        elevation: 1 
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
    infoText: { fontSize: 15, flex: 1 },
    divider: { height: 1 },

    descriptionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
    descriptionFull: { fontSize: 15, lineHeight: 24 },
});

export default StudentEventsScreen;