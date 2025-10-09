import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Linking, LayoutAnimation, UIManager, Platform } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable'; // ✨ NEW: Import animatable
import { pick, types, isCancel } from '@react-native-documents/picker';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';

// ✨ NEW: Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const StudentHomeworkScreen = () => {
    const { user } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(null);

    const fetchAssignments = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/homework/student/${user.id}/${user.class_group}`);
            const data = response.data;
            
            data.sort((a, b) => {
                if (a.status === 'Pending' && b.status !== 'Pending') return -1;
                if (a.status !== 'Pending' && b.status === 'Pending') return 1;
                return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
            });
            setAssignments(data);
        } catch (e: any) { Alert.alert("Error", e.response?.data?.message || "Failed to fetch assignments."); } 
        finally { setIsLoading(false); }
    }, [user]);

    useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

    const handleSubmission = async (assignmentId) => {
        if (!user) return;

        try {
            const result = await pick({ type: [types.allFiles], allowMultiSelection: false });

            if (!result || result.length === 0) {
                console.log('User closed picker without selecting a file.');
                return;
            }
            const fileToUpload = result[0];

            setIsSubmitting(assignmentId);
            const formData = new FormData();
            formData.append('student_id', user.id.toString());
            formData.append('submission', { uri: fileToUpload.uri, type: fileToUpload.type, name: fileToUpload.name });

            // ✨ NEW: Animate the layout change before fetching new data
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            await apiClient.post(`/homework/submit/${assignmentId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            
            Alert.alert("Success", "Homework submitted!");
            fetchAssignments();

        } catch (err: any) {
            if (isCancel(err)) { console.log('User cancelled submission.'); } 
            else { console.error("Submission Error:", err); Alert.alert("Error", err.response?.data?.message || "Could not submit file."); }
        } finally { setIsSubmitting(null); }
    };
    
    const handleDeleteSubmission = async (submissionId, assignmentId) => {
        if (!user) return;
        Alert.alert( "Delete Submission", "Are you sure you want to delete your submission? This action cannot be undone.", [ { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive",
            onPress: async () => {
                setIsSubmitting(assignmentId); 
                try {
                    // ✨ NEW: Animate the layout change before fetching new data
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    await apiClient.delete(`/homework/submission/${submissionId}`, { data: { student_id: user.id } });
                    Alert.alert("Success", "Your submission has been deleted.");
                    fetchAssignments(); 
                } catch (err: any) {
                    Alert.alert("Error", err.response?.data?.message || "Could not delete submission.");
                } finally { setIsSubmitting(null); }
            },
        }, ]);
    };

    if (isLoading && assignments.length === 0) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#FF7043" /></View>;
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={assignments}
                keyExtractor={(item) => item.id.toString()}
                // ✨ MODIFIED: Pass index to the AssignmentCard for staggered animation
                renderItem={({ item, index }) => (
                    <AssignmentCard 
                        item={item} 
                        index={index}
                        onSubmit={handleSubmission} 
                        onDelete={handleDeleteSubmission}
                        isSubmitting={isSubmitting === item.id} 
                    />
                )}
                ListHeaderComponent={<Header />}
                ListEmptyComponent={<Text style={styles.emptyText}>No homework assigned yet.</Text>}
                onRefresh={fetchAssignments}
                refreshing={isLoading}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
};

const Header = () => (
    // ✨ MODIFIED: Add entrance animation to header
    <Animatable.View animation="fadeInDown" duration={600} style={styles.header}>
        <View style={styles.iconCircle}>
            <MaterialIcons name="edit" size={24} color="#fff" />
        </View>
        <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Assignments & Homework</Text>
            <Text style={styles.headerSubtitle}>Track upcoming and submitted assignments.</Text>
        </View>
    </Animatable.View>
);

