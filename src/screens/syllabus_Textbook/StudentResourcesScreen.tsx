/**
 * File: src/screens/resources/StudentResourcesScreen.js
 * Purpose: Browse available classes, select a board, and view textbooks/resources.
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI Header.
 */
import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    ActivityIndicator, 
    RefreshControl, 
    TouchableOpacity, 
    Alert, 
    Linking, 
    FlatList, 
    Image, 
    SafeAreaView,
    useColorScheme,
    StatusBar,
    Dimensions
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native'; 
import apiClient from '../../api/client';
import * as Animatable from 'react-native-animatable';
import { SERVER_URL } from '../../../apiConfig';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#cbd5e1',
    iconBg: '#E0F2F1',
    stateBg: '#FFEBEE',
    stateIcon: '#c62828',
    centralBg: '#E1F5FE',
    centralIcon: '#0277bd',
    imagePlaceholder: '#e0e0e0',
    white: '#ffffff'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    iconBg: '#333333',
    stateBg: '#3b1c1c',
    stateIcon: '#ef5350',
    centralBg: '#153140',
    centralIcon: '#29b6f6',
    imagePlaceholder: '#2C2C2C',
    white: '#ffffff'
};

const StudentResourcesScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const navigation = useNavigation(); 

    // Hide default header to use our custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    // View State: 'CLASS_LIST' | 'BOARD_TYPE' | 'SUBJECTS'
    const [view, setView] = useState('CLASS_LIST'); 
    
    // Data States
    const [availableClasses, setAvailableClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [selectedBoard, setSelectedBoard] = useState(null);
    const [subjects, setSubjects] = useState([]);
    
    // UI States
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAvailableClasses = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiClient.get('/resources/classes');
            setAvailableClasses(response.data);
        } catch (e) {
            setError("Could not load available classes.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAvailableClasses();
    }, [fetchAvailableClasses]);

    const handleCardPress = async (item) => {
        if (!item.url) return Alert.alert("Not Available", "The link for this item has not been provided yet.");
        if (item.url.toLowerCase().endsWith('.pdf')) {
            navigation.navigate('PDFViewer', { url: item.url, title: item.subject_name });
        } else {
            const canOpen = await Linking.canOpenURL(item.url);
            if (canOpen) await Linking.openURL(item.url);
            else Alert.alert("Error", `Could not open the link.`);
        }
    };
    
    const handleClassPress = (classGroup) => { 
        setSelectedClass(classGroup); 
        setView('BOARD_TYPE'); 
    };

    const handleBoardPress = async (boardType) => { 
        if (!selectedClass) return;
        
        setSelectedBoard(boardType); 
        setIsLoading(true);
        
        try { 
            const response = await apiClient.get(`/resources/textbook/class/${selectedClass}/${boardType}`); 
            setSubjects(response.data); 
            setView('SUBJECTS'); 
        } catch (e) { 
            Alert.alert("Not Found", "Textbooks have not been published for this class and board yet."); 
            setSelectedBoard(null);
        } finally { 
            setIsLoading(false); 
        } 
    };

    const goBack = (targetView) => { 
        setView(targetView); 
        if (targetView === 'CLASS_LIST') { 
            setSelectedClass(null); 
            setSelectedBoard(null); 
        } 
        if (targetView === 'BOARD_TYPE') { 
            setSelectedBoard(null); 
            setSubjects([]);
        } 
    };

    // --- REUSABLE HEADER CARD ---
    const RenderHeaderCard = ({ title, subtitle, backTarget, icon }) => (
        <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
            <View style={styles.headerLeft}>
                {backTarget && (
                    <TouchableOpacity onPress={() => goBack(backTarget)} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={theme.textMain} />
                    </TouchableOpacity>
                )}
                <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                    <MaterialCommunityIcons name={icon} size={24} color={theme.primary} />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={[styles.headerTitle, { color: theme.textMain }]} numberOfLines={1}>{title}</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>{subtitle}</Text>
                </View>
            </View>
        </View>
    );

    if (isLoading && view === 'CLASS_LIST') {
        return (
            <SafeAreaView style={[styles.centeredContainer, { backgroundColor: theme.background }]}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
                <ActivityIndicator size="large" color={theme.primary} />
            </SafeAreaView>
        );
    }

    if (error) {
        return ( 
            <SafeAreaView style={[styles.centeredContainer, { backgroundColor: theme.background }]}> 
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
                <MaterialIcons name="error-outline" size={40} color={theme.textSub} /> 
                <Text style={[styles.errorText, { color: theme.textSub }]}>{error}</Text> 
            </SafeAreaView> 
        );
    }
    
    // --- VIEW: SUBJECTS LIST (Textbooks) ---
    if (view === 'SUBJECTS') {
         return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
                <RenderHeaderCard 
                    title={selectedClass} 
                    subtitle="Textbooks" 
                    backTarget="BOARD_TYPE" 
                    icon="book-open-page-variant" 
                />
                
                <FlatList
                    data={subjects}
                    keyExtractor={(item) => item.id.toString()}
                    numColumns={2}
                    contentContainerStyle={styles.gridContainer}
                    renderItem={({ item, index }) => {
                        const imageUri = item.cover_image_url 
                            ? `${SERVER_URL}${item.cover_image_url}` 
                            : `https://via.placeholder.com/300x400/DCDCDC/808080?text=${item.subject_name.replace(' ', '+')}`;
                        
                        return (
                            <Animatable.View animation="fadeInUp" duration={500} delay={index * 50} style={styles.gridItemWrapperTwoCol}>
                                <TouchableOpacity 
                                    style={[styles.gridItem, { backgroundColor: theme.cardBg, shadowColor: theme.border }]} 
                                    onPress={() => handleCardPress(item)} 
                                    activeOpacity={0.9}
                                >
                                    <Image source={{ uri: imageUri }} style={[styles.coverImage, { backgroundColor: theme.imagePlaceholder }]} resizeMode="cover" />
                                    <View style={styles.infoContainer}>
                                        <Text style={[styles.gridTitle, { color: theme.textMain }]} numberOfLines={1}>{item.subject_name}</Text>
                                        <Text style={[styles.gridSubtitle, { color: theme.textSub }]}>{item.class_group}</Text>
                                    </View>
                                </TouchableOpacity>
                            </Animatable.View>
                        );
                    }}
                    ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSub }]}>No textbooks found for this class.</Text>}
                />
            </SafeAreaView>
        );
    }

    // --- VIEW: SELECT BOARD ---
    if (view === 'BOARD_TYPE') { 
        return ( 
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
                <RenderHeaderCard 
                    title={selectedClass} 
                    subtitle="Select Board" 
                    backTarget="CLASS_LIST" 
                    icon="domain" 
                />

                <View style={styles.optionsContainer}> 
                    <TouchableOpacity 
                        style={[styles.optionCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]} 
                        onPress={() => handleBoardPress('state')}
                    > 
                        <View style={[styles.iconCircle, { backgroundColor: theme.stateBg }]}>
                            <MaterialIcons name="account-balance" size={32} color={theme.stateIcon} /> 
                        </View>
                        <Text style={[styles.optionText, { color: theme.textMain }]}>State Board</Text> 
                    </TouchableOpacity> 
                    
                    <TouchableOpacity 
                        style={[styles.optionCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]} 
                        onPress={() => handleBoardPress('central')}
                    > 
                        <View style={[styles.iconCircle, { backgroundColor: theme.centralBg }]}>
                            <MaterialIcons name="corporate-fare" size={32} color={theme.centralIcon} /> 
                        </View>
                        <Text style={[styles.optionText, { color: theme.textMain }]}>Central Board</Text> 
                    </TouchableOpacity> 
                </View> 
            </SafeAreaView> 
        ); 
    }

    // --- VIEW: CLASS LIST (Initial View) ---
    return ( 
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            <RenderHeaderCard 
                title="Resources" 
                subtitle="Select Class" 
                backTarget={null} 
                icon="school" 
            />

            <FlatList 
                data={availableClasses} 
                keyExtractor={(item) => item} 
                numColumns={3} 
                renderItem={({ item, index }) => ( 
                    <Animatable.View animation="zoomIn" duration={400} delay={index * 50} style={styles.gridItemWrapperThreeCol}>
                        <TouchableOpacity 
                            style={[styles.classGridItem, { backgroundColor: theme.cardBg, shadowColor: theme.border }]} 
                            onPress={() => handleClassPress(item)}
                        > 
                            <Text style={[styles.classGridText, { color: theme.primary }]}>{item}</Text> 
                        </TouchableOpacity> 
                    </Animatable.View>
                )} 
                contentContainerStyle={styles.classGridContainer} 
                ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textSub }]}>No resources have been published yet.</Text>} 
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchAvailableClasses} colors={[theme.primary]} tintColor={theme.primary} />} 
            /> 
        </SafeAreaView> 
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 3,
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    backButton: { marginRight: 10, padding: 4 },
    headerIconContainer: {
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center', flex: 1, paddingRight: 10 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13, marginTop: 2 },

    errorText: { marginTop: 20, textAlign: 'center', fontSize: 16 },
    emptyText: { marginTop: 40, textAlign: 'center', fontSize: 16 },
    
    // --- OPTION CARDS CONTAINER (Board Selection) ---
    optionsContainer: {
        alignItems: 'center',
        paddingTop: 15,
    },
    optionCard: { 
        width: '90%', 
        paddingVertical: 25, 
        paddingHorizontal: 20, 
        marginVertical: 10, 
        borderRadius: 16, 
        alignItems: 'center', 
        elevation: 3, 
        shadowOpacity: 0.1, 
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 }
    },
    iconCircle: { 
        width: 65, 
        height: 65, 
        borderRadius: 32.5, 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginBottom: 10 
    },
    optionText: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
    
    // --- CLASS GRID (3 Columns) ---
    classGridContainer: { paddingHorizontal: 10, paddingTop: 5, paddingBottom: 20 },
    gridItemWrapperThreeCol: {
        flex: 1,
        maxWidth: '33.33%', // Ensures exactly 3 columns
        padding: 5
    },
    classGridItem: { 
        height: 80, 
        justifyContent: 'center', 
        alignItems: 'center', 
        borderRadius: 12, 
        elevation: 2, 
        shadowOpacity: 0.1, 
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 }
    },
    classGridText: { fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
    
    // --- SUBJECT GRID (2 Columns) ---
    gridContainer: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 20 },
    gridItemWrapperTwoCol: { 
        flex: 1,
        maxWidth: '50%', // Ensures exactly 2 columns
        padding: 6 
    },
    gridItem: { 
        borderRadius: 12, 
        elevation: 3, 
        shadowOpacity: 0.15, 
        shadowRadius: 2.5, 
        shadowOffset: { width: 0, height: 1 },
        overflow: 'hidden',
        height: 240, // Fixed height for alignment
        flexDirection: 'column'
    },
    coverImage: { width: '100%', height: 160 },
    infoContainer: { padding: 10, alignItems: 'center', flex: 1, justifyContent: 'center' },
    gridTitle: { fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
    gridSubtitle: { fontSize: 12, marginTop: 4, textAlign: 'center' },
});

export default StudentResourcesScreen;