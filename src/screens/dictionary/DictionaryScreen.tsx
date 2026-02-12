/**
 * File: src/screens/dictionary/DictionaryScreen.tsx
 * Purpose: English-Telugu Dictionary with Search and Admin Management.
 * Updated: Back Button Removed, Responsive Design, Dark/Light Mode.
 */
import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
    View, Text, TextInput, FlatList, StyleSheet, ActivityIndicator,
    TouchableOpacity, Keyboard, Modal, Alert, ScrollView, SafeAreaView, 
    StatusBar, Dimensions, useColorScheme, KeyboardAvoidingView, Platform
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';

const { width } = Dimensions.get('window');
const ALPHABETS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#cbd5e1',
    inputBg: '#FFFFFF',
    inputBorder: '#CFD8DC',
    iconBg: '#E0F2F1',
    textPlaceholder: '#90A4AE',
    white: '#ffffff',
    engBadgeBg: '#E3F2FD',
    engBadgeText: '#1565C0',
    telBadgeBg: '#E8F5E9',
    telBadgeText: '#2E7D32',
    alphabetBg: '#FFFFFF',
    letterBg: '#F0F0F0',
    letterText: '#555',
    divider: '#EEEEEE',
    cancelBtnBg: '#E0E0E0',
    cancelBtnText: '#333333',
    modalOverlay: 'rgba(0,0,0,0.5)'
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
    white: '#ffffff',
    engBadgeBg: '#153140',
    engBadgeText: '#64B5F6',
    telBadgeBg: '#1B3320',
    telBadgeText: '#81C784',
    alphabetBg: '#1E1E1E',
    letterBg: '#2C2C2C',
    letterText: '#B0B0B0',
    divider: '#333333',
    cancelBtnBg: '#333333',
    cancelBtnText: '#E0E0E0',
    modalOverlay: 'rgba(0,0,0,0.7)'
};

interface DictionaryItem {
    id: number;
    word: string;
    part_of_speech: string;
    definition_en: string;
    definition_te: string;
}

const DictionaryScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const navigation = useNavigation();
    const { user } = useAuth();
    const userRole = user?.role || 'student';
    const canManage = userRole === 'admin' || userRole === 'teacher';

    // Hide default header to use our custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    // Search & Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [activeLetter, setActiveLetter] = useState('A'); 
    const [results, setResults] = useState<DictionaryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

    // Add/Edit Word Modal States
    const [isModalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    
    // Form States
    const [newWord, setNewWord] = useState('');
    const [newPOS, setNewPOS] = useState('');
    const [newDefEn, setNewDefEn] = useState('');
    const [newDefTe, setNewDefTe] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // --- INITIAL LOAD ---
    useEffect(() => {
        fetchDefinitions(activeLetter);
    }, []);

    // --- API CALLS ---
    const fetchDefinitions = async (query: string) => {
        if (!query.trim()) return;
        setLoading(true);
        try {
            const response = await apiClient.get(`/dictionary/search?query=${query}`);
            setResults(response.data);
        } catch (error) {
            console.error("Search Error:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- HANDLERS ---
    const handleSearch = (text: string) => {
        setSearchQuery(text);
        if (text.length === 0) {
            fetchDefinitions(activeLetter);
            return;
        }
        if (typingTimeout) clearTimeout(typingTimeout);
        setLoading(true);
        const newTimeout = setTimeout(() => fetchDefinitions(text), 500);
        setTypingTimeout(newTimeout);
    };

    const handleLetterPress = (letter: string) => {
        setActiveLetter(letter);
        setSearchQuery('');
        Keyboard.dismiss();
        fetchDefinitions(letter);
    };

    // Open Modal for Adding
    const openAddModal = () => {
        setEditingId(null);
        setNewWord('');
        setNewPOS('');
        setNewDefEn('');
        setNewDefTe('');
        setModalVisible(true);
    };

    // Open Modal for Editing
    const openEditModal = (item: DictionaryItem) => {
        setEditingId(item.id);
        setNewWord(item.word);
        setNewPOS(item.part_of_speech);
        setNewDefEn(item.definition_en);
        setNewDefTe(item.definition_te);
        setModalVisible(true);
    };

    // Handle Submit (Add or Edit)
    const handleSubmitWord = async () => {
        if (!newWord || !newPOS || !newDefEn || !newDefTe) {
            Alert.alert("Error", "All fields are required.");
            return;
        }
        setSubmitting(true);
        try {
            if (editingId) {
                // EDIT MODE
                await apiClient.put(`/dictionary/edit/${editingId}`, {
                    word: newWord,
                    part_of_speech: newPOS,
                    definition_en: newDefEn,
                    definition_te: newDefTe
                });
                Alert.alert("Success", "Word updated successfully!");
            } else {
                // ADD MODE
                await apiClient.post('/dictionary/add', {
                    word: newWord,
                    part_of_speech: newPOS,
                    definition_en: newDefEn,
                    definition_te: newDefTe
                });
                Alert.alert("Success", "Word added successfully!");
            }
            
            setModalVisible(false);
            // Refresh list
            const queryToRefresh = searchQuery || activeLetter;
            fetchDefinitions(queryToRefresh);

        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Operation failed.");
        } finally {
            setSubmitting(false);
        }
    };

    // Handle Delete
    const handleDeleteWord = (id: number, word: string) => {
        Alert.alert(
            "Delete Word",
            `Are you sure you want to delete "${word}"?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiClient.delete(`/dictionary/delete/${id}`);
                            setResults(prev => prev.filter(item => item.id !== id));
                        } catch (error) {
                            Alert.alert("Error", "Failed to delete word.");
                        }
                    }
                }
            ]
        );
    };

    // --- MENU HANDLER ---
    const handleMenuPress = (item: DictionaryItem) => {
        Alert.alert(
            "Manage Dictionary",
            `Options for "${item.word}"`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Edit Word", onPress: () => openEditModal(item) },
                { text: "Delete", onPress: () => handleDeleteWord(item.id, item.word), style: 'destructive' }
            ]
        );
    };

    // --- RENDER ITEM ---
    const renderItem = ({ item, index }: { item: DictionaryItem, index: number }) => (
        <Animatable.View animation="fadeInUp" duration={500} delay={index * 50}>
            <View style={[styles.card, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.cardHeader}>
                    <View style={{flexDirection: 'row', alignItems: 'baseline', flex: 1}}>
                        <Text style={[styles.word, { color: theme.textMain }]}>{item.word}</Text>
                        <Text style={[styles.pos, { color: theme.textSub }]}>({item.part_of_speech})</Text>
                    </View>
                    
                    {/* THREE DOTS MENU - Only for Admins/Teachers */}
                    {canManage && (
                        <TouchableOpacity 
                            style={styles.menuButton} 
                            onPress={() => handleMenuPress(item)}
                            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                        >
                            <MaterialIcons name="more-vert" size={24} color={theme.textSub} />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                
                <View style={styles.meaningRow}>
                    <View style={[styles.langBadge, { backgroundColor: theme.engBadgeBg }]}>
                        <Text style={[styles.langText, { color: theme.engBadgeText }]}>ENG</Text>
                    </View>
                    <Text style={[styles.definitionText, { color: theme.textMain }]}>{item.definition_en}</Text>
                </View>
                
                <View style={styles.meaningRow}>
                    <View style={[styles.langBadge, { backgroundColor: theme.telBadgeBg }]}>
                        <Text style={[styles.langText, { color: theme.telBadgeText }]}>TEL</Text>
                    </View>
                    <Text style={[styles.definitionText, styles.teluguText, { color: theme.telBadgeText }]}>{item.definition_te}</Text>
                </View>
            </View>
        </Animatable.View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    {/* Back Button Removed */}
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialIcons name="menu-book" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Dictionary</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>English & Telugu Definitions</Text>
                    </View>
                </View>
                
                {canManage && (
                    <TouchableOpacity style={[styles.headerBtn, { backgroundColor: theme.primary }]} onPress={openAddModal}>
                        <MaterialIcons name="add" size={18} color={theme.white} />
                        <Text style={[styles.headerBtnText, { color: theme.white }]}>Add</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* --- SEARCH BAR --- */}
            <View style={[styles.searchContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                <MaterialIcons name="search" size={22} color={theme.textSub} style={styles.searchIcon} />
                <TextInput
                    style={[styles.searchInput, { color: theme.textMain }]}
                    placeholder="Search a word..."
                    placeholderTextColor={theme.textPlaceholder}
                    value={searchQuery}
                    onChangeText={handleSearch}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => { setSearchQuery(''); Keyboard.dismiss(); fetchDefinitions(activeLetter); }}>
                        <MaterialIcons name="close" size={20} color={theme.textSub} />
                    </TouchableOpacity>
                )}
            </View>

            {/* --- ALPHABET SELECTOR --- */}
            <View style={[styles.alphabetContainer, { backgroundColor: theme.alphabetBg }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 10}}>
                    {ALPHABETS.map((letter) => {
                        const isActive = activeLetter === letter && searchQuery === '';
                        return (
                            <TouchableOpacity 
                                key={letter} 
                                style={[
                                    styles.letterButton, 
                                    { backgroundColor: theme.letterBg },
                                    isActive && { backgroundColor: theme.primary }
                                ]}
                                onPress={() => handleLetterPress(letter)}
                            >
                                <Text style={[
                                    styles.letterText, 
                                    { color: theme.letterText },
                                    isActive && { color: theme.white }
                                ]}>{letter}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* --- RESULTS LIST --- */}
            <View style={styles.contentContainer}>
                {loading ? (
                    <View style={styles.centerView}>
                        <ActivityIndicator size="large" color={theme.primary} />
                        <Text style={[styles.loadingText, { color: theme.textSub }]}>Loading Dictionary...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={results}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.centerView}>
                                <MaterialIcons name="auto-stories" size={60} color={theme.border} />
                                <Text style={[styles.emptyText, { color: theme.textSub }]}>
                                    No words found for "{searchQuery || activeLetter}"
                                </Text>
                            </View>
                        }
                    />
                )}
            </View>

            {/* --- ADD/EDIT WORD MODAL --- */}
            <Modal visible={isModalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
                    <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.textMain }]}>
                                {editingId ? "Edit Word" : "Add New Word"}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <MaterialIcons name="close" size={24} color={theme.textSub} />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView contentContainerStyle={{paddingBottom: 20}}>
                            <Text style={[styles.label, { color: theme.textSub }]}>Word</Text>
                            <TextInput 
                                style={[styles.modalInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                                placeholder="e.g. Village" 
                                placeholderTextColor={theme.textPlaceholder}
                                value={newWord} 
                                onChangeText={setNewWord} 
                            />
                            
                            <Text style={[styles.label, { color: theme.textSub }]}>Part of Speech</Text>
                            <TextInput 
                                style={[styles.modalInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                                placeholder="e.g. Noun, Verb" 
                                placeholderTextColor={theme.textPlaceholder}
                                value={newPOS} 
                                onChangeText={setNewPOS} 
                            />

                            <Text style={[styles.label, { color: theme.textSub }]}>English Definition</Text>
                            <TextInput 
                                style={[styles.modalInput, styles.textArea, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                                placeholder="Meaning in English" 
                                placeholderTextColor={theme.textPlaceholder}
                                value={newDefEn} 
                                onChangeText={setNewDefEn} 
                                multiline 
                            />

                            <Text style={[styles.label, { color: theme.textSub }]}>Telugu Definition</Text>
                            <TextInput 
                                style={[styles.modalInput, styles.textArea, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }]} 
                                placeholder="Meaning in Telugu (గ్రామం)" 
                                placeholderTextColor={theme.textPlaceholder}
                                value={newDefTe} 
                                onChangeText={setNewDefTe} 
                                multiline 
                            />

                            <TouchableOpacity 
                                style={[
                                    styles.submitButton, 
                                    { backgroundColor: theme.primary },
                                    submitting && { backgroundColor: theme.inputBorder }
                                ]} 
                                onPress={handleSubmitWord} 
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator color={theme.white} />
                                ) : (
                                    <Text style={[styles.submitButtonText, { color: theme.white }]}>
                                        {editingId ? "UPDATE WORD" : "SAVE WORD"}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    
    // --- HEADER CARD STYLES ---
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
        justifyContent: 'space-between',
        elevation: 3,
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    // Back Button style removed
    headerIconContainer: {
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13, marginTop: 2 },
    headerBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 10,
    },
    headerBtnText: { fontSize: 12, fontWeight: '600' },

    // --- SEARCH BAR ---
    searchContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        borderRadius: 10, 
        marginHorizontal: 15, 
        marginBottom: 10, 
        paddingHorizontal: 10, 
        height: 50, 
        borderWidth: 1, 
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 16 },

    // --- ALPHABET BAR ---
    alphabetContainer: { paddingVertical: 10, marginBottom: 5, elevation: 1 },
    letterButton: { 
        width: 36, 
        height: 36, 
        borderRadius: 18, 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginHorizontal: 4, 
    },
    letterText: { fontSize: 14, fontWeight: '600' },

    contentContainer: { flex: 1 },
    listContent: { paddingHorizontal: 15, paddingBottom: 20, paddingTop: 5 },
    
    // Card
    card: { 
        borderRadius: 12, 
        padding: 16, 
        marginBottom: 12, 
        elevation: 2, 
        shadowOpacity: 0.05, 
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 }
    },
    cardHeader: { 
        flexDirection: 'row', 
        alignItems: 'flex-start', 
        justifyContent: 'space-between', 
        marginBottom: 8 
    },
    word: { 
        fontSize: 20, 
        fontWeight: 'bold', 
        textTransform: 'capitalize',
        flexShrink: 1 
    },
    pos: { 
        fontSize: 14, 
        marginLeft: 8, 
        fontStyle: 'italic', 
        top: 2
    },
    menuButton: {
        padding: 4,
        marginRight: -8 
    },
    divider: { height: 1, marginBottom: 10 },
    
    meaningRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-start' },
    langBadge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, marginRight: 10, marginTop: 2 },
    langText: { fontSize: 10, fontWeight: 'bold' },
    definitionText: { fontSize: 15, flex: 1, lineHeight: 22 },
    teluguText: { fontSize: 16 },

    centerView: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
    emptyText: { marginTop: 10, fontSize: 16 },
    loadingText: { marginTop: 10 },

    // Modal
    modalOverlay: { flex: 1, justifyContent: 'center', padding: 20 },
    modalContent: { borderRadius: 15, padding: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 5, marginTop: 10 },
    modalInput: { 
        borderWidth: 1, 
        borderRadius: 8, 
        padding: 10, 
    },
    textArea: { height: 80, textAlignVertical: 'top' },
    submitButton: { padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 25 },
    submitButtonText: { fontWeight: 'bold', fontSize: 16 }
});

export default DictionaryScreen;