// import React, { useState, useEffect } from 'react';
// import {
//     View,
//     Text,
//     StyleSheet,
//     FlatList,
//     Image,
//     TouchableOpacity,
//     SafeAreaView,
//     Modal,
//     TextInput,
//     Alert,
//     ScrollView,
//     ActivityIndicator,
//     Linking
// } from 'react-native';
// import { useNavigation } from '@react-navigation/native';
// import apiClient from '../../api/client';
// import { SERVER_URL } from '../../../apiConfig';
// import { useAuth } from '../../context/AuthContext';

// // Library
// import { pick, types, isCancel } from '@react-native-documents/picker';

// // Icons
// const PDF_ICON = 'https://cdn-icons-png.flaticon.com/128/337/337946.png';
// const BACK_ICON = 'https://cdn-icons-png.flaticon.com/128/271/271220.png';
// const DENIED_ICON = 'https://cdn-icons-png.flaticon.com/128/3967/3967261.png';
// const TRASH_ICON = 'https://cdn-icons-png.flaticon.com/128/6861/6861362.png';
// const EDIT_ICON = 'https://cdn-icons-png.flaticon.com/128/1159/1159633.png'; 

// interface Vehicle {
//     id: number;
//     bus_number: string;
//     bus_name: string;
//     bus_photos: string | string[]; // JSON string or Array
// }

// const VehicalDetails = () => {
//     const navigation = useNavigation();
//     const { user } = useAuth();
//     const userRole = user?.role; 

//     // State
//     const [vehicles, setVehicles] = useState<Vehicle[]>([]);
//     const [loading, setLoading] = useState(false);

//     // Modal State
//     const [showModal, setShowModal] = useState(false);
//     const [isEditing, setIsEditing] = useState(false);
//     const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);

//     // Form Data
//     const [busNumber, setBusNumber] = useState('');
//     const [busName, setBusName] = useState('');
    
//     // Files State
//     const [selectedFiles, setSelectedFiles] = useState<any[]>([]); // New files
//     const [existingPhotos, setExistingPhotos] = useState<string[]>([]); // Old photos from DB

//     useEffect(() => {
//         if (userRole && userRole !== 'student') {
//             fetchVehicles();
//         }
//     }, [userRole]);

//     // --- API CALLS ---

//     const fetchVehicles = async () => {
//         setLoading(true);
//         try {
//             const response = await apiClient.get('/transport/vehicles');
//             const parsedData = response.data.map((v: any) => ({
//                 ...v,
//                 bus_photos: typeof v.bus_photos === 'string' ? JSON.parse(v.bus_photos) : v.bus_photos
//             }));
//             setVehicles(parsedData);
//         } catch (error) {
//             console.error("Fetch Vehicles Error:", error);
//         } finally {
//             setLoading(false);
//         }
//     };

//     const handleSaveVehicle = async () => {
//         if (!busNumber || !busName) {
//             Alert.alert("Required", "Please enter Bus Number and Bus Name");
//             return;
//         }

//         const formData = new FormData();
//         formData.append('bus_number', busNumber);
//         formData.append('bus_name', busName);

//         // 1. Append New Files
//         selectedFiles.forEach((file) => {
//             formData.append('files', {
//                 uri: file.uri,
//                 type: file.type || 'image/jpeg',
//                 name: file.name || `upload_${Date.now()}.jpg`,
//             } as any);
//         });

//         // 2. Append Existing Photos List (If Editing)
//         if (isEditing) {
//             formData.append('existing_photos', JSON.stringify(existingPhotos));
//         }

//         setLoading(true);
//         try {
//             if (isEditing && selectedVehicleId) {
//                 // EDIT MODE
//                 await apiClient.put(`/transport/vehicles/${selectedVehicleId}`, formData, {
//                     headers: { 'Content-Type': 'multipart/form-data' },
//                 });
//                 Alert.alert("Success", "Vehicle Updated!");
//             } else {
//                 // ADD MODE
//                 await apiClient.post('/transport/vehicles', formData, {
//                     headers: { 'Content-Type': 'multipart/form-data' },
//                 });
//                 Alert.alert("Success", "Vehicle Added!");
//             }
            
