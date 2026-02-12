/**
 * File: src/screens/food/FoodScreen.tsx
 * Purpose: Manage and view the weekly food menu and lunch schedule.
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI Header.
 * Change Log: Removed Back Button from Header.
 */
import React, { useState, useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, SafeAreaView, Modal, TextInput,
    Dimensions, useColorScheme, Platform, StatusBar
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

// --- DYNAMIC THEME HELPERS ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    success: '#43A047',
    danger: '#E53935',
    inputBg: '#F8FAFC',
    inputBorder: '#E2E8F0',
    iconBg: '#E0F2F1',
    modalOverlay: 'rgba(0,0,0,0.6)',
    lightAccent: '#f8f9fa',
    white: '#ffffff',
    headerRow: '#008080',
    headerText: '#FFFFFF',
    dayCellBg: '#FAFAFA'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212', 
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    success: '#4CAF50',
    danger: '#EF5350',
    inputBg: '#2C2C2C',
    inputBorder: '#555555',
    iconBg: '#333333',
    modalOverlay: 'rgba(0,0,0,0.7)',
    lightAccent: '#252525',
    white: '#ffffff',
    headerRow: '#004D40',
    headerText: '#E0F2F1',
    dayCellBg: '#252525'
};

const ORDERED_DAYS = [
    { full: 'Monday', short: 'Mon' }, { full: 'Tuesday', short: 'Tue' }, { full: 'Wednesday', short: 'Wed' },
    { full: 'Thursday', short: 'Thu' }, { full: 'Friday', short: 'Fri' }, { full: 'Saturday', short: 'Sat' },
];

const FoodScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const { user } = useAuth();
    const navigation = useNavigation();

    // Hide default header to use our custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const [menuData, setMenuData] = useState({});
    const [loading, setLoading] = useState(true);
    const [itemModalInfo, setItemModalInfo] = useState({ visible: false, mode: null, data: null });
    const [isTimeModalVisible, setIsTimeModalVisible] = useState(false);

    const fetchMenu = useCallback(() => {
        setLoading(true);
        apiClient.get('/food-menu')
            .then(res => setMenuData(res.data || {}))
            .catch(() => Alert.alert("Error", "Could not fetch the food menu."))
            .finally(() => setLoading(false));
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchMenu();
        }, [])
    );

    const displayTime = useMemo(() => {
        for (const day of ORDERED_DAYS) {
            const meal = menuData[day.full]?.find((m) => m.meal_type === 'Lunch' && m.meal_time);
            if (meal) { return meal.meal_time; }
        }
        return 'Not Set';
    }, [menuData]);

    const openItemModal = (mode, data) => setItemModalInfo({ visible: true, mode, data });
    const closeItemModal = () => setItemModalInfo({ visible: false, mode: null, data: null });

    const handleCellPress = (meal, day) => {
        if (meal) {
            openItemModal('edit', meal);
        } else {
            openItemModal('add', { day_of_week: day, meal_type: 'Lunch' });
        }
    };
    
    const handleSaveItem = (values) => {
        if (!user) return;
        const { mode, data } = itemModalInfo;
        
        const requestBody = { ...values, editorId: user.id };
        let request;

        if (mode === 'edit') {
            request = apiClient.put(`/food-menu/${data.id}`, { 
                food_item: requestBody.food_item, 
                editorId: requestBody.editorId 
            });
        } else {
            const addRequestBody = { 
                ...requestBody, 
                day_of_week: data.day_of_week, 
                meal_type: data.meal_type,
                meal_time: displayTime === 'Not Set' ? '' : displayTime
            };
            request = apiClient.post('/food-menu', addRequestBody);
        }
        
        closeItemModal();
        request
            .then(() => fetchMenu())
            .catch((error) => {
                const errorMessage = error.response?.data?.message || "An error occurred while saving.";
                Alert.alert("Error", errorMessage);
            });
    };

    const handleSaveTime = (newTime) => {
        if (!user) return;
        setIsTimeModalVisible(false);

        apiClient.put('/food-menu/time', {
            meal_type: 'Lunch',
            meal_time: newTime,
            editorId: user.id
        })
        .then(() => {
            Alert.alert("Success", "Lunch time has been updated for the week.");
            fetchMenu();
        })
        .catch((err) => {
            const msg = err.response?.data?.message || "Failed to update the lunch time.";
            Alert.alert("Error", msg);
        });
    };

    // Dynamic styles
    const styles = getStyles(theme);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    {/* Back Button Removed Here */}
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="restaurant-menu" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Weekly Menu</Text>
                        <Text style={styles.headerSubtitle}>Lunch Schedule</Text>
                    </View>
                </View>
            </View>

            {loading ? <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} /> :
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    <FoodMenuTable 
                        menuData={menuData} 
                        isAdmin={user?.role === 'admin'} 
                        onCellPress={handleCellPress} 
                        onHeaderPress={() => setIsTimeModalVisible(true)}
                        displayTime={displayTime}
                        theme={theme}
                        styles={styles}
                    />
                </ScrollView>
            }
            
            {/* Modals */}
            {itemModalInfo.visible && 
                <EditMenuModal 
                    modalInfo={itemModalInfo} 
                    onClose={closeItemModal} 
                    onSave={handleSaveItem} 
                    theme={theme}
                    styles={styles}
                />
            }
            {isTimeModalVisible && 
                <EditTimeModal 
                    visible={isTimeModalVisible} 
                    onClose={() => setIsTimeModalVisible(false)} 
                    onSave={handleSaveTime} 
                    initialTime={displayTime} 
                    theme={theme}
                    styles={styles}
                />
            }
        </SafeAreaView>
    );
};

