import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    FlatList,
    Image,
    Platform,
    UIManager,
    useColorScheme,
    StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Enable Layout Animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- THEME COLORS ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#333333',
    textSub: '#666666',
    iconBg: '#E0F2F1',
    imageBg: '#F7FAFC',
    border: '#E0E0E0',
    shadow: '#000'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    iconBg: '#2C2C2C',
    imageBg: '#252525',
    border: '#333333',
    shadow: '#000' // Shadow is less visible in dark mode, but kept for consistency
};

// Define the structure for each item in our accounts dashboard
interface AccountModule {
    id: string;
    title: string;
    imageSource: string;
    navigateTo: string;
}

// Data for the grid items
const accountModules: AccountModule[] = [
    {
        id: 'acc1',
        title: 'Transactions',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/9405/9405698.png',
        navigateTo: 'TransactionsScreen',
    },
    {
        id: 'acc2',
        title: 'Vouchers',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/4306/4306892.png',
        navigateTo: 'VouchersScreen',
    },
    {
        id: 'acc3',
        title: 'Registers',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/9875/9875512.png',
        navigateTo: 'RegistersScreen',
    },
    {
        id: 'acc4',
        title: 'Reports',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/4149/4149706.png',
        navigateTo: 'ReportsScreen',
    },
    {
        id: 'acc5',
        title: 'Screenshots',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/2496/2496847.png',
        navigateTo: 'Screenshots',
    },
    {
        id: 'acc6',
        title: 'Calendar',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/16090/16090543.png',
        navigateTo: 'CalendarScreen',
    },
];

const AccountsScreen = () => {
    const navigation = useNavigation();
    
    // Theme Logic
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const handleNavigation = (navigateTo: string) => {
        navigation.navigate(navigateTo as never);
    };

    const renderModuleCard = ({ item }: { item: AccountModule }) => (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.shadow }]}
            onPress={() => handleNavigation(item.navigateTo)}
            activeOpacity={0.8}
        >
            <View style={[styles.imageContainer, { backgroundColor: COLORS.imageBg }]}>
                <Image
                    source={{ uri: item.imageSource }}
                    style={styles.cardImage}
                    resizeMode="contain"
                />
            </View>
            <Text style={[styles.cardTitle, { color: COLORS.textMain }]}>{item.title}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar 
                barStyle={isDark ? 'light-content' : 'dark-content'} 
                backgroundColor={COLORS.background} 
            />

            {/* Header Card */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.shadow }]}>
                <View style={[styles.headerIconContainer, { backgroundColor: COLORS.iconBg }]}>
                    <Icon name="account-balance-wallet" size={28} color={COLORS.primary} />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Accounts</Text>
                    <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Manage financial records</Text>
                </View>
            </View>

            <FlatList
                data={accountModules}
                renderItem={renderModuleCard}
                keyExtractor={(item) => item.id}
                numColumns={2}
                contentContainerStyle={styles.gridContainer}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // Background color handled dynamically in component
    },
    
    // --- HEADER STYLES ---
    headerCard: {
        paddingHorizontal: 15,
        paddingVertical: 10, // REDUCED Padding (Smaller box height)
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 3,
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
        // Background and ShadowColor handled dynamically
    },
    headerIconContainer: {
        borderRadius: 30,
        width: 45, // Slightly smaller circle to match reduced height
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        // Background color handled dynamically
    },
    headerTextContainer: {
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 22, // INCREASED Font Size
        fontWeight: 'bold',
        // Color handled dynamically
    },
    headerSubtitle: {
        fontSize: 14,
        marginTop: 1,
        // Color handled dynamically
    },

    // --- GRID STYLES ---
    gridContainer: {
        paddingHorizontal: 8, 
        paddingBottom: 20,
    },
    card: {
        flex: 1,
        margin: 6,
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
        padding: 10,
        elevation: 3,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        // Background and ShadowColor handled dynamically
    },
    imageContainer: {
        marginBottom: 15,
        padding: 10,
        borderRadius: 50,
        // Background color handled dynamically
    },
    cardImage: {
        width: 50,
        height: 50,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
        // Color handled dynamically
    },
});

export default AccountsScreen;