/**
 * File: src/screens/labs/TeacherAdminLabsScreen.tsx
 * Purpose: Teacher/Admin screen to manage Digital Labs.
 * Features: 
 * - Fully Responsive
 * - Fixes 500 Error by sending ISO Date
 * - DD/MM/YYYY Format Display
 */

import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { 
    View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, 
    Modal, TextInput, Alert, ScrollView, Platform, SafeAreaView, Dimensions,
    useColorScheme, StatusBar, KeyboardAvoidingView
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { pick, types, isCancel } from '@react-native-documents/picker';
import { LabCard } from './LabCard'; 
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

// Get screen dimensions
const { width, height } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#cbd5e1',
    inputBg: '#F9F9F9',
    inputBorder: '#CFD8DC',
    iconBg: '#E0F2F1',
    textPlaceholder: '#94a3b8',
    white: '#ffffff',
    success: '#43A047',
    danger: '#E53935',
    blue: '#1E88E5',
    cancelBtnBg: '#E0E0E0',
    cancelBtnText: '#333333',
    modalBg: '#FFFFFF',
    emptyIcon: '#CFD8DC',
    modalOverlay: 'rgba(0,0,0,0.5)'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    inputBorder: '#555555',
    iconBg: '#333333',
    textPlaceholder: '#64748b',
    white: '#ffffff',
    success: '#4CAF50',
    danger: '#EF5350',
    blue: '#42A5F5',
    cancelBtnBg: '#333333',
    cancelBtnText: '#E0E0E0',
    modalBg: '#1E1E1E',
    emptyIcon: '#475569',
    modalOverlay: 'rgba(255,255,255,0.1)'
};

// --- HELPER: FORMAT DATE (DD/MM/YYYY) ---
const formatDisplayDate = (dateObj: Date): string => {
    if (!dateObj) return 'Select Date & Time';
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    
    let hours = dateObj.getHours();
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    
    return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
};

