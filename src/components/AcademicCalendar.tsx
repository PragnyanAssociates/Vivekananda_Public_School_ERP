import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView,
  Dimensions, Modal, TextInput, Alert, Platform, ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/MaterialIcons';

// --- Type Definitions ---
interface EventItem {
  id: number;
  name: string;
  type: string;
  time?: string;
  description?: string;
  event_date: string;
}

interface EventsData {
  [dateKey: string]: EventItem[];
}

// --- Configuration ---
const PAGE_BACKGROUND = '#F7F9FC';
const CARD_BACKGROUND = '#FFFFFF';
const PRIMARY_ACCENT = '#4A90E2'; // A friendly, modern blue
const TEXT_PRIMARY_COLOR = '#333D4B';
const TEXT_SECONDARY_COLOR = '#8A94A6';
const WHITE_COLOR = '#FFFFFF';

const eventTypesConfig: { [key: string]: { color: string; displayName: string } } = {
  'Meeting': { color: '#4dc4fbff', displayName: 'Meeting' },       // Light Blue
  'Event': { color: '#fdb64dff', displayName: 'Event' },         // Light Orange
  'Festival': { color: '#fa5353ff', displayName: 'Festival' },      // Light Red
  'Holiday (General)': { color: '#6ced70ff', displayName: 'Holiday' },// Light Green
  // 'Holiday (Optional)': { color: '#53e5d6ff', displayName: 'Optional' }, // Teal
  'Exam': { color: '#d35de7ff', displayName: 'Exam' },          // Light Purple
  'Other': { color: '#af2ffeff', displayName: 'Other' }           // Light Pink
};
const DEFAULT_EVENT_TYPE = 'Meeting';
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const { width: windowWidth } = Dimensions.get('window');
const DAY_BOX_SIZE = Math.floor((windowWidth - 40) / 7);

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const AcademicCalendar = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState<EventsData>({});
  const [currentDisplayDate, setCurrentDisplayDate] = useState(new Date());
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [eventDetails, setEventDetails] = useState({ name: '', time: '', description: '', type: DEFAULT_EVENT_TYPE });
  const today = useMemo(() => new Date(), []);
  const month = currentDisplayDate.getMonth();
  const year = currentDisplayDate.getFullYear();
  const calendarRef = useRef<Animatable.View & View>(null);

  const fetchEvents = async () => {
    try {
      if (!isLoading) setIsLoading(true);
      const response = await apiClient.get('/calendar');
      setEvents(response.data);
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || 'Failed to fetch calendar data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const calendarGrid = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const grid = Array(firstDay).fill(null);
    for (let day = 1; day <= daysInMonth; day++) { grid.push(day); }
    return grid;
  }, [month, year]);

  const changeMonth = (offset: number) => {
    calendarRef.current?.fadeOut(200).then(() => {
      setCurrentDisplayDate(d => {
        const newDate = new Date(d);
        newDate.setMonth(d.getMonth() + offset);
        return newDate;
      });
      calendarRef.current?.fadeIn(200);
    });
  };

  const openModalForNew = (dateKey: string) => { setEditingEvent(null); setSelectedDate(dateKey); setEventDetails({ name: '', time: '', description: '', type: DEFAULT_EVENT_TYPE }); setIsModalVisible(true); };
  const openModalForEdit = (event: EventItem) => { setEditingEvent(event); setSelectedDate(event.event_date); setEventDetails({ name: event.name, time: event.time || '', description: event.description || '', type: event.type }); setIsModalVisible(true); };

  const handleSaveEvent = async () => {
    if (!eventDetails.name.trim() || !selectedDate) return Alert.alert("Error", "Title is required.");
    const isEditing = !!editingEvent;
    const url = isEditing ? `/calendar/${editingEvent!.id}` : '/calendar';
    const method = isEditing ? 'put' : 'post';
    const body = { ...eventDetails, event_date: selectedDate, adminId: user?.id };
    try {
      const response = await apiClient[method](url, body);
      Alert.alert("Success", response.data.message || `Event ${isEditing ? 'updated' : 'created'} successfully!`);
      setIsModalVisible(false);
      await fetchEvents();
    } catch (error: any) {
      Alert.alert("Save Failed", error.response?.data?.message || 'Failed to save event.');
    }
  };
  
  const handleDeleteEvent = (eventId: number) => {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this event?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await apiClient.delete(`/calendar/${eventId}`);
          await fetchEvents();
        } catch (error: any) {
          Alert.alert("Delete Failed", error.response?.data?.message || 'Failed to delete event.');
        }
      }}
    ]);
  };

  const currentMonthItems = useMemo(() => {
    const items: (EventItem & { day: number; formattedDate: string; })[] = [];
    Object.entries(events).forEach(([dateKey, dateItemsArray]) => {
      const [itemYear, itemMonthNum, itemDay] = dateKey.split('-').map(Number);
      if (itemYear === year && (itemMonthNum - 1) === month) {
        dateItemsArray.forEach(item => {
          items.push({ ...item, day: itemDay, formattedDate: `${monthNames[month].substring(0,3)} ${String(itemDay).padStart(2, '0')}` });
        });
      }
    });
    return items.sort((a,b) => a.day - b.day);
  }, [month, year, events]);

  if (isLoading) {
    return <SafeAreaView style={styles.safeArea}><ActivityIndicator style={{ flex: 1 }} size="large" color={PRIMARY_ACCENT} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContentContainer}>
        <Animatable.View animation="fadeInDown" duration={600} style={styles.titleHeader}><Text style={styles.mainTitle}>Academic Calendar</Text></Animatable.View>
        <Animatable.View animation="fadeIn" duration={600} delay={200}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legendContainer}>
            {Object.entries(eventTypesConfig).map(([k, v]) => <View key={k} style={styles.legendItem}><View style={[styles.legendColorBox, {backgroundColor:v.color}]}/><Text style={styles.legendText}>{v.displayName}</Text></View>)}
          </ScrollView>
        </Animatable.View>
        <Animatable.View animation="fadeInUp" duration={700} delay={300} style={styles.calendarCard}>
          <View style={styles.monthHeader}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navButton}><Icon name="chevron-left" size={28} color={WHITE_COLOR} /></TouchableOpacity>
            <Text style={styles.monthYearText}>{monthNames[month]} {year}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navButton}><Icon name="chevron-right" size={28} color={WHITE_COLOR} /></TouchableOpacity>
          </View>
          <View style={styles.dayOfWeekHeader}>{dayNames.map(d => <Text key={d} style={styles.dayOfWeekText}>{d}</Text>)}</View>
          <Animatable.View ref={calendarRef} style={styles.calendarGrid}>
            {calendarGrid.map((day, i) => {
              if (day === null) return <View key={`e-${i}`} style={styles.dayBox} />;
              const dateKey = formatDateKey(new Date(year, month, day));
              const dayItems = events[dateKey] || [];
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSunday = new Date(year, month, day).getDay() === 0;
              const hasEvents = dayItems.length > 0;

              return (
                <TouchableOpacity key={dateKey} style={[styles.dayBox, isToday && styles.todayBoxHighlight]} onPress={isAdmin ? () => openModalForNew(dateKey) : undefined} activeOpacity={isAdmin ? 0.7 : 1}>
                    {hasEvents ? (
                        <View style={[styles.dayNumberWrapper, { backgroundColor: eventTypesConfig[dayItems[0].type]?.color }]}>
                            <Text style={[styles.dayNumber, styles.dayNumberWithEvent]}>{day}</Text>
                        </View>
                    ) : (
                        <Text style={[styles.dayNumber, isToday && styles.todayNumber, isSunday && styles.sundayNumber]}>{day}</Text>
                    )}
                </TouchableOpacity>
              );
            })}
          </Animatable.View>
        </Animatable.View>
        {currentMonthItems.length > 0 && (
          <Animatable.View animation="fadeInUp" duration={600} style={styles.eventListCard}>
            <Text style={styles.eventListTitle}>Events in {monthNames[month]}</Text>
            {currentMonthItems.map((item, index) => (
              <Animatable.View key={item.id} animation="fadeInUp" duration={400} delay={index * 75}>
                <View style={styles.eventListItem}>
                  <View style={[styles.eventIndicator, {backgroundColor: eventTypesConfig[item.type]?.color}]}/>
                  <View style={styles.eventItemTextContainer}>
                      <Text style={[styles.eventDateText, {color: eventTypesConfig[item.type]?.color}]}>{item.formattedDate} {item.time ? `(${item.time})` : ''}</Text>
                      <Text style={styles.eventNameText}>{item.name} <Text style={styles.eventTypeInList}>({item.type})</Text></Text>
                      {item.description && <Text style={styles.eventDescriptionText}>{item.description}</Text>}
                  </View>
                  {isAdmin && (
                    <View style={styles.adminActionButtons}>
                      <TouchableOpacity onPress={() => openModalForEdit(item)} style={styles.editButton}><Text style={styles.actionButtonText}>Edit</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteEvent(item.id)} style={styles.deleteButton}><Text style={styles.actionButtonText}>Del</Text></TouchableOpacity>
                    </View>
                  )}
                </View>
              </Animatable.View>
            ))}
          </Animatable.View>
        )}
      </ScrollView>
      
      {/* ✨ REMOVED the floating action button as requested */}

      <Modal animationType="fade" transparent={true} visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Animatable.View animation="zoomIn" duration={400} style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingEvent ? 'Edit Event' : 'Add New Event'}</Text>
            <Text style={styles.modalDateLabel}>For Date: {selectedDate}</Text>
            <Text style={styles.modalInputLabel}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eventTypeSelectorContainer}>
                {Object.entries(eventTypesConfig).map(([key, val]) => <TouchableOpacity key={key} style={[styles.eventTypeButton, eventDetails.type === key && {backgroundColor:val.color, borderColor: val.color}]} onPress={() => setEventDetails(p => ({...p, type: key}))}><Text style={[styles.eventTypeButtonText, eventDetails.type === key && {color: TEXT_PRIMARY_COLOR}]}>{val.displayName}</Text></TouchableOpacity>)}
            </ScrollView>
            <Text style={styles.modalInputLabel}>Title</Text>
            <TextInput style={styles.modalInput} placeholder="Event Title" value={eventDetails.name} onChangeText={t => setEventDetails(p => ({...p, name: t}))}/>
            <Text style={styles.modalInputLabel}>Time (Optional)</Text>
            <TextInput style={styles.modalInput} placeholder="e.g., 10:00 AM" value={eventDetails.time} onChangeText={t => setEventDetails(p => ({...p, time: t}))}/>
            <Text style={styles.modalInputLabel}>Description (Optional)</Text>
            <TextInput style={[styles.modalInput, styles.modalDescriptionInput]} placeholder="Details..." value={eventDetails.description} onChangeText={t => setEventDetails(p => ({...p, description: t}))} multiline/>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsModalVisible(false)}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveEvent}><Text style={styles.modalButtonText}>{editingEvent ? 'Save Changes' : 'Add Event'}</Text></TouchableOpacity>
            </View>
          </Animatable.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Styles updated to remove the FAB style
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: PAGE_BACKGROUND },
  scrollView: { flex: 1 },
  scrollContentContainer: { padding: 15, paddingBottom: 100 },
  titleHeader: { marginBottom: 15, alignItems: 'center' },
  mainTitle: { fontSize: 26, fontWeight: 'bold', color: TEXT_PRIMARY_COLOR },
  legendContainer: { flexDirection: 'row', padding: 10, marginBottom: 20, backgroundColor: CARD_BACKGROUND, borderRadius: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
  legendColorBox: { width: 14, height: 14, marginRight: 6, borderRadius: 4 },
  legendText: { fontSize: 12, color: TEXT_SECONDARY_COLOR },
  calendarCard: { backgroundColor: CARD_BACKGROUND, borderRadius: 16, marginBottom: 25, shadowColor: '#95a5a6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, overflow: 'hidden' },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: PRIMARY_ACCENT, paddingVertical: 14, paddingHorizontal: 15 },
  navButton: { padding: 5 },
  navArrow: { fontSize: 22, color: WHITE_COLOR, fontWeight: 'bold' },
  monthYearText: { fontSize: 20, fontWeight: 'bold', color: WHITE_COLOR },
  dayOfWeekHeader: { flexDirection: 'row', backgroundColor: '#F0F4F8' },
  dayOfWeekText: { flex: 1, textAlign: 'center', paddingVertical: 12, fontSize: 14, fontWeight: '500', color: TEXT_SECONDARY_COLOR },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 5, paddingVertical: 5, backgroundColor: CARD_BACKGROUND },
  dayBox: { width: DAY_BOX_SIZE, height: DAY_BOX_SIZE, justifyContent: 'center', alignItems: 'center', borderRadius: DAY_BOX_SIZE / 2 },
  todayBoxHighlight: { borderWidth: 2, borderColor: PRIMARY_ACCENT, backgroundColor: 'rgba(74, 144, 226, 0.1)' },
  dayNumber: { fontSize: 15, fontWeight: '500', color: TEXT_PRIMARY_COLOR },
  todayNumber: { color: PRIMARY_ACCENT, fontWeight: 'bold' },
  sundayNumber: { color: eventTypesConfig['Festival'].color },
  dayNumberWrapper: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  dayNumberWithEvent: { color: '#212121', fontWeight: 'bold' },
  eventListCard: { backgroundColor: CARD_BACKGROUND, borderRadius: 16, padding: 15, shadowColor: '#95a5a6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3, marginBottom: 20 },
  eventListTitle: { fontSize: 20, fontWeight: '600', color: TEXT_PRIMARY_COLOR, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f3f5', paddingBottom: 10 },
  eventListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  eventIndicator: { width: 5, height: '80%', marginRight: 12, borderRadius: 3 },
  eventItemTextContainer: { flex: 1 },
  eventDateText: { fontSize: 14, fontWeight: 'bold', marginBottom: 3 },
  eventNameText: { fontSize: 16, fontWeight: '500', color: TEXT_PRIMARY_COLOR, marginBottom: 3 },
  eventTypeInList: { fontSize: 12, color: TEXT_SECONDARY_COLOR, fontStyle: 'italic' },
  eventDescriptionText: { fontSize: 13, color: TEXT_SECONDARY_COLOR },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: CARD_BACKGROUND, borderRadius: 15, padding: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: TEXT_PRIMARY_COLOR, marginBottom: 5, textAlign: 'center' },
  modalDateLabel: { fontSize: 15, color: TEXT_SECONDARY_COLOR, marginBottom: 20, textAlign: 'center' },
  modalInputLabel: { fontSize: 14, color: TEXT_SECONDARY_COLOR, marginBottom: 8, marginTop: 10, fontWeight: '500' },
  eventTypeSelectorContainer: { marginBottom: 10, maxHeight: 50 },
  eventTypeButton: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ced4da', marginRight: 8, backgroundColor: '#f8f9fa' },
  eventTypeButtonText: { fontSize: 14, fontWeight: '500', color: TEXT_SECONDARY_COLOR },
  modalInput: { backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#ced4da', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, marginBottom: 15 },
  modalDescriptionInput: { height: 80, textAlignVertical: 'top' },
  modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
  saveButton: { backgroundColor: PRIMARY_ACCENT },
  cancelButton: { backgroundColor: '#95a5a6' },
  modalButtonText: { color: WHITE_COLOR, fontSize: 16, fontWeight: 'bold' },
  adminActionButtons: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  editButton: { backgroundColor: '#3498db', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginRight: 8 },
  deleteButton: { backgroundColor: '#e74c3c', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  actionButtonText: { color: WHITE_COLOR, fontSize: 13, fontWeight: 'bold' }
});

export default AcademicCalendar;