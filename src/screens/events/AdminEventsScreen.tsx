import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, TextInput, ScrollView, Platform, SafeAreaView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
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
    border: '#ced4da',
    danger: '#e53935',
    success: '#43a047'
};

// Main Component
const AdminEventsScreen = () => {
    const [view, setView] = useState('list'); // 'list' or 'form'
    const [eventToEdit, setEventToEdit] = useState(null);
    const { user } = useAuth();
    
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
        <SafeAreaView style={styles.container}>
            {view === 'list' && <EventListView user={user} onCreate={handleCreate} onEdit={handleEdit} />}
            {view === 'form' && <EventForm onBack={handleBack} user={user} eventToEdit={eventToEdit} />}
        </SafeAreaView>
    );
};

// Admin Event List
const EventListView = ({ user, onCreate, onEdit }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(() => {
        setLoading(true);
        apiClient.get('/events/all-for-admin')
            .then(response => setEvents(response.data))
            .catch(err => Alert.alert("Error", "Could not load events."))
            .finally(() => setLoading(false));
    }, []);

    useFocusEffect(fetchData);

    const handleDelete = (eventId) => {
        Alert.alert(
            "Delete Event",
            "Are you sure you want to permanently delete this event?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await apiClient.delete(`/events/${eventId}`, { data: { userId: user.id } });
                            Alert.alert("Success", "Event deleted.");
                            fetchData(); // Refresh list
                        } catch (error) {
                            Alert.alert("Error", error.response?.data?.message || "Could not delete event.");
                        }
                    },
                },
            ]
        );
    };

    return (
        <View style={{flex: 1}}>
            <LinearGradient colors={[THEME.primary, THEME.primary_light]} style={styles.headerBanner}>
                 <MaterialCommunityIcons name="calendar-edit" size={30} color={THEME.white} />
                 <View>
                    <Text style={styles.bannerTitle}>Manage Events</Text>
                    <Text style={styles.bannerSubtitle}>Create, edit, or delete school events.</Text>
                </View>
            </LinearGradient>

            {loading ? <ActivityIndicator size="large" color={THEME.primary} style={{marginTop: 40}} /> :
            <FlatList
                data={events}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                    <AdminEventCard
                        event={item}
                        currentUser={user}
                        onEdit={() => onEdit(item)}
                        onDelete={() => handleDelete(item.id)}
                    />
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No events found. Tap '+' to create one.</Text>}
                contentContainerStyle={styles.listContainer}
            />}
            <TouchableOpacity style={styles.fab} onPress={onCreate}>
                <LinearGradient colors={[THEME.primary_light, THEME.primary]} style={styles.fabGradient}>
                    <MaterialCommunityIcons name="plus" size={30} color={THEME.white} />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
};

