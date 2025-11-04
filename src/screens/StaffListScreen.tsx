import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, Image, RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../api/client';
import { SERVER_URL } from '../../apiConfig';

const StaffListScreen = ({ navigation }) => {
    const [admins, setAdmins] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [others, setOthers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadStaffData = async () => {
        try {
            const response = await apiClient.get('/staff/all');
            setAdmins(response.data.admins || []);
            setTeachers(response.data.teachers || []);
            setOthers(response.data.others || []);
        } catch (error) {
            console.error('Error fetching staff list:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
      useCallback(() => {
        if (admins.length === 0 && teachers.length === 0 && others.length === 0) {
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
        const imageUrl = item.profile_image_url
            ? `${SERVER_URL}${item.profile_image_url.startsWith('/') ? '' : '/'}${item.profile_image_url}`
            : null;

        return (
            <TouchableOpacity
                style={styles.staffMemberContainer}
                onPress={() => navigation.navigate('StaffDetail', { staffId: item.id })}
            >
                <Image
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

    const StaffSection = ({ title, data }) => {
        // This check ensures that a section is only rendered if it has data.
        if (!data || data.length === 0) {
            return null;
        }

        return (
            <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>{title}</Text>
                <View style={styles.staffGrid}>
                    {data.map(item => (
                        <StaffMember key={item.id} item={item} />
                    ))}
                </View>
            </View>
        );
    };

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
            <StaffSection title="Others" data={others} />
        </ScrollView>
    );
};

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