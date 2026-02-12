/**
 * File: src/screens/library/LibraryHomeScreen.js
 * Purpose: Library Hub Main Menu.
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI.
 */
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
    SafeAreaView,
    useColorScheme,
    StatusBar,
    Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons'; 

// IMPORT YOUR AUTH HOOK
import { useAuth } from '../../context/AuthContext'; 

// Enable Layout Animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#333333',
    textSub: '#666666',
    border: '#cbd5e1',
    iconBg: '#E0F2F1', // Light Teal Circle for header
    iconContainerBg: '#F7FAFC', // Subtle circle bg for card icons
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    iconBg: '#333333', // Darker circle for header
    iconContainerBg: '#2C2C2C', // Darker circle bg for card icons
};

const LibraryHomeScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

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

    // New Header Component
    const renderHeader = () => (
        <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
            <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                {/* Library Icon */}
                <Icon name="local-library" size={28} color={theme.primary} />
            </View>
            <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: theme.textMain }]}>Library Hub</Text>
                <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Welcome, {userName}</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            
            <FlatList
                ListHeaderComponent={renderHeader}
                data={getFeatures()}
                keyExtractor={item => item.id}
                numColumns={2}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        style={[styles.card, { backgroundColor: theme.cardBg, shadowColor: theme.border }]} 
                        onPress={() => navigation.navigate(item.screen)}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.imageContainer, { backgroundColor: theme.iconContainerBg }]}>
                            <Image source={{ uri: item.icon }} style={styles.cardImage} resizeMode="contain" />
                        </View>
                        <Text style={[styles.cardTitle, { color: theme.textMain }]}>{item.title}</Text>
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
    },
    
    // --- HEADER STYLES ---
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
        // Shadow
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
        fontSize: 20, 
        fontWeight: 'bold',
    },
    headerSubtitle: {
        fontSize: 13,
        marginTop: 2,
    },

    // --- GRID STYLES ---
    gridContainer: {
        paddingHorizontal: 10, // Adjusted for edge-to-edge balance
        paddingBottom: 50,
    },
    card: { 
        flex: 1, 
        margin: 6, // Provides even spacing between columns and rows
        height: 150, 
        borderRadius: 16, 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: 10,
        // Shadow
        elevation: 3, 
        shadowOpacity: 0.1, 
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    imageContainer: {
        marginBottom: 15,
        padding: 12,
        borderRadius: 50,
    },
    cardImage: { 
        width: 45, 
        height: 45, 
    },
    cardTitle: { 
        fontSize: 15, 
        fontWeight: '600', 
        textAlign: 'center'
    }
});

export default LibraryHomeScreen;