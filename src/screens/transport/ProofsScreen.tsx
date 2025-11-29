import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
    SafeAreaView,
    ScrollView
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import apiClient from '../../api/client'; // Your existing api client
import { useAuth } from '../../context/AuthContext'; // Your auth context
import { SERVER_URL } from '../../../apiConfig'; // Ensure this points to your server URL

// Helper to format date
const getTodayDate = () => new Date().toISOString().split('T')[0];

const ProofsScreen = () => {
    const { user } = useAuth();
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // UI State
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedFolder, setSelectedFolder] = useState<any>(null); // If null, showing list. If set, showing images.
    const [folderImages, setFolderImages] = useState([]);

    // Form State
    const [name, setName] = useState('');
    const [customId, setCustomId] = useState('');
    const [coverImage, setCoverImage] = useState<any>(null);

    // --- 1. ACCESS CONTROL ---
    if (!user || user.role !== 'admin') {
        return (
            <View style={styles.restrictedContainer}>
                <Image 
                    source={{ uri: 'https://cdn-icons-png.flaticon.com/128/9995/9995370.png' }} 
                    style={{ width: 80, height: 80, marginBottom: 20, tintColor: '#E53E3E' }} 
                />
                <Text style={styles.restrictedTitle}>Access Restricted</Text>
                <Text style={styles.restrictedText}>You are not authorized to view this page.</Text>
                <Text style={styles.restrictedText}>Only Administrators can manage Proofs.</Text>
            </View>
        );
    }

    // --- 2. DATA FETCHING ---
    useEffect(() => {
        fetchFolders();
    }, []);

    const fetchFolders = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/proofs/folders');
            setFolders(res.data);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load folders');
        } finally {
            setLoading(false);
        }
    };

    const fetchFolderImages = async (folderId: number) => {
        try {
            const res = await apiClient.get(`/proofs/folders/${folderId}/images`);
            setFolderImages(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    // --- 3. ACTIONS ---
    const handlePickImage = async (isCover = true) => {
        const result = await launchImageLibrary({
            mediaType: 'photo',
            selectionLimit: isCover ? 1 : 10,
            quality: 0.8,
        });

        if (result.assets && result.assets.length > 0) {
            if (isCover) {
                setCoverImage(result.assets[0]);
            } else {
                // Uploading multiple images to folder
                handleUploadImages(result.assets);
            }
        }
    };

    const handleCreateFolder = async () => {
        if (!name || !customId) return Alert.alert('Missing Fields', 'Please fill all details.');
        
        const formData = new FormData();
        formData.append('folder_name', name);
        formData.append('custom_id', customId);
        formData.append('created_date', getTodayDate());
        
        if (coverImage) {
            formData.append('cover_image', {
                uri: coverImage.uri,
                type: coverImage.type,
                name: coverImage.fileName || 'cover.jpg',
            });
        }

        try {
            await apiClient.post('/proofs/folders', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setModalVisible(false);
            resetForm();
            fetchFolders();
            Alert.alert('Success', 'Folder created successfully');
        } catch (error) {
            Alert.alert('Error', 'Failed to create folder');
        }
    };

    const handleUploadImages = async (assets: any[]) => {
        if (!selectedFolder) return;
        const formData = new FormData();
        formData.append('folder_id', selectedFolder.id);
        
        assets.forEach((asset) => {
            formData.append('images', {
                uri: asset.uri,
                type: asset.type,
                name: asset.fileName || 'image.jpg',
            });
        });

        try {
            setLoading(true);
            await apiClient.post('/proofs/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            await fetchFolderImages(selectedFolder.id);
            Alert.alert('Success', 'Images added!');
        } catch (error) {
            Alert.alert('Error', 'Upload failed');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFolder = async (id: number) => {
        Alert.alert('Delete', 'Are you sure? This will delete all images inside.', [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Delete', 
                style: 'destructive', 
                onPress: async () => {
                    try {
                        await apiClient.delete(`/proofs/folders/${id}`);
                        fetchFolders();
                    } catch (e) { Alert.alert('Error', 'Could not delete'); }
                }
            }
        ]);
    };

    const resetForm = () => {
        setName('');
        setCustomId('');
        setCoverImage(null);
    };

    // --- 4. RENDERERS ---
    
    // View: Inside a Folder (Grid of Images)
    if (selectedFolder) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => { setSelectedFolder(null); setFolderImages([]); }}>
                        <Text style={styles.backBtn}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{selectedFolder.folder_name}</Text>
                    <TouchableOpacity onPress={() => handlePickImage(false)}>
                        <Text style={styles.addBtn}>+ Add</Text>
                    </TouchableOpacity>
                </View>

                {loading && <ActivityIndicator size="large" color="#4A5568" />}

                <FlatList 
                    data={folderImages}
                    numColumns={3}
                    keyExtractor={(item: any) => item.id.toString()}
                    renderItem={({ item }) => (
                        <Image 
                            source={{ uri: `${SERVER_URL}/api/image/${item.image_url}` }} 
                            style={styles.gridImage} 
                        />
                    )}
                    ListEmptyComponent={<Text style={styles.emptyText}>No images yet.</Text>}
                />
            </SafeAreaView>
        );
    }

    // View: List of Folders
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Proofs Folders</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.createBtn}>
                    <Text style={{color: 'white', fontWeight: 'bold'}}>+ New Folder</Text>
                </TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator size="large" color="#4A5568" style={{marginTop: 50}} /> : (
                <FlatList 
                    data={folders}
                    keyExtractor={(item: any) => item.id.toString()}
                    contentContainerStyle={{ padding: 10 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            style={styles.folderCard} 
                            onPress={() => { setSelectedFolder(item); fetchFolderImages(item.id); }}
                            onLongPress={() => handleDeleteFolder(item.id)}
                        >
                            <Image 
                                source={item.cover_image 
                                    ? { uri: `${SERVER_URL}/api/image/${item.cover_image}` }
                                    : { uri: 'https://cdn-icons-png.flaticon.com/512/3767/3767084.png' }
                                } 
                                style={styles.folderCover} 
                            />
                            <View style={styles.folderInfo}>
                                <Text style={styles.folderName}>{item.folder_name}</Text>
                                <Text style={styles.folderMeta}>ID: {item.custom_id}</Text>
                                <Text style={styles.folderMeta}>Date: {item.created_date.split('T')[0]}</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                />
            )}

            {/* Create Folder Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>New Proof Folder</Text>
                        
                        <TextInput 
                            placeholder="Folder Name" 
                            style={styles.input} 
                            value={name} 
                            onChangeText={setName} 
                        />
                        <TextInput 
                            placeholder="Custom ID (e.g., P-101)" 
                            style={styles.input} 
                            value={customId} 
                            onChangeText={setCustomId} 
                        />
                        
                        <View style={styles.readOnlyField}>
                            <Text style={{color: '#666'}}>Auto Date: {getTodayDate()}</Text>
                        </View>

                        <TouchableOpacity onPress={() => handlePickImage(true)} style={styles.imgPicker}>
                            <Text style={{color: '#3182CE'}}>{coverImage ? 'Change Cover Image' : 'Select Cover Image'}</Text>
                        </TouchableOpacity>
                        {coverImage && <Image source={{ uri: coverImage.uri }} style={{ width: 100, height: 60, borderRadius: 5, marginTop: 5 }} />}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                                <Text>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCreateFolder} style={styles.saveBtn}>
                                <Text style={{color: 'white', fontWeight: 'bold'}}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F7FAFC' },
    
    // Restricted View
    restrictedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    restrictedTitle: { fontSize: 22, fontWeight: 'bold', color: '#E53E3E', marginBottom: 10 },
    restrictedText: { fontSize: 16, color: '#4A5568', textAlign: 'center' },

    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: 'white', elevation: 2 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#2D3748' },
    createBtn: { backgroundColor: '#3182CE', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 5 },
    backBtn: { fontSize: 16, color: '#3182CE', fontWeight: 'bold' },
    addBtn: { fontSize: 16, color: '#38A169', fontWeight: 'bold' },

    // List Styles
    folderCard: { flexDirection: 'row', backgroundColor: 'white', marginBottom: 12, borderRadius: 10, padding: 10, elevation: 2 },
    folderCover: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#EDF2F7' },
    folderInfo: { marginLeft: 15, justifyContent: 'center' },
    folderName: { fontSize: 18, fontWeight: 'bold', color: '#2D3748', marginBottom: 4 },
    folderMeta: { color: '#718096', fontSize: 14 },

    // Grid Images
    gridImage: { width: '33.33%', height: 120, margin: 1, backgroundColor: '#E2E8F0' },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#A0AEC0' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 10, padding: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 5, padding: 10, marginBottom: 15 },
    readOnlyField: { backgroundColor: '#EDF2F7', padding: 10, borderRadius: 5, marginBottom: 15 },
    imgPicker: { alignItems: 'center', padding: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: '#3182CE', borderRadius: 5 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
    cancelBtn: { padding: 10 },
    saveBtn: { backgroundColor: '#3182CE', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 5 }
});

export default ProofsScreen;