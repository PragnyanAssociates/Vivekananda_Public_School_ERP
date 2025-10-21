import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, 
    Modal, ScrollView, TextInput, Platform, Image, LayoutAnimation, UIManager, Dimensions 
} from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SERVER_URL } from '../../../apiConfig';
import apiClient from '../../api/client';
import { launchImageLibrary, ImagePickerResponse, Asset } from 'react-native-image-picker';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

// --- TYPE DEFINITIONS ---
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

// --- HELPER FUNCTIONS ---
const formatDate = (dateString?: string, includeTime = false): string => { 
    if (!dateString) return 'N/A'; 
    const date = new Date(dateString); 
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() + userTimezoneOffset);
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }; 
    if (includeTime) { 
        options.hour = '2-digit'; 
        options.minute = '2-digit'; 
    } 
    return localDate.toLocaleDateString('en-GB', options); 
};
const toYYYYMMDD = (date: Date): string => date.toISOString().split('T')[0];
const getCurrentYear = () => new Date().getFullYear();


// --- UX COMPONENTS (Shared Styling) ---

const StatusPill = ({ status }: { status: Status }) => { 
    const statusStyle = { 
        Pending: { backgroundColor: '#FFF3E0', color: '#FF9800' }, 
        Approved: { backgroundColor: '#E8F5E9', color: '#4CAF50' }, 
        Rejected: { backgroundColor: '#FFEBEE', color: '#F44336' }, 
    }; 
    return (
        <View style={[preadmissionStyles.statusPill, { backgroundColor: statusStyle[status].backgroundColor }]}>
            <Text style={[preadmissionStyles.statusPillText, { color: statusStyle[status].color }]}>{status}</Text>
        </View>
    ); 
};

const InfoRow = ({ icon, label, value, isMultiLine = false }) => (
    <View style={[preadmissionStyles.infoRow, isMultiLine && { alignItems: 'flex-start' }]}>
        <FontAwesome name={icon} size={15} color="#757575" style={[preadmissionStyles.infoIcon, isMultiLine && { marginTop: 3 }]} />
        <Text style={preadmissionStyles.infoLabel}>{label}:</Text>
        <Text style={preadmissionStyles.infoValue} numberOfLines={isMultiLine ? undefined : 1}>{value}</Text>
    </View>
);

const ImageEnlargerModal: React.FC<{ visible: boolean, uri: string, onClose: () => void }> = ({ visible, uri, onClose }) => {
    if (!uri || !visible) return null;
    return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
            <View style={preadmissionStyles.enlargeModalBackground}>
                <TouchableOpacity style={preadmissionStyles.enlargeCloseButton} onPress={onClose}>
                    <MaterialIcons name="close" size={30} color="#fff" />
                </TouchableOpacity>
                <Image 
                    source={{ uri }} 
                    style={preadmissionStyles.enlargeFullImage} 
                    resizeMode="contain" 
                />
            </View>
        </Modal>
    );
};