//             closeModal();
//             fetchVehicles();
//         } catch (error: any) {
//             console.error("Save Error", error?.response?.data || error);
//             const errMsg = error?.response?.data?.message || "Operation failed.";
//             Alert.alert("Error", errMsg);
//         } finally {
//             setLoading(false);
//         }
//     };

//     const handleDeleteVehicle = (id: number) => {
//         Alert.alert("Delete", "Are you sure you want to delete this vehicle?", [
//             { text: "Cancel", style: "cancel" },
//             {
//                 text: "Delete",
//                 style: 'destructive',
//                 onPress: async () => {
//                     try {
//                         await apiClient.delete(`/transport/vehicles/${id}`);
//                         fetchVehicles();
//                     } catch (e) {
//                         Alert.alert("Error", "Could not delete.");
//                     }
//                 }
//             }
//         ]);
//     };

//     // --- ACTIONS ---

//     const openAddModal = () => {
//         setIsEditing(false);
//         setBusName('');
//         setBusNumber('');
//         setSelectedFiles([]);
//         setExistingPhotos([]);
//         setShowModal(true);
//     };

//     const openEditModal = (item: Vehicle) => {
//         setIsEditing(true);
//         setSelectedVehicleId(item.id);
//         setBusName(item.bus_name);
//         setBusNumber(item.bus_number);
//         setSelectedFiles([]); // Reset new files
        
//         // Load existing photos
//         let photos = [];
//         try {
//              photos = typeof item.bus_photos === 'string' ? JSON.parse(item.bus_photos) : item.bus_photos;
//         } catch(e) { photos = []; }
        
//         setExistingPhotos(photos || []);
//         setShowModal(true);
//     };

//     const closeModal = () => {
//         setShowModal(false);
//         setBusName('');
//         setBusNumber('');
//         setSelectedFiles([]);
//         setExistingPhotos([]);
//         setIsEditing(false);
//         setSelectedVehicleId(null);
//     };

//     const pickFiles = async () => {
//         try {
//             const results = await pick({
//                 allowMultiSelection: true,
//                 type: [types.images, types.pdf], 
//             });
//             setSelectedFiles([...selectedFiles, ...results]);
//         } catch (err) {
//             if (!isCancel(err)) {
//                 Alert.alert('Error', 'Unknown Error: ' + JSON.stringify(err));
//             }
//         }
//     };

//     const removeExistingPhoto = (index: number) => {
//         const updated = [...existingPhotos];
//         updated.splice(index, 1);
//         setExistingPhotos(updated);
//     };

//     const removeNewFile = (index: number) => {
//         const updated = [...selectedFiles];
//         updated.splice(index, 1);
//         setSelectedFiles(updated);
//     };

//     // --- HELPERS ---

//     const getFileUrl = (url: string) => {
//         if (!url) return null;
//         if (url.startsWith('http')) return url;
//         return `${SERVER_URL}${url}`;
//     };

//     const isPdf = (filename: string) => {
//         return filename?.toLowerCase().endsWith('.pdf');
//     };

//     const openFile = (url: string) => {
//         Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
//     };

//     // --- RENDER ---

//     // 1. ACCESS DENIED
//     if (userRole === 'student') {
//         return (
//             <SafeAreaView style={styles.container}>
//                 <View style={styles.header}>
//                      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
//                         <Image source={{ uri: BACK_ICON }} style={styles.backIcon} />
//                     </TouchableOpacity>
//                     <Text style={styles.headerTitle}>Vehicle Details</Text>
//                     <View style={{width: 30}} />
//                 </View>
//                 <View style={styles.accessDeniedContainer}>
//                     <Image source={{ uri: DENIED_ICON }} style={styles.deniedIcon} />
//                     <Text style={styles.deniedTitle}>Access Restricted</Text>
//                     <Text style={styles.deniedText}>Students cannot view vehicle details.</Text>
//                     <TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}>
//                         <Text style={styles.goBackText}>Go Back</Text>
//                     </TouchableOpacity>
//                 </View>
//             </SafeAreaView>
//         );
//     }

