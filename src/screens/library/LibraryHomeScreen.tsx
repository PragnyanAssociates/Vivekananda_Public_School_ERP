import React, { useEffect, useState, useCallback } from 'react';
import { 
    View, Text, StyleSheet, TouchableOpacity, FlatList, 
    Image, ActivityIndicator, RefreshControl 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client'; 

// IMPORT YOUR AUTH HOOK (Adjust the path if your context file is in a different folder)
import { useAuth } from '../../context/AuthContext'; 

const LibraryHomeScreen = () => {
    const navigation = useNavigation();
    
    // 1. GET USER DIRECTLY FROM CONTEXT (The Fix)
    const { user } = useAuth(); 
    
    const [stats, setStats] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(false);

    // 2. Determine Role safely
    const role = user?.role || 'student';
    const userName = user?.full_name || user?.username || 'User';

    // 3. Fetch Stats if Admin
    const fetchStats = useCallback(async () => {
        if (role !== 'admin') return;
        
        try {
            const res = await apiClient.get('/library/stats');
            setStats(res.data);
        } catch (e) { 
            console.log("Stats Error:", e); 
        }
    }, [role]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const onRefresh = async () => {
        setRefreshing(true);
        if (role === 'admin') await fetchStats();
        setRefreshing(false);
    };

    const getFeatures = () => {
        const commonModules = [
            { id: '1', title: 'Search Books', icon: 'https://cdn-icons-png.flaticon.com/128/6983/6983319.png', screen: 'BookListScreen' },
            { id: '2', title: 'Issued Books', icon: 'https://cdn-icons-png.flaticon.com/128/2232/2232696.png', screen: 'MyIssuedBooksScreen' },
            { id: '3', title: 'Digital Library', icon: 'https://cdn-icons-png.flaticon.com/128/2997/2997608.png', screen: 'DigitalLibraryScreen' },
        ];

        const adminModules = [
            { id: '4', title: 'Issue/Return', icon: 'https://cdn-icons-png.flaticon.com/128/9562/9562689.png', screen: 'IssueBookScreen' },
            { id: '5', title: 'Add Books', icon: 'https://cdn-icons-png.flaticon.com/128/4683/4683468.png', screen: 'AddBookScreen' },
            { id: '6', title: 'Reports', icon: 'https://cdn-icons-png.flaticon.com/128/2835/2835532.png', screen: 'LibraryReportsScreen' },
        ];

        // LOGIC: Use the context role
        if (role === 'admin') {
            return [...commonModules, ...adminModules];
        }
        return commonModules;
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <View>
                <Text style={styles.headerTitle}>📚 Library Hub</Text>
                <Text style={styles.subHeader}>
                    Welcome, {userName}
                </Text>
            </View>
            
            {role === 'admin' && stats && (
                <View style={styles.statsContainer}>
                    <View style={styles.statBox}>
                        <Text style={styles.statNum}>{stats.issued_now || 0}</Text>
                        <Text style={styles.statLabel}>Issued</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statNum, {color:'red'}]}>{stats.overdue || 0}</Text>
                        <Text style={styles.statLabel}>Overdue</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statNum}>{stats.reservations || 0}</Text>
                        <Text style={styles.statLabel}>Pending</Text>
                    </View>
                </View>
            )}
        </View>
    );

    if (loading) return <ActivityIndicator size="large" color="#2563EB" style={{flex:1, justifyContent:'center'}} />;

    return (
        <View style={styles.container}>
            <FlatList
                ListHeaderComponent={renderHeader}
                data={getFeatures()}
                keyExtractor={item => item.id}
                numColumns={2}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate(item.screen)}>
                        <Image source={{ uri: item.icon }} style={styles.icon} resizeMode="contain" />
                        <Text style={styles.cardText}>{item.title}</Text>
                    </TouchableOpacity>
                )}
                contentContainerStyle={{ padding: 12, paddingBottom: 50 }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { padding: 20, backgroundColor: '#FFF', elevation: 2, marginBottom: 10, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1E293B' },
    subHeader: { fontSize: 14, color: '#64748B', marginTop: 4 },
    statsContainer: { flexDirection: 'row', marginTop: 20, justifyContent: 'space-between' },
    statBox: { alignItems: 'center', backgroundColor: '#F1F5F9', padding: 10, borderRadius: 8, width: '30%' },
    statNum: { fontSize: 18, fontWeight: 'bold', color: '#334155' },
    statLabel: { fontSize: 12, color: '#64748B' },
    card: { flex: 1, margin: 8, height: 130, backgroundColor: '#FFF', borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
    icon: { width: 48, height: 48, marginBottom: 12 },
    cardText: { fontSize: 14, fontWeight: '600', color: '#475569' }
});

export default LibraryHomeScreen;