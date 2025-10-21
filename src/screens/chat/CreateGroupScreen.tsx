import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const THEME = { primary: '#007bff', background: '#f4f7fc', text: '#212529', muted: '#86909c', border: '#dee2e6', white: '#ffffff' };
const BG_COLORS = ['#e5ddd5', '#fce6e6', '#e6f2fc', '#e6fcf2', '#fcf2e6', '#f2e6fc'];

const CreateGroupScreen = () => {
    const { user } = useAuth();
    const navigation = useNavigation();
    const [groupName, setGroupName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [groupOptions, setGroupOptions] = useState<{ classes: string[], roles: string[] }>({ classes: [], roles: [] });
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedColor, setSelectedColor] = useState(BG_COLORS[0]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        const fetchOptions = async () => {
            try {
                // CORRECTED: Matched API endpoint with backend
                const response = await apiClient.get('/groups/options');
                setGroupOptions(response.data);
            } catch (error: any) {
                Alert.alert("Error", "Could not fetch group options.");
            } finally {
                setLoading(false);
            }
        };
        fetchOptions();
    }, []);

    const filteredOptions = useMemo(() => {
        let availableOptions: string[] = [];
        if (user?.role === 'admin') {
            availableOptions = ['All', ...groupOptions.roles, ...groupOptions.classes];
        } else if (user?.role === 'teacher') {
            availableOptions = [...groupOptions.classes];
        }
        if (!searchQuery) return availableOptions;
        return availableOptions.filter(option => option.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [user, groupOptions, searchQuery]);

    const handleToggleCategory = (category: string) => {
        setSelectedCategories(prev => prev.includes(category) ? prev.filter(item => item !== category) : [...prev, category]);
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) return Alert.alert("Validation Error", "Group name is required.");
        if (selectedCategories.length === 0) return Alert.alert("Validation Error", "Please select at least one category.");
        setIsCreating(true);
        try {
            await apiClient.post('/groups', {
                name: groupName.trim(),
                selectedCategories,
                backgroundColor: selectedColor,
            });
            Alert.alert("Success", "Group created successfully!");
            navigation.goBack();
        } catch (error: any) {
            Alert.alert("Creation Failed", error.response?.data?.message || "Could not create group.");
        } finally {
            setIsCreating(false);
        }
    };

    const renderCategoryItem = ({ item }: { item: string }) => {
        const isSelected = selectedCategories.includes(item);
        return (
            <TouchableOpacity style={styles.userItem} onPress={() => handleToggleCategory(item)}>
                <View style={styles.userInfo}><Text style={styles.userName}>{item}</Text></View>
                <Icon name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={24} color={isSelected ? THEME.primary : THEME.muted} />
            </TouchableOpacity>
        );
    };

    if (loading) {
        return <ActivityIndicator size="large" color={THEME.primary} style={styles.loader} />;
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.form}>
                <TextInput style={styles.input} placeholder="Group Name (e.g., Class 10 Announcements)" placeholderTextColor={THEME.muted} value={groupName} onChangeText={setGroupName} />
                <View style={styles.colorPickerContainer}>
                    <Text style={styles.colorLabel}>Chat Background Color:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {BG_COLORS.map(color => (
                            <TouchableOpacity key={color} style={[styles.colorSwatch, { backgroundColor: color, borderWidth: selectedColor === color ? 2 : 1, borderColor: selectedColor === color ? THEME.primary : THEME.border }]} onPress={() => setSelectedColor(color)}>
                                {selectedColor === color && <Icon name="check" size={20} color={THEME.primary} />}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
                <View style={styles.searchContainer}>
                    <Icon name="magnify" size={20} color={THEME.muted} style={styles.searchIcon} />
                    <TextInput style={styles.searchInput} placeholder="Search for a class or group..." placeholderTextColor={THEME.muted} value={searchQuery} onChangeText={setSearchQuery} />
                </View>
            </View>
            <FlatList
                data={filteredOptions}
                renderItem={renderCategoryItem}
                keyExtractor={(item) => item}
                ListHeaderComponent={<Text style={styles.listHeader}>Select Members ({selectedCategories.length} selected)</Text>}
                ListEmptyComponent={<Text style={styles.emptyText}>No results found.</Text>}
                contentContainerStyle={{ paddingBottom: 100 }}
            />
            <View style={styles.footer}>
                <TouchableOpacity style={[styles.createButton, isCreating && styles.disabledButton]} onPress={handleCreateGroup} disabled={isCreating}>
                    {isCreating ? <ActivityIndicator color={THEME.white} /> : <Text style={styles.createButtonText}>Create Group</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    form: { padding: 16, backgroundColor: THEME.white, borderBottomWidth: 1, borderBottomColor: THEME.border },
    input: { backgroundColor: '#f0f0f0', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 8, fontSize: 16, borderWidth: 1, borderColor: THEME.border, marginBottom: 16 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, borderWidth: 1, borderColor: THEME.border },
    searchIcon: { paddingLeft: 12 },
    searchInput: { flex: 1, height: 44, paddingHorizontal: 10, fontSize: 16 },
    colorPickerContainer: { marginBottom: 16 },
    colorLabel: { fontSize: 14, color: THEME.muted, marginBottom: 8 },
    colorSwatch: { width: 40, height: 40, borderRadius: 20, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
    listHeader: { fontSize: 18, fontWeight: '600', color: THEME.text, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10 },
    userItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, backgroundColor: THEME.white, borderBottomWidth: 1, borderBottomColor: THEME.border },
    userInfo: { flex: 1 },
    userName: { fontSize: 16, fontWeight: '500', color: THEME.text },
    emptyText: { textAlign: 'center', marginTop: 30, color: THEME.muted, fontSize: 16 },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: THEME.white, borderTopWidth: 1, borderTopColor: THEME.border },
    createButton: { backgroundColor: THEME.primary, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
    disabledButton: { backgroundColor: THEME.muted },
    createButtonText: { color: THEME.white, fontSize: 18, fontWeight: 'bold' },
});

export default CreateGroupScreen;