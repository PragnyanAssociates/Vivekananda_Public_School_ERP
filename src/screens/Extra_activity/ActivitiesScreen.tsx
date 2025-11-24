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

// Define the structure for each item in our Activities dashboard
interface ActivityModule {
    id: string;
    title: string;
    imageSource: string;
    navigateTo: string; // This MUST match the screen name in your Navigator
}

// Data for the grid items with high-quality icons representing the categories
const activityModules: ActivityModule[] = [
    {
        id: 'act1',
        title: 'Sports',
        // Icon representing Football/Cricket etc.
        imageSource: 'https://cdn-icons-png.flaticon.com/128/3311/3311579.png', 
        navigateTo: 'SportsScreen', 
    },
    {
        id: 'act2',
        title: 'Arts',
        // Icon representing Painting/Music/Drama
        imageSource: 'https://cdn-icons-png.flaticon.com/128/2400/2400603.png',
        navigateTo: 'ArtsScreen', 
    },
    {
        id: 'act3',
        title: 'Clubs',
        // Icon representing Science/Math/Coding clubs
        imageSource: 'https://cdn-icons-png.flaticon.com/128/7853/7853167.png',
        navigateTo: 'ClubsScreen', 
    },
    {
        id: 'act4',
        title: 'Competitions',
        // Icon representing Debate/Quiz/Awards
        imageSource: 'https://cdn-icons-png.flaticon.com/128/1599/1599828.png',
        navigateTo: 'CompetitionsScreen', 
    },
    {
        id: 'act5',
        title: 'Social Service',
        // Icon representing NCC/NSS/Charity
        imageSource: 'https://cdn-icons-png.flaticon.com/128/12130/12130203.png',
        navigateTo: 'SocialServiceScreen', 
    },
    {
        id: 'act6',
        title: 'Other Skills',
        // Icon representing Yoga/Photography/Robotics
        imageSource: 'https://cdn-icons-png.flaticon.com/128/12669/12669293.png',
        navigateTo: 'OtherSkillsScreen', 
    },
];

// Main Activities Screen Component
const ActivitiesScreen = () => {
    // Initialize the navigation object
    const navigation = useNavigation();

    // Update the navigation handler
    const handleNavigation = (navigateTo: string) => {
        navigation.navigate(navigateTo as never);
    };

    // This function renders each card in the grid
    const renderModuleCard = ({ item }: { item: ActivityModule }) => (
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
                <Text style={styles.headerTitle}>Activities</Text>
            </View>

            <FlatList
                data={activityModules}
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

export default ActivitiesScreen;