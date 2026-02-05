import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform, TextInput, Image } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { getProfileImageSource } from '../../utils/imageHelpers';
import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from '../../../apiConfig';

const THEME = { primary: '#008080', background: '#F2F5F8', text: '#212529', muted: '#86909c', border: '#dee2e6', white: '#ffffff', accent: '#28a745', cardBg: '#FFFFFF' };

const GroupListScreen = () => {
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const socketRef = useRef<Socket | null>(null);

    const fetchGroups = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);
        try {
            const response = await apiClient.get('/groups');
            setGroups(response.data);
        } catch (error: any) {
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

    const formatTimestamp = (timestamp: string) => {
        if (!timestamp) return '';
        // FIX: Ensure correct local time
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderGroupItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.groupItem} onPress={() => navigation.navigate('GroupChat', { group: item })}>
            <Image source={getProfileImageSource(item.group_dp_url)} style={styles.avatar} />
            <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{item.name}</Text>
                <Text style={styles.groupDesc} numberOfLines={1}>{item.last_message_text || "Tap to open chat"}</Text>
            </View>
            <View style={styles.metaInfo}>
                <Text style={styles.timestamp}>{formatTimestamp(item.last_message_timestamp)}</Text>
                {item.unread_count > 0 && (
                    <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{item.unread_count}</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return <ActivityIndicator size="large" color={THEME.primary} style={styles.loader} />;
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header Card */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="forum" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Groups</Text>
                        <Text style={styles.headerSubtitle}>Discussions</Text>
                    </View>
                </View>
            </View>

            <View style={styles.searchContainer}>
                <Icon name="magnify" size={20} color={THEME.muted} />
                <TextInput style={styles.searchInput} placeholder="Search groups..." value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor={THEME.muted} />
            </View>

            <FlatList
                data={filteredGroups}
                renderItem={renderGroupItem}
                keyExtractor={(item) => item.id.toString()}
                ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No groups found.</Text></View>}
                contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 10 }}
            />
            {(user?.role === 'admin' || user?.role === 'teacher') && (
                <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateGroup')}>
                    <Icon name="plus" size={30} color={THEME.white} />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Header Card
    headerCard: {
        backgroundColor: THEME.cardBg,
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '95%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        backgroundColor: '#E0F2F1', // Teal bg
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: THEME.text },
    headerSubtitle: { fontSize: 13, color: THEME.muted },

    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, marginHorizontal: 15, paddingHorizontal: 10, marginBottom: 10, borderWidth: 1, borderColor: THEME.border, height: 45 },
    searchInput: { flex: 1, height: 40, fontSize: 16, marginLeft: 8, color: THEME.text },
    
    groupItem: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: THEME.white, marginBottom: 10, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e9ecef', marginRight: 15 },
    groupInfo: { flex: 1 },
    groupName: { fontSize: 16, fontWeight: '600', color: THEME.text },
    groupDesc: { fontSize: 14, color: THEME.muted, marginTop: 2 },
    metaInfo: { alignItems: 'flex-end' },
    timestamp: { fontSize: 12, color: THEME.muted, marginBottom: 4 },
    unreadBadge: { backgroundColor: THEME.accent, borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
    unreadText: { color: THEME.white, fontWeight: 'bold', fontSize: 12 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
    emptyText: { textAlign: 'center', fontSize: 16, color: THEME.muted },
    fab: { position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: THEME.primary, justifyContent: 'center', alignItems: 'center', elevation: 8 },
});

export default GroupListScreen;