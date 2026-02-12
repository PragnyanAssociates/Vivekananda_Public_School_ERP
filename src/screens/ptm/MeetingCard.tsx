import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, Alert, Dimensions } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

export interface Meeting {
  id: number;
  meeting_datetime: string;
  teacher_id: number;
  teacher_name: string;
  class_group: string;
  subject_focus: string;
  status: 'Scheduled' | 'Completed' | string;
  notes: string | null;
  meeting_link?: string | null;
}

interface MeetingCardProps {
  meeting: Meeting;
  isAdmin: boolean; 
  onEdit?: (meeting: Meeting) => void;
  onDelete?: (id: number) => void;
  onJoin?: (link: string) => void; 
}

// --- THEME CONFIGURATION ---
const LightColors = {
  cardBg: '#FFFFFF',
  textMain: '#263238',
  textSub: '#546E7A',
  icon: '#008080',
  noteBg: '#F5F7FA',
  noteBorder: '#CFD8DC',
  borderColor: '#ECEFF1',
  shadow: '#000',
  success: '#10b981',
  blue: '#3b82f6'
};

const DarkColors = {
  cardBg: '#1E1E1E',
  textMain: '#E0E0E0',
  textSub: '#B0B0B0',
  icon: '#80CBC4',
  noteBg: '#2C2C2C',
  noteBorder: '#333333',
  borderColor: '#333333',
  shadow: '#000',
  success: '#10b981',
  blue: '#3b82f6'
};

const formatMeetingDate = (isoDate: string): string => {
  if (!isoDate) return 'Invalid Date';
  const dateStr = isoDate.includes("T") ? isoDate : isoDate.replace(" ", "T");
  const date = new Date(dateStr);
  
  if(isNaN(date.getTime())) return isoDate;

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).format(date);
};

export const MeetingCard = ({ meeting, isAdmin, onEdit, onDelete, onJoin }: MeetingCardProps) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = isDark ? DarkColors : LightColors;

  const handleMenuPress = () => {
    Alert.alert(
      "Manage Meeting",
      `Options for "${meeting.subject_focus}"`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Edit Details", 
          onPress: () => onEdit && onEdit(meeting) 
        },
        { 
          text: "Delete Record", 
          onPress: () => onDelete && onDelete(meeting.id), 
          style: 'destructive' 
        }
      ]
    );
  };

  const canJoin = meeting.status === 'Scheduled' && meeting.meeting_link && onJoin;

  return (
    <View style={[styles.cardContainer, { backgroundColor: colors.cardBg, shadowColor: colors.shadow }]}>
      <View style={[styles.cardHeader, { borderBottomColor: colors.borderColor }]}>
        <View style={styles.headerLeft}>
            <MaterialIcons name="event" size={24} color={colors.icon} style={styles.headerIcon} />
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerDate, { color: colors.textMain }]}>{formatMeetingDate(meeting.meeting_datetime)}</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSub }]}>Parent-Teacher Meeting</Text>
            </View>
        </View>

        {isAdmin && (
            <TouchableOpacity 
                onPress={handleMenuPress} 
                style={styles.menuButton}
                hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
            >
                <MaterialIcons name="more-vert" size={24} color={colors.textSub} />
            </TouchableOpacity>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.detailRow}>
            <MaterialIcons name="person" size={18} color={colors.textSub} style={styles.bodyIcon} />
            <Text style={[styles.detailText, { color: colors.textMain }]}>Teacher: {meeting.teacher_name}</Text>
        </View>
        <View style={styles.detailRow}>
            <MaterialIcons name="class" size={18} color={colors.textSub} style={styles.bodyIcon} />
            <Text style={[styles.detailText, { color: colors.textMain }]}>Class: {meeting.class_group}</Text>
        </View>
        <View style={styles.detailRow}>
            <MaterialIcons name="topic" size={18} color={colors.textSub} style={styles.bodyIcon} />
            <Text style={[styles.detailText, { color: colors.textMain }]}>Subject: {meeting.subject_focus}</Text>
        </View>
        <View style={styles.detailRow}>
            <MaterialIcons name="info-outline" size={18} color={colors.textSub} style={styles.bodyIcon} />
            <Text style={[styles.detailText, { color: colors.textMain }]}>Status: </Text>
            <View style={[
              styles.statusPill, 
              meeting.status === 'Scheduled' 
                ? { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)' } 
                : { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)' }
            ]}>
                <Text style={[
                  styles.statusText, 
                  { color: meeting.status === 'Scheduled' ? colors.blue : colors.success }
                ]}>
                  {meeting.status}
                </Text>
            </View>
        </View>
      </View>

      {meeting.notes ? (
        <View style={styles.notesContainer}>
          <Text style={[styles.notesTitle, { color: colors.textSub }]}>Notes/Summary:</Text>
          <View style={[styles.notesBox, { backgroundColor: colors.noteBg, borderColor: colors.noteBorder }]}>
            <Text style={[styles.notesText, { color: colors.textMain }]}>{meeting.notes}</Text>
          </View>
        </View>
      ) : null}

      {canJoin && (
        <TouchableOpacity style={[styles.joinButton, { backgroundColor: colors.icon }]} onPress={() => onJoin(meeting.meeting_link!)}>
            <MaterialIcons name="videocam" size={18} color="white" />
            <Text style={styles.joinButtonText}>Join Meeting</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
    cardContainer: { 
        borderRadius: 12, padding: 16, width: '95%', alignSelf: 'center', 
        marginVertical: 6, shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 3 
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 5 },
    headerIcon: { marginRight: 10 },
    menuButton: { padding: 4, marginLeft: 10 },
    headerTextContainer: { flex: 1 },
    headerDate: { fontSize: 16, fontWeight: '700' },
    headerSubtitle: { fontSize: 12, marginTop: 2 },
    
    cardBody: { gap: 8 },
    detailRow: { flexDirection: 'row', alignItems: 'center' },
    bodyIcon: { marginRight: 10, width: 20 },
    detailText: { fontSize: 14, flexShrink: 1 },
    
    statusPill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 12, marginLeft: 5 },
    statusText: { fontWeight: '600', fontSize: 12 },
    
    notesContainer: { marginTop: 15 },
    notesTitle: { fontSize: 12, fontWeight: '600', marginBottom: 5 },
    notesBox: { borderWidth: 1, borderRadius: 8, padding: 10 },
    notesText: { fontSize: 14, lineHeight: 20 },
    
    joinButton: { flexDirection: 'row', paddingVertical: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 15 },
    joinButtonText: { color: 'white', fontWeight: 'bold', marginLeft: 8, fontSize: 14 }
});