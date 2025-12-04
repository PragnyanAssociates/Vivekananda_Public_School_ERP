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
    Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useAuth } from '../../context/AuthContext';

// Icons
const BACK_ICON = 'https://cdn-icons-png.flaticon.com/128/271/271220.png';
const DENIED_ICON = 'https://cdn-icons-png.flaticon.com/128/3967/3967261.png';
const TRASH_ICON = 'https://cdn-icons-png.flaticon.com/128/6861/6861362.png';
const DRIVER_ICON = 'https://cdn-icons-png.flaticon.com/128/1995/1995439.png'; // Steering wheel
const CONDUCTOR_ICON = 'https://cdn-icons-png.flaticon.com/128/3305/3305929.png'; // Ticket/Whistle

// Interfaces
interface StaffMember {
    id: number; // transport_staff id
    user_id: number;
    full_name: string;
    phone: string | null;
    profile_image_url: string | null;
    staff_type: 'Driver' | 'Conductor';
}

interface AvailableUser {
    id: number; // user id
    full_name: string;
    phone: string | null;
    profile_image_url: string | null;
}

const BusStaffDetails = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const userRole = user?.role; // 'admin', 'teacher', 'student', 'others'

    // State
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Tabs State
    const [activeTab, setActiveTab] = useState<'Driver' | 'Conductor'>('Driver');
    
    // Others State
    const [myStatus, setMyStatus] = useState<any>(null);

    // Modal State (Admin Only)
    const [showAddModal, setShowAddModal] = useState(false);
    const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
    const [loadingAvailable, setLoadingAvailable] = useState(false);
    const [selectedUser, setSelectedUser] = useState<number | null>(null);
    const [selectedRole, setSelectedRole] = useState<'Driver' | 'Conductor'>('Driver');

    useEffect(() => {
        if (userRole === 'admin' || userRole === 'teacher') {
            fetchStaffList();
        } else if (userRole === 'others') {
            fetchMyStatus();
        }
    }, [userRole]);

    // --- API CALLS ---

    const fetchStaffList = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/transport/staff');
            setStaffList(response.data || []);
        } catch (error) {
            console.error("Fetch Staff Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableUsers = async () => {
        setLoadingAvailable(true);
        try {
            const response = await apiClient.get('/transport/staff-available');
            setAvailableUsers(response.data || []);
        } catch (error) {
            Alert.alert("Error", "Could not fetch available users.");
        } finally {
            setLoadingAvailable(false);
        }
    };

    const fetchMyStatus = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/transport/my-staff-status');
            setMyStatus(response.data);
        } catch (error) {
            console.error("Fetch Status Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddStaff = async () => {
        if (!selectedUser) {
            Alert.alert("Selection Required", "Please select a user.");
            return;
        }
        try {
            await apiClient.post('/transport/staff', {
                user_id: selectedUser,
                staff_type: selectedRole
            });
            Alert.alert("Success", "Staff assigned successfully.");
            setShowAddModal(false);
            setSelectedUser(null);
            fetchStaffList();
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Failed to add staff.");
        }
    };

    const handleDeleteStaff = (id: number) => {
        Alert.alert("Remove Staff", "Are you sure you want to remove this staff member?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Remove",
                style: 'destructive',
                onPress: async () => {
                    try {
                        await apiClient.delete(`/transport/staff/${id}`);
                        fetchStaffList();
                    } catch (e) {
                        Alert.alert("Error", "Could not remove.");
                    }
                }
            }
        ]);
    };

    // --- RENDER HELPERS ---

    const getImageUrl = (url: string | null) => {
        if (!url) return 'https://cdn-icons-png.flaticon.com/128/3135/3135715.png'; // Default
        if (url.startsWith('http')) return url;
        return `${SERVER_URL}${url}`;
    };

    // 1. ACCESS DENIED (Student)
    if (userRole === 'student') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                     <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Image source={{ uri: BACK_ICON }} style={styles.backIcon} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Staff Details</Text>
                    <View style={{width: 30}} />
                </View>
                <View style={styles.accessDeniedContainer}>
                    <Image source={{ uri: DENIED_ICON }} style={styles.deniedIcon} />
                    <Text style={styles.deniedTitle}>Access Restricted</Text>
                    <Text style={styles.deniedText}>Students cannot view staff details.</Text>
                    <TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.goBackText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // 2. OTHERS VIEW (My Status)
    if (userRole === 'others') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                     <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Image source={{ uri: BACK_ICON }} style={styles.backIcon} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Designation</Text>
                    <View style={{width: 30}} />
                </View>
                
                <View style={styles.statusContainer}>
                    {loading ? <ActivityIndicator size="large" color="#008080" /> : (
                        myStatus?.isStaff ? (
                            <View style={styles.statusCard}>
                                <Image 
                                    source={{ uri: myStatus.data.staff_type === 'Driver' ? DRIVER_ICON : CONDUCTOR_ICON }} 
                                    style={styles.bigRoleIcon} 
                                />
                                <Text style={styles.statusTitle}>You are a {myStatus.data.staff_type}</Text>
                                <View style={styles.profileSection}>
                                    <Image source={{ uri: getImageUrl(myStatus.data.profile_image_url) }} style={styles.bigAvatar} />
                                    <Text style={styles.profileName}>{myStatus.data.full_name}</Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.statusCard}>
                                <Text style={styles.statusTitle}>Not Assigned</Text>
                                <Text style={styles.statusText}>You have not been assigned a transport role yet.</Text>
                            </View>
                        )
                    )}
                </View>
            </SafeAreaView>
        );
    }

    // 3. ADMIN & TEACHER VIEW (List with Tabs)
    const filteredList = staffList.filter(s => s.staff_type === activeTab);

    const renderStaffCard = ({ item }: { item: StaffMember }) => (
        <View style={styles.card}>
            <View style={styles.cardLeft}>
                <Image source={{ uri: getImageUrl(item.profile_image_url) }} style={styles.avatar} />
                <View style={styles.info}>
                    <Text style={styles.name}>{item.full_name}</Text>
                    <Text style={styles.phone}>{item.phone || 'No Contact'}</Text>
                </View>
            </View>
            
            {/* Delete Button (Admin Only) */}
            {userRole === 'admin' && (
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteStaff(item.id)}>
                    <Image source={{ uri: TRASH_ICON }} style={styles.trashIcon} />
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Image source={{ uri: BACK_ICON }} style={styles.backIcon} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Bus Staff</Text>
                </View>
                
                {/* Add Button (Admin Only) */}
                {userRole === 'admin' && (
                    <TouchableOpacity 
                        style={styles.addButton} 
                        onPress={() => {
                            // Set role based on active tab for convenience
                            setSelectedRole(activeTab);
                            fetchAvailableUsers();
                            setShowAddModal(true);
                        }}
                    >
                        <Text style={styles.addButtonText}>+ Assign {activeTab}</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'Driver' && styles.activeTab]} 
                    onPress={() => setActiveTab('Driver')}
                >
                    <Image source={{ uri: DRIVER_ICON }} style={[styles.tabIcon, activeTab === 'Driver' && { tintColor: '#2B6CB0' }]} />
                    <Text style={[styles.tabText, activeTab === 'Driver' && styles.activeTabText]}>Drivers</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'Conductor' && styles.activeTab]} 
                    onPress={() => setActiveTab('Conductor')}
                >
                    <Image source={{ uri: CONDUCTOR_ICON }} style={[styles.tabIcon, activeTab === 'Conductor' && { tintColor: '#2B6CB0' }]} />
                    <Text style={[styles.tabText, activeTab === 'Conductor' && styles.activeTabText]}>Conductors</Text>
                </TouchableOpacity>
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.centered}><ActivityIndicator size="large" color="#008080" /></View>
            ) : (
                <FlatList
                    data={filteredList}
                    renderItem={renderStaffCard}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Text style={styles.emptyText}>No {activeTab}s Assigned Yet.</Text>
                        </View>
                    }
                />
            )}

            {/* Add Modal (Admin Only) */}
            <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Assign New {selectedRole}</Text>
                        <TouchableOpacity onPress={() => setShowAddModal(false)}>
                            <Text style={styles.closeText}>Close</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.modalBody}>
                        {/* 1. Select Role (Allows switching inside modal too) */}
                        <Text style={styles.sectionLabel}>Select Role:</Text>
                        <View style={styles.roleSelector}>
                            <TouchableOpacity 
                                style={[styles.roleBtn, selectedRole === 'Driver' && styles.roleBtnActive]}
                                onPress={() => setSelectedRole('Driver')}
                            >
                                <Text style={[styles.roleBtnText, selectedRole === 'Driver' && styles.roleBtnTextActive]}>Driver</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.roleBtn, selectedRole === 'Conductor' && styles.roleBtnActive]}
                                onPress={() => setSelectedRole('Conductor')}
                            >
                                <Text style={[styles.roleBtnText, selectedRole === 'Conductor' && styles.roleBtnTextActive]}>Conductor</Text>
                            </TouchableOpacity>
                        </View>

                        {/* 2. Select User */}
                        <Text style={styles.sectionLabel}>Select User (Others):</Text>
                        {loadingAvailable ? (
                            <ActivityIndicator size="small" color="#008080" style={{marginTop: 20}} />
                        ) : (
                            <FlatList 
                                data={availableUsers}
                                keyExtractor={(item) => item.id.toString()}
                                style={styles.userList}
                                ListEmptyComponent={
                                    <Text style={styles.noUsersText}>No available 'Others' users found.</Text>
                                }
                                renderItem={({ item }) => (
                                    <TouchableOpacity 
                                        style={[styles.userItem, selectedUser === item.id && styles.userItemActive]}
                                        onPress={() => setSelectedUser(item.id)}
                                    >
                                        <Image source={{ uri: getImageUrl(item.profile_image_url) }} style={styles.modalAvatar} />
                                        <View>
                                            <Text style={styles.modalName}>{item.full_name}</Text>
                                            <Text style={styles.modalPhone}>{item.phone || 'No Phone'}</Text>
                                        </View>
                                        {selectedUser === item.id && (
                                            <View style={styles.checkCircle} />
                                        )}
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleAddStaff}>
                            <Text style={styles.saveBtnText}>Save Assignment</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
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
    addButton: { backgroundColor: '#3182CE', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
    addButtonText: { color: '#FFF', fontWeight: 'bold' },

    // Tabs
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFF',
        paddingVertical: 10,
        paddingHorizontal: 20,
        marginBottom: 10,
        elevation: 2
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: '#2B6CB0',
    },
    tabIcon: { width: 20, height: 20, marginRight: 8, tintColor: '#A0AEC0' },
    tabText: { fontSize: 16, fontWeight: '600', color: '#A0AEC0' },
    activeTabText: { color: '#2B6CB0', fontWeight: 'bold' },

    // List Item
    listContent: { padding: 16 },
    card: { 
        backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginBottom: 15, elevation: 2,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#EDF2F7', marginRight: 15 },
    info: { flex: 1 },
    name: { fontSize: 16, fontWeight: 'bold', color: '#2D3748' },
    phone: { fontSize: 14, color: '#718096', marginTop: 2 },
    
    deleteBtn: { padding: 8, backgroundColor: '#FFF5F5', borderRadius: 20 },
    trashIcon: { width: 20, height: 20, tintColor: '#E53E3E' },
    emptyText: { color: '#718096', fontSize: 16 },

    // Access Denied
    accessDeniedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    deniedIcon: { width: 80, height: 80, marginBottom: 20, tintColor: '#E53E3E' },
    deniedTitle: { fontSize: 22, fontWeight: 'bold', color: '#2D3748', marginBottom: 10 },
    deniedText: { fontSize: 16, color: '#718096', textAlign: 'center', marginBottom: 30 },
    goBackBtn: { backgroundColor: '#3182CE', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25 },
    goBackText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

    // Others Status View
    statusContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    statusCard: { backgroundColor: '#FFF', width: '90%', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 5 },
    bigRoleIcon: { width: 80, height: 80, marginBottom: 20 },
    statusTitle: { fontSize: 22, fontWeight: 'bold', color: '#2D3748', marginBottom: 10 },
    statusText: { color: '#718096', textAlign: 'center' },
    profileSection: { marginTop: 20, alignItems: 'center' },
    bigAvatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#EDF2F7', marginBottom: 10 },
    profileName: { fontSize: 18, fontWeight: '600', color: '#2D3748' },

    // Add Modal Styles
    modalContainer: { flex: 1, backgroundColor: '#F7FAFC' },
    modalHeader: { padding: 20, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    closeText: { color: '#3182CE', fontSize: 16, fontWeight: 'bold' },
    modalBody: { flex: 1, padding: 20 },
    sectionLabel: { fontSize: 16, fontWeight: 'bold', color: '#4A5568', marginBottom: 10, marginTop: 10 },
    
    // Role Selector
    roleSelector: { flexDirection: 'row', marginBottom: 20 },
    roleBtn: { flex: 1, padding: 15, borderWidth: 1, borderColor: '#CBD5E0', alignItems: 'center', borderRadius: 8, marginHorizontal: 5 },
    roleBtnActive: { backgroundColor: '#3182CE', borderColor: '#3182CE' },
    roleBtnText: { color: '#718096', fontWeight: 'bold' },
    roleBtnTextActive: { color: '#FFF' },

    // User List in Modal
    userList: { marginTop: 10 },
    userItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FFF', borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    userItemActive: { borderColor: '#3182CE', backgroundColor: '#EBF8FF' },
    modalAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 15, backgroundColor: '#EDF2F7' },
    modalName: { fontSize: 16, fontWeight: 'bold', color: '#2D3748' },
    modalPhone: { fontSize: 13, color: '#718096' },
    checkCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#3182CE', marginLeft: 'auto' },
    noUsersText: { textAlign: 'center', color: '#A0AEC0', marginTop: 20 },

    modalFooter: { padding: 20, backgroundColor: '#FFF' },
    saveBtn: { backgroundColor: '#38A169', padding: 15, borderRadius: 10, alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});

export default BusStaffDetails;