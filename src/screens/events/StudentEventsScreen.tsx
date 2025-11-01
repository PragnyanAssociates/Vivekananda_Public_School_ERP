import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, ScrollView, SafeAreaView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import LinearGradient from 'react-native-linear-gradient';

const THEME = {
    primary: '#6a11cb',
    primary_light: '#2575fc',
    background: '#f4f6f9',
    card: '#ffffff',
    text_dark: '#343a40',
    text_light: '#6c757d',
    tag_bg: '#ede7f6',
    tag_text: '#5e35b1',
    white: '#ffffff',
    shadow: '#000',
};

const StudentEventsScreen = () => {
    const [view, setView] = useState('list');
    const [selectedEventId, setSelectedEventId] = useState(null);
    const handleViewDetails = (eventId) => { setSelectedEventId(eventId); setView('details'); };
    const handleBackToList = () => { setSelectedEventId(null); setView('list'); };
    
    return (
        <SafeAreaView style={styles.container}>
            {view === 'list' && <EventListView onViewDetails={handleViewDetails} />}
            {view === 'details' && <EventDetailsView eventId={selectedEventId} onBack={handleBackToList} />}
        </SafeAreaView>
    );
};

const EventListView = ({ onViewDetails }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const fetchEvents = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const response = await apiClient.get(`/events/all-for-user/${user.id}`);
            setEvents(response.data);
        } catch (error) { Alert.alert("Error", "Could not load school events."); }
        finally { setLoading(false); }
    }, [user]);

    useFocusEffect(fetchEvents);

    return (
        <View style={{flex: 1}}>
            <LinearGradient colors={[THEME.primary, THEME.primary_light]} style={styles.headerBanner}>
                 <MaterialCommunityIcons name="calendar-star" size={30} color={THEME.white} />
                 <View>
                    <Text style={styles.bannerTitle}>School Events</Text>
                    <Text style={styles.bannerSubtitle}>Activities relevant to you.</Text>
                </View>
            </LinearGradient>
            {loading ? <ActivityIndicator size="large" color={THEME.primary} style={{marginTop: 40}} /> :
            <FlatList
                data={events}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => <EventCard event={item} onViewDetails={onViewDetails} />}
                ListEmptyComponent={<Text style={styles.emptyText}>No upcoming events found.</Text>}
                contentContainerStyle={styles.listContainer}
            />}
        </View>
    );
};

const EventCard = ({ event, onViewDetails }) => {
    const date = new Date(event.event_datetime);
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate();

    return (
        <View style={styles.card}>
            <View style={styles.cardContent}>
                <View style={styles.dateBlock}>
                    <Text style={styles.dateMonth}>{month}</Text>
                    <Text style={styles.dateDay}>{day}</Text>
                </View>
                <View style={styles.detailsBlock}>
                    {event.category && <Text style={styles.tag}>{event.category}</Text>}
                    <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
                    <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="map-marker-outline" size={16} color={THEME.text_light} />
                        <Text style={styles.detailText}>{event.location || 'TBD'}</Text>
                    </View>
                </View>
            </View>
             <TouchableOpacity onPress={() => onViewDetails(event.id)}>
                <LinearGradient colors={[THEME.primary_light, THEME.primary]} style={styles.actionButton}>
                    <MaterialCommunityIcons name="information-outline" size={20} color={THEME.white} />
                    <Text style={styles.buttonText}>View Details</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
};

const EventDetailsView = ({ eventId, onBack }) => {
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

    useFocusEffect(fetchDetails);
    
    if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={THEME.primary} /></View>;
    if (!details || !details.event) return ( <View style={styles.centered}><Text>Event not found.</Text></View> );
    
    const { event } = details;
    const eventDate = new Date(event.event_datetime).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <ScrollView>
             <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <MaterialCommunityIcons name="chevron-left" size={28} color={THEME.primary} />
                <Text style={styles.backButtonText}>All Events</Text>
            </TouchableOpacity>
            <View style={styles.detailsPageContainer}>
                {event.category && <Text style={[styles.tag, styles.detailsTag]}>{event.category}</Text>}
                <Text style={styles.detailsTitle}>{event.title}</Text>
                <View style={styles.infoBox}>
                    <InfoRow icon="calendar-clock" text={eventDate} />
                    <InfoRow icon="map-marker-outline" text={event.location || 'To be determined'} />
                    <InfoRow icon="account-group-outline" text={`For: ${event.target_class}`} />
                </View>
                <Text style={styles.descriptionTitle}>About this Event</Text>
                <Text style={styles.descriptionFull}>{event.description || 'No further details available.'}</Text>
            </View>
        </ScrollView>
    );
};

const InfoRow = ({ icon, text }) => (
    <View style={styles.infoRow}>
        <MaterialCommunityIcons name={icon} size={22} color={THEME.primary} style={{marginRight: 15}} />
        <Text style={styles.infoText}>{text}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerBanner: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60, flexDirection: 'row', alignItems: 'center', gap: 15 },
    bannerTitle: { color: THEME.white, fontSize: 24, fontWeight: 'bold' },
    bannerSubtitle: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 14 },
    listContainer: { paddingHorizontal: 15, paddingTop: 20, paddingBottom: 40, marginTop: -40 },
    card: { backgroundColor: THEME.card, borderRadius: 16, marginBottom: 20, shadowColor: THEME.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    cardContent: { flexDirection: 'row', padding: 15 },
    dateBlock: { alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.tag_bg, borderRadius: 12, paddingVertical: 10, width: 70, height: 70, marginRight: 15 },
    dateMonth: { fontSize: 14, color: THEME.tag_text, fontWeight: 'bold' },
    dateDay: { fontSize: 28, color: THEME.tag_text, fontWeight: 'bold', marginTop: -2 },
    detailsBlock: { flex: 1, justifyContent: 'center' },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: THEME.text_dark, marginTop: 4, marginBottom: 6 },
    tag: { alignSelf: 'flex-start', backgroundColor: THEME.tag_bg, color: THEME.tag_text, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, fontSize: 12, fontWeight: '600', overflow: 'hidden', marginBottom: 4 },
    detailRow: { flexDirection: 'row', alignItems: 'center' },
    detailText: { fontSize: 14, color: THEME.text_light, marginLeft: 8 },
    actionButton: { flexDirection: 'row', paddingVertical: 14, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
    buttonText: { color: THEME.white, fontWeight: 'bold', fontSize: 16 },
    detailsPageContainer: { padding: 20 },
    backButton: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    backButtonText: { color: THEME.primary, fontSize: 16, fontWeight: 'bold' },
    detailsTitle: { fontSize: 28, fontWeight: 'bold', color: THEME.text_dark, marginBottom: 15 },
    detailsTag: { marginBottom: 15 },
    infoBox: { backgroundColor: THEME.card, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 15, marginBottom: 20 },
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    infoText: { fontSize: 16, color: THEME.text_dark, flex: 1 },
    descriptionTitle: { fontSize: 20, fontWeight: 'bold', color: THEME.text_dark, marginBottom: 10 },
    descriptionFull: { fontSize: 16, color: THEME.text_light, lineHeight: 26 },
    emptyText: { textAlign: 'center', marginTop: 50, color: THEME.text_light, fontSize: 16 },
});

export default StudentEventsScreen;