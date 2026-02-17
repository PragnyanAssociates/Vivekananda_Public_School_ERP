/**
 * File: src/screens/labs/LabCard.tsx
 * Purpose: Display individual Lab details with responsive design and theme support.
 * Updated: 
 * - Multi-button support (Watch, Join, View, Download).
 * - DD/MM/YYYY Date Format.
 * - Responsive layout.
 */

import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Linking, 
  Alert, 
  useColorScheme,
  Dimensions 
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SERVER_URL } from '../../../apiConfig';

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
  
  // Button Colors (Slightly lighter for dark mode visibility)
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

export const LabCard = ({ lab, onEdit, onDelete }: LabCardProps) => {
  // Theme Hooks
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? DarkColors : LightColors;

  const canManage = onEdit && onDelete;

  // Handle Edit/Delete Menu
  const handleMenuPress = () => {
    Alert.alert(
      "Manage Lab",
      `Options for "${lab.title}"`,
      [
        { text: "CANCEL", style: "cancel" },
        { text: "EDIT", onPress: () => onEdit && onEdit(lab) },
        { text: "DELETE", style: "destructive", onPress: () => onDelete && onDelete(lab.id) }
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
    handleOpenLink(`${SERVER_URL}${lab.file_path}`);
  };

  // Image Source Logic
  const imageSource = lab.cover_image_url 
    ? { uri: `${SERVER_URL}${lab.cover_image_url}` }
    : require('../../assets/default-lab-icon.png'); // Ensure this image exists, or use a backup
  
  // Date Formatter: DD/MM/YYYY HH:MM
  const formattedDateTime = lab.class_datetime 
    ? (() => {
        const d = new Date(lab.class_datetime);
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      })()
    : null;

  return (
    <View style={[styles.cardContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      
      {/* 1. Header Section */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Image 
            source={imageSource} 
            style={[styles.iconImage, { backgroundColor: theme.iconPlaceholder }]} 
            resizeMode="cover"
          />
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: theme.textMain }]} numberOfLines={1}>
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
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
          >
            <MaterialIcons name="more-vert" size={24} color={theme.textSub} />
          </TouchableOpacity>
        )}
      </View>
      
      {/* 2. Meta Info (Class & Teacher) */}
      <View style={styles.metaContainer}>
        <Text style={[styles.metaInfo, { color: theme.textMeta }]}>
          Class: <Text style={[styles.metaBold, { color: theme.textSub }]}>{lab.class_group || 'All'}</Text>
        </Text>
        {lab.teacher_name && (
            <Text style={[styles.metaInfo, { color: theme.textMeta, marginLeft: 15 }]}>
            By: <Text style={[styles.metaBold, { color: theme.textSub }]}>{lab.teacher_name}</Text>
            </Text>
        )}
      </View>

      {/* 3. Scheduled Date Badge */}
      {formattedDateTime && (
        <View style={[styles.timeInfo, { backgroundColor: theme.timeBg }]}>
          <MaterialIcons name="event" size={16} color={theme.timeText} />
          <Text style={[styles.timeText, { color: theme.timeText }]}>{formattedDateTime}</Text>
        </View>
      )}

      {/* 4. Description */}
      <Text style={[styles.description, { color: theme.textSub }]} numberOfLines={4}>
        {lab.description}
      </Text>
      
      {/* 5. Action Buttons Grid (Responsive) */}
      <View style={styles.buttonGrid}>
        
        {/* VIDEO BUTTON */}
        {lab.video_url ? (
            <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: theme.videoBtn }]} 
                onPress={() => handleOpenLink(lab.video_url)}
            >
                <MaterialIcons name="play-circle-outline" size={20} color={theme.white} />
                <Text style={[styles.btnText, { color: theme.white }]}>Watch</Text>
            </TouchableOpacity>
        ) : null}

        {/* MEET BUTTON */}
        {lab.meet_link ? (
            <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: theme.meetBtn }]} 
                onPress={() => handleOpenLink(lab.meet_link)}
            >
                <MaterialCommunityIcons name="video-account" size={20} color={theme.white} />
                <Text style={[styles.btnText, { color: theme.white }]}>Join Meet</Text>
            </TouchableOpacity>
        ) : null}

        {/* EXTERNAL LINK BUTTON */}
        {lab.access_url ? (
            <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: theme.linkBtn }]} 
                onPress={() => handleOpenLink(lab.access_url)}
            >
                <MaterialCommunityIcons name="web" size={20} color={theme.white} />
                <Text style={[styles.btnText, { color: theme.white }]}>Open Link</Text>
            </TouchableOpacity>
        ) : null}

        {/* DOWNLOAD BUTTON */}
        {lab.file_path ? (
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: theme.fileBtn }]} 
            onPress={handleOpenFile}
          >
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
    marginHorizontal: 12, // Responsive margin
    marginVertical: 8, 
    padding: 15, 
    elevation: 2, 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 3, 
    borderWidth: 1,
    width: width > 600 ? '95%' : '94%', // Slight adjustment for tablets vs phones
    alignSelf: 'center'
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 8 
  },
  headerLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1 
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center'
  },
  menuBtn: { 
    padding: 2,
    marginLeft: 5 
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
    marginBottom: 2
  },
  subtitle: { 
    fontSize: 13, 
    fontWeight: '500'
  },
  metaContainer: {
    flexDirection: 'row',
    marginBottom: 8,
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
    paddingVertical: 4, 
    paddingHorizontal: 8, 
    borderRadius: 6, 
    marginBottom: 10,
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
    gap: 8, // Gap between buttons
  },
  actionBtn: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingVertical: 10, 
    paddingHorizontal: 12,
    borderRadius: 8, 
    flexGrow: 1, // Expand to fill space
    minWidth: '45%' // Ensure at least 2 buttons per row on small screens
  },
  btnText: { 
    fontSize: 13, 
    fontWeight: 'bold', 
    marginLeft: 6 
  },
});