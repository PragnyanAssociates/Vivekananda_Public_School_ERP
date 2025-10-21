import React, { useState, useEffect, useCallback } from 'react';
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
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

// --- TYPE DEFINITIONS ---
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

interface SortOption {
    label: string;
    value: string; // Corresponds to DB column name
}

const SORT_OPTIONS: SortOption[] = [
    { label: 'Name (A-Z)', value: 'alumni_name' },
    { label: 'Admission No', value: 'admission_no' },
    { label: 'Joined Date', value: 'school_joined_date' },
    { label: 'Outgoing Date', value: 'school_outgoing_date' },
];

// --- HELPER FUNCTIONS ---
const formatDate = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

const toYYYYMMDD = (date: Date): string => date.toISOString().split('T')[0];

// --- Image Enlarger Modal ---
const ImageEnlargerModal: React.FC<{ visible: boolean, uri: string, onClose: () => void }> = ({ visible, uri, onClose }) => {
    // Only render if URI is valid
    if (!uri || !visible) return null;

    return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
            <View style={enlargeStyles.modalBackground}>
                <TouchableOpacity style={enlargeStyles.closeButton} onPress={onClose}>
                    <MaterialIcons name="close" size={30} color="#fff" />
                </TouchableOpacity>
                <Image 
                    source={{ uri }} 
                    style={enlargeStyles.fullImage} 
                    resizeMode="contain" 
                />
            </View>
        </Modal>
    );
};


