import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, 
    Modal, ScrollView, TextInput, Platform, Image, LayoutAnimation, UIManager, 
    Dimensions, SafeAreaView, useColorScheme, StatusBar 
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SERVER_URL } from '../../../apiConfig';
import apiClient from '../../api/client';
import { launchImageLibrary, ImagePickerResponse, Asset } from 'react-native-image-picker';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F5F7FA',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    inputBg: '#FAFAFA',
    success: '#43A047',
    danger: '#E53935',
    orange: '#FFA000',
    blue: '#1E88E5',
    iconGrey: '#90A4AE',
    pendingBg: '#FFF3E0', pendingText: '#E67E22',
    approvedBg: '#E8F5E9', approvedText: '#2E7D32',
    rejectedBg: '#FFEBEE', rejectedText: '#C62828',
    placeholder: '#B0BEC5' // Dull grey for examples
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
    blue: '#42A5F5',
    iconGrey: '#757575',
    pendingBg: 'rgba(255, 152, 0, 0.15)', pendingText: '#FFB74D',
    approvedBg: 'rgba(76, 175, 80, 0.15)', approvedText: '#81C784',
    rejectedBg: 'rgba(244, 67, 54, 0.15)', rejectedText: '#E57373',
    placeholder: '#616161' // Dull grey for dark mode
};

// --- TYPES ---
type Status = 'Pending' | 'Approved' | 'Rejected';
interface PreAdmissionRecord { 
    id: number; 
    admission_no: string; 
    submission_date: string; 
    student_name: string; 
    photo_url?: string; 
    dob?: string; 
    pen_no?: string; 
    phone_no?: string; 
    aadhar_no?: string; 
    parent_name?: string; 
    parent_phone?: string; 
    previous_institute?: string; 
    previous_grade?: string; 
    joining_grade: string; 
    address?: string; 
    status: Status; 
}

// --- HELPERS ---
const formatDate = (dateString?: string): string => { 
    if (!dateString) return 'N/A'; 
    const date = new Date(dateString); 
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); 
};
const toYYYYMMDD = (date: Date): string => date.toISOString().split('T')[0];
const getCurrentYear = () => new Date().getFullYear();

// --- COMPONENTS ---

const StatusPill = ({ status, colors }: { status: Status, colors: any }) => { 
    let bg, text;
    if (status === 'Approved') { bg = colors.approvedBg; text = colors.approvedText; }
    else if (status === 'Rejected') { bg = colors.rejectedBg; text = colors.rejectedText; }
    else { bg = colors.pendingBg; text = colors.pendingText; }

    return (
        <View style={[styles.statusPill, { backgroundColor: bg }]}>
            <View style={[styles.statusDot, { backgroundColor: text }]} />
            <Text style={[styles.statusPillText, { color: text }]}>{status}</Text>
        </View>
    ); 
};

const InputField = ({ label, value, onChange, kType = "default", colors, multiline = false, placeholder = "" }: any) => (
    <View style={styles.formRow}>
        <Text style={[styles.label, { color: colors.textSub }]}>{label}</Text>
        <TextInput 
            style={[
                styles.input, 
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }, 
                multiline && { height: 80, textAlignVertical: 'top' }
            ]} 
            value={value || ''} 
            onChangeText={onChange} 
            keyboardType={kType} 
            multiline={multiline}
            placeholder={placeholder}
            placeholderTextColor={colors.placeholder}
        />
    </View>
);

const InfoRow = ({ icon, label, value, isMultiLine = false, colors }: any) => (
    <View style={[styles.infoRow, isMultiLine && { alignItems: 'flex-start' }]}>
        <FontAwesome name={icon} size={14} color={colors.textSub} style={[styles.infoIcon, isMultiLine && { marginTop: 3 }]} />
        <Text style={[styles.infoLabel, { color: colors.textMain }]}>{label}:</Text>
        <Text style={[styles.infoValue, { color: colors.textSub }]} numberOfLines={isMultiLine ? undefined : 1}>{value || 'N/A'}</Text>
    </View>
);

// --- MODALS ---

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

