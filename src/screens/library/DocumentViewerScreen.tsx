/**
 * File: src/screens/library/DocumentViewerScreen.js
 * Purpose: Display documents (PDFs, Docs) via WebView.
 * Updated: Responsive Design, Dark/Light Mode, Consistent UI Header.
 */
import React, { useLayoutEffect } from 'react';
import { 
    View, Text, StyleSheet, ActivityIndicator, Platform, 
    SafeAreaView, TouchableOpacity, useColorScheme, StatusBar 
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
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
    webViewBg: '#FFFFFF',
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    iconBg: '#333333',
    webViewBg: '#121212',
};

const DocumentViewerScreen = () => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const navigation = useNavigation();
    const route = useRoute();
    const { url, title } = route.params || {};

    // Hide default header to use our custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    // Android WebViews cannot display PDFs directly. 
    // We use Google Docs Viewer to render the PDF for viewing.
    // iOS WebViews can display PDFs directly.
    const viewerUrl = Platform.OS === 'android' && url?.toLowerCase().endsWith('.pdf')
        ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`
        : url;

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, shadowColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={theme.textMain} />
                    </TouchableOpacity>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.iconBg }]}>
                        <MaterialCommunityIcons name="file-document" size={24} color={theme.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: theme.textMain }]} numberOfLines={1}>
                            {title || 'Document Viewer'}
                        </Text>
                        <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Reading Resource</Text>
                    </View>
                </View>
            </View>

            {/* --- WEBVIEW CONTAINER --- */}
            <View style={[styles.webViewContainer, { backgroundColor: theme.webViewBg }]}>
                <WebView 
                    source={{ uri: viewerUrl }} 
                    startInLoadingState={true}
                    renderLoading={() => (
                        <View style={[styles.loadingContainer, { backgroundColor: theme.webViewBg }]}>
                            <ActivityIndicator size="large" color={theme.primary} />
                        </View>
                    )}
                    style={{ flex: 1, backgroundColor: 'transparent' }}
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    
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

    // --- WEBVIEW STYLES ---
    webViewContainer: {
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
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    }
});

export default DocumentViewerScreen;