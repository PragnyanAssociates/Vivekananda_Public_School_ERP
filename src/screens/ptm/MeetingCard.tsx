import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, Dimensions } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

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

// --- DISPLAY FORMATTER ---
const formatMeetingDate = (isoDate: string): string => {
  if (!isoDate) return 'Invalid Date';
  
  // Backend now returns "YYYY-MM-DDTHH:mm:ss" string.
  // We ensure "T" is present so new Date() treats it as ISO-8601 Local Time (Node/Browser standard).
  // This avoids any timezone offset calculation.
  const dateStr = isoDate.includes("T") ? isoDate : isoDate.replace(" ", "T");
  const date = new Date(dateStr);
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).format(date);
};

export const MeetingCard = ({ meeting, isAdmin, onEdit, onDelete, onJoin }: MeetingCardProps) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const theme = {
    cardBg: isDark ? '#1E1E1E' : '#ffffff',
    textMain: isDark ? '#E0E0E0' : '#2d3748',
    textSub: isDark ? '#B0BEC5' : '#718096',
    icon: isDark ? '#80CBC4' : '#008080', 
    noteBg: isDark ? '#2C2C2C' : '#f7f9fc',
    noteBorder: isDark ? '#424242' : '#e2e8f0',
    borderColor: isDark ? '#333' : '#e2e8f0',
    shadow: isDark ? '#000' : '#000'
  };

  const canJoin = meeting.status === 'Scheduled' && meeting.meeting_link && onJoin;

  return (
    <View style={[styles.cardContainer, { backgroundColor: theme.cardBg, shadowColor: theme.shadow }]}>
      <View style={[styles.cardHeader, { borderBottomColor: theme.borderColor }]}>
        <View style={styles.headerLeft}>
            <Text style={[styles.iconEmoji]}>🗓️</Text>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerDate, { color: theme.textMain }]}>{formatMeetingDate(meeting.meeting_datetime)}</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSub }]}>Parent-Teacher Meeting</Text>
            </View>
        </View>

        {isAdmin && onEdit && onDelete && (
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => onEdit(meeting)} style={[styles.actionBtn, styles.editBtn]}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDelete(meeting.id)} style={[styles.actionBtn, styles.deleteBtn]}>
                <Text style={styles.deleteBtnText}>Del</Text>
              </TouchableOpacity>
            </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.detailRow}>
            <Text style={styles.iconEmoji}>🧑‍🏫</Text>
            <Text style={[styles.detailText, { color: theme.textMain }]}>Teacher: {meeting.teacher_name}</Text>
        </View>
        <View style={styles.detailRow}>
            <Text style={styles.iconEmoji}>🏫</Text>
            <Text style={[styles.detailText, { color: theme.textMain }]}>Class: {meeting.class_group}</Text>
        </View>
        <View style={styles.detailRow}>
            <Text style={styles.iconEmoji}>💬</Text>
            <Text style={[styles.detailText, { color: theme.textMain }]}>Subject: {meeting.subject_focus}</Text>
        </View>
        <View style={styles.detailRow}>
            <Text style={styles.iconEmoji}>ℹ️</Text>
            <Text style={[styles.detailText, { color: theme.textMain }]}>Status: </Text>
            <View style={[styles.statusPill, meeting.status === 'Scheduled' ? styles.scheduledPill : styles.completedPill]}>
                <Text style={meeting.status === 'Scheduled' ? styles.scheduledText : styles.completedText}>{meeting.status}</Text>
            </View>
        </View>
      </View>

      {meeting.notes ? (
        <View style={styles.notesContainer}>
          <Text style={[styles.notesTitle, { color: theme.textSub }]}>Notes/Summary:</Text>
          <View style={[styles.notesBox, { backgroundColor: theme.noteBg, borderColor: theme.noteBorder }]}>
            <Text style={[styles.notesText, { color: theme.textMain }]}>{meeting.notes}</Text>
          </View>
        </View>
      ) : null}

      {canJoin && (
        <TouchableOpacity style={styles.joinButton} onPress={() => onJoin(meeting.meeting_link!)}>
            <MaterialIcons name="videocam" size={18} color="white" />
            <Text style={styles.joinButtonText}>Join Meeting</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
    cardContainer: { borderRadius: 12, padding: 16, width: '95%', alignSelf: 'center', marginVertical: 8, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 3 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 5 },
    cardActions: { flexDirection: 'row', gap: 6 },
    actionBtn: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6 },
    editBtn: { backgroundColor: '#ffc107' },
    editBtnText: { color: 'black', fontWeight: '600', fontSize: 12 },
    deleteBtn: { backgroundColor: '#f44336' },
    deleteBtnText: { color: 'white', fontWeight: '600', fontSize: 12 },
    iconEmoji: { fontSize: 20, marginRight: 10 },
    headerTextContainer: { flex: 1 },
    headerDate: { fontSize: 16, fontWeight: '700' },
    headerSubtitle: { fontSize: 12, marginTop: 2 },
    cardBody: { gap: 8 },
    detailRow: { flexDirection: 'row', alignItems: 'center' },
    detailText: { fontSize: 14, flexShrink: 1 },
    statusPill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 12, marginLeft: 5 },
    scheduledPill: { backgroundColor: 'rgba(24, 144, 255, 0.1)' },
    completedPill: { backgroundColor: 'rgba(82, 196, 26, 0.1)' },
    scheduledText: { color: '#1890ff', fontWeight: '600', fontSize: 12 },
    completedText: { color: '#52c41a', fontWeight: '600', fontSize: 12 },
    notesContainer: { marginTop: 15 },
    notesTitle: { fontSize: 12, fontWeight: '600', marginBottom: 5 },
    notesBox: { borderWidth: 1, borderRadius: 8, padding: 10 },
    notesText: { fontSize: 14, lineHeight: 20 },
    joinButton: { flexDirection: 'row', backgroundColor: '#5a67d8', paddingVertical: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 15 },
    joinButtonText: { color: 'white', fontWeight: 'bold', marginLeft: 8, fontSize: 14 }
});