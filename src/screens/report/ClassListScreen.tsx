/**
 * File: src/screens/report/ClassListScreen.js
 * Purpose: Displays a list of all classes with performance summaries for Teachers/Admins.
 * Updated: Responsive Design & Error Handling.
 */
import React, { useState, useEffect } from 'react';
import { 
    View, Text, FlatList, TouchableOpacity, StyleSheet, 
    ActivityIndicator, Dimensions, StatusBar 
} from 'react-native';
import apiClient from '../../api/client';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

const ClassListScreen = ({ navigation }) => {
    const [classSummaries, setClassSummaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchClassSummaries();
        });
        return unsubscribe;
    }, [navigation]);

    const fetchClassSummaries = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.get('/reports/class-summaries');
            setClassSummaries(response.data);
        } catch (err) {
            console.error('Failed to fetch class summaries:', err);
            setError('Could not load class data. Check your connection.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#008080" /></View>;
    }

    if (error) {
        return (
            <View style={styles.loaderContainer}>
                <Icon name="alert-circle-outline" size={50} color="#e74c3c" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchClassSummaries}>
                    <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.cardContainer}
            onPress={() => navigation.navigate('MarksEntry', { classGroup: item.class_group })}
            activeOpacity={0.9}
        >
            {/* Left Side: Class Name */}
            <View style={styles.classSection}>
                <Text style={styles.classText}>{item.class_group}</Text>
                <Icon name="chevron-right" size={24} color="rgba(255,255,255,0.7)" style={{ marginTop: 5 }} />
            </View>

            {/* Right Side: Stats */}
            <View style={styles.statsSection}>
                <View style={styles.statRow}>
                    <Icon name="sigma" size={18} color="#008080" style={styles.icon} />
                    <View style={styles.textWrapper}>
                        <Text style={styles.statLabel}>Total Marks</Text>
                        <Text style={styles.statValue}>{item.totalClassMarks}</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.statRow}>
                    <Icon name="trophy-variant" size={18} color="#e67e22" style={styles.icon} />
                    <View style={styles.textWrapper}>
                        <Text style={styles.statLabel}>Top Student</Text>
                        <Text style={styles.statValue} numberOfLines={1}>
                            {item.topStudent?.name ? `${item.topStudent.name} (${item.topStudent.marks})` : 'N/A'}
                        </Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.statRow}>
                    <Icon name="book-open-page-variant" size={18} color="#2980b9" style={styles.icon} />
                    <View style={styles.textWrapper}>
                        <Text style={styles.statLabel}>Top Subject</Text>
                        <Text style={styles.statValue} numberOfLines={1}>
                            {item.topSubject?.name ? `${item.topSubject.name} (${item.topSubject.marks})` : 'N/A'}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#F2F5F8" barStyle="dark-content" />
            
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="class" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Class Reports</Text>
                        <Text style={styles.headerSubtitle}>Performance Summaries</Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={classSummaries}
                renderItem={renderItem}
                keyExtractor={(item) => item.class_group}
                ListEmptyComponent={<Text style={styles.emptyText}>No classes with students were found.</Text>}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F5F8'
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 15,
        paddingVertical: 15,
        width: '94%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 15,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 3,
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        backgroundColor: '#E0F2F1',
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333333' },
    headerSubtitle: { fontSize: 13, color: '#666666' },

    // --- LIST CARD STYLES ---
    cardContainer: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        marginBottom: 15,
        borderRadius: 12,
        elevation: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        overflow: 'hidden',
    },
    classSection: {
        backgroundColor: '#008080', // Teal
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
        width: 80, 
    },
    classText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#ffffff',
        textAlign: 'center'
    },
    statsSection: {
        flex: 1,
        padding: 12,
        justifyContent: 'center',
    },
    statRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
    },
    icon: {
        marginRight: 10,
        backgroundColor: '#F5F7FA',
        padding: 6,
        borderRadius: 8,
        overflow: 'hidden'
    },
    textWrapper: {
        flex: 1,
    },
    statLabel: {
        fontSize: 11,
        color: '#7f8c8d',
        marginBottom: 2,
        fontWeight: '600',
        textTransform: 'uppercase'
    },
    statValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    divider: {
        height: 1,
        backgroundColor: '#f0f0f0',
        marginVertical: 4
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 15,
        color: '#95a5a6',
        fontStyle: 'italic'
    },
    errorText: {
        fontSize: 16,
        color: '#e74c3c',
        textAlign: 'center',
        marginVertical: 10
    },
    retryButton: {
        backgroundColor: '#008080',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20
    },
    retryText: {
        color: '#fff',
        fontWeight: 'bold'
    }
});

export default ClassListScreen;