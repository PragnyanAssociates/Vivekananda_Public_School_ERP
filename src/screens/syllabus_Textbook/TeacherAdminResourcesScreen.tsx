// 📂 File: src/screens/admin/TeacherAdminResourcesScreen.tsx (REPLACE THIS FILE)

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput, ScrollView, RefreshControl, Image } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import apiClient from '../../api/client';

// ★ IMPORTANT: REPLACE WITH YOUR ACTUAL SERVER URL ★
// This is needed to correctly load cover images from your backend.
const SERVER_URL = 'https://vivekanandapublicschoolerp-production.up.railway.app'; 

const TeacherAdminResourcesScreen = () => {
    const [mainView, setMainView] = useState('syllabus');
    const [boardView, setBoardView] = useState<'state' | 'central'>('state'); 
    const [syllabi, setSyllabi] = useState([]);
    const [textbooks, setTextbooks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [allClasses, setAllClasses] = useState([]);

    // Form State
    const [selectedClass, setSelectedClass] = useState('');
    const [subjectName, setSubjectName] = useState('');
    const [url, setUrl] = useState('');
    const [selectedImage, setSelectedImage] = useState<ImagePickerResponse | null>(null);
    
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [syllabusRes, textbookRes, classesRes] = await Promise.all([
                apiClient.get('/resources/syllabus'),
                apiClient.get('/resources/textbooks'),
                apiClient.get('/all-classes')
            ]);
            setSyllabi(syllabusRes.data);
            setTextbooks(textbookRes.data);
            setAllClasses(classesRes.data);
        } catch (e) { Alert.alert("Error", "Failed to fetch data."); } 
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleChoosePhoto = () => {
        launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, (response) => {
            if (response.didCancel || response.errorCode) return;
            setSelectedImage(response);
        });
    };

    const resetForm = () => {
        setEditingItem(null);
        setSelectedClass('');
        setSubjectName('');
        setUrl('');
        setSelectedImage(null);
    };

    const openCreateModal = () => {
        resetForm();
        if (mainView === 'textbooks' && !editingItem) {
           // For creating textbook, find if an entry already exists to pre-fill
           const existing = textbooks.find(t => (t as any).class_group === selectedClass && (t as any).syllabus_type === boardView);
           if (existing) openEditModal(existing);
           else setIsModalVisible(true);
        } else {
           setIsModalVisible(true);
        }
    };

    const openEditModal = (item: any) => {
        setEditingItem(item);
        setSelectedClass(item.class_group);
        setUrl(item.url || '');
        if (mainView === 'syllabus') {
            setSubjectName(item.subject_name);
        }
        setSelectedImage(null);
        setIsModalVisible(true);
    };

    const handleDelete = (item: any) => {
        Alert.alert(`Confirm Delete`, `Delete syllabus for ${item.subject_name} (${item.class_group})?`, [
            { text: "Cancel", style: 'cancel' },
            { text: "Delete", style: 'destructive', onPress: async () => {
                if (mainView === 'syllabus') {
                    try {
                        await apiClient.delete(`/resources/syllabus/${item.id}`);
                        fetchData();
                    } catch(e) { Alert.alert("Error", `Could not delete syllabus.`); }
                }
            }},
        ]);
    };

    const handleSave = async () => {
        if (!selectedClass || !url) {
            return Alert.alert("Validation Error", "Class and URL are required.");
        }
        setIsSaving(true);
        
        const data = new FormData();
        data.append('class_group', selectedClass);
        data.append('url', url);
        data.append('syllabus_type', boardView); 

        if (mainView === 'syllabus') {
            if (!subjectName) {
                setIsSaving(false);
                return Alert.alert("Validation Error", "Subject Name is required for syllabus.");
            }
            data.append('subject_name', subjectName);
            if (selectedImage?.assets?.[0]) {
                data.append('coverImage', {
                    uri: selectedImage.assets[0].uri,
                    type: selectedImage.assets[0].type,
                    name: selectedImage.assets[0].fileName,
                });
            }
            
            try {
                const config = { headers: { 'Content-Type': 'multipart/form-data' } };
                if (editingItem) {
                    await apiClient.put(`/resources/syllabus/${editingItem.id}`, data, config);
                } else {
                    await apiClient.post('/resources/syllabus', data, config);
                }
            } catch (e: any) {
                setIsSaving(false);
                return Alert.alert("Error", e.response?.data?.message || "An error occurred.");
            }

        } else { // Textbooks
            try {
                await apiClient.post('/resources/textbooks', { class_group: selectedClass, url, syllabus_type: boardView });
            } catch (e: any) {
                setIsSaving(false);
                return Alert.alert("Error", e.response?.data?.message || "An error occurred.");
            }
        }
        
        Alert.alert("Success", "Saved successfully!");
        setIsSaving(false);
        setIsModalVisible(false);
        fetchData();
    };
    
    const renderList = () => {
        const isSyllabus = mainView === 'syllabus';
        const data = (isSyllabus ? syllabi : textbooks).filter((item: any) => item.syllabus_type === boardView);

        return (
            <FlatList
                data={data}
                keyExtractor={(item: any) => `${item.id}-${item.class_group}`}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.cardContent}>
                            <Text style={styles.cardTitle}>{isSyllabus ? item.subject_name : `Textbooks for ${item.class_group}`}</Text>
                            {isSyllabus && <Text style={styles.cardSubtitle}>{item.class_group}</Text>}
                            <Text style={styles.urlText} numberOfLines={1}>URL: {item.url}</Text>
                        </View>
                        <View style={styles.cardActions}>
                            <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(item)}><MaterialIcons name="edit" size={22} color="#0288d1" /></TouchableOpacity>
                            {isSyllabus && <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item)}><MaterialIcons name="delete" size={22} color="#d32f2f" /></TouchableOpacity>}
                        </View>
                    </View>
                )}
                ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>{`No ${mainView} added for ${boardView} board yet.`}</Text></View>}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchData} />}
                contentContainerStyle={{ flexGrow: 1 }}
            />
        );
    };
    
    return (
        <View style={styles.container}>
            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tab, mainView === 'syllabus' && styles.tabActive]} onPress={() => setMainView('syllabus')}>
                    <Text style={[styles.tabText, mainView === 'syllabus' && styles.tabTextActive]}>Syllabus</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, mainView === 'textbooks' && styles.tabActive]} onPress={() => setMainView('textbooks')}>
                    <Text style={[styles.tabText, mainView === 'textbooks' && styles.tabTextActive]}>Textbooks</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.boardPickerWrapper}>
                <Text style={styles.boardPickerLabel}>Board:</Text>
                <View style={styles.boardPickerContainer}>
                    <Picker
                        selectedValue={boardView}
                        onValueChange={(itemValue) => setBoardView(itemValue)}
                        style={styles.boardPicker}
                        dropdownIconColor="#333"
                    >
                        <Picker.Item label="State Board" value="state" />
                        <Picker.Item label="Central Board" value="central" />
                    </Picker>
                </View>
            </View>

            {isLoading ? <ActivityIndicator style={{marginTop: 20}} size="large" /> : renderList()}
            
            <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
                <MaterialIcons name="add" size={28} color="#fff" />
            </TouchableOpacity>

            <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} animationType="slide">
                <ScrollView style={styles.modalView} keyboardShouldPersistTaps="handled">
                    <Text style={styles.modalTitle}>{editingItem ? 'Edit' : 'Create'} {mainView === 'syllabus' ? 'Syllabus' : 'Textbook Link'}</Text>
                    
                    <Text style={styles.label}>Class*</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={selectedClass} onValueChange={itemValue => setSelectedClass(itemValue)} enabled={!editingItem}>
                            <Picker.Item label="-- Select a class --" value="" />
                            {allClasses.map((c: string) => <Picker.Item key={c} label={c} value={c} />)}
                        </Picker>
                    </View>

                    {mainView === 'syllabus' ? (
                        <>
                            <Text style={styles.label}>Subject Name*</Text>
                            <TextInput style={styles.input} value={subjectName} onChangeText={setSubjectName} placeholder="e.g., English" />
                            <Text style={styles.label}>Syllabus URL*</Text>
                            <TextInput style={styles.input} value={url} onChangeText={setUrl} placeholder="https://..." keyboardType="url" />

                            <Text style={styles.label}>Cover Image (Optional)</Text>
                            <TouchableOpacity style={styles.imagePicker} onPress={handleChoosePhoto}>
                                <MaterialIcons name="image" size={24} color="#555" />
                                <Text style={styles.imagePickerText}>{editingItem?.cover_image_url || selectedImage ? 'Change Image' : 'Select Cover Image'}</Text>
                            </TouchableOpacity>
                            
                            { (selectedImage?.assets?.[0]?.uri || editingItem?.cover_image_url) && 
                                <Image 
                                    style={styles.previewImage} 
                                    source={{ uri: selectedImage?.assets?.[0]?.uri || `${SERVER_URL}${editingItem.cover_image_url}` }} 
                                />
                            }
                        </>
                    ) : (
                        <>
                            <Text style={styles.label}>Textbook URL*</Text>
                            <TextInput style={styles.input} value={url} onChangeText={setUrl} placeholder="https://..." keyboardType="url" />
                        </>
                    )}

                    <View style={styles.modalActions}>
                        <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsModalVisible(false)}><Text style={styles.btnText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleSave} disabled={isSaving}>
                            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f8' },
    tabContainer: { flexDirection: 'row', backgroundColor: '#fff', elevation: 2 },
    tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: '#008080' },
    tabText: { fontSize: 16, color: '#757575' },
    tabTextActive: { color: '#008080', fontWeight: 'bold' },
    boardPickerWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    boardPickerLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginRight: 10,
    },
    boardPickerContainer: {
        flex: 1,
        height: 50,
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    boardPicker: {
        color: '#000',
    },
    card: { backgroundColor: '#fff', borderRadius: 8, marginHorizontal: 15, marginVertical: 8, padding: 20, elevation: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardContent: { flex: 1, marginRight: 10 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#37474f' },
    cardSubtitle: { fontSize: 14, color: '#546e7a', marginTop: 4 },
    urlText: { fontSize: 13, color: '#546e7a', marginTop: 4, fontStyle: 'italic' },
    cardActions: { flexDirection: 'row' },
    actionButton: { padding: 8 },
    fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#1e88e5', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 4 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#777' },
    modalView: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    label: { fontSize: 16, fontWeight: '500', color: '#444', marginBottom: 5, marginLeft: 5, marginTop: 10 },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 5 },
    pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, backgroundColor: '#fff', marginBottom: 5 },
    imagePicker: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0e0e0', padding: 12, borderRadius: 8, marginBottom: 10 },
    imagePickerText: { marginLeft: 10, fontSize: 16 },
    previewImage: { width: 100, height: 100, borderRadius: 8, alignSelf: 'center', marginBottom: 10 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 30, marginBottom: 50 },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 5, elevation: 2 },
    saveBtn: { backgroundColor: '#388e3c' },
    cancelBtn: { backgroundColor: '#6c757d' },
    btnText: { color: '#fff', fontWeight: 'bold' },
});

export default TeacherAdminResourcesScreen;