//     // 2. VEHICLE CARD
//     const renderVehicleCard = ({ item, index }: { item: Vehicle, index: number }) => {
//         let files: string[] = [];
//         if (Array.isArray(item.bus_photos)) files = item.bus_photos;
//         else if (typeof item.bus_photos === 'string') {
//             try { files = JSON.parse(item.bus_photos); } catch (e) { files = []; }
//         }

//         return (
//             <View style={styles.card}>
//                 <View style={styles.cardHeader}>
//                     <View style={styles.headerLeftContent}>
//                         <View style={styles.sNoBadge}>
//                             <Text style={styles.sNoText}>{index + 1}</Text>
//                         </View>
//                         <View>
//                             <Text style={styles.busNo}>{item.bus_number}</Text>
//                             <Text style={styles.busName}>{item.bus_name}</Text>
//                         </View>
//                     </View>

//                     {userRole === 'admin' && (
//                         <View style={styles.actionRow}>
//                             <TouchableOpacity onPress={() => openEditModal(item)} style={styles.iconBtn}>
//                                 <Image source={{ uri: EDIT_ICON }} style={styles.editIcon} />
//                             </TouchableOpacity>
//                             <TouchableOpacity onPress={() => handleDeleteVehicle(item.id)} style={styles.iconBtn}>
//                                 <Image source={{ uri: TRASH_ICON }} style={styles.trashIcon} />
//                             </TouchableOpacity>
//                         </View>
//                     )}
//                 </View>

//                 {files && files.length > 0 ? (
//                     <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumContainer}>
//                         {files.map((fileUrl, index) => {
//                             const fullUrl = getFileUrl(fileUrl);
//                             if(!fullUrl) return null;
//                             const fileIsPdf = isPdf(fileUrl);
//                             return (
//                                 <TouchableOpacity key={index} onPress={() => openFile(fullUrl)}>
//                                     <View style={styles.fileWrapper}>
//                                         <Image 
//                                             source={{ uri: fileIsPdf ? PDF_ICON : fullUrl }} 
//                                             style={styles.albumPhoto} 
//                                             resizeMode="cover"
//                                         />
//                                         {fileIsPdf && <View style={styles.pdfBadge}><Text style={styles.pdfBadgeText}>PDF</Text></View>}
//                                     </View>
//                                 </TouchableOpacity>
//                             );
//                         })}
//                     </ScrollView>
//                 ) : (
//                     <Text style={styles.noPhotos}>No docs uploaded</Text>
//                 )}
//             </View>
//         );
//     };

//     return (
//         <SafeAreaView style={styles.container}>
//             <View style={styles.header}>
//                 <View style={styles.headerLeft}>
//                     <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
//                         <Image source={{ uri: BACK_ICON }} style={styles.backIcon} />
//                     </TouchableOpacity>
//                     <Text style={styles.headerTitle}>Vehicle Details</Text>
//                 </View>
                
//                 {userRole === 'admin' && (
//                     <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
//                         <Text style={styles.addButtonText}>+ Add Bus</Text>
//                     </TouchableOpacity>
//                 )}
//             </View>

//             {loading ? (
//                 <View style={styles.centered}><ActivityIndicator size="large" color="#008080" /></View>
//             ) : (
//                 <FlatList
//                     data={vehicles}
//                     renderItem={({ item, index }) => renderVehicleCard({ item, index })}
//                     keyExtractor={(item) => item.id.toString()}
//                     contentContainerStyle={styles.listContent}
//                     ListEmptyComponent={
//                         <View style={styles.centered}>
//                             <Text style={styles.emptyText}>No Vehicles Added Yet.</Text>
//                         </View>
//                     }
//                 />
//             )}