const YearPickerModal: React.FC<{ visible: boolean, years: string[], selectedValue: string, onSelect: (year: string) => void, onClose: () => void, colors: any }> = ({ visible, years, selectedValue, onSelect, onClose, colors }) => {
    const sortedYears = years.sort((a, b) => parseInt(b) - parseInt(a));
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={onClose}>
                <View style={[pickerStyles.pickerContainer, { backgroundColor: colors.cardBg }]}>
                    <Text style={[pickerStyles.pickerTitle, { color: colors.textMain, borderColor: colors.border }]}>Select Application Year</Text>
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

// --- CARD ITEM ---

const PreAdmissionCardItem: React.FC<{ item: PreAdmissionRecord, colors: any, onEdit: any, onDelete: any, isExpanded: boolean, onPress: any, onDpPress: any }> = ({ item, colors, onEdit, onDelete, isExpanded, onPress, onDpPress }) => {
    const imageUri = item.photo_url ? `${SERVER_URL}${item.photo_url}` : undefined;

    const handleMenuPress = () => {
        Alert.alert(
            "Manage Application",
            `Options for "${item.student_name}"`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Edit Details", onPress: () => onEdit(item) },
                { text: "Delete Record", onPress: () => onDelete(item.id), style: 'destructive' }
            ]
        );
    };

    return (
        <TouchableOpacity style={[styles.card, { backgroundColor: colors.cardBg }]} onPress={onPress} activeOpacity={0.9}>
            <View style={styles.cardHeader}>
                 <TouchableOpacity onPress={(e) => { e.stopPropagation(); if (imageUri) onDpPress(item.photo_url!); }} disabled={!imageUri} style={styles.avatarWrapper}>
                    {imageUri ? <Image source={{ uri: imageUri }} style={[styles.avatarImage, { borderColor: colors.border }]} /> : <View style={[styles.avatarImage, styles.avatarFallback]}><FontAwesome name="user" size={30} color="#fff" /></View>}
                </TouchableOpacity>

                <View style={styles.cardHeaderText}>
                    <Text style={[styles.cardTitle, { color: colors.textMain }]} numberOfLines={1}>{item.student_name}</Text>
                    <Text style={[styles.cardSubtitle, { color: colors.textSub }]}>Joining: {item.joining_grade}</Text>
                </View>
                
                <View style={styles.centerStatusArea}>
                    <StatusPill status={item.status} colors={colors} />
                </View>

                <View style={styles.rightActionArea}>
                    <TouchableOpacity 
                        style={styles.menuButton} 
                        onPress={(e) => { e.stopPropagation(); handleMenuPress(); }}
                        hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
                    >
                        <MaterialIcons name="more-vert" size={26} color={colors.iconGrey} />
                    </TouchableOpacity>
                </View>
            </View>

            {isExpanded && (
                <View style={[styles.expandedContainer, { borderTopColor: colors.border }]}>
                    <InfoRow icon="id-card" label="Admission No" value={item.admission_no} colors={colors} />
                    <InfoRow icon="calendar" label="Submitted" value={formatDate(item.submission_date)} colors={colors} />
                    <InfoRow icon="birthday-cake" label="D.O.B" value={formatDate(item.dob)} colors={colors} />
                    <InfoRow icon="phone" label="Phone" value={item.phone_no} colors={colors} />
                    <InfoRow icon="user" label="Parent" value={item.parent_name} colors={colors} />
                    <InfoRow icon="graduation-cap" label="Prev. Grade" value={item.previous_grade} colors={colors} />
                    <InfoRow icon="map-marker" label="Address" value={item.address} isMultiLine colors={colors} />
                </View>
            )}
        </TouchableOpacity>
    );
};

