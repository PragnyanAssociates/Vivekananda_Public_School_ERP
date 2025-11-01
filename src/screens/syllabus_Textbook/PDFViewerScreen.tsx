// 📂 File: src/screens/PDFViewerScreen.tsx (CREATE THIS NEW FILE)

import React from 'react';
import { StyleSheet, View, ActivityIndicator, Text, TouchableOpacity, Linking, SafeAreaView } from 'react-native';
import Pdf from 'react-native-pdf';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const PDFViewerScreen = ({ route, navigation }) => {
    const { url, title } = route.params;

    if (!url) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>Error</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.centered}>
                    <Text>No URL provided.</Text>
                </View>
            </SafeAreaView>
        );
    }
    
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

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
                    <MaterialIcons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{title || 'Document'}</Text>
                <TouchableOpacity onPress={handleDownload} style={styles.headerButton}>
                    <MaterialIcons name="file-download" size={24} color="#008080" />
                </TouchableOpacity>
            </View>
            <Pdf
                trustAllCerts={false}
                source={{ uri: url, cache: true }}
                onLoadComplete={(numberOfPages, filePath) => {
                    console.log(`Number of pages: ${numberOfPages}`);
                }}
                onError={(error) => {
                    console.log(error);
                }}
                style={styles.pdf}
                loader={<ActivityIndicator size="large" color="#008080" />}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f0f0',
    },
    pdf: {
        flex: 1,
        width: '100%',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    headerButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 10,
    },
});

export default PDFViewerScreen;