// --- COMPONENTS ---

const FoodMenuTable = ({ menuData, isAdmin, onCellPress, onHeaderPress, displayTime, theme, styles }) => {
    const getMealForCell = (day, mealType) => menuData[day]?.find((m) => m.meal_type === mealType);

    return (
        <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
                <View style={[styles.tableHeaderCell, styles.dayHeaderCell]}>
                    <Text style={styles.headerDayText}>Day</Text>
                </View>
                <TouchableOpacity 
                    style={[ styles.tableHeaderCell, styles.mealHeaderCell, styles.lastCell ]}
                    onPress={onHeaderPress}
                    disabled={!isAdmin}
                >
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Text style={styles.headerMealTypeText}>LUNCH</Text>
                        {isAdmin && <Icon name="pencil" size={14} color="rgba(255,255,255,0.7)" style={{marginLeft: 5}} />}
                    </View>
                    <Text style={styles.headerMealTimeText}>{displayTime}</Text>
                </TouchableOpacity>
            </View>
            {ORDERED_DAYS.map(({ full, short }) => {
                const meal = getMealForCell(full, 'Lunch');
                return (
                    <View key={full} style={styles.tableRow}>
                        <View style={[styles.tableCell, styles.dayCell]}>
                            <Text style={styles.dayCellText}>{short}</Text>
                        </View>
                        <TouchableOpacity 
                            style={[ styles.tableCell, styles.mealCell, styles.lastCell ]} 
                            onPress={() => onCellPress(meal, full)} 
                            disabled={!isAdmin}
                        >
                            <Text style={meal?.food_item ? styles.mealItemText : styles.notSetText} numberOfLines={3}>
                                {meal?.food_item || 'Tap to add menu'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                );
            })}
        </View>
    );
};

const EditMenuModal = ({ modalInfo, onClose, onSave, theme, styles }) => {
    const { mode, data } = modalInfo;
    const [foodItem, setFoodItem] = useState(data?.food_item || '');

    const handleSavePress = () => { onSave({ food_item: foodItem }); };
    const handleClearPress = () => { onSave({ food_item: '' }); };

    if (!data) return null;
    
    const title = mode === 'add' 
        ? `Add ${data.day_of_week} Lunch` 
        : `Edit ${data.day_of_week} Lunch`;

    return (
        <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalBackdrop}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <Text style={styles.inputLabel}>Food Item</Text>
                    <TextInput 
                        style={styles.input} 
                        value={foodItem} 
                        onChangeText={setFoodItem} 
                        placeholder="e.g., Rice & Dal" 
                        placeholderTextColor={theme.textSub}
                    />
                    
                    <TouchableOpacity style={styles.saveButton} onPress={handleSavePress}><Text style={styles.saveButtonText}>Save Changes</Text></TouchableOpacity>
                    {mode === 'edit' && (<TouchableOpacity style={styles.clearButton} onPress={handleClearPress}><Text style={styles.clearButtonText}>Clear Food Entry</Text></TouchableOpacity>)}
                    <TouchableOpacity onPress={onClose}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

// --- UPDATED TIME MODAL WITH PICKERS ---
const EditTimeModal = ({ visible, onClose, onSave, initialTime, theme, styles }) => {
    const formatTime = (date) => {
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; 
        const strMinutes = minutes < 10 ? '0' + minutes : minutes;
        return `${hours}:${strMinutes} ${ampm}`;
    };

    const parseInitialTime = () => {
        const now = new Date();
        const defaultStart = new Date(now); defaultStart.setHours(13, 0, 0); 
        const defaultEnd = new Date(now); defaultEnd.setHours(13, 45, 0); 

        if (!initialTime || initialTime === 'Not Set' || !initialTime.includes('-')) {
            return { start: defaultStart, end: defaultEnd };
        }

        try {
            const parts = initialTime.split('-');
            const startPart = parts[0].trim(); 
            const endPart = parts[1].trim(); 

            const parsePart = (timeStr) => {
                const [time, modifier] = timeStr.split(' ');
                let [hours, minutes] = time.split(':');
                let h = parseInt(hours, 10);
                const m = parseInt(minutes, 10);
                if (modifier === 'PM' && h < 12) h += 12;
                if (modifier === 'AM' && h === 12) h = 0;
                const d = new Date(now);
                d.setHours(h, m, 0);
                return d;
            };

            return { start: parsePart(startPart), end: parsePart(endPart) };
        } catch (e) {
            return { start: defaultStart, end: defaultEnd };
        }
    };

    const parsed = parseInitialTime();
    const [startTime, setStartTime] = useState(parsed.start);
    const [endTime, setEndTime] = useState(parsed.end);

    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const onStartChange = (event, selectedDate) => {
        if (Platform.OS === 'android') setShowStartPicker(false);
        if (selectedDate) setStartTime(selectedDate);
    };

    const onEndChange = (event, selectedDate) => {
        if (Platform.OS === 'android') setShowEndPicker(false);
        if (selectedDate) setEndTime(selectedDate);
    };

    const handleSave = () => {
        const timeString = `${formatTime(startTime)} - ${formatTime(endTime)}`;
        onSave(timeString);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalBackdrop}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Update Lunch Time</Text>
                    
                    <View style={{ marginBottom: 15 }}>
                        <Text style={styles.inputLabel}>Start Time</Text>
                        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowStartPicker(true)}>
                            <Text style={styles.pickerButtonText}>{formatTime(startTime)}</Text>
                            <Icon name="clock-outline" size={20} color={theme.primary} />
                        </TouchableOpacity>
                        {showStartPicker && (
                            <DateTimePicker
                                value={startTime}
                                mode="time"
                                is24Hour={false}
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={onStartChange}
                            />
                        )}
                    </View>

                    <View style={{ marginBottom: 20 }}>
                        <Text style={styles.inputLabel}>End Time</Text>
                        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowEndPicker(true)}>
                            <Text style={styles.pickerButtonText}>{formatTime(endTime)}</Text>
                            <Icon name="clock-outline" size={20} color={theme.primary} />
                        </TouchableOpacity>
                        {showEndPicker && (
                            <DateTimePicker
                                value={endTime}
                                mode="time"
                                is24Hour={false}
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={onEndChange}
                            />
                        )}
                    </View>

                    <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                        <Text style={styles.saveButtonText}>Save Time</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onClose}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

