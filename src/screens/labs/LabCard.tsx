/**
 * File: src/screens/labs/LabCard.tsx
 * Purpose: Reusable Card component for displaying Lab details.
 * Updated:
 * - Fixed Date Formatting (DD/MM/YYYY).
 * - Responsive Layout (Tablet vs Phone).
 * - consistent Dark/Light Mode.
 * - Dynamic Action Buttons (Video, Meet, Link, File).
 */

import React from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, Linking,
    Alert, useColorScheme, Dimensions
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SERVER_URL } from '../../../apiConfig'; // Ensure this path is correct for your project structure

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    textMeta: '#78909C',
    border: '#f0f0f0',
    timeBg: '#FFF3E0',
    timeText: '#E65100',
    // Button Colors
    fileBtn: '#2E7D32', // Green
    videoBtn: '#C62828', // Red
    meetBtn: '#1565C0', // Blue
    linkBtn: '#6A1B9A', // Purple
    white: '#ffffff',
    iconPlaceholder: '#EEE'
};

const DarkColors = {
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    textMeta: '#90A4AE',
    border: '#333333',
    timeBg: '#3E2723',
    timeText: '#FFAB91',
    // Button Colors (Adjusted for Dark Mode)
    fileBtn: '#388E3C',
    videoBtn: '#D32F2F',
    meetBtn: '#1976D2',
    linkBtn: '#7B1FA2',
    white: '#ffffff',
    iconPlaceholder: '#333'
};

export interface Lab {
    id: number;
    title: string;
    subject: string;
    lab_type: string;
    class_group?: string | null;
    description: string;
    access_url: string | null;
    file_path: string | null;
    cover_image_url?: string | null;
    teacher_name?: string | null;
    topic?: string | null;
    video_url?: string | null;
    meet_link?: string | null;
    class_datetime?: string | null;
}

interface LabCardProps {
    lab: Lab;
    onEdit?: (lab: Lab) => void;
    onDelete?: (id: number) => void;
}

// --- HELPER: DATE FORMATTING (DD/MM/YYYY) ---
const formatDateTime = (isoString: string): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    
    // Date Part
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    // Time Part
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 

    return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
};

