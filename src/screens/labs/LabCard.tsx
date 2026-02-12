/**
 * File: src/screens/labs/LabCard.tsx
 * Purpose: Display individual Lab details with responsive design and theme support.
 * Updated: Responsive Design, Dark/Light Mode.
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
  timeText: '#D84315',
  fileBtn: '#43A047',
  videoBtn: '#E53935',
  white: '#ffffff',
  iconPlaceholder: '#EEE'
};

const DarkColors = {
  cardBg: '#1E1E1E',
  textMain: '#E0E0E0',
  textSub: '#B0B0B0',
  textMeta: '#90A4AE',
  border: '#333333',
  timeBg: '#3E2723', // Darker orange/brown background
  timeText: '#FFAB91', // Lighter orange text
  fileBtn: '#2E7D32',
  videoBtn: '#C62828',
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
      else { Alert.alert("Error", `Cannot open link.`); }
    } catch (error) { Alert.alert("Error", "An unexpected error occurred."); }
  };

  const handleOpenFile = () => {
    if (!lab.file_path) return;
    handleOpenLink(`${SERVER_URL}${lab.file_path}`);
  };

  const imageSource = lab.cover_image_url 
    ? { uri: `${SERVER_URL}${lab.cover_image_url}` }
    : require('../../assets/default-lab-icon.png');
  
  const formattedDateTime = lab.class_datetime 
    ? new Date(lab.class_datetime).toLocaleString()
    : null;

  return (
    <View style={[styles.cardContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      
      {/* Header Section */}
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
              {lab.subject}{lab.topic ? ` - ${lab.topic}` : ''}
            </Text>
          </View>
        </View>
        
        {canManage && (
          <TouchableOpacity 
            onPress={handleMenuPress} 
            style={styles.menuBtn}
            hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
          >
            <MaterialIcons name="more-vert" size={26} color={theme.textSub} />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Meta Info */}
      <Text style={[styles.metaInfo, { color: theme.textMeta }]}>
        For: <Text style={[styles.metaBold, { color: theme.textSub }]}>{lab.class_group || 'All Classes'}</Text>
        {lab.teacher_name && `  |  By: `}
        {lab.teacher_name && <Text style={[styles.metaBold, { color: theme.textSub }]}>{lab.teacher_name}</Text>}
      </Text>

      {/* Date Time Badge */}
      {formattedDateTime && (
        <View style={[styles.timeInfo, { backgroundColor: theme.timeBg }]}>
          <MaterialIcons name="event" size={16} color={theme.timeText} />
          <Text style={[styles.timeText, { color: theme.timeText }]}>{formattedDateTime}</Text>
        </View>
      )}

      {/* Description */}
      <Text style={[styles.description, { color: theme.textSub }]} numberOfLines={3}>
        {lab.description}
      </Text>
      
      {/* Action Buttons */}
      <View style={styles.accessButtonsContainer}>
        {lab.file_path && (
          <TouchableOpacity 
            style={[styles.accessButton, { backgroundColor: theme.fileBtn }]} 
            onPress={handleOpenFile}
          >
            <MaterialIcons name="file-download" size={18} color={theme.white} />
            <Text style={[styles.accessButtonText, { color: theme.white }]}>Download</Text>
          </TouchableOpacity>
        )}
        {lab.video_url && (
          <TouchableOpacity 
            style={[styles.accessButton, { backgroundColor: theme.videoBtn }]} 
            onPress={() => handleOpenLink(lab.video_url)}
          >
            <MaterialIcons name="videocam" size={18} color={theme.white} />
            <Text style={[styles.accessButtonText, { color: theme.white }]}>Watch</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: { 
    borderRadius: 12, 
    marginHorizontal: 15, 
    marginVertical: 8, 
    padding: 15, 
    elevation: 3, 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    borderWidth: 1 
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
    flex: 1 
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center'
  },
  menuBtn: { 
    padding: 5,
    marginLeft: 5 
  },
  iconImage: { 
    width: 45, 
    height: 45, 
    borderRadius: 8, 
    marginRight: 12 
  },
  title: { 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  subtitle: { 
    fontSize: 13, 
    fontStyle: 'italic',
    marginTop: 2
  },
  metaInfo: { 
    fontSize: 13, 
    marginBottom: 8 
  },
  metaBold: { 
    fontWeight: '600' 
  },
  timeInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 6, 
    paddingHorizontal: 8, 
    borderRadius: 6, 
    marginBottom: 10,
    alignSelf: 'flex-start'
  },
  timeText: { 
    marginLeft: 6, 
    fontWeight: 'bold', 
    fontSize: 13 
  },
  description: { 
    fontSize: 14, 
    lineHeight: 20, 
    marginBottom: 15 
  },
  accessButtonsContainer: { 
    flexDirection: 'row', 
    gap: 10 
  },
  accessButton: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingVertical: 10, 
    borderRadius: 8, 
    flex: 1 
  },
  accessButtonText: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    marginLeft: 6 
  },
});