import React, { useState, useCallback, useEffect } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, 
    ActivityIndicator, TextInput, ScrollView, Platform, SafeAreaView, 
    UIManager, LayoutAnimation, useColorScheme, StatusBar, Dimensions 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as Animatable from 'react-native-animatable';

const { width } = Dimensions.get('window');

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- THEME CONFIGURATION ---
const getTheme = (scheme: 'light' | 'dark' | null | undefined) => {
    const isDark = scheme === 'dark';
    return {
        isDark,
        primary: '#008080',
        background: isDark ? '#121212' : '#F2F5F8',
        cardBg: isDark ? '#1E1E1E' : '#FFFFFF',
        textMain: isDark ? '#E0E0E0' : '#263238',
        textSub: isDark ? '#B0BEC5' : '#546E7A',
        border: isDark ? '#333333' : '#CFD8DC',
        inputBg: isDark ? '#2C2C2C' : '#FFFFFF',
        placeholder: isDark ? '#666666' : '#888888',
        tag_bg: isDark ? '#004D40' : '#E0F2F1',
        tag_text: isDark ? '#B2DFDB' : '#00695C',
        white: '#ffffff',
        shadow: '#000'
    };
};

const parseServerDateTime = (dateTimeString) => {
    if (!dateTimeString) return new Date();
    if (String(dateTimeString).includes('T') && String(dateTimeString).includes('Z')) {
        return new Date(dateTimeString);
    }
    const parts = String(dateTimeString).match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (parts) {
        return new Date(parts[1], parseInt(parts[2], 10) - 1, parts[3], parts[4], parts[5], parts[6]);
    }
    return new Date();
};

const formatDateTimeForServer = (date) => {
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
};

// Main Component
const AdminEventsScreen = () => {
    const [view, setView] = useState('list'); 
    const [eventToEdit, setEventToEdit] = useState(null);
    const { user } = useAuth();
    const scheme = useColorScheme();
    const theme = getTheme(scheme);
    
    const handleBack = () => {
        setEventToEdit(null);
        setView('list');
    };

    const handleCreate = () => {
        setEventToEdit(null);
        setView('form');
    };

    const handleEdit = (event) => {
        setEventToEdit(event);
        setView('form');
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            {view === 'list' && <EventListView user={user} onCreate={handleCreate} onEdit={handleEdit} theme={theme} />}
            {view === 'form' && <EventForm onBack={handleBack} user={user} eventToEdit={eventToEdit} theme={theme} />}
        </SafeAreaView>
    );
};

// Admin Event List
const EventListView = ({ user, onCreate, onEdit, theme }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedEventId, setExpandedEventId] = useState(null);

    const fetchData = useCallback(() => {
        setLoading(true);
        apiClient.get('/events/all-for-admin')
            .then(response => setEvents(response.data))
            .catch(err => Alert.alert("Error", "Could not load events."))
            .finally(() => setLoading(false));
    }, []);

    useFocusEffect(fetchData);

    const toggleExpand = (eventId) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedEventId(expandedEventId === eventId ? null : eventId);
    };

    const handleMenuPress = (event) => {
        Alert.alert(
            "Manage Event",
            `Options for "${event.title}"`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Edit", onPress: () => onEdit(event) },
                { text: "Delete", style: "destructive", onPress: () => handleDelete(event.id) }
            ]
        );
    };

    const handleDelete = (eventId) => {
        Alert.alert(
            "Confirm Delete",
            "Are you sure you want to delete this event?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await apiClient.delete(`/events/${eventId}`, { data: { userId: user.id } });
                            fetchData();
                        } catch (error) {
                            Alert.alert("Error", "Could not delete event.");
                        }
                    },
                },
            ]
        );
    };

    return (
        <View style={{flex: 1}}>
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.isDark ? '#333' : '#E0F2F1' }]}>
                        <MaterialIcons name="event" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Events</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Manage School Calendar</Text>
                    </View>
                </View>
                <TouchableOpacity style={[styles.headerBtn, { backgroundColor: theme.primary }]} onPress={onCreate}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.headerBtnText}>Add</Text>
                </TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator size="large" color={theme.primary} style={{marginTop: 40}} /> :
            <FlatList
                data={events}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                    <AdminEventCard
                        event={item}
                        currentUser={user}
                        theme={theme}
                        isExpanded={expandedEventId === item.id}
                        onPress={() => toggleExpand(item.id)}
                        onMenu={() => handleMenuPress(item)}
                    />
                )}
                ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSub }]}>No events found.</Text>}
                contentContainerStyle={styles.listContainer}
            />}
        </View>
    );
};

