import React, { useState, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { getProfileImageSource } from '../../utils/imageHelpers';
import ImageViewing from 'react-native-image-viewing';

const THEME = { primary: '#008080', background: '#F2F5F8', text: '#212529', border: '#dee2e6', white: '#ffffff', danger: '#dc3545', muted: '#6c757d', cardBg: '#FFFFFF' };

const GroupSettingsScreen = () => {
    const { user } = useAuth();
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const [group, setGroup] = useState(route.params.group);
    const [groupName, setGroupName] = useState(group.name);
    const [isSaving, setIsSaving] = useState(false);
    
    const [isViewerVisible, setViewerVisible] = useState(false);
    const isCreator = user?.id === group.created_by;

    // FIX: Hide Default Header
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

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

    const imageSourceForDisplay = getProfileImageSource(group.group_dp_url);
    const imagesForViewer = group.group_dp_url ? [{ uri: imageSourceForDisplay.uri }] : [imageSourceForDisplay];

    return (
        <SafeAreaView style={styles.container}>
            <ImageViewing images={imagesForViewer} imageIndex={0} visible={isViewerVisible} onRequestClose={() => setViewerVisible(false)} />

            {/* Header Card */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="settings" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Settings</Text>
                        <Text style={styles.headerSubtitle}>Group Info</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.dpContainer}>
                    <TouchableOpacity onPress={() => setViewerVisible(true)}>
                        <Image source={imageSourceForDisplay} style={styles.dpImage} />
                    </TouchableOpacity>
                    {isCreator && (
                        <TouchableOpacity style={styles.dpEditButton} onPress={handlePickImage}>
                            <Icon name="camera" size={20} color={THEME.white} />
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
    container: { flex: 1, backgroundColor: THEME.background },
    
    // Header Card
    headerCard: {
        backgroundColor: THEME.cardBg,
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '95%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        backgroundColor: '#E0F2F1', // Teal bg
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: THEME.text },
    headerSubtitle: { fontSize: 13, color: THEME.muted },

    scrollContainer: { padding: 20, alignItems: 'center' },
    dpContainer: { marginBottom: 30, position: 'relative' },
    dpImage: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#ccc', borderWidth: 4, borderColor: '#fff' },
    dpEditButton: { 
        position: 'absolute', 
        bottom: 5, 
        right: 5, 
        backgroundColor: THEME.primary, 
        padding: 10, 
        borderRadius: 20, 
        elevation: 5,
    },
    fieldContainer: { width: '100%', marginBottom: 20, backgroundColor: '#fff', padding: 20, borderRadius: 12, elevation: 1 },
    label: { fontSize: 14, color: THEME.muted, marginBottom: 8, fontWeight: '600' },
    input: { backgroundColor: '#f9f9f9', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 8, fontSize: 16, borderWidth: 1, borderColor: THEME.border, width: '100%', color: THEME.text },
    disabledInput: { backgroundColor: '#f0f0f0', color: THEME.muted },
    saveButton: { backgroundColor: THEME.primary, paddingVertical: 14, borderRadius: 30, alignItems: 'center', width: '100%', elevation: 3 },
    deleteButton: { backgroundColor: THEME.danger, paddingVertical: 14, borderRadius: 30, alignItems: 'center', width: '100%', elevation: 3 },
    disabledButton: { backgroundColor: THEME.muted },
    buttonText: { color: THEME.white, fontSize: 16, fontWeight: 'bold' },
});

export default GroupSettingsScreen;