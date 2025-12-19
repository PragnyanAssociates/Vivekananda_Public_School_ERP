import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
    Alert, Image, ActivityIndicator, Platform, KeyboardAvoidingView
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useNavigation, useRoute } from '@react-navigation/native';

const AddBookScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    
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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                
                <Text style={styles.header}>{isEditMode ? 'Edit Book' : 'Add New Book'}</Text>

                <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                    {previewSource ? (
                        <Image source={previewSource} style={styles.previewImage} />
                    ) : (
                        <View style={styles.placeholder}>
                            <Text style={styles.plusIcon}>+</Text>
                            <Text style={styles.placeholderText}>Upload Cover</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <View style={styles.card}>
                    <InputLabel label="Book Title *" placeholder="e.g. Clean Code" value={formData.title} onChangeText={t => handleInputChange('title', t)} />
                    <InputLabel label="Author *" placeholder="e.g. Robert C. Martin" value={formData.author} onChangeText={t => handleInputChange('author', t)} />
                    
                    <View style={styles.row}>
                        <InputLabel containerStyle={{flex:1, marginRight:10}} label="Book No. *" placeholder="e.g. BK-101" value={formData.book_no} onChangeText={t => handleInputChange('book_no', t)} />
                        <InputLabel containerStyle={{flex:1}} label="Category" placeholder="e.g. Tech" value={formData.category} onChangeText={t => handleInputChange('category', t)} />
                    </View>

                    <View style={styles.row}>
                        <InputLabel containerStyle={{flex:1, marginRight:10}} label="Total Copies *" placeholder="10" keyboardType="numeric" value={formData.total_copies} onChangeText={t => handleInputChange('total_copies', t)} />
                        <InputLabel containerStyle={{flex:1}} label="Rack No" placeholder="A-1" value={formData.rack_no} onChangeText={t => handleInputChange('rack_no', t)} />
                    </View>

                    <InputLabel label="Publisher" placeholder="Optional" value={formData.publisher} onChangeText={t => handleInputChange('publisher', t)} />
                </View>

                <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>{isEditMode ? 'Update Book' : 'Save Book'}</Text>}
                </TouchableOpacity>

            </ScrollView>
        </KeyboardAvoidingView>
    );
};

// Helper Component
const InputLabel = ({ label, placeholder, value, onChangeText, keyboardType, containerStyle }) => (
    <View style={[styles.inputGroup, containerStyle]}>
        <Text style={styles.label}>{label}</Text>
        <TextInput 
            style={styles.input} 
            placeholder={placeholder} 
            placeholderTextColor="#94A3B8"
            value={value} 
            onChangeText={onChangeText}
            keyboardType={keyboardType}
        />
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F1F5F9' },
    scrollContainer: { padding: 20 },
    header: { fontSize: 22, fontWeight: 'bold', color: '#1E293B', marginBottom: 20, textAlign: 'center' },
    imagePicker: { width: 120, height: 160, backgroundColor: '#E2E8F0', alignSelf: 'center', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed' },
    previewImage: { width: '100%', height: '100%' },
    placeholder: { alignItems: 'center' },
    plusIcon: { fontSize: 30, color: '#64748B' },
    placeholderText: { fontSize: 12, color: '#64748B', marginTop: 4 },
    card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
    inputGroup: { marginBottom: 16 },
    row: { flexDirection: 'row' },
    label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, fontSize: 15, color: '#1E293B' },
    submitButton: { backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 24, elevation: 3 },
    submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});

export default AddBookScreen;