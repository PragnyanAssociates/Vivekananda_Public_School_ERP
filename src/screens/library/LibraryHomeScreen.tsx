import React, { useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    FlatList, 
    Image, 
    RefreshControl,
    Platform,
    UIManager,
    SafeAreaView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons'; // Import Vector Icons

// IMPORT YOUR AUTH HOOK
import { useAuth } from '../../context/AuthContext'; 

// Enable Layout Animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LibraryHomeScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth(); 
    const [refreshing, setRefreshing] = useState(false);

    // Determine Role & Name safely
    const role = user?.role || 'student';
    const userName = user?.full_name || user?.username || 'User';

    const onRefresh = () => {
        setRefreshing(true);
        setTimeout(() => {
            setRefreshing(false);
        }, 1000);
    };

    const getFeatures = () => {
        const commonModules = [
            { id: '1', title: 'Search Books', icon: 'https://cdn-icons-png.flaticon.com/128/6983/6983319.png', screen: 'BookListScreen' },
            { id: '2', title: 'My Books', icon: 'https://cdn-icons-png.flaticon.com/128/9436/9436168.png', screen: 'MyBooksScreen' },
            { id: '3', title: 'Digital Library', icon: 'https://cdn-icons-png.flaticon.com/128/2997/2997608.png', screen: 'DigitalLibraryScreen' },
        ];

        const adminModules = [
            { id: '4', title: 'Issue/Return', icon: 'https://cdn-icons-png.flaticon.com/128/12463/12463307.png', screen: 'LibraryHistoryScreen' },
            { id: '5', title: 'Action Center', icon: 'https://cdn-icons-png.flaticon.com/128/1484/1484584.png', screen: 'AdminActionScreen' },
        ];

        if (role === 'admin') {
            return [...commonModules, ...adminModules];
        }
        return commonModules;
    };

    // New Header Component (Matches AccountsScreen)
    const renderHeader = () => (
        <View style={styles.headerCard}>
            <View style={styles.headerIconContainer}>
                {/* Library Icon */}
                <Icon name="local-library" size={28} color="#008080" />
            </View>
            <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Library Hub</Text>
                <Text style={styles.headerSubtitle}>Welcome, {userName}</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                ListHeaderComponent={renderHeader}
                data={getFeatures()}
                keyExtractor={item => item.id}
                numColumns={2}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        style={styles.card} 
                        onPress={() => navigation.navigate(item.screen as never)}
                        activeOpacity={0.8}
                    >
                        <View style={styles.imageContainer}>
                            <Image source={{ uri: item.icon }} style={styles.cardImage} resizeMode="contain" />
                        </View>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                    </TouchableOpacity>
                )}
                contentContainerStyle={styles.gridContainer}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#F2F5F8' // Light Blue-Grey Background
    },
    
    // --- HEADER STYLES ---
    headerCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 15,
        paddingVertical: 10, // Compact height
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        // Shadow
        elevation: 3,
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerIconContainer: {
        backgroundColor: '#E0F2F1', // Light Teal Circle
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: {
        justifyContent: 'center',
        flex: 1, // Ensure text takes available space
    },
    headerTitle: {
        fontSize: 22, // Large Title
        fontWeight: 'bold',
        color: '#333333',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666666',
        marginTop: 1,
    },

    // --- GRID STYLES ---
    gridContainer: {
        paddingHorizontal: 8,
        paddingBottom: 50,
    },
    card: { 
        flex: 1, 
        margin: 6, // Consistent spacing
        height: 150, 
        backgroundColor: '#FFF', 
        borderRadius: 16, 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: 10,
        // Shadow
        elevation: 3, 
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    imageContainer: {
        marginBottom: 15,
        padding: 10,
        backgroundColor: '#F7FAFC', // Subtle circle bg for icon
        borderRadius: 50,
    },
    cardImage: { 
        width: 50, 
        height: 50, 
    },
    cardTitle: { 
        fontSize: 15, 
        fontWeight: '600', 
        color: '#2D3748',
        textAlign: 'center'
    }
});

export default LibraryHomeScreen;