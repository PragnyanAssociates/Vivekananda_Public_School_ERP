/**
 * File: src/screens/report/ClassListScreen.js
 * Purpose: Displays a list of all classes for Teachers/Admins to select from.
 * Fetches data from '/api/reports/classes' and navigates to the MarksEntryScreen.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import apiClient from '../../api/client'; // Adjust path if your apiClient is elsewhere

const ClassListScreen = ({ navigation }) => {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const response = await apiClient.get('/reports/classes');
                setClasses(response.data);
            } catch (err) {
                console.error('Failed to fetch classes:', err);
                setError('Could not load class data. Please try again later.');
            } finally {
                setLoading(false);
            }
        };
        fetchClasses();
    }, []);

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#0000ff" /></View>;
    }

    if (error) {
         return <View style={styles.loaderContainer}><Text style={styles.errorText}>{error}</Text></View>;
    }

    const renderItem = ({ item }) => (
        <TouchableOpacity 
            style={styles.itemContainer}
            onPress={() => navigation.navigate('MarksEntry', { classGroup: item })}
        >
            <Text style={styles.itemText}>{item}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={classes}
                renderItem={renderItem}
                keyExtractor={(item) => item}
                ListEmptyComponent={<Text style={styles.emptyText}>No classes with students were found.</Text>}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        paddingHorizontal: 10, 
        paddingTop: 10,
        backgroundColor: '#f0f2f5' 
    },
    loaderContainer: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    itemContainer: {
        backgroundColor: '#ffffff',
        paddingVertical: 22,
        paddingHorizontal: 20,
        marginVertical: 8,
        borderRadius: 12,
        elevation: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    itemText: { 
        fontSize: 18, 
        fontWeight: '500',
        color: '#333'
    },
    emptyText: { 
        textAlign: 'center', 
        marginTop: 50, 
        fontSize: 16,
        color: '#666'
    },
    errorText: {
        fontSize: 16,
        color: 'red',
        textAlign: 'center'
    }
});

export default ClassListScreen;