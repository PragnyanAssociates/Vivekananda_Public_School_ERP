import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, Image, RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../api/client';
// ★★★ STEP 1: Import SERVER_URL from your config file ★★★
import { SERVER_URL } from '../../apiConfig'; // Adjust this path if necessary

const StaffListScreen = ({ navigation }) => {
    const [admins, setAdmins] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadStaffData = async () => {
        try {
            const response = await apiClient.get('/staff/all');
            setAdmins(response.data.admins || []);
            setTeachers(response.data.teachers || []);
        } catch (error) {
            console.error('Error fetching staff list:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
      useCallback(() => {
        if (admins.length === 0 && teachers.length === 0) {
            setLoading(true);
        }
        loadStaffData();
      }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadStaffData();
    };

    const StaffMember = ({ item }) => {
        // ★★★ STEP 2: Construct the full image URL ★★★
        const imageUrl = item.profile_image_url
            ? `${SERVER_URL}${item.profile_image_url.startsWith('/') ? '' : '/'}${item.profile_image_url}`
            : null;

        return (
            <TouchableOpacity
                style={styles.staffMemberContainer}
                onPress={() => navigation.navigate('StaffDetail', { staffId: item.id })}
            >
                <Image
                    // ★★★ STEP 3: Use the constructed URL or the default avatar ★★★
                    source={
                        imageUrl
                            ? { uri: imageUrl }
                            : require('../assets/default_avatar.png')
                    }
                    style={styles.avatar}
                />
                <Text style={styles.staffName} numberOfLines={2}>
                    {item.full_name}
                </Text>
            </TouchableOpacity>
        );
    };

    const StaffSection = ({ title, data }) => (
        <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {data.length > 0 ? (
                <View style={styles.staffGrid}>
                    {data.map(item => (
                        <StaffMember key={item.id} item={item} />
                    ))}
                </View>
            ) : (
                <Text style={styles.noDataText}>No staff found in this category.</Text>
            )}
        </View>
    );

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#34495e" /></View>;
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <StaffSection title="Admin" data={admins} />
            <StaffSection title="Teachers" data={teachers} />
        </ScrollView>
    );
};

// Styles remain the same
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
    sectionContainer: {
        margin: 15,
        marginBottom: 5,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 15,
        paddingBottom: 5,
        borderBottomWidth: 2,
        borderBottomColor: '#dfe4ea',
    },
    staffGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    staffMemberContainer: {
        width: '25%',
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 5,
    },
    avatar: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#bdc3c7',
        borderWidth: 2,
        borderColor: '#ffffff',
    },
    staffName: {
        marginTop: 8,
        fontSize: 12,
        fontWeight: '500',
        color: '#34495e',
        textAlign: 'center',
    },
    noDataText: {
        fontSize: 14,
        color: '#7f8c8d',
        textAlign: 'center',
        marginTop: 10,
    },
});

export default StaffListScreen;