import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const THEME = { primary: '#007bff', background: '#f4f7fc', text: '#212529', muted: '#86909c', border: '#dee2e6', white: '#ffffff' };

const CreateGroupScreen = () => {
    const { user } = useAuth();
    const navigation = useNavigation();
    const [groupName, setGroupName] = useState('');
    const [allUsers, setAllUsers] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await apiClient.get('/users');
                setAllUsers(response.data.filter((u: any) => u.id !== user!.id));
            } catch (error: any) {
                Alert.alert("Error", "Could not fetch user list.");
            } finally {
                setLoading(false);
            }
        };
        if (user) {
            fetchUsers();
        }
    }, [user]);

    const handleToggleUser = (userId: number) => {
        setSelectedUsers(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            return Alert.alert("Validation Error", "Group name is required.");
        }
        if (selectedUsers.length === 0) {
            return Alert.alert("Validation Error", "Please select at least one member to add.");
        }

        setIsCreating(true);
        try {
            await apiClient.post('/groups', {
                name: groupName.trim(),
                memberIds: selectedUsers,
            });
            Alert.alert("Success", "Group created successfully!");
            navigation.goBack();
        } catch (error: any) {
            Alert.alert("Creation Failed", error.response?.data?.message || "Could not create the group.");
        } finally {
            setIsCreating(false);
        }
    };

    const renderUserItem = ({ item }: { item: any }) => {
        const isSelected = selectedUsers.includes(item.id);
        return (
            <TouchableOpacity style={styles.userItem} onPress={() => handleToggleUser(item.id)}>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.full_name}</Text>
                    <Text style={styles.userRole}>{item.role}</Text>
                </View>
                <Icon name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={24} color={isSelected ? THEME.primary : THEME.muted} />
            </TouchableOpacity>
        );
    };

    if (loading) {
        return <ActivityIndicator size="large" color={THEME.primary} style={{ flex: 1 }} />;
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.form}>
                <TextInput
                    style={styles.input}
                    placeholder="Group Name"
                    placeholderTextColor={THEME.muted}
                    value={groupName}
                    onChangeText={setGroupName}
                />
                <Text style={styles.listHeader}>Select Members ({selectedUsers.length} selected)</Text>
            </View>
            <FlatList
                data={allUsers}
                renderItem={renderUserItem}
                keyExtractor={(item) => item.id.toString()}
                style={{ flex: 1 }}
            />
            <TouchableOpacity style={[styles.createButton, isCreating && styles.disabledButton]} onPress={handleCreateGroup} disabled={isCreating}>
                {isCreating ? <ActivityIndicator color={THEME.white} /> : <Text style={styles.createButtonText}>Create Group</Text>}
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    form: { padding: 20, backgroundColor: THEME.white, borderBottomWidth: 1, borderBottomColor: THEME.border },
    input: { backgroundColor: '#f0f0f0', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 8, fontSize: 16, borderWidth: 1, borderColor: THEME.border },
    listHeader: { fontSize: 18, fontWeight: '600', marginTop: 20, marginBottom: 10, color: THEME.text },
    userItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, backgroundColor: THEME.white, borderBottomWidth: 1, borderBottomColor: THEME.border },
    userInfo: { flex: 1 },
    userName: { fontSize: 16, fontWeight: '500', color: THEME.text },
    userRole: { fontSize: 12, color: THEME.muted, textTransform: 'capitalize', marginTop: 2 },
    createButton: { backgroundColor: THEME.primary, padding: 15, margin: 20, borderRadius: 8, alignItems: 'center' },
    disabledButton: { backgroundColor: THEME.muted },
    createButtonText: { color: THEME.white, fontSize: 18, fontWeight: 'bold' },
});

export default CreateGroupScreen;