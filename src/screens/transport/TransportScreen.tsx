import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    FlatList,
    Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

// Define the structure for each item in our Transport dashboard
interface TransportModule {
    id: string;
    title: string;
    imageSource: string;
    navigateTo: string; // This MUST match the screen name in your Navigator
}

// Data for the grid items with icons representing the Transport categories
const transportModules: TransportModule[] = [
    {
        id: 'trans1',
        title: 'Occupants List',
        // Icon representing Students/Commuters
        imageSource: 'https://cdn-icons-png.flaticon.com/128/2491/2491957.png', 
        navigateTo: 'PassengersScreen', 
    },
    {
        id: 'trans2',
        title: 'Routes',
        // Icon representing Maps/Paths
        imageSource: 'https://cdn-icons-png.flaticon.com/128/3180/3180149.png',
        navigateTo: 'RoutesScreen', 
    },
    {
        id: 'trans3',
        title: 'Vehicle Log',
        // Icon representing Bus Maintenance/Logbook
        imageSource: 'https://cdn-icons-png.flaticon.com/128/15342/15342094.png',
        navigateTo: 'VehicleLogScreen', 
    },
    {
        id: 'trans4',
        title: 'Doc View',
        // Icon representing ID Cards/Documents
        imageSource: 'https://cdn-icons-png.flaticon.com/128/17830/17830628.png',
        navigateTo: 'ProofsScreen', 
    },
    {
        id: 'trans6',
        title: 'Vehical Info',
        // Icon representing Feedback/Alerts
        imageSource: 'https://cdn-icons-png.flaticon.com/128/14969/14969652.png',
        navigateTo: 'VehicalDetails', 
    },
    {
        id: 'trans7',
        title: 'Staff Info',
        // Icon representing Feedback/Alerts
        imageSource: 'https://cdn-icons-png.flaticon.com/128/2798/2798177.png',
        navigateTo: 'BusStaffDetails', 
    },
    {
        id: 'trans5',
        title: 'Complaints',
        // Icon representing Feedback/Alerts
        imageSource: 'https://cdn-icons-png.flaticon.com/128/2016/2016314.png',
        navigateTo: 'ComplaintsScreen', 
    },
];

// Main Transport Screen Component
const TransportScreen = () => {
    // Initialize the navigation object
    const navigation = useNavigation();

    // Update the navigation handler
    const handleNavigation = (navigateTo: string) => {
        navigation.navigate(navigateTo as never);
    };

    // This function renders each card in the grid
    const renderModuleCard = ({ item }: { item: TransportModule }) => (
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
                <Text style={styles.headerTitle}>Transport Management</Text>
            </View>

            <FlatList
                data={transportModules}
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
        padding: 12, 
    },
    card: {
        flex: 1,
        margin: 8, 
        height: 150, 
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16, 
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
        width: 60, 
        height: 60, 
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 14, 
        fontWeight: '600',
        color: '#4A5568',
        textAlign: 'center',
    },
});

export default TransportScreen;