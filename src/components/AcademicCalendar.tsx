import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView,
  Dimensions, Modal, TextInput, Alert, Platform, ActivityIndicator, useColorScheme, StatusBar
} from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Imported Picker
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width: windowWidth } = Dimensions.get('window');
const DAY_BOX_SIZE = Math.floor((windowWidth - 40) / 7);

// --- THEME DEFINITIONS ---
const LightColors = {
    primary: '#4A90E2',
    background: '#F7F9FC', 
    cardBg: '#FFFFFF',
    textMain: '#333D4B',
    textSub: '#8A94A6',
    border: '#E4E9F2',
    inputBg: '#F8F9FA',
    modalOverlay: 'rgba(0,0,0,0.6)',
    headerText: '#FFFFFF',
    iconColor: '#546E7A'
};

const DarkColors = {
    primary: '#4A90E2',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    modalOverlay: 'rgba(255,255,255,0.1)',
    headerText: '#FFFFFF',
    iconColor: '#B0B0B0'
};

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

const eventTypesConfig: { [key: string]: { color: string; displayName: string } } = {
  'Meeting': { color: '#4dc4fbff', displayName: 'Meeting' },
  'Event': { color: '#fdb64dff', displayName: 'Event' },
  'Festival': { color: '#fa5353ff', displayName: 'Festival' },
  'Holiday (General)': { color: '#6ced70ff', displayName: 'Holiday' },
  'Exam': { color: '#4625c7ff', displayName: 'Exam' },
  'Other': { color: '#af2ffeff', displayName: 'Other' }
};
const DEFAULT_EVENT_TYPE = 'Meeting';
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const AcademicCalendar = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  // Theme Hook
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const COLORS = isDark ? DarkColors : LightColors;

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

  // --- MENU HANDLER ---
  const handleMenuPress = (item: EventItem) => {
    Alert.alert(
      "Manage Event",
      `Options for "${item.name}"`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Edit Event", onPress: () => openModalForEdit(item) },
        { text: "Delete Event", onPress: () => handleDeleteEvent(item.id), style: 'destructive' }
      ]
    );
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
    return <SafeAreaView style={[styles.safeArea, { backgroundColor: COLORS.background }]}><ActivityIndicator style={{ flex: 1 }} size="large" color={COLORS.primary} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContentContainer}>
        
        {/* LEGEND */}
        <Animatable.View animation="fadeIn" duration={600} delay={200}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.legendContainer, { backgroundColor: COLORS.cardBg }]}>
            {Object.entries(eventTypesConfig).map(([k, v]) => (
                <View key={k} style={styles.legendItem}>
                    <View style={[styles.legendColorBox, {backgroundColor:v.color}]}/>
                    <Text style={[styles.legendText, { color: COLORS.textSub }]}>{v.displayName}</Text>
                </View>
            ))}
          </ScrollView>
        </Animatable.View>

        {/* CALENDAR CARD */}
        <Animatable.View animation="fadeInUp" duration={700} delay={300} style={[styles.calendarCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#95a5a6' }]}>
          <View style={[styles.monthHeader, { backgroundColor: COLORS.primary }]}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navButton}>
                <Icon name="chevron-left" size={28} color={COLORS.headerText} />
            </TouchableOpacity>
            <Text style={[styles.monthYearText, { color: COLORS.headerText }]}>{monthNames[month]} {year}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navButton}>
                <Icon name="chevron-right" size={28} color={COLORS.headerText} />
            </TouchableOpacity>
          </View>
          
          <View style={[styles.dayOfWeekHeader, { backgroundColor: isDark ? '#2C2C2C' : '#F0F4F8' }]}>
            {dayNames.map(d => <Text key={d} style={[styles.dayOfWeekText, { color: COLORS.textSub }]}>{d}</Text>)}
          </View>
          
          <Animatable.View ref={calendarRef} style={[styles.calendarGrid, { backgroundColor: COLORS.cardBg }]}>
            {calendarGrid.map((day, i) => {
              if (day === null) return <View key={`e-${i}`} style={styles.dayBox} />;
              const dateKey = formatDateKey(new Date(year, month, day));
              const dayItems = events[dateKey] || [];
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSunday = new Date(year, month, day).getDay() === 0;
              const hasEvents = dayItems.length > 0;

              return (
                <TouchableOpacity 
                    key={dateKey} 
                    style={[styles.dayBox, isToday && { borderWidth: 2, borderColor: COLORS.primary, backgroundColor: isDark ? 'rgba(74, 144, 226, 0.2)' : 'rgba(74, 144, 226, 0.1)' }]} 
                    onPress={isAdmin ? () => openModalForNew(dateKey) : undefined} 
                    activeOpacity={isAdmin ? 0.7 : 1}
                >
                    {hasEvents ? (
                        <View style={[styles.dayNumberWrapper, { backgroundColor: eventTypesConfig[dayItems[0].type]?.color }]}>
                            <Text style={[styles.dayNumber, styles.dayNumberWithEvent]}>{day}</Text>
                        </View>
                    ) : (
                        <Text style={[
                            styles.dayNumber, 
                            { color: COLORS.textMain },
                            isToday && { color: COLORS.primary, fontWeight: 'bold' },
                            isSunday && { color: eventTypesConfig['Festival'].color }
                        ]}>{day}</Text>
                    )}
                </TouchableOpacity>
              );
            })}
          </Animatable.View>
        </Animatable.View>

        {/* EVENT LIST */}
        {currentMonthItems.length > 0 && (
          <Animatable.View animation="fadeInUp" duration={600} style={[styles.eventListCard, { backgroundColor: COLORS.cardBg }]}>
            <Text style={[styles.eventListTitle, { color: COLORS.textMain, borderBottomColor: COLORS.border }]}>Events in {monthNames[month]}</Text>
            {currentMonthItems.map((item, index) => (
              <Animatable.View key={item.id} animation="fadeInUp" duration={400} delay={index * 75}>
                <View style={[styles.eventListItem, { borderBottomColor: COLORS.border }]}>
                  <View style={[styles.eventIndicator, {backgroundColor: eventTypesConfig[item.type]?.color}]}/>
                  <View style={styles.eventItemTextContainer}>
                      <Text style={[styles.eventDateText, {color: eventTypesConfig[item.type]?.color}]}>{item.formattedDate} {item.time ? `(${item.time})` : ''}</Text>
                      <Text style={[styles.eventNameText, { color: COLORS.textMain }]}>{item.name} <Text style={[styles.eventTypeInList, { color: COLORS.textSub }]}>({item.type})</Text></Text>
                      {item.description && <Text style={[styles.eventDescriptionText, { color: COLORS.textSub }]}>{item.description}</Text>}
                  </View>
                  
                  {/* --- 3 DOTS MENU --- */}
                  {isAdmin && (
                    <TouchableOpacity 
                        style={styles.menuButton}
                        onPress={() => handleMenuPress(item)}
                        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                    >
                        <Icon name="more-vert" size={24} color={COLORS.iconColor} />
                    </TouchableOpacity>
                  )}
                </View>
              </Animatable.View>
            ))}
          </Animatable.View>
        )}
      </ScrollView>
      
      {/* MODAL */}
      <Modal animationType="fade" transparent={true} visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Animatable.View animation="zoomIn" duration={400} style={[styles.modalContent, { backgroundColor: COLORS.cardBg }]}>
            <Text style={[styles.modalTitle, { color: COLORS.textMain }]}>{editingEvent ? 'Edit Event' : 'Add New Event'}</Text>
            <Text style={[styles.modalDateLabel, { color: COLORS.textSub }]}>For Date: {selectedDate}</Text>
            
            {/* TYPE DROPDOWN PICKER */}
            <Text style={[styles.modalInputLabel, { color: COLORS.textSub }]}>Type</Text>
            <View style={[styles.pickerContainer, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                <Picker
                    selectedValue={eventDetails.type}
                    onValueChange={(itemValue) => setEventDetails(prev => ({ ...prev, type: itemValue }))}
                    style={{ color: COLORS.textMain, height: 50 }}
                    dropdownIconColor={COLORS.textSub}
                >
                    {Object.entries(eventTypesConfig).map(([key, val]) => (
                        <Picker.Item key={key} label={val.displayName} value={key} color={COLORS.textMain} />
                    ))}
                </Picker>
            </View>

            <Text style={[styles.modalInputLabel, { color: COLORS.textSub }]}>Title</Text>
            <TextInput 
                style={[styles.modalInput, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} 
                placeholder="Event Title" 
                placeholderTextColor={COLORS.textSub}
                value={eventDetails.name} 
                onChangeText={t => setEventDetails(p => ({...p, name: t}))}
            />
            
            <Text style={[styles.modalInputLabel, { color: COLORS.textSub }]}>Time (Optional)</Text>
            <TextInput 
                style={[styles.modalInput, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} 
                placeholder="e.g., 10:00 AM" 
                placeholderTextColor={COLORS.textSub}
                value={eventDetails.time} 
                onChangeText={t => setEventDetails(p => ({...p, time: t}))}
            />
            
            <Text style={[styles.modalInputLabel, { color: COLORS.textSub }]}>Description (Optional)</Text>
            <TextInput 
                style={[styles.modalInput, styles.modalDescriptionInput, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} 
                placeholder="Details..." 
                placeholderTextColor={COLORS.textSub}
                value={eventDetails.description} 
                onChangeText={t => setEventDetails(p => ({...p, description: t}))} 
                multiline
            />
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: COLORS.primary }]} onPress={handleSaveEvent}>
                <Text style={styles.modalButtonText}>{editingEvent ? 'Save Changes' : 'Add Event'}</Text>
              </TouchableOpacity>
            </View>
          </Animatable.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContentContainer: { padding: 15, paddingBottom: 100 },
  
  // Legend
  legendContainer: { flexDirection: 'row', padding: 10, marginBottom: 20, borderRadius: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
  legendColorBox: { width: 14, height: 14, marginRight: 6, borderRadius: 4 },
  legendText: { fontSize: 12 },
  
  // Calendar Card
  calendarCard: { borderRadius: 16, marginBottom: 25, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, overflow: 'hidden' },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 15 },
  navButton: { padding: 5 },
  monthYearText: { fontSize: 20, fontWeight: 'bold' },
  
  dayOfWeekHeader: { flexDirection: 'row' },
  dayOfWeekText: { flex: 1, textAlign: 'center', paddingVertical: 12, fontSize: 14, fontWeight: '500' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 5, paddingVertical: 5 },
  dayBox: { width: DAY_BOX_SIZE, height: DAY_BOX_SIZE, justifyContent: 'center', alignItems: 'center', borderRadius: DAY_BOX_SIZE / 2 },
  dayNumber: { fontSize: 15, fontWeight: '500' },
  dayNumberWrapper: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  dayNumberWithEvent: { color: '#212121', fontWeight: 'bold' },
  
  // Event List
  eventListCard: { borderRadius: 16, padding: 15, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3, marginBottom: 20 },
  eventListTitle: { fontSize: 20, fontWeight: '600', marginBottom: 12, borderBottomWidth: 1, paddingBottom: 10 },
  eventListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  eventIndicator: { width: 5, height: '80%', marginRight: 12, borderRadius: 3 },
  eventItemTextContainer: { flex: 1 },
  eventDateText: { fontSize: 14, fontWeight: 'bold', marginBottom: 3 },
  eventNameText: { fontSize: 16, fontWeight: '500', marginBottom: 3 },
  eventTypeInList: { fontSize: 12, fontStyle: 'italic' },
  eventDescriptionText: { fontSize: 13 },
  
  menuButton: { padding: 8, marginLeft: 10 },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', borderRadius: 15, padding: 25, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  modalDateLabel: { fontSize: 15, marginBottom: 20, textAlign: 'center' },
  modalInputLabel: { fontSize: 14, marginBottom: 8, marginTop: 10, fontWeight: '500' },
  
  pickerContainer: { borderWidth: 1, borderRadius: 10, marginBottom: 15, justifyContent: 'center' },
  
  modalInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, marginBottom: 15 },
  modalDescriptionInput: { height: 80, textAlignVertical: 'top' },
  modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
  cancelButton: { backgroundColor: '#95a5a6' },
  modalButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});

export default AcademicCalendar;