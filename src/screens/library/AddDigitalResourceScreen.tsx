/**
 * File: src/screens/library/AddDigitalResourceScreen.js
 * Purpose: Upload or Edit Digital Resources (PDFs, Docs, etc.)
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI Header.
 */
import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Alert, ActivityIndicator, ScrollView, Image, Platform, KeyboardAvoidingView,
    SafeAreaView, useColorScheme, StatusBar, Dimensions
} from 'react-native';
import { pick, types, isCancel } from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useNavigation, useRoute } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

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
    textPlaceholder: '#94A3B8',
    imagePickerBg: '#E2E8F0',
    fileBtnBg: '#F0F9FF',
    fileBtnBorder: '#BAE6FD',
    fileBtnText: '#0284C7',
    fileBtnSelectedBg: '#E0F2FE',
    fileBtnSelectedText: '#0369A1',
    white: '#ffffff',
    disabledBtn: '#94A3B8'
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
    imagePickerBg: '#252525',
    fileBtnBg: '#1e293b',
    fileBtnBorder: '#334155',
    fileBtnText: '#38bdf8',
    fileBtnSelectedBg: '#0f172a',
    fileBtnSelectedText: '#7dd3fc',
    white: '#ffffff',
    disabledBtn: '#475569'
};

const AddDigitalResourceScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const navigation = useNavigation();
    const route = useRoute();
    const isEditMode = route.params?.resource ? true : false;
    const existingResource = route.params?.resource || {};

    const [loading, setLoading] = useState(false);
    
    // Hide default header to use our custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    // Form Data
    const [formData, setFormData] = useState({
        title: '',
        author: '',
        book_no: '',
        category: '',
        publisher: ''
    });

    const [file, setFile] = useState(null);
    const [coverImage, setCoverImage] = useState(null);

    // Populate data if Edit Mode
    useEffect(() => {
        if (isEditMode) {
            setFormData({
                title: existingResource.title || '',
                author: existingResource.author || '',
                book_no: existingResource.book_no || '',
                category: existingResource.category || '',
                publisher: existingResource.publisher || ''
            });
        }
    }, [isEditMode, existingResource]);

    const handleUpload = async () => {
        if (!formData.title || !formData.author) {
            Alert.alert("Missing Fields", "Title and Author are required.");
            return;
        }
        
        // If Adding: File is required. If Editing: File is optional.
        if (!isEditMode && !file) {
            Alert.alert("Missing File", "Please select a document to upload.");
            return;
        }

        setLoading(true);
        try {
            const data = new FormData();
            
            data.append('title', formData.title);
            data.append('author', formData.author);
            data.append('book_no', formData.book_no);
            data.append('category', formData.category);
            data.append('publisher', formData.publisher);
            
            // Only append file/cover if new ones are selected
            if (file) {
                data.append('file', {
                    uri: file.uri,
                    type: file.type || 'application/pdf',
                    name: file.name || `doc_${Date.now()}.pdf`,
                });
            }

            if (coverImage) {
                const imageUri = Platform.OS === 'android' ? coverImage.uri : coverImage.uri.replace('file://', '');
                data.append('cover_image', {
                    uri: imageUri,
                    type: coverImage.type || 'image/jpeg',
                    name: coverImage.fileName || `cover_${Date.now()}.jpg`,
                });
            }

            if (isEditMode) {
                // PUT Request
                await apiClient.put(`/library/digital/${existingResource.id}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                Alert.alert("Success", "Resource updated!", [{ text: "OK", onPress: () => navigation.navigate('DigitalLibraryScreen') }]);
            } else {
                // POST Request
                await apiClient.post('/library/digital', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                Alert.alert("Success", "Resource uploaded!", [{ text: "OK", onPress: () => navigation.goBack() }]);
            }

        } catch (error) {
            console.error("Error:", error);
            Alert.alert("Error", "Operation failed.");
        } finally {
            setLoading(false);
        }
    };

    // Pickers
    const pickCover = async () => {
        try {
            const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
            if (result.assets?.length > 0) setCoverImage(result.assets[0]);
        } catch (error) {}
    };

    const selectFile = async () => {
        try {
            const result = await pick({ allowMultiSelection: false, type: [types.pdf, types.doc, types.images] });
            if (result?.length > 0) setFile(result[0]);
        } catch (err) { 
            if (!isCancel(err)) Alert.alert("Error", "File selection failed"); 
        }
    };

    // Determine current cover URL for preview in edit mode
    const currentCoverUrl = coverImage ? coverImage.uri : (isEditMode && existingResource.cover_image_url ? `${SERVER_URL}${existingResource.cover_image_url}` : null);

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            
            {/* Header Card */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={theme.textMain} />
                    </TouchableOpacity>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialIcons name="cloud-upload" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>
                            {isEditMode ? "Edit Resource" : "Upload Resource"}
                        </Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Digital Library</Text>
                    </View>
                </View>
            </View>

            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : undefined} 
                style={styles.container}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    
                    {/* Cover Image Picker */}
                    <TouchableOpacity 
                        style={[styles.coverPicker, { backgroundColor: theme.imagePickerBg, borderColor: theme.border }]} 
                        onPress={pickCover}
                    >
                        {currentCoverUrl ? (
                            <Image source={{ uri: currentCoverUrl }} style={styles.previewImage} resizeMode="cover" />
                        ) : (
                            <View style={styles.placeholder}>
                                <Text style={styles.cameraIcon}>📷</Text>
                                <Text style={[styles.placeholderText, { color: theme.textSub }]}>Cover Image</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Form Card */}
                    <View style={[styles.card, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                        <InputGroup 
                            label="Title *" 
                            value={formData.title} 
                            onChangeText={t => setFormData({...formData, title: t})} 
                            theme={theme} 
                        />
                        <InputGroup 
                            label="Author *" 
                            value={formData.author} 
                            onChangeText={t => setFormData({...formData, author: t})} 
                            theme={theme} 
                        />
                        
                        <View style={styles.row}>
                            <InputGroup 
                                containerStyle={{flex:1, marginRight:10}} 
                                label="Book No" 
                                value={formData.book_no} 
                                onChangeText={t => setFormData({...formData, book_no: t})} 
                                theme={theme} 
                            />
                            <InputGroup 
                                containerStyle={{flex:1}} 
                                label="Category" 
                                value={formData.category} 
                                onChangeText={t => setFormData({...formData, category: t})} 
                                theme={theme} 
                            />
                        </View>

                        <InputGroup 
                            label="Publisher" 
                            value={formData.publisher} 
                            onChangeText={t => setFormData({...formData, publisher: t})} 
                            theme={theme} 
                        />

                        {/* File Upload Section */}
                        <View style={styles.fileSection}>
                            <Text style={[styles.label, { color: theme.textSub }]}>
                                {isEditMode ? "Update Document (Optional)" : "Document *"}
                            </Text>
                            <TouchableOpacity 
                                style={[
                                    styles.fileButton, 
                                    { backgroundColor: theme.fileBtnBg, borderColor: theme.fileBtnBorder },
                                    file && { backgroundColor: theme.fileBtnSelectedBg, borderStyle: 'solid' }
                                ]} 
                                onPress={selectFile}
                            >
                                <Text style={[
                                    styles.fileButtonText, 
                                    { color: theme.fileBtnText },
                                    file && { color: theme.fileBtnSelectedText }
                                ]}>
                                    {file ? `📄 ${file.name}` : (isEditMode ? "📎 Change File (Tap here)" : "📎 Select PDF / Doc")}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity 
                        style={[
                            styles.uploadButton, 
                            { backgroundColor: theme.primary }, 
                            loading && { backgroundColor: theme.disabledBtn }
                        ]} 
                        onPress={handleUpload} 
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={theme.white} />
                        ) : (
                            <Text style={[styles.btnText, { color: theme.white }]}>
                                {isEditMode ? "Update Resource" : "Upload Resource"}
                            </Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// Helper Component (Injects theme automatically)
const InputGroup = ({ label, value, onChangeText, containerStyle, theme }) => (
    <View style={[styles.formGroup, containerStyle]}>
        <Text style={[styles.label, { color: theme.textSub }]}>{label}</Text>
        <TextInput 
            style={[
                styles.input, 
                { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }
            ]} 
            value={value} 
            onChangeText={onChangeText} 
            placeholderTextColor={theme.textPlaceholder} 
        />
    </View>
);

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { flex: 1 },
    
    // --- HEADER STYLES ---
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
        elevation: 3,
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    backButton: { marginRight: 10, padding: 4 },
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

    scrollContent: { paddingHorizontal: width * 0.04, paddingBottom: 30 },
    
    coverPicker: { 
        height: 160, 
        width: 120, 
        borderRadius: 12, 
        marginBottom: 20, 
        alignSelf: 'center', 
        justifyContent: 'center', 
        alignItems: 'center', 
        overflow: 'hidden',
        borderWidth: 1,
        borderStyle: 'dashed'
    },
    previewImage: { width: '100%', height: '100%' },
    placeholder: { alignItems: 'center' },
    cameraIcon: { fontSize: 28 },
    placeholderText: { fontSize: 12, marginTop: 4 },
    
    card: { 
        borderRadius: 16, 
        padding: 20, 
        elevation: 2, 
        shadowOpacity: 0.05, 
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 }
    },
    formGroup: { marginBottom: 15 },
    row: { flexDirection: 'row' },
    label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
    input: { 
        borderWidth: 1, 
        borderRadius: 8, 
        padding: 12, 
        fontSize: 15 
    },
    
    fileSection: { marginTop: 5 },
    fileButton: { 
        padding: 14, 
        borderRadius: 8, 
        alignItems: 'center', 
        borderWidth: 1, 
        borderStyle: 'dashed' 
    },
    fileButtonText: { fontWeight: '600' },
    
    uploadButton: { 
        padding: 16, 
        borderRadius: 12, 
        alignItems: 'center', 
        marginTop: 25,
        elevation: 3
    },
    btnText: { fontWeight: 'bold', fontSize: 16 }
});

export default AddDigitalResourceScreen;