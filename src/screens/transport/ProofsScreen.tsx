import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    Modal,
    Alert,
    ActivityIndicator,
    SafeAreaView,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { SERVER_URL } from '../../../apiConfig';

// Icons
const BACK_ICON = 'https://cdn-icons-png.flaticon.com/128/271/271220.png';
const FOLDER_ICON = 'https://cdn-icons-png.flaticon.com/128/3767/3767084.png';
const DENIED_ICON = 'https://cdn-icons-png.flaticon.com/128/3967/3967261.png';

const ProofsScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    
    // Data State
    const [folders, setFolders] = useState([]);
    const [staffCandidates, setStaffCandidates] = useState([]); // Staff who need folders
    const [folderImages, setFolderImages] = useState([]);
    
    // UI State
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedFolder, setSelectedFolder] = useState<any>(null); // If set, we are inside a folder
    const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);

    // --- 1. ACCESS CONTROL ---
    if (!user || user.role !== 'admin') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Image source={{ uri: BACK_ICON }} style={styles.backIcon} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Staff Proofs</Text>
                    <View style={{width: 30}} />
                </View>
                <View style={styles.restrictedContainer}>
                    <Image source={{ uri: DENIED_ICON }} style={styles.deniedIcon} />
                    <Text style={styles.restrictedTitle}>Access Restricted</Text>
                    <Text style={styles.restrictedText}>Only Administrators can manage Proofs.</Text>
                    <TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.goBackText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // --- 2. DATA FETCHING ---
    useEffect(() => {
        fetchFolders();
    }, []);

    const fetchFolders = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/transport/proofs/folders');
            setFolders(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCandidates = async () => {
        try {
            const res = await apiClient.get('/transport/proofs/candidates');
            setStaffCandidates(res.data);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Could not load staff list');
        }
    };

    const fetchFolderImages = async (folderId: number) => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/transport/proofs/folders/${folderId}/images`);
            setFolderImages(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // --- 3. ACTIONS ---

    const openCreateModal = () => {
        fetchCandidates(); // Get list of drivers/conductors
        setModalVisible(true);
    };

    const handleCreateFolder = async () => {
        if (!selectedStaffId) {
            Alert.alert("Select Staff", "Please select a staff member first.");
            return;
        }

        try {
            await apiClient.post('/transport/proofs/folders', { staff_id: selectedStaffId });
            setModalVisible(false);
            setSelectedStaffId(null);
            fetchFolders();
            Alert.alert('Success', 'Folder created successfully');
        } catch (error) {
            Alert.alert('Error', 'Failed to create folder');
        }
    };

    const handleDeleteFolder = async (id: number) => {
        Alert.alert('Delete Folder', 'Are you sure? This will delete all proofs inside.', [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Delete', 
                style: 'destructive', 
                onPress: async () => {
                    try {
                        await apiClient.delete(`/transport/proofs/folders/${id}`);
                        fetchFolders();
                    } catch (e) { Alert.alert('Error', 'Could not delete'); }
                }
            }
        ]);
    };

    const handleDeleteImage = async (imgId: number) => {
        Alert.alert('Delete Image', 'Remove this proof?', [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Remove', 
                style: 'destructive', 
                onPress: async () => {
                    try {
                        await apiClient.delete(`/transport/proofs/images/${imgId}`);
                        if (selectedFolder) fetchFolderImages(selectedFolder.id);
                    } catch (e) { Alert.alert('Error', 'Could not delete image'); }
                }
            }
        ]);
    };

    const handleUploadImages = async () => {
        if (!selectedFolder) return;

        const result = await launchImageLibrary({
            mediaType: 'photo',
            selectionLimit: 10,
            quality: 0.8,
        });

        if (result.assets && result.assets.length > 0) {
            const formData = new FormData();
            formData.append('folder_id', selectedFolder.id);
            
            result.assets.forEach((asset) => {
                formData.append('images', {
                    uri: asset.uri,
                    type: asset.type,
                    name: asset.fileName || 'proof.jpg',
                });
            });

            try {
                setLoading(true);
                await apiClient.post('/transport/proofs/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                await fetchFolderImages(selectedFolder.id);
                Alert.alert('Success', 'Proofs uploaded!');
            } catch (error) {
                Alert.alert('Error', 'Upload failed');
            } finally {
                setLoading(false);
            }
        }
    };

    const getImageUrl = (url: string) => {
        if (!url) return FOLDER_ICON;
        return url.startsWith('http') ? url : `${SERVER_URL}${url}`;
    };

    // --- 4. RENDERERS ---

    // VIEW: INSIDE FOLDER
    if (selectedFolder) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => { setSelectedFolder(null); setFolderImages([]); }}>
                         <Text style={{fontSize: 20, color: '#2D3748', fontWeight:'bold'}}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{selectedFolder.full_name}'s Proofs</Text>
                    <TouchableOpacity onPress={handleUploadImages}>
                        <Text style={styles.addBtn}>+ Add Pics</Text>
                    </TouchableOpacity>
                </View>

                {loading ? <ActivityIndicator size="large" color="#4A5568" style={{marginTop: 50}} /> : (
                    <FlatList 
                        data={folderImages}
                        numColumns={3}
                        keyExtractor={(item: any) => item.id.toString()}
                        contentContainerStyle={{padding: 5}}
                        renderItem={({ item }) => (
                            <TouchableOpacity onLongPress={() => handleDeleteImage(item.id)} style={styles.gridItem}>
                                <Image 
                                    source={{ uri: getImageUrl(item.file_url) }} 
                                    style={styles.gridImage} 
                                />
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={styles.emptyText}>No proofs uploaded yet.</Text>}
                    />
                )}
            </SafeAreaView>
        );
    }

    // VIEW: FOLDER LIST
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Image source={{ uri: BACK_ICON }} style={styles.backIcon} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Staff Proofs</Text>
                <TouchableOpacity onPress={openCreateModal} style={styles.createBtn}>
                    <Text style={{color: 'white', fontWeight: 'bold'}}>+ New Folder</Text>
                </TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator size="large" color="#4A5568" style={{marginTop: 50}} /> : (
                <FlatList 
                    data={folders}
                    keyExtractor={(item: any) => item.id.toString()}
                    contentContainerStyle={{ padding: 15 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            style={styles.folderCard} 
                            onPress={() => { setSelectedFolder(item); fetchFolderImages(item.id); }}
                            onLongPress={() => handleDeleteFolder(item.id)}
                        >
                            <Image 
                                source={{ uri: getImageUrl(item.profile_image_url) }} 
                                style={styles.folderCover} 
                            />
                            <View style={styles.folderInfo}>
                                <Text style={styles.folderName}>{item.full_name}</Text>
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{item.staff_type}</Text>
                                </View>
                                <Text style={styles.folderMeta}>Created: {item.created_at.split('T')[0]}</Text>
                            </View>
                            <Image source={{uri: 'https://cdn-icons-png.flaticon.com/128/2985/2985150.png'}} style={{width: 20, height: 20, tintColor: '#CBD5E0'}} />
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={<Text style={styles.emptyText}>No folders created yet.</Text>}
                />
            )}

            {/* Create Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Create Proof Folder</Text>
                        <Text style={{marginBottom: 10, color:'#718096'}}>Select a staff member:</Text>
                        
                        {staffCandidates.length === 0 ? (
                            <Text style={{color: 'red', marginBottom: 20, textAlign:'center'}}>
                                No staff available (or all already have folders).
                            </Text>
                        ) : (
                            <FlatList 
                                data={staffCandidates}
                                style={{maxHeight: 200, marginBottom: 20}}
                                keyExtractor={(item: any) => item.id.toString()}
                                renderItem={({item}) => (
                                    <TouchableOpacity 
                                        style={[styles.candidateItem, selectedStaffId === item.id && styles.candidateSelected]}
                                        onPress={() => setSelectedStaffId(item.id)}
                                    >
                                        <Image source={{ uri: getImageUrl(item.profile_image_url) }} style={styles.miniAvatar} />
                                        <Text style={[styles.candidateText, selectedStaffId === item.id && {color: '#3182CE', fontWeight:'bold'}]}>
                                            {item.full_name} ({item.staff_type})
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            />
                        )}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                                <Text style={{color: '#E53E3E'}}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={handleCreateFolder} 
                                style={[styles.saveBtn, !selectedStaffId && {backgroundColor: '#CBD5E0'}]}
                                disabled={!selectedStaffId}
                            >
                                <Text style={{color: 'white', fontWeight: 'bold'}}>Create Folder</Text>
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

    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#E2E8F0' },
    backButton: { padding: 5 },
    backIcon: { width: 24, height: 24, tintColor: '#2D3748' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#2D3748' },
    createBtn: { backgroundColor: '#3182CE', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
    addBtn: { fontSize: 16, color: '#38A169', fontWeight: 'bold' },

    // Restricted
    restrictedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    deniedIcon: { width: 80, height: 80, marginBottom: 20, tintColor: '#E53E3E' },
    restrictedTitle: { fontSize: 22, fontWeight: 'bold', color: '#2D3748', marginBottom: 10 },
    restrictedText: { fontSize: 16, color: '#718096', textAlign: 'center', marginBottom: 30 },
    goBackBtn: { backgroundColor: '#3182CE', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25 },
    goBackText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

    // Folder List
    folderCard: { flexDirection: 'row', backgroundColor: 'white', marginBottom: 12, borderRadius: 12, padding: 12, elevation: 2, alignItems:'center' },
    folderCover: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EDF2F7', marginRight: 15 },
    folderInfo: { flex: 1 },
    folderName: { fontSize: 16, fontWeight: 'bold', color: '#2D3748' },
    folderMeta: { color: '#A0AEC0', fontSize: 12, marginTop: 4 },
    badge: { backgroundColor: '#EBF8FF', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
    badgeText: { fontSize: 10, color: '#3182CE', fontWeight: 'bold' },

    // Grid
    gridItem: { width: '33.33%', height: 120, padding: 2 },
    gridImage: { width: '100%', height: '100%', borderRadius: 4, backgroundColor: '#E2E8F0' },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#A0AEC0', fontSize: 16 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 12, padding: 20, maxHeight: '80%' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    
    candidateItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: '#EDF2F7' },
    candidateSelected: { backgroundColor: '#EBF8FF' },
    miniAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 10, backgroundColor: '#EDF2F7' },
    candidateText: { fontSize: 14, color: '#4A5568' },

    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
    cancelBtn: { padding: 12, flex: 1, alignItems: 'center' },
    saveBtn: { backgroundColor: '#3182CE', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, flex: 1, alignItems: 'center', marginLeft: 10 }
});

export default ProofsScreen;