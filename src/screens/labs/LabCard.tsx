// 📂 File: src/screens/labs/LabCard.tsx

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking, Alert } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { SERVER_URL } from '../../../apiConfig';

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
  const canManage = onEdit && onDelete;

  // Standardization: Single Alert Menu like Pre-Admissions
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
    <View style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Image source={imageSource} style={styles.iconImage} />
          <View style={{flex: 1}}>
            <Text style={styles.title}>{lab.title}</Text>
            <Text style={styles.subtitle}>
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
            <MaterialIcons name="more-vert" size={26} color="#546E7A" />
          </TouchableOpacity>
        )}
      </View>
      
      <Text style={styles.metaInfo}>
        For: <Text style={styles.metaBold}>{lab.class_group || 'All Classes'}</Text>
        {lab.teacher_name && `  |  By: `}
        {lab.teacher_name && <Text style={styles.metaBold}>{lab.teacher_name}</Text>}
      </Text>

      {formattedDateTime && (
        <View style={styles.timeInfo}>
          <MaterialIcons name="event" size={16} color="#d84315" />
          <Text style={styles.timeText}>{formattedDateTime}</Text>
        </View>
      )}

      <Text style={styles.description} numberOfLines={3}>{lab.description}</Text>
      
      <View style={styles.accessButtonsContainer}>
        {lab.file_path && (
          <TouchableOpacity style={[styles.accessButton, styles.fileButton]} onPress={handleOpenFile}>
            <MaterialIcons name="file-download" size={18} color="#fff" />
            <Text style={styles.accessButtonText}>Download</Text>
          </TouchableOpacity>
        )}
        {lab.video_url && (
          <TouchableOpacity style={[styles.accessButton, styles.videoButton]} onPress={() => handleOpenLink(lab.video_url)}>
            <MaterialIcons name="videocam" size={18} color="#fff" />
            <Text style={styles.accessButtonText}>Watch</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
    cardContainer: { backgroundColor: '#ffffff', borderRadius: 12, marginHorizontal: 15, marginVertical: 8, padding: 15, elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: '#f0f0f0' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    menuBtn: { padding: 5 },
    iconImage: { width: 45, height: 45, borderRadius: 8, marginRight: 12 },
    title: { fontSize: 18, fontWeight: 'bold', color: '#263238' },
    subtitle: { fontSize: 13, color: '#546E7A', fontStyle: 'italic' },
    metaInfo: { fontSize: 13, color: '#78909C', marginBottom: 8 },
    metaBold: { fontWeight: '600', color: '#455A64' },
    timeInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', padding: 6, borderRadius: 6, marginBottom: 10 },
    timeText: { marginLeft: 6, color: '#D84315', fontWeight: 'bold', fontSize: 13 },
    description: { fontSize: 14, color: '#546E7A', lineHeight: 20, marginBottom: 15 },
    accessButtonsContainer: { flexDirection: 'row', gap: 10 },
    accessButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderRadius: 8, flex: 1 },
    fileButton: { backgroundColor: '#43A047' },
    videoButton: { backgroundColor: '#E53935' },
    accessButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginLeft: 6 },
});