// Admin Event Card with Edit/Delete buttons
const AdminEventCard = ({ event, currentUser, onEdit, onDelete }) => {
    const date = new Date(event.event_datetime);
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate();
    const isCreator = event.created_by === currentUser.id || currentUser.role === 'admin';

    return (
        <View style={styles.card}>
            <View style={styles.cardContent}>
                 <View style={styles.dateBlock}>
                    <Text style={styles.dateMonth}>{month}</Text>
                    <Text style={styles.dateDay}>{day}</Text>
                </View>
                 <View style={styles.detailsBlock}>
                    <Text style={styles.tag}>For: {event.target_class}</Text>
                    <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
                    <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="map-marker-outline" size={16} color={THEME.text_light} />
                        <Text style={styles.detailText}>{event.location || 'TBD'}</Text>
                    </View>
                </View>
            </View>
            {isCreator && (
                <View style={styles.actionsContainer}>
                    <TouchableOpacity style={[styles.actionBtn, {backgroundColor: THEME.success}]} onPress={onEdit}>
                        <MaterialCommunityIcons name="pencil-outline" size={18} color={THEME.white} />
                        <Text style={styles.actionBtnText}>Edit</Text>
                    </TouchableOpacity>
                     <TouchableOpacity style={[styles.actionBtn, {backgroundColor: THEME.danger}]} onPress={onDelete}>
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color={THEME.white} />
                        <Text style={styles.actionBtnText}>Delete</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};


// Create/Edit Form Component
const EventForm = ({ onBack, user, eventToEdit }) => {
    const isEditMode = !!eventToEdit;
    const [title, setTitle] = useState(isEditMode ? eventToEdit.title : '');
    const [category, setCategory] = useState(isEditMode ? eventToEdit.category : '');
    const [location, setLocation] = useState(isEditMode ? eventToEdit.location : '');
    const [description, setDescription] = useState(isEditMode ? eventToEdit.description : '');
    const [targetClass, setTargetClass] = useState(isEditMode ? eventToEdit.target_class : 'All');
    const [classes, setClasses] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [date, setDate] = useState(isEditMode ? new Date(eventToEdit.event_datetime) : new Date());
    const [showPicker, setShowPicker] = useState(false);
    const [mode, setMode] = useState('date');

    useEffect(() => {
        apiClient.get('/classes').then(res => setClasses(['All', ...res.data]));
    }, []);

    const onChangeDateTime = (event, selectedValue) => {
        setShowPicker(Platform.OS === 'ios');
        if (selectedValue) setDate(selectedValue);
    };

    const showMode = (currentMode) => {
        setShowPicker(true);
        setMode(currentMode);
    };

    const handleSubmit = async () => {
        if (!title.trim()) return Alert.alert("Heads up!", "Event Title is required.");
        setIsSaving(true);
        const event_datetime = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
        const payload = { title, category, event_datetime, location, description, target_class: targetClass, userId: user.id };
        
        try {
            if (isEditMode) {
                await apiClient.put(`/events/${eventToEdit.id}`, payload);
                Alert.alert("Success!", "Event has been updated.");
            } else {
                await apiClient.post('/events', { ...payload, created_by: user.id });
                Alert.alert("Success!", "Event has been published.");
            }
            onBack();
        } catch (error) {
            Alert.alert("Error", error.response?.data?.message || "An error occurred.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const getFormattedDate = (d) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

    return (
        <ScrollView contentContainerStyle={styles.formContainer}>
            <View style={styles.formHeader}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <MaterialCommunityIcons name="chevron-left" size={28} color={THEME.primary} />
                    <Text style={styles.backButtonText}>Back to List</Text>
                </TouchableOpacity>
                <Text style={styles.formTitle}>{isEditMode ? "Edit Event" : "Create New Event"}</Text>
            </View>

            <FormInput icon="format-title" placeholder="Event Title *" value={title} onChangeText={setTitle} />
            <FormInput icon="tag-outline" placeholder="Category (e.g., Academic)" value={category} onChangeText={setCategory} />
            <Text style={styles.label}>Select Date & Time *</Text>
            <View style={styles.dateTimePickerContainer}>
                <TouchableOpacity style={styles.dateTimePickerButton} onPress={() => showMode('date')}>
                    <MaterialCommunityIcons name="calendar" size={20} color={THEME.primary} /><Text style={styles.dateTimePickerText}>{getFormattedDate(date)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateTimePickerButton} onPress={() => showMode('time')}>
                    <MaterialCommunityIcons name="clock-outline" size={20} color={THEME.primary} /><Text style={styles.dateTimePickerText}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.label}>Select Target Class</Text>
            <View style={styles.pickerContainer}>
                 <MaterialCommunityIcons name="account-group-outline" size={20} color={THEME.text_light} style={styles.pickerIcon} />
                <Picker selectedValue={targetClass} onValueChange={(itemValue) => setTargetClass(itemValue)} style={styles.picker}>
                    {classes.map((c) => <Picker.Item key={c} label={c} value={c} />)}
                </Picker>
            </View>
            <FormInput icon="map-marker-outline" placeholder="Location" value={location} onChangeText={setLocation} />
            <FormInput icon="text" placeholder="Description..." multiline value={description} onChangeText={setDescription} />
            <TouchableOpacity onPress={handleSubmit} disabled={isSaving}>
                <LinearGradient colors={[THEME.primary, THEME.primary_light]} style={styles.publishButton}>
                    {isSaving ? <ActivityIndicator color={THEME.white} /> : <Text style={styles.publishButtonText}>{isEditMode ? "Save Changes" : "Publish Event"}</Text>}
                </LinearGradient>
            </TouchableOpacity>
             {showPicker && <DateTimePicker value={date} mode={mode} is24Hour={false} display="default" onChange={onChangeDateTime} />}
        </ScrollView>
    );
};

const FormInput = ({ icon, ...props }) => (
    <View style={styles.inputContainer}>
        <MaterialCommunityIcons name={icon} size={20} color={THEME.text_light} style={styles.inputIcon} />
        <TextInput style={[styles.input, props.multiline && { height: 120, textAlignVertical: 'top', paddingTop: 15 }]} placeholderTextColor={THEME.text_light} {...props}/>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    headerBanner: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60, flexDirection: 'row', alignItems: 'center', gap: 15 },
    bannerTitle: { color: THEME.white, fontSize: 24, fontWeight: 'bold' },
    bannerSubtitle: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 14 },
    listContainer: { paddingHorizontal: 15, paddingTop: 20, paddingBottom: 100, marginTop: -40 },
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
    actionsContainer: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
    actionBtnText: { color: THEME.white, fontWeight: 'bold' },
    fab: { position: 'absolute', bottom: 30, right: 30 },
    fabGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: THEME.primary, shadowRadius: 8, shadowOpacity: 0.4 },
    emptyText: { textAlign: 'center', marginTop: 50, color: THEME.text_light, fontSize: 16 },
    // Form Styles
    formContainer: { paddingHorizontal: 20, paddingBottom: 40 },
    formHeader: { marginBottom: 20 },
    formTitle: { fontSize: 26, fontWeight: 'bold', color: THEME.text_dark, marginTop: 10 },
    backButton: { flexDirection: 'row', alignItems: 'center', marginLeft: -8 },
    backButtonText: { color: THEME.primary, fontSize: 16, fontWeight: 'bold' },
    label: { fontSize: 16, color: THEME.text_dark, fontWeight: '600', marginBottom: 10, marginLeft: 5 },
    inputContainer: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: THEME.card, borderRadius: 12, borderWidth: 1, borderColor: THEME.border, marginBottom: 20 },
    inputIcon: { margin: 15 },
    input: { flex: 1, paddingVertical: 15, paddingRight: 15, fontSize: 16, color: THEME.text_dark },
    dateTimePickerContainer: { flexDirection: 'row', marginBottom: 20, justifyContent: 'space-between', gap: 10 },
    dateTimePickerButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: THEME.border, flex: 1, justifyContent: 'center', gap: 10 },
    dateTimePickerText: { fontSize: 16, color: THEME.text_dark },
    pickerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 12, borderWidth: 1, borderColor: THEME.border, marginBottom: 20, },
    pickerIcon: { marginHorizontal: 15 },
    picker: { flex: 1, color: THEME.text_dark },
    publishButton: { paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    publishButtonText: { color: THEME.white, fontWeight: 'bold', fontSize: 16 },
});

export default AdminEventsScreen;