// Admin Event Card
const AdminEventCard = ({ event, currentUser, isExpanded, onPress, onMenu, theme }) => {
    const date = parseServerDateTime(event.event_datetime);
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate();
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    return (
        <Animatable.View animation="fadeInUp" duration={500} style={[styles.card, { backgroundColor: theme.cardBg }]}>
            <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
                <View style={styles.cardContent}>
                    <View style={[styles.dateBlock, { backgroundColor: theme.tag_bg }]}>
                        <Text style={[styles.dateMonth, { color: theme.tag_text }]}>{month}</Text>
                        <Text style={[styles.dateDay, { color: theme.tag_text }]}>{day}</Text>
                    </View>
                    <View style={styles.detailsBlock}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={[styles.tagContainer, { backgroundColor: theme.isDark ? '#252525' : '#f0fdfa', borderColor: theme.isDark ? '#444' : '#ccfbf1' }]}>
                                <Text style={[styles.tagText, { color: theme.tag_text }]}>{event.target_class}</Text>
                            </View>
                            <TouchableOpacity onPress={onMenu} hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}>
                                <MaterialIcons name="more-vert" size={24} color={theme.textSub} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.cardTitle, { color: theme.textMain }]} numberOfLines={2}>{event.title}</Text>
                        <View style={styles.detailRow}>
                            <MaterialCommunityIcons name="map-marker-outline" size={14} color={theme.textSub} />
                            <Text style={[styles.detailText, { color: theme.textSub }]}>{event.location || 'TBD'}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>

            {isExpanded && (
                <View style={[styles.expandedContainer, { borderTopColor: theme.border }]}>
                    <InfoRow icon="clock-outline" text={time} theme={theme} />
                    {event.creator_name && <InfoRow icon="account-circle-outline" text={`Created by: ${event.creator_name}`} theme={theme} />}
                    <InfoRow icon="text" text={event.description || "No description provided."} theme={theme} />
                </View>
            )}
        </Animatable.View>
    );
};

const InfoRow = ({ icon, text, theme }) => (
    <View style={styles.infoRow}>
        <MaterialCommunityIcons name={icon} size={16} color={theme.textSub} style={styles.infoRowIcon} />
        <Text style={[styles.infoRowText, { color: theme.textMain }]}>{text}</Text>
    </View>
);

// Form Component
const EventForm = ({ onBack, user, eventToEdit, theme }) => {
    const isEditMode = !!eventToEdit;
    const initialDate = isEditMode ? parseServerDateTime(eventToEdit.event_datetime) : new Date();

    const [title, setTitle] = useState(isEditMode ? eventToEdit.title : '');
    const [category, setCategory] = useState(isEditMode ? eventToEdit.category : '');
    const [location, setLocation] = useState(isEditMode ? eventToEdit.location : '');
    const [description, setDescription] = useState(isEditMode ? eventToEdit.description : '');
    const [targetClass, setTargetClass] = useState(isEditMode ? eventToEdit.target_class : 'All');
    const [classes, setClasses] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [date, setDate] = useState(initialDate);
    const [showPicker, setShowPicker] = useState(false);
    const [mode, setMode] = useState('date');

    useEffect(() => {
        apiClient.get('/classes').then(res => setClasses(['All', ...res.data]));
    }, []);

    const onChangeDateTime = (event, selectedValue) => {
        setShowPicker(Platform.OS === 'ios');
        if (selectedValue) { setDate(new Date(selectedValue)); }
    };

    const showMode = (currentMode) => {
        setShowPicker(true);
        setMode(currentMode);
    };

    const handleSubmit = async () => {
        if (!title.trim()) return Alert.alert("Required", "Event Title is mandatory.");
        setIsSaving(true);
        const event_datetime = formatDateTimeForServer(date);
        const payload = { title, category, event_datetime, location, description, target_class: targetClass, userId: user.id };
        try {
            if (isEditMode) {
                await apiClient.put(`/events/${eventToEdit.id}`, payload);
                Alert.alert("Updated", "Event details saved.");
            } else {
                await apiClient.post('/events', { ...payload, created_by: user.id });
                Alert.alert("Published", "New event added to calendar.");
            }
            onBack();
        } catch (error) {
            Alert.alert("Error", "Could not save event.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const getFormattedDate = (d) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

    return (
        <View style={{flex: 1}}>
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={onBack} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color={theme.textMain} />
                    </TouchableOpacity>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.isDark ? '#333' : '#E0F2F1' }]}>
                        <MaterialIcons name="edit-calendar" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>{isEditMode ? "Edit Event" : "New Event"}</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Event Details</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.formContainer}>
                <FormInput theme={theme} icon="format-title" placeholder="Event Title *" value={title} onChangeText={setTitle} />
                <FormInput theme={theme} icon="tag-outline" placeholder="Category (e.g., Academic)" value={category} onChangeText={setCategory} />
                
                <Text style={[styles.label, { color: theme.textSub }]}>Date & Time *</Text>
                <View style={styles.dateTimePickerContainer}>
                    <TouchableOpacity style={[styles.dateTimePickerButton, { backgroundColor: theme.cardBg, borderColor: theme.border }]} onPress={() => showMode('date')}>
                        <MaterialCommunityIcons name="calendar" size={20} color={theme.primary} />
                        <Text style={[styles.dateTimePickerText, { color: theme.textMain }]}>{getFormattedDate(date)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.dateTimePickerButton, { backgroundColor: theme.cardBg, borderColor: theme.border }]} onPress={() => showMode('time')}>
                        <MaterialCommunityIcons name="clock-outline" size={20} color={theme.primary} />
                        <Text style={[styles.dateTimePickerText, { color: theme.textMain }]}>{date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</Text>
                    </TouchableOpacity>
                </View>
                
                <Text style={[styles.label, { color: theme.textSub }]}>Target Class</Text>
                <View style={[styles.pickerContainer, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
                    <Picker selectedValue={targetClass} onValueChange={(v) => setTargetClass(v)} dropdownIconColor={theme.textMain}>
                        {classes.map((c) => <Picker.Item key={c} label={c} value={c} color={theme.textMain} />)}
                    </Picker>
                </View>
                
                <FormInput theme={theme} icon="map-marker-outline" placeholder="Location" value={location} onChangeText={setLocation} />
                <FormInput theme={theme} icon="text" placeholder="Description..." multiline value={description} onChangeText={setDescription} />
                
                <TouchableOpacity onPress={handleSubmit} disabled={isSaving} style={[styles.publishButton, { backgroundColor: theme.primary }]}>
                    {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishButtonText}>{isEditMode ? "Save Changes" : "Publish Event"}</Text>}
                </TouchableOpacity>
                
                {showPicker && <DateTimePicker value={date} mode={mode} is24Hour={false} display="default" onChange={onChangeDateTime} />}
            </ScrollView>
        </View>
    );
};

