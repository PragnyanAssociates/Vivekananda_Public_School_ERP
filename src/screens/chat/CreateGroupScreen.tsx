/**
 * File: src/screens/chat/CreateGroupScreen.js
 * Purpose: Create a new chat group with category selection.
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI.
 */
import React, { useState, useEffect, useMemo, useLayoutEffect } from 'react';
import { 
    View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, 
    FlatList, Alert, ActivityIndicator, ScrollView, Dimensions, 
    useColorScheme, StatusBar, KeyboardAvoidingView, Platform 
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#cbd5e1',
    inputBg: '#f0f2f5',
    inputBorder: '#cbd5e1',
    iconBg: '#E0F2F1',
    textPlaceholder: '#94a3b8',
    white: '#ffffff'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    inputBorder: '#555555',
    iconBg: '#333333',
    textPlaceholder: '#64748b',
    white: '#E0E0E0'
};

const BG_COLORS = ['#e5ddd5', '#fce6e6', '#e6f2fc', '#e6fcf2', '#fcf2e6', '#f2e6fc'];

const CreateGroupScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const { user } = useAuth();
    const navigation = useNavigation();
    
    const [groupName, setGroupName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [groupOptions, setGroupOptions] = useState({ classes: [], roles: [] });
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedColor, setSelectedColor] = useState(BG_COLORS[0]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Hide default header
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
            } catch (error) {
                Alert.alert("Error", "Could not fetch group options.");
            } finally {
                setLoading(false);
            }
        };
        fetchOptions();
    }, []);

    const filteredOptions = useMemo(() => {
        let availableOptions = [];
        if (user?.role === 'admin') {
            availableOptions = ['All', ...groupOptions.roles, ...groupOptions.classes];
        } else if (user?.role === 'teacher') {
            availableOptions = [...groupOptions.classes];
        }
        if (!searchQuery) return availableOptions;
        return availableOptions.filter(option => option.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [user, groupOptions, searchQuery]);

    const handleToggleCategory = (category) => {
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
        } catch (error) {
            Alert.alert("Creation Failed", error.response?.data?.message || "Could not create group.");
        } finally {
            setIsCreating(false);
        }
    };

    const renderCategoryItem = ({ item }) => {
        const isSelected = selectedCategories.includes(item);
        return (
            <TouchableOpacity 
                style={[styles.userItem, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]} 
                onPress={() => handleToggleCategory(item)}
            >
                <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: theme.textMain }]}>{item}</Text>
                </View>
                <Icon 
                    name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} 
                    size={24} 
                    color={isSelected ? theme.primary : theme.textSub} 
                />
            </TouchableOpacity>
        );
    };

    if (loading) {
        return <View style={[styles.loaderContainer, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            
            <KeyboardAvoidingView 
                style={{ flex: 1 }} 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header Card */}
                <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={24} color={theme.textMain} />
                        </TouchableOpacity>
                        <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                            <MaterialIcons name="group-add" size={24} color={theme.primary} />
                        </View>
                        <View style={styles.headerTextContainer}>
                            <Text style={[styles.headerTitle, { color: theme.textMain }]}>New Group</Text>
                            <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Create & Customize</Text>
                        </View>
                    </View>
                </View>

                <View style={[styles.form, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                    <TextInput 
                        style={[styles.input, { backgroundColor: theme.inputBg, color: theme.textMain, borderColor: theme.inputBorder }]} 
                        placeholder="Group Name (e.g., Class 10 Announcements)" 
                        placeholderTextColor={theme.textPlaceholder} 
                        value={groupName} 
                        onChangeText={setGroupName} 
                    />
                    
                    <View style={styles.colorPickerContainer}>
                        <Text style={[styles.colorLabel, { color: theme.textSub }]}>Chat Background Color:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {BG_COLORS.map(color => (
                                <TouchableOpacity 
                                    key={color} 
                                    style={[
                                        styles.colorSwatch, 
                                        { backgroundColor: color, borderWidth: selectedColor === color ? 2 : 1, borderColor: selectedColor === color ? theme.primary : theme.border }
                                    ]} 
                                    onPress={() => setSelectedColor(color)}
                                >
                                    {selectedColor === color && <Icon name="check" size={20} color={theme.primary} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={[styles.searchContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                        <Icon name="magnify" size={20} color={theme.textPlaceholder} style={styles.searchIcon} />
                        <TextInput 
                            style={[styles.searchInput, { color: theme.textMain }]} 
                            placeholder="Search for a class or group..." 
                            placeholderTextColor={theme.textPlaceholder} 
                            value={searchQuery} 
                            onChangeText={setSearchQuery} 
                        />
                    </View>
                </View>

                <FlatList
                    data={filteredOptions}
                    renderItem={renderCategoryItem}
                    keyExtractor={(item) => item}
                    ListHeaderComponent={
                        <Text style={[styles.listHeader, { color: theme.textMain }]}>
                            Select Members ({selectedCategories.length} selected)
                        </Text>
                    }
                    ListEmptyComponent={
                        <Text style={[styles.emptyText, { color: theme.textSub }]}>No results found.</Text>
                    }
                    contentContainerStyle={{ paddingBottom: 100 }}
                />

                <View style={styles.footer}>
                    <TouchableOpacity 
                        style={[styles.createButton, { backgroundColor: theme.primary }, isCreating && styles.disabledButton]} 
                        onPress={handleCreateGroup} 
                        disabled={isCreating}
                    >
                        {isCreating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createButtonText}>Create Group</Text>}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
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

    // Form
    form: { 
        padding: 16, 
        borderBottomWidth: 1, 
        borderRadius: 12, 
        width: '96%', 
        alignSelf: 'center', 
        marginBottom: 10, 
        elevation: 1 
    },
    input: { 
        paddingHorizontal: 15, 
        paddingVertical: 12, 
        borderRadius: 8, 
        fontSize: 16, 
        borderWidth: 1, 
        marginBottom: 16 
    },
    searchContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        borderRadius: 8, 
        borderWidth: 1 
    },
    searchIcon: { paddingLeft: 12 },
    searchInput: { 
        flex: 1, 
        height: 44, 
        paddingHorizontal: 10, 
        fontSize: 16 
    },
    
    // Color Picker
    colorPickerContainer: { marginBottom: 16 },
    colorLabel: { fontSize: 14, marginBottom: 8 },
    colorSwatch: { 
        width: 40, 
        height: 40, 
        borderRadius: 20, 
        marginRight: 10, 
        justifyContent: 'center', 
        alignItems: 'center' 
    },

    // List
    listHeader: { 
        fontSize: 16, 
        fontWeight: '600', 
        paddingHorizontal: 20, 
        paddingTop: 10, 
        paddingBottom: 10 
    },
    userItem: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingVertical: 14, 
        paddingHorizontal: 20, 
        borderBottomWidth: 1 
    },
    userInfo: { flex: 1 },
    userName: { fontSize: 16, fontWeight: '500' },
    emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16 },

    // Footer
    footer: { position: 'absolute', bottom: 20, left: 20, right: 20 },
    createButton: { 
        paddingVertical: 14, 
        borderRadius: 30, 
        alignItems: 'center', 
        elevation: 5 
    },
    disabledButton: { opacity: 0.7 },
    createButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});

export default CreateGroupScreen;