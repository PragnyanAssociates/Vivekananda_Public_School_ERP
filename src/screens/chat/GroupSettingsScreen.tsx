/**
 * File: src/screens/chat/GroupSettingsScreen.js
 * Purpose: Manage Group DP, Name, and Deletion.
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI.
 */
import React, { useState, useLayoutEffect } from 'react';
import { 
    View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, 
    Alert, ActivityIndicator, Image, ScrollView, useColorScheme, StatusBar 
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { getProfileImageSource } from '../../utils/imageHelpers';
import ImageViewing from 'react-native-image-viewing';

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#cbd5e1',
    inputBg: '#f9f9f9',
    inputBgDisabled: '#f0f0f0',
    inputBorder: '#cbd5e1',
    iconBg: '#E0F2F1',
    danger: '#dc3545',
    white: '#ffffff',
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    inputBgDisabled: '#252525',
    inputBorder: '#555555',
    iconBg: '#333333',
    danger: '#ef5350',
    white: '#ffffff',
};

const GroupSettingsScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const { user } = useAuth();
    const route = useRoute();
    const navigation = useNavigation();
    
    const [group, setGroup] = useState(route.params.group);
    const [groupName, setGroupName] = useState(group.name);
    const [isSaving, setIsSaving] = useState(false);
    
    const [isViewerVisible, setViewerVisible] = useState(false);
    const isCreator = user?.id === group.created_by;

    // Hide Default Header
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
            } catch (error) {
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
        } catch (error) {
            Alert.alert("Save Failed", error.response?.data?.message || 'An error occurred.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteGroup = () => {
        Alert.alert(
            "Delete Group", 
            "Are you sure you want to permanently delete this group? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" }, 
                { 
                    text: "Delete", 
                    style: "destructive", 
                    onPress: async () => {
                        try {
                            await apiClient.delete(`/groups/${group.id}`);
                            Alert.alert("Success", "Group has been deleted.");
                            navigation.navigate('GroupList');
                        } catch (error) {
                            Alert.alert("Deletion Failed", error.response?.data?.message || 'An error occurred.');
                        }
                    }
                }
            ]
        );
    };

    const imageSourceForDisplay = getProfileImageSource(group.group_dp_url);
    const imagesForViewer = group.group_dp_url ? [{ uri: imageSourceForDisplay.uri }] : [imageSourceForDisplay];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            
            <ImageViewing 
                images={imagesForViewer} 
                imageIndex={0} 
                visible={isViewerVisible} 
                onRequestClose={() => setViewerVisible(false)} 
            />

            {/* Header Card */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={theme.textMain} />
                    </TouchableOpacity>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialIcons name="settings" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Settings</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Group Info</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {/* DP Section */}
                <View style={styles.dpContainer}>
                    <TouchableOpacity onPress={() => setViewerVisible(true)}>
                        <Image 
                            source={imageSourceForDisplay} 
                            style={[styles.dpImage, { borderColor: theme.cardBg, backgroundColor: theme.border }]} 
                        />
                    </TouchableOpacity>
                    {isCreator && (
                        <TouchableOpacity style={[styles.dpEditButton, { backgroundColor: theme.primary }]} onPress={handlePickImage}>
                            <Icon name="camera" size={20} color={theme.white} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Form Section */}
                <View style={[styles.fieldContainer, { backgroundColor: theme.cardBg }]}>
                    <Text style={[styles.label, { color: theme.textSub }]}>Group Name</Text>
                    <TextInput 
                        style={[
                            styles.input, 
                            { 
                                color: theme.textMain, 
                                borderColor: theme.inputBorder,
                                backgroundColor: isCreator ? theme.inputBg : theme.inputBgDisabled 
                            }
                        ]} 
                        value={groupName} 
                        onChangeText={setGroupName} 
                        editable={isCreator} 
                    />
                </View>
                
                {/* Action Buttons */}
                {isCreator && (
                    <>
                        <TouchableOpacity 
                            style={[styles.saveButton, { backgroundColor: theme.primary }, isSaving && { opacity: 0.7 }]} 
                            onPress={handleSaveChanges} 
                            disabled={isSaving}
                        >
                            {isSaving ? <ActivityIndicator color={theme.white} /> : <Text style={styles.buttonText}>Save Changes</Text>}
                        </TouchableOpacity>
                        
                        <View style={{height: 15}} />
                        
                        <TouchableOpacity 
                            style={[styles.deleteButton, { backgroundColor: theme.danger }]} 
                            onPress={handleDeleteGroup}
                        >
                            <Text style={styles.buttonText}>Delete Group</Text>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    
    // Header Card
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
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },

    scrollContainer: { padding: 20, alignItems: 'center' },
    
    // DP Area
    dpContainer: { marginBottom: 30, position: 'relative' },
    dpImage: { 
        width: 140, 
        height: 140, 
        borderRadius: 70, 
        borderWidth: 4 
    },
    dpEditButton: { 
        position: 'absolute', 
        bottom: 5, 
        right: 5, 
        padding: 10, 
        borderRadius: 20, 
        elevation: 5,
    },
    
    // Input Fields
    fieldContainer: { 
        width: '100%', 
        marginBottom: 20, 
        padding: 20, 
        borderRadius: 12, 
        elevation: 1 
    },
    label: { 
        fontSize: 14, 
        marginBottom: 8, 
        fontWeight: '600' 
    },
    input: { 
        paddingHorizontal: 15, 
        paddingVertical: 12, 
        borderRadius: 8, 
        fontSize: 16, 
        borderWidth: 1, 
        width: '100%', 
    },
    
    // Buttons
    saveButton: { 
        paddingVertical: 14, 
        borderRadius: 30, 
        alignItems: 'center', 
        width: '100%', 
        elevation: 3 
    },
    deleteButton: { 
        paddingVertical: 14, 
        borderRadius: 30, 
        alignItems: 'center', 
        width: '100%', 
        elevation: 3 
    },
    buttonText: { 
        color: '#ffffff', 
        fontSize: 16, 
        fontWeight: 'bold' 
    },
});

export default GroupSettingsScreen;