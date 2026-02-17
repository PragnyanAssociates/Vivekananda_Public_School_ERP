import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, 
    Alert, Linking, LayoutAnimation, UIManager, Platform, SafeAreaView, Modal, ScrollView,
    useColorScheme, StatusBar, Dimensions, Image
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import { pick, types, isCancel } from '@react-native-documents/picker';
import Pdf from 'react-native-pdf';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';
import { useNavigation, useIsFocused } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- THEME COLORS ---
const LightColors = {
    primary: '#008080',
    background: '#F5F7FA',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    inputBg: '#FAFAFA',
    iconGrey: '#90A4AE',
    danger: '#E53935',
    success: '#43A047',
    warning: '#FFA000',
    info: '#1E88E5',
    headerIconBg: '#E0F2F1',
    modalOverlay: 'rgba(0,0,0,0.6)',
    divider: '#f0f2f5',
    fileItemBg: '#f9f9f9',
    viewerBg: '#000000',
    gradeBg: '#FFF9C4',
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    iconGrey: '#757575',
    danger: '#EF5350',
    success: '#66BB6A',
    warning: '#FFA726',
    info: '#42A5F5',
    headerIconBg: '#333333',
    modalOverlay: 'rgba(255,255,255,0.1)',
    divider: '#2C2C2C',
    fileItemBg: '#2C2C2C',
    viewerBg: '#000000',
    gradeBg: '#3E2723',
};

