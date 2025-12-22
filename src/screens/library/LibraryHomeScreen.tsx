import React, { useState } from 'react';
import { 
    View, Text, StyleSheet, TouchableOpacity, FlatList, 
    Image, RefreshControl 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

// IMPORT YOUR AUTH HOOK
import { useAuth } from '../../context/AuthContext'; 

const LibraryHomeScreen = () => {
    const navigation = useNavigation();
    
    // 1. GET USER DIRECTLY FROM CONTEXT
    const { user } = useAuth(); 
    
    const [refreshing, setRefreshing] = useState(false);

    // 2. Determine Role safely
    const role = user?.role || 'student';
    const userName = user?.full_name || user?.username || 'User';

    // 3. Refresh Logic (Just simulates a refresh since stats are removed)
    const onRefresh = () => {
        setRefreshing(true);
        setTimeout(() => {
            setRefreshing(false);
        }, 1000);
    };

    const getFeatures = () => {
        const commonModules = [
            { id: '1', title: 'Search Books', icon: 'https://cdn-icons-png.flaticon.com/128/6983/6983319.png', screen: 'BookListScreen' },
            { id: '2', title: 'Issued Books', icon: 'https://cdn-icons-png.flaticon.com/128/9436/9436168.png', screen: 'MyIssuedBooksScreen' },
            { id: '3', title: 'Digital Library', icon: 'https://cdn-icons-png.flaticon.com/128/2997/2997608.png', screen: 'DigitalLibraryScreen' },
        ];

        const adminModules = [
            { id: '4', title: 'Issue/Return', icon: 'https://cdn-icons-png.flaticon.com/128/12463/12463307.png', screen: 'LibraryHistoryScreen' },
            { id: '5', title: 'Action Center', icon: 'https://cdn-icons-png.flaticon.com/128/1484/1484584.png', screen: 'AdminActionScreen' },
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
            {/* Stats Container Removed */}
        </View>
    );

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
    header: { 
        padding: 24, 
        backgroundColor: '#FFF', 
        elevation: 2, 
        marginBottom: 10, 
        borderBottomLeftRadius: 20, 
        borderBottomRightRadius: 20 
    },
    headerTitle: { fontSize: 26, fontWeight: '800', color: '#1E293B' },
    subHeader: { fontSize: 15, color: '#64748B', marginTop: 4 },
    
    // Card Styles
    card: { 
        flex: 1, 
        margin: 8, 
        height: 130, 
        backgroundColor: '#FFF', 
        borderRadius: 16, 
        alignItems: 'center', 
        justifyContent: 'center', 
        elevation: 3, 
        shadowColor: '#000', 
        shadowOpacity: 0.05, 
        shadowRadius: 4 
    },
    icon: { width: 48, height: 48, marginBottom: 12 },
    cardText: { fontSize: 14, fontWeight: '600', color: '#475569' }
});

export default LibraryHomeScreen;