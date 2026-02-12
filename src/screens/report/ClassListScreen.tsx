/**
 * File: src/screens/report/ClassListScreen.js
 * Purpose: Displays a list of all classes with performance summaries for Teachers/Admins.
 * Updated: Responsive Design, Dark Mode Support & Error Handling.
 */
import React, { useState, useEffect } from 'react';
import { 
    View, Text, FlatList, TouchableOpacity, StyleSheet, 
    ActivityIndicator, Dimensions, StatusBar, useColorScheme 
} from 'react-native';
import apiClient from '../../api/client';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    textMuted: '#95a5a6',
    border: '#f0f0f0',
    iconBg: '#F5F7FA',
    headerIconBg: '#E0F2F1',
    classSectionBg: '#008080', // Teal
    classText: '#ffffff',
    error: '#e74c3c'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    textMuted: '#7f8c8d',
    border: '#333333',
    iconBg: '#333333',
    headerIconBg: '#333333',
    classSectionBg: '#004d4d', // Darker Teal
    classText: '#e0e0e0',
    error: '#cf6679'
};

const ClassListScreen = ({ navigation }) => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

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
        return (
            <View style={[styles.loaderContainer, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.loaderContainer, { backgroundColor: theme.background }]}>
                <Icon name="alert-circle-outline" size={50} color={theme.error} />
                <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
                <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.primary }]} onPress={fetchClassSummaries}>
                    <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={[styles.cardContainer, { backgroundColor: theme.cardBg, shadowColor: theme.textMain }]}
            onPress={() => navigation.navigate('MarksEntry', { classGroup: item.class_group })}
            activeOpacity={0.9}
        >
            {/* Left Side: Class Name */}
            <View style={[styles.classSection, { backgroundColor: theme.classSectionBg }]}>
                <Text style={[styles.classText, { color: theme.classText }]}>{item.class_group}</Text>
                <Icon name="chevron-right" size={24} color="rgba(255,255,255,0.7)" style={{ marginTop: 5 }} />
            </View>

            {/* Right Side: Stats */}
            <View style={styles.statsSection}>
                <View style={styles.statRow}>
                    <View style={[styles.iconWrapper, { backgroundColor: theme.iconBg }]}>
                        <Icon name="sigma" size={18} color={theme.primary} />
                    </View>
                    <View style={styles.textWrapper}>
                        <Text style={[styles.statLabel, { color: theme.textSub }]}>Total Marks</Text>
                        <Text style={[styles.statValue, { color: theme.textMain }]}>{item.totalClassMarks}</Text>
                    </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <View style={styles.statRow}>
                    <View style={[styles.iconWrapper, { backgroundColor: theme.iconBg }]}>
                        <Icon name="trophy-variant" size={18} color="#e67e22" />
                    </View>
                    <View style={styles.textWrapper}>
                        <Text style={[styles.statLabel, { color: theme.textSub }]}>Top Student</Text>
                        <Text style={[styles.statValue, { color: theme.textMain }]} numberOfLines={1}>
                            {item.topStudent?.name ? `${item.topStudent.name} (${item.topStudent.marks})` : 'N/A'}
                        </Text>
                    </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <View style={styles.statRow}>
                    <View style={[styles.iconWrapper, { backgroundColor: theme.iconBg }]}>
                        <Icon name="book-open-page-variant" size={18} color="#2980b9" />
                    </View>
                    <View style={styles.textWrapper}>
                        <Text style={[styles.statLabel, { color: theme.textSub }]}>Top Subject</Text>
                        <Text style={[styles.statValue, { color: theme.textMain }]} numberOfLines={1}>
                            {item.topSubject?.name ? `${item.topSubject.name} (${item.topSubject.marks})` : 'N/A'}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar backgroundColor={theme.background} barStyle={isDark ? "light-content" : "dark-content"} />
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.textMain }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.headerIconBg }]}>
                        <MaterialIcons name="class" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]}>Class Reports</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Performance Summaries</Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={classSummaries}
                renderItem={renderItem}
                keyExtractor={(item) => item.class_group}
                ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textMuted }]}>No classes with students were found.</Text>}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
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
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },

    // --- LIST CARD STYLES ---
    cardContainer: {
        flexDirection: 'row',
        marginBottom: 15,
        borderRadius: 12,
        elevation: 3,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        overflow: 'hidden',
    },
    classSection: {
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
        width: 80, 
    },
    classText: {
        fontSize: 16,
        fontWeight: 'bold',
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
    iconWrapper: {
        marginRight: 10,
        padding: 6,
        borderRadius: 8,
        overflow: 'hidden'
    },
    textWrapper: {
        flex: 1,
    },
    statLabel: {
        fontSize: 11,
        marginBottom: 2,
        fontWeight: '600',
        textTransform: 'uppercase'
    },
    statValue: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    divider: {
        height: 1,
        marginVertical: 4
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 15,
        fontStyle: 'italic'
    },
    errorText: {
        fontSize: 16,
        textAlign: 'center',
        marginVertical: 10
    },
    retryButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        marginTop: 10
    },
    retryText: {
        color: '#fff',
        fontWeight: 'bold'
    }
});

export default ClassListScreen;