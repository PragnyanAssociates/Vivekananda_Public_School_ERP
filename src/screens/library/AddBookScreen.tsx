/**
 * File: src/screens/library/AddBookScreen.js
 * Purpose: Screen to Add or Edit a Book in the Library.
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI Header.
 */
import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
    Alert, Image, ActivityIndicator, Platform, KeyboardAvoidingView, 
    SafeAreaView, useColorScheme, StatusBar, Dimensions
} from 'react-native';
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
    white: '#ffffff'
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
    white: '#ffffff'
};

const AddBookScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const navigation = useNavigation();
    const route = useRoute();
    
    // Hide default header to use our custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    // Check if we are in Edit Mode
    const isEditMode = route.params?.book ? true : false;
    const bookToEdit = route.params?.book || {};

    const [loading, setLoading] = useState(false);
    const [image, setImage] = useState(null);

    const [formData, setFormData] = useState({
        title: '',
        author: '',
        book_no: '',
        category: '',
        publisher: '',
        total_copies: '',
        rack_no: ''
    });

    // Populate form if Edit Mode
    useEffect(() => {
        if (isEditMode) {
            setFormData({
                title: bookToEdit.title || '',
                author: bookToEdit.author || '',
                book_no: bookToEdit.book_no || '',
                category: bookToEdit.category || '',
                publisher: bookToEdit.publisher || '',
                total_copies: bookToEdit.total_copies ? String(bookToEdit.total_copies) : '',
                rack_no: bookToEdit.rack_no || ''
            });
        }
    }, [isEditMode]);

    const handleInputChange = (field, value) => {
        setFormData({ ...formData, [field]: value });
    };

    const pickImage = async () => {
        const options = { mediaType: 'photo', quality: 0.7, selectionLimit: 1 };
        try {
            const result = await launchImageLibrary(options);
            if (result.assets && result.assets.length > 0) {
                setImage(result.assets[0]);
            }
        } catch (error) {
            Alert.alert("Error", "Could not access gallery");
        }
    };

    const handleSubmit = async () => {
        if (!formData.title || !formData.author || !formData.total_copies || !formData.book_no) {
            Alert.alert('Validation', 'Please fill Title, Author, Book No, and Total Copies.');
            return;
        }

        setLoading(true);
        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => data.append(key, formData[key]));

            if (image) {
                const imageUri = Platform.OS === 'android' ? image.uri : image.uri.replace('file://', '');
                data.append('cover_image', {
                    uri: imageUri,
                    type: image.type || 'image/jpeg',
                    name: image.fileName || `cover_${Date.now()}.jpg`,
                });
            }

            if (isEditMode) {
                // UPDATE REQUEST
                await apiClient.put(`/library/books/${bookToEdit.id}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                Alert.alert('Success', 'Book updated successfully!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
            } else {
                // ADD REQUEST
                await apiClient.post('/library/books', data, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                Alert.alert('Success', 'Book added successfully!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
            }

        } catch (error) {
            console.error('Save Book Error:', error);
            const msg = error.response?.data?.message || 'Operation failed.';
            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    // Determine image source for preview
    const getPreviewSource = () => {
        if (image) return { uri: image.uri };
        if (isEditMode && bookToEdit.cover_image_url) return { uri: `${SERVER_URL}${bookToEdit.cover_image_url}` };
        return null;
    };
    const previewSource = getPreviewSource();

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
                        <MaterialIcons name="library-books" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>
                            {isEditMode ? 'Edit Book' : 'Add New Book'}
                        </Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Library Management</Text>
                    </View>
                </View>
            </View>

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                style={styles.container}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                    
                    {/* Image Picker */}
                    <TouchableOpacity 
                        style={[styles.imagePicker, { backgroundColor: theme.imagePickerBg, borderColor: theme.border }]} 
                        onPress={pickImage}
                    >
                        {previewSource ? (
                            <Image source={previewSource} style={styles.previewImage} />
                        ) : (
                            <View style={styles.placeholder}>
                                <Text style={[styles.plusIcon, { color: theme.textSub }]}>+</Text>
                                <Text style={[styles.placeholderText, { color: theme.textSub }]}>Upload Cover</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Form Card */}
                    <View style={[styles.card, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                        <InputLabel 
                            label="Book Title *" 
                            placeholder="e.g. Clean Code" 
                            value={formData.title} 
                            onChangeText={t => handleInputChange('title', t)} 
                            theme={theme}
                        />
                        <InputLabel 
                            label="Author *" 
                            placeholder="e.g. Robert C. Martin" 
                            value={formData.author} 
                            onChangeText={t => handleInputChange('author', t)} 
                            theme={theme}
                        />
                        
                        <View style={styles.row}>
                            <InputLabel 
                                containerStyle={{flex:1, marginRight:10}} 
                                label="Book No. *" 
                                placeholder="e.g. BK-101" 
                                value={formData.book_no} 
                                onChangeText={t => handleInputChange('book_no', t)} 
                                theme={theme}
                            />
                            <InputLabel 
                                containerStyle={{flex:1}} 
                                label="Category" 
                                placeholder="e.g. Tech" 
                                value={formData.category} 
                                onChangeText={t => handleInputChange('category', t)} 
                                theme={theme}
                            />
                        </View>

                        <View style={styles.row}>
                            <InputLabel 
                                containerStyle={{flex:1, marginRight:10}} 
                                label="Total Copies *" 
                                placeholder="10" 
                                keyboardType="numeric" 
                                value={formData.total_copies} 
                                onChangeText={t => handleInputChange('total_copies', t)} 
                                theme={theme}
                            />
                            <InputLabel 
                                containerStyle={{flex:1}} 
                                label="Rack No" 
                                placeholder="A-1" 
                                value={formData.rack_no} 
                                onChangeText={t => handleInputChange('rack_no', t)} 
                                theme={theme}
                            />
                        </View>

                        <InputLabel 
                            label="Publisher" 
                            placeholder="Optional" 
                            value={formData.publisher} 
                            onChangeText={t => handleInputChange('publisher', t)} 
                            theme={theme}
                        />
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity 
                        style={[styles.submitButton, { backgroundColor: theme.primary }]} 
                        onPress={handleSubmit} 
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={theme.white} />
                        ) : (
                            <Text style={[styles.submitButtonText, { color: theme.white }]}>
                                {isEditMode ? 'Update Book' : 'Save Book'}
                            </Text>
                        )}
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// Helper Component (Injects theme automatically)
const InputLabel = ({ label, placeholder, value, onChangeText, keyboardType, containerStyle, theme }) => (
    <View style={[styles.inputGroup, containerStyle]}>
        <Text style={[styles.label, { color: theme.textSub }]}>{label}</Text>
        <TextInput 
            style={[
                styles.input, 
                { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }
            ]} 
            placeholder={placeholder} 
            placeholderTextColor={theme.textPlaceholder}
            value={value} 
            onChangeText={onChangeText}
            keyboardType={keyboardType}
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

    scrollContainer: { paddingHorizontal: width * 0.04, paddingBottom: 30 },
    
    imagePicker: { 
        width: 120, 
        height: 160, 
        alignSelf: 'center', 
        borderRadius: 12, 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginBottom: 20, 
        overflow: 'hidden', 
        borderWidth: 1, 
        borderStyle: 'dashed' 
    },
    previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    placeholder: { alignItems: 'center' },
    plusIcon: { fontSize: 30 },
    placeholderText: { fontSize: 12, marginTop: 4 },
    
    card: { 
        borderRadius: 16, 
        padding: 20, 
        elevation: 2, 
        shadowOpacity: 0.05, 
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 }
    },
    inputGroup: { marginBottom: 16 },
    row: { flexDirection: 'row' },
    label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
    input: { 
        borderWidth: 1, 
        borderRadius: 8, 
        padding: 12, 
        fontSize: 15 
    },
    
    submitButton: { 
        paddingVertical: 16, 
        borderRadius: 12, 
        alignItems: 'center', 
        marginTop: 20, 
        elevation: 3 
    },
    submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});

export default AddBookScreen;