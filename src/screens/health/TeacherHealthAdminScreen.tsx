// 📂 File: src/screens/health/TeacherHealthAdminScreen.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, 
    TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform, 
    useColorScheme, Dimensions, StatusBar 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#333333',
    textSub: '#555555',
    border: '#CFD8DC',
    inputBg: '#FFFFFF',
    iconBg: '#E0F2F1',
    infoBoxBg: '#f8f9fa',
    shadow: '#000'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    iconBg: '#333333',
    infoBoxBg: '#2C2C2C',
    shadow: '#000'
};

// --- REUSABLE HEADER ---
const ScreenHeader = ({ icon, title, subtitle, colors }) => (
  <View style={[styles.headerCard, { backgroundColor: colors.cardBg, shadowColor: colors.shadow }]}>
    <View style={styles.headerContent}>
      <View style={[styles.headerIconContainer, { backgroundColor: colors.iconBg }]}>
        <MaterialIcons name={icon} size={28} color={colors.primary} />
      </View>
      <View style={styles.headerTextContainer}>
        <Text style={[styles.headerTitle, { color: colors.textMain }]}>{title}</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSub }]}>{subtitle}</Text>
      </View>
    </View>
  </View>
);

// ==========================================================
// --- MAIN COMPONENT ---
// ==========================================================
const TeacherHealthAdminScreen = () => {
    const [view, setView] = useState('list');
    const [selectedStudent, setSelectedStudent] = useState(null);

    const handleSelectStudent = (student: any) => {
        setSelectedStudent(student);
        setView('detail');
    };

    const handleBackToList = () => {
        setSelectedStudent(null);
        setView('list');
    };

    if (view === 'list') {
        return <StudentListView onSelectStudent={handleSelectStudent} />;
    }
    
    if (view === 'detail' && selectedStudent) {
        return <StudentHealthDetailView student={selectedStudent} onBack={handleBackToList} />;
    }

    return null;
};