const FormInput = ({ theme, icon, ...props }) => (
    <View style={[styles.inputContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <MaterialCommunityIcons name={icon} size={20} color={theme.textSub} style={styles.inputIcon} />
        <TextInput style={[styles.input, { color: theme.textMain }, props.multiline && { height: 100, textAlignVertical: 'top', paddingTop: 10 }]} placeholderTextColor={theme.placeholder} {...props}/>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerCard: { paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 12 },
    headerBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    listContainer: { paddingHorizontal: 15, paddingBottom: 100, paddingTop: 5 },
    card: { borderRadius: 12, marginBottom: 15, elevation: 2, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, overflow: 'hidden' },
    cardContent: { flexDirection: 'row', padding: 15 },
    dateBlock: { alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingVertical: 8, width: 60, height: 65, marginRight: 15 },
    dateMonth: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    dateDay: { fontSize: 24, fontWeight: 'bold', marginTop: -2 },
    detailsBlock: { flex: 1, justifyContent: 'center' },
    cardTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 4, marginBottom: 4 },
    tagContainer: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginBottom: 4, borderWidth: 1 },
    tagText: { fontSize: 10, fontWeight: '700' },
    detailRow: { flexDirection: 'row', alignItems: 'center' },
    detailText: { fontSize: 13, marginLeft: 5 },
    expandedContainer: { borderTopWidth: 1, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 15 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    infoRowIcon: { marginRight: 8, marginTop: 2 },
    infoRowText: { flex: 1, fontSize: 13, lineHeight: 18 },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16 },
    formContainer: { paddingHorizontal: 15, paddingBottom: 40 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4, marginTop: 10 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1, marginBottom: 15 },
    inputIcon: { marginHorizontal: 10 },
    input: { flex: 1, paddingVertical: 10, paddingRight: 10, fontSize: 15 },
    dateTimePickerContainer: { flexDirection: 'row', marginBottom: 15, justifyContent: 'space-between', gap: 10 },
    dateTimePickerButton: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, flex: 1, justifyContent: 'center', gap: 8 },
    dateTimePickerText: { fontSize: 14 },
    pickerContainer: { borderWidth: 1, borderRadius: 8, marginBottom: 15, justifyContent: 'center' },
    publishButton: { paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 10, elevation: 2 },
    publishButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

export default AdminEventsScreen;