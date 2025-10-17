import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform, TextInput, Image } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getProfileImageSource } from '../../utils/imageHelpers'; // <-- IMPORT THE HELPER

const THEME = { primary: '#007bff', background: '#f4f7fc', text: '#212529', muted: '#86909c', border: '#dee2e6', white: '#ffffff' };

const GroupListScreen = () => {
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchGroups = async () => {
        try {
            const response = await apiClient.get('/groups');
            setGroups(response.data);
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Could not fetch groups.");
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => {
        if (user) {
            setLoading(true);
            fetchGroups();
        }
    }, [user]));

    const filteredGroups = useMemo(() =>
        groups.filter(group => group.name.toLowerCase().includes(searchQuery.toLowerCase())),
        [groups, searchQuery]
    );

    const renderGroupItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.groupItem} onPress={() => navigation.navigate('GroupChat', { group: item })}>
            <Image
                source={getProfileImageSource(item.group_dp_url)} // <-- USE THE HELPER
                style={styles.avatar}
            />
            <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{item.name}</Text>
                <Text style={styles.groupDesc} numberOfLines={1}>{item.description || "Tap to open chat"}</Text>
            </View>
            <Icon name="chevron-right" size={24} color={THEME.muted} />
        </TouchableOpacity>
    );

    if (loading) {
        return <ActivityIndicator size="large" color={THEME.primary} style={styles.loader} />;
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Groups</Text>
                <View style={styles.searchContainer}>
                    <Icon name="magnify" size={20} color={THEME.muted} />
                    <TextInput style={styles.searchInput} placeholder="Search groups..." value={searchQuery} onChangeText={setSearchQuery} />
                </View>
            </View>
            <FlatList
                data={filteredGroups}
                renderItem={renderGroupItem}
                keyExtractor={(item) => item.id.toString()}
                ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No groups found.</Text></View>}
                contentContainerStyle={{ flexGrow: 1 }}
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
    header: { paddingTop: Platform.OS === 'android' ? 15 : 0, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: THEME.border, backgroundColor: THEME.white },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: THEME.text, marginBottom: 10 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 10, paddingHorizontal: 10, marginBottom: 10 },
    searchInput: { flex: 1, height: 40, fontSize: 16, marginLeft: 8, color: THEME.text },
    groupItem: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: THEME.white, borderBottomWidth: 1, borderBottomColor: THEME.border },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e9ecef', marginRight: 15 },
    groupInfo: { flex: 1 },
    groupName: { fontSize: 18, fontWeight: '600', color: THEME.text },
    groupDesc: { fontSize: 14, color: THEME.muted, marginTop: 2 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
    emptyText: { textAlign: 'center', fontSize: 16, color: THEME.muted },
    fab: { position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: THEME.primary, justifyContent: 'center', alignItems: 'center', elevation: 8 },
});

export default GroupListScreen;