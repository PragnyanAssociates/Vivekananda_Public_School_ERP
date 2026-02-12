/**
 * File: src/screens/chat/GroupListScreen.js
 * Purpose: Display a list of chat groups the user belongs to.
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI.
 */
import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { 
    View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, 
    ActivityIndicator, Alert, TextInput, Image, Dimensions, 
    useColorScheme, StatusBar 
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { getProfileImageSource } from '../../utils/imageHelpers';
import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from '../../../apiConfig';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#cbd5e1',
    inputBg: '#f0f2f5',
    inputBorder: '#cbd5e1',
    iconBg: '#E0F2F1',
    textPlaceholder: '#94a3b8',
    white: '#ffffff',
    accent: '#28a745'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    inputBorder: '#555555',
    iconBg: '#333333',
    textPlaceholder: '#64748b',
    white: '#E0E0E0',
    accent: '#28a745'
};

const GroupListScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const { user } = useAuth();
    const navigation = useNavigation();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const socketRef = useRef(null);

    const fetchGroups = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);
        try {
            const response = await apiClient.get('/groups');
            setGroups(response.data);
        } catch (error) {
            Alert.alert("Error", error.response?.data?.message || "Could not fetch groups.");
        } finally {
            if (showLoader) setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        if (user) {
            fetchGroups(true);
        }
    }, [user, fetchGroups]));

    useEffect(() => {
        if (!user) return;
        socketRef.current = io(SERVER_URL, { transports: ['websocket'] });
        socketRef.current.on('updateGroupList', () => { fetchGroups(false); });
        return () => { socketRef.current?.disconnect(); };
    }, [user, fetchGroups]);

    const filteredGroups = useMemo(() =>
        groups.filter(group => group.name.toLowerCase().includes(searchQuery.toLowerCase())),
        [groups, searchQuery]
    );

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderGroupItem = ({ item }) => (
        <TouchableOpacity 
            style={[styles.groupItem, { backgroundColor: theme.cardBg, borderColor: theme.border }]} 
            onPress={() => navigation.navigate('GroupChat', { group: item })}
        >
            <Image source={getProfileImageSource(item.group_dp_url)} style={styles.avatar} />
            <View style={styles.groupInfo}>
                <Text style={[styles.groupName, { color: theme.textMain }]}>{item.name}</Text>
                <Text style={[styles.groupDesc, { color: theme.textSub }]} numberOfLines={1}>
                    {item.last_message_text || "Tap to open chat"}
                </Text>
            </View>
            <View style={styles.metaInfo}>
                <Text style={[styles.timestamp, { color: theme.textSub }]}>{formatTimestamp(item.last_message_timestamp)}</Text>
                {item.unread_count > 0 && (
                    <View style={[styles.unreadBadge, { backgroundColor: theme.accent }]}>
                        <Text style={[styles.unreadText, { color: '#ffffff' }]}>{item.unread_count}</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={[styles.loaderContainer, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            
            {/* Header Card */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialIcons name="forum" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Groups</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Discussions</Text>
                    </View>
                </View>

                {/* ADD BUTTON PLACED HERE INSIDE HEADER */}
                {(user?.role === 'admin' || user?.role === 'teacher') && (
                    <TouchableOpacity 
                        style={[styles.headerAddButton, { backgroundColor: theme.primary }]} 
                        onPress={() => navigation.navigate('CreateGroup')}
                    >
                        <Icon name="plus" size={20} color="#ffffff" />
                        <Text style={[styles.headerAddButtonText, { color: '#ffffff' }]}>Add</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                <Icon name="magnify" size={20} color={theme.textPlaceholder} />
                <TextInput 
                    style={[styles.searchInput, { color: theme.textMain }]} 
                    placeholder="Search groups..." 
                    value={searchQuery} 
                    onChangeText={setSearchQuery} 
                    placeholderTextColor={theme.textPlaceholder} 
                />
            </View>

            {/* Group List */}
            <FlatList
                data={filteredGroups}
                renderItem={renderGroupItem}
                keyExtractor={(item) => item.id.toString()}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={[styles.emptyText, { color: theme.textSub }]}>No groups found.</Text>
                    </View>
                }
                contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 15, paddingBottom: 20 }}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Header Card
    headerCard: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 15,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 3,
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },

    // Header Add Button
    headerAddButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20, 
    },
    headerAddButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 4,
    },

    // Search Bar
    searchContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        borderRadius: 10, 
        marginHorizontal: 15, 
        paddingHorizontal: 10, 
        marginBottom: 15, 
        borderWidth: 1, 
        height: 45 
    },
    searchInput: { 
        flex: 1, 
        height: 45, 
        fontSize: 16, 
        marginLeft: 8 
    },
    
    // List Items
    groupItem: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 15, 
        marginBottom: 10, 
        borderRadius: 12, 
        elevation: 2, 
        shadowColor: '#000', 
        shadowOpacity: 0.05, 
        shadowRadius: 3,
        borderWidth: 1 
    },
    avatar: { 
        width: 50, 
        height: 50, 
        borderRadius: 25, 
        backgroundColor: '#e9ecef', 
        marginRight: 15 
    },
    groupInfo: { flex: 1 },
    groupName: { fontSize: 16, fontWeight: '600' },
    groupDesc: { fontSize: 14, marginTop: 2 },
    metaInfo: { alignItems: 'flex-end' },
    timestamp: { fontSize: 12, marginBottom: 4 },
    unreadBadge: { 
        borderRadius: 12, 
        minWidth: 24, 
        height: 24, 
        justifyContent: 'center', 
        alignItems: 'center', 
        paddingHorizontal: 5 
    },
    unreadText: { fontWeight: 'bold', fontSize: 12 },
    
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
    emptyText: { textAlign: 'center', fontSize: 16 },
});

export default GroupListScreen;