const YearPickerModal: React.FC<{ 
    visible: boolean, 
    years: string[], 
    selectedValue: string, 
    onSelect: (year: string) => void, 
    onClose: () => void 
}> = ({ visible, years, selectedValue, onSelect, onClose }) => {
    
    const sortedYears = years.sort((a, b) => parseInt(b) - parseInt(a));

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={preadmissionStyles.pickerOverlay} activeOpacity={1} onPress={onClose}>
                <View style={preadmissionStyles.pickerContainer}>
                    <Text style={preadmissionStyles.pickerTitle}>Select Application Year</Text>
                    <ScrollView style={preadmissionStyles.pickerScrollArea}>
                        {sortedYears.map((year) => (
                            <TouchableOpacity
                                key={year}
                                style={preadmissionStyles.pickerOption}
                                onPress={() => { onSelect(year); onClose(); }}
                            >
                                <Text style={[preadmissionStyles.pickerOptionText, year === selectedValue && preadmissionStyles.pickerSelectedOptionText]}>
                                    {year}
                                </Text>
                                {year === selectedValue && <MaterialIcons name="check" size={20} color="#00796B" />}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <TouchableOpacity style={preadmissionStyles.pickerCloseButton} onPress={onClose}>
                        <Text style={preadmissionStyles.pickerCloseButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}


// --- CARD ITEM ---
const PreAdmissionCardItem: React.FC<{ 
    item: PreAdmissionRecord, 
    onEdit: (item: PreAdmissionRecord) => void, 
    onDelete: (id: number) => void, 
    isExpanded: boolean, 
    onPress: () => void,
    onDpPress: (url: string) => void 
}> = ({ item, onEdit, onDelete, isExpanded, onPress, onDpPress }) => {
    
    const imageUri = item.photo_url ? `${SERVER_URL}${item.photo_url}` : undefined;

    return (
        <TouchableOpacity style={preadmissionStyles.card} onPress={onPress} activeOpacity={0.8}>
            <View style={preadmissionStyles.cardHeader}>
                 {/* DP Enlargement touchable wrapper */}
                 <TouchableOpacity 
                    onPress={(e) => { 
                        e.stopPropagation(); 
                        if (imageUri) onDpPress(item.photo_url!); 
                    }} 
                    disabled={!imageUri}
                    style={preadmissionStyles.avatarWrapper}
                >
                    {imageUri ? (
                        <Image 
                            source={{ uri: imageUri }} 
                            style={preadmissionStyles.avatarImage} 
                        />
                    ) : (
                        <View style={[preadmissionStyles.avatarImage, preadmissionStyles.avatarFallback]}>
                            <FontAwesome name="user" size={30} color="#607D8B" />
                        </View>
                    )}
                </TouchableOpacity>

                <View style={preadmissionStyles.cardHeaderText}>
                    <Text style={preadmissionStyles.cardTitle}>{item.student_name}</Text>
                    <Text style={preadmissionStyles.cardSubtitle}>Joining: {item.joining_grade}</Text>
                </View>
                <View style={preadmissionStyles.cardActions}>
                    <StatusPill status={item.status} />
                    <View style={preadmissionStyles.buttonGroup}>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); onEdit(item); }} style={preadmissionStyles.iconButton}><FontAwesome name="pencil" size={18} color="#FFA000" /></TouchableOpacity>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); onDelete(item.id); }} style={preadmissionStyles.iconButton}><FontAwesome name="trash" size={18} color="#D32F2F" /></TouchableOpacity>
                    </View>
                </View>
            </View>

            {isExpanded && (
                <View style={preadmissionStyles.expandedContainer}>
                    <InfoRow icon="vcard" label="Admission No" value={item.admission_no} />
                    <InfoRow icon="calendar-o" label="Submitted" value={formatDate(item.submission_date, true)} />
                    <InfoRow icon="birthday-cake" label="D.O.B" value={formatDate(item.dob)} />
                    <InfoRow icon="phone" label="Student Phone" value={item.phone_no || 'N/A'} />
                    <InfoRow icon="user" label="Parent" value={item.parent_name || 'N/A'} />
                    <InfoRow icon="mobile" label="Parent Phone" value={item.parent_phone || 'N/A'} />
                    <InfoRow icon="university" label="Prev. Institute" value={item.previous_institute || 'N/A'} />
                    <InfoRow icon="graduation-cap" label="Prev. Grade" value={item.previous_grade || 'N/A'} />
                    <InfoRow icon="map-marker" label="Address" value={item.address || 'N/A'} isMultiLine />
                </View>
            )}
        </TouchableOpacity>
    );
};


