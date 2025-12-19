import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    Image,
    ActivityIndicator,
    Platform
} from 'react-native';
// ★ CLI Image Picker Import
import { launchImageLibrary } from 'react-native-image-picker';

import apiClient from '../../api/client';
import { useNavigation } from '@react-navigation/native';

const AddBookScreen = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    const [image, setImage] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        author: '',
        isbn: '',
        category: '',
        publisher: '',
        total_copies: '',
        rack_no: ''
    });

    const handleInputChange = (field, value) => {
        setFormData({ ...formData, [field]: value });
    };

    // ★ CLI Image Picker Logic
    const pickImage = async () => {
        const options = {
            mediaType: 'photo',
            quality: 0.7,
            selectionLimit: 1,
        };

        try {
            const result = await launchImageLibrary(options);

            if (result.didCancel) {
                console.log('User cancelled image picker');
            } else if (result.errorCode) {
                Alert.alert('Error', result.errorMessage);
            } else if (result.assets && result.assets.length > 0) {
                // Save the first asset
                setImage(result.assets[0]);
            }
        } catch (error) {
            console.error("Picker Error: ", error);
            Alert.alert("Error", "Could not open image library");
        }
    };

    // Submit Function
    const handleSubmit = async () => {
        if (!formData.title || !formData.author || !formData.total_copies) {
            Alert.alert('Missing Fields', 'Please fill in Title, Author, and Total Copies.');
            return;
        }

        setLoading(true);

        try {
            const data = new FormData();
            
            // Append text fields
            data.append('title', formData.title);
            data.append('author', formData.author);
            data.append('isbn', formData.isbn);
            data.append('category', formData.category);
            data.append('publisher', formData.publisher);
            data.append('total_copies', formData.total_copies);
            data.append('rack_no', formData.rack_no);

            // Append Image if selected
            if (image) {
                const imageUri = Platform.OS === 'android' ? image.uri : image.uri.replace('file://', '');
                
                data.append('cover_image', {
                    uri: imageUri,
                    type: image.type || 'image/jpeg',
                    name: image.fileName || `book_cover_${Date.now()}.jpg`,
                });
            }

            // API Call using your apiClient
            // Note: 'Content-Type': 'multipart/form-data' is usually handled automatically,
            // but explicitly setting it ensures boundaries are correct.
            await apiClient.post('/library/books', data, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            Alert.alert('Success', 'Book added successfully!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);

        } catch (error) {
            console.error('Add Book Error:', error);
            Alert.alert('Error', 'Failed to add book. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                
                <Text style={styles.header}>Add New Book</Text>

                {/* Image Picker Section */}
                <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                    {image ? (
                        <Image source={{ uri: image.uri }} style={styles.previewImage} />
                    ) : (
                        <View style={styles.placeholder}>
                            <Text style={styles.placeholderIcon}>📷</Text>
                            <Text style={styles.placeholderText}>Tap to add Cover Image</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Form Fields */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Book Title *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Harry Potter"
                        placeholderTextColor="#A0AEC0"
                        value={formData.title}
                        onChangeText={(text) => handleInputChange('title', text)}
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Author *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. J.K. Rowling"
                        placeholderTextColor="#A0AEC0"
                        value={formData.author}
                        onChangeText={(text) => handleInputChange('author', text)}
                    />
                </View>

                <View style={styles.row}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                        <Text style={styles.label}>ISBN</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Optional"
                            placeholderTextColor="#A0AEC0"
                            value={formData.isbn}
                            onChangeText={(text) => handleInputChange('isbn', text)}
                        />
                    </View>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Category</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Fiction"
                            placeholderTextColor="#A0AEC0"
                            value={formData.category}
                            onChangeText={(text) => handleInputChange('category', text)}
                        />
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                        <Text style={styles.label}>Total Copies *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. 10"
                            placeholderTextColor="#A0AEC0"
                            keyboardType="numeric"
                            value={formData.total_copies}
                            onChangeText={(text) => handleInputChange('total_copies', text)}
                        />
                    </View>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Rack No</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. A-12"
                            placeholderTextColor="#A0AEC0"
                            value={formData.rack_no}
                            onChangeText={(text) => handleInputChange('rack_no', text)}
                        />
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Publisher</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Publisher Name"
                        placeholderTextColor="#A0AEC0"
                        value={formData.publisher}
                        onChangeText={(text) => handleInputChange('publisher', text)}
                    />
                </View>

                <TouchableOpacity 
                    style={[styles.submitButton, loading && styles.disabledButton]} 
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.submitButtonText}>Add Book</Text>
                    )}
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
    },
    scrollContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1A202C',
        marginBottom: 20,
        textAlign: 'center',
    },
    imagePicker: {
        width: 120,
        height: 180,
        backgroundColor: '#E2E8F0',
        alignSelf: 'center',
        borderRadius: 8,
        marginBottom: 25,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#CBD5E0',
        borderStyle: 'dashed',
        overflow: 'hidden',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        alignItems: 'center',
        padding: 10,
    },
    placeholderIcon: {
        fontSize: 30,
        marginBottom: 5,
    },
    placeholderText: {
        fontSize: 12,
        color: '#718096',
        textAlign: 'center',
    },
    formGroup: {
        marginBottom: 15,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4A5568',
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: '#2D3748',
    },
    submitButton: {
        backgroundColor: '#3182CE',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: '#3182CE',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    disabledButton: {
        backgroundColor: '#A0AEC0',
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default AddBookScreen;