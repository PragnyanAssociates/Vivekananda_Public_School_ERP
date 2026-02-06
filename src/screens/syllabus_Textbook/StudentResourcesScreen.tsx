import React, { useState, useEffect, useCallback } from 'react';
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
    Dimensions
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native'; 
import apiClient from '../../api/client';
import * as Animatable from 'react-native-animatable';
import { SERVER_URL } from '../../../apiConfig';

// --- THEME HELPER ---
const getTheme = (scheme: string | null | undefined) => {
    const isDark = scheme === 'dark';
    return {
        isDark,
        background: isDark ? '#121212' : '#F2F5F8',
        cardBg: isDark ? '#1E1E1E' : '#FFFFFF',
        textMain: isDark ? '#E0E0E0' : '#263238',
        textSub: isDark ? '#B0BEC5' : '#546E7A',
        border: isDark ? '#333333' : '#CFD8DC',
        primary: '#008080',
        headerIconBg: isDark ? 'rgba(0, 128, 128, 0.2)' : '#E0F2F1',
        iconBg: isDark ? '#2C2C2C' : '#FFFFFF'
    };
};

const StudentResourcesScreen = () => {
    const navigation = useNavigation(); 
    const colorScheme = useColorScheme();
    const theme = getTheme(colorScheme);

    // View State: 'CLASS_LIST' | 'BOARD_TYPE' | 'SUBJECTS'
    const [view, setView] = useState('CLASS_LIST'); 
    
    // Data States
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [selectedBoard, setSelectedBoard] = useState<'state' | 'central' | null>(null);
    const [subjects, setSubjects] = useState<any[]>([]);
    
    // UI States
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    const handleCardPress = async (item: any) => {
        if (!item.url) return Alert.alert("Not Available", "The link for this item has not been provided yet.");
        if (item.url.toLowerCase().endsWith('.pdf')) {
            // @ts-ignore
            navigation.navigate('PDFViewer', { url: item.url, title: item.subject_name });
        } else {
            const canOpen = await Linking.canOpenURL(item.url);
            if (canOpen) await Linking.openURL(item.url);
            else Alert.alert("Error", `Could not open the link.`);
        }
    };
    
    const handleClassPress = (classGroup: string) => { 
        setSelectedClass(classGroup); 
        setView('BOARD_TYPE'); 
    };

    // --- MODIFIED: Automatically fetch textbooks on board selection ---
    const handleBoardPress = async (boardType: 'state' | 'central') => { 
        if (!selectedClass) return;
        
        setSelectedBoard(boardType); 
        setIsLoading(true);
        
        try { 
            // Directly fetch textbooks
            const response = await apiClient.get(`/resources/textbook/class/${selectedClass}/${boardType}`); 
            setSubjects(response.data); 
            setView('SUBJECTS'); 
        } catch (e) { 
            Alert.alert("Not Found", "Textbooks have not been published for this class and board yet."); 
            // Optional: reset board if failed
            setSelectedBoard(null);
        } finally { 
            setIsLoading(false); 
        } 
    };

    const goBack = (targetView: string) => { 
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
    const RenderHeaderCard = ({ title, subtitle, backTarget, icon }: any) => (
        <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.isDark ? '#000' : '#ccc' }]}>
            <View style={styles.headerLeft}>
                {backTarget && (
                    <TouchableOpacity onPress={() => goBack(backTarget)} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color={theme.textMain} />
                    </TouchableOpacity>
                )}
                <View style={[styles.headerIconContainer, { backgroundColor: theme.headerIconBg }]}>
                    <MaterialCommunityIcons name={icon} size={24} color={theme.primary} />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={[styles.headerTitle, { color: theme.textMain }]}>{title}</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>{subtitle}</Text>
                </View>
            </View>
        </View>
    );

    if (isLoading && view === 'CLASS_LIST') {
        return <View style={[styles.centeredContainer, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
    }

    if (error) {
        return ( 
            <View style={[styles.centeredContainer, { backgroundColor: theme.background }]}> 
                <MaterialIcons name="error-outline" size={40} color={theme.textSub} /> 
                <Text style={[styles.errorText, { color: theme.textSub }]}>{error}</Text> 
            </View> 
        );
    }
    
    // --- VIEW: SUBJECTS LIST (Textbooks) ---
    if (view === 'SUBJECTS') {
         return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
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
                        const imageUri = item.cover_image_url ? `${SERVER_URL}${item.cover_image_url}` : `https://via.placeholder.com/300x400/DCDCDC/808080?text=${item.subject_name.replace(' ', '+')}`;
                        return (
                            <Animatable.View animation="fadeInUp" duration={500} delay={index * 50} style={styles.gridItemWrapper}>
                                <TouchableOpacity 
                                    style={[styles.gridItem, { backgroundColor: theme.cardBg }]} 
                                    onPress={() => handleCardPress(item)} 
                                    activeOpacity={0.9}
                                >
                                    <Image source={{ uri: imageUri }} style={styles.coverImage} resizeMode="cover" />
                                    <View style={styles.infoContainer}>
                                        <Text style={[styles.gridTitle, { color: theme.textMain }]} numberOfLines={1}>{item.subject_name}</Text>
                                        <Text style={[styles.gridSubtitle, { color: theme.textSub }]}>{item.class_group}</Text>
                                    </View>
                                </TouchableOpacity>
                            </Animatable.View>
                        );
                    }}
                    ListEmptyComponent={<Text style={[styles.errorText, { color: theme.textSub }]}>No textbooks found for this class.</Text>}
                />
            </SafeAreaView>
        );
    }

    // --- VIEW: SELECT BOARD ---
    if (view === 'BOARD_TYPE') { 
        return ( 
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
                <RenderHeaderCard 
                    title={selectedClass} 
                    subtitle="Select Board" 
                    backTarget="CLASS_LIST" 
                    icon="domain" 
                />

                <View style={styles.optionsContainer}> 
                    <TouchableOpacity style={[styles.optionCard, { backgroundColor: theme.cardBg }]} onPress={() => handleBoardPress('state')}> 
                        <View style={[styles.iconCircle, {backgroundColor: '#FFEBEE'}]}>
                            <MaterialIcons name="account-balance" size={32} color="#c62828" /> 
                        </View>
                        <Text style={[styles.optionText, { color: theme.textMain }]}>State Board</Text> 
                    </TouchableOpacity> 
                    
                    <TouchableOpacity style={[styles.optionCard, { backgroundColor: theme.cardBg }]} onPress={() => handleBoardPress('central')}> 
                        <View style={[styles.iconCircle, {backgroundColor: '#E1F5FE'}]}>
                            <MaterialIcons name="corporate-fare" size={32} color="#0277bd" /> 
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
                    <Animatable.View animation="zoomIn" duration={400} delay={index * 50} style={styles.classItemWrapper}>
                        <TouchableOpacity style={[styles.classGridItem, { backgroundColor: theme.cardBg }]} onPress={() => handleClassPress(item)}> 
                            <Text style={[styles.classGridText, { color: theme.primary }]}>{item}</Text> 
                        </TouchableOpacity> 
                    </Animatable.View>
                )} 
                contentContainerStyle={styles.classGridContainer} 
                ListEmptyComponent={<Text style={[styles.errorText, { color: theme.textSub }]}>No resources have been published yet.</Text>} 
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchAvailableClasses} colors={[theme.primary]} />} 
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
        paddingVertical: 15,
        width: '94%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 3,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
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

    errorText: { marginTop: 40, textAlign: 'center', fontSize: 16 },
    
    // --- OPTION CARDS CONTAINER ---
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
        elevation: 4, 
        shadowColor: "#000", 
        shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: 0.1, 
        shadowRadius: 4 
    },
    iconCircle: { 
        width: 65, 
        height: 65, 
        borderRadius: 32.5, 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginBottom: 10 
    },
    optionText: { fontSize: 18, fontWeight: 'bold', marginTop: 5, textAlign: 'center' },
    
    // --- CLASS GRID ---
    classGridContainer: { padding: 10, paddingTop: 5 },
    classItemWrapper: { flex: 1, margin: 5 },
    classGridItem: { 
        height: 80, 
        justifyContent: 'center', 
        alignItems: 'center', 
        borderRadius: 12, 
        elevation: 2, 
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 3 
    },
    classGridText: { fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
    
    // --- SUBJECT GRID ---
    gridContainer: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 20 },
    gridItemWrapper: { width: '50%', padding: 6 },
    gridItem: { 
        borderRadius: 12, 
        elevation: 3, 
        shadowColor: "#000", 
        shadowOffset: { width: 0, height: 1 }, 
        shadowOpacity: 0.15, 
        shadowRadius: 2.5, 
        overflow: 'hidden',
        height: 240, // Fixed height for alignment
    },
    coverImage: { width: '100%', height: 160, backgroundColor: '#e0e0e0' },
    infoContainer: { padding: 10, alignItems: 'center', flex: 1, justifyContent: 'center' },
    gridTitle: { fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
    gridSubtitle: { fontSize: 12, marginTop: 2, textAlign: 'center' },
});

export default StudentResourcesScreen;