// --- MAIN SCREEN ---
const PreAdmissionsScreen: React.FC = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const [data, setData] = useState<PreAdmissionRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    
    const [formData, setFormData] = useState<Partial<PreAdmissionRecord>>({});
    const [originalData, setOriginalData] = useState<Partial<PreAdmissionRecord>>({});
    const [currentItemId, setCurrentItemId] = useState<number | null>(null);

    const [selectedImage, setSelectedImage] = useState<Asset | null>(null);
    const [date, setDate] = useState(new Date());
    const [pickerTarget, setPickerTarget] = useState<'dob' | null>(null);
    const [expandedCardId, setExpandedCardId] = useState<number | null>(null);

    const [searchText, setSearchText] = useState<string>('');
    const [filterYear, setFilterYear] = useState<string>(getCurrentYear().toString()); 
    const [yearPickerVisible, setYearPickerVisible] = useState<boolean>(false);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [availableYears, setAvailableYears] = useState<string[]>([]); 
    
    const [enlargeModalVisible, setEnlargeModalVisible] = useState<boolean>(false);
    const [enlargeImageUri, setEnlargeImageUri] = useState<string>('');
    
    const fetchData = useCallback(async (isSearch: boolean = false) => {
        if (isSearch) setIsSearching(true); else setLoading(true);
        try {
            const params = { search: searchText, year: filterYear };
            const response = await apiClient.get('/preadmissions', { params });
            const records: PreAdmissionRecord[] = response.data;
            setData(records);

            const years = records.map((item) => item.submission_date ? new Date(item.submission_date).getFullYear().toString() : null).filter((y): y is string => y !== null);
            const currentYear = getCurrentYear();
            const uniqueYears = Array.from(new Set([...years, (currentYear - 1).toString(), currentYear.toString(), (currentYear + 1).toString()]));
            setAvailableYears(uniqueYears);
        } catch (error: any) { 
            Alert.alert('Error', error.response?.data?.message || 'Failed to fetch data.'); 
        } finally { 
            if (isSearch) setIsSearching(false); else setLoading(false); 
        }
    }, [searchText, filterYear]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCardPress = (id: number) => { 
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); 
        setExpandedCardId(prevId => (prevId === id ? null : id)); 
    };
    
    const handleOpenModal = (item: PreAdmissionRecord | null = null) => { 
        setSelectedImage(null); 
        if (item) { 
            setIsEditing(true); 
            setCurrentItemId(item.id);
            const normalized = { ...item, dob: item.dob ? toYYYYMMDD(new Date(item.dob)) : undefined };
            setFormData(normalized); 
            setOriginalData(normalized);
        } 
        else { 
            setIsEditing(false); 
            setCurrentItemId(null); 
            setFormData({ status: 'Pending' }); 
            setOriginalData({});
        } 
        setModalVisible(true); 
    };
    
    const handleChoosePhoto = () => { 
        launchImageLibrary({ mediaType: 'photo', quality: 0.5 }, (response: ImagePickerResponse) => { 
            if (response.assets && response.assets.length > 0) { setSelectedImage(response.assets[0]); } 
        }); 
    };
    
    const handleSave = async () => {
        if (!formData.admission_no || !formData.student_name || !formData.joining_grade) { 
            return Alert.alert('Validation Error', 'Admission No, Name, and Grade are required.'); 
        }
        
        const body = new FormData();
        let hasChanges = false;

        if (isEditing && currentItemId) {
            Object.keys(formData).forEach(key => {
                const k = key as keyof PreAdmissionRecord;
                const newVal = formData[k];
                const oldVal = originalData[k];
                const cleanNew = (newVal === null || newVal === undefined) ? '' : String(newVal);
                const cleanOld = (oldVal === null || oldVal === undefined) ? '' : String(oldVal);

                if (cleanNew !== cleanOld) {
                    body.append(key, cleanNew);
                    hasChanges = true;
                }
            });

            if (selectedImage?.uri) { 
                body.append('photo', { uri: selectedImage.uri, type: selectedImage.type || 'image/jpeg', name: 'photo.jpg' } as any);
                hasChanges = true;
            }

            if (!hasChanges) { setModalVisible(false); return; }

            try {
                await apiClient.put(`/preadmissions/${currentItemId}`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
                Alert.alert('Success', 'Updated successfully'); setModalVisible(false); fetchData();
            } catch (error: any) { Alert.alert('Error', error.response?.data?.message || 'Update failed.'); }

        } else {
            Object.keys(formData).forEach(key => {
                const val = formData[key as keyof PreAdmissionRecord];
                if (val !== null && val !== undefined) body.append(key, String(val));
            });
            if (selectedImage?.uri) { 
                body.append('photo', { uri: selectedImage.uri, type: 'image/jpeg', name: 'photo.jpg' } as any); 
            }

            try {
                await apiClient.post('/preadmissions', body, { headers: { 'Content-Type': 'multipart/form-data' } });
                Alert.alert('Success', 'Created successfully'); setModalVisible(false); fetchData();
            } catch (error: any) { Alert.alert('Error', error.response?.data?.message || 'Creation failed.'); }
        }
    };

    const handleDelete = (id: number) => {
        Alert.alert("Confirm Delete", "Are you sure?", [
            { text: "Cancel", style: "cancel" }, 
            { text: "Delete", style: "destructive", onPress: async () => { 
                try { 
                    await apiClient.delete(`/preadmissions/${id}`); 
                    Alert.alert("Success", "Deleted"); 
                    fetchData(); 
                } catch (error: any) { Alert.alert('Error', error.response?.data?.message); }
            }}
        ]);
    };

    const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => { 
        setPickerTarget(null); 
        if (event.type === 'set' && selectedDate) { 
            setFormData(prev => ({ ...prev, dob: toYYYYMMDD(selectedDate) })); 
        } 
    };

    if (loading) return <View style={[styles.center, { backgroundColor: COLORS.background }]}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
            
            {/* HEADER */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: isDark ? '#333' : '#E0F2F1' }]}>
                        <MaterialIcons name="person-add-alt-1" size={24} color={COLORS.primary} />
                    </View>
                    <View>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Pre-Admissions</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Applications</Text>
                    </View>
                </View>
                <TouchableOpacity style={[styles.headerBtn, { backgroundColor: COLORS.primary }]} onPress={() => handleOpenModal()}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.headerBtnText}>Add</Text>
                </TouchableOpacity>
            </View>
            
            {/* SEARCH & FILTER */}
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

            {/* FLATLIST */}
            <FlatList
                data={data}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <PreAdmissionCardItem 
                        item={item} 
                        colors={COLORS}
                        onEdit={handleOpenModal} 
                        onDelete={handleDelete} 
                        isExpanded={expandedCardId === item.id} 
                        onPress={() => handleCardPress(item.id)} 
                        onDpPress={(url) => { setEnlargeImageUri(`${SERVER_URL}${url}`); setEnlargeModalVisible(true); }}
                    />
                )}
                ListEmptyComponent={<View style={styles.emptyContainer}><MaterialIcons name="inbox" size={60} color={COLORS.border} /><Text style={[styles.emptyText, { color: COLORS.textSub }]}>No applications found.</Text></View>}
                contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 100 }}
            />
            
            {/* MODAL */}
            <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <SafeAreaView style={{flex: 1, backgroundColor: COLORS.background}}>
                    <ScrollView style={styles.modalContainer} contentContainerStyle={{paddingBottom: 50}}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={[styles.modalTitle, { color: COLORS.textMain }]}>{isEditing ? 'Edit Application' : 'New Application'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}><MaterialIcons name="close" size={24} color={COLORS.textMain} /></TouchableOpacity>
                        </View>
                        
                        <View style={styles.imagePickerContainer}>
                            {selectedImage?.uri || formData.photo_url ? (
                                <Image source={selectedImage?.uri ? { uri: selectedImage.uri } : { uri: `${SERVER_URL}${formData.photo_url}` }} style={[styles.profileImage, { borderColor: COLORS.primary }]} />
                            ) : (
                                <View style={[styles.profileImage, styles.avatarFallback, { borderColor: COLORS.primary }]}><FontAwesome name="user-circle" size={60} color="#9E9E9E" /></View>
                            )}
                            <TouchableOpacity style={[styles.imagePickerButton, { backgroundColor: COLORS.primary }]} onPress={handleChoosePhoto}><MaterialIcons name="camera-alt" size={16} color="#fff" /><Text style={styles.imagePickerButtonText}>Photo</Text></TouchableOpacity>
                        </View>
                        
                        {/* --- STUDENT INFO --- */}
                        <Text style={[styles.sectionHeader, { color: COLORS.primary, borderColor: COLORS.border }]}>Student Details</Text>
                        <InputField label="Admission No*" value={formData.admission_no} onChange={(t: string) => setFormData(p => ({...p, admission_no: t}))} colors={COLORS} placeholder="e.g., 2025-001" />
                        <InputField label="Student Name*" value={formData.student_name} onChange={(t: string) => setFormData(p => ({...p, student_name: t}))} colors={COLORS} placeholder="e.g., Rahul Kumar" />
                        
                        <View style={styles.formRow}>
                            <Text style={[styles.label, { color: COLORS.textSub }]}>Date of Birth</Text>
                            <TouchableOpacity onPress={() => setPickerTarget('dob')} style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                                <Text style={{ color: formData.dob ? COLORS.textMain : COLORS.placeholder }}>{formData.dob ? formatDate(formData.dob) : 'dd-mm-yyyy'}</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.row}>
                            <View style={styles.halfWidth}>
                                <InputField label="Student Phone" value={formData.phone_no} onChange={(t: string) => setFormData(p => ({...p, phone_no: t}))} kType="phone-pad" colors={COLORS} placeholder="e.g., 9876543210" />
                            </View>
                            <View style={styles.halfWidth}>
                                <InputField label="Pen No" value={formData.pen_no} onChange={(t: string) => setFormData(p => ({...p, pen_no: t}))} colors={COLORS} placeholder="e.g., PEN123456" />
                            </View>
                        </View>
                        <InputField label="Aadhar No" value={formData.aadhar_no} onChange={(t: string) => setFormData(p => ({...p, aadhar_no: t}))} kType="numeric" colors={COLORS} placeholder="e.g., 1234 5678 9012" />

                        {/* --- ACADEMIC INFO --- */}
                        <Text style={[styles.sectionHeader, { color: COLORS.primary, borderColor: COLORS.border }]}>Academic Information</Text>
                        <InputField label="Joining Grade*" value={formData.joining_grade} onChange={(t: string) => setFormData(p => ({...p, joining_grade: t}))} colors={COLORS} placeholder="e.g., Class 5" />
                        <InputField label="Previous Institute" value={formData.previous_institute} onChange={(t: string) => setFormData(p => ({...p, previous_institute: t}))} colors={COLORS} placeholder="e.g., St. Mary's School" />
                        <InputField label="Previous Grade" value={formData.previous_grade} onChange={(t: string) => setFormData(p => ({...p, previous_grade: t}))} colors={COLORS} placeholder="e.g., Class 4" />

                        {/* --- PARENT INFO --- */}
                        <Text style={[styles.sectionHeader, { color: COLORS.primary, borderColor: COLORS.border }]}>Parent Information</Text>
                        <InputField label="Parent Name" value={formData.parent_name} onChange={(t: string) => setFormData(p => ({...p, parent_name: t}))} colors={COLORS} placeholder="e.g., Ramesh Kumar" />
                        <InputField label="Parent Phone" value={formData.parent_phone} onChange={(t: string) => setFormData(p => ({...p, parent_phone: t}))} kType="phone-pad" colors={COLORS} placeholder="e.g., 9876543210" />
                        
                        <InputField label="Address" value={formData.address} onChange={(t: string) => setFormData(p => ({...p, address: t}))} multiline colors={COLORS} placeholder="e.g., H.No 1-23, Street Name, City" />

                        <Text style={[styles.sectionHeader, { color: COLORS.primary, borderColor: COLORS.border }]}>Status</Text>
                        <View style={styles.statusSelector}>
                            {(['Pending', 'Approved', 'Rejected'] as Status[]).map(status => (
                                <TouchableOpacity key={status} onPress={() => setFormData(p => ({...p, status}))} style={[styles.statusButton, { borderColor: COLORS.border }, formData.status === status && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
                                    <Text style={[styles.statusButtonText, { color: COLORS.textMain }, formData.status === status && { color: '#FFFFFF' }]}>{status}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        
                        {pickerTarget && <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />}
                        
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalButton, { backgroundColor: COLORS.border }]} onPress={() => setModalVisible(false)}><Text style={{color: COLORS.textMain}}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, { backgroundColor: COLORS.primary }]} onPress={handleSave}><Text style={styles.modalButtonText}>Save</Text></TouchableOpacity>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            <YearPickerModal visible={yearPickerVisible} years={availableYears} selectedValue={filterYear} onSelect={(y) => setFilterYear(y)} onClose={() => setYearPickerVisible(false)} colors={COLORS} />
            <ImageEnlargerModal visible={enlargeModalVisible} uri={enlargeImageUri} onClose={() => setEnlargeModalVisible(false)} />
        </SafeAreaView>
    );
};