// --- MAIN SCREEN COMPONENT ---
const PreAdmissionsScreen: React.FC = () => {
    const [data, setData] = useState<PreAdmissionRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [currentItem, setCurrentItem] = useState<PreAdmissionRecord | null>(null);
    const [formData, setFormData] = useState<Partial<PreAdmissionRecord>>({});
    const [selectedImage, setSelectedImage] = useState<Asset | null>(null);
    const [date, setDate] = useState(new Date());
    const [pickerTarget, setPickerTarget] = useState<'dob' | null>(null);
    const [expandedCardId, setExpandedCardId] = useState<number | null>(null);

    // --- Search/Filter State ---
    const [searchText, setSearchText] = useState<string>('');
    const [filterYear, setFilterYear] = useState<string>(getCurrentYear().toString()); 
    const [yearPickerVisible, setYearPickerVisible] = useState<boolean>(false);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [availableYears, setAvailableYears] = useState<string[]>([]); 
    
    // --- Image Enlarge State ---
    const [enlargeModalVisible, setEnlargeModalVisible] = useState<boolean>(false);
    const [enlargeImageUri, setEnlargeImageUri] = useState<string>('');
    
    // --- Data Fetching Logic ---
    const fetchData = useCallback(async (isSearch: boolean = false) => {
        if (isSearch) setIsSearching(true); else setLoading(true);

        try {
            const params = {
                search: searchText,
                year: filterYear
            };
            const response = await apiClient.get('/preadmissions', { params });
            const records: PreAdmissionRecord[] = response.data;
            setData(records);

            // Extract unique years from submission_date
            const years = records
                .map((item: PreAdmissionRecord) => item.submission_date ? new Date(item.submission_date).getFullYear().toString() : null)
                .filter((year: string | null): year is string => year !== null);
            
            // Generate list including current, previous, and next year + existing years
            const currentYear = getCurrentYear();
            const uniqueYears = Array.from(new Set([
                ...years, 
                (currentYear - 1).toString(), 
                currentYear.toString(), 
                (currentYear + 1).toString()
            ]));
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
            setCurrentItem(item); 
            setFormData(item); 
        } else { 
            setIsEditing(false); 
            setCurrentItem(null); 
            setFormData({ status: 'Pending' }); 
        } 
        setModalVisible(true); 
    };
    
    const handleChoosePhoto = () => { 
        launchImageLibrary({ mediaType: 'photo', quality: 0.5 }, (response: ImagePickerResponse) => { 
            if (!response.didCancel && !response.errorCode && response.assets && response.assets.length > 0) { 
                setSelectedImage(response.assets[0]); 
            } 
        }); 
    };
    
    const handleSave = async () => {
        if (!formData.admission_no || !formData.student_name || !formData.joining_grade) { return Alert.alert('Validation Error', 'Admission No, Student Name, and Joining Grade are required.'); }
        
        const body = new FormData();
        Object.keys(formData).forEach(key => { 
            const value = formData[key as keyof PreAdmissionRecord]; 
            if (value !== null && value !== undefined) body.append(key, String(value)); 
        });
        
        if (selectedImage?.uri) { 
            body.append('photo', { 
                uri: selectedImage.uri, 
                type: selectedImage.type || 'image/jpeg', 
                name: selectedImage.fileName || 'preadmission_photo.jpg' 
            } as any); 
        }
        
        try {
            let response;
            if (isEditing && currentItem) {
                response = await apiClient.put(`/preadmissions/${currentItem.id}`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
            } else {
                response = await apiClient.post('/preadmissions', body, { headers: { 'Content-Type': 'multipart/form-data' } });
            }
            Alert.alert('Success', response.data.message);
            setModalVisible(false);
            fetchData();
        } catch (error: any) { Alert.alert('Save Error', error.response?.data?.message || 'An error occurred during save.'); }
    };

    const handleDelete = (id: number) => {
        Alert.alert("Confirm Delete", "Are you sure you want to delete this record?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    const response = await apiClient.delete(`/preadmissions/${id}`);
                    Alert.alert("Success", response.data.message);
                    fetchData();
                } catch (error: any) { Alert.alert('Delete Error', error.response?.data?.message || 'Failed to delete record.'); }
            }}
        ]);
    };

    const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => { 
        setPickerTarget(null); 
        if (event.type === 'set' && selectedDate) { 
            setFormData(prev => ({ ...prev, dob: toYYYYMMDD(selectedDate) })); 
        } 
    };
    
    const handleImageEnlarge = (url: string) => {
        setEnlargeImageUri(`${SERVER_URL}${url}`);
        setEnlargeModalVisible(true);
    };

    const handleYearSelect = (year: string) => {
        setFilterYear(year);
    }

    if (loading) return <View style={preadmissionStyles.center}><ActivityIndicator size="large" color="#00796B" /></View>;

    return (
        <View style={preadmissionStyles.container}>
            {/* Header & Search */}
            <View style={preadmissionStyles.topContainer}>
                <View style={preadmissionStyles.header}>
                    <View style={preadmissionStyles.headerIconContainer}><MaterialIcons name="person-add-alt-1" size={24} color="#00796B" /></View>
                    <View><Text style={preadmissionStyles.headerTitle}>Pre-Admissions</Text><Text style={preadmissionStyles.headerSubtitle}>Manage admission applications</Text></View>
                </View>
                
                <View style={preadmissionStyles.searchFilterContainer}>
                    <View style={preadmissionStyles.searchWrapper}>
                        <FontAwesome name="search" size={18} color="#9E9E9E" style={preadmissionStyles.searchIcon} />
                        <TextInput
                            style={preadmissionStyles.searchInput}
                            placeholder="Search by Name, ID, or Institute..."
                            value={searchText}
                            onChangeText={setSearchText}
                            placeholderTextColor="#9E9E9E"
                            autoCapitalize="none"
                            onSubmitEditing={() => fetchData(true)}
                        />
                        {isSearching && <ActivityIndicator size="small" color="#00796B" style={preadmissionStyles.loadingIndicator} />}
                    </View>
                    <TouchableOpacity style={preadmissionStyles.filterButton} onPress={() => setYearPickerVisible(true)}>
                        <Text style={preadmissionStyles.filterButtonText}>{filterYear}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={data}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <PreAdmissionCardItem 
                        item={item} 
                        onEdit={handleOpenModal} 
                        onDelete={handleDelete} 
                        isExpanded={expandedCardId === item.id} 
                        onPress={() => handleCardPress(item.id)} 
                        onDpPress={handleImageEnlarge}
                    />
                )}
                ListEmptyComponent={<View style={preadmissionStyles.emptyContainer}><MaterialIcons name="inbox" size={80} color="#CFD8DC" /><Text style={preadmissionStyles.emptyText}>No applications found.</Text><Text style={preadmissionStyles.emptySubText}>Tap '+' to add a new application.</Text></View>}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            />
            
            <TouchableOpacity style={preadmissionStyles.fab} onPress={() => handleOpenModal()}><MaterialIcons name="add" size={24} color="#fff" /></TouchableOpacity>
            
            {/* --- Modal Forms --- */}
            <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <ScrollView style={preadmissionStyles.modalContainer} contentContainerStyle={{paddingBottom: 50}}>
                    <Text style={preadmissionStyles.modalTitle}>{isEditing ? 'Edit Application' : 'New Application'}</Text>
                    
                    <View style={preadmissionStyles.imagePickerContainer}>
                        {selectedImage?.uri || formData.photo_url ? (
                            <Image 
                                source={selectedImage?.uri ? { uri: selectedImage.uri } : { uri: `${SERVER_URL}${formData.photo_url}` }}
                                style={preadmissionStyles.profileImage} 
                            />
                        ) : (
                            <View style={[preadmissionStyles.profileImage, preadmissionStyles.avatarFallback]}>
                                <FontAwesome name="user-circle" size={80} color="#757575" />
                            </View>
                        )}
                        <TouchableOpacity style={preadmissionStyles.imagePickerButton} onPress={handleChoosePhoto}><FontAwesome name="camera" size={16} color="#fff" /><Text style={preadmissionStyles.imagePickerButtonText}>Choose Photo</Text></TouchableOpacity>
                    </View>
                    
                    <Text style={preadmissionStyles.label}>Admission No*</Text><TextInput style={preadmissionStyles.input} value={formData.admission_no || ''} onChangeText={t => setFormData(p => ({...p, admission_no: t}))} />
                    <Text style={preadmissionStyles.label}>Student Name*</Text><TextInput style={preadmissionStyles.input} value={formData.student_name || ''} onChangeText={t => setFormData(p => ({...p, student_name: t}))} />
                    <Text style={preadmissionStyles.label}>Date of Birth</Text><TouchableOpacity onPress={() => setPickerTarget('dob')} style={preadmissionStyles.input}><Text style={preadmissionStyles.dateText}>{formData.dob ? formatDate(formData.dob) : 'Select Date'}</Text></TouchableOpacity>
                    <Text style={preadmissionStyles.label}>Phone No</Text><TextInput style={preadmissionStyles.input} value={formData.phone_no || ''} onChangeText={t => setFormData(p => ({...p, phone_no: t}))} keyboardType="phone-pad" />
                    <Text style={preadmissionStyles.label}>Parent Name</Text><TextInput style={preadmissionStyles.input} value={formData.parent_name || ''} onChangeText={t => setFormData(p => ({...p, parent_name: t}))} />
                    <Text style={preadmissionStyles.label}>Parent No</Text><TextInput style={preadmissionStyles.input} value={formData.parent_phone || ''} onChangeText={t => setFormData(p => ({...p, parent_phone: t}))} keyboardType="phone-pad" />
                    <Text style={preadmissionStyles.label}>Joining Grade*</Text><TextInput style={preadmissionStyles.input} value={formData.joining_grade || ''} onChangeText={t => setFormData(p => ({...p, joining_grade: t}))} />
                    <Text style={preadmissionStyles.label}>Previous Institute</Text><TextInput style={preadmissionStyles.input} value={formData.previous_institute || ''} onChangeText={t => setFormData(p => ({...p, previous_institute: t}))} />
                    <Text style={preadmissionStyles.label}>Previous Grade</Text><TextInput style={preadmissionStyles.input} value={formData.previous_grade || ''} onChangeText={t => setFormData(p => ({...p, previous_grade: t}))} />
                    <Text style={preadmissionStyles.label}>Address</Text><TextInput style={[preadmissionStyles.input, preadmissionStyles.textArea]} value={formData.address || ''} onChangeText={t => setFormData(p => ({...p, address: t}))} multiline />
                    <Text style={preadmissionStyles.label}>Pen No</Text><TextInput style={preadmissionStyles.input} value={formData.pen_no || ''} onChangeText={t => setFormData(p => ({...p, pen_no: t}))} />
                    <Text style={preadmissionStyles.label}>Aadhar No</Text><TextInput style={preadmissionStyles.input} value={formData.aadhar_no || ''} onChangeText={t => setFormData(p => ({...p, aadhar_no: t}))} keyboardType="numeric" />
                    <Text style={preadmissionStyles.label}>Application Status</Text>
                    <View style={preadmissionStyles.statusSelector}>{(['Pending', 'Approved', 'Rejected'] as Status[]).map(status => (<TouchableOpacity key={status} onPress={() => setFormData(p => ({...p, status}))} style={[preadmissionStyles.statusButton, formData.status === status && preadmissionStyles.selectedStatusButton]}><Text style={[preadmissionStyles.statusButtonText, formData.status === status && preadmissionStyles.selectedStatusButtonText]}>{status}</Text></TouchableOpacity>))}</View>
                    
                    {pickerTarget && <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />}
                    
                    <View style={preadmissionStyles.modalActions}>
                        <TouchableOpacity style={[preadmissionStyles.modalButton, preadmissionStyles.cancelButton]} onPress={() => setModalVisible(false)}><Text style={preadmissionStyles.modalButtonText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[preadmissionStyles.modalButton, preadmissionStyles.saveButton]} onPress={handleSave}><Text style={preadmissionStyles.modalButtonText}>Save</Text></TouchableOpacity>
                    </View>
                </ScrollView>
            </Modal>

            {/* --- Year Picker Modal --- */}
            <YearPickerModal 
                visible={yearPickerVisible} 
                years={availableYears} 
                selectedValue={filterYear} 
                onSelect={handleYearSelect}
                onClose={() => setYearPickerVisible(false)}
            />

            {/* --- Image Enlarge Modal --- */}
            <ImageEnlargerModal 
                visible={enlargeModalVisible} 
                uri={enlargeImageUri} 
                onClose={() => setEnlargeModalVisible(false)} 
            />
        </View>
    );
};