export const LabCard = ({ lab, onEdit, onDelete }: LabCardProps) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;
    
    // Only show edit/delete if functions are provided (Teacher View)
    const canManage = onEdit && onDelete;

    const handleMenuPress = () => {
        Alert.alert(
            "Manage Lab",
            `Options for "${lab.title}"`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Edit Details", onPress: () => onEdit && onEdit(lab) },
                { text: "Delete", style: "destructive", onPress: () => onDelete && onDelete(lab.id) }
            ]
        );
    };

    const handleOpenLink = async (url: string | null | undefined) => {
        if (!url) return;
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) { await Linking.openURL(url); }
            else { Alert.alert("Error", `Cannot open link: ${url}`); }
        } catch (error) { Alert.alert("Error", "An unexpected error occurred."); }
    };

    const handleOpenFile = () => {
        if (!lab.file_path) return;
        // Construct full URL if file_path is relative
        const fileUrl = lab.file_path.startsWith('http') 
            ? lab.file_path 
            : `${SERVER_URL}${lab.file_path}`;
        handleOpenLink(fileUrl);
    };

    const imageSource = lab.cover_image_url
        ? { uri: lab.cover_image_url.startsWith('http') ? lab.cover_image_url : `${SERVER_URL}${lab.cover_image_url}` }
        : { uri: 'https://via.placeholder.com/150' }; // Fallback

    const formattedTime = lab.class_datetime ? formatDateTime(lab.class_datetime) : null;

    return (
        <View style={[styles.cardContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            
            {/* 1. Header & Title */}
            <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                    <Image 
                        source={imageSource} 
                        style={[styles.iconImage, { backgroundColor: theme.iconPlaceholder }]} 
                        resizeMode="cover"
                    />
                    <View style={styles.textContainer}>
                        <Text style={[styles.title, { color: theme.textMain }]} numberOfLines={2}>
                            {lab.title}
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.textSub }]} numberOfLines={1}>
                            {lab.subject}{lab.topic ? ` • ${lab.topic}` : ''}
                        </Text>
                    </View>
                </View>
                
                {canManage && (
                    <TouchableOpacity 
                        onPress={handleMenuPress} 
                        style={styles.menuBtn}
                        hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
                    >
                        <MaterialIcons name="more-vert" size={24} color={theme.textSub} />
                    </TouchableOpacity>
                )}
            </View>
            
            {/* 2. Meta (Class & Teacher) */}
            <View style={styles.metaContainer}>
                <Text style={[styles.metaInfo, { color: theme.textMeta }]}>
                    Type: <Text style={[styles.metaBold, { color: theme.textSub }]}>{lab.lab_type}</Text>
                </Text>
                {lab.teacher_name && (
                    <Text style={[styles.metaInfo, { color: theme.textMeta, marginLeft: 15 }]}>
                    By: <Text style={[styles.metaBold, { color: theme.textSub }]}>{lab.teacher_name}</Text>
                    </Text>
                )}
            </View>

            {/* 3. Scheduled Date Badge */}
            {formattedTime && (
                <View style={[styles.timeInfo, { backgroundColor: theme.timeBg }]}>
                    <MaterialIcons name="event" size={16} color={theme.timeText} />
                    <Text style={[styles.timeText, { color: theme.timeText }]}>{formattedTime}</Text>
                </View>
            )}

            {/* 4. Description */}
            <Text style={[styles.description, { color: theme.textSub }]} numberOfLines={4}>
                {lab.description}
            </Text>
            
            {/* 5. Responsive Button Grid */}
            <View style={styles.buttonGrid}>
                
                {lab.video_url ? (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.videoBtn }]} onPress={() => handleOpenLink(lab.video_url)}>
                        <MaterialIcons name="play-circle-outline" size={20} color={theme.white} />
                        <Text style={[styles.btnText, { color: theme.white }]}>Watch</Text>
                    </TouchableOpacity>
                ) : null}

                {lab.meet_link ? (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.meetBtn }]} onPress={() => handleOpenLink(lab.meet_link)}>
                        <MaterialCommunityIcons name="video-account" size={20} color={theme.white} />
                        <Text style={[styles.btnText, { color: theme.white }]}>Join</Text>
                    </TouchableOpacity>
                ) : null}

                {lab.access_url ? (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.linkBtn }]} onPress={() => handleOpenLink(lab.access_url)}>
                        <MaterialCommunityIcons name="web" size={20} color={theme.white} />
                        <Text style={[styles.btnText, { color: theme.white }]}>Open</Text>
                    </TouchableOpacity>
                ) : null}

                {lab.file_path ? (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.fileBtn }]} onPress={handleOpenFile}>
                        <MaterialIcons name="file-download" size={20} color={theme.white} />
                        <Text style={[styles.btnText, { color: theme.white }]}>Download</Text>
                    </TouchableOpacity>
                ) : null}

            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        borderRadius: 12,
        marginVertical: 8,
        padding: 15,
        elevation: 2,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        borderWidth: 1,
        // Responsive Width Logic
        width: width > 600 ? '90%' : '96%',
        alignSelf: 'center'
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingRight: 10
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center'
    },
    menuBtn: {
        padding: 4,
        marginLeft: 0
    },
    iconImage: {
        width: 48,
        height: 48,
        borderRadius: 8,
        marginRight: 12
    },
    title: {
        fontSize: 17,
        fontWeight: 'bold',
        marginBottom: 2,
        flexWrap: 'wrap'
    },
    subtitle: {
        fontSize: 13,
        fontWeight: '500'
    },
    metaContainer: {
        flexDirection: 'row',
        marginBottom: 10,
        flexWrap: 'wrap'
    },
    metaInfo: {
        fontSize: 12,
    },
    metaBold: {
        fontWeight: '700'
    },
    timeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 6,
        marginBottom: 12,
        alignSelf: 'flex-start'
    },
    timeText: {
        marginLeft: 6,
        fontWeight: 'bold',
        fontSize: 12
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 15
    },
    // Grid system for buttons
    buttonGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    actionBtn: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        flexGrow: 1,
        // Ensure buttons don't get too small on mobile
        minWidth: width > 400 ? '30%' : '45%'
    },
    btnText: {
        fontSize: 13,
        fontWeight: 'bold',
        marginLeft: 6
    },
});