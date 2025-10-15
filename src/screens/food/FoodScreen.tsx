import React, { useState, useCallback } from 'react';
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

const MEAL_TYPES = ['Lunch'];

const FoodScreen = () => {
    const { user } = useAuth();
    const [menuData, setMenuData] = useState({});
    const [loading, setLoading] = useState(true);
    // MODIFIED: Modal state now includes the 'mode' ('add' or 'edit')
    const [modalInfo, setModalInfo] = useState({ visible: false, mode: null, data: null });

    const fetchMenu = useCallback(() => {
        setLoading(true);
        apiClient.get('/food-menu')
            .then(res => setMenuData(res.data))
            .catch(() => Alert.alert("Error", "Could not fetch the food menu."))
            .finally(() => setLoading(false));
    }, []);

    useFocusEffect(fetchMenu);

    const openModal = (mode, data) => setModalInfo({ visible: true, mode, data });
    const closeModal = () => setModalInfo({ visible: false, mode: null, data: null });

    // NEW: Handles clicking on any cell, whether it has data or not
    const handleCellPress = (meal, day, mealType) => {
        if (meal) {
            // If meal data exists, open in 'edit' mode
            openModal('edit', meal);
        } else {
            // If no meal data, open in 'add' mode with the day/type info
            openModal('add', { day_of_week: day, meal_type: mealType });
        }
    };
    
    // MODIFIED: handleSave now manages both creating (POST) and updating (PUT)
    const handleSave = (values) => {
        if (!user) return;
        const { mode, data } = modalInfo;
        
        const requestBody = { ...values, editorId: user.id };
        let request;

        if (mode === 'edit') {
            request = apiClient.put(`/food-menu/${data.id}`, requestBody);
        } else { // mode === 'add'
            const addRequestBody = { ...requestBody, day_of_week: data.day_of_week, meal_type: data.meal_type };
            request = apiClient.post('/food-menu', addRequestBody);
        }
        
        closeModal();

        request
        .then(() => {
            // Refresh the entire menu to show the new/updated data
            fetchMenu(); 
        })
        .catch((error) => {
            Alert.alert("Error", error.response?.data?.message || "An error occurred while saving.");
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
                    />
                </ScrollView>
            }
            {modalInfo.visible && <EditMenuModal modalInfo={modalInfo} onClose={closeModal} onSave={handleSave} />}
        </SafeAreaView>
    );
};

const FoodMenuTable = ({ menuData, isAdmin, onCellPress }) => {
    const getMealForCell = (day, mealType) => menuData[day]?.find(m => m.meal_type === mealType);

    return (
        <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
                <View style={[styles.tableHeaderCell, styles.dayHeaderCell]}><Text style={styles.headerDayText}>Day</Text></View>
                {MEAL_TYPES.map((mealType, index) => (
                    <View key={mealType} style={[ styles.tableHeaderCell, styles.mealHeaderCell, index === MEAL_TYPES.length - 1 && styles.lastCell ]}>
                        <Text style={styles.headerMealTypeText}>{mealType}</Text>
                    </View>
                ))}
            </View>
            {ORDERED_DAYS.map(({ full, short }) => (
                <View key={full} style={styles.tableRow}>
                    <View style={[styles.tableCell, styles.dayCell]}><Text style={styles.dayCellText}>{short}</Text></View>
                    {MEAL_TYPES.map((mealType, index) => {
                        const meal = getMealForCell(full, mealType);
                        return (
                            // MODIFIED: Now enabled for admin even if 'meal' is null. Passes all necessary info.
                            <TouchableOpacity 
                                key={mealType} 
                                style={[ styles.tableCell, styles.mealCell, index === MEAL_TYPES.length - 1 && styles.lastCell ]} 
                                onPress={() => onCellPress(meal, full, mealType)} 
                                disabled={!isAdmin}
                            >
                                <Text style={meal?.food_item ? styles.mealItemText : styles.notSetText} numberOfLines={2}>{meal?.food_item || 'Not set'}</Text>
                                <Text style={meal?.meal_time ? styles.mealTimeText : styles.notSetText} numberOfLines={1}>{meal?.meal_time || 'No time set'}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ))}
        </View>
    );
};

const EditMenuModal = ({ modalInfo, onClose, onSave }) => {
    const { mode, data } = modalInfo;
    const [foodItem, setFoodItem] = useState(data?.food_item || '');
    const [mealTime, setMealTime] = useState(data?.meal_time || '');

    const handleSavePress = () => {
        onSave({ food_item: foodItem, meal_time: mealTime });
    };
    
    const handleClearPress = () => { 
        onSave({ food_item: '', meal_time: mealTime }); 
    };

    if (!data) return null;
    
    // MODIFIED: Dynamic title based on 'add' or 'edit' mode
    const title = mode === 'add' 
        ? `Add ${data.day_of_week} ${data.meal_type}` 
        : `Edit ${data.day_of_week} ${data.meal_type}`;

    return (
        <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <Text style={styles.inputLabel}>Food Item</Text>
                    <TextInput style={styles.input} value={foodItem} onChangeText={setFoodItem} placeholder="e.g., Rice & Dal" />
                    <Text style={styles.inputLabel}>Time</Text>
                    <TextInput style={styles.input} value={mealTime} onChangeText={setMealTime} placeholder="e.g., 1:00 PM - 2:00 PM" />
                    <TouchableOpacity style={styles.saveButton} onPress={handleSavePress}><Text style={styles.saveButtonText}>Save Changes</Text></TouchableOpacity>
                    {/* MODIFIED: Show clear button only when editing an existing item */}
                    {mode === 'edit' && (<TouchableOpacity style={styles.clearButton} onPress={handleClearPress}><Text style={styles.clearButtonText}>Clear Food Entry</Text></TouchableOpacity>)}
                    <TouchableOpacity onPress={onClose}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

// Styles remain the same as the previous version
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
    mealHeaderCell: { flex: 1 },
    lastCell: { borderRightWidth: 0 },
    headerDayText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    headerMealTypeText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' },
    headerMealTimeText: { color: 'rgba(255, 255, 255, 0.9)', fontSize: 10, fontWeight: '600', marginTop: 2 },
    dayCell: { flex: 0.7, alignItems: 'flex-start', paddingLeft: 10, borderRightWidth: 1, borderColor: THEME.border },
    dayCellText: { fontWeight: 'bold', fontSize: 14, color: THEME.primary },
    mealCell: { flex: 1, borderRightWidth: 1, borderColor: THEME.border, minHeight: 65, paddingVertical: 8 },
    mealItemText: { fontSize: 12, color: THEME.text, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
    mealTimeText: { fontSize: 11, color: THEME.muted, fontWeight: '600', textAlign: 'center' },
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