const StudentHomeworkScreen = () => {
    const { user } = useAuth();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const [assignments, setAssignments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // --- Submission Modal ---
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [activeAssignmentId, setActiveAssignmentId] = useState(null);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Viewers ---
    const [isViewerVisible, setIsViewerVisible] = useState(false);
    const [currentFile, setCurrentFile] = useState({ uri: '', type: '', name: '' });
    const [isAnswerModalVisible, setIsAnswerModalVisible] = useState(false);
    const [selectedAnswerDetails, setSelectedAnswerDetails] = useState(null);
    
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    const fetchAssignments = useCallback(async () => {
        if (!user || !user.id) return;

        // FIX: If no class group, don't fetch to avoid errors
        if (!user.class_group) {
            setIsLoading(false);
            setAssignments([]);
            return;
        }

        setIsLoading(true);
        try {
            // FIX: Encode URI to handle slashes in class names (e.g. "10/A")
            const safeClassGroup = encodeURIComponent(user.class_group);
            const response = await apiClient.get(`/homework/student/${user.id}/${safeClassGroup}`);
            
            const data = Array.isArray(response.data) ? response.data : [];
            data.sort((a, b) => {
                if (a.status === 'Pending' && b.status !== 'Pending') return -1;
                if (a.status !== 'Pending' && b.status === 'Pending') return 1;
                return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
            });
            setAssignments(data);
        } catch (e) { 
            console.error("Fetch Error:", e);
            if (e.response && e.response.status === 404) {
                 setAssignments([]); 
            } else {
                 Alert.alert("Error", e.response?.data?.message || "Failed to fetch assignments."); 
            }
        } finally { 
            setIsLoading(false); 
        }
    }, [user]);

    useEffect(() => {
        if (isFocused) {
            fetchAssignments();
        }
    }, [fetchAssignments, isFocused]);

    const openSubmissionModal = (assignmentId) => {
        setActiveAssignmentId(assignmentId);
        setSelectedFiles([]); 
        setIsModalVisible(true);
    };

    const handlePickFiles = async () => {
        try {
            const results = await pick({ type: [types.allFiles], allowMultiSelection: true });
            if (results && results.length > 0) {
                setSelectedFiles(prev => [...prev, ...results]);
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            }
        } catch (err) { if (!isCancel(err)) Alert.alert("Error", "Could not select files."); }
    };

    const removeFile = (indexToRemove) => {
        setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    const confirmSubmission = async () => {
        if (!user || !activeAssignmentId) return;
        if (selectedFiles.length === 0) return Alert.alert("Required", "Please attach at least one file.");

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('student_id', user.id.toString());
            selectedFiles.forEach((file) => {
                formData.append('submissions', { uri: file.uri, type: file.type, name: file.name });
            });
            await apiClient.post(`/homework/submit/${activeAssignmentId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            
            Alert.alert("Success", "Homework submitted successfully!");
            setIsModalVisible(false);
            fetchAssignments();
        } catch (err) {
            if (err.response && typeof err.response.data === 'string' && err.response.data.includes('<!DOCTYPE html>')) {
                Alert.alert("Connection Error", "The app cannot reach the server.");
            } else {
                Alert.alert("Error", err.response?.data?.message || "Could not submit files."); 
            }
        } finally { setIsSubmitting(false); }
    };
    
    const handleDeleteSubmission = async (submissionId, assignmentId) => {
        if (!user) return;
        Alert.alert( "Delete Submission", "Are you sure?", [ { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive",
            onPress: async () => {
                try {
                    await apiClient.delete(`/homework/submission/${submissionId}`, { data: { student_id: user.id } });
                    Alert.alert("Success", "Your submission has been deleted.");
                    fetchAssignments(); 
                } catch (err) { Alert.alert("Error", "Could not delete submission."); }
            },
        }, ]);
    };

    const openDocumentViewer = (fileUrl, fileName) => {
        const url = `${SERVER_URL}${fileUrl}`;
        const extension = fileUrl.split('.').pop().toLowerCase();
        let type = 'unknown';
        if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) type = 'image';
        else if (extension === 'pdf') type = 'pdf';

        if (type === 'unknown') {
            Alert.alert('Cannot View', 'This file type is not supported. Open externally?', [{ text: 'Yes', onPress: () => Linking.openURL(url) }, { text: 'No' }]);
        } else {
            setCurrentFile({ uri: url, type, name: fileName || 'Document' });
            setIsViewerVisible(true);
        }
    };

    const viewWrittenAnswer = (assignment) => {
        setSelectedAnswerDetails(assignment);
        setIsAnswerModalVisible(true);
    };

    if (isLoading && assignments.length === 0) {
        return <View style={[styles.centered, { backgroundColor: COLORS.background }]}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
            
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                        <MaterialIcons name="assignment" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Homework</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>{user.class_group ? `Class: ${user.class_group}` : 'No Class Assigned'}</Text>
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
                        colors={COLORS}
                        isDark={isDark}
                        onOpenSubmitModal={openSubmissionModal}
                        onDelete={handleDeleteSubmission}
                        navigation={navigation}
                        onViewFile={openDocumentViewer}
                        onViewWritten={viewWrittenAnswer}
                    />
                )}
                ListEmptyComponent={<View style={styles.centered}><Text style={[styles.emptyText, { color: COLORS.textSub }]}>No homework found.</Text></View>}
                onRefresh={fetchAssignments}
                refreshing={isLoading}
                contentContainerStyle={{ paddingHorizontal: width * 0.04, paddingBottom: 20 }}
            />

            {/* File Submission Modal */}
            <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} animationType="slide" transparent={true}>
                <View style={[styles.modalOverlay, { backgroundColor: COLORS.modalOverlay }]}>
                    <View style={[styles.modalContent, { backgroundColor: COLORS.cardBg }]}>
                        <Text style={[styles.modalTitle, { color: COLORS.textMain }]}>Submit Homework</Text>
                        <Text style={[styles.modalSubtitle, { color: COLORS.textSub }]}>Attach your files below</Text>
                        <ScrollView style={styles.fileListContainer}>
                            {selectedFiles.map((file, index) => (
                                <View key={index} style={[styles.fileItem, { backgroundColor: COLORS.fileItemBg, borderColor: COLORS.border }]}>
                                    <View style={styles.fileInfo}>
                                        <MaterialIcons name="insert-drive-file" size={20} color={COLORS.textSub} />
                                        <Text style={[styles.fileName, { color: COLORS.textMain }]} numberOfLines={1}>{file.name}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => removeFile(index)} style={[styles.removeFileBtn, { backgroundColor: COLORS.danger }]}>
                                        <MaterialIcons name="close" size={16} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            <TouchableOpacity style={[styles.addMoreBtn, { borderColor: COLORS.primary }]} onPress={handlePickFiles}>
                                <MaterialIcons name="add" size={20} color={COLORS.primary} />
                                <Text style={[styles.addMoreText, { color: COLORS.primary }]}>Add Files</Text>
                            </TouchableOpacity>
                        </ScrollView>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.iconGrey }]} onPress={() => setIsModalVisible(false)} disabled={isSubmitting}>
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.success }]} onPress={confirmSubmission} disabled={isSubmitting}>
                                {isSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalButtonText}>Submit</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Document Viewer Modal */}
            <Modal visible={isViewerVisible} onRequestClose={() => setIsViewerVisible(false)} animationType="fade" transparent={true}>
                <View style={[styles.viewerModalContainer, { backgroundColor: COLORS.viewerBg }]}>
                    <SafeAreaView style={styles.viewerSafeArea}>
                        <View style={[styles.viewerHeader, { backgroundColor: COLORS.cardBg, borderBottomColor: COLORS.divider }]}>
                            <Text style={[styles.viewerTitle, { color: COLORS.textMain }]} numberOfLines={1}>{currentFile.name}</Text>
                            <TouchableOpacity onPress={() => setIsViewerVisible(false)} style={styles.closeViewerBtn}>
                                <MaterialIcons name="close" size={24} color={COLORS.textMain} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.viewerContent}>
                            {currentFile.type === 'pdf' && (
                                <Pdf source={{ uri: currentFile.uri, cache: true }} style={styles.pdfView} onError={(error) => console.log(error)} />
                            )}
                            {currentFile.type === 'image' && (
                                <Image source={{ uri: currentFile.uri }} style={styles.imageView} resizeMode="contain" />
                            )}
                        </View>
                    </SafeAreaView>
                </View>
            </Modal>

            {/* Written Answer View Modal */}
            <Modal visible={isAnswerModalVisible} onRequestClose={() => setIsAnswerModalVisible(false)} animationType="slide" transparent={true}>
                <View style={[styles.modalOverlay, { backgroundColor: COLORS.modalOverlay }]}>
                    <View style={[styles.modalContent, { backgroundColor: COLORS.cardBg, height: '70%' }]}>
                        <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 15}}>
                            <Text style={[styles.modalTitle, { color: COLORS.textMain }]}>My Submission</Text>
                            <TouchableOpacity onPress={() => setIsAnswerModalVisible(false)}><MaterialIcons name="close" size={24} color={COLORS.textMain} /></TouchableOpacity>
                        </View>
                        <ScrollView>
                             <Text style={{color: COLORS.textSub, fontWeight:'bold', marginBottom:5}}>Description / Instructions:</Text>
                             <Text style={{color: COLORS.textMain, marginBottom: 15}}>{selectedAnswerDetails?.description || 'N/A'}</Text>
                             
                             <View style={{height:1, backgroundColor: COLORS.divider, marginVertical: 10}}/>

                             <Text style={{color: COLORS.textSub, fontWeight:'bold', marginBottom:5}}>My Answer:</Text>
                             <Text style={{color: COLORS.textMain}}>{selectedAnswerDetails?.written_answer}</Text>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const AssignmentCard = ({ item, onOpenSubmitModal, onDelete, index, navigation, colors, isDark, onViewFile, onViewWritten }) => {
    
    // DD/MM/YYYY Format
    const formatDateDisplay = (isoDateString) => {
        if (!isoDateString) return '';
        const d = new Date(isoDateString);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const getStatusInfo = () => {
        const statusText = item.submission_id ? (item.status || 'Submitted') : 'Pending';
        switch (statusText) {
            case 'Graded': return { text: 'Graded', color: colors.info, icon: 'check-circle' };
            case 'Submitted': return { text: 'Submitted', color: colors.success, icon: 'check' };
            default: return { text: 'Pending', color: colors.warning, icon: 'pending' };
        }
    };
    const status = getStatusInfo();
    
    const getAttachments = () => {
        if (!item.attachment_path) return [];
        try {
            if (item.attachment_path.trim().startsWith('[')) return JSON.parse(item.attachment_path);
            return [item.attachment_path];
        } catch (e) { return [item.attachment_path]; }
    };

    let questionsList = [];
    try {
        if (item.questions) {
            const parsed = JSON.parse(item.questions);
            if (Array.isArray(parsed)) questionsList = parsed;
        }
    } catch (e) {}

    const attachments = getAttachments();

    return (
        <Animatable.View style={[styles.card, { backgroundColor: colors.cardBg, borderLeftColor: status.color, shadowColor: colors.border }]} animation="fadeInUp" duration={600} delay={index * 100}>
            <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: colors.textMain }]}>{item.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
                    <MaterialIcons name={status.icon} size={14} color="#fff" />
                    <Text style={styles.statusText}>{status.text}</Text>
                </View>
            </View>
            
            {item.description ? <Text style={[styles.description, { color: colors.textSub, fontStyle: 'italic', marginBottom: 10 }]} numberOfLines={3}>{item.description}</Text> : null}
            
            {questionsList.length > 0 && (
                <View style={{ marginBottom: 15 }}>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.textMain, marginBottom: 5 }}>Questions:</Text>
                    {questionsList.map((q, i) => (
                        <View key={i} style={{flexDirection: 'row', marginBottom: 4}}>
                            <Text style={{color: colors.textSub, marginRight: 5, fontWeight: '600'}}>{i+1}.</Text>
                            <Text style={{color: colors.textMain, flex: 1}}>{q}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={[styles.detailsGrid, { borderTopColor: colors.divider }]}>
                <DetailRow icon="category" label="Type" value={item.homework_type || 'PDF'} colors={colors} />
                <DetailRow icon="book" label="Subject" value={item.subject} colors={colors} />
                <DetailRow icon="event" label="Due Date" value={formatDateDisplay(item.due_date)} colors={colors} />
                {item.submitted_at && <DetailRow icon="event-available" label="Submitted" value={formatDateDisplay(item.submitted_at)} colors={colors} />}
            </View>
            
            {status.text === 'Graded' && item.grade && (
                <Animatable.View animation="fadeIn" duration={400} style={[styles.gradedSection, { backgroundColor: colors.gradeBg, borderColor: colors.success }]}>
                    <View style={{flexDirection:'row', alignItems:'center', marginBottom:5}}>
                         <MaterialIcons name="school" size={20} color={colors.textMain} style={{marginRight:5}} />
                         <Text style={{fontWeight:'bold', color: colors.textMain, fontSize:16}}>Grade: {item.grade}</Text>
                    </View>
                    {item.remarks && <Text style={[styles.remarksText, { color: colors.textMain }]}>Remarks: {item.remarks}</Text>}
                </Animatable.View>
            )}

            {attachments.length > 0 && (
                <View style={{marginTop: 10}}>
                    {attachments.map((path, idx) => (
                        <TouchableOpacity key={idx} style={[styles.attachmentButton, { backgroundColor: isDark ? colors.inputBg : '#f0f8ff' }]} onPress={() => onViewFile(path, `Teacher Attachment ${idx+1}`)}>
                            <MaterialIcons name="attachment" size={18} color={colors.info} />
                            <Text style={[styles.detailsButtonText, { color: colors.info }]}>
                                {attachments.length > 1 ? `Attachment ${idx + 1}` : "View Teacher's Attachment"}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {item.submission_id ? (
                <>
                    {item.written_answer ? (
                         <View style={[styles.submittedAnswerContainer, { borderTopColor: colors.divider }]}>
                            <Text style={[styles.submittedAnswerLabel, { color: colors.textSub }]}>Your Answer:</Text>
                            <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between'}}>
                                <Text style={[styles.submittedAnswerText, { color: colors.textMain, backgroundColor: isDark ? colors.inputBg : '#f1f8e9', flex:1 }]} numberOfLines={2}>
                                    {item.written_answer}
                                </Text>
                                <TouchableOpacity onPress={() => onViewWritten(item)} style={{marginLeft:10, padding:5}}>
                                    <MaterialIcons name="visibility" size={24} color={colors.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                         <View style={[styles.submittedAnswerContainer, { borderTopColor: colors.divider }]}>
                            <Text style={{color: colors.success, fontStyle:'italic'}}>File submitted successfully.</Text>
                         </View>
                    )}
                    <View style={[styles.buttonRow, { borderTopColor: colors.divider }]}>
                        {status.text !== 'Graded' && (
                            <TouchableOpacity style={[styles.deleteButton, { backgroundColor: colors.danger }]} onPress={() => onDelete(item.submission_id, item.id)}>
                                <MaterialIcons name="delete" size={18} color="#fff" />
                                <Text style={styles.submitButtonText}>Delete Submission</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </>
            ) : (
                item.homework_type === 'Written' ? (
                    <View style={[styles.buttonRow, { borderTopColor: colors.divider }]}>
                        <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.success }]} onPress={() => navigation.navigate('WrittenAnswerScreen', { assignment: item })}>
                            <MaterialIcons name="edit" size={18} color="#fff" />
                            <Text style={styles.submitButtonText}>Start Answering</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={[styles.buttonRow, { borderTopColor: colors.divider }]}>
                        <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={() => onOpenSubmitModal(item.id)}>
                            <MaterialIcons name="upload-file" size={18} color="#fff" />
                            <Text style={styles.submitButtonText}>Submit Homework</Text>
                        </TouchableOpacity>
                    </View>
                )
            )}
        </Animatable.View>
    );
};

const DetailRow = ({ icon, label, value, colors }) => ( 
    <View style={styles.detailRow}>
        <MaterialIcons name={icon} size={16} color={colors.textSub} />
        <Text style={[styles.detailLabel, { color: colors.textSub }]}>{label}:</Text>
        <Text style={[styles.detailValue, { color: colors.textMain }]}>{value}</Text>
    </View> 
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerCard: { paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTextContainer: { justifyContent: 'center', flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },
    card: { borderRadius: 12, marginBottom: 15, padding: 15, elevation: 2, shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, borderLeftWidth: 5 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, marginRight: 10 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
    statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
    description: { fontSize: 14, marginBottom: 15, lineHeight: 20 },
    detailsGrid: { borderTopWidth: 1, paddingTop: 10 },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    detailLabel: { marginLeft: 8, fontSize: 14, fontWeight: '500' },
    detailValue: { fontSize: 14, flexShrink: 1, marginLeft: 5 },
    gradedSection: { marginTop: 10, padding: 10, borderRadius: 8, borderWidth: 1, borderStyle:'dashed' },
    remarksText: { fontStyle: 'italic', fontSize: 14, marginTop: 4 },
    buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 15, paddingTop: 10, borderTopWidth: 1 },
    attachmentButton: { flexDirection: 'row', alignItems: 'center', padding: 8, marginTop: 5, alignSelf: 'flex-start', borderRadius: 8 },
    detailsButtonText: { marginLeft: 5, fontWeight: 'bold', fontSize: 13 },
    submitButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, elevation: 2 },
    deleteButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, elevation: 2 },
    submitButtonText: { color: '#fff', marginLeft: 8, fontWeight: 'bold', fontSize: 13 },
    submittedAnswerContainer: { marginTop: 15, paddingTop: 10, borderTopWidth: 1 },
    submittedAnswerLabel: { fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
    submittedAnswerText: { fontSize: 14, padding: 12, borderRadius: 6, lineHeight: 20 },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16 },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', borderRadius: 15, padding: 20, maxHeight: '80%', elevation: 5 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 },
    modalSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 15 },
    fileListContainer: { maxHeight: 300, marginBottom: 15 },
    fileItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1 },
    fileInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
    fileName: { marginLeft: 10, fontSize: 14, flex: 1 },
    removeFileBtn: { borderRadius: 15, width: 26, height: 26, justifyContent: 'center', alignItems: 'center' },
    addMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderStyle: 'dashed', borderWidth: 1, borderRadius: 8, marginTop: 5 },
    addMoreText: { fontWeight: 'bold', marginLeft: 5 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    modalButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    viewerModalContainer: { flex: 1 },
    viewerSafeArea: { flex: 1 },
    viewerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1 },
    viewerTitle: { fontSize: 16, fontWeight: 'bold', flex: 1 },
    closeViewerBtn: { padding: 5 },
    viewerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pdfView: { flex: 1, width: width, height: height },
    imageView: { flex: 1, width: width, height: height },
});

export default StudentHomeworkScreen;