//             {/* Add/Edit Modal */}
//             <Modal visible={showModal} animationType="slide" transparent>
//                 <View style={styles.modalOverlay}>
//                     <View style={styles.modalContent}>
//                         <Text style={styles.modalTitle}>{isEditing ? "Edit Bus Details" : "Add School Bus"}</Text>
                        
//                         <Text style={styles.label}>Bus Number</Text>
//                         <TextInput 
//                             placeholder="e.g. TN-01-1234" 
//                             style={styles.input} 
//                             value={busNumber}
//                             onChangeText={setBusNumber}
//                         />
                        
//                         <Text style={styles.label}>Bus Name/Route Name</Text>
//                         <TextInput 
//                             placeholder="e.g. Yellow Bus" 
//                             style={styles.input} 
//                             value={busName}
//                             onChangeText={setBusName}
//                         />

//                         {/* Photos Section */}
//                         <Text style={styles.label}>Photos / Documents:</Text>
//                         <View style={styles.imagePickerContainer}>
//                             <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                
//                                 {/* 1. Existing Photos (Edit Mode) */}
//                                 {existingPhotos.map((photoUrl, i) => {
//                                     const fullUrl = getFileUrl(photoUrl);
//                                     const fileIsPdf = isPdf(photoUrl);
//                                     return (
//                                         <View key={`exist-${i}`} style={styles.previewContainer}>
//                                             <Image 
//                                                 source={{ uri: fileIsPdf ? PDF_ICON : fullUrl }} 
//                                                 style={[styles.previewImage, { borderColor: '#38A169' }]} // Green border for existing
//                                             />
//                                             <TouchableOpacity 
//                                                 style={styles.removeFileBtn} 
//                                                 onPress={() => removeExistingPhoto(i)}
//                                             >
//                                                 <Text style={styles.removeFileText}>✕</Text>
//                                             </TouchableOpacity>
//                                         </View>
//                                     );
//                                 })}

//                                 {/* 2. New Selected Files */}
//                                 {selectedFiles.map((file, i) => {
//                                      const isPdfFile = file.type === 'application/pdf' || file.name?.endsWith('.pdf');
//                                      return (
//                                         <View key={`new-${i}`} style={styles.previewContainer}>
//                                             <Image 
//                                                 source={{ uri: isPdfFile ? PDF_ICON : file.uri }} 
//                                                 style={[styles.previewImage, { borderColor: '#3182CE' }]} // Blue border for new
//                                             />
//                                             <TouchableOpacity 
//                                                 style={styles.removeFileBtn} 
//                                                 onPress={() => removeNewFile(i)}
//                                             >
//                                                 <Text style={styles.removeFileText}>✕</Text>
//                                             </TouchableOpacity>
//                                         </View>
//                                      );
//                                 })}

//                                 {/* 3. Pick Button */}
//                                 <TouchableOpacity style={styles.pickBtn} onPress={pickFiles}>
//                                     <Text style={styles.pickBtnText}>+</Text>
//                                     <Text style={styles.pickBtnSubText}>Add File</Text>
//                                 </TouchableOpacity>
//                             </ScrollView>
//                         </View>
//                         <Text style={styles.hintText}>
//                             {existingPhotos.length} existing, {selectedFiles.length} new selected
//                         </Text>

//                         {/* Actions */}
//                         <View style={styles.modalButtons}>
//                             <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
//                                 <Text style={styles.cancelText}>Cancel</Text>
//                             </TouchableOpacity>
//                             <TouchableOpacity style={styles.saveBtn} onPress={handleSaveVehicle}>
//                                 <Text style={styles.saveText}>{isEditing ? "Update Bus" : "Save Bus"}</Text>
//                             </TouchableOpacity>
//                         </View>
//                     </View>
//                 </View>
//             </Modal>
//         </SafeAreaView>
//     );
// };