// ==========================================================
// --- 1. STUDENT LIST VIEW ---
// ==========================================================
const StudentListView = ({ onSelectStudent }) => {
    // Theme Hook
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const [classes, setClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [students, setStudents] = useState<any[]>([]);
    const [isLoadingClasses, setIsLoadingClasses] = useState(true);
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useFocusEffect(
        useCallback(() => {
            const fetchClasses = async () => {
                setIsLoadingClasses(true);
                setError('');
                try {
                    const response = await apiClient.get('/health/classes');
                    const data = response.data;
                    setClasses(data);
                    if (data.length > 0) {
                        fetchStudents(data[0]);
                    } else {
                        setError('No classes with assigned students were found.');
                    }
                } catch (e: any) {
                    setError(e.response?.data?.message || 'Could not connect to the server.');
                } finally {
                    setIsLoadingClasses(false);
                }
            };
            fetchClasses();
        }, [])
    );

    const fetchStudents = async (classGroup: string) => {
        if (!classGroup) return;

        setSelectedClass(classGroup);
        setIsLoadingStudents(true);
        setStudents([]);
        setError('');
        try {
            const response = await apiClient.get(`/health/students/${classGroup}`);
            setStudents(response.data);
            if (response.data.length === 0) {
                 setError('No students found in this class.');
            }
        } catch (e: any) { 
            setError(e.response?.data?.message || 'An error occurred fetching students.');
        } finally {
            setIsLoadingStudents(false);
        }
    };
    
    const filteredStudents = useMemo(() => {
        if (!searchTerm) return students;
        return students.filter(student => 
            student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.roll_no?.toString().includes(searchTerm)
        );
    }, [students, searchTerm]);

    const renderStatus = () => {
        if (isLoadingClasses || isLoadingStudents) return <View style={styles.statusContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
        if (error) return <View style={styles.statusContainer}><Text style={[styles.emptyText, { color: COLORS.textSub }]}>{error}</Text></View>;
        if (students.length > 0 && filteredStudents.length === 0) return <View style={styles.statusContainer}><Text style={[styles.emptyText, { color: COLORS.textSub }]}>No students match your search.</Text></View>;
        return null;
    };

    return (
        <View style={[styles.listContainer, { backgroundColor: COLORS.background }]}>
            <StatusBar backgroundColor={COLORS.background} barStyle={isDark ? 'light-content' : 'dark-content'} />
            <ScreenHeader 
                icon="local-hospital"
                title="Student Health Records"
                subtitle="Manage and view student health data"
                colors={COLORS}
            />

            <View style={styles.controlsContainer}>
                <View style={[styles.pickerContainer, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                    <Picker
                        selectedValue={selectedClass}
                        onValueChange={(itemValue) => {
                            if (itemValue) fetchStudents(itemValue);
                        }}
                        enabled={!isLoadingClasses && classes.length > 0}
                        style={{ color: COLORS.textMain }}
                        dropdownIconColor={COLORS.textMain}
                    >
                        <Picker.Item label={isLoadingClasses ? "Loading classes..." : "Select a Class..."} value={null} color={COLORS.textSub} />
                        {classes.map(c => <Picker.Item key={c} label={c} value={c} color={COLORS.textMain} />)}
                    </Picker>
                </View>

                {students.length > 0 && (
                     <View style={[styles.searchContainer, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                        <MaterialIcons name="search" size={22} color={COLORS.textSub} style={styles.searchIcon} />
                        <TextInput
                            style={[styles.searchInput, { color: COLORS.textMain }]}
                            placeholder="Search by name or roll number..."
                            placeholderTextColor={COLORS.textSub}
                            value={searchTerm}
                            onChangeText={setSearchTerm}
                        />
                    </View>
                )}
            </View>

            <View style={[styles.listContentContainer, { backgroundColor: COLORS.cardBg }]}>
                {renderStatus()}
                <FlatList 
                    data={filteredStudents} 
                    keyExtractor={(item) => item.id.toString()} 
                    renderItem={({ item }) => ( 
                        <TouchableOpacity style={[styles.listItem, { borderBottomColor: COLORS.border }]} onPress={() => onSelectStudent(item)}>
                            <MaterialIcons name="person" size={24} color={COLORS.primary} />
                            <View style={styles.studentInfo}>
                                <Text style={[styles.studentName, { color: COLORS.textMain }]}>{item.full_name}</Text>
                                <Text style={[styles.rollNumber, { color: COLORS.textSub }]}>Roll No: {item.roll_no || 'N/A'}</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={COLORS.textSub} />
                        </TouchableOpacity> 
                    )} 
                />
            </View>
        </View>
    );
};

// ==========================================================
// --- 2. STUDENT DETAIL & EDIT VIEW ---
// ==========================================================
const StudentHealthDetailView = ({ student, onBack }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const { user: editor } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [record, setRecord] = useState<any>({});
    const [editData, setEditData] = useState<any>({});

    useEffect(() => {
        const fetchRecord = async () => {
            setLoading(true);
            try {
                const response = await apiClient.get(`/health/record/${student.id}`);
                const data = response.data;
                if (data.last_checkup_date) {
                    data.last_checkup_date = data.last_checkup_date.split('T')[0];
                }
                setRecord(data);
                setEditData(data);
            } catch (error) {
                Alert.alert("Error", "Could not fetch student's health record.");
                setRecord({ full_name: student.full_name, roll_no: student.roll_no });
                setEditData({ full_name: student.full_name, roll_no: student.roll_no });
            } finally {
                setLoading(false);
            }
        };
        fetchRecord();
    }, [student.id]);

    const handleSave = async () => {
        if (!editor) return Alert.alert("Error", "Authentication error. Cannot save.");
        setSaving(true);
        try {
            const response = await apiClient.post(`/health/record/${student.id}`, { ...editData, editorId: editor.id });
            Alert.alert("Success", response.data.message || "Health record saved.");
            setRecord(editData);
            setIsEditing(false);
        } catch (e: any) { 
            Alert.alert("Error", e.response?.data?.message || "Failed to save record."); 
        } finally {
            setSaving(false);
        }
    };
    
    if (loading) {
        return <View style={[styles.centered, { backgroundColor: COLORS.background }]}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: COLORS.background }}>
            <View style={[styles.detailHeader, { backgroundColor: COLORS.cardBg, borderBottomColor: COLORS.border }]}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <View style={styles.headerTextContainerDetail}>
                    <Text style={[styles.detailTitle, { color: COLORS.textMain }]}>{record.full_name}</Text>
                    <Text style={[styles.detailSubtitle, { color: COLORS.textSub }]}>Roll No: {record.roll_no || 'N/A'}</Text>
                </View>
                <View style={{width: 34}} /> 
            </View>
            <ScrollView style={styles.detailScrollContainer}>
                {isEditing ? (
                    <EditView data={editData} setData={setEditData} onSave={handleSave} onCancel={() => setIsEditing(false)} isSaving={saving} colors={COLORS} />
                ) : (
                    <DisplayView data={record} onEdit={() => setIsEditing(true)} colors={COLORS} />
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
};


// --- Sub-components for Detail/Edit View ---
const DisplayView = ({ data, onEdit, colors }) => {
    const calculatedBmi = useMemo(() => {
        if (data?.height_cm && data?.weight_kg) {
            const heightM = data.height_cm / 100;
            const bmi = data.weight_kg / (heightM * heightM);
            return bmi.toFixed(2);
        } return 'N/A';
    }, [data]);
    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Not Set';
        return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    return (
        <>
            <View style={[styles.card, { backgroundColor: colors.cardBg }]}>
                <View style={styles.grid}>
                    <InfoBox icon="opacity" label="Blood Group" value={data?.blood_group || 'N/A'} color="#e53935" colors={colors} />
                    <InfoBox icon="height" label="Height" value={data?.height_cm ? `${data.height_cm} cm` : 'N/A'} color="#1e88e5" colors={colors} />
                    <InfoBox icon="monitor-weight" label="Weight" value={data?.weight_kg ? `${data.weight_kg} kg` : 'N/A'} color="#fdd835" colors={colors} />
                    <InfoBox icon="calculate" label="BMI" value={calculatedBmi} color="#43a047" colors={colors} />
                </View>
                <InfoBox icon="event" label="Last Checkup" value={formatDate(data?.last_checkup_date)} color="#8e24aa" isFullWidth colors={colors} />
            </View>
            <Section title="Allergies" icon="warning" content={data?.allergies || 'None reported'} colors={colors} />
            <Section title="Medical Conditions" icon="local-hospital" content={data?.medical_conditions || 'None reported'} colors={colors} />
            <Section title="Medications" icon="healing" content={data?.medications || 'None'} colors={colors} />
            <TouchableOpacity onPress={onEdit} style={[styles.fab, { backgroundColor: colors.primary }]}>
                <MaterialIcons name="edit" size={24} color="#fff" />
            </TouchableOpacity>
        </>
    );
};

const EditView = ({ data, setData, onSave, onCancel, isSaving, colors }) => {
    const handleInputChange = (field, value) => setData(prev => ({ ...prev, [field]: value }));
    const calculatedBmi = useMemo(() => {
        if (data?.height_cm && data?.weight_kg) {
            const h = Number(data.height_cm) / 100; const bmi = Number(data.weight_kg) / (h * h);
            return isNaN(bmi) ? 'N/A' : bmi.toFixed(2);
        } return 'N/A';
    }, [data.height_cm, data.weight_kg]);
    
    return (
        <View style={styles.formContainer}>
            <FormInput label="Blood Group (e.g., A+, O-)" value={data.blood_group || ''} onChangeText={v => handleInputChange('blood_group', v)} colors={colors} />
            <FormInput label="Height (cm)" value={data.height_cm?.toString() || ''} onChangeText={v => handleInputChange('height_cm', v)} keyboardType="numeric" colors={colors} />
            <FormInput label="Weight (kg)" value={data.weight_kg?.toString() || ''} onChangeText={v => handleInputChange('weight_kg', v)} keyboardType="numeric" colors={colors} />
            
            <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.textMain }]}>BMI (Calculated)</Text>
                <TextInput style={[styles.input, styles.readOnly, { backgroundColor: colors.background, color: colors.textMain, borderColor: colors.border }]} value={calculatedBmi} editable={false} />
            </View>
            
            <FormInput label="Last Checkup Date (YYYY-MM-DD)" value={data.last_checkup_date || ''} onChangeText={v => handleInputChange('last_checkup_date', v)} placeholder="YYYY-MM-DD" colors={colors} />
            <FormInput label="Allergies" value={data.allergies || ''} onChangeText={v => handleInputChange('allergies', v)} multiline colors={colors} />
            <FormInput label="Medical Conditions" value={data.medical_conditions || ''} onChangeText={v => handleInputChange('medical_conditions', v)} multiline colors={colors} />
            <FormInput label="Medications" value={data.medications || ''} onChangeText={v => handleInputChange('medications', v)} multiline colors={colors} />
            
            <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.button, styles.cancelButton, { borderColor: colors.border }]} onPress={onCancel} disabled={isSaving}>
                    <Text style={[styles.cancelButtonText, { color: colors.textMain }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]} onPress={onSave} disabled={isSaving}>
                    <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ==========================================================
// --- REUSABLE HELPER COMPONENTS ---
// ==========================================================
const InfoBox = ({ icon, label, value, color, isFullWidth = false, colors }) => (
    <View style={[styles.infoBox, isFullWidth && styles.fullWidth, { backgroundColor: colors.infoBoxBg }]}>
        <MaterialIcons name={icon} size={28} color={color} />
        <Text style={[styles.infoLabel, { color: colors.textSub }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.textMain }]}>{value}</Text>
    </View>
);

const Section = ({ title, icon, content, colors }) => (
    <View style={[styles.sectionCard, { backgroundColor: colors.cardBg }]}>
        <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <MaterialIcons name={icon} size={22} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>{title}</Text>
        </View>
        <Text style={[styles.sectionContent, { color: colors.textSub }]}>{content}</Text>
    </View>
);

const FormInput = ({ label, multiline = false, colors, ...props }) => (
    <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: colors.textMain }]}>{label}</Text>
        <TextInput 
            style={[
                multiline ? styles.textarea : styles.input, 
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }
            ]} 
            multiline={multiline} 
            placeholderTextColor={colors.textSub}
            {...props} 
        />
    </View>
);

// ==========================================================
// --- STYLESHEET ---
// ==========================================================
const styles = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    // Header Styles
    headerCard: { padding: 15, marginHorizontal: 10, marginTop: 10, borderRadius: 10, elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5 },
    headerContent: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: { borderRadius: 25, width: 50, height: 50, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    headerTextContainer: { flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 14, marginTop: 2 },
    // List View Styles
    listContainer: { flex: 1 },
    controlsContainer: { paddingHorizontal: 10, paddingTop: 10 },
    pickerContainer: { borderWidth: 1, borderRadius: 8, marginBottom: 10 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10 },
    searchIcon: { marginRight: 5 },
    searchInput: { flex: 1, height: 45, fontSize: 16 },
    listContentContainer: { flex: 1, margin: 10, borderRadius: 10, elevation: 2, overflow: 'hidden' },
    statusContainer: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { textAlign: 'center', fontSize: 16 },
    listItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
    studentInfo: { flex: 1, marginLeft: 15 },
    studentName: { fontSize: 16, fontWeight: 'bold' },
    rollNumber: { fontSize: 14, marginTop: 2 },
    // Detail & Edit View Styles
    detailScrollContainer: { flex: 1, padding: 10 },
    detailHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, paddingHorizontal: 10 },
    backButton: { padding: 5 },
    headerTextContainerDetail: { flex: 1, alignItems: 'center' },
    detailTitle: { fontSize: 20, fontWeight: 'bold' },
    detailSubtitle: { fontSize: 14 },
    fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 4 },
    // Form Styles
    formContainer: { paddingBottom: 20 }, 
    inputContainer: { marginBottom: 15 },
    label: { marginBottom: 5, fontSize: 14, fontWeight: '500' },
    input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
    textarea: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16, minHeight: 80, textAlignVertical: 'top' },
    readOnly: { },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 40 },
    button: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center' },
    saveButton: { marginLeft: 5 },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    cancelButton: { borderWidth: 1, marginRight: 5 },
    cancelButtonText: { fontSize: 16, fontWeight: 'bold' },
    // Reusable Component Styles
    card: { borderRadius: 10, padding: 10, marginBottom: 15, elevation: 2 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    infoBox: { width: '48%', borderRadius: 8, padding: 15, alignItems: 'center', marginBottom: 10 },
    fullWidth: { width: '100%' },
    infoLabel: { fontSize: 13, marginTop: 5 },
    infoValue: { fontSize: 16, fontWeight: 'bold', marginTop: 2 },
    sectionCard: { borderRadius: 10, padding: 15, marginBottom: 15, elevation: 2 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, paddingBottom: 8 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
    sectionContent: { fontSize: 14, lineHeight: 20, paddingHorizontal: 5 },
});

export default TeacherHealthAdminScreen;