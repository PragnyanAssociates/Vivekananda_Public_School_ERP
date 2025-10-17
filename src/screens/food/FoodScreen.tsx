// 📂 File: src/screens/food/FoodScreen.tsx (DEFINITIVE AND FINAL - NO CHANGES NEEDED)

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, SafeAreaView, Modal, TextInput
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

const THEME = {
    primary: '#007bff', danger: '#dc3545', light: '#f8f9fa',
    background: '#f4f7fc', text: '#212529', muted: '#86909c',
    border: '#e9ecef', dark: '#343a40',
};

const ORDERED_DAYS = [
    { full: 'Monday', short: 'Mon' }, { full: 'Tuesday', short: 'Tue' }, { full: 'Wednesday', short: 'Wed' },
    { full: 'Thursday', short: 'Thu' }, { full: 'Friday', short: 'Fri' }, { full: 'Saturday', short: 'Sat' },
];

const FoodScreen = () => {
    const { user } = useAuth();
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

    useFocusEffect(fetchMenu);

    const displayTime = useMemo(() => {
        for (const day of ORDERED_DAYS) {
            const meal = menuData[day.full]?.find(m => m.meal_type === 'Lunch' && m.meal_time);
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

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}><Text style={styles.headerTitle}>Weekly Lunch Menu</Text></View>
            {loading ? <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} /> :
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    <FoodMenuTable 
                        menuData={menuData} 
                        isAdmin={user?.role === 'admin'} 
                        onCellPress={handleCellPress} 
                        onHeaderPress={() => setIsTimeModalVisible(true)}
                        displayTime={displayTime}
                    />
                </ScrollView>
            }
            {itemModalInfo.visible && <EditMenuModal modalInfo={itemModalInfo} onClose={closeItemModal} onSave={handleSaveItem} />}
            {isTimeModalVisible && <EditTimeModal visible={isTimeModalVisible} onClose={() => setIsTimeModalVisible(false)} onSave={handleSaveTime} initialTime={displayTime} />}
        </SafeAreaView>
    );
};

const FoodMenuTable = ({ menuData, isAdmin, onCellPress, onHeaderPress, displayTime }) => {
    const getMealForCell = (day, mealType) => menuData[day]?.find(m => m.meal_type === mealType);

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
                    <Text style={styles.headerMealTypeText}>Lunch</Text>
                    <Text style={styles.headerMealTimeText}>{displayTime}</Text>
                </TouchableOpacity>
            </View>
            {ORDERED_DAYS.map(({ full, short }) => {
                const meal = getMealForCell(full, 'Lunch');
                return (
                    <View key={full} style={styles.tableRow}>
                        <View style={[styles.tableCell, styles.dayCell]}><Text style={styles.dayCellText}>{short}</Text></View>
                        <TouchableOpacity 
                            style={[ styles.tableCell, styles.mealCell, styles.lastCell ]} 
                            onPress={() => onCellPress(meal, full)} 
                            disabled={!isAdmin}
                        >
                            <Text style={meal?.food_item ? styles.mealItemText : styles.notSetText} numberOfLines={3}>
                                {meal?.food_item || 'Not set'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                );
            })}
        </View>
    );
};

const EditMenuModal = ({ modalInfo, onClose, onSave }) => {
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
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <Text style={styles.inputLabel}>Food Item</Text>
                    <TextInput style={styles.input} value={foodItem} onChangeText={setFoodItem} placeholder="e.g., Rice & Dal" />
                    
                    <TouchableOpacity style={styles.saveButton} onPress={handleSavePress}><Text style={styles.saveButtonText}>Save Changes</Text></TouchableOpacity>
                    {mode === 'edit' && (<TouchableOpacity style={styles.clearButton} onPress={handleClearPress}><Text style={styles.clearButtonText}>Clear Food Entry</Text></TouchableOpacity>)}
                    <TouchableOpacity onPress={onClose}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const EditTimeModal = ({ visible, onClose, onSave, initialTime }) => {
    const [time, setTime] = useState(initialTime === 'Not Set' ? '' : initialTime);

    useEffect(() => {
        setTime(initialTime === 'Not Set' ? '' : initialTime);
    }, [initialTime]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Update Weekly Lunch Time</Text>
                    <Text style={styles.inputLabel}>Time</Text>
                    <TextInput 
                        style={styles.input} 
                        value={time} 
                        onChangeText={setTime} 
                        placeholder="e.g., 1:00 PM - 1:45 PM" 
                    />
                    <TouchableOpacity style={styles.saveButton} onPress={() => onSave(time)}>
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

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    scrollContainer: { padding: 10 },
    header: { paddingVertical: 15, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: THEME.border, alignItems: 'center', backgroundColor: '#fff' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: THEME.dark },
    table: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: THEME.border, overflow: 'hidden' },
    tableRow: { flexDirection: 'row', width: '100%', borderTopWidth: 1, borderColor: THEME.border },
    tableHeaderRow: { flexDirection: 'row', backgroundColor: THEME.primary, borderTopWidth: 0 },
    tableCell: { justifyContent: 'center', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
    tableHeaderCell: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)' },
    dayHeaderCell: { flex: 0.7, alignItems: 'flex-start', paddingLeft: 10 },
    mealHeaderCell: { flex: 1.3 },
    lastCell: { borderRightWidth: 0 },
    headerDayText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    headerMealTypeText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' },
    headerMealTimeText: { color: 'rgba(255, 255, 255, 0.9)', fontSize: 11, fontWeight: '600', marginTop: 3 },
    dayCell: { flex: 0.7, alignItems: 'flex-start', paddingLeft: 10, borderRightWidth: 1, borderColor: THEME.border },
    dayCellText: { fontWeight: 'bold', fontSize: 14, color: THEME.primary },
    mealCell: { flex: 1.3, borderRightWidth: 1, borderColor: THEME.border, minHeight: 65, paddingVertical: 8, paddingHorizontal: 8 },
    mealItemText: { fontSize: 14, color: THEME.text, fontWeight: '600', textAlign: 'center' },
    notSetText: { fontSize: 12, color: THEME.muted, fontStyle: 'italic', textAlign: 'center' },
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { width: '90%', backgroundColor: 'white', borderRadius: 12, padding: 25, elevation: 10 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
    inputLabel: { fontSize: 16, color: THEME.muted, marginBottom: 5, marginLeft: 4 },
    input: { borderWidth: 1, borderColor: THEME.border, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 15 },
    saveButton: { backgroundColor: THEME.primary, padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    clearButton: { backgroundColor: THEME.light, padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: THEME.border },
    clearButtonText: { color: THEME.danger, fontSize: 16, fontWeight: 'bold' },
    cancelText: { textAlign: 'center', color: THEME.muted, padding: 15, fontSize: 16 },
});

export default FoodScreen;