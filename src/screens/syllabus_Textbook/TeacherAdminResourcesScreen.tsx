import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import {
    View, Text, FlatList, StyleSheet, ActivityIndicator,
    TouchableOpacity, Alert, Modal, TextInput, ScrollView,
    RefreshControl, Image, Linking, SafeAreaView, useColorScheme,
    KeyboardAvoidingView, Platform, StatusBar, useWindowDimensions
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import * as Animatable from 'react-native-animatable';

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#cbd5e1',
    inputBg: '#F8FAFC',
    inputBorder: '#E2E8F0',
    iconBg: '#E0F2F1',
    textPlaceholder: '#94A3B8',
    imagePickerBg: '#E2E8F0',
    white: '#ffffff',
    danger: '#E53935',
    cancelBtnBg: '#E2E8F0',
    cancelBtnText: '#334155',
    menuBg: 'rgba(255, 255, 255, 0.9)',
    imagePlaceholderBg: '#EEEEEE'
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
    imagePickerBg: '#252525',
    white: '#ffffff',
    danger: '#EF5350',
    cancelBtnBg: '#333333',
    cancelBtnText: '#E0E0E0',
    menuBg: 'rgba(30, 30, 30, 0.9)',
    imagePlaceholderBg: '#252525'
};

const TeacherAdminResourcesScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    const navigation = useNavigation();

    // Hide default header to use our custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    // View States
    const [boardView, setBoardView] = useState('state');
    const[selectedClassFilter, setSelectedClassFilter] = useState('All'); 

    // Data States
    const[textbooks, setTextbooks] = useState([]);
    const [allClasses, setAllClasses] = useState([]);

    // UI States
    const [isLoading, setIsLoading] = useState(true);
    const[isModalVisible, setIsModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    // Form States
    const[modalBoardType, setModalBoardType] = useState('state');
    const [selectedClass, setSelectedClass] = useState('');
    const [subjectName, setSubjectName] = useState('');
    const[url, setUrl] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);

    // Custom Dropdown State
    const [dropdownConfig, setDropdownConfig] = useState({
        visible: false,
        title: '',
        data:[],
        selectedValue: '',
        onSelect: () => {}
    });

    const openDropdown = (title, data, selectedValue, onSelect) => {
        setDropdownConfig({ visible: true, title, data, selectedValue, onSelect });
    };

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const[textbookRes, classesRes] = await Promise.all([
                apiClient.get('/resources?type=textbook'),
                apiClient.get('/all-classes')
            ]);
            setTextbooks(textbookRes.data);
            setAllClasses(classesRes.data);
        } catch (e) { 
            Alert.alert("Error", "Failed to fetch data."); 
        } finally { 
            setIsLoading(false); 
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCardPress = async (item) => {
        if (!item.url) return Alert.alert("Not Available", "No link provided.");
        if (item.url.toLowerCase().endsWith('.pdf')) {
            navigation.navigate('PDFViewer', { url: item.url, title: item.subject_name });
        } else {
            const canOpen = await Linking.canOpenURL(item.url);
            if (canOpen) await Linking.openURL(item.url);
            else Alert.alert("Error", `Could not open link.`);
        }
    };

    const handleChoosePhoto = () => { 
        launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, (response) => { 
            if (response.didCancel || response.errorCode) return; 
            setSelectedImage(response); 
        }); 
    };

    const openCreateModal = () => { 
        setEditingItem(null); 
        setSelectedClass(''); 
        setSubjectName(''); 
        setUrl(''); 
        setSelectedImage(null); 
        setModalBoardType(boardView); 
        setIsModalVisible(true); 
    };

    const openEditModal = (item) => { 
        setEditingItem(item); 
        setModalBoardType(item.syllabus_type); 
        setSelectedClass(item.class_group); 
        setUrl(item.url || ''); 
        setSubjectName(item.subject_name || ''); 
        setSelectedImage(null); 
        setIsModalVisible(true); 
    };

    const handleMenuPress = (item) => {
        Alert.alert(
            "Manage Textbook",
            `${item.subject_name} (${item.class_group})`,[
                { text: "Cancel", style: "cancel" },
                { text: "Edit", onPress: () => openEditModal(item) },
                { text: "Delete", style: "destructive", onPress: () => handleDelete(item) }
            ]
        );
    };

    const handleDelete = (item) => { 
        Alert.alert(`Confirm Delete`, `Delete textbook for ${item.subject_name}?`,[
            { text: "Cancel", style: 'cancel' }, 
            { text: "Delete", style: 'destructive', onPress: async () => { 
                try { 
                    await apiClient.delete(`/resources/${item.id}`); 
                    fetchData(); 
                } catch(e) { Alert.alert("Error", `Could not delete.`); }
            }},
        ]);
    };

    const handleSave = async () => { 
        if (!selectedClass || !url || !modalBoardType || !subjectName) {
            return Alert.alert("Validation Error", "Required fields missing."); 
        }
        setIsSaving(true); 
        const data = new FormData(); 
        data.append('class_group', selectedClass); 
        data.append('url', url); 
        data.append('syllabus_type', modalBoardType); 
        data.append('subject_name', subjectName); 
        data.append('resource_type', 'textbook'); 
        if (selectedImage?.assets?.[0]) { 
            data.append('coverImage', { 
                uri: selectedImage.assets[0].uri, 
                type: selectedImage.assets[0].type, 
                name: selectedImage.assets[0].fileName, 
            }); 
        } 
        try { 
            const config = { headers: { 'Content-Type': 'multipart/form-data' } }; 
            if (editingItem) await apiClient.put(`/resources/${editingItem.id}`, data, config); 
            else await apiClient.post('/resources', data, config); 
            setIsModalVisible(false); 
            fetchData(); 
        } catch (e) { 
            Alert.alert("Error", "Save failed."); 
        } finally { setIsSaving(false); }
    };

    const displayableClasses = allClasses.filter(c => c.startsWith('Class') || c === 'LKG' || c === 'UKG');

    const renderList = () => {
        const filteredData = textbooks
            .filter((item) => item.syllabus_type === boardView)
            .filter((item) => selectedClassFilter === 'All' ? true : item.class_group === selectedClassFilter);

        return (
            <FlatList
                data={filteredData}
                keyExtractor={(item) => item.id.toString()}
                numColumns={2} 
                contentContainerStyle={styles.gridContainer}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchData} colors={[theme.primary]} tintColor={theme.primary} />}
                ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSub }]}>No textbooks found.</Text>}
                renderItem={({ item, index }) => {
                    const imageUri = item.cover_image_url ? `${SERVER_URL}${item.cover_image_url}` : `https://via.placeholder.com/300x400/DCDCDC/808080?text=${item.subject_name.replace(' ', '+')}`;
                    return (
                        <Animatable.View animation="fadeInUp" duration={500} delay={index * 50} style={styles.gridItemWrapper}>
                            <TouchableOpacity 
                                style={[styles.gridItem, { backgroundColor: theme.cardBg, shadowColor: theme.border }]} 
                                onPress={() => handleCardPress(item)} 
                                activeOpacity={0.9}
                            >
                                <Image source={{ uri: imageUri }} style={[styles.coverImage, { backgroundColor: theme.imagePlaceholderBg }]} resizeMode="cover" />
                                
                                <View style={styles.menuOverlay}>
                                    <TouchableOpacity 
                                        style={[styles.menuIconCircle, { backgroundColor: theme.menuBg }]} 
                                        onPress={() => handleMenuPress(item)}
                                    >
                                        <MaterialIcons name="more-vert" size={20} color={theme.textMain} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.infoContainer}>
                                    <Text style={[styles.gridTitle, { color: theme.textMain }]} numberOfLines={1}>{item.subject_name}</Text>
                                    <Text style={[styles.gridSubtitle, { color: theme.textSub }]}>{item.class_group}</Text>
                                </View>
                            </TouchableOpacity>
                        </Animatable.View>
                    );
                }}
            />
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialCommunityIcons name="bookshelf" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Library</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Manage Resources</Text>
                    </View>
                </View>
                <TouchableOpacity style={[styles.headerBtn, { backgroundColor: theme.primary }]} onPress={openCreateModal}>
                    <MaterialIcons name="add" size={18} color={theme.white} />
                    <Text style={[styles.headerBtnText, { color: theme.white }]}>Add</Text>
                </TouchableOpacity>
            </View>

            {/* --- FILTER SECTION --- */}
            <View style={styles.filterSection}>
                <View style={styles.pickerWrapper}>
                    <Text style={[styles.pickerLabel, { color: theme.textSub }]}>Board:</Text>
                    <TouchableOpacity 
                        style={[styles.customDropdownTrigger, { backgroundColor: theme.inputBg, borderColor: theme.border, height: 45 }]}
                        onPress={() => openDropdown('Select Board',[
                            {label: 'State Board', value: 'state'}, 
                            {label: 'Central Board', value: 'central'}
                        ], boardView, setBoardView)}
                    >
                        <Text style={{ color: theme.textMain, fontSize: 14 }}>
                            {boardView === 'state' ? 'State Board' : 'Central Board'}
                        </Text>
                        <MaterialIcons name="arrow-drop-down" size={20} color={theme.textSub} />
                    </TouchableOpacity>
                </View>
                <View style={styles.pickerWrapper}>
                    <Text style={[styles.pickerLabel, { color: theme.textSub }]}>Class:</Text>
                    <TouchableOpacity 
                        style={[styles.customDropdownTrigger, { backgroundColor: theme.inputBg, borderColor: theme.border, height: 45 }]}
                        onPress={() => openDropdown('Select Class',[
                            {label: 'All', value: 'All'},
                            ...displayableClasses.map(c => ({label: c, value: c}))
                        ], selectedClassFilter, setSelectedClassFilter)}
                    >
                        <Text style={{ color: theme.textMain, fontSize: 14 }} numberOfLines={1}>
                            {selectedClassFilter}
                        </Text>
                        <MaterialIcons name="arrow-drop-down" size={20} color={theme.textSub} />
                    </TouchableOpacity>
                </View>
            </View>

            {isLoading ? <ActivityIndicator size="large" color={theme.primary} style={{marginTop: 50}} /> : renderList()}

            {/* --- ADD/EDIT MODAL --- */}
            <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackground}>
                    <View style={[styles.modalContent, { backgroundColor: theme.cardBg, maxHeight: screenHeight * 0.85 }]}>
                        
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.textMain }]}>{editingItem ? 'Edit' : 'Add'} Textbook</Text>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                <MaterialIcons name="close" size={24} color={theme.textMain} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                            <Text style={[styles.label, { color: theme.textSub }]}>Board Type *</Text>
                            <TouchableOpacity 
                                style={[styles.customDropdownTrigger, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
                                onPress={() => openDropdown('Board Type',[
                                    {label: 'State Board', value: 'state'}, 
                                    {label: 'Central Board', value: 'central'}
                                ], modalBoardType, setModalBoardType)}
                            >
                                <Text style={{ color: theme.textMain, fontSize: 15 }}>
                                    {modalBoardType === 'state' ? 'State Board' : 'Central Board'}
                                </Text>
                                <MaterialIcons name="arrow-drop-down" size={24} color={theme.textSub} />
                            </TouchableOpacity>

                            <Text style={[styles.label, { color: theme.textSub }]}>Class *</Text>
                            <TouchableOpacity 
                                style={[styles.customDropdownTrigger, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, opacity: editingItem ? 0.6 : 1 }]}
                                disabled={!!editingItem}
                                onPress={() => openDropdown('Select Class',[
                                    {label: '-- Select Class --', value: ''},
                                    ...displayableClasses.map(c => ({label: c, value: c}))
                                ], selectedClass, setSelectedClass)}
                            >
                                <Text style={{ color: selectedClass ? theme.textMain : theme.textPlaceholder, fontSize: 15 }}>
                                    {selectedClass || '-- Select Class --'}
                                </Text>
                                <MaterialIcons name="arrow-drop-down" size={24} color={theme.textSub} />
                            </TouchableOpacity>

                            <Text style={[styles.label, { color: theme.textSub }]}>Subject Name *</Text>
                            <TextInput 
                                style={[styles.input, { borderColor: theme.inputBorder, backgroundColor: theme.inputBg, color: theme.textMain }]} 
                                value={subjectName} 
                                onChangeText={setSubjectName} 
                                placeholder="e.g. Mathematics" 
                                placeholderTextColor={theme.textPlaceholder} 
                            />

                            <Text style={[styles.label, { color: theme.textSub }]}>Link / URL *</Text>
                            <TextInput 
                                style={[styles.input, { borderColor: theme.inputBorder, backgroundColor: theme.inputBg, color: theme.textMain }]} 
                                value={url} 
                                onChangeText={setUrl} 
                                placeholder="https://..." 
                                keyboardType="url" 
                                placeholderTextColor={theme.textPlaceholder} 
                            />

                            <TouchableOpacity style={[styles.imagePicker, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]} onPress={handleChoosePhoto}>
                                <MaterialIcons name="image" size={24} color={theme.textSub} />
                                <Text style={[styles.imagePickerText, { color: theme.textMain }]}>
                                    {editingItem?.cover_image_url || selectedImage ? 'Change Image' : 'Select Cover Image'}
                                </Text>
                            </TouchableOpacity>

                            {(selectedImage?.assets?.[0]?.uri || editingItem?.cover_image_url) && (
                                <Image 
                                    style={styles.previewImage} 
                                    source={{ uri: selectedImage?.assets?.[0]?.uri || `${SERVER_URL}${editingItem.cover_image_url}` }} 
                                    resizeMode="contain"
                                />
                            )}

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.cancelBtnBg }]} onPress={() => setIsModalVisible(false)}>
                                    <Text style={[styles.cancelBtnText, { color: theme.cancelBtnText }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.primary }]} onPress={handleSave} disabled={isSaving}>
                                    {isSaving ? <ActivityIndicator color={theme.white} /> : <Text style={[styles.saveBtnText, { color: theme.white }]}>Save</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* --- SHARED DROPDOWN OVERLAY --- */}
            <Modal visible={dropdownConfig.visible} transparent animationType="fade" onRequestClose={() => setDropdownConfig({ ...dropdownConfig, visible: false })}>
                <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setDropdownConfig({ ...dropdownConfig, visible: false })}>
                    <View style={[styles.dropdownModal, { backgroundColor: theme.cardBg, width: screenWidth * 0.85, maxHeight: screenHeight * 0.6 }]}>
                        <Text style={[styles.dropdownTitle, { color: theme.primary }]}>{dropdownConfig.title}</Text>
                        <FlatList
                            data={dropdownConfig.data}
                            keyExtractor={(item, index) => item.value + index.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    style={[styles.dropdownItem, { borderBottomColor: theme.border }]} 
                                    onPress={() => {
                                        dropdownConfig.onSelect(item.value);
                                        setDropdownConfig({ ...dropdownConfig, visible: false });
                                    }}
                                >
                                    <Text style={[
                                        styles.dropdownItemText, 
                                        { color: theme.textMain, fontWeight: dropdownConfig.selectedValue === item.value ? 'bold' : 'normal' }
                                    ]}>{item.label}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    // --- HEADER CARD STYLES ---
    headerCard: {
        paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10,
        borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        elevation: 3, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13, marginTop: 2 },
    headerBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 10 },
    headerBtnText: { fontSize: 13, fontWeight: '600' },

    // --- FILTERS ---
    filterSection: { flexDirection: 'row', paddingHorizontal: 15, gap: 10, marginBottom: 15 },
    pickerWrapper: { flex: 1 },
    pickerLabel: { fontSize: 12, fontWeight: 'bold', marginBottom: 5, marginLeft: 2 },

    // --- GRID LIST ---
    gridContainer: { paddingHorizontal: 10, paddingBottom: 30 },
    gridItemWrapper: { width: '50%', padding: 6 },
    gridItem: { 
        borderRadius: 12, elevation: 3, shadowOpacity: 0.15, shadowRadius: 3, 
        shadowOffset: { width: 0, height: 1 }, overflow: 'hidden', height: 240, flexDirection: 'column'
    },
    coverImage: { width: '100%', height: 170 },

    // 3 Dots Menu
    menuOverlay: { position: 'absolute', top: 8, right: 8 },
    menuIconCircle: { 
        width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', 
        elevation: 2, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }
    },

    infoContainer: { padding: 8, alignItems: 'center', flex: 1, justifyContent: 'center' },
    gridTitle: { fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
    gridSubtitle: { fontSize: 12, marginTop: 2, textAlign: 'center' },
    emptyText: { textAlign: 'center', fontSize: 16, marginTop: 80 },

    // --- MODAL ---
    modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', borderRadius: 16, padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 12 },
    input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },

    // Custom Dropdown UI
    customDropdownTrigger: { borderWidth: 1, borderRadius: 8, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },

    imagePicker: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 8, marginTop: 15, justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed' },
    imagePickerText: { marginLeft: 10, fontSize: 15, fontWeight: '500' },
    previewImage: { width: 100, height: 130, borderRadius: 8, alignSelf: 'center', marginTop: 15 },

    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginHorizontal: 6 },
    saveBtnText: { fontWeight: 'bold', fontSize: 16 },
    cancelBtnText: { fontWeight: 'bold', fontSize: 16 },

    // Dropdown Modal Styles
    dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    dropdownModal: { borderRadius: 12, padding: 20, elevation: 5 },
    dropdownTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    dropdownItem: { paddingVertical: 15, borderBottomWidth: 0.5 },
    dropdownItemText: { fontSize: 16, textAlign: 'center' }
});

export default TeacherAdminResourcesScreen;