import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const THEME = { primary: '#007bff', background: '#f4f7fc', text: '#212529', muted: '#86909c', border: '#dee2e6', white: '#ffffff' };

const GroupListScreen = () => {
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);

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
    
    useFocusEffect(
        useCallback(() => {
            if (user) {
                setLoading(true);
                fetchGroups();
            }
        }, [user])
    );

    const renderGroupItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.groupItem} onPress={() => navigation.navigate('GroupChat', { group: item })}>
            <View style={styles.avatar}>
                <Icon name="account-group" size={28} color={THEME.primary} />
            </View>
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
            </View>
            <FlatList
                data={groups}
                renderItem={renderGroupItem}
                keyExtractor={(item) => item.id.toString()}
                ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>You are not in any groups yet.</Text></View>}
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
    header: { paddingTop: Platform.OS === 'android' ? 15 : 0, paddingBottom: 15, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: THEME.border, alignItems: 'center', backgroundColor: THEME.white },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: THEME.text },
    groupItem: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: THEME.white, borderBottomWidth: 1, borderBottomColor: THEME.border },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e9ecef', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    groupInfo: { flex: 1 },
    groupName: { fontSize: 18, fontWeight: '600', color: THEME.text },
    groupDesc: { fontSize: 14, color: THEME.muted, marginTop: 2 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { textAlign: 'center', fontSize: 16, color: THEME.muted },
    fab: { position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: THEME.primary, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
});

export default GroupListScreen;