const TeacherAdminLabsScreen = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const { user } = useAuth();
    const navigation = useNavigation();

    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const [labs, setLabs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false); // Loading state for save button
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLab, setEditingLab] = useState(null);
    
    const initialFormState = { 
        title: '', subject: '', lab_type: '', description: '', access_url: '',
        topic: '', video_url: '', meet_link: '',
    };
    const [formData, setFormData] = useState(initialFormState);
    const [scheduleDate, setScheduleDate] = useState<Date | null>(null);

    const [selectedImage, setSelectedImage] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [studentClasses, setStudentClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    
    const [showPicker, setShowPicker] = useState(false);
    const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

    const fetchLabs = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/labs/teacher/${user.id}`);
            setLabs(response.data);
        } catch (e: any) { 
            console.error("Fetch Error", e);
            Alert.alert("Error", e.response?.data?.message || 'Failed to fetch labs'); 
        } finally { 
            setIsLoading(false); 
        }
    }, [user]);

    const fetchStudentClasses = async () => {
        try {
            const response = await apiClient.get('/student-classes');
            setStudentClasses(response.data);
        } catch (e) {
            console.error("Error fetching student classes:", e);
        }
    };

    useEffect(() => { 
        fetchLabs();
        fetchStudentClasses();
    }, [fetchLabs]);

    // --- DATE PICKER LOGIC ---
    const showMode = (currentMode: 'date' | 'time') => {
        setShowPicker(true);
        setPickerMode(currentMode);
    };
    
    const handleDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowPicker(false);

        if (event.type === 'set' && selectedDate) {
            const currentDate = selectedDate;
            if (Platform.OS === 'android' && pickerMode === 'date') {
                setScheduleDate(currentDate); 
                setTimeout(() => showMode('time'), 100);
            } else if (pickerMode === 'time') {
                const baseDate = scheduleDate || new Date();
                const finalDate = new Date(baseDate);
                finalDate.setHours(currentDate.getHours());
                finalDate.setMinutes(currentDate.getMinutes());
                setScheduleDate(finalDate);
                if (Platform.OS === 'ios') setShowPicker(false);
            } else {
                setScheduleDate(currentDate);
            }
        } else if (event.type === 'dismissed') {
            setShowPicker(false);
        }
    };

    const handleChoosePhoto = () => {
        launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, (response) => {
            if (response.didCancel) return;
            // @ts-ignore
            if (response.errorCode) return Alert.alert("Image Error", response.errorMessage);
            // @ts-ignore
            setSelectedImage(response);
        });
    };

    const handleChooseFile = async () => {
        try {
            const result = await pick({ type: [types.allFiles], allowMultiSelection: false });
            // @ts-ignore
            if (result && result.length > 0) { setSelectedFile(result[0]); }
        } catch (err) {
            if (!isCancel(err)) { Alert.alert('Error', 'An unknown error occurred.'); }
        }
    };

    const handleOpenModal = (lab: any = null) => {
        setEditingLab(lab);
        if (lab) {
            setScheduleDate(lab.class_datetime ? new Date(lab.class_datetime) : null);
            setFormData({ 
                title: lab.title, 
                subject: lab.subject, 
                lab_type: lab.lab_type, 
                description: lab.description, 
                access_url: lab.access_url || '',
                topic: lab.topic || '',
                video_url: lab.video_url || '',
                meet_link: lab.meet_link || '',
            });
            setSelectedClass(lab.class_group || '');
        } else {
            setScheduleDate(new Date()); 
            setFormData(initialFormState);
            setSelectedClass('');
        }
        setSelectedImage(null); 
        setSelectedFile(null); 
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.title || !formData.description || !formData.subject) {
            return Alert.alert("Validation Error", "Title, Subject, and Description are required.");
        }
        
        setIsSaving(true);
        const data = new FormData();
        Object.keys(formData).forEach(key => {
            // @ts-ignore
            const value = formData[key];
            if (value) { data.append(key, value); }
        });

        // SEND ISO STRING - The Backend will now convert this safely
        if (scheduleDate) {
            data.append('class_datetime', scheduleDate.toISOString());
        }

        if (user) data.append('created_by', user.id.toString());
        data.append('class_group', selectedClass);

        // @ts-ignore
        if (selectedImage?.assets?.[0]) {
            data.append('coverImage', { 
                // @ts-ignore
                uri: selectedImage.assets[0].uri, 
                // @ts-ignore
                type: selectedImage.assets[0].type, 
                // @ts-ignore
                name: selectedImage.assets[0].fileName 
            });
        }
        
        // @ts-ignore
        if (selectedFile) {
            data.append('labFile', { 
                // @ts-ignore
                uri: selectedFile.uri, 
                // @ts-ignore
                type: selectedFile.type, 
                // @ts-ignore
                name: selectedFile.name 
            });
        }
        
        try {
            const config = { headers: { 'Content-Type': 'multipart/form-data' } };
            if (editingLab) {
                // @ts-ignore
                await apiClient.put(`/labs/${editingLab.id}`, data, config);
                Alert.alert("Success", "Lab updated successfully!");
            } else {
                await apiClient.post('/labs', data, config);
                Alert.alert("Success", "Lab created successfully!");
            }
            setIsModalOpen(false);
            fetchLabs();
        } catch (error: any) { 
            console.error("Save Error:", error);
            Alert.alert("Save Error", error.response?.data?.message || 'Error creating digital lab.'); 
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        Alert.alert("Confirm Deletion", "Are you sure you want to delete this lab?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    await apiClient.delete(`/labs/${id}`);
                    fetchLabs();
                } catch (e: any) { 
                    Alert.alert("Error", e.response?.data?.message || "Failed to delete lab."); 
                }
            }}
        ]);
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.centered, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            
            {/* --- HEADER --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialCommunityIcons name="flask" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Digital Labs</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Manage Resources</Text>
                    </View>
                </View>
                <TouchableOpacity style={[styles.headerBtn, { backgroundColor: theme.primary }]} onPress={() => handleOpenModal(null)}>
                    <MaterialIcons name="add" size={18} color={theme.white} />
                    <Text style={[styles.headerBtnText, { color: theme.white }]}>Add</Text>
                </TouchableOpacity>
            </View>

            {/* --- LIST --- */}
            <FlatList
                data={labs}
                // @ts-ignore
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.cardWrapper}>
                        <LabCard lab={item} onEdit={handleOpenModal} onDelete={handleDelete} />
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.centered}>
                        <MaterialCommunityIcons name="beaker-outline" size={50} color={theme.emptyIcon} />
                        <Text style={[styles.emptyText, { color: theme.textSub }]}>No labs created yet.</Text>
                    </View>
                }
                contentContainerStyle={{ paddingBottom: 20 }}
            />

            {/* --- MODAL --- */}
            <Modal visible={isModalOpen} onRequestClose={() => setIsModalOpen(false)} animationType="slide" transparent>
                <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
                    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.modalContent, { backgroundColor: theme.modalBg }]}>
                        
                        {/* Modal Header */}
                        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                            <Text style={[styles.modalTitle, { color: theme.textMain }]}>{editingLab ? 'Edit Lab' : 'New Lab'}</Text>
                            <TouchableOpacity onPress={() => setIsModalOpen(false)} style={styles.closeBtn}>
                                <MaterialIcons name="close" size={24} color={theme.textMain} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ padding: 20 }}>
                            
                            {/* Class Selection */}
                            <Text style={[styles.label, { color: theme.textSub }]}>Assign to Class</Text>
                            <View style={[styles.pickerContainer, { borderColor: theme.inputBorder, backgroundColor: theme.inputBg }]}>
                                <Picker 
                                    selectedValue={selectedClass} 
                                    onValueChange={(itemValue) => setSelectedClass(itemValue)}
                                    style={{ color: theme.textMain }}
                                    dropdownIconColor={theme.textMain}
                                >
                                    <Picker.Item label="-- Select Class --" value="" color={theme.textSub}/>
                                    {/* @ts-ignore */}
                                    {studentClasses.map((c, i) => <Picker.Item key={i} label={c} value={c} color={theme.textMain} />)}
                                </Picker>
                            </View>

                            {/* Inputs */}
                            <Text style={[styles.label, { color: theme.textSub }]}>Title*</Text>
                            <TextInput 
                                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                                placeholder="e.g., Chemistry Basics" 
                                placeholderTextColor={theme.textPlaceholder}
                                value={formData.title} 
                                onChangeText={t => setFormData({...formData, title: t})} 
                            />
                            
                            <Text style={[styles.label, { color: theme.textSub }]}>Subject*</Text>
                            <TextInput 
                                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                                placeholder="e.g., Science" 
                                placeholderTextColor={theme.textPlaceholder}
                                value={formData.subject} 
                                onChangeText={t => setFormData({...formData, subject: t})} 
                            />
                            
                            <Text style={[styles.label, { color: theme.textSub }]}>Topic / Chapter</Text>
                            <TextInput 
                                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                                placeholder="e.g., Titration" 
                                placeholderTextColor={theme.textPlaceholder}
                                value={formData.topic} 
                                onChangeText={t => setFormData({...formData, topic: t})} 
                            />

                            <Text style={[styles.label, { color: theme.textSub }]}>Description*</Text>
                            <TextInput 
                                style={[styles.input, styles.textarea, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                                placeholder="Instructions..." 
                                placeholderTextColor={theme.textPlaceholder}
                                value={formData.description} 
                                onChangeText={t => setFormData({...formData, description: t})} 
                                multiline 
                            />
                            
                            {/* Date Picker */}
                            <Text style={[styles.label, { color: theme.textSub }]}>Scheduled Date & Time (DD/MM/YYYY)</Text>
                            <View style={styles.datePickerContainer}>
                                <TouchableOpacity 
                                    style={[styles.datePickerButton, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]} 
                                    onPress={() => showMode('date')}
                                >
                                    <MaterialIcons name="event" size={20} color={theme.primary} style={{marginRight: 10}}/>
                                    <Text style={[styles.datePickerText, { color: theme.textMain }]}>
                                        {scheduleDate ? formatDisplayDate(scheduleDate) : 'Select Date & Time'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Show Picker Component */}
                            {showPicker && (
                                <DateTimePicker
                                    testID="dateTimePicker"
                                    value={scheduleDate || new Date()}
                                    mode={pickerMode}
                                    is24Hour={false} 
                                    display="default"
                                    onChange={handleDateChange}
                                />
                            )}

                            {/* Cover Image */}
                            <Text style={[styles.label, { color: theme.textSub, marginTop: 15 }]}>Cover Image</Text>
                            <TouchableOpacity style={[styles.uploadButton, { backgroundColor: theme.primary }]} onPress={handleChoosePhoto}>
                                <MaterialIcons name="image" size={20} color={theme.white} />
                                {/* @ts-ignore */}
                                <Text style={[styles.uploadButtonText, { color: theme.white }]}>{editingLab?.cover_image_url || selectedImage ? 'Change Image' : 'Select Image'}</Text>
                            </TouchableOpacity>
                            {/* @ts-ignore */}
                            {selectedImage?.assets?.[0]?.uri && <Text style={[styles.fileNameText, { color: theme.textSub }]}>{selectedImage.assets[0].fileName}</Text>}
                            
                            <View style={[styles.divider, { backgroundColor: theme.border }]} />
                            <Text style={[styles.sectionHeader, { color: theme.primary }]}>Resources (Optional)</Text>
                            
                            {/* Links */}
                            <Text style={[styles.label, { color: theme.textSub, fontSize: 12 }]}>Video URL (YouTube)</Text>
                            <TextInput 
                                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                                placeholder="https://youtube.com/..." 
                                placeholderTextColor={theme.textPlaceholder}
                                value={formData.video_url} 
                                onChangeText={t => setFormData({...formData, video_url: t})} 
                                keyboardType="url" 
                            />

                            <Text style={[styles.label, { color: theme.textSub, fontSize: 12 }]}>Live Class Link</Text>
                            <TextInput 
                                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                                placeholder="https://meet.google.com/..." 
                                placeholderTextColor={theme.textPlaceholder}
                                value={formData.meet_link} 
                                onChangeText={t => setFormData({...formData, meet_link: t})} 
                                keyboardType="url" 
                            />

                             <Text style={[styles.label, { color: theme.textSub, fontSize: 12 }]}>External Website</Text>
                            <TextInput 
                                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                                placeholder="https://..." 
                                placeholderTextColor={theme.textPlaceholder}
                                value={formData.access_url} 
                                onChangeText={t => setFormData({...formData, access_url: t})} 
                                keyboardType="url" 
                            />
                            
                            {/* File Upload */}
                            <Text style={[styles.label, { color: theme.textSub, fontSize: 12, marginTop: 10 }]}>Document (PDF/Doc)</Text>
                            <TouchableOpacity style={[styles.uploadButton, { backgroundColor: theme.blue }]} onPress={handleChooseFile}>
                                <MaterialIcons name="attach-file" size={20} color={theme.white} />
                                {/* @ts-ignore */}
                                <Text style={[styles.uploadButtonText, { color: theme.white }]}>{editingLab?.file_path || selectedFile ? 'Change File' : 'Upload File'}</Text>
                            </TouchableOpacity>
                            {/* @ts-ignore */}
                            {selectedFile?.name && <Text style={[styles.fileNameText, { color: theme.textSub }]}>{selectedFile.name}</Text>}

                            {/* Action Buttons */}
                            <View style={styles.modalActions}>
                                <TouchableOpacity style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.cancelBtnBg }]} onPress={() => setIsModalOpen(false)}>
                                    <Text style={[styles.cancelButtonText, { color: theme.cancelBtnText }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalButton, styles.saveButton, { backgroundColor: theme.primary }]} onPress={handleSave} disabled={isSaving}>
                                    {isSaving ? (
                                        <ActivityIndicator color={theme.white} size="small" />
                                    ) : (
                                        <Text style={[styles.saveButtonText, { color: theme.white }]}>Save</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    
    // Header
    headerCard: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: width > 600 ? '90%' : '96%', // Responsive width
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
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13, marginTop: 2 },
    headerBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 10 },
    headerBtnText: { fontSize: 13, fontWeight: '600' },

    cardWrapper: { width: '100%', alignItems: 'center', marginBottom: 5 },
    emptyText: { textAlign: 'center', marginTop: 10, fontSize: 16 },

    // Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalContent: { height: '90%', borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    closeBtn: { position: 'absolute', right: 20 },
    
    label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 12 },
    input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
    textarea: { height: 80, textAlignVertical: 'top' },
    pickerContainer: { borderWidth: 1, borderRadius: 8, marginBottom: 5, justifyContent: 'center' },
    
    uploadButton: { flexDirection: 'row', padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 5 },
    uploadButtonText: { marginLeft: 10, fontWeight: 'bold', fontSize: 14 },
    fileNameText: { textAlign: 'center', marginTop: 5, fontSize: 12, fontStyle: 'italic' },
    
    sectionHeader: { fontSize: 15, fontWeight: 'bold', marginTop: 15, marginBottom: 5, textAlign: 'center', letterSpacing: 0.5 },
    divider: { height: 1, marginVertical: 15 },

    datePickerContainer: { marginBottom: 5 },
    datePickerButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 12 },
    datePickerText: { fontSize: 15 },

    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 50 },
    modalButton: { paddingVertical: 14, borderRadius: 8, flex: 0.48, alignItems: 'center', elevation: 2 },
    cancelButtonText: { fontWeight: 'bold', fontSize: 16 },
    saveButtonText: { fontWeight: 'bold', fontSize: 16 },
});

export default TeacherAdminLabsScreen;