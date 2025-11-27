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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../apiConfig';

// Interfaces
interface Passenger {
    id: number;
    full_name: string;
    roll_no: string | null;
    profile_image_url: string | null;
    class_group: string;
}

interface StudentStatus {
    isPassenger: boolean;
    data: {
        full_name: string;
        roll_no: string;
        status: string;
        profile_image_url: string;
    } | null;
}

// Class List
const CLASS_GROUPS = [
    'LKG', 'UKG', 
    'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 
    'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'
];

const PassengersScreen = () => {
    const navigation = useNavigation();
    
    // --- ROLES & PERMISSIONS STATE ---
    const [userRole, setUserRole] = useState<string | null>(null);
    const [loadingRole, setLoadingRole] = useState(true);

    // --- ADMIN/TEACHER STATE ---
    const [selectedClass, setSelectedClass] = useState<string>('Class 10');
    const [passengers, setPassengers] = useState<Passenger[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    // --- STUDENT STATE ---
    const [myStatus, setMyStatus] = useState<StudentStatus | null>(null);

    // --- MODALS (Admin Only) ---
    const [showClassModal, setShowClassModal] = useState<boolean>(false);
    const [showAddModal, setShowAddModal] = useState<boolean>(false);
    const [availableStudents, setAvailableStudents] = useState<Passenger[]>([]);
    const [loadingAvailable, setLoadingAvailable] = useState<boolean>(false);

    // 1. GET USER ROLE ON MOUNT
    useEffect(() => {
        const getUserRole = async () => {
            try {
                const role = await AsyncStorage.getItem('userRole'); // Assuming you store 'admin', 'teacher', 'student'
                setUserRole(role);
            } catch (error) {
                console.error("Failed to load role", error);
            } finally {
                setLoadingRole(false);
            }
        };
        getUserRole();
    }, []);

    // 2. FETCH DATA BASED ON ROLE
    useEffect(() => {
        if (!userRole) return;

        if (userRole === 'student') {
            fetchMyStatus();
        } else {
            // Admin or Teacher
            fetchPassengers();
        }
    }, [userRole, selectedClass]);

    // --- API CALLS ---

    // For Admin/Teacher
    const fetchPassengers = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/transport/passengers', {
                params: { class_group: selectedClass }
            });
            setPassengers(response.data || []);
        } catch (error) {
            console.error("Error fetching passengers:", error);
            setPassengers([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // For Student
    const fetchMyStatus = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/transport/my-status');
            setMyStatus(response.data);
        } catch (error) {
            console.error("Error fetching my status:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // For Admin (Modal Data)
    const fetchStudentsForAddModal = async () => {
        setLoadingAvailable(true);
        try {
            const response = await apiClient.get('/students/all');
            const allStudents: Passenger[] = response.data || [];
            
            const classStudents = allStudents.filter(s => s.class_group === selectedClass);
            const currentPassengerIds = new Set(passengers.map(p => p.id));
            const available = classStudents.filter(s => !currentPassengerIds.has(s.id));
            
            // Sort by roll number
            available.sort((a, b) => {
                const rollA = parseInt(a.roll_no || '9999', 10);
                const rollB = parseInt(b.roll_no || '9999', 10);
                return rollA - rollB;
            });

            setAvailableStudents(available);
        } catch (error) {
            Alert.alert("Error", "Could not fetch student list.");
        } finally {
            setLoadingAvailable(false);
        }
    };

    // Actions (Admin Only)
    const handleAddStudentToTransport = async (userId: number) => {
        try {
            await apiClient.post('/transport/passengers', { user_id: userId });
            setAvailableStudents(prev => prev.filter(s => s.id !== userId));
            fetchPassengers(); 
            Alert.alert("Success", "Student added.");
        } catch (error: any) {
            Alert.alert("Error", "Failed to add student.");
        }
    };

    const handleRemovePassenger = async (userId: number, name: string) => {
        Alert.alert(
            "Remove Passenger",
            `Remove ${name}?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Remove", 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiClient.delete(`/transport/passengers/${userId}`);
                            fetchPassengers(); 
                        } catch (error) {
                            Alert.alert("Error", "Could not remove passenger.");
                        }
                    }
                }
            ]
        );
    };

    // --- HELPER ---
    const getImageUrl = (url: string | null) => {
        if (!url) return 'https://cdn-icons-png.flaticon.com/128/3135/3135715.png';
        if (url.startsWith('/')) return `${SERVER_URL}${url}`;
        return url;
    };

    // --- RENDER HELPERS ---

    // 1. Student View Render
    const renderStudentView = () => {
        if (loading) return <ActivityIndicator size="large" color="#4A90E2" style={{marginTop: 50}} />;
        
        const isPassenger = myStatus?.isPassenger;

        return (
            <View style={styles.studentViewContainer}>
                <View style={[styles.statusCard, isPassenger ? styles.activeCard : styles.inactiveCard]}>
                    <Image 
                        source={{ uri: isPassenger 
                            ? 'https://cdn-icons-png.flaticon.com/128/190/190411.png' // Checkmark
                            : 'https://cdn-icons-png.flaticon.com/128/1828/1828665.png' // Cross
                        }} 
                        style={styles.statusIcon} 
                    />
                    <Text style={styles.statusTitle}>
                        {isPassenger ? "Active Passenger" : "Not Enrolled"}
                    </Text>
                    <Text style={styles.statusDesc}>
                        {isPassenger 
                            ? "You are registered in the school transport system." 
                            : "You are currently not using school transport."}
                    </Text>
                </View>
                
                {isPassenger && myStatus?.data && (
                    <View style={styles.profilePreview}>
                        <Image source={{ uri: getImageUrl(myStatus.data.profile_image_url) }} style={styles.bigAvatar} />
                        <Text style={styles.previewName}>{myStatus.data.full_name}</Text>
                        <Text style={styles.previewRoll}>Roll No: {myStatus.data.roll_no || 'N/A'}</Text>
                    </View>
                )}
            </View>
        );
    };

    // 2. Admin/Teacher List Item
    const renderPassengerCard = ({ item }: { item: Passenger }) => (
        <View style={styles.card}>
            <Image source={{ uri: getImageUrl(item.profile_image_url) }} style={styles.avatar} />
            <View style={styles.infoContainer}>
                <Text style={styles.nameText}>{item.full_name}</Text>
                <View style={styles.detailsRow}>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>Roll: {item.roll_no || 'N/A'}</Text>
                    </View>
                    <Text style={styles.classText}>{item.class_group}</Text>
                </View>
            </View>
            
            {/* ONLY ADMIN CAN REMOVE */}
            {userRole === 'admin' && (
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleRemovePassenger(item.id, item.full_name)}>
                    <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    // --- MAIN RENDER ---
    if (loadingRole) {
        return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#4A90E2" /></View>;
    }

    return (
        <SafeAreaView style={styles.container}>
            
            {/* --- HEADER --- */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Passengers</Text>
                    {userRole !== 'student' && (
                        <Text style={styles.subHeader}>{passengers.length} Students in {selectedClass}</Text>
                    )}
                </View>
                
                {/* ONLY ADMIN CAN SEE ADD BUTTON */}
                {userRole === 'admin' && (
                    <TouchableOpacity 
                        style={styles.headerAddButton} 
                        onPress={() => {
                            fetchStudentsForAddModal();
                            setShowAddModal(true);
                        }}
                    >
                        <Text style={styles.headerAddButtonText}>+ Add Student</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* --- STUDENT VIEW --- */}
            {userRole === 'student' ? (
                <View style={styles.contentContainer}>
                    {renderStudentView()}
                </View>
            ) : (
                /* --- ADMIN / TEACHER VIEW --- */
                <>
                    {/* CLASS FILTER */}
                    <View style={styles.filterContainer}>
                        <Text style={styles.filterLabel}>View Class:</Text>
                        <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setShowClassModal(true)}>
                            <Text style={styles.dropdownText}>{selectedClass}</Text>
                            <Text style={styles.dropdownArrow}>▼</Text>
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.centerContainer}><ActivityIndicator size="large" color="#4A90E2" /></View>
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
                                    <Text style={styles.emptyText}>No passengers found in {selectedClass}.</Text>
                                </View>
                            }
                        />
                    )}
                </>
            )}

            {/* --- MODALS (Admin Logic mostly, but accessible for Class Selection by Teacher) --- */}
            
            {/* CLASS SELECT MODAL (Admin & Teacher) */}
            <Modal visible={showClassModal} transparent animationType="fade">
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setShowClassModal(false)}
                >
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
                                    <Text style={[styles.modalItemText, selectedClass === item && styles.modalItemTextSelected]}>
                                        {item}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ADD STUDENT MODAL (Admin Only) */}
            <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={styles.addModalContainer}>
                    <View style={styles.addModalHeader}>
                        <View>
                            <Text style={styles.addModalTitle}>Add Passenger</Text>
                            <Text style={styles.addModalSubtitle}>Select from {selectedClass}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.addModalClose}>
                            <Text style={styles.addModalCloseText}>Done</Text>
                        </TouchableOpacity>
                    </View>

                    {loadingAvailable ? (
                        <View style={styles.centerContainer}><ActivityIndicator size="large" color="#4A90E2" /></View>
                    ) : (
                        <FlatList
                            data={availableStudents}
                            keyExtractor={(item) => item.id.toString()}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No available students found.</Text>
                                </View>
                            }
                            renderItem={({ item }) => (
                                <View style={styles.modalCard}>
                                    <Image source={{ uri: getImageUrl(item.profile_image_url) }} style={styles.modalAvatar} />
                                    <View style={styles.infoContainer}>
                                        <Text style={styles.modalNameText}>{item.full_name}</Text>
                                        <Text style={styles.modalRollText}>Roll: {item.roll_no || 'N/A'}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.addBtn} onPress={() => handleAddStudentToTransport(item.id)}>
                                        <Text style={styles.addBtnText}>+ Add</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        />
                    )}
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F7FAFC' },
    contentContainer: { flex: 1, padding: 20 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Header
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0'
    },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A202C' },
    subHeader: { fontSize: 13, color: '#718096', marginTop: 2 },
    headerAddButton: { backgroundColor: '#48BB78', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
    headerAddButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

    // Student View Styles
    studentViewContainer: { alignItems: 'center', marginTop: 40 },
    statusCard: {
        width: '100%', alignItems: 'center', padding: 30, borderRadius: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5
    },
    activeCard: { backgroundColor: '#F0FFF4', borderWidth: 1, borderColor: '#C6F6D5' },
    inactiveCard: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FED7D7' },
    statusIcon: { width: 80, height: 80, marginBottom: 20 },
    statusTitle: { fontSize: 22, fontWeight: 'bold', color: '#2D3748', marginBottom: 10 },
    statusDesc: { fontSize: 15, color: '#718096', textAlign: 'center', lineHeight: 22 },
    profilePreview: { marginTop: 40, alignItems: 'center' },
    bigAvatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#fff' },
    previewName: { fontSize: 20, fontWeight: 'bold', color: '#2D3748', marginTop: 15 },
    previewRoll: { fontSize: 16, color: '#718096', marginTop: 5 },

    // Filter
    filterContainer: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#F7FAFC'
    },
    filterLabel: { fontSize: 16, color: '#4A5568', marginRight: 10 },
    dropdownTrigger: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
        paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8,
        borderWidth: 1, borderColor: '#CBD5E0'
    },
    dropdownText: { fontSize: 16, fontWeight: '600', color: '#2D3748', marginRight: 8 },
    dropdownArrow: { fontSize: 12, color: '#718096' },

    // List Item
    listContent: { padding: 16, paddingBottom: 40 },
    card: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
        padding: 12, marginBottom: 12, borderRadius: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
    },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#EDF2F7' },
    infoContainer: { flex: 1, marginLeft: 15 },
    nameText: { fontSize: 16, fontWeight: 'bold', color: '#2D3748', marginBottom: 4 },
    detailsRow: { flexDirection: 'row', alignItems: 'center' },
    badge: { backgroundColor: '#EBF8FF', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4, marginRight: 10 },
    badgeText: { fontSize: 12, color: '#3182CE', fontWeight: '600' },
    classText: { fontSize: 12, color: '#718096' },
    deleteBtn: { padding: 10, backgroundColor: '#FFF5F5', borderRadius: 20 },
    deleteBtnText: { fontSize: 16, color: '#E53E3E', fontWeight: 'bold' },

    // Empty State
    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#718096', fontSize: 16, fontWeight: '500' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    selectionModal: { backgroundColor: '#FFF', width: '80%', maxHeight: '60%', borderRadius: 16, padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    modalItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EDF2F7' },
    modalItemSelected: { backgroundColor: '#F0FFF4' },
    modalItemText: { fontSize: 16, textAlign: 'center', color: '#4A5568' },
    modalItemTextSelected: { color: '#38A169', fontWeight: 'bold' },

    // Add Modal Styles
    addModalContainer: { flex: 1, backgroundColor: '#F7FAFC' },
    addModalHeader: { 
        padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' 
    },
    addModalTitle: { fontSize: 20, fontWeight: 'bold' },
    addModalSubtitle: { fontSize: 14, color: '#718096' },
    addModalClose: { padding: 5 },
    addModalCloseText: { color: '#3182CE', fontSize: 16, fontWeight: '600' },
    
    // Add Modal Card
    modalCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
        padding: 10, marginBottom: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0'
    },
    modalAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EDF2F7' },
    modalNameText: { fontSize: 15, fontWeight: '600', color: '#2D3748' },
    modalRollText: { fontSize: 12, color: '#718096' },
    addBtn: { backgroundColor: '#3182CE', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 6 },
    addBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
});

export default PassengersScreen;