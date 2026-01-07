import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, Image, RefreshControl, SafeAreaView, Platform, UIManager
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons'; 
import apiClient from '../api/client';
import { SERVER_URL } from '../../apiConfig';

// Enable Layout Animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const StaffListScreen = ({ navigation }) => {
    const [managementAdmins, setManagementAdmins] = useState([]);
    const [generalAdmins, setGeneralAdmins] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [others, setOthers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // --- HIDE DEFAULT HEADER ---
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const loadStaffData = async () => {
        try {
            const response = await apiClient.get('/staff/all');
            const allAdmins = response.data.admins || [];
            
            setManagementAdmins(allAdmins.filter(admin => admin.class_group === 'Management Admin'));
            setGeneralAdmins(allAdmins.filter(admin => admin.class_group === 'General Admin'));

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
        setLoading(true);
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
                <View style={styles.avatarContainer}>
                    <Image
                        source={
                            imageUrl
                                ? { uri: imageUrl }
                                : require('../assets/default_avatar.png')
                        }
                        style={styles.avatar}
                        fadeDuration={0} // Load instantly
                    />
                </View>
                {/* MODIFIED: Forced single line and reduced size */}
                <Text 
                    style={styles.staffName} 
                    numberOfLines={1} 
                    adjustsFontSizeToFit={true} // Shrinks text to fit on iOS
                    minimumFontScale={0.8} // Minimum shrink scale
                >
                    {item.full_name}
                </Text>
            </TouchableOpacity>
        );
    };

    const StaffSection = ({ title, data }) => {
        if (!data || data.length === 0) {
            return null;
        }

        return (
            <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{title}</Text>
                    <View style={styles.sectionLine} />
                </View>
                <View style={styles.staffGrid}>
                    {data.map(item => (
                        <StaffMember key={item.id} item={item} />
                    ))}
                </View>
            </View>
        );
    };

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#008080" /></View>;
    }

    return (
        <SafeAreaView style={styles.container}>
            
            {/* Header Card */}
            <View style={styles.headerCard}>
                <View style={styles.headerIconContainer}>
                    <Icon name="assignment-ind" size={28} color="#008080" />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>Staff Directory</Text>
                    <Text style={styles.headerSubtitle}>Faculty & Management</Text>
                </View>
            </View>

            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#008080']} />}
                showsVerticalScrollIndicator={false}
            >
                <StaffSection title="Management" data={managementAdmins} />
                <StaffSection title="General Admins" data={generalAdmins} />
                <StaffSection title="Teachers" data={teachers} />
                <StaffSection title="Non-Teaching" data={others} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F5F8', 
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F2F5F8',
    },

    // --- Header Card Style ---
    headerCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 15,
        paddingVertical: 10,
        width: '96%',
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 5,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    headerIconContainer: {
        backgroundColor: '#E0F2F1',
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: {
        justifyContent: 'center',
        flex: 1,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333333',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666666',
        marginTop: 1,
    },

    // --- Sections ---
    sectionContainer: {
        marginTop: 15,
        marginBottom: 5,
        paddingHorizontal: 10,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        paddingHorizontal: 5,
    },
    sectionTitle: {
        fontSize: 19,
        fontWeight: 'bold',
        color: '#008080', 
    },
    sectionLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#D1D5DB',
        marginLeft: 15,
        opacity: 0.5
    },
    staffGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    staffMemberContainer: {
        width: '25%', // 4 columns
        alignItems: 'center',
        marginBottom: 20,
    },
    avatarContainer: {
        elevation: 3,
        backgroundColor: '#FFF',
        borderRadius: 35,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 2 },
    },
    avatar: {
        width: 65,
        height: 65,
        borderRadius: 32.5,
        backgroundColor: '#ECF0F1',
    },
    staffName: {
        marginTop: 8,
        fontSize: 11, // Reduced font size
        fontWeight: '600',
        color: '#34495e',
        textAlign: 'center',
        paddingHorizontal: 2,
        width: '100%', // Ensure it takes full width of container
    },
});

export default StaffListScreen;