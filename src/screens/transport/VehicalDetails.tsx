import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    SafeAreaView,
    Modal,
    TextInput,
    Alert,
    ScrollView,
    ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useAuth } from '../../context/AuthContext';

// Interfaces
interface Vehicle {
    id: number;
    bus_number: string;
    bus_name: string;
    bus_photos: string | string[]; // Can come as string (JSON) or array
}

const VehicalDetails = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const userRole = user?.role;

    // Data State
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [busNumber, setBusNumber] = useState('');
    const [busName, setBusName] = useState('');
    
    // We store selected images as objects { uri, type, name } for uploading
    const [selectedImages, setSelectedImages] = useState<any[]>([]); 

    useEffect(() => {
        if (userRole === 'admin') {
            fetchVehicles();
        }
    }, [userRole]);

    // --- API CALLS ---

    const fetchVehicles = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/transport/vehicles');
            // Parse JSON photos if necessary
            const parsedData = response.data.map((v: any) => ({
                ...v,
                bus_photos: typeof v.bus_photos === 'string' ? JSON.parse(v.bus_photos) : v.bus_photos
            }));
            setVehicles(parsedData);
        } catch (error) {
            console.error("Fetch Vehicles Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddVehicle = async () => {
        if (!busNumber || !busName) {
            Alert.alert("Required", "Please enter Bus Number and Bus Name");
            return;
        }

        const formData = new FormData();
        formData.append('bus_number', busNumber);
        formData.append('bus_name', busName);

        // Append images
        selectedImages.forEach((img, index) => {
            formData.append('photos', {
                uri: img.uri,
                type: 'image/jpeg',
                name: `photo_${index}.jpg`
            } as any);
        });

        setLoading(true);
        try {
            await apiClient.post('/transport/vehicles', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            Alert.alert("Success", "Vehicle Added!");
            setShowAddModal(false);
            setBusName('');
            setBusNumber('');
            setSelectedImages([]);
            fetchVehicles();
        } catch (error) {
            console.error("Add Error", error);
            Alert.alert("Error", "Failed to add vehicle.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteVehicle = (id: number) => {
        Alert.alert("Delete", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: 'destructive',
                onPress: async () => {
                    try {
                        await apiClient.delete(`/transport/vehicles/${id}`);
                        fetchVehicles();
                    } catch (e) {
                        Alert.alert("Error", "Could not delete.");
                    }
                }
            }
        ]);
    };

    // --- MOCK IMAGE PICKER ---
    // In a real app, use 'react-native-image-crop-picker' or similar
    const pickImages = () => {
        // Simulating an image pick for demonstration. 
        // Replace this block with your actual Image Library logic.
        Alert.alert("Image Picker", "Please integrate a library like 'react-native-image-crop-picker' here. For now, adding a dummy image object.", [
            {
                text: "Add Dummy Image",
                onPress: () => {
                    const dummyImg = { uri: 'https://via.placeholder.com/150', name: 'dummy.jpg', type: 'image/jpeg' };
                    setSelectedImages([...selectedImages, dummyImg]);
                }
            },
            { text: "Cancel", style: "cancel" }
        ]);
    };

    // --- RENDER HELPERS ---

    const getImageUrl = (url: string) => {
        if (!url) return null;
        if (url.startsWith('http')) return url; // Already absolute
        return `${SERVER_URL}${url}`; // Append server path
    };

    // 1. ACCESS DENIED VIEW
    if (userRole !== 'admin') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                     <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/128/271/271220.png' }} style={styles.backIcon} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Vehicle Details</Text>
                    <View style={{width: 30}} />
                </View>
                <View style={styles.accessDeniedContainer}>
                    <Image 
                        source={{ uri: 'https://cdn-icons-png.flaticon.com/128/3967/3967261.png' }} 
                        style={styles.deniedIcon} 
                    />
                    <Text style={styles.deniedTitle}>Access Restricted</Text>
                    <Text style={styles.deniedText}>You have no access for this Module.</Text>
                    <TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.goBackText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // 2. ADMIN VIEW (Main Content)
    const renderVehicleCard = ({ item }: { item: Vehicle }) => {
        // Handle bus_photos which could be string or array
        let photos: string[] = [];
        if (Array.isArray(item.bus_photos)) photos = item.bus_photos;
        else if (typeof item.bus_photos === 'string') {
            try { photos = JSON.parse(item.bus_photos); } catch (e) { photos = []; }
        }

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.busNo}>{item.bus_number}</Text>
                        <Text style={styles.busName}>{item.bus_name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteVehicle(item.id)}>
                        <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/128/6861/6861362.png' }} style={styles.trashIcon} />
                    </TouchableOpacity>
                </View>

                {/* Album Horizontal Scroll */}
                {photos && photos.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumContainer}>
                        {photos.map((photo, index) => (
                            <Image 
                                key={index} 
                                source={{ uri: getImageUrl(photo) || 'https://via.placeholder.com/150' }} 
                                style={styles.albumPhoto} 
                            />
                        ))}
                    </ScrollView>
                ) : (
                    <Text style={styles.noPhotos}>No photos in album</Text>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/128/271/271220.png' }} style={styles.backIcon} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Vehicle Details</Text>
                </View>
                <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
                    <Text style={styles.addButtonText}>+ Add Bus</Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.centered}><ActivityIndicator size="large" color="#008080" /></View>
            ) : (
                <FlatList
                    data={vehicles}
                    renderItem={renderVehicleCard}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Text style={styles.emptyText}>No Vehicles Added Yet.</Text>
                        </View>
                    }
                />
            )}

            {/* Add Modal */}
            <Modal visible={showAddModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add School Bus</Text>
                        
                        <TextInput 
                            placeholder="Bus Number (e.g. TN-01-1234)" 
                            style={styles.input} 
                            value={busNumber}
                            onChangeText={setBusNumber}
                        />
                        <TextInput 
                            placeholder="Bus Name (e.g. Yellow Bus)" 
                            style={styles.input} 
                            value={busName}
                            onChangeText={setBusName}
                        />

                        {/* Image Picker Area */}
                        <Text style={styles.label}>Bus Album Photos:</Text>
                        <View style={styles.imagePickerContainer}>
                            <ScrollView horizontal>
                                {selectedImages.map((img, i) => (
                                    <Image key={i} source={{ uri: img.uri }} style={styles.previewImage} />
                                ))}
                                <TouchableOpacity style={styles.pickBtn} onPress={pickImages}>
                                    <Text style={styles.pickBtnText}>+</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                        <Text style={styles.hintText}>{selectedImages.length} photos selected</Text>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleAddVehicle}>
                                <Text style={styles.saveText}>Save Vehicle</Text>
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
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Header
    header: { 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
        padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#E2E8F0' 
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    backButton: { marginRight: 15, padding: 5 },
    backIcon: { width: 24, height: 24, tintColor: '#2D3748' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A202C' },
    addButton: { backgroundColor: '#38A169', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
    addButtonText: { color: '#FFF', fontWeight: 'bold' },

    // Access Denied
    accessDeniedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    deniedIcon: { width: 80, height: 80, marginBottom: 20, tintColor: '#E53E3E' },
    deniedTitle: { fontSize: 22, fontWeight: 'bold', color: '#2D3748', marginBottom: 10 },
    deniedText: { fontSize: 16, color: '#718096', textAlign: 'center', marginBottom: 30 },
    goBackBtn: { backgroundColor: '#3182CE', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25 },
    goBackText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

    // List
    listContent: { padding: 16 },
    card: { backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginBottom: 15, elevation: 3 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    busNo: { fontSize: 18, fontWeight: 'bold', color: '#2D3748' },
    busName: { fontSize: 14, color: '#718096' },
    trashIcon: { width: 20, height: 20, tintColor: '#E53E3E' },
    albumContainer: { marginTop: 10, flexDirection: 'row' },
    albumPhoto: { width: 100, height: 80, borderRadius: 8, marginRight: 10, backgroundColor: '#EDF2F7' },
    noPhotos: { color: '#CBD5E0', fontStyle: 'italic', marginTop: 10 },
    emptyText: { color: '#718096', fontSize: 16 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#FFF', borderRadius: 12, padding: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#4A5568' },
    imagePickerContainer: { flexDirection: 'row', marginBottom: 5 },
    previewImage: { width: 60, height: 60, borderRadius: 8, marginRight: 10 },
    pickBtn: { width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: '#3182CE', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
    pickBtnText: { fontSize: 24, color: '#3182CE' },
    hintText: { fontSize: 12, color: '#718096', marginBottom: 20 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
    cancelBtn: { padding: 12 },
    cancelText: { color: '#E53E3E', fontWeight: 'bold' },
    saveBtn: { backgroundColor: '#3182CE', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
    saveText: { color: '#FFF', fontWeight: 'bold' },
});

export default VehicalDetails;