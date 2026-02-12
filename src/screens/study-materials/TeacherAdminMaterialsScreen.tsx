/**
 * File: src/screens/study-materials/TeacherAdminMaterialsScreen.tsx
 * Purpose: Teacher/Admin screen to manage Study Materials (Upload/Edit/Delete).
 * Updated: Back Button Removed, Responsive Design, Dark/Light Mode.
 */
import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    ActivityIndicator, Alert, Modal, ScrollView, TextInput, 
    Linking, SafeAreaView, useColorScheme, StatusBar, Dimensions,
    KeyboardAvoidingView, Platform
} from 'react-native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Picker } from '@react-native-picker/picker';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { pick, types, isCancel } from '@react-native-documents/picker';
import * as Animatable from 'react-native-animatable';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#cbd5e1',
    inputBg: '#F8FAFC',
    inputBorder: '#E2E8F0',
    iconBg: '#E0F2F1',
    textPlaceholder: '#94a3b8',
    white: '#ffffff',
    success: '#43A047',
    danger: '#E53935',
    blue: '#1E88E5',
    purple: '#8E24AA',
    cancelBtnBg: '#E2E8F0',
    cancelBtnText: '#334155',
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
    purple: '#AB47BC',
    cancelBtnBg: '#333333',
    cancelBtnText: '#E0E0E0',
    emptyIcon: '#475569'
};

const TeacherAdminMaterialsScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const { user } = useAuth();
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    const [materials, setMaterials] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState(null);

    // Hide default header to use our custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const fetchMaterials = useCallback(async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/study-materials/teacher/${user.id}`);
            setMaterials(response.data);
        } catch (error) { 
            Alert.alert("Error", "Failed to fetch materials."); 
        } finally { 
            setIsLoading(false); 
        }
    }, [user?.id]);

    useEffect(() => {
        if (isFocused) fetchMaterials();
    }, [isFocused, fetchMaterials]);

    const openModal = (material = null) => {
        setEditingMaterial(material);
        setIsModalVisible(true);
    };

    const handleMenuPress = (material) => {
        Alert.alert(
            "Manage Material",
            `Options for "${material.title}"`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Edit", onPress: () => openModal(material) },
                { text: "Delete", style: "destructive", onPress: () => handleDelete(material) }
            ]
        );
    };

    const handleDelete = (material) => {
        Alert.alert("Confirm Delete", "Permanently delete this material?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive",
                onPress: async () => {
                    try {
                        await apiClient.delete(`/study-materials/${material.material_id}`);
                        setMaterials(prev => prev.filter(m => m.material_id !== material.material_id));
                        Alert.alert("Success", "Material deleted.");
                    } catch (error) { Alert.alert("Error", "Failed to delete."); }
                },
            },
        ]);
    };

    const renderItem = ({ item, index }) => (
        <Animatable.View animation="fadeInUp" duration={500} delay={index * 50} style={styles.cardWrapper}>
            <View style={[styles.card, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={[styles.cardTitle, { color: theme.textMain }]} numberOfLines={2}>{item.title}</Text>
                        <Text style={[styles.cardSubtitle, { color: theme.textSub }]}>{item.class_group} • {item.subject}</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => handleMenuPress(item)} 
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
                        <MaterialIcons name="more-vert" size={24} color={theme.textMain} />
                    </TouchableOpacity>
                </View>
                
                <Text style={[styles.cardDescription, { color: theme.textSub }]} numberOfLines={3}>
                    {item.description || 'No description provided.'}
                </Text>
                
                <View style={styles.buttonContainer}>
                    {item.file_path && (
                        <TouchableOpacity 
                            style={[styles.viewButton, { backgroundColor: theme.blue }]} 
                            onPress={() => Linking.openURL(`${SERVER_URL}${item.file_path}`)}
                        >
                            <MaterialIcons name="cloud-download" size={18} color={theme.white} />
                            <Text style={[styles.viewButtonText, { color: theme.white }]}>Download</Text>
                        </TouchableOpacity>
                    )}
                    {item.external_link && (
                        <TouchableOpacity 
                            style={[styles.viewButton, { backgroundColor: theme.purple, marginTop: item.file_path ? 8 : 0 }]} 
                            onPress={() => Linking.openURL(item.external_link)}
                        >
                            <MaterialIcons name="open-in-new" size={18} color={theme.white} />
                            <Text style={[styles.viewButtonText, { color: theme.white }]}>Link</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Animatable.View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />
            
            {/* --- HEADER CARD (Back Button Removed) --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialCommunityIcons name="notebook-edit-outline" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>My Materials</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Uploads & Management</Text>
                    </View>
                </View>
                <TouchableOpacity style={[styles.headerBtn, { backgroundColor: theme.primary }]} onPress={() => openModal(null)}>
                    <MaterialIcons name="add" size={18} color={theme.white} />
                    <Text style={[styles.headerBtnText, { color: theme.white }]}>Add</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={materials}
                renderItem={renderItem}
                keyExtractor={(item) => item.material_id.toString()}
                contentContainerStyle={styles.listContent}
                refreshing={isLoading}
                onRefresh={fetchMaterials}
                ListEmptyComponent={
                    !isLoading && (
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="folder-open-outline" size={50} color={theme.emptyIcon} />
                            <Text style={[styles.emptyText, { color: theme.textSub }]}>No materials uploaded yet.</Text>
                        </View>
                    )
                }
            />

            {isModalVisible && (
                <MaterialFormModal 
                    material={editingMaterial} 
                    theme={theme} 
                    onClose={() => setIsModalVisible(false)} 
                    onSave={fetchMaterials} 
                />
            )}
        </SafeAreaView>
    );
};

// --- Modal Form Component ---
const MaterialFormModal = ({ material, theme, onClose, onSave }) => {
    const { user } = useAuth();
    const isEditMode = !!material;
    
    const [title, setTitle] = useState(isEditMode ? material.title : '');
    const [description, setDescription] = useState(isEditMode ? material.description : '');
    const [subject, setSubject] = useState(isEditMode ? material.subject : '');
    const [classGroup, setClassGroup] = useState(isEditMode ? material.class_group : '');
    const [materialType, setMaterialType] = useState(isEditMode ? material.material_type : 'Notes');
    const [externalLink, setExternalLink] = useState(isEditMode ? material.external_link || '' : '');
    const [file, setFile] = useState(null);
    const [studentClasses, setStudentClasses] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchClasses = async () => { 
            try { 
                const response = await apiClient.get('/student-classes');
                setStudentClasses(response.data); 
            } catch (e) { console.error(e); }
        };
        fetchClasses();
    }, []);

    const handleFilePick = async () => {
        try {
            const result = await pick({ type: [types.allFiles], allowMultiSelection: false });
            if (result && result.length > 0) setFile(result[0]);
        } catch (err) { if (!isCancel(err)) Alert.alert("Error", "File selection failed."); }
    };

    const handleSave = async () => {
        if (!title || !classGroup) return Alert.alert("Required", "Title and Class are required.");
        setIsSaving(true);
        const data = new FormData();
        data.append('title', title);
        data.append('description', description);
        data.append('class_group', classGroup);
        data.append('subject', subject);
        data.append('material_type', materialType);
        data.append('external_link', externalLink);
        data.append('uploaded_by', user.id.toString());

        if (file) {
            data.append('materialFile', { uri: file.uri, type: file.type, name: file.name });
        } else if (isEditMode && material.file_path) {
            data.append('existing_file_path', material.file_path);
        }
        
        try {
            const config = { headers: { 'Content-Type': 'multipart/form-data' } };
            if (isEditMode) await apiClient.put(`/study-materials/${material.material_id}`, data, config);
            else await apiClient.post('/study-materials', data, config);
            Alert.alert("Success", "Saved successfully.");
            onSave(); onClose();
        } catch (error) { Alert.alert("Error", "Save failed."); } 
        finally { setIsSaving(false); }
    };

    return (
        <Modal visible={true} onRequestClose={onClose} animationType="slide" transparent>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackground}>
                <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
                    
                    <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                        <Text style={[styles.modalTitle, { color: theme.textMain }]}>{isEditMode ? 'Edit Material' : 'New Material'}</Text>
                        <TouchableOpacity onPress={onClose}>
                            <MaterialIcons name="close" size={24} color={theme.textMain} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                        <Text style={[styles.label, { color: theme.textSub }]}>Title *</Text>
                        <TextInput 
                            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                            value={title} 
                            onChangeText={setTitle} 
                            placeholder="e.g. Chapter 1 Notes" 
                            placeholderTextColor={theme.textPlaceholder} 
                        />
                        
                        <Text style={[styles.label, { color: theme.textSub }]}>Class *</Text>
                        <View style={[styles.pickerContainer, { borderColor: theme.inputBorder, backgroundColor: theme.inputBg }]}>
                            <Picker 
                                selectedValue={classGroup} 
                                onValueChange={setClassGroup} 
                                style={{ color: theme.textMain }} 
                                dropdownIconColor={theme.textMain}
                            >
                                <Picker.Item label="-- Select Class --" value="" />
                                {studentClasses.map(c => <Picker.Item key={c} label={c} value={c} />)}
                            </Picker>
                        </View>
                        
                        <Text style={[styles.label, { color: theme.textSub }]}>Subject</Text>
                        <TextInput 
                            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                            value={subject} 
                            onChangeText={setSubject} 
                            placeholder="e.g. Science" 
                            placeholderTextColor={theme.textPlaceholder} 
                        />
                        
                        <Text style={[styles.label, { color: theme.textSub }]}>Type *</Text>
                        <View style={[styles.pickerContainer, { borderColor: theme.inputBorder, backgroundColor: theme.inputBg }]}>
                            <Picker 
                                selectedValue={materialType} 
                                onValueChange={setMaterialType} 
                                style={{ color: theme.textMain }} 
                                dropdownIconColor={theme.textMain}
                            >
                                {['Notes', 'Presentation', 'Video Lecture', 'Worksheet', 'Link', 'Other'].map(t => <Picker.Item key={t} label={t} value={t} />)}
                            </Picker>
                        </View>
                        
                        <Text style={[styles.label, { color: theme.textSub }]}>External Link (Optional)</Text>
                        <TextInput 
                            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                            value={externalLink} 
                            onChangeText={setExternalLink} 
                            keyboardType="url" 
                            placeholder="https://..." 
                            placeholderTextColor={theme.textPlaceholder} 
                        />
                        
                        <TouchableOpacity style={[styles.uploadButton, { backgroundColor: theme.blue, marginTop: 15 }]} onPress={handleFilePick}>
                            <MaterialIcons name="attach-file" size={20} color="#fff" />
                            <Text style={styles.uploadButtonText} numberOfLines={1}>
                                {file ? file.name : (material?.file_path?.split('/').pop() || 'Select File')}
                            </Text>
                        </TouchableOpacity>
                        
                        <Text style={[styles.label, { color: theme.textSub }]}>Description</Text>
                        <TextInput 
                            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain, height: 100, textAlignVertical: 'top' }]} 
                            multiline 
                            value={description} 
                            onChangeText={setDescription} 
                            placeholder="Details..." 
                            placeholderTextColor={theme.textPlaceholder} 
                        />
                        
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.cancelBtnBg }]} onPress={onClose}>
                                <Text style={[styles.cancelBtnText, { color: theme.cancelBtnText }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.success }]} onPress={handleSave} disabled={isSaving}>
                                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Save</Text>}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
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
    // Back button style removed
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

    listContent: { paddingHorizontal: width * 0.04, paddingBottom: 20 },
    cardWrapper: { marginBottom: 15 },
    
    card: { 
        borderRadius: 12, 
        padding: 15, 
        elevation: 2, 
        shadowOpacity: 0.05, 
        shadowRadius: 3, 
        shadowOffset: { width: 0, height: 1 } 
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
    cardSubtitle: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
    cardDescription: { fontSize: 14, marginBottom: 15, lineHeight: 20 },
    
    buttonContainer: { marginTop: 5 },
    viewButton: { 
        flexDirection: 'row', 
        paddingVertical: 10, 
        borderRadius: 8, 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    viewButtonText: { fontWeight: 'bold', marginLeft: 6, fontSize: 13 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
    emptyText: { textAlign: 'center', fontSize: 16, marginTop: 10 },

    // --- MODAL STYLES ---
    modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', borderRadius: 16, padding: 20, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 10, borderBottomWidth: 1 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    
    label: { fontSize: 14, fontWeight: '600', marginBottom: 5, marginTop: 10 },
    input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
    pickerContainer: { borderWidth: 1, borderRadius: 8, marginBottom: 5, overflow: 'hidden' },
    
    uploadButton: { flexDirection: 'row', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    uploadButtonText: { fontWeight: 'bold', marginLeft: 8, fontSize: 14, flex: 1 },
    
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 25, marginBottom: 10 },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
    modalBtnText: { fontWeight: 'bold', fontSize: 16 },
    cancelBtnText: { fontWeight: 'bold', fontSize: 16 },
});

export default TeacherAdminMaterialsScreen;