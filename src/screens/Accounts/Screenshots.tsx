import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/client'; // Your API client
import ImageView from "react-native-image-viewing";

// --- Type Definitions ---
interface Screenshot {
    id: number;
    voucher_date: string;
    attachment_url: string;
}

interface GroupedScreenshots {
    [key: string]: Screenshot[];
}

// Get screen dimensions for responsive image sizing
const { width } = Dimensions.get('window');
// Calculate image size: (screenWidth - horizontal paddings - margins between images) / number of columns
const IMAGE_SIZE = (width - 32 - 20) / 3;

// --- Main Screen Component ---
const Screenshots = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    // --- State Management ---
    const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    // Get the base URL from your api client to construct full image paths
    const baseUrl = useMemo(() => apiClient.defaults.baseURL?.replace('/api', ''), []);

    // --- Data Fetching ---
    const fetchScreenshots = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.get<Screenshot[]>('/vouchers/screenshots');
            setScreenshots(response.data);
        } catch (error) {
            console.error("Error fetching screenshots:", error);
            Alert.alert("Error", "Could not fetch screenshots.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch data whenever the screen comes into focus
    useEffect(() => {
        if (isFocused) {
            fetchScreenshots();
        }
    }, [isFocused, fetchScreenshots]);

    // --- Data Processing & Memoization ---

    // Group screenshots by date for display
    const groupedScreenshots = useMemo(() => {
        return screenshots.reduce((acc: GroupedScreenshots, screenshot) => {
            const date = new Date(screenshot.voucher_date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push(screenshot);
            return acc;
        }, {});
    }, [screenshots]);

    // Prepare image URIs for the full-screen viewer library
    const imageUrisForViewer = useMemo(() => {
        return screenshots.map(s => ({ uri: `${baseUrl}${s.attachment_url}` }));
    }, [screenshots, baseUrl]);


    // --- Event Handlers ---
    const openImageViewer = (screenshot: Screenshot) => {
        const index = screenshots.findIndex(s => s.id === screenshot.id);
        if (index > -1) {
            setSelectedImageIndex(index);
            setViewerVisible(true);
        }
    };

    // --- Render Logic ---

    // Loading State
    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Screenshots</Text>
                </View>
                <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            </SafeAreaView>
        );
    }

    // Main Component Render
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color="#263238" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Screenshots</Text>
            </View>

            {screenshots.length === 0 ? (
                // Empty State
                <View style={styles.emptyContainer}>
                    <MaterialIcons name="image-not-supported" size={60} color="#B0BEC5" />
                    <Text style={styles.emptyText}>No screenshots found.</Text>
                    <Text style={styles.emptySubText}>Attachments you add to vouchers will appear here.</Text>
                </View>
            ) : (
                // Gallery View
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {Object.entries(groupedScreenshots).map(([date, images]) => (
                        <View key={date} style={styles.dateSection}>
                            <Text style={styles.dateHeader}>{date}</Text>
                            <View style={styles.imageGrid}>
                                {images.map((image) => (
                                    <TouchableOpacity key={image.id} onPress={() => openImageViewer(image)}>
                                        <Image
                                            source={{ uri: `${baseUrl}${image.attachment_url}` }}
                                            style={styles.thumbnail}
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}

            {/* Full-Screen Image Viewer Modal */}
            <ImageView
                images={imageUrisForViewer}
                imageIndex={selectedImageIndex}
                visible={viewerVisible}
                onRequestClose={() => setViewerVisible(false)}
            />
        </SafeAreaView>
    );
};

// --- Stylesheet ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#CFD8DC',
    },
    backButton: {
        padding: 5,
        marginRight: 15,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#263238',
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#78909C',
        marginTop: 16,
    },
    emptySubText: {
        fontSize: 14,
        color: '#90A4AE',
        marginTop: 8,
        textAlign: 'center',
    },
    scrollContent: {
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    dateSection: {
        marginBottom: 24,
    },
    dateHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#37474F',
        marginBottom: 12,
    },
    imageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    thumbnail: {
        width: IMAGE_SIZE,
        height: IMAGE_SIZE,
        borderRadius: 8,
        backgroundColor: '#ECEFF1', // Placeholder color while image loads
    },
});

export default Screenshots;