// const styles = StyleSheet.create({
//     container: { flex: 1, backgroundColor: '#F7FAFC' },
//     centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
//     // Header
//     header: { 
//         flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
//         padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#E2E8F0' 
//     },
//     headerLeft: { flexDirection: 'row', alignItems: 'center' },
//     backButton: { marginRight: 15, padding: 5 },
//     backIcon: { width: 24, height: 24, tintColor: '#2D3748' },
//     headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A202C' },
//     addButton: { backgroundColor: '#38A169', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
//     addButtonText: { color: '#FFF', fontWeight: 'bold' },

//     // Access Denied
//     accessDeniedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
//     deniedIcon: { width: 80, height: 80, marginBottom: 20, tintColor: '#E53E3E' },
//     deniedTitle: { fontSize: 22, fontWeight: 'bold', color: '#2D3748', marginBottom: 10 },
//     deniedText: { fontSize: 16, color: '#718096', textAlign: 'center', marginBottom: 30 },
//     goBackBtn: { backgroundColor: '#3182CE', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25 },
//     goBackText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

//     // List
//     listContent: { padding: 16 },
//     card: { backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginBottom: 15, elevation: 3 },
    
//     cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
//     headerLeftContent: { flexDirection: 'row', alignItems: 'center' },
    
//     sNoBadge: { 
//         backgroundColor: '#E2E8F0', width: 28, height: 28, borderRadius: 14, 
//         justifyContent: 'center', alignItems: 'center', marginRight: 10 
//     },
//     sNoText: { fontSize: 12, fontWeight: 'bold', color: '#4A5568' },

//     busNo: { fontSize: 18, fontWeight: 'bold', color: '#2D3748' },
//     busName: { fontSize: 14, color: '#718096' },
    
//     actionRow: { flexDirection: 'row', alignItems: 'center' },
//     iconBtn: { marginLeft: 10, padding: 5 },
//     editIcon: { width: 22, height: 22, tintColor: '#3182CE' },
//     trashIcon: { width: 22, height: 22, tintColor: '#E53E3E' },
    
//     // Album in Card
//     albumContainer: { marginTop: 10, flexDirection: 'row' },
//     fileWrapper: { marginRight: 10, position: 'relative' },
//     albumPhoto: { width: 90, height: 90, borderRadius: 8, backgroundColor: '#EDF2F7', borderWidth: 1, borderColor: '#E2E8F0' },
//     pdfBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(229, 62, 62, 0.8)', padding: 2, alignItems: 'center', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
//     pdfBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
//     noPhotos: { color: '#CBD5E0', fontStyle: 'italic', marginTop: 10 },
//     emptyText: { color: '#718096', fontSize: 16 },

//     // Modal
//     modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
//     modalContent: { backgroundColor: '#FFF', borderRadius: 12, padding: 20 },
//     modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
//     label: { fontSize: 14, fontWeight: '600', marginBottom: 5, color: '#4A5568' },
//     input: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16 },
    
//     imagePickerContainer: { flexDirection: 'row', marginBottom: 5, height: 80 },
//     previewContainer: { marginRight: 10, position: 'relative' },
//     previewImage: { width: 70, height: 70, borderRadius: 8, borderWidth: 1 },
//     removeFileBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: '#E53E3E', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
//     removeFileText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
    
//     pickBtn: { width: 70, height: 70, borderRadius: 8, borderWidth: 1, borderColor: '#3182CE', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
//     pickBtnText: { fontSize: 24, color: '#3182CE' },
//     pickBtnSubText: { fontSize: 10, color: '#3182CE' },
//     hintText: { fontSize: 12, color: '#718096', marginBottom: 20 },
    
//     modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
//     cancelBtn: { padding: 12, flex: 1, alignItems: 'center' },
//     cancelText: { color: '#E53E3E', fontWeight: 'bold' },
//     saveBtn: { backgroundColor: '#3182CE', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, flex: 1, alignItems: 'center', marginLeft: 10 },
//     saveText: { color: '#FFF', fontWeight: 'bold' },
// });

// export default VehicalDetails;