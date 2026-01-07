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
    UIManager
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Enable Layout Animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

    const handleNavigation = (navigateTo: string) => {
        navigation.navigate(navigateTo as never);
    };

    const renderModuleCard = ({ item }: { item: AccountModule }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => handleNavigation(item.navigateTo)}
            activeOpacity={0.8}
        >
            <View style={styles.imageContainer}>
                <Image
                    source={{ uri: item.imageSource }}
                    style={styles.cardImage}
                    resizeMode="contain"
                />
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            
            {/* Header Card */}
            <View style={styles.headerCard}>
                <View style={styles.headerIconContainer}>
                    <Icon name="account-balance-wallet" size={28} color="#008080" />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>Accounts</Text>
                    <Text style={styles.headerSubtitle}>Manage financial records</Text>
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
        backgroundColor: '#F2F5F8', 
    },
    
    // --- HEADER STYLES ---
    headerCard: {
        backgroundColor: '#FFFFFF',
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
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerIconContainer: {
        backgroundColor: '#E0F2F1',
        borderRadius: 30,
        width: 45, // Slightly smaller circle to match reduced height
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: {
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 22, // INCREASED Font Size
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
        paddingBottom: 20,
    },
    card: {
        flex: 1,
        margin: 6,
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 10,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    imageContainer: {
        marginBottom: 15,
        padding: 10,
        backgroundColor: '#F7FAFC', 
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
        textAlign: 'center',
    },
});

export default AccountsScreen;