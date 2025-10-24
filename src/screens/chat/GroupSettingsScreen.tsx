import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { getProfileImageSource } from '../../utils/imageHelpers';
import ImageViewing from 'react-native-image-viewing'; // Import the image viewer

const THEME = { primary: '#007bff', background: '#f4f7fc', text: '#212529', border: '#dee2e6', white: '#ffffff', danger: '#dc3545', muted: '#6c757d' };

const GroupSettingsScreen = () => {
    const { user } = useAuth();
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const [group, setGroup] = useState(route.params.group);
    const [groupName, setGroupName] = useState(group.name);
    const [isSaving, setIsSaving] = useState(false);
    
    // State to control the image viewer modal
    const [isViewerVisible, setViewerVisible] = useState(false);

    const isCreator = user?.id === group.created_by;

    const handlePickImage = () => {
        if (!isCreator) return;
        launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, async (response) => {
            if (response.didCancel || !response.assets) return;
            setIsSaving(true);
            const image = response.assets[0];
            const formData = new FormData();
            formData.append('group_dp', { uri: image.uri, type: image.type, name: image.fileName });
            try {
                const res = await apiClient.post(`/groups/${group.id}/dp`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                setGroup({ ...group, group_dp_url: res.data.group_dp_url });
                Alert.alert("Success", "Group DP updated.");
            } catch (error: any) {
                Alert.alert("Upload Failed", error.response?.data?.message || 'An error occurred.');
            } finally {
                setIsSaving(false);
            }
        });
    };

    const handleSaveChanges = async () => {
        if (!groupName.trim()) return Alert.alert("Error", "Group name cannot be empty.");
        setIsSaving(true);
        try {
            await apiClient.put(`/groups/${group.id}`, { name: groupName, backgroundColor: group.background_color });
            Alert.alert("Success", "Group details updated.");
            navigation.goBack();
        } catch (error: any) {
            Alert.alert("Save Failed", error.response?.data?.message || 'An error occurred.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteGroup = () => {
        Alert.alert("Delete Group", "Are you sure you want to permanently delete this group? This action cannot be undone.",
            [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    await apiClient.delete(`/groups/${group.id}`);
                    Alert.alert("Success", "Group has been deleted.");
                    navigation.navigate('GroupList');
                } catch (error: any) {
                    Alert.alert("Deletion Failed", error.response?.data?.message || 'An error occurred.');
                }
            }}]
        );
    };

    // [THE FIX] This logic now correctly handles both network URLs and local default images.
    const imageSourceForDisplay = getProfileImageSource(group.group_dp_url);

    const imagesForViewer = group.group_dp_url
        ? [{ uri: imageSourceForDisplay.uri }] // If there's a URL, use the object format with uri
        : [imageSourceForDisplay];             // If not, pass the direct require() reference (a number)

    return (
        <SafeAreaView style={styles.container}>
            {/* The ImageViewing component now receives the correctly formatted data */}
            <ImageViewing
                images={imagesForViewer}
                imageIndex={0}
                visible={isViewerVisible}
                onRequestClose={() => setViewerVisible(false)}
            />

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.dpContainer}>
                    {/* TouchableOpacity to enlarge the image */}
                    <TouchableOpacity onPress={() => setViewerVisible(true)}>
                        <Image source={imageSourceForDisplay} style={styles.dpImage} />
                    </TouchableOpacity>

                    {/* TouchableOpacity for the edit button (camera icon) */}
                    {isCreator && (
                        <TouchableOpacity style={styles.dpEditButton} onPress={handlePickImage}>
                            <Icon name="camera" size={24} color={THEME.white} />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.fieldContainer}>
                    <Text style={styles.label}>Group Name</Text>
                    <TextInput style={[styles.input, !isCreator && styles.disabledInput]} value={groupName} onChangeText={setGroupName} editable={isCreator} />
                </View>
                
                {isCreator && (
                    <>
                        <TouchableOpacity style={[styles.saveButton, isSaving && styles.disabledButton]} onPress={handleSaveChanges} disabled={isSaving}>
                            {isSaving ? <ActivityIndicator color={THEME.white} /> : <Text style={styles.buttonText}>Save Changes</Text>}
                        </TouchableOpacity>
                        <View style={{height: 15}} />
                        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteGroup}>
                            <Text style={styles.buttonText}>Delete Group</Text>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.white },
    scrollContainer: { padding: 20, alignItems: 'center' },
    dpContainer: { marginBottom: 30, position: 'relative' },
    dpImage: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#ccc' },
    dpEditButton: { 
        position: 'absolute', 
        bottom: 5, 
        right: 5, 
        backgroundColor: THEME.primary, 
        padding: 10, 
        borderRadius: 20, 
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },
    fieldContainer: { width: '100%', marginBottom: 20 },
    label: { fontSize: 16, color: THEME.text, marginBottom: 8, fontWeight: '500' },
    input: { backgroundColor: THEME.white, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 8, fontSize: 16, borderWidth: 1, borderColor: THEME.border, width: '100%' },
    disabledInput: { backgroundColor: THEME.background, color: THEME.muted },
    saveButton: { backgroundColor: THEME.primary, paddingVertical: 14, borderRadius: 8, alignItems: 'center', width: '100%' },
    deleteButton: { backgroundColor: THEME.danger, paddingVertical: 14, borderRadius: 8, alignItems: 'center', width: '100%' },
    disabledButton: { backgroundColor: THEME.muted },
    buttonText: { color: THEME.white, fontSize: 16, fontWeight: 'bold' },
});

export default GroupSettingsScreen;