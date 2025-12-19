import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    ScrollView
} from 'react-native';
// ✅ UPDATED: Using the package that works for you
import { pick, types, isCancel } from '@react-native-documents/picker';
import apiClient from '../../api/client';
import { useNavigation } from '@react-navigation/native';

const AddDigitalResourceScreen = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        subject: '',
        class_group: ''
    });

    // ✅ UPDATED: Select File Function using @react-native-documents/picker
    const selectFile = async () => {
        try {
            const result = await pick({
                allowMultiSelection: false, // We only want one file
                type: [types.pdf, types.images], // Allow PDFs and Images
            });

            // The new library returns an array, so we take the first item
            if (result && result.length > 0) {
                setFile(result[0]);
            }
        } catch (err) {
            // ✅ UPDATED: Error handling using isCancel from the new package
            if (isCancel(err)) {
                console.log('User cancelled upload');
            } else {
                console.error("File selection error:", err);
                Alert.alert("Error", "Could not select file.");
            }
        }
    };

    const handleUpload = async () => {
        if (!formData.title || !formData.subject || !file) {
            Alert.alert("Missing Fields", "Please provide a title, subject, and select a file.");
            return;
        }

        setLoading(true);
        try {
            const data = new FormData();
            data.append('title', formData.title);
            data.append('subject', formData.subject);
            data.append('class_group', formData.class_group);
            
            // ✅ UPDATED: Append file logic
            // Note: Ensure your backend handles 'file' or 'files' field name correctly.
            // Based on previous code, we use 'file'.
            data.append('file', {
                uri: file.uri,
                type: file.type || 'application/pdf', // Fallback type
                name: file.name || `upload_${Date.now()}.pdf`, // Fallback name
            });

            // Post to your existing backend route
            await apiClient.post('/library/digital', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            Alert.alert("Success", "Resource uploaded successfully!", [
                { text: "OK", onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error("Upload Error:", error);
            Alert.alert("Error", "Failed to upload file. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.header}>Upload Resource</Text>

            <View style={styles.formGroup}>
                <Text style={styles.label}>Title *</Text>
                <TextInput 
                    style={styles.input} 
                    placeholder="e.g. Science Chapter 1 Notes" 
                    value={formData.title}
                    onChangeText={t => setFormData({...formData, title: t})}
                />
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>Subject *</Text>
                <TextInput 
                    style={styles.input} 
                    placeholder="e.g. Physics" 
                    value={formData.subject}
                    onChangeText={t => setFormData({...formData, subject: t})}
                />
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>Class (Optional)</Text>
                <TextInput 
                    style={styles.input} 
                    placeholder="e.g. Class 10 A" 
                    value={formData.class_group}
                    onChangeText={t => setFormData({...formData, class_group: t})}
                />
            </View>

            {/* File Picker Area */}
            <TouchableOpacity style={styles.fileButton} onPress={selectFile}>
                <Text style={styles.fileButtonText}>
                    {file ? `📄 ${file.name}` : "📎 Select PDF / Image"}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={[styles.uploadButton, loading && styles.disabled]} 
                onPress={handleUpload}
                disabled={loading}
            >
                {loading ? <ActivityIndicator color="#FFF"/> : <Text style={styles.btnText}>Upload Now</Text>}
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 20, backgroundColor: '#F8FAFC' },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#1E293B', textAlign: 'center' },
    formGroup: { marginBottom: 15 },
    label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 5 },
    input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, fontSize: 16 },
    fileButton: { backgroundColor: '#E2E8F0', padding: 15, borderRadius: 8, alignItems: 'center', marginVertical: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: '#94A3B8' },
    fileButtonText: { color: '#475569', fontWeight: '600' },
    uploadButton: { backgroundColor: '#2563EB', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    disabled: { backgroundColor: '#94A3B8' },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});

export default AddDigitalResourceScreen;