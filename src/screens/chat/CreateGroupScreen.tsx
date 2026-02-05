import React, { useState, useEffect, useMemo, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator, ScrollView, Dimensions } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');
const THEME = { primary: '#008080', background: '#F2F5F8', text: '#212529', muted: '#86909c', border: '#dee2e6', white: '#ffffff', cardBg: '#FFFFFF' };
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

    // FIX: Hide the default navigation header
    useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });
    }, [navigation]);

    useEffect(() => {
        const fetchOptions = async () => {
            try {
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
            {/* Header Card */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="group-add" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>New Group</Text>
                        <Text style={styles.headerSubtitle}>Create & Customize</Text>
                    </View>
                </View>
            </View>

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

    form: { padding: 16, backgroundColor: THEME.white, borderBottomWidth: 1, borderBottomColor: THEME.border, borderRadius: 12, width: '95%', alignSelf:'center', marginBottom: 10, elevation: 1 },
    input: { backgroundColor: '#f0f0f0', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 8, fontSize: 16, borderWidth: 1, borderColor: THEME.border, marginBottom: 16, color: THEME.text },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, borderWidth: 1, borderColor: THEME.border },
    searchIcon: { paddingLeft: 12 },
    searchInput: { flex: 1, height: 44, paddingHorizontal: 10, fontSize: 16, color: THEME.text },
    colorPickerContainer: { marginBottom: 16 },
    colorLabel: { fontSize: 14, color: THEME.muted, marginBottom: 8 },
    colorSwatch: { width: 40, height: 40, borderRadius: 20, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
    listHeader: { fontSize: 16, fontWeight: '600', color: THEME.text, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
    userItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, backgroundColor: THEME.white, borderBottomWidth: 1, borderBottomColor: THEME.border },
    userInfo: { flex: 1 },
    userName: { fontSize: 16, fontWeight: '500', color: THEME.text },
    emptyText: { textAlign: 'center', marginTop: 30, color: THEME.muted, fontSize: 16 },
    footer: { position: 'absolute', bottom: 20, left: 20, right: 20 },
    createButton: { backgroundColor: THEME.primary, paddingVertical: 14, borderRadius: 30, alignItems: 'center', elevation: 5 },
    disabledButton: { backgroundColor: THEME.muted },
    createButtonText: { color: THEME.white, fontSize: 18, fontWeight: 'bold' },
});

export default CreateGroupScreen;