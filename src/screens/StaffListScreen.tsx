import React, { useState, useCallback, useLayoutEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, Image, RefreshControl, SafeAreaView, Platform, UIManager,
    TextInput, useColorScheme, StatusBar, Dimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons'; 
import apiClient from '../api/client';
import { SERVER_URL } from '../../apiConfig';

// Enable Layout Animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

// --- THEME DEFINITIONS ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    inputBg: '#FFFFFF',
    headerIconBg: '#E0F2F1',
    sectionTitle: '#008080',
    line: '#D1D5DB'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    headerIconBg: '#333333',
    sectionTitle: '#80CBC4',
    line: '#444444'
};

const StaffListScreen = ({ navigation }) => {
    // Theme Hook
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const [allStaff, setAllStaff] = useState({
        management: [],
        general: [],
        teachers: [],
        others: []
    });
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchText, setSearchText] = useState('');

    // --- HIDE DEFAULT HEADER ---
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const loadStaffData = async () => {
        try {
            const response = await apiClient.get('/staff/all');
            const allAdmins = response.data.admins || [];
            
            setAllStaff({
                management: allAdmins.filter(admin => admin.class_group === 'Management Admin'),
                general: allAdmins.filter(admin => admin.class_group === 'General Admin'),
                teachers: response.data.teachers || [],
                others: response.data.others || []
            });

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

    // --- Filter Logic ---
    const getFilteredData = (dataList) => {
        if (!searchText) return dataList;
        return dataList.filter(item => 
            item.full_name.toLowerCase().includes(searchText.toLowerCase())
        );
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
                <View style={[styles.avatarContainer, { backgroundColor: COLORS.cardBg }]}>
                    <Image
                        source={
                            imageUrl
                                ? { uri: imageUrl }
                                : require('../assets/default_avatar.png')
                        }
                        style={[styles.avatar, { backgroundColor: isDark ? '#333' : '#ECF0F1' }]}
                        fadeDuration={0} // Load instantly
                    />
                </View>
                <Text 
                    style={[styles.staffName, { color: COLORS.textMain }]} 
                    numberOfLines={1} 
                    adjustsFontSizeToFit={true} 
                    minimumFontScale={0.8}
                >
                    {item.full_name}
                </Text>
            </TouchableOpacity>
        );
    };

    const StaffSection = ({ title, data }) => {
        const filteredData = getFilteredData(data);

        if (!filteredData || filteredData.length === 0) {
            return null;
        }

        return (
            <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: COLORS.sectionTitle }]}>{title}</Text>
                    <View style={[styles.sectionLine, { backgroundColor: COLORS.line }]} />
                </View>
                <View style={styles.staffGrid}>
                    {filteredData.map(item => (
                        <StaffMember key={item.id} item={item} />
                    ))}
                </View>
            </View>
        );
    };

    if (loading) {
        return <View style={[styles.loaderContainer, { backgroundColor: COLORS.background }]}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
            
            {/* Header Card */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#000' }]}>
                <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                    <Icon name="assignment-ind" size={28} color={COLORS.primary} />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Staff Directory</Text>
                    <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Faculty & Management</Text>
                </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={[styles.searchWrapper, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                    <Icon name="search" size={20} color={COLORS.textSub} style={{marginRight: 8}} />
                    <TextInput
                        style={[styles.searchInput, { color: COLORS.textMain }]}
                        placeholder="Search Staff Name..."
                        placeholderTextColor={COLORS.textSub}
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchText('')}>
                            <Icon name="close" size={20} color={COLORS.textSub} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                showsVerticalScrollIndicator={false}
            >
                <StaffSection title="Management" data={allStaff.management} />
                <StaffSection title="General Admins" data={allStaff.general} />
                <StaffSection title="Teachers" data={allStaff.teachers} />
                <StaffSection title="Non-Teaching" data={allStaff.others} />

                {/* Empty State for Search */}
                {searchText.length > 0 && 
                 getFilteredData(allStaff.management).length === 0 &&
                 getFilteredData(allStaff.general).length === 0 &&
                 getFilteredData(allStaff.teachers).length === 0 &&
                 getFilteredData(allStaff.others).length === 0 && (
                    <View style={styles.emptyContainer}>
                        <Icon name="person-search" size={60} color={COLORS.border} />
                        <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No staff found matching "{searchText}"</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
    },

    // --- Header Card Style ---
    headerCard: {
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
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    headerIconContainer: {
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
    },
    headerSubtitle: {
        fontSize: 14,
        marginTop: 1,
    },

    // --- Search Styles ---
    searchContainer: {
        paddingHorizontal: 15,
        marginBottom: 10,
        marginTop: 5
    },
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 45,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
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
    },
    sectionLine: {
        flex: 1,
        height: 1,
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
    },
    staffName: {
        marginTop: 8,
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
        paddingHorizontal: 2,
        width: '100%',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 50,
    },
    emptyText: {
        fontSize: 16,
        marginTop: 10,
        fontWeight: '500',
    }
});

export default StaffListScreen;