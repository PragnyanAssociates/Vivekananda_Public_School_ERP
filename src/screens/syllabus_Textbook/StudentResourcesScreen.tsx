// 📂 File: src/screens/students/StudentResourcesScreen.tsx (REPLACE THIS FILE)

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, Alert, Linking, FlatList, Image, SafeAreaView } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native'; // ★ IMPORT useNavigation
import apiClient from '../../api/client';

const SERVER_URL = 'https://vivekanandapublicschoolerp-production.up.railway.app'; 

const StudentResourcesScreen = () => {
    const navigation = useNavigation(); // ★ INITIALIZE navigation
    const [view, setView] = useState('CLASS_LIST'); 
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // ... (all other state variables remain the same)
    const [availableClasses, setAvailableClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [selectedBoard, setSelectedBoard] = useState<'state' | 'central' | null>(null);
    const [subjects, setSubjects] = useState([]);
    const [resourceType, setResourceType] = useState<'Syllabus' | 'Textbooks' | null>(null);

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

    // ★ NEW ★ Replaces old handleLinkPress for a better experience
    const handleCardPress = async (item) => {
        if (!item.url) {
            Alert.alert("Not Available", "The link for this item has not been provided yet.");
            return;
        }

        // Check if the URL is for a PDF
        if (item.url.toLowerCase().endsWith('.pdf')) {
            navigation.navigate('PDFViewer', { url: item.url, title: item.subject_name });
        } else {
            // For all other links, open in the system browser
            const canOpen = await Linking.canOpenURL(item.url);
            if (canOpen) {
                await Linking.openURL(item.url);
            } else {
                Alert.alert("Error", `Could not open the link.`);
            }
        }
    };
    
    // ... (handleClassPress, handleBoardPress, handleSyllabusPress, handleTextbookPress, goBack, renderHeader functions remain the same)
    const handleClassPress = (classGroup) => { setSelectedClass(classGroup); setView('BOARD_TYPE'); };
    const handleBoardPress = (boardType) => { setSelectedBoard(boardType); setView('OPTIONS'); };
    const handleSyllabusPress = async () => { if (!selectedClass || !selectedBoard) return; setIsLoading(true); setResourceType('Syllabus'); try { const response = await apiClient.get(`/resources/syllabus/class/${selectedClass}/${selectedBoard}`); setSubjects(response.data); setView('SUBJECTS'); } catch (e) { Alert.alert("Not Found", "Syllabus has not been published for this class and board yet."); } finally { setIsLoading(false); } };
    const handleTextbookPress = async () => { if (!selectedClass || !selectedBoard) return; setIsLoading(true); setResourceType('Textbooks'); try { const response = await apiClient.get(`/resources/textbook/class/${selectedClass}/${selectedBoard}`); setSubjects(response.data); setView('SUBJECTS'); } catch (e) { Alert.alert("Not Found", "Textbooks have not been published for this class and board yet."); } finally { setIsLoading(false); } };
    const goBack = (targetView) => { setView(targetView); if (targetView === 'CLASS_LIST') { setSelectedClass(null); setSelectedBoard(null); setResourceType(null); } if (targetView === 'BOARD_TYPE') { setSelectedBoard(null); setResourceType(null); } if (targetView === 'OPTIONS') { setResourceType(null); } };
    const renderHeader = (title, backTarget, backText) => ( <View> <TouchableOpacity onPress={() => goBack(backTarget)} style={styles.backButton}> <MaterialIcons name="arrow-back" size={24} color="#333" /> <Text style={styles.backButtonText}>{backText}</Text> </TouchableOpacity> <Text style={styles.mainHeaderText}>{title}</Text> </View> );

    if (isLoading && view === 'CLASS_LIST') {
        return <ActivityIndicator size="large" color="#008080" style={styles.loader} />;
    }

    if (error) {
        return ( <View style={styles.centeredContainer}> <MaterialIcons name="error-outline" size={30} color="#757575" /> <Text style={styles.errorText}>{error}</Text> </View> );
    }
    
    if (view === 'SUBJECTS') {
         return (
            <SafeAreaView style={styles.container}>
                {renderHeader(`${resourceType} - ${selectedClass}`, 'OPTIONS', 'Back to Options')}
                <FlatList
                    data={subjects}
                    keyExtractor={(item) => item.id.toString()}
                    numColumns={2}
                    contentContainerStyle={styles.gridContainer}
                    renderItem={({ item }) => {
                        const imageUri = item.cover_image_url
                            ? `${SERVER_URL}${item.cover_image_url}`
                            : `https://via.placeholder.com/300x400/DCDCDC/808080?text=${item.subject_name.replace(' ', '+')}`;

                        return (
                            // ★ UPDATED ★ This now calls handleCardPress
                            <TouchableOpacity style={styles.gridItem} onPress={() => handleCardPress(item)}>
                                <Image source={{ uri: imageUri }} style={styles.coverImage} />
                                <View style={styles.infoContainer}>
                                    <Text style={styles.gridTitle} numberOfLines={1}>{item.subject_name}</Text>
                                    <Text style={styles.gridSubtitle}>{item.class_group}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={<Text style={styles.errorText}>No {resourceType?.toLowerCase()} found for this class.</Text>}
                />
            </SafeAreaView>
        );
    }

    // ... (The rest of the return statement and styles remain exactly the same)
    if (view === 'OPTIONS') { return ( <SafeAreaView style={styles.container}> {renderHeader(`${selectedClass} - ${selectedBoard === 'state' ? 'State' : 'Central'} Board`, 'BOARD_TYPE', 'Change Board')} <View style={styles.centeredContainer}> <TouchableOpacity style={styles.optionCard} onPress={handleSyllabusPress}> <MaterialIcons name="menu-book" size={50} color="#008080" /> <Text style={styles.optionText}>Academic Syllabus</Text> </TouchableOpacity> <TouchableOpacity style={styles.optionCard} onPress={handleTextbookPress}> <MaterialIcons name="auto-stories" size={50} color="#008080" /> <Text style={styles.optionText}>Textbooks</Text> </TouchableOpacity> </View> </SafeAreaView> ); }
    if (view === 'BOARD_TYPE') { return ( <SafeAreaView style={styles.container}> {renderHeader(`Select Board for ${selectedClass}`, 'CLASS_LIST', 'Change Class')} <View style={styles.centeredContainer}> <TouchableOpacity style={styles.optionCard} onPress={() => handleBoardPress('state')}> <MaterialIcons name="account-balance" size={50} color="#c62828" /> <Text style={styles.optionText}>State Board</Text> </TouchableOpacity> <TouchableOpacity style={styles.optionCard} onPress={() => handleBoardPress('central')}> <MaterialIcons name="corporate-fare" size={50} color="#0277bd" /> <Text style={styles.optionText}>Central Board</Text> </TouchableOpacity> </View> </SafeAreaView> ); }
    return ( <SafeAreaView style={styles.container}> <Text style={styles.mainHeaderText}>Select a Class</Text> <FlatList data={availableClasses} keyExtractor={(item) => item} numColumns={3} renderItem={({ item }) => ( <TouchableOpacity style={styles.classGridItem} onPress={() => handleClassPress(item as string)}> <Text style={styles.classGridText}>{item.replace('Class ', '')}</Text> </TouchableOpacity> )} contentContainerStyle={styles.classGridContainer} ListEmptyComponent={<Text style={styles.errorText}>No resources have been published yet.</Text>} refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchAvailableClasses} />} /> </SafeAreaView> );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f8' },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loader: { flex: 1, justifyContent: 'center' },
    errorText: { marginTop: 20, textAlign: 'center', fontSize: 16, color: '#757575' },
    mainHeaderText: { fontSize: 22, fontWeight: 'bold', color: '#263238', paddingHorizontal: 15, marginBottom: 10, textAlign: 'center' },
    backButton: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    backButtonText: { marginLeft: 5, fontSize: 18, color: '#333', fontWeight: '500' },
    optionCard: { width: '80%', paddingVertical: 20, paddingHorizontal: 10, marginVertical: 15, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    optionText: { fontSize: 18, fontWeight: 'bold', color: '#37474f', marginTop: 15, textAlign: 'center' },
    classGridContainer: { padding: 5 },
    classGridItem: { flex: 1, margin: 8, height: 100, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, elevation: 3 },
    classGridText: { fontSize: 20, fontWeight: 'bold', color: '#008080' },
    gridContainer: { paddingHorizontal: '1.5%', paddingTop: 8, },
    gridItem: { width: '47%', marginHorizontal: '1.5%', marginBottom: 12, backgroundColor: '#fff', borderRadius: 10, elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2.5, },
    coverImage: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#e0e0e0', borderTopLeftRadius: 10, borderTopRightRadius: 10, },
    infoContainer: { padding: 10, alignItems: 'center', },
    gridTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', textAlign: 'center', },
    // ★ NEW ★ Added gridSubtitle for consistency with admin screen
    gridSubtitle: { fontSize: 13, color: '#757575', marginTop: 2, textAlign: 'center', },
});

export default StudentResourcesScreen;