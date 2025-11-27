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
    ActivityIndicator,
    Alert,
    RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

// ★★★ 1. IMPORT YOUR API CLIENT ★★★
// Adjust the path '../api/client' depending on where this file is located relative to src/api/client.js
import apiClient from '../../api/client'; 

// ★★★ 2. IMPORT SERVER_URL FOR IMAGES ★★★
import { SERVER_URL } from '../../../apiConfig';

// Interfaces
interface Passenger {
    id: number;
    full_name: string;
    roll_no: string | null;
    profile_image_url: string | null;
    class_group: string;
}

// Available Classes
const CLASS_GROUPS = [
    'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', 
    '6th', '7th', '8th', '9th', '10th'
];

const PassengersScreen = () => {
    const navigation = useNavigation();
    
    // State for Main List
    const [selectedClass, setSelectedClass] = useState<string>('10th');
    const [passengers, setPassengers] = useState<Passenger[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [showClassModal, setShowClassModal] = useState<boolean>(false);

    // State for "Add Student" Modal
    const [showAddModal, setShowAddModal] = useState<boolean>(false);
    const [availableStudents, setAvailableStudents] = useState<Passenger[]>([]);
    const [loadingAvailable, setLoadingAvailable] = useState<boolean>(false);

    // Initial Load
    useEffect(() => {
        fetchPassengers();
    }, [selectedClass]);

    // --- API CALLS (USING apiClient) ---

    const fetchPassengers = async () => {
        setLoading(true);
        try {
            // apiClient automatically adds Base URL and Token
            const response = await apiClient.get('/transport/passengers', {
                params: { class_group: selectedClass }
            });
            
            // Axios returns data in response.data
            setPassengers(response.data);
        } catch (error) {
            console.error("Error fetching passengers:", error);
            // Handle specific status codes if needed
            setPassengers([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchAvailableStudents = async () => {
        setLoadingAvailable(true);
        try {
            const response = await apiClient.get('/transport/students-available', {
                params: { class_group: selectedClass }
            });
            setAvailableStudents(response.data);
        } catch (error) {
            console.error("Error fetching available students:", error);
            Alert.alert("Error", "Could not fetch student list.");
        } finally {
            setLoadingAvailable(false);
        }
    };

    const handleAddStudentToTransport = async (userId: number) => {
        try {
            await apiClient.post('/transport/passengers', { user_id: userId });

            // Remove from available list locally to update UI instantly
            setAvailableStudents(prev => prev.filter(s => s.id !== userId));
            
            // Refresh main list
            fetchPassengers(); 
            Alert.alert("Success", "Student added to passengers list.");
        } catch (error: any) {
            const msg = error.response?.data?.message || "Failed to add student.";
            Alert.alert("Error", msg);
        }
    };

    const handleRemovePassenger = async (userId: number, name: string) => {
        Alert.alert(
            "Remove Passenger",
            `Are you sure you want to remove ${name} from transport?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Remove", 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiClient.delete(`/transport/passengers/${userId}`);
                            fetchPassengers(); // Refresh list
                        } catch (error) {
                            Alert.alert("Error", "Could not remove passenger.");
                        }
                    }
                }
            ]
        );
    };

    // --- RENDER HELPERS ---

    const getImageUrl = (url: string | null) => {
        if (!url) return 'https://cdn-icons-png.flaticon.com/128/3135/3135715.png'; // Default Avatar
        
        // If the backend returns a relative path (e.g. /uploads/image.jpg), prepend the SERVER_URL
        if (url.startsWith('/')) {
            return `${SERVER_URL}${url}`;
        }
        return url;
    };

    const renderPassengerCard = ({ item }: { item: Passenger }) => (
        <View style={styles.card}>
            <Image 
                source={{ uri: getImageUrl(item.profile_image_url) }} 
                style={styles.avatar} 
            />
            <View style={styles.infoContainer}>
                <Text style={styles.nameText}>{item.full_name}</Text>
                <View style={styles.detailsRow}>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>Roll: {item.roll_no || 'N/A'}</Text>
                    </View>
                    <Text style={styles.classText}>Class: {item.class_group}</Text>
                </View>
            </View>
            <TouchableOpacity 
                style={styles.deleteBtn}
                onPress={() => handleRemovePassenger(item.id, item.full_name)}
            >
                <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
        </View>
    );

    const renderAvailableStudentCard = ({ item }: { item: Passenger }) => (
        <View style={styles.modalCard}>
            <Image 
                source={{ uri: getImageUrl(item.profile_image_url) }} 
                style={styles.modalAvatar} 
            />
            <View style={styles.infoContainer}>
                <Text style={styles.modalNameText}>{item.full_name}</Text>
                <Text style={styles.modalRollText}>Roll: {item.roll_no || 'N/A'}</Text>
            </View>
            <TouchableOpacity 
                style={styles.addBtn}
                onPress={() => handleAddStudentToTransport(item.id)}
            >
                <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
        </View>
    );

    // --- MAIN RENDER ---

    return (
        <SafeAreaView style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Passengers</Text>
                    <Text style={styles.subHeader}>{passengers.length} Active Students</Text>
                </View>
                <TouchableOpacity 
                    style={styles.headerAddButton} 
                    onPress={() => {
                        fetchAvailableStudents();
                        setShowAddModal(true);
                    }}
                >
                    <Text style={styles.headerAddButtonText}>+ Add Student</Text>
                </TouchableOpacity>
            </View>

            {/* CLASS FILTER DROPDOWN */}
            <View style={styles.filterContainer}>
                <Text style={styles.filterLabel}>Class Group:</Text>
                <TouchableOpacity 
                    style={styles.dropdownTrigger}
                    onPress={() => setShowClassModal(true)}
                >
                    <Text style={styles.dropdownText}>{selectedClass}</Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
            </View>

            {/* PASSENGERS LIST */}
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#4A90E2" />
                </View>
            ) : (
                <FlatList
                    data={passengers}
                    renderItem={renderPassengerCard}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => {
                            setRefreshing(true);
                            fetchPassengers();
                        }} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No passengers found in Class {selectedClass}.</Text>
                        </View>
                    }
                />
            )}

            {/* MODAL: CLASS SELECTION */}
            <Modal visible={showClassModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.selectionModal}>
                        <Text style={styles.modalTitle}>Select Class</Text>
                        <FlatList
                            data={CLASS_GROUPS}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    style={[styles.modalItem, selectedClass === item && styles.modalItemSelected]}
                                    onPress={() => {
                                        setSelectedClass(item);
                                        setShowClassModal(false);
                                    }}
                                >
                                    <Text style={[styles.modalItemText, selectedClass === item && styles.modalItemTextSelected]}>{item}</Text>
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowClassModal(false)}>
                            <Text style={styles.closeModalBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL: ADD STUDENT */}
            <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={styles.addModalContainer}>
                    <View style={styles.addModalHeader}>
                        <Text style={styles.addModalTitle}>Add Passenger</Text>
                        <Text style={styles.addModalSubtitle}>Select from Class {selectedClass}</Text>
                        <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.addModalClose}>
                            <Text style={styles.addModalCloseText}>Done</Text>
                        </TouchableOpacity>
                    </View>

                    {loadingAvailable ? (
                        <View style={styles.centerContainer}>
                            <ActivityIndicator size="large" color="#4A90E2" />
                        </View>
                    ) : (
                        <FlatList
                            data={availableStudents}
                            renderItem={renderAvailableStudentCard}
                            keyExtractor={(item) => item.id.toString()}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No available students found to add.</Text>
                                    <Text style={styles.emptySubText}>Everyone in Class {selectedClass} is already a passenger.</Text>
                                </View>
                            }
                        />
                    )}
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7FAFC',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // HEADER
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1A202C',
    },
    subHeader: {
        fontSize: 14,
        color: '#718096',
        marginTop: 2,
    },
    headerAddButton: {
        backgroundColor: '#48BB78',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        elevation: 2,
    },
    headerAddButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    // FILTER
    filterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#F7FAFC',
    },
    filterLabel: {
        fontSize: 16,
        color: '#4A5568',
        marginRight: 10,
    },
    dropdownTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#CBD5E0',
    },
    dropdownText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2D3748',
        marginRight: 8,
        minWidth: 40,
        textAlign: 'center',
    },
    dropdownArrow: {
        fontSize: 12,
        color: '#718096',
    },
    // MAIN LIST
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 12,
        marginBottom: 12,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#EDF2F7',
    },
    infoContainer: {
        flex: 1,
        marginLeft: 15,
    },
    nameText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2D3748',
        marginBottom: 4,
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    badge: {
        backgroundColor: '#EBF8FF',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 4,
        marginRight: 10,
    },
    badgeText: {
        fontSize: 12,
        color: '#3182CE',
        fontWeight: '600',
    },
    classText: {
        fontSize: 12,
        color: '#718096',
    },
    deleteBtn: {
        padding: 10,
        backgroundColor: '#FFF5F5',
        borderRadius: 20,
    },
    deleteBtnText: {
        fontSize: 16,
        color: '#E53E3E',
        fontWeight: 'bold',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#718096',
        fontSize: 16,
        fontWeight: '500',
    },
    emptySubText: {
        color: '#A0AEC0',
        fontSize: 14,
        marginTop: 5,
        textAlign: 'center',
    },
    // CLASS MODAL
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectionModal: {
        backgroundColor: '#FFF',
        width: '80%',
        maxHeight: '60%',
        borderRadius: 16,
        padding: 20,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    modalItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#EDF2F7',
    },
    modalItemSelected: {
        backgroundColor: '#F0FFF4',
    },
    modalItemText: {
        fontSize: 16,
        textAlign: 'center',
        color: '#4A5568',
    },
    modalItemTextSelected: {
        color: '#38A169',
        fontWeight: 'bold',
    },
    closeModalBtn: {
        marginTop: 15,
        backgroundColor: '#E2E8F0',
        padding: 12,
        borderRadius: 8,
    },
    closeModalBtnText: {
        textAlign: 'center',
        fontWeight: 'bold',
        color: '#4A5568',
    },
    // ADD MODAL
    addModalContainer: {
        flex: 1,
        backgroundColor: '#F7FAFC',
    },
    addModalHeader: {
        padding: 20,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        alignItems: 'center',
    },
    addModalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    addModalSubtitle: {
        fontSize: 14,
        color: '#718096',
        marginTop: 5,
    },
    addModalClose: {
        position: 'absolute',
        right: 20,
        top: 25,
    },
    addModalCloseText: {
        color: '#3182CE',
        fontSize: 16,
        fontWeight: '600',
    },
    modalCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 10,
        marginBottom: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    modalAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#EDF2F7',
    },
    modalNameText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#2D3748',
    },
    modalRollText: {
        fontSize: 12,
        color: '#718096',
    },
    addBtn: {
        backgroundColor: '#3182CE',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    addBtnText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
});

export default PassengersScreen;