// --- STYLES DEFINITION ---
const getStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContainer: { paddingHorizontal: width * 0.04, paddingBottom: 20 },
    
    // Header
    headerCard: {
        backgroundColor: theme.cardBg,
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%',
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 15,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 3,
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    // Removed backButton style as it is no longer used
    headerIconContainer: {
        backgroundColor: theme.iconBg, 
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: theme.textMain },
    headerSubtitle: { fontSize: 13, color: theme.textSub },

    // Table
    table: { 
        backgroundColor: theme.cardBg, 
        borderRadius: 12, 
        borderWidth: 1, 
        borderColor: theme.border, 
        overflow: 'hidden', 
        elevation: 2 
    },
    tableRow: { flexDirection: 'row', width: '100%', borderTopWidth: 1, borderColor: theme.border },
    tableHeaderRow: { flexDirection: 'row', backgroundColor: theme.headerRow, borderTopWidth: 0 },
    tableCell: { justifyContent: 'center', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8 },
    tableHeaderCell: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)' },
    
    dayHeaderCell: { flex: 0.7, alignItems: 'flex-start', paddingLeft: 15 },
    mealHeaderCell: { flex: 1.3 },
    lastCell: { borderRightWidth: 0 },
    
    headerDayText: { color: theme.headerText, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase' },
    headerMealTypeText: { color: theme.headerText, fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' },
    headerMealTimeText: { color: 'rgba(255, 255, 255, 0.9)', fontSize: 11, fontWeight: '600', marginTop: 2 },
    
    dayCell: { flex: 0.7, alignItems: 'flex-start', paddingLeft: 15, borderRightWidth: 1, borderColor: theme.border, backgroundColor: theme.dayCellBg },
    dayCellText: { fontWeight: 'bold', fontSize: 14, color: theme.primary },
    
    mealCell: { flex: 1.3, borderRightWidth: 1, borderColor: theme.border, minHeight: 65, paddingVertical: 12 },
    mealItemText: { fontSize: 14, color: theme.textMain, fontWeight: '500', textAlign: 'center' },
    notSetText: { fontSize: 13, color: theme.textSub, fontStyle: 'italic', textAlign: 'center' },
    
    // Modal
    modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.modalOverlay },
    modalContent: { 
        width: width * 0.9, 
        backgroundColor: theme.cardBg, 
        borderRadius: 12, 
        padding: 25, 
        elevation: 10 
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: theme.textMain },
    inputLabel: { fontSize: 16, color: theme.textSub, marginBottom: 5, marginLeft: 4, fontWeight: '500' },
    input: { 
        borderWidth: 1, 
        borderColor: theme.border, 
        borderRadius: 8, 
        padding: 12, 
        fontSize: 16, 
        marginBottom: 15, 
        color: theme.textMain,
        backgroundColor: theme.inputBg 
    },
    
    // Time Picker specific
    pickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 8,
        padding: 12,
        backgroundColor: theme.inputBg,
    },
    pickerButtonText: { fontSize: 16, color: theme.textMain },
    
    saveButton: { backgroundColor: theme.primary, padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    saveButtonText: { color: theme.white, fontSize: 16, fontWeight: 'bold' },
    
    clearButton: { backgroundColor: theme.lightAccent, padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: theme.border },
    clearButtonText: { color: theme.danger, fontSize: 16, fontWeight: 'bold' },
    
    cancelText: { textAlign: 'center', color: theme.textSub, padding: 15, fontSize: 16 },
});

export default FoodScreen;