// --- STYLES ---

const styles = StyleSheet.create({ 
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, 
    container: { flex: 1 }, 
    headerCard: { paddingHorizontal: 15, paddingVertical: 12, width: '96%', alignSelf: 'center', marginTop: 15, marginBottom: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
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
    
    // CARD STYLES
    card: { borderRadius: 12, marginVertical: 6, elevation: 2, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, width: '96%', alignSelf: 'center' }, 
    cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 }, 
    avatarWrapper: { marginRight: 10 },
    avatarImage: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, backgroundColor: '#f0f0f0' },
    avatarFallback: { backgroundColor: '#B0BEC5', justifyContent: 'center', alignItems: 'center' },
    cardHeaderText: { flex: 1.5, justifyContent: 'center' }, 
    cardTitle: { fontSize: 16, fontWeight: 'bold' }, 
    cardSubtitle: { fontSize: 13, marginTop: 2 },
    
    centerStatusArea: { flex: 1.2, alignItems: 'center', justifyContent: 'center' },
    statusPill: { borderRadius: 20, paddingVertical: 5, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 1 }, 
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
    statusPillText: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }, 
    
    rightActionArea: { flex: 0.4, alignItems: 'flex-end' },
    menuButton: { padding: 6 },
    
    expandedContainer: { paddingHorizontal: 15, paddingBottom: 15, borderTopWidth: 1, paddingTop: 10 }, 
    infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 }, 
    infoIcon: { width: 22, textAlign: 'center', marginRight: 8 }, 
    infoLabel: { fontSize: 13, fontWeight: '600', marginRight: 5 }, 
    infoValue: { fontSize: 13, flex: 1 }, 
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 50, opacity: 0.7 }, 
    emptyText: { fontSize: 16, fontWeight: '600', marginTop: 10 }, 
    
    // MODAL STYLES
    modalContainer: { padding: 20 }, 
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: 'bold' }, 
    label: { fontSize: 14, marginBottom: 5, fontWeight: '500' }, 
    input: { borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, fontSize: 15 }, 
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 50 }, 
    modalButton: { paddingVertical: 12, borderRadius: 8, flex: 1, alignItems: 'center', marginHorizontal: 5 }, 
    modalButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 }, 
    imagePickerContainer: { alignItems: 'center', marginBottom: 20 }, 
    profileImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' }, 
    imagePickerButton: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, alignItems: 'center' }, 
    imagePickerButtonText: { color: '#fff', marginLeft: 6, fontWeight: 'bold', fontSize: 12 }, 
    sectionHeader: { fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1 },
    formRow: { marginBottom: 15 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    halfWidth: { flex: 1 },
    statusSelector: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 }, 
    statusButton: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center', marginHorizontal: 4 }, 
    statusButtonText: { fontWeight: '600' }, 
});

const pickerStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
    pickerContainer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 15, paddingHorizontal: 20, maxHeight: height * 0.7 },
    pickerTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 15, borderBottomWidth: 1, paddingBottom: 10 },
    scrollArea: { maxHeight: height * 0.5 },
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

export default PreAdmissionsScreen;