import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, FlatList, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const libraryModules = [
    {
        id: 'lib1',
        title: 'Search Books',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/3038/3038168.png',
        navigateTo: 'BookListScreen', 
    },
    {
        id: 'lib2',
        title: 'Digital Library',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/2997/2997608.png',
        navigateTo: 'DigitalLibraryScreen', 
    },
    {
        id: 'lib3',
        title: 'Add New Book',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/4683/4683468.png',
        navigateTo: 'AddBookScreen', // Ensure you create this or hide it for students
    },
];

const LibraryHomeScreen = () => {
    const navigation = useNavigation();

    const renderModuleCard = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate(item.navigateTo)}
        >
            <Image source={{ uri: item.imageSource }} style={styles.cardImage} resizeMode="contain" />
            <Text style={styles.cardTitle}>{item.title}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>📚 Library</Text>
            </View>
            <FlatList
                data={libraryModules}
                renderItem={renderModuleCard}
                keyExtractor={(item) => item.id}
                numColumns={2}
                contentContainerStyle={styles.gridContainer}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F7FAFC' },
    header: { padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#E2E8F0' },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A202C' },
    gridContainer: { padding: 12 },
    card: {
        flex: 1, margin: 8, height: 140, justifyContent: 'center', alignItems: 'center',
        backgroundColor: '#FFF', borderRadius: 12, elevation: 3,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4
    },
    cardImage: { width: 50, height: 50, marginBottom: 10 },
    cardTitle: { fontSize: 13, fontWeight: '600', color: '#4A5568', textAlign: 'center' },
});

export default LibraryHomeScreen;