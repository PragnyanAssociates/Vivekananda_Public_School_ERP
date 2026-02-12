/**
 * File: src/screens/labs/TeacherAdminLabsScreen.tsx
 * Purpose: Teacher/Admin screen to manage (Add/Edit/Delete) Digital Labs.
 * Updated: Back Button Removed, Responsive Design, Dark/Light Mode.
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
import { LabCard, Lab } from './LabCard';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

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
    emptyIcon: '#CFD8DC'
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
    emptyIcon: '#475569'
};

const TeacherAdminLabsScreen = () => {
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

    const [labs, setLabs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLab, setEditingLab] = useState(null);
    
    // --- STATE MANAGEMENT ---
    const initialFormState = { 
        title: '', subject: '', lab_type: '', description: '', access_url: '',
        topic: '', video_url: '', meet_link: '',
    };
    const [formData, setFormData] = useState(initialFormState);
    const [scheduleDate, setScheduleDate] = useState(null);

    const [selectedImage, setSelectedImage] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [studentClasses, setStudentClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [showPicker, setShowPicker] = useState(false);
    const [pickerMode, setPickerMode] = useState('date');

    const fetchLabs = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/labs/teacher/${user.id}`);
            setLabs(response.data);
        } catch (e) { Alert.alert("Error", e.response?.data?.message || 'Failed to fetch labs'); } 
        finally { setIsLoading(false); }
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

    // --- DATETIME LOGIC ---
    const showMode = (currentMode) => {
        setShowPicker(true);
        setPickerMode(currentMode);
    };
    
    const handleDateChange = (event, selectedDate) => {
        setShowPicker(Platform.OS === 'ios'); 

        if (event.type === 'set' && selectedDate) {
            const currentDate = selectedDate;
            if (Platform.OS === 'android' && pickerMode === 'date') {
                setScheduleDate(currentDate); 
                showMode('time'); 
            } else {
                setScheduleDate(currentDate);
            }
        }
    };

    const clearDateTime = () => {
        setScheduleDate(null);
    };
    
    const handleChoosePhoto = () => {
        launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, (response) => {
            if (response.didCancel) return;
            if (response.errorCode) return Alert.alert("Image Error", response.errorMessage);
            setSelectedImage(response);
        });
    };

    const handleChooseFile = async () => {
        try {
            const result = await pick({ type: [types.allFiles], allowMultiSelection: false });
            if (result && result.length > 0) { setSelectedFile(result[0]); }
        } catch (err) {
            if (!isCancel(err)) { Alert.alert('Error', 'An unknown error occurred.'); }
        }
    };

    const handleOpenModal = (lab = null) => {
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
            setScheduleDate(null);
            setFormData(initialFormState);
            setSelectedClass('');
        }
        setSelectedImage(null); setSelectedFile(null); setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.title || !formData.description || !formData.subject) {
            return Alert.alert("Validation Error", "Title, Subject, and Description are required.");
        }
        
        const data = new FormData();
        Object.keys(formData).forEach(key => {
            const value = formData[key];
            if (value) { data.append(key, value); }
        });

        if (scheduleDate) {
            const pad = (num) => num.toString().padStart(2, '0');
            const formattedDateTime = `${scheduleDate.getFullYear()}-${pad(scheduleDate.getMonth() + 1)}-${pad(scheduleDate.getDate())} ${pad(scheduleDate.getHours())}:${pad(scheduleDate.getMinutes())}:00`;
            data.append('class_datetime', formattedDateTime);
        }

        if (user) data.append('created_by', user.id.toString());
        data.append('class_group', selectedClass);

        if (selectedImage?.assets?.[0]) {
            data.append('coverImage', { uri: selectedImage.assets[0].uri, type: selectedImage.assets[0].type, name: selectedImage.assets[0].fileName });
        }
        if (selectedFile) {
            data.append('labFile', { uri: selectedFile.uri, type: selectedFile.type, name: selectedFile.name });
        }
        
        try {
            const config = { headers: { 'Content-Type': 'multipart/form-data' } };
            if (editingLab) {
                await apiClient.put(`/labs/${editingLab.id}`, data, config);
            } else {
                await apiClient.post('/labs', data, config);
            }
            Alert.alert("Success", `Lab ${editingLab ? 'updated' : 'created'} successfully!`);
            setIsModalOpen(false);
            fetchLabs();
        } catch (error) { Alert.alert("Save Error", error.response?.data?.message || 'An unknown error occurred.'); }
    };

    const handleDelete = async (id) => {
        Alert.alert("Confirm Deletion", "Are you sure you want to delete this lab?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    await apiClient.delete(`/labs/${id}`);
                    Alert.alert("Success", "Lab deleted.");
                    fetchLabs();
                } catch (e) { Alert.alert("Error", e.response?.data?.message || "Failed to delete lab."); }
            }}
        ]);
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.centered, { backgroundColor: theme.background }]}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
                <ActivityIndicator size="large" color={theme.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            
            {/* --- HEADER CARD (Back Button Removed) --- */}
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

            <FlatList
                data={labs}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    // Wrapper ensures width alignment
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
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.modalBackground, { backgroundColor: theme.modalBg }]}>
                    <SafeAreaView style={{ flex: 1 }}>
                        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                            <Text style={[styles.modalTitle, { color: theme.textMain }]}>{editingLab ? 'Edit Lab' : 'New Lab'}</Text>
                            <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                                <MaterialIcons name="close" size={24} color={theme.textMain} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ padding: 20 }}>
                            <Text style={[styles.label, { color: theme.textSub }]}>Assign to Class</Text>
                            <View style={[styles.pickerContainer, { borderColor: theme.inputBorder, backgroundColor: theme.inputBg }]}>
                                <Picker 
                                    selectedValue={selectedClass} 
                                    onValueChange={(itemValue) => setSelectedClass(itemValue)}
                                    style={{ color: theme.textMain }}
                                    dropdownIconColor={theme.textMain}
                                >
                                    <Picker.Item label="All Classes" value="" color={theme.textSub}/>
                                    {studentClasses.map(c => <Picker.Item key={c} label={c} value={c} color={theme.textMain} />)}
                                </Picker>
                            </View>

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
                            
                            <Text style={[styles.label, { color: theme.textSub }]}>Type</Text>
                            <TextInput 
                                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                                placeholder="e.g., Video, PDF" 
                                placeholderTextColor={theme.textPlaceholder}
                                value={formData.lab_type} 
                                onChangeText={t => setFormData({...formData, lab_type: t})} 
                            />
                            
                            <Text style={[styles.label, { color: theme.textSub }]}>Topic</Text>
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
                            
                            <Text style={[styles.label, { color: theme.textSub }]}>Scheduled Time</Text>
                            <View style={styles.datePickerContainer}>
                                <TouchableOpacity 
                                    style={[styles.datePickerButton, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]} 
                                    onPress={() => showMode('date')}
                                >
                                    <MaterialIcons name="event" size={20} color={theme.primary} style={{marginRight: 10}}/>
                                    <Text style={[styles.datePickerText, { color: theme.textMain }]}>
                                        {scheduleDate ? scheduleDate.toLocaleString() : 'Select Date & Time'}
                                    </Text>
                                </TouchableOpacity>
                                {scheduleDate && (
                                    <TouchableOpacity style={styles.clearDateButton} onPress={clearDateTime}>
                                        <MaterialIcons name="clear" size={20} color={theme.textSub} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {showPicker && (
                                <DateTimePicker
                                    testID="dateTimePicker"
                                    value={scheduleDate || new Date()}
                                    mode={pickerMode}
                                    is24Hour={true}
                                    display="default"
                                    onChange={handleDateChange}
                                />
                            )}

                            <TouchableOpacity style={[styles.uploadButton, { backgroundColor: theme.primary }]} onPress={handleChoosePhoto}>
                                <MaterialIcons name="image" size={20} color={theme.white} />
                                <Text style={[styles.uploadButtonText, { color: theme.white }]}>{editingLab?.cover_image_url || selectedImage ? 'Change Cover' : 'Select Cover'}</Text>
                            </TouchableOpacity>
                            {selectedImage?.assets?.[0]?.uri && <Text style={[styles.fileNameText, { color: theme.textSub }]}>{selectedImage.assets[0].fileName}</Text>}
                            
                            <View style={[styles.divider, { backgroundColor: theme.border }]} />
                            <Text style={[styles.sectionHeader, { color: theme.primary }]}>Links & Files</Text>
                            
                            <TextInput 
                                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                                placeholder="Access URL (https://...)" 
                                placeholderTextColor={theme.textPlaceholder}
                                value={formData.access_url} 
                                onChangeText={t => setFormData({...formData, access_url: t})} 
                                keyboardType="url" 
                            />
                            <TextInput 
                                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                                placeholder="Video URL (Youtube...)" 
                                placeholderTextColor={theme.textPlaceholder}
                                value={formData.video_url} 
                                onChangeText={t => setFormData({...formData, video_url: t})} 
                                keyboardType="url" 
                            />
                            <TextInput 
                                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                                placeholder="Meet Link (Google Meet...)" 
                                placeholderTextColor={theme.textPlaceholder}
                                value={formData.meet_link} 
                                onChangeText={t => setFormData({...formData, meet_link: t})} 
                                keyboardType="url" 
                            />
                            
                            <TouchableOpacity style={[styles.uploadButton, { backgroundColor: theme.blue }]} onPress={handleChooseFile}>
                                <MaterialIcons name="attach-file" size={20} color={theme.white} />
                                <Text style={[styles.uploadButtonText, { color: theme.white }]}>{editingLab?.file_path || selectedFile ? 'Change File' : 'Upload File'}</Text>
                            </TouchableOpacity>
                            {selectedFile?.name && <Text style={[styles.fileNameText, { color: theme.textSub }]}>{selectedFile.name}</Text>}

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.cancelBtnBg }]} onPress={() => setIsModalOpen(false)}>
                                    <Text style={[styles.cancelButtonText, { color: theme.cancelBtnText }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalButton, styles.saveButton, { backgroundColor: theme.primary }]} onPress={handleSave}>
                                    <Text style={[styles.saveButtonText, { color: theme.white }]}>Save Lab</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </SafeAreaView>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    
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
    headerBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 10,
    },
    headerBtnText: { fontSize: 12, fontWeight: '600' },

    cardWrapper: {
        width: '100%', 
        alignSelf: 'center',
        marginBottom: 5,   // Space between cards
    },

    emptyText: { textAlign: 'center', marginTop: 10, fontSize: 16 },

    // --- MODAL STYLES ---
    modalBackground: { flex: 1 }, 
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
    modalTitle: { fontSize: 22, fontWeight: 'bold' },
    
    label: { fontSize: 14, fontWeight: '600', marginBottom: 5, marginTop: 10 },
    input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
    textarea: { height: 100, textAlignVertical: 'top' },
    pickerContainer: { borderWidth: 1, borderRadius: 8, marginBottom: 5 },
    
    uploadButton: { flexDirection: 'row', padding: 14, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
    uploadButtonText: { marginLeft: 10, fontWeight: 'bold', fontSize: 15 },
    fileNameText: { textAlign: 'center', marginTop: 5, fontSize: 12, fontStyle: 'italic' },
    
    sectionHeader: { fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 10, textAlign: 'center' },
    divider: { height: 1, marginVertical: 15 },

    datePickerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    datePickerButton: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 12 },
    datePickerText: { fontSize: 15 },
    clearDateButton: { padding: 10, marginLeft: 5 },

    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 20 },
    modalButton: { paddingVertical: 12, borderRadius: 8, flex: 0.48, alignItems: 'center', elevation: 2 },
    cancelButtonText: { fontWeight: 'bold', fontSize: 16 },
    saveButtonText: { fontWeight: 'bold', fontSize: 16 },
});

export default TeacherAdminLabsScreen;