// --- MAIN SCREEN COMPONENT ---
const AlumniScreen: React.FC = () => {
    const { token } = useAuth();
    const [alumniData, setAlumniData] = useState<AlumniRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [modalVisible, setModalVisible] = useState<boolean>(false); // Add/Edit Modal
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [currentItem, setCurrentItem] = useState<AlumniRecord | null>(null);
    const initialFormState: Partial<AlumniRecord> = {};
    const [formData, setFormData] = useState<Partial<AlumniRecord>>(initialFormState);
    const [selectedImage, setSelectedImage] = useState<Asset | null>(null);
    const [date, setDate] = useState(new Date());
    const [pickerTarget, setPickerTarget] = useState<keyof AlumniRecord | null>(null);
    const [expandedCardId, setExpandedCardId] = useState<number | null>(null);

    // --- Search/Filter State ---
    const [searchText, setSearchText] = useState<string>('');
    const [sortBy, setSortBy] = useState<string>('alumni_name');
    const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
    const [filterModalVisible, setFilterModalVisible] = useState<boolean>(false);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    
    // --- Image Enlarge State ---
    const [enlargeModalVisible, setEnlargeModalVisible] = useState<boolean>(false);
    const [enlargeImageUri, setEnlargeImageUri] = useState<string>('');


    const fetchData = useCallback(async (isSearch: boolean = false) => {
        if (isSearch) setIsSearching(true); else setLoading(true);

        try {
            const params = {
                search: searchText,
                sortBy: sortBy,
                sortOrder: sortOrder,
            };

            const response = await apiClient.get('/alumni', { params });
            setAlumniData(response.data);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to fetch alumni data.');
        } finally {
            if (isSearch) setIsSearching(false); else setLoading(false);
        }
    }, [searchText, sortBy, sortOrder]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const handleCardPress = (id: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedCardId(prevId => (prevId === id ? null : id));
    };

    const handleOpenModal = (item: AlumniRecord | null = null) => {
        setSelectedImage(null);
        if (item) {
            setIsEditing(true);
            setCurrentItem(item);
            setFormData(item);
        } else {
            setIsEditing(false);
            setCurrentItem(null);
            setFormData(initialFormState);
        }
        setModalVisible(true);
    };

    const handleChoosePhoto = () => {
        launchImageLibrary({ mediaType: 'photo', quality: 0.5 }, (response: ImagePickerResponse) => {
            if (response.didCancel) { console.log('User cancelled image picker');
            } else if (response.errorCode) { Alert.alert('ImagePicker Error', response.errorMessage || 'An error occurred');
            } else if (response.assets && response.assets.length > 0) { setSelectedImage(response.assets[0]); }
        });
    };

    const handleSave = async () => {
        if (!formData.admission_no || !formData.alumni_name) {
            return Alert.alert('Validation Error', 'Admission Number and Name are required.');
        }

        const data = new FormData();
        Object.keys(formData).forEach(key => {
            const value = formData[key as keyof AlumniRecord];
            if (value !== null && value !== undefined) {
                data.append(key, String(value));
            }
        });

        if (selectedImage?.uri) {
            data.append('profile_pic', { 
                uri: selectedImage.uri, 
                type: selectedImage.type || 'image/jpeg', 
                name: selectedImage.fileName || 'profile_pic.jpg' 
            } as any);
        }
        
        try {
            let response;
            if (isEditing && currentItem) {
                response = await apiClient.put(`/alumni/${currentItem.id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
            } else {
                response = await apiClient.post('/alumni', data, { headers: { 'Content-Type': 'multipart/form-data' } });
            }
            
            Alert.alert('Success', response.data.message || 'Record saved successfully.');
            setModalVisible(false);
            fetchData();
        } catch (error: any) {
            console.error(error.response?.data);
            Alert.alert('Save Error', error.response?.data?.message || 'An error occurred during save.');
        }
    };

    const handleDelete = (id: number) => {
        Alert.alert("Confirm Delete", "Are you sure you want to delete this record?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    const response = await apiClient.delete(`/alumni/${id}`);
                    Alert.alert("Success", response.data.message || 'Record deleted.');
                    fetchData();
                } catch (error: any) {
                    Alert.alert('Delete Error', error.response?.data?.message || 'Failed to delete record.');
                }
            }}
        ]);
    };

    const showDatePicker = (target: keyof AlumniRecord) => {
        const currentDate = formData[target] ? new Date(formData[target] as string) : new Date();
        setDate(currentDate);
        setPickerTarget(target);
    };

    const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        setPickerTarget(null);
        if (event.type === 'set' && selectedDate && pickerTarget) {
            setFormData(prev => ({ ...prev, [pickerTarget]: toYYYYMMDD(selectedDate) }));
        }
    };

    const handleSearchChange = (text: string) => {
        setSearchText(text);
    };

    const applyFilter = (newSortBy: string, newSortOrder: 'ASC' | 'DESC') => {
        setSortBy(newSortBy);
        setSortOrder(newSortOrder);
        setFilterModalVisible(false);
    };

    const handleImageEnlarge = (url: string) => {
        setEnlargeImageUri(`${SERVER_URL}${url}`);
        setEnlargeModalVisible(true);
    };


    if (loading) {
        return <View style={styles.center}><ActivityIndicator size="large" color="#00796B" /></View>;
    }

    return (
        <View style={styles.container}>
            
            {/* --- Header & Search --- */}
            <View style={styles.topContainer}>
                <View style={styles.header}>
                    <View style={styles.headerIconContainer}><FontAwesome name="graduation-cap" size={24} color="#00796B" /></View>
                    <View><Text style={styles.headerTitle}>Alumni Network</Text><Text style={styles.headerSubtitle}>Manage and view alumni records</Text></View>
                </View>
                
                <View style={styles.searchFilterContainer}>
                    <View style={styles.searchWrapper}>
                        <FontAwesome name="search" size={18} color="#9E9E9E" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by Name, ID, or Status..."
                            value={searchText}
                            onChangeText={handleSearchChange}
                            placeholderTextColor="#9E9E9E"
                            autoCapitalize="none"
                        />
                        {isSearching && <ActivityIndicator size="small" color="#00796B" style={styles.loadingIndicator} />}
                    </View>
                    <TouchableOpacity style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
                        <MaterialIcons name="filter-list" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>
            
            {/* --- List --- */}
            <FlatList
                data={alumniData}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <AlumniCardItem 
                        item={item} 
                        onEdit={handleOpenModal} 
                        onDelete={handleDelete}
                        isExpanded={expandedCardId === item.id}
                        onPress={() => handleCardPress(item.id)}
                        onDpPress={handleImageEnlarge} // Passed down for enlargement
                    />
                )}
                ListEmptyComponent={<View style={styles.emptyContainer}><MaterialIcons name="school" size={80} color="#CFD8DC" /><Text style={styles.emptyText}>No Alumni Found</Text><Text style={styles.emptySubText}>Try adjusting your search filters.</Text></View>}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            />

            <TouchableOpacity style={styles.fab} onPress={() => handleOpenModal()}><MaterialIcons name="add" size={24} color="#fff" /></TouchableOpacity>

            {/* --- Add/Edit Modal (Existing) --- */}
            <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <ScrollView style={styles.modalContainer} contentContainerStyle={{paddingBottom: 50}}>
                    <Text style={styles.modalTitle}>{isEditing ? 'Edit Alumni Record' : 'Add New Alumni'}</Text>
                    <View style={styles.imagePickerContainer}>
                        {/* FIX: Use conditional rendering for Image vs Icon fallback */}
                        {selectedImage?.uri || formData.profile_pic_url ? (
                            <Image 
                                source={selectedImage?.uri ? { uri: selectedImage.uri } : { uri: `${SERVER_URL}${formData.profile_pic_url}` }}
                                style={styles.profileImage} 
                            />
                        ) : (
                            // Safe fallback using an icon instead of a required file
                            <View style={[styles.profileImage, styles.avatarFallback]}>
                                <FontAwesome name="user-circle" size={80} color="#757575" />
                            </View>
                        )}
                        
                        <TouchableOpacity style={styles.imagePickerButton} onPress={handleChoosePhoto}><FontAwesome name="camera" size={16} color="#fff" /><Text style={styles.imagePickerButtonText}>Choose Photo</Text></TouchableOpacity>
                    </View>
                    
                    <Text style={styles.label}>Admission No*</Text><TextInput style={styles.input} value={formData.admission_no || ''} onChangeText={t => setFormData(p => ({...p, admission_no: t}))} />
                    <Text style={styles.label}>Alumni Name*</Text><TextInput style={styles.input} value={formData.alumni_name || ''} onChangeText={t => setFormData(p => ({...p, alumni_name: t}))} />
                    <Text style={styles.label}>Date of Birth</Text><TouchableOpacity onPress={() => showDatePicker('dob')} style={styles.input}><Text style={styles.dateText}>{formData.dob ? formatDate(formData.dob) : 'Select Date'}</Text></TouchableOpacity>
                    <Text style={styles.label}>Pen No</Text><TextInput style={styles.input} value={formData.pen_no || ''} onChangeText={t => setFormData(p => ({...p, pen_no: t}))} />
                    <Text style={styles.label}>Phone No</Text><TextInput style={styles.input} value={formData.phone_no || ''} onChangeText={t => setFormData(p => ({...p, phone_no: t}))} keyboardType="phone-pad" />
                    <Text style={styles.label}>Aadhar No</Text><TextInput style={styles.input} value={formData.aadhar_no || ''} onChangeText={t => setFormData(p => ({...p, aadhar_no: t}))} keyboardType="numeric" />
                    <Text style={styles.label}>Parent Name</Text><TextInput style={styles.input} value={formData.parent_name || ''} onChangeText={t => setFormData(p => ({...p, parent_name: t}))} />
                    <Text style={styles.label}>Parent No</Text><TextInput style={styles.input} value={formData.parent_phone || ''} onChangeText={t => setFormData(p => ({...p, parent_phone: t}))} keyboardType="phone-pad" />
                    <Text style={styles.label}>Address</Text><TextInput style={[styles.input, styles.textArea]} value={formData.address || ''} onChangeText={t => setFormData(p => ({...p, address: t}))} multiline />
                    <Text style={styles.label}>School Joined Date</Text><TouchableOpacity onPress={() => showDatePicker('school_joined_date')} style={styles.input}><Text style={styles.dateText}>{formData.school_joined_date ? formatDate(formData.school_joined_date) : 'Select Date'}</Text></TouchableOpacity>
                    <Text style={styles.label}>School Joined Grade</Text><TextInput style={styles.input} value={formData.school_joined_grade || ''} onChangeText={t => setFormData(p => ({...p, school_joined_grade: t}))} />
                    <Text style={styles.label}>School Outgoing Date</Text><TouchableOpacity onPress={() => showDatePicker('school_outgoing_date')} style={styles.input}><Text style={styles.dateText}>{formData.school_outgoing_date ? formatDate(formData.school_outgoing_date) : 'Select Date'}</Text></TouchableOpacity>
                    <Text style={styles.label}>School Outgoing Grade</Text><TextInput style={styles.input} value={formData.school_outgoing_grade || ''} onChangeText={t => setFormData(p => ({...p, school_outgoing_grade: t}))} />
                    <Text style={styles.label}>TC Issued Date</Text><TouchableOpacity onPress={() => showDatePicker('tc_issued_date')} style={styles.input}><Text style={styles.dateText}>{formData.tc_issued_date ? formatDate(formData.tc_issued_date) : 'Select Date'}</Text></TouchableOpacity>
                    <Text style={styles.label}>TC Number</Text><TextInput style={styles.input} value={formData.tc_number || ''} onChangeText={t => setFormData(p => ({...p, tc_number: t}))} />
                    <Text style={styles.label}>Present Status</Text><TextInput style={styles.input} value={formData.present_status || ''} onChangeText={t => setFormData(p => ({...p, present_status: t}))} placeholder="e.g., Software engineer, Doctor" />
                    
                    {pickerTarget && <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />}
                    
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSave}><Text style={styles.modalButtonText}>Save</Text></TouchableOpacity>
                    </View>
                </ScrollView>
            </Modal>

            {/* --- Filter & Sort Modal --- */}
            <Modal visible={filterModalVisible} animationType="slide" transparent={true} onRequestClose={() => setFilterModalVisible(false)}>
                <View style={filterStyles.modalOverlay}>
                    <View style={filterStyles.modalContent}>
                        <Text style={filterStyles.modalTitle}>Sort & Filter</Text>

                        <Text style={filterStyles.label}>Sort By:</Text>
                        {SORT_OPTIONS.map((option) => (
                            <TouchableOpacity 
                                key={option.value} 
                                style={filterStyles.optionRow} 
                                onPress={() => setSortBy(option.value)}
                            >
                                <MaterialIcons 
                                    name={sortBy === option.value ? 'radio-button-checked' : 'radio-button-unchecked'} 
                                    size={20} 
                                    color={sortBy === option.value ? '#00796B' : '#999'} 
                                />
                                <Text style={filterStyles.optionText}>{option.label}</Text>
                            </TouchableOpacity>
                        ))}
                        
                        <Text style={[filterStyles.label, {marginTop: 20}]}>Order:</Text>
                        <View style={filterStyles.orderToggle}>
                            <TouchableOpacity 
                                style={[filterStyles.orderButton, sortOrder === 'ASC' && filterStyles.orderButtonActive]} 
                                onPress={() => setSortOrder('ASC')}
                            >
                                <Text style={[filterStyles.orderText, sortOrder === 'ASC' && filterStyles.orderTextActive]}>Ascending</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[filterStyles.orderButton, sortOrder === 'DESC' && filterStyles.orderButtonActive]} 
                                onPress={() => setSortOrder('DESC')}
                            >
                                <Text style={[filterStyles.orderText, sortOrder === 'DESC' && filterStyles.orderTextActive]}>Descending</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={filterStyles.applyButton} onPress={() => applyFilter(sortBy, sortOrder)}>
                            <Text style={filterStyles.applyButtonText}>Apply Filters</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* --- Image Enlarge Modal --- */}
            <ImageEnlargerModal 
                visible={enlargeModalVisible} 
                uri={enlargeImageUri} 
                onClose={() => setEnlargeModalVisible(false)} 
            />

        </View>
    );
};

const AlumniCardItem: React.FC<{ item: AlumniRecord, onEdit: (item: AlumniRecord) => void, onDelete: (id: number) => void, isExpanded: boolean, onPress: () => void, onDpPress: (url: string) => void }> = ({ item, onEdit, onDelete, isExpanded, onPress, onDpPress }) => {
    
    // Determine the image URI
    const imageUri = item.profile_pic_url ? `${SERVER_URL}${item.profile_pic_url}` : undefined;
    
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
                <TouchableOpacity 
                    onPress={() => imageUri && onDpPress(item.profile_pic_url!)} 
                    disabled={!imageUri}
                    style={styles.avatarWrapper} // Wrapper style for touchable area
                >
                    {/* FIX: Use conditional rendering for Image vs Icon fallback */}
                    {imageUri ? (
                        <Image 
                            source={{ uri: imageUri }} 
                            style={styles.avatarImage} 
                        />
                    ) : (
                        <View style={[styles.avatarImage, styles.avatarFallback]}>
                            <FontAwesome name="user" size={30} color="#607D8B" />
                        </View>
                    )}
                </TouchableOpacity>
                <View style={styles.cardHeaderText}>
                    <Text style={styles.cardTitle}>{item.alumni_name}</Text>
                    <Text style={styles.cardSubtitle}>Admission No: {item.admission_no}</Text>
                </View>
                <View style={styles.cardActions}>
                    {item.present_status && <View style={styles.statusTag}><Text style={styles.statusTagText}>{item.present_status}</Text></View>}
                    <View style={styles.buttonGroup}>
                        <TouchableOpacity onPress={() => onEdit(item)} style={styles.iconButton}><FontAwesome name="pencil" size={18} color="#FFA000" /></TouchableOpacity>
                        <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.iconButton}><FontAwesome name="trash" size={18} color="#D32F2F" /></TouchableOpacity>
                    </View>
                </View>
            </View>
            <View style={styles.cardBody}>
                <InfoRow icon="phone" label="Phone" value={item.phone_no || 'N/A'} />
                <InfoRow icon="calendar-plus-o" label="Joined" value={`${formatDate(item.school_joined_date)} (${item.school_joined_grade || 'N/A'})`} />
                <InfoRow icon="calendar-times-o" label="Left" value={`${formatDate(item.school_outgoing_date)} (${item.school_outgoing_grade || 'N/A'})`} />
            </View>
            {isExpanded && (
                <View style={styles.expandedContainer}>
                    <InfoRow icon="birthday-cake" label="D.O.B" value={formatDate(item.dob)} />
                    <InfoRow icon="id-card-o" label="Pen No" value={item.pen_no || 'N/A'} />
                    <InfoRow icon="vcard" label="Aadhar" value={item.aadhar_no || 'N/A'} />
                    <InfoRow icon="user" label="Parent" value={item.parent_name || 'N/A'} />
                    <InfoRow icon="mobile" label="Parent No" value={item.parent_phone || 'N/A'} />
                    <InfoRow icon="file-text-o" label="TC No" value={item.tc_number || 'N/A'} />
                    <InfoRow icon="calendar-check-o" label="TC Issued" value={formatDate(item.tc_issued_date)} />
                    <InfoRow icon="map-marker" label="Address" value={item.address || 'N/A'} isMultiLine={true} />
                </View>
            )}
        </TouchableOpacity>
    );
};

const InfoRow = ({ icon, label, value, isMultiLine = false }) => (<View style={[styles.infoRow, isMultiLine && { alignItems: 'flex-start' }]}><FontAwesome name={icon} size={15} color="#757575" style={[styles.infoIcon, isMultiLine && { marginTop: 3 }]} /><Text style={styles.infoLabel}>{label}:</Text><Text style={styles.infoValue} numberOfLines={isMultiLine ? undefined : 1}>{value}</Text></View>);

const styles = StyleSheet.create({ 
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4F7' }, 
    container: { flex: 1, backgroundColor: '#F0F4F7' }, 
    
    // New Search and Header Styles
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
        width: 45,
        height: 45,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },


    // Card Styles (Classic View)
    card: { 
        backgroundColor: '#FFFFFF', 
        borderRadius: 12, 
        marginVertical: 6, 
        elevation: 3, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 1 }, 
        shadowOpacity: 0.15, 
        shadowRadius: 5, 
        overflow: 'hidden' 
    }, 
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 16 }, 
    avatarWrapper: {
        marginRight: 12, 
    },
    avatarImage: { 
        width: 55, height: 55, borderRadius: 27.5, 
        backgroundColor: '#E0E0E0', 
        borderWidth: 2, borderColor: '#B0BEC5',
        justifyContent: 'center', 
        alignItems: 'center',
    }, 
    avatarFallback: {
        // Style specific to the fallback icon container
        backgroundColor: '#CFD8DC',
    },
    cardHeaderText: { flex: 1, justifyContent: 'center', marginTop: 4 }, 
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#212121' }, 
    cardSubtitle: { fontSize: 14, color: '#607D8B', marginTop: 2 }, 
    cardActions: { alignItems: 'flex-end' }, 
    buttonGroup: { flexDirection: 'row', marginTop: 8 }, 
    iconButton: { marginLeft: 16, padding: 2 }, 
    statusTag: { backgroundColor: '#4CAF50', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 15, marginBottom: 5 }, 
    statusTagText: { color: '#fff', fontSize: 10, fontWeight: 'bold' }, 
    cardBody: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 0 }, 
    expandedContainer: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#ECEFF1', marginTop: 10, paddingTop: 10 }, 
    infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 }, 
    infoIcon: { width: 20, textAlign: 'center' }, 
    infoLabel: { fontSize: 14, fontWeight: '600', color: '#424242', marginLeft: 10 }, 
    infoValue: { fontSize: 14, color: '#546E7A', flex: 1, marginLeft: 5, flexWrap: 'wrap' }, 
    
    // FAB and Empty State
    fab: { position: 'absolute', right: 25, bottom: 25, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0288D1', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowRadius: 5, shadowOpacity: 0.3 }, 
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: '30%', opacity: 0.6 }, 
    emptyText: { fontSize: 18, fontWeight: '600', color: '#78909C', marginTop: 16 }, 
    emptySubText: { fontSize: 14, color: '#78909C', marginTop: 4 }, 
    
    // Modal Styles
    modalContainer: { flex: 1, backgroundColor: '#f9f9f9', paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingHorizontal: 20 }, 
    modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 25, textAlign: 'center', color: '#212121' }, 
    label: { fontSize: 16, color: '#555', marginBottom: 8, marginTop: 12, fontWeight: '600' }, 
    input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFD8DC', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, marginBottom: 10, fontSize: 16, color: '#333' }, 
    dateText: { color: '#333', fontSize: 16, paddingVertical: 4 }, 
    textArea: { height: 100, textAlignVertical: 'top' }, 
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 50 }, 
    modalButton: { paddingVertical: 14, borderRadius: 8, flex: 1, alignItems: 'center', elevation: 2 }, 
    cancelButton: { backgroundColor: '#9E9E9E', marginRight: 10 }, 
    saveButton: { backgroundColor: '#0288D1', marginLeft: 10 }, 
    modalButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }, 
    imagePickerContainer: { alignItems: 'center', marginBottom: 20 }, 
    profileImage: { 
        width: 120, height: 120, borderRadius: 60, 
        backgroundColor: '#E0E0E0', marginBottom: 10, 
        borderWidth: 3, borderColor: '#0288D1',
        // Make sure profile image container can hold the icon fallback
        justifyContent: 'center',
        alignItems: 'center',
    }, 
    imagePickerButton: { flexDirection: 'row', backgroundColor: '#0288D1', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center' }, 
    imagePickerButtonText: { color: '#fff', marginLeft: 10, fontWeight: 'bold' }, 
});


// --- Filter Modal Styles ---
const filterStyles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 25,
        minHeight: height * 0.5,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#212121',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
        paddingBottom: 10,
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 15,
        marginBottom: 10,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    optionText: {
        fontSize: 16,
        color: '#555',
        marginLeft: 15,
    },
    orderToggle: {
        flexDirection: 'row',
        backgroundColor: '#E0E0E0',
        borderRadius: 8,
        overflow: 'hidden',
        marginTop: 10,
    },
    orderButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    orderButtonActive: {
        backgroundColor: '#00796B',
    },
    orderText: {
        color: '#424242',
        fontWeight: '600',
    },
    orderTextActive: {
        color: '#FFFFFF',
    },
    applyButton: {
        backgroundColor: '#0288D1',
        padding: 15,
        borderRadius: 10,
        marginTop: 30,
        alignItems: 'center',
    },
    applyButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: 'bold',
    }
});

// --- Image Enlarger Styles ---
const enlargeStyles = StyleSheet.create({
    modalBackground: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullImage: {
        width: width * 0.9,
        height: height * 0.7,
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 10,
        padding: 10,
    }
});


export default AlumniScreen;