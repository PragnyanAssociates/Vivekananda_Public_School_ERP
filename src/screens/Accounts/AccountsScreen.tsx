import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    FlatList,
    Image,
    Alert // Keep Alert for now in case of undefined routes
} from 'react-native';
// ★★★ 1. IMPORT THE useNavigation HOOK ★★★
import { useNavigation } from '@react-navigation/native';

// Define the structure for each item in our accounts dashboard
interface AccountModule {
    id: string;
    title: string;
    imageSource: string;
    navigateTo: string; // This MUST match the screen name in your Navigator
}

// Data for the grid items with high-quality icons
const accountModules: AccountModule[] = [
    {
        id: 'acc1',
        title: 'Transactions',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/9405/9405698.png',
        navigateTo: 'TransactionsScreen', // Screen name for Transactions
    },
    {
        id: 'acc2',
        title: 'Vouchers',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/4306/4306892.png',
        navigateTo: 'VouchersScreen', // Screen name for Vouchers
    },
    {
        id: 'acc3',
        title: 'Registers',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/9875/9875512.png',
        navigateTo: 'RegistersScreen', // Screen name for Registers
    },
    {
        id: 'acc4',
        title: 'Reports',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/4149/4149706.png',
        navigateTo: 'ReportsScreen', // Screen name for Reports
    },
    {
        id: 'acc5',
        title: 'Calendar',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/16090/16090543.png',
        navigateTo: 'CalendarScreen', // Screen name for Calendar
    },
];

// Main Accounts Screen Component
const AccountsScreen = () => {
    // ★★★ 2. INITIALIZE THE NAVIGATION OBJECT ★★★
    const navigation = useNavigation();

    // ★★★ 3. UPDATE THE NAVIGATION HANDLER ★★★
    const handleNavigation = (navigateTo: string) => {
        // This now uses the navigation object to move to the specified screen
        navigation.navigate(navigateTo as never);
    };

    // This function renders each card in the grid
    const renderModuleCard = ({ item }: { item: AccountModule }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => handleNavigation(item.navigateTo)}
        >
            <Image
                source={{ uri: item.imageSource }}
                style={styles.cardImage}
                resizeMode="contain"
            />
            <Text style={styles.cardTitle}>{item.title}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Accounts</Text>
            </View>

            <FlatList
                data={accountModules}
                renderItem={renderModuleCard}
                keyExtractor={(item) => item.id}
                numColumns={2}
                contentContainerStyle={styles.gridContainer}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7FAFC', // A light grey background
    },
    header: {
        paddingVertical: 20,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1A202C',
    },
    gridContainer: {
        padding: 12, // Adjusted padding
    },
    card: {
        flex: 1,
        margin: 8, // Adjusted margin
        height: 150, // Increased height for better balance
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16, // Slightly more rounded corners
        padding: 10,
        // iOS Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        // Android Shadow
        elevation: 5,
    },
    cardImage: {
        width: 60, // Increased icon size
        height: 60, // Increased icon size
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 14, // Increased font size
        fontWeight: '600',
        color: '#4A5568',
        textAlign: 'center',
    },
});

export default AccountsScreen;