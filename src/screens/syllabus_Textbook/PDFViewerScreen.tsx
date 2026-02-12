/**
 * File: src/screens/PDFViewerScreen.tsx
 * Purpose: Render and view PDF documents seamlessly.
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI Header.
 */
import React, { useLayoutEffect } from 'react';
import { 
    StyleSheet, View, ActivityIndicator, Text, TouchableOpacity, 
    Linking, SafeAreaView, Alert, useColorScheme, StatusBar 
} from 'react-native';
import Pdf from 'react-native-pdf';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#cbd5e1',
    iconBg: '#E0F2F1',
    pdfBg: '#E2E8F0', // Neutral backdrop for PDF
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
    pdfBg: '#1A1A1A',
    white: '#ffffff'
};

const PDFViewerScreen = ({ route, navigation }) => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const { url, title } = route.params || {};

    // Hide default header to use our custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const handleDownload = async () => {
        try {
            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
            } else {
                Alert.alert("Error", "Cannot open URL to download the file.");
            }
        } catch (error) {
            Alert.alert("Error", "An error occurred while trying to download the file.");
        }
    };

    // --- REUSABLE HEADER ---
    const renderHeader = (headerTitle, isError = false) => (
        <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
            <View style={styles.headerLeft}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={theme.textMain} />
                </TouchableOpacity>
                <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                    <MaterialCommunityIcons 
                        name={isError ? "alert-circle-outline" : "file-pdf-box"} 
                        size={24} 
                        color={isError ? "#E53935" : theme.primary} 
                    />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={[styles.headerTitle, { color: theme.textMain }]} numberOfLines={1}>
                        {headerTitle}
                    </Text>
                    <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>PDF Viewer</Text>
                </View>
            </View>
            {!isError && (
                <TouchableOpacity 
                    style={[styles.headerBtn, { backgroundColor: theme.primary }]} 
                    onPress={handleDownload}
                >
                    <MaterialIcons name="file-download" size={20} color={theme.white} />
                </TouchableOpacity>
            )}
        </View>
    );

    if (!url) {
        return (
            <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
                {renderHeader('Error', true)}
                <View style={styles.centered}>
                    <Text style={[styles.errorText, { color: theme.textSub }]}>No URL provided to load the document.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            
            {renderHeader(title || 'Document')}

            <View style={[styles.pdfContainer, { backgroundColor: theme.pdfBg }]}>
                <Pdf
                    trustAllCerts={false}
                    source={{ uri: url, cache: true }}
                    onLoadComplete={(numberOfPages, filePath) => {
                        console.log(`Number of pages: ${numberOfPages}`);
                    }}
                    onError={(error) => {
                        console.log(error);
                        Alert.alert("Error", "Failed to load PDF document.");
                    }}
                    style={styles.pdf}
                    renderActivityIndicator={() => (
                        <ActivityIndicator size="large" color={theme.primary} />
                    )}
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { 
        flex: 1 
    },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%',
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
        zIndex: 10
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
    headerBtn: {
        padding: 10,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
        elevation: 2
    },

    // --- PDF VIEWER STYLES ---
    pdfContainer: {
        flex: 1,
        width: '100%',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: -2 },
    },
    pdf: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent'
    },
    
    // --- ERROR STATE STYLES ---
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20
    },
    errorText: {
        fontSize: 16,
        textAlign: 'center'
    }
});

export default PDFViewerScreen;