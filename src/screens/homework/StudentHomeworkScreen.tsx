import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, 
    Alert, Linking, LayoutAnimation, UIManager, Platform, SafeAreaView, Modal, ScrollView 
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import { pick, types, isCancel } from '@react-native-documents/picker';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useNavigation, useIsFocused } from '@react-navigation/native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- COLORS ---
const COLORS = {
    primary: '#008080',    // Teal
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    success: '#43A047',
    warning: '#ffa726',
    info: '#42a5f5',
    danger: '#ef5350',
    border: '#CFD8DC'
};

const StudentHomeworkScreen = () => {
    const { user } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // --- NEW: State for Submission Modal ---
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [activeAssignmentId, setActiveAssignmentId] = useState(null);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false); // Global loading for modal
    
    const navigation = useNavigation();
    const isFocused = useIsFocused();

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
        } catch (e) { Alert.alert("Error", e.response?.data?.message || "Failed to fetch assignments."); } 
        finally { setIsLoading(false); }
    }, [user]);

    useEffect(() => {
        if (isFocused) {
            fetchAssignments();
        }
    }, [fetchAssignments, isFocused]);

    // --- NEW: Open Modal Function ---
    const openSubmissionModal = (assignmentId) => {
        setActiveAssignmentId(assignmentId);
        setSelectedFiles([]); // Reset files
        setIsModalVisible(true);
    };

    // --- NEW: Handle Multi-File Picking ---
    const handlePickFiles = async () => {
        try {
            const results = await pick({ 
                type: [types.allFiles], 
                allowMultiSelection: true // ALLOW MULTIPLE
            });
            if (results && results.length > 0) {
                setSelectedFiles(prev => [...prev, ...results]);
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            }
        } catch (err) {
            if (!isCancel(err)) { 
                Alert.alert("Error", "Could not select files."); 
            }
        }
    };

    // --- NEW: Remove Single File ---
    const removeFile = (indexToRemove) => {
        setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    // --- NEW: Submit All Files ---
    const confirmSubmission = async () => {
        if (!user || !activeAssignmentId) return;
        if (selectedFiles.length === 0) {
            return Alert.alert("Required", "Please attach at least one file.");
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('student_id', user.id.toString());
            
            // Loop through files and append them
            selectedFiles.forEach((file) => {
                formData.append('submissions', { // Key must be 'submissions' (plural) to match updated backend
                    uri: file.uri,
                    type: file.type,
                    name: file.name
                });
            });

            await apiClient.post(`/homework/submit/${activeAssignmentId}`, formData, { 
                headers: { 'Content-Type': 'multipart/form-data' } 
            });
            
            Alert.alert("Success", "Homework submitted successfully!");
            setIsModalVisible(false);
            fetchAssignments();

        } catch (err) {
            console.error("Submission Error:", err); 
            Alert.alert("Error", err.response?.data?.message || "Could not submit files."); 
        } finally { 
            setIsSubmitting(false); 
        }
    };
    
    const handleDeleteSubmission = async (submissionId, assignmentId) => {
        if (!user) return;
        Alert.alert( "Delete Submission", "Are you sure you want to delete your submission? This action cannot be undone.", [ { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive",
            onPress: async () => {
                try {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    await apiClient.delete(`/homework/submission/${submissionId}`, { data: { student_id: user.id } });
                    Alert.alert("Success", "Your submission has been deleted.");
                    fetchAssignments(); 
                } catch (err) {
                    Alert.alert("Error", err.response?.data?.message || "Could not delete submission.");
                }
            },
        }, ]);
    };

    if (isLoading && assignments.length === 0) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* --- HEADER CARD --- */}
            <View style={styles.headerCard}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <MaterialIcons name="assignment" size={24} color="#008080" />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Homework</Text>
                        <Text style={styles.headerSubtitle}>My Assignments</Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={assignments}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item, index }) => (
                    <AssignmentCard 
                        item={item} 
                        index={index}
                        onOpenSubmitModal={openSubmissionModal}
                        onDelete={handleDeleteSubmission}
                        navigation={navigation}
                    />
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No homework assigned yet.</Text>}
                onRefresh={fetchAssignments}
                refreshing={isLoading}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
            />

            {/* --- NEW: SUBMISSION MODAL --- */}
            <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Submit Homework</Text>
                        <Text style={styles.modalSubtitle}>Attach your files below</Text>

                        <ScrollView style={styles.fileListContainer}>
                            {selectedFiles.map((file, index) => (
                                <View key={index} style={styles.fileItem}>
                                    <View style={styles.fileInfo}>
                                        <MaterialIcons name="insert-drive-file" size={20} color={COLORS.textSub} />
                                        <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => removeFile(index)} style={styles.removeFileBtn}>
                                        <MaterialIcons name="close" size={16} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            <TouchableOpacity style={styles.addMoreBtn} onPress={handlePickFiles}>
                                <MaterialIcons name="add" size={20} color={COLORS.primary} />
                                <Text style={styles.addMoreText}>Add Files</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsModalVisible(false)} disabled={isSubmitting}>
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn]} onPress={confirmSubmission} disabled={isSubmitting}>
                                {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonText}>Submit</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const AssignmentCard = ({ item, onOpenSubmitModal, onDelete, index, navigation }) => {
    
    const formatDateDisplay = (isoDateString) => {
        if (!isoDateString) return '';
        const d = new Date(isoDateString);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    const getStatusInfo = () => {
        const statusText = item.submission_id ? (item.status || 'Submitted') : 'Pending';
        switch (statusText) {
            case 'Graded': return { text: 'Graded', color: COLORS.info, icon: 'check-circle' };
            case 'Submitted': return { text: 'Submitted', color: COLORS.success, icon: 'check' };
            default: return { text: 'Pending', color: COLORS.warning, icon: 'pending' };
        }
    };

    const status = getStatusInfo();
    
    const getAttachments = () => {
        if (!item.attachment_path) return [];
        try {
            if (item.attachment_path.trim().startsWith('[')) {
                return JSON.parse(item.attachment_path);
            }
            return [item.attachment_path];
        } catch (e) {
            return [item.attachment_path];
        }
    };

    const attachments = getAttachments();

    const renderSubmissionContent = () => {
        if (item.submission_id) {
            return (
                <>
                    {item.written_answer && (
                         <View style={styles.submittedAnswerContainer}>
                            <Text style={styles.submittedAnswerLabel}>Your Answer:</Text>
                            <Text style={styles.submittedAnswerText} numberOfLines={3}>{item.written_answer}</Text>
                        </View>
                    )}
                    <View style={styles.buttonRow}>
                        {status.text !== 'Graded' && (
                            <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(item.submission_id, item.id)}>
                                <MaterialIcons name="delete" size={18} color="#fff" />
                                <Text style={styles.submitButtonText}>Delete Submission</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </>
            );
        }
        
        if (item.homework_type === 'Written') {
            return (
                <View style={styles.buttonRow}>
                    <TouchableOpacity style={styles.submitButton} onPress={() => navigation.navigate('WrittenAnswerScreen', { assignment: item })}>
                        <MaterialIcons name="edit" size={18} color="#fff" />
                        <Text style={styles.submitButtonText}>Start Answering</Text>
                    </TouchableOpacity>
                </View>
            );
        } else {
            return (
                <View style={styles.buttonRow}>
                    {/* Changed: Calls onOpenSubmitModal instead of direct upload */}
                    <TouchableOpacity style={styles.submitButton} onPress={() => onOpenSubmitModal(item.id)}>
                        <MaterialIcons name="upload-file" size={18} color="#fff" />
                        <Text style={styles.submitButtonText}>Submit Homework</Text>
                    </TouchableOpacity>
                </View>
            );
        }
    };

    return (
        <Animatable.View style={[styles.card, { borderLeftColor: status.color }]} animation="fadeInUp" duration={600} delay={index * 100}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
                    <MaterialIcons name={status.icon} size={14} color="#fff" />
                    <Text style={styles.statusText}>{status.text}</Text>
                </View>
            </View>
            <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
            
            <View style={styles.detailsGrid}>
                <DetailRow icon="category" label="Type" value={item.homework_type || 'PDF'} />
                <DetailRow icon="book" label="Subject" value={item.subject} />
                <DetailRow icon="event" label="Due Date" value={formatDateDisplay(item.due_date)} />
                {item.submitted_at && <DetailRow icon="event-available" label="Submitted" value={formatDateDisplay(item.submitted_at)} />}
            </View>
            
            {status.text === 'Graded' && item.grade && (
                <Animatable.View animation="fadeIn" duration={400} style={styles.gradedSection}>
                    <DetailRow icon="school" label="Grade" value={item.grade} />
                    {item.remarks && <Text style={styles.remarksText}>Remarks: {item.remarks}</Text>}
                </Animatable.View>
            )}

            {attachments.length > 0 && (
                <View style={{marginTop: 10}}>
                    {attachments.map((path, idx) => (
                        <TouchableOpacity key={idx} style={styles.attachmentButton} onPress={() => Linking.openURL(`${SERVER_URL}${path}`)}>
                            <MaterialIcons name="attachment" size={18} color={COLORS.info} />
                            <Text style={styles.detailsButtonText}>
                                {attachments.length > 1 ? `Attachment ${idx + 1}` : "View Teacher's Attachment"}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {renderSubmissionContent()}
        </Animatable.View>
    );
};

const DetailRow = ({ icon, label, value }) => ( 
    <View style={styles.detailRow}>
        <MaterialIcons name={icon} size={16} color={COLORS.textSub} />
        <Text style={styles.detailLabel}>{label}:</Text>
        <Text style={styles.detailValue}>{value}</Text>
    </View> 
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Header
    headerCard: {
        backgroundColor: COLORS.cardBg,
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 3,
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        backgroundColor: '#E0F2F1',
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain },
    headerSubtitle: { fontSize: 13, color: COLORS.textSub },

    // Card Styles
    card: { 
        backgroundColor: COLORS.cardBg, 
        borderRadius: 12, 
        marginBottom: 15, 
        padding: 15, 
        elevation: 2, 
        shadowColor: '#000', 
        shadowOpacity: 0.05, 
        shadowRadius: 3, 
        shadowOffset: { width: 0, height: 1 }, 
        borderLeftWidth: 5 
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, flex: 1, marginRight: 10 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
    statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
    description: { fontSize: 14, color: COLORS.textSub, marginBottom: 15, lineHeight: 20 },
    detailsGrid: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    detailLabel: { marginLeft: 8, fontSize: 14, color: COLORS.textSub, fontWeight: '500' },
    detailValue: { fontSize: 14, color: COLORS.textMain, flexShrink: 1, marginLeft: 5 },
    gradedSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    remarksText: { marginTop: 5, fontStyle: 'italic', color: COLORS.textMain, backgroundColor: '#f9f9f9', padding: 8, borderRadius: 4, fontSize: 13 },
    buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    attachmentButton: { flexDirection: 'row', alignItems: 'center', padding: 8, marginTop: 5, alignSelf: 'flex-start', backgroundColor: '#f0f8ff', borderRadius: 8 },
    detailsButtonText: { color: COLORS.info, marginLeft: 5, fontWeight: 'bold', fontSize: 13 },
    submitButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.success, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, elevation: 2 },
    deleteButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.danger, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, elevation: 2 },
    submitButtonText: { color: '#fff', marginLeft: 8, fontWeight: 'bold', fontSize: 13 },
    submittedAnswerContainer: { marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    submittedAnswerLabel: { fontSize: 14, fontWeight: 'bold', color: COLORS.textSub, marginBottom: 5 },
    submittedAnswerText: { fontSize: 14, color: COLORS.textMain, backgroundColor: '#f1f8e9', padding: 12, borderRadius: 6, lineHeight: 20 },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: COLORS.textSub },

    // --- NEW: Modal Styles ---
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', backgroundColor: '#fff', borderRadius: 15, padding: 20, maxHeight: '80%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain, textAlign: 'center', marginBottom: 5 },
    modalSubtitle: { fontSize: 14, color: COLORS.textSub, textAlign: 'center', marginBottom: 15 },
    fileListContainer: { maxHeight: 300, marginBottom: 15 },
    fileItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
    fileInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
    fileName: { marginLeft: 10, fontSize: 14, color: COLORS.textMain, flex: 1 },
    removeFileBtn: { backgroundColor: '#f37b8d', borderRadius: 15, width: 26, height: 26, justifyContent: 'center', alignItems: 'center' },
    addMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, marginTop: 5 },
    addMoreText: { color: COLORS.primary, fontWeight: 'bold', marginLeft: 5 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    cancelBtn: { backgroundColor: '#90A4AE' },
    confirmBtn: { backgroundColor: COLORS.success },
    modalButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

export default StudentHomeworkScreen;