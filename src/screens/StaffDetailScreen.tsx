import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, Image,
    TouchableOpacity, Modal, Pressable
} from 'react-native';
import apiClient from '../api/client';
import { SERVER_URL } from '../../apiConfig';
import TimetableScreen from './TimetableScreen';

const StaffDetailScreen = ({ route }) => {
    const { staffId } = route.params;
    const [staffDetails, setStaffDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isViewerVisible, setViewerVisible] = useState(false);
    const [isTimetableExpanded, setIsTimetableExpanded] = useState(false);

    const scrollViewRef = useRef(null);

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
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

    const handleTimetableToggle = () => {
        if (!isTimetableExpanded) {
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
        setIsTimetableExpanded(prevState => !prevState);
    };


    const DetailRow = ({ label, value }) => (
        <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || 'Not Provided'}</Text></View>
    );

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#008080" /></View>;
    }

    if (!staffDetails) {
        return <View style={styles.loaderContainer}><Text>Could not load staff details.</Text></View>;
    }

    const imageUrl = staffDetails.profile_image_url ? `${SERVER_URL}${staffDetails.profile_image_url.startsWith('/') ? '' : '/'}${staffDetails.profile_image_url}` : null;

    // This logic correctly determines the role to display in the header
    const displayRole = staffDetails.role === 'admin'
        ? staffDetails.class_group // Shows "Management Admin" or "General Admin"
        : staffDetails.role;      // Shows "teacher" or "others"

    return (
        <View style={{ flex: 1 }}>
            <Modal visible={isViewerVisible} transparent={true} onRequestClose={() => setViewerVisible(false)} animationType="fade">
                <Pressable style={styles.modalBackdrop} onPress={() => setViewerVisible(false)}><View style={styles.modalContent}><Image source={imageUrl ? { uri: imageUrl } : require('../assets/default_avatar.png')} style={styles.enlargedAvatar} resizeMode="contain" /><TouchableOpacity style={styles.closeButton} onPress={() => setViewerVisible(false)}><Text style={styles.closeButtonText}>Close</Text></TouchableOpacity></View></Pressable>
            </Modal>

            <ScrollView ref={scrollViewRef} style={styles.container}>
                <View style={styles.profileHeader}>
                    <TouchableOpacity onPress={() => setViewerVisible(true)}><Image source={imageUrl ? { uri: imageUrl } : require('../assets/default_avatar.png')} style={styles.avatar} /></TouchableOpacity>
                    <Text style={styles.fullName}>{staffDetails.full_name}</Text>
                    {/* This correctly shows the specific admin type */}
                    <Text style={styles.role}>{displayRole}</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Personal Details</Text>
                    <DetailRow label="Username" value={staffDetails.username} />
                    <DetailRow label="Date of Birth" value={staffDetails.dob} />
                    <DetailRow label="Gender" value={staffDetails.gender} />
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Contact Details</Text>
                    <DetailRow label="Mobile No" value={staffDetails.phone} />
                    <DetailRow label="Email Address" value={staffDetails.email} />
                    <DetailRow label="Address" value={staffDetails.address} />
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Professional Details</Text>
                    <DetailRow label="Aadhar No." value={staffDetails.aadhar_no} />
                    <DetailRow label="Joining Date" value={staffDetails.joining_date} />
                    <DetailRow label="Previous Salary" value={staffDetails.previous_salary} />
                    <DetailRow label="Present Salary" value={staffDetails.present_salary} />
                    <DetailRow label="Experience" value={staffDetails.experience} />
                </View>

                {staffDetails.role === 'teacher' && (
                    <View style={styles.timetableCard}>
                        <TouchableOpacity
                            style={styles.collapsibleHeader}
                            onPress={handleTimetableToggle}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.collapsibleTitle}>Timetable</Text>
                            <Text style={styles.arrowIcon}>{isTimetableExpanded ? '▲' : '▼'}</Text>
                        </TouchableOpacity>
                        
                        {isTimetableExpanded && (
                            <TimetableScreen teacherId={staffId} isEmbedded={true} />
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f8', },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', },
    profileHeader: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 15, backgroundColor: '#008080', },
    avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: '#ffffff', marginBottom: 15, backgroundColor: '#bdc3c7', },
    fullName: { fontSize: 24, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' },
    role: { fontSize: 16, color: '#ecf0f1', marginTop: 5, backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 15, textTransform: 'capitalize', },
    card: { backgroundColor: '#ffffff', borderRadius: 8, marginHorizontal: 15, marginTop: 15, paddingHorizontal: 15, paddingBottom: 5, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#008080', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f2f5', marginBottom: 5, },
    detailRow: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f2f5', alignItems: 'center', },
    detailLabel: { fontSize: 15, color: '#7f8c8d', flex: 2, },
    detailValue: { fontSize: 15, color: '#2c3e50', flex: 3, fontWeight: '500', textAlign: 'right', },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', height: '70%', justifyContent: 'center', alignItems: 'center' },
    enlargedAvatar: { width: '100%', height: '100%', borderRadius: 10 },
    closeButton: { position: 'absolute', bottom: -20, backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 35, borderRadius: 25 },
    closeButtonText: { color: '#2c3e50', fontSize: 16, fontWeight: 'bold' },
    timetableCard: { backgroundColor: '#ffffff', borderRadius: 8, marginHorizontal: 15, marginTop: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, overflow: 'hidden', },
    collapsibleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f2f5', },
    collapsibleTitle: { fontSize: 18, fontWeight: 'bold', color: '#008080', },
    arrowIcon: { fontSize: 20, color: '#008080', },
});

export default StaffDetailScreen;