// ✨ MODIFIED: Accept 'index' prop for animation delay
const AssignmentCard = ({ item, onSubmit, onDelete, isSubmitting, index }) => {
    const getStatusInfo = () => {
        const statusText = item.submission_id ? (item.status || 'Submitted') : 'Pending';
        switch (statusText) {
            case 'Graded': return { text: 'Graded', color: '#42a5f5', icon: 'check-circle' };
            case 'Submitted': return { text: 'Submitted', color: '#66bb6a', icon: 'check' };
            default: return { text: 'Pending', color: '#ffa726', icon: 'pending' };
        }
    };

    const status = getStatusInfo();
    const handleViewAttachment = () => { if(item.attachment_path) Linking.openURL(`${SERVER_URL}${item.attachment_path}`); };

    return (
        // ✨ MODIFIED: Wrap card in animatable view for staggered entrance
        <Animatable.View style={[styles.card, { borderLeftColor: status.color }]} animation="fadeInUp" duration={600} delay={index * 120}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
                    <MaterialIcons name={status.icon} size={14} color="#fff" />
                    <Text style={styles.statusText}>{status.text}</Text>
                </View>
            </View>
            <Text style={styles.description}>{item.description}</Text>
            
            <View style={styles.detailsGrid}>
                <DetailRow icon="book" label="Subject" value={item.subject} />
                <DetailRow icon="event" label="Due Date" value={new Date(item.due_date).toLocaleDateString()} />
                {item.submitted_at && <DetailRow icon="event-available" label="Submitted" value={new Date(item.submitted_at).toLocaleDateString()} />}
            </View>
            
            {status.text === 'Graded' && item.grade && (
                // ✨ MODIFIED: Animate the graded section when it appears
                <Animatable.View animation="fadeIn" duration={400} style={styles.gradedSection}>
                    <DetailRow icon="school" label="Grade" value={item.grade} />
                    {item.remarks && <Text style={styles.remarksText}>Remarks: {item.remarks}</Text>}
                </Animatable.View>
            )}
            
            <View style={styles.buttonRow}>
                {item.attachment_path && (
                    <TouchableOpacity style={styles.detailsButton} onPress={handleViewAttachment}>
                        <MaterialIcons name="attachment" size={18} color="#42a5f5" />
                        <Text style={styles.detailsButtonText}>View Attachment</Text>
                    </TouchableOpacity>
                )}
                {item.submission_id && status.text !== 'Graded' ? (
                    <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(item.submission_id, item.id)} disabled={isSubmitting}>
                        {isSubmitting ? 
                            <ActivityIndicator size="small" color="#fff" /> : 
                            <><MaterialIcons name="delete" size={18} color="#fff" /><Text style={styles.submitButtonText}>Delete Submission</Text></>
                        }
                    </TouchableOpacity>
                ) : !item.submission_id && (
                    <TouchableOpacity style={styles.submitButton} onPress={() => onSubmit(item.id)} disabled={isSubmitting}>
                        {isSubmitting ? 
                            <ActivityIndicator size="small" color="#fff" /> : 
                            <><MaterialIcons name="upload-file" size={18} color="#fff" /><Text style={styles.submitButtonText}>Submit Homework</Text></>
                        }
                    </TouchableOpacity>
                )}
            </View>
        </Animatable.View>
    );
};

const DetailRow = ({ icon, label, value }) => (
    <View style={styles.detailRow}>
        <MaterialIcons name={icon} size={16} color="#546e7a" />
        <Text style={styles.detailLabel}>{label}:</Text>
        <Text style={styles.detailValue}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f8' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 10 },
    iconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FF7043', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    headerTextContainer: { flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#263238' },
    headerSubtitle: { fontSize: 14, color: '#546e7a' },
    card: { backgroundColor: '#fff', borderRadius: 8, marginHorizontal: 15, marginVertical: 8, padding: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, borderLeftWidth: 5 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#37474f', flex: 1, marginRight: 10 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
    statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
    description: { fontSize: 14, color: '#546e7a', marginBottom: 15, lineHeight: 20 },
    detailsGrid: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    detailLabel: { marginLeft: 10, fontSize: 14, color: '#546e7a', fontWeight: '500' },
    detailValue: { fontSize: 14, color: '#263238', flexShrink: 1 },
    gradedSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    remarksText: { marginTop: 5, fontStyle: 'italic', color: '#37474f', backgroundColor: '#f9f9f9', padding: 8, borderRadius: 4 },
    buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    detailsButton: { flexDirection: 'row', alignItems: 'center', padding: 8, marginRight: 'auto' },
    detailsButtonText: { color: '#42a5f5', marginLeft: 5, fontWeight: 'bold' },
    submitButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#66bb6a', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, elevation: 2 },
    deleteButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ef5350', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, elevation: 2 },
    submitButtonText: { color: '#fff', marginLeft: 8, fontWeight: 'bold' },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#777' },
});

export default StudentHomeworkScreen;