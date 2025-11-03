import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, Image,
    TouchableOpacity, Modal, Pressable // ★★★ STEP 1: Import necessary components
} from 'react-native';
import apiClient from '../api/client';
// ★★★ STEP 2: Import your server URL config ★★★
import { SERVER_URL } from '../../apiConfig'; // Make sure this path is correct

const StaffDetailScreen = ({ route }) => {
    const { staffId } = route.params;
    const [staffDetails, setStaffDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    // ★★★ STEP 3: Add state to manage the image viewer modal ★★★
    const [isViewerVisible, setViewerVisible] = useState(false);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const response = await apiClient.get(`/staff/${staffId}`);
                setStaffDetails(response.data);
            } catch (error) {
                console.error('Error fetching staff details:', error);
            } finally {
                setLoading(false);
            }
        };

        if (staffId) {
            fetchDetails();
        }
    }, [staffId]);

    const DetailRow = ({ label, value }) => (
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value || 'Not Provided'}</Text>
        </View>
    );

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#34495e" /></View>;
    }

    if (!staffDetails) {
        return <View style={styles.loaderContainer}><Text>Could not load staff details.</Text></View>;
    }

    // ★★★ STEP 4: Construct the full, absolute image URL ★★★
    const imageUrl = staffDetails.profile_image_url
        ? `${SERVER_URL}${staffDetails.profile_image_url.startsWith('/') ? '' : '/'}${staffDetails.profile_image_url}`
        : null;

    return (
        <View style={{ flex: 1 }}>
            {/* ★★★ STEP 5: Add the Modal for viewing the enlarged image ★★★ */}
            <Modal
                visible={isViewerVisible}
                transparent={true}
                onRequestClose={() => setViewerVisible(false)}
                animationType="fade"
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setViewerVisible(false)}>
                    <View style={styles.modalContent}>
                        <Image
                            source={
                                imageUrl
                                    ? { uri: imageUrl }
                                    : require('../assets/default_avatar.png')
                            }
                            style={styles.enlargedAvatar}
                            resizeMode="contain"
                        />
                        <TouchableOpacity style={styles.closeButton} onPress={() => setViewerVisible(false)}>
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            <ScrollView style={styles.container}>
                <View style={styles.profileHeader}>
                    {/* ★★★ STEP 6: Make the profile image pressable ★★★ */}
                    <TouchableOpacity onPress={() => setViewerVisible(true)}>
                        <Image
                            // ★★★ STEP 7: Use the new `imageUrl` variable ★★★
                            source={
                                imageUrl
                                    ? { uri: imageUrl }
                                    : require('../assets/default_avatar.png')
                            }
                            style={styles.avatar}
                        />
                    </TouchableOpacity>
                    <Text style={styles.fullName}>{staffDetails.full_name}</Text>
                    <Text style={styles.role}>{staffDetails.role.charAt(0).toUpperCase() + staffDetails.role.slice(1)}</Text>
                </View>

                <View style={styles.detailsContainer}>
                    <DetailRow label="Full Name" value={staffDetails.full_name} />
                    <DetailRow label="Mobile No" value={staffDetails.phone} />
                    <DetailRow label="Email Address" value={staffDetails.email} />
                    <DetailRow label="Address" value={staffDetails.address} />
                    <DetailRow label="Username" value={staffDetails.username} />
                    <DetailRow label="Date of Birth" value={staffDetails.dob} />
                    <DetailRow label="Gender" value={staffDetails.gender} />
                </View>
            </ScrollView>
        </View>
    );
};

// ★★★ STEP 8: Add new styles for the modal and its contents ★★★
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f6f8',
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileHeader: {
        alignItems: 'center',
        padding: 30,
        backgroundColor: '#34495e',
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        borderColor: '#ffffff',
        marginBottom: 15,
        backgroundColor: '#bdc3c7',
    },
    fullName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    role: {
        fontSize: 16,
        color: '#ecf0f1',
        marginTop: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 15,
    },
    detailsContainer: {
        backgroundColor: '#ffffff',
        marginTop: -10,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        padding: 10,
    },
    detailRow: {
        flexDirection: 'row',
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f2f5',
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: 16,
        color: '#7f8c8d',
        flex: 2,
    },
    detailValue: {
        fontSize: 16,
        color: '#2c3e50',
        flex: 3,
        fontWeight: '500',
        textAlign: 'right',
    },
    // Styles for the image viewer modal
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '90%',
        height: '70%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    enlargedAvatar: {
        width: '100%',
        height: '100%',
        borderRadius: 10,
    },
    closeButton: {
        position: 'absolute',
        bottom: -60, // Position it below the image
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 35,
        borderRadius: 25,
    },
    closeButtonText: {
        color: '#2c3e50',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default StaffDetailScreen;