// --- Styles Definition (Consolidated) ---
const preadmissionStyles = StyleSheet.create({ 
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4F7' }, 
    container: { flex: 1, backgroundColor: '#F0F4F7' }, 

    // --- Search & Header Block ---
    topContainer: {
        backgroundColor: '#FFFFFF',
        paddingTop: Platform.OS === 'android' ? 10 : 0,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 15,
        borderBottomRightRadius: 15,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        marginBottom: 8,
    },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingVertical: 10,
    }, 
    headerIconContainer: { 
        width: 45, height: 45, borderRadius: 22.5, 
        backgroundColor: '#E0F2F1', 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginRight: 16 
    }, 
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#004D40' }, 
    headerSubtitle: { fontSize: 14, color: '#00796B' },
    searchFilterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 15,
    },
    searchWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECEFF1',
        borderRadius: 25,
        paddingHorizontal: 15,
        height: 45,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        paddingVertical: Platform.OS === 'ios' ? 10 : 0,
    },
    loadingIndicator: {
        marginLeft: 10,
    },
    filterButton: {
        marginLeft: 10,
        backgroundColor: '#00796B',
        width: 70, 
        height: 45,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    
    // --- Card Styles ---
    card: { backgroundColor: '#FFFFFF', borderRadius: 12, marginVertical: 6, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 5, overflow: 'hidden' }, 
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 16 }, 
    avatarWrapper: { marginRight: 12 },
    avatarImage: { 
        width: 55, height: 55, borderRadius: 27.5, 
        backgroundColor: '#E0E0E0', 
        borderWidth: 2, borderColor: '#B0BEC5',
        justifyContent: 'center', 
        alignItems: 'center',
    },
    avatarFallback: { backgroundColor: '#CFD8DC' },
    cardHeaderText: { flex: 1, justifyContent: 'center', marginTop: 4 }, 
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#212121' }, 
    cardSubtitle: { fontSize: 14, color: '#607D8B', marginTop: 2 },
    cardActions: { alignItems: 'flex-end' }, 
    buttonGroup: { flexDirection: 'row', marginTop: 8 }, 
    iconButton: { marginLeft: 16, padding: 2 }, 
    statusPill: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10, alignItems: 'center' }, 
    statusPillText: { fontSize: 11, fontWeight: 'bold' }, 
    expandedContainer: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEEEEE' }, 
    infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 }, 
    infoIcon: { width: 20, textAlign: 'center' }, 
    infoLabel: { fontSize: 14, fontWeight: '600', color: '#424242', marginLeft: 10 }, 
    infoValue: { fontSize: 14, color: '#546E7A', flex: 1, marginLeft: 5, flexWrap: 'wrap' }, 
    
    // --- General/Modal Styles ---
    fab: { position: 'absolute', right: 25, bottom: 25, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0288D1', justifyContent: 'center', alignItems: 'center', elevation: 8 }, 
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: '30%', opacity: 0.6 }, 
    emptyText: { fontSize: 18, fontWeight: '600', color: '#78909C', marginTop: 16 }, 
    emptySubText: { fontSize: 14, color: '#78909C', marginTop: 4 }, 
    modalContainer: { flex: 1, backgroundColor: '#f9f9f9', paddingTop: 30, paddingHorizontal: 20 }, 
    modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 25, textAlign: 'center', color: '#212121' }, 
    label: { fontSize: 16, color: '#555', marginBottom: 8, marginTop: 12, fontWeight: '600' }, 
    input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFD8DC', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, marginBottom: 10, fontSize: 16, color: '#333' }, 
    dateText: { color: '#333', fontSize: 16 }, 
    textArea: { height: 100, textAlignVertical: 'top' }, 
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 50 }, 
    modalButton: { paddingVertical: 14, borderRadius: 8, flex: 1, alignItems: 'center', elevation: 2 }, 
    cancelButton: { backgroundColor: '#9E9E9E', marginRight: 10 }, 
    saveButton: { backgroundColor: '#0288D1', marginLeft: 10 }, 
    modalButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }, 
    imagePickerContainer: { alignItems: 'center', marginBottom: 20 }, 
    profileImage: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#E0E0E0', marginBottom: 10, borderWidth: 3, borderColor: '#0288D1', justifyContent: 'center', alignItems: 'center' }, 
    imagePickerButton: { flexDirection: 'row', backgroundColor: '#0288D1', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center' }, 
    imagePickerButtonText: { color: '#fff', marginLeft: 10, fontWeight: 'bold' }, 
    statusSelector: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 }, 
    statusButton: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#B0BEC5', alignItems: 'center', marginHorizontal: 4 }, 
    selectedStatusButton: { backgroundColor: '#00796B', borderColor: '#00796B' }, 
    statusButtonText: { color: '#37474F', fontWeight: '600' }, 
    selectedStatusButtonText: { color: '#FFFFFF' }, 

    // --- Year Picker Styles ---
    pickerOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'flex-end' },
    pickerContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 15, paddingHorizontal: 20, maxHeight: height * 0.7 },
    pickerTitle: { fontSize: 18, fontWeight: 'bold', color: '#212121', textAlign: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EEE', paddingBottom: 10 },
    pickerScrollArea: { maxHeight: height * 0.5 },
    pickerOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    pickerOptionText: { fontSize: 16, color: '#333' },
    pickerSelectedOptionText: { fontWeight: 'bold', color: '#00796B' },
    pickerCloseButton: { backgroundColor: '#0288D1', padding: 15, borderRadius: 10, marginTop: 15, marginBottom: Platform.OS === 'ios' ? 30 : 15, alignItems: 'center' },
    pickerCloseButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },

    // --- Image Enlarger Styles ---
    enlargeModalBackground: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center' },
    enlargeFullImage: { width: width * 0.9, height: height * 0.7 },
    enlargeCloseButton: { position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10 }
});

export default PreAdmissionsScreen;