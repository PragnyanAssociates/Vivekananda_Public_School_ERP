import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator,
  Modal, ScrollView, TextInput, Platform, Image, LayoutAnimation, UIManager, 
  Dimensions, SafeAreaView, useColorScheme, StatusBar
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
// Ensure this path is correct for your project
import { SERVER_URL } from '../../../apiConfig'; 
import apiClient from '../../api/client'; 
import { launchImageLibrary, ImagePickerResponse, Asset } from 'react-native-image-picker';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

// --- THEME COLORS ---
const LightColors = {
    primary: '#008080',
    background: '#F5F7FA',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    inputBg: '#FFFFFF',
    success: '#43A047',
    danger: '#E53935',
    orange: '#FFA000',
    modalOverlay: 'rgba(0,0,0,0.5)'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    success: '#66BB6A',
    danger: '#EF5350',
    orange: '#FFA726',
    modalOverlay: 'rgba(255,255,255,0.1)'
};

// --- TYPES ---
interface AlumniRecord {
  id: number;
  admission_no: string;
  alumni_name: string;
  profile_pic_url?: string;
  dob?: string;
  pen_no?: string;
  phone_no?: string;
  aadhar_no?: string;
  parent_name?: string;
  parent_phone?: string;
  address?: string;
  school_joined_date?: string;
  school_joined_grade?: string;
  school_outgoing_date?: string;
  school_outgoing_grade?: string;
  tc_issued_date?: string;
  tc_number?: string;
  present_status?: string;
}

// --- HELPER FUNCTIONS ---
const formatDate = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const toYYYYMMDD = (dateStr: string | Date | undefined): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
};

const getCurrentYear = () => new Date().getFullYear();

// --- COMPONENTS ---

const ImageEnlargerModal: React.FC<{ visible: boolean, uri: string, onClose: () => void }> = ({ visible, uri, onClose }) => {
    if (!uri || !visible) return null;
    return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
            <View style={enlargeStyles.modalBackground}>
                <TouchableOpacity style={enlargeStyles.closeButton} onPress={onClose}>
                    <MaterialIcons name="close" size={30} color="#fff" />
                </TouchableOpacity>
                <Image source={{ uri }} style={enlargeStyles.fullImage} resizeMode="contain" />
            </View>
        </Modal>
    );
};

const YearPickerModal: React.FC<{ 
    visible: boolean, years: string[], selectedValue: string, 
    onSelect: (year: string) => void, onClose: () => void, colors: typeof LightColors
}> = ({ visible, years, selectedValue, onSelect, onClose, colors }) => {
    const sortedYears = years.sort((a, b) => parseInt(b) - parseInt(a));
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={onClose}>
                <View style={[pickerStyles.pickerContainer, { backgroundColor: colors.cardBg }]}>
                    <Text style={[pickerStyles.pickerTitle, { color: colors.textMain, borderColor: colors.border }]}>Select Outgoing Year</Text>
                    <ScrollView style={pickerStyles.scrollArea}>
                        {sortedYears.map((year) => (
                            <TouchableOpacity key={year} style={[pickerStyles.option, { borderColor: colors.background }]} onPress={() => { onSelect(year); onClose(); }}>
                                <Text style={[pickerStyles.optionText, { color: colors.textMain }, year === selectedValue && { color: colors.primary, fontWeight: 'bold' }]}>{year}</Text>
                                {year === selectedValue && <MaterialIcons name="check" size={20} color={colors.primary} />}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <TouchableOpacity style={[pickerStyles.closeButton, { backgroundColor: colors.background }]} onPress={onClose}>
                        <Text style={[pickerStyles.closeButtonText, { color: colors.textMain }]}>Close</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

// --- MAIN SCREEN ---
const AlumniScreen: React.FC = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const [alumniData, setAlumniData] = useState<AlumniRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [modalVisible, setModalVisible] = useState<boolean>(false); 
    const [isEditing, setIsEditing] = useState<boolean>(false);
    
    // Data Handling for Partial Updates
    const initialFormState: Partial<AlumniRecord> = {};
    const [originalData, setOriginalData] = useState<Partial<AlumniRecord>>(initialFormState); 
    const [formData, setFormData] = useState<Partial<AlumniRecord>>(initialFormState);
    const [currentItemId, setCurrentItemId] = useState<number | null>(null);

    const [selectedImage, setSelectedImage] = useState<Asset | null>(null);
    const [date, setDate] = useState(new Date());
    const [pickerTarget, setPickerTarget] = useState<keyof AlumniRecord | null>(null);
    const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
    
    // Search & Filter
    const [searchText, setSearchText] = useState<string>('');
    const [filterYear, setFilterYear] = useState<string>(getCurrentYear().toString()); 
    const [yearPickerVisible, setYearPickerVisible] = useState<boolean>(false);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [availableYears, setAvailableYears] = useState<string[]>([]); 
    
    // Image Enlarging
    const [enlargeModalVisible, setEnlargeModalVisible] = useState<boolean>(false);
    const [enlargeImageUri, setEnlargeImageUri] = useState<string>('');

    const fetchData = useCallback(async (isSearch: boolean = false) => {
        if (isSearch) setIsSearching(true); else setLoading(true);
        try {
            const params = { search: searchText, sortBy: 'alumni_name', sortOrder: 'ASC', year: filterYear };
            const response = await apiClient.get('/alumni', { params });
            const data = response.data;
            setAlumniData(data);
            
            // Extract available years dynamically
            const years = data.map((item: AlumniRecord) => item.school_outgoing_date ? new Date(item.school_outgoing_date).getFullYear().toString() : null).filter((y: any) => y);
            const uniqueYears = Array.from(new Set([...years, (getCurrentYear() - 1).toString(), getCurrentYear().toString(), (getCurrentYear() + 1).toString()]));
            setAvailableYears(uniqueYears);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to fetch data.');
        } finally {
            if (isSearch) setIsSearching(false); else setLoading(false);
        }
    }, [searchText, filterYear]);

    useEffect(() => { fetchData(); }, [fetchData]);
    
    const handleOpenModal = (item: AlumniRecord | null = null) => {
        setSelectedImage(null);
        if (item) {
            setIsEditing(true); 
            setCurrentItemId(item.id);
            // Normalize dates for form comparison
            const normalizedItem = {
                ...item,
                dob: toYYYYMMDD(item.dob),
                school_joined_date: toYYYYMMDD(item.school_joined_date),
                school_outgoing_date: toYYYYMMDD(item.school_outgoing_date),
            };
            setFormData(normalizedItem);
            setOriginalData(normalizedItem); 
        } else {
            setIsEditing(false); 
            setCurrentItemId(null);
            setFormData(initialFormState);
            setOriginalData(initialFormState);
        }
        setModalVisible(true);
    };
    
    const handleChoosePhoto = () => {
        launchImageLibrary({ mediaType: 'photo', quality: 0.5 }, (response: ImagePickerResponse) => {
            if (response.assets && response.assets.length > 0) { setSelectedImage(response.assets[0]); }
        });
    };

    const handleSave = async () => {
        if (!formData.admission_no || !formData.alumni_name) return Alert.alert('Required', 'Admission No and Name are required.');

        const data = new FormData();
        let hasChanges = false;

        if (isEditing && currentItemId) {
            // OPTIMIZATION: Check what changed
            Object.keys(formData).forEach(key => {
                const k = key as keyof AlumniRecord;
                const newVal = formData[k];
                const oldVal = originalData[k];
                const cleanNew = (newVal === null || newVal === undefined) ? '' : String(newVal);
                const cleanOld = (oldVal === null || oldVal === undefined) ? '' : String(oldVal);

                if (cleanNew !== cleanOld) {
                    data.append(key, cleanNew);
                    hasChanges = true;
                }
            });

            if (selectedImage?.uri) {
                data.append('profile_pic', { 
                    uri: selectedImage.uri, type: selectedImage.type || 'image/jpeg', name: selectedImage.fileName || 'profile_pic.jpg' 
                } as any);
                hasChanges = true;
            }

            if (!hasChanges) { setModalVisible(false); return; } // Exit if no changes

            try {
                await apiClient.put(`/alumni/${currentItemId}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
                Alert.alert('Success', 'Updated successfully.');
                setModalVisible(false); fetchData();
            } catch (error: any) { Alert.alert('Error', error.response?.data?.message || 'Update failed.'); }

        } else {
            // New Record
            Object.keys(formData).forEach(key => {
                const val = formData[key as keyof AlumniRecord];
                if (val) data.append(key, String(val));
            });
            if (selectedImage?.uri) {
                data.append('profile_pic', { uri: selectedImage.uri, type: 'image/jpeg', name: 'profile.jpg' } as any);
            }

            try {
                await apiClient.post('/alumni', data, { headers: { 'Content-Type': 'multipart/form-data' } });
                Alert.alert('Success', 'Created successfully.');
                setModalVisible(false); fetchData();
            } catch (error: any) { Alert.alert('Error', error.response?.data?.message || 'Creation failed.'); }
        }
    };

    const handleDelete = (id: number) => {
        Alert.alert("Confirm Delete", "Permanently delete this record?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    await apiClient.delete(`/alumni/${id}`);
                    fetchData();
                } catch (error: any) { Alert.alert('Error', error.response?.data?.message); }
            }}
        ]);
    };

    const showDatePicker = (target: keyof AlumniRecord) => {
        const val = formData[target];
        const currentDate = val ? new Date(val as string) : new Date();
        setDate(isNaN(currentDate.getTime()) ? new Date() : currentDate);
        setPickerTarget(target);
    };

    const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        setPickerTarget(null);
        if (event.type === 'set' && selectedDate && pickerTarget) {
            setFormData(prev => ({ ...prev, [pickerTarget]: toYYYYMMDD(selectedDate) }));
        }
    };

    if (loading) return <View style={[styles.center, { backgroundColor: COLORS.background }]}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
            
            {/* Header */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: isDark ? '#333' : '#E0F2F1' }]}>
                        <MaterialIcons name="school" size={24} color={COLORS.primary} />
                    </View>
                    <View>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Alumni Network</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Student Records</Text>
                    </View>
                </View>
                <TouchableOpacity style={[styles.headerBtn, { backgroundColor: COLORS.primary }]} onPress={() => handleOpenModal()}>
                    <MaterialIcons name="person-add" size={18} color="#fff" />
                    <Text style={styles.headerBtnText}>Add</Text>
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchFilterContainer}>
                <View style={[styles.searchWrapper, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
                    <MaterialIcons name="search" size={20} color={COLORS.textSub} style={{marginRight: 8}} />
                    <TextInput
                        style={[styles.searchInput, { color: COLORS.textMain }]}
                        placeholder="Search Name, ID..."
                        placeholderTextColor={COLORS.textSub}
                        value={searchText}
                        onChangeText={setSearchText}
                        onSubmitEditing={() => fetchData(true)}
                    />
                    {isSearching && <ActivityIndicator size="small" color={COLORS.primary} />}
                </View>
                <TouchableOpacity style={[styles.filterButton, { backgroundColor: COLORS.primary }]} onPress={() => setYearPickerVisible(true)}>
                    <Text style={styles.filterButtonText}>{filterYear}</Text>
                    <MaterialIcons name="arrow-drop-down" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
            
            {/* List */}
            <FlatList
                data={alumniData}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <AlumniCardItem 
                        item={item} colors={COLORS}
                        onEdit={handleOpenModal} onDelete={handleDelete}
                        isExpanded={expandedCardId === item.id}
                        onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpandedCardId(prev => (prev === item.id ? null : item.id)); }}
                        onDpPress={(url) => { setEnlargeImageUri(`${SERVER_URL}${url}`); setEnlargeModalVisible(true); }} 
                    />
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="school" size={60} color={COLORS.border} />
                        <Text style={[styles.emptyText, { color: COLORS.textSub }]}>No Alumni Found</Text>
                    </View>
                }
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 100 }}
            />

            {/* Modal */}
            <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <SafeAreaView style={{flex: 1, backgroundColor: COLORS.background}}>
                    <ScrollView style={styles.modalContainer} contentContainerStyle={{paddingBottom: 50}}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={[styles.modalTitle, { color: COLORS.textMain }]}>{isEditing ? 'Edit Alumni' : 'New Alumni'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <MaterialIcons name="close" size={24} color={COLORS.textMain} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.imagePickerContainer}>
                            {selectedImage?.uri || formData.profile_pic_url ? (
                                <Image source={selectedImage?.uri ? { uri: selectedImage.uri } : { uri: `${SERVER_URL}${formData.profile_pic_url}` }} style={[styles.profileImage, { borderColor: COLORS.primary }]} />
                            ) : (
                                <View style={[styles.profileImage, styles.avatarFallback, { borderColor: COLORS.primary }]}>
                                    <FontAwesome name="user" size={60} color="#9E9E9E" />
                                </View>
                            )}
                            <TouchableOpacity style={[styles.imagePickerButton, { backgroundColor: COLORS.primary }]} onPress={handleChoosePhoto}>
                                <MaterialIcons name="camera-alt" size={16} color="#fff" />
                                <Text style={styles.imagePickerButtonText}>Photo</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <InputField label="Admission No*" value={formData.admission_no} onChange={(t: string) => setFormData(p => ({...p, admission_no: t}))} colors={COLORS} />
                        <InputField label="Alumni Name*" value={formData.alumni_name} onChange={(t: string) => setFormData(p => ({...p, alumni_name: t}))} colors={COLORS} />
                        
                        <View style={styles.formRow}>
                            <Text style={[styles.label, { color: COLORS.textSub }]}>Date of Birth</Text>
                            <TouchableOpacity onPress={() => showDatePicker('dob')} style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                                <Text style={{ color: COLORS.textMain }}>{formData.dob ? formatDate(formData.dob) : 'Select Date'}</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <InputField label="Phone No" value={formData.phone_no} onChange={(t: string) => setFormData(p => ({...p, phone_no: t}))} kType="phone-pad" colors={COLORS} />
                        <InputField label="Present Status" value={formData.present_status} onChange={(t: string) => setFormData(p => ({...p, present_status: t}))} placeholder="e.g., Engineer" colors={COLORS} />
                        
                        <Text style={[styles.sectionHeader, { color: COLORS.primary, borderColor: COLORS.border }]}>School Details</Text>
                        
                        <View style={styles.formRow}>
                            <Text style={[styles.label, { color: COLORS.textSub }]}>Joined Date</Text>
                            <TouchableOpacity onPress={() => showDatePicker('school_joined_date')} style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                                <Text style={{ color: COLORS.textMain }}>{formData.school_joined_date ? formatDate(formData.school_joined_date) : 'Select Date'}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.formRow}>
                            <Text style={[styles.label, { color: COLORS.textSub }]}>Outgoing Date</Text>
                            <TouchableOpacity onPress={() => showDatePicker('school_outgoing_date')} style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                                <Text style={{ color: COLORS.textMain }}>{formData.school_outgoing_date ? formatDate(formData.school_outgoing_date) : 'Select Date'}</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <InputField label="Address" value={formData.address} onChange={(t: string) => setFormData(p => ({...p, address: t}))} colors={COLORS} multiline />

                        {pickerTarget && <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />}
                        
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalButton, { backgroundColor: COLORS.border }]} onPress={() => setModalVisible(false)}>
                                <Text style={{color: COLORS.textMain}}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, { backgroundColor: COLORS.primary }]} onPress={handleSave}>
                                <Text style={styles.modalButtonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            <YearPickerModal visible={yearPickerVisible} years={availableYears} selectedValue={filterYear} onSelect={(y) => setFilterYear(y)} onClose={() => setYearPickerVisible(false)} colors={COLORS} />
            <ImageEnlargerModal visible={enlargeModalVisible} uri={enlargeImageUri} onClose={() => setEnlargeModalVisible(false)} />

        </SafeAreaView>
    );
};

const InputField = ({ label, value, onChange, placeholder = "", kType = "default", colors, multiline = false }: any) => (
    <View style={styles.formRow}>
        <Text style={[styles.label, { color: colors.textSub }]}>{label}</Text>
        <TextInput 
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }, multiline && { height: 80, textAlignVertical: 'top' }]} 
            value={value || ''} onChangeText={onChange} keyboardType={kType} placeholder={placeholder} placeholderTextColor={colors.textSub} multiline={multiline}
        />
    </View>
);

const AlumniCardItem: React.FC<{ item: AlumniRecord, colors: any, onEdit: any, onDelete: any, isExpanded: boolean, onPress: any, onDpPress: any }> = ({ item, colors, onEdit, onDelete, isExpanded, onPress, onDpPress }) => {
    // Ensures the URL handles the server context
    const imageUri = item.profile_pic_url ? `${SERVER_URL}${item.profile_pic_url}` : undefined;
    
    return (
        <TouchableOpacity style={[styles.card, { backgroundColor: colors.cardBg }]} onPress={onPress} activeOpacity={0.9}>
            <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); if (imageUri) onDpPress(item.profile_pic_url!); }} disabled={!imageUri} style={styles.avatarWrapper}>
                    {imageUri ? <Image source={{ uri: imageUri }} style={[styles.avatarImage, { borderColor: colors.border }]} /> : <View style={[styles.avatarImage, styles.avatarFallback]}><FontAwesome name="user" size={24} color="#fff" /></View>}
                </TouchableOpacity>
                <View style={styles.cardHeaderText}>
                    <Text style={[styles.cardTitle, { color: colors.textMain }]}>{item.alumni_name}</Text>
                    <Text style={[styles.cardSubtitle, { color: colors.textSub }]}>ID: {item.admission_no}</Text>
                </View>
                <View style={styles.cardActions}>
                    {item.present_status ? <View style={[styles.statusTag, { backgroundColor: colors.background, borderColor: colors.border }]}><Text style={[styles.statusTagText, { color: colors.success }]}>{item.present_status}</Text></View> : null}
                    <View style={styles.buttonGroup}>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); onEdit(item); }} style={styles.iconButton}><MaterialIcons name="edit" size={20} color={colors.orange} /></TouchableOpacity>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); onDelete(item.id); }} style={styles.iconButton}><MaterialIcons name="delete" size={20} color={colors.danger} /></TouchableOpacity>
                    </View>
                </View>
            </View>
            <View style={styles.cardBody}>
                <InfoRow icon="phone" label="Phone" value={item.phone_no} colors={colors} />
                <InfoRow icon="calendar-today" label="Joined" value={formatDate(item.school_joined_date)} colors={colors} />
                <InfoRow icon="school" label="Left" value={formatDate(item.school_outgoing_date)} colors={colors} />
            </View>
            {isExpanded && (
                <View style={[styles.expandedContainer, { borderTopColor: colors.border }]}>
                    <InfoRow icon="cake" label="D.O.B" value={formatDate(item.dob)} colors={colors} />
                    <InfoRow icon="badge" label="Aadhar" value={item.aadhar_no} colors={colors} />
                    <InfoRow icon="person" label="Parent" value={item.parent_name} colors={colors} />
                    <InfoRow icon="place" label="Address" value={item.address} isMultiLine={true} colors={colors} />
                </View>
            )}
        </TouchableOpacity>
    );
};

const InfoRow = ({ icon, label, value, isMultiLine = false, colors }: any) => (
    <View style={[styles.infoRow, isMultiLine && { alignItems: 'flex-start' }]}>
        <MaterialIcons name={icon} size={16} color={colors.textSub} style={[styles.infoIcon, isMultiLine && { marginTop: 2 }]} />
        <Text style={[styles.infoLabel, { color: colors.textMain }]}>{label}:</Text>
        <Text style={[styles.infoValue, { color: colors.textSub }]} numberOfLines={isMultiLine ? undefined : 1}>{value || 'N/A'}</Text>
    </View>
);

const styles = StyleSheet.create({ 
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, 
    container: { flex: 1 }, 
    headerCard: { paddingHorizontal: 15, paddingVertical: 12, width: '94%', alignSelf: 'center', marginTop: 15, marginBottom: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 12 },
    headerBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    searchFilterContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingBottom: 15 },
    searchWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 10, height: 45, borderWidth: 1 },
    searchInput: { flex: 1, fontSize: 16 },
    filterButton: { marginLeft: 10, paddingHorizontal: 12, height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
    filterButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14, marginRight: 4 },
    card: { borderRadius: 12, marginVertical: 6, elevation: 2, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }, 
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 15, borderBottomWidth: 1 }, 
    avatarWrapper: { marginRight: 12 },
    avatarImage: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, backgroundColor: '#f0f0f0' }, 
    avatarFallback: { backgroundColor: '#B0BEC5', justifyContent: 'center', alignItems: 'center' },
    cardHeaderText: { flex: 1, justifyContent: 'center', marginTop: 2 }, 
    cardTitle: { fontSize: 16, fontWeight: 'bold' }, 
    cardSubtitle: { fontSize: 13, marginTop: 2 }, 
    cardActions: { alignItems: 'flex-end' }, 
    buttonGroup: { flexDirection: 'row', marginTop: 5 }, 
    iconButton: { marginLeft: 12, padding: 4 }, 
    statusTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 5, borderWidth: 1 }, 
    statusTagText: { fontSize: 10, fontWeight: 'bold' }, 
    cardBody: { padding: 15, paddingTop: 10 }, 
    expandedContainer: { paddingHorizontal: 15, paddingBottom: 15, borderTopWidth: 1, paddingTop: 10 }, 
    infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 }, 
    infoIcon: { width: 22, textAlign: 'center', marginRight: 8 }, 
    infoLabel: { fontSize: 13, fontWeight: '600', marginRight: 5 }, 
    infoValue: { fontSize: 13, flex: 1 }, 
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 50, opacity: 0.7 }, 
    emptyText: { fontSize: 16, fontWeight: '600', marginTop: 10 }, 
    modalContainer: { padding: 20 }, 
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: 'bold' }, 
    sectionHeader: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1 },
    formRow: { marginBottom: 15 },
    label: { fontSize: 14, marginBottom: 5, fontWeight: '500' }, 
    input: { borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, fontSize: 15 }, 
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 }, 
    modalButton: { paddingVertical: 12, borderRadius: 8, flex: 1, alignItems: 'center', marginHorizontal: 5 }, 
    modalButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 }, 
    imagePickerContainer: { alignItems: 'center', marginBottom: 20 }, 
    profileImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' }, 
    imagePickerButton: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, alignItems: 'center' }, 
    imagePickerButtonText: { color: '#fff', marginLeft: 6, fontWeight: 'bold', fontSize: 12 }, 
});

const pickerStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
    pickerContainer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 15, paddingHorizontal: 20, maxHeight: height * 0.6 },
    pickerTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 15, borderBottomWidth: 1, paddingBottom: 10 },
    scrollArea: { maxHeight: height * 0.4 },
    option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
    optionText: { fontSize: 16 },
    closeButton: { padding: 15, borderRadius: 10, marginTop: 15, marginBottom: Platform.OS === 'ios' ? 30 : 15, alignItems: 'center' },
    closeButtonText: { fontSize: 16, fontWeight: 'bold' },
});

const enlargeStyles = StyleSheet.create({
    modalBackground: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)', justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: width, height: height * 0.8 },
    closeButton: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(50,50,50,0.8)', borderRadius: 20 }
});

export default AlumniScreen;