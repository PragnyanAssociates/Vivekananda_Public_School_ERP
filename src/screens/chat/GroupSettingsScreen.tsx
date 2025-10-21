import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { getProfileImageSource } from '../../utils/imageHelpers';

const THEME = { primary: '#007bff', background: '#f4f7fc', text: '#212529', border: '#dee2e6', white: '#ffffff', danger: '#dc3545', muted: '#6c757d' };

const GroupSettingsScreen = () => {
    const { user } = useAuth();
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const [group, setGroup] = useState(route.params.group);
    const [groupName, setGroupName] = useState(group.name);
    const [isSaving, setIsSaving] = useState(false);

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

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <TouchableOpacity onPress={handlePickImage} disabled={!isCreator}>
                    <View style={styles.dpContainer}>
                        <Image source={getProfileImageSource(group.group_dp_url)} style={styles.dpImage} />
                        {isCreator && (
                            <View style={styles.dpEditButton}>
                                <Icon name="camera" size={24} color={THEME.white} />
                            </View>
                        )}
                    </View>
                </TouchableOpacity>

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
    dpEditButton: { position: 'absolute', bottom: 5, right: 5, backgroundColor: THEME.primary, padding: 10, borderRadius: 20, elevation: 5 },
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