// import React, { useState, useEffect } from 'react';
// import {
//     View,
//     Text,
//     StyleSheet,
//     FlatList,
//     TouchableOpacity,
//     Modal,
//     TextInput,
//     Alert,
//     SafeAreaView,
//     Image,
//     ActivityIndicator
// } from 'react-native';
// import { useNavigation } from '@react-navigation/native';
// import apiClient from '../../api/client';
// import { useAuth } from '../../context/AuthContext';

// // Icons
// const BACK_ICON = 'https://cdn-icons-png.flaticon.com/128/271/271220.png';
// const DENIED_ICON = 'https://cdn-icons-png.flaticon.com/128/3967/3967261.png';
// const EDIT_ICON = 'https://cdn-icons-png.flaticon.com/128/1159/1159633.png'; // Pencil Icon

// // Helper for Date Input (YYYY-MM-DD) - Required for SQL Input
// const getTodayISO = () => new Date().toISOString().split('T')[0];

// // Helper for Display (DD/MM/YYYY) - Required for UI
// const formatDateDisplay = (isoDate: string) => {
//     if (!isoDate) return '-';
//     // Handle cases where date might be full ISO string
//     const datePart = isoDate.split('T')[0]; 
//     const [year, month, day] = datePart.split('-');
//     return `${day}/${month}/${year}`;
// };

// const VehicleLogScreen = () => {
//     const navigation = useNavigation();
//     const { user } = useAuth();
    
//     // --- STATE ---
//     const [loading, setLoading] = useState(false);
//     const [mainTab, setMainTab] = useState<'general' | 'service'>('general');
//     const [generalSubTab, setGeneralSubTab] = useState<'daily' | 'monthly' | 'overall'>('daily');
    
//     const [vehicles, setVehicles] = useState<any[]>([]); 
//     const [logs, setLogs] = useState<any[]>([]); 

//     // Edit State
//     const [isEditing, setIsEditing] = useState(false);
//     const [selectedLogId, setSelectedLogId] = useState<number | null>(null);

//     // Modal States
//     const [showDailyModal, setShowDailyModal] = useState(false);
//     const [showServiceModal, setShowServiceModal] = useState(false);

//     // Form Data
//     const [formData, setFormData] = useState({
//         vehicle_id: '',
//         log_date: getTodayISO(),
//         distance_km: '',
//         fuel_consumed: '',
//         notes: '',
//         service_date: getTodayISO(),
//         prev_service_date: '',
//         service_details: '',
//         cost: ''
//     });

//     // --- ACCESS CONTROL ---
//     if (!user || (user.role !== 'admin' && user.role !== 'others')) {
//         return (
//             <SafeAreaView style={styles.container}>
//                 <View style={styles.header}>
//                     <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
//                         <Image source={{ uri: BACK_ICON }} style={styles.backIcon} />
//                     </TouchableOpacity>
//                     <Text style={styles.headerTitle}>Vehicle Log</Text>
//                 </View>
//                 <View style={styles.restrictedContainer}>
//                     <Image source={{ uri: DENIED_ICON }} style={styles.deniedIcon} />
//                     <Text style={styles.restrictedTitle}>Access Restricted</Text>
//                     <Text style={styles.restrictedText}>You are not authorized to view logs.</Text>
//                     <TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}>
//                         <Text style={styles.goBackText}>Go Back</Text>
//                     </TouchableOpacity>
//                 </View>
//             </SafeAreaView>
//         );
//     }

//     // --- DATA FETCHING ---
//     useEffect(() => {
//         fetchVehicles();
//     }, []);

//     useEffect(() => {
//         if (mainTab === 'general') {
//             fetchGeneralLogs(generalSubTab);
//         } else {
//             fetchServiceLogs();
//         }
//     }, [mainTab, generalSubTab]);

//     const fetchVehicles = async () => {
//         try {
//             const res = await apiClient.get('/transport/vehicles');
//             setVehicles(res.data);
//         } catch (e) { console.error(e); }
//     };

//     const fetchGeneralLogs = async (type: string) => {
//         setLoading(true);
//         try {
//             const res = await apiClient.get(`/transport/logs/${type}`);
//             setLogs(res.data);
//         } catch (e) { console.error("Log fetch error", e); }
//         finally { setLoading(false); }
//     };

//     const fetchServiceLogs = async () => {
//         setLoading(true);
//         try {
//             const res = await apiClient.get('/transport/logs/service');
//             setLogs(res.data);
//         } catch (e) { console.error("Service fetch error", e); }
//         finally { setLoading(false); }
//     };

//     // --- ACTIONS: OPEN MODALS ---

//     const openAddDaily = () => {
//         setIsEditing(false);
//         setFormData({ ...formData, log_date: getTodayISO(), distance_km: '', fuel_consumed: '', notes: '', vehicle_id: '' });
//         setShowDailyModal(true);
//     };

//     const openEditDaily = (item: any) => {
//         setIsEditing(true);
//         setSelectedLogId(item.id);
//         setFormData({
//             ...formData,
//             vehicle_id: item.vehicle_id,
//             log_date: item.log_date.split('T')[0], // Keep YYYY-MM-DD for Input
//             distance_km: String(item.distance_km),
//             fuel_consumed: String(item.fuel_consumed),
//             notes: item.notes || ''
//         });
//         setShowDailyModal(true);
//     };

//     const openAddService = () => {
//         setIsEditing(false);
//         setFormData({ ...formData, service_date: getTodayISO(), prev_service_date: '', service_details: '', cost: '', vehicle_id: '' });
//         setShowServiceModal(true);
//     };

//     const openEditService = (item: any) => {
//         setIsEditing(true);
//         setSelectedLogId(item.id);
//         setFormData({
//             ...formData,
//             vehicle_id: item.vehicle_id,
//             service_date: item.service_date.split('T')[0],
//             prev_service_date: item.prev_service_date ? item.prev_service_date.split('T')[0] : '',
//             service_details: item.service_details,
//             cost: String(item.cost)
//         });
//         setShowServiceModal(true);
//     };

//     // --- SUBMIT ACTIONS ---

//     const handleSubmitDaily = async () => {
//         if (!formData.vehicle_id || !formData.distance_km) return Alert.alert('Error', 'Select vehicle & distance');
        
//         const payload = {
//             vehicle_id: formData.vehicle_id,
//             log_date: formData.log_date,
//             distance_km: formData.distance_km,
//             fuel_consumed: formData.fuel_consumed,
//             notes: formData.notes
//         };

//         try {
//             if (isEditing && selectedLogId) {
//                 await apiClient.put(`/transport/logs/daily/${selectedLogId}`, payload);
//                 Alert.alert('Success', 'Daily Log Updated');
//             } else {
//                 await apiClient.post('/transport/logs/daily', payload);
//                 Alert.alert('Success', 'Daily Log Added');
//             }
//             setShowDailyModal(false);
//             fetchGeneralLogs('daily');
//         } catch (e) { Alert.alert('Error', 'Failed to save log'); }
//     };

//     const handleSubmitService = async () => {
//         if (!formData.vehicle_id || !formData.service_date) return Alert.alert('Error', 'Select vehicle & date');
        
//         const payload = {
//             vehicle_id: formData.vehicle_id,
//             service_date: formData.service_date,
//             prev_service_date: formData.prev_service_date,
//             service_details: formData.service_details,
//             cost: formData.cost
//         };

//         try {
//             if (isEditing && selectedLogId) {
//                 await apiClient.put(`/transport/logs/service/${selectedLogId}`, payload);
//                 Alert.alert('Success', 'Service Log Updated');
//             } else {
//                 await apiClient.post('/transport/logs/service', payload);
//                 Alert.alert('Success', 'Service Log Added');
//             }
//             setShowServiceModal(false);
//             fetchServiceLogs();
//         } catch (e) { Alert.alert('Error', 'Failed to save log'); }
//     };

//     // --- RENDERERS ---

//     const renderHeader = (headers: string[]) => (
//         <View style={styles.tableHeader}>
//             {headers.map((h, i) => (
//                 <Text key={i} style={[styles.headerText, { flex: 1, textAlign: 'center' }]}>{h}</Text>
//             ))}
//             {/* Empty header for Edit Action */}
//             {(generalSubTab === 'daily' || mainTab === 'service') && <Text style={[styles.headerText, {width: 40}]}></Text>}
//         </View>
//     );

//     const renderRow = (item: any) => {
//         // GENERAL LOGS
//         if (mainTab === 'general') {
//             if (generalSubTab === 'daily') {
//                 return (
//                     <View style={styles.tableRow}>
//                         <Text style={styles.cell}>{formatDateDisplay(item.log_date)}</Text>
//                         <Text style={styles.cell}>{item.vehicle_no}</Text>
//                         <Text style={styles.cell}>{item.distance_km} km</Text>
//                         <Text style={styles.cell}>{item.fuel_consumed} L</Text>
//                         {/* Edit Button */}
//                         <TouchableOpacity onPress={() => openEditDaily(item)} style={styles.editBtn}>
//                             <Image source={{ uri: EDIT_ICON }} style={styles.editIcon} />
//                         </TouchableOpacity>
//                     </View>
//                 );
//             }
//             if (generalSubTab === 'monthly') {
//                 return (
//                     <View style={styles.tableRow}>
//                         <Text style={styles.cell}>{item.month}</Text>
//                         <Text style={styles.cell}>{item.vehicle_name || 'N/A'}</Text>
//                         <Text style={styles.cell}>{item.total_distance} km</Text>
//                         <Text style={styles.cell}>{item.total_fuel} L</Text>
//                     </View>
//                 );
//             }
//             if (generalSubTab === 'overall') {
//                 return (
//                     <View style={styles.tableRow}>
//                         <Text style={styles.cell}>{item.vehicle_name || 'N/A'}</Text>
//                         <Text style={styles.cell}>{item.total_trips}</Text>
//                         <Text style={styles.cell}>{item.total_distance || 0} km</Text>
//                         <Text style={styles.cell}>{item.total_fuel || 0} L</Text>
//                     </View>
//                 );
//             }
//         }
//         // SERVICE LOGS
//         else {
//             return (
//                 <View style={styles.tableRow}>
//                     <Text style={styles.cell}>{item.vehicle_no}</Text>
//                     <Text style={styles.cell}>{formatDateDisplay(item.service_date)}</Text>
//                     <Text style={styles.cell}>{item.service_details}</Text>
//                     <Text style={styles.cell}>₹{item.cost}</Text>
//                     {/* Edit Button */}
//                     <TouchableOpacity onPress={() => openEditService(item)} style={styles.editBtn}>
//                         <Image source={{ uri: EDIT_ICON }} style={styles.editIcon} />
//                     </TouchableOpacity>
//                 </View>
//             );
//         }
//     };

//     return (
//         <SafeAreaView style={styles.container}>
//             {/* Header */}
//             <View style={styles.header}>
//                 <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
//                     <Image source={{ uri: BACK_ICON }} style={styles.backIcon} />
//                 </TouchableOpacity>
//                 <Text style={styles.headerTitle}>Vehicle Log Book</Text>
//                 <View style={{width: 30}} />
//             </View>

//             {/* Main Tabs */}
//             <View style={styles.tabContainer}>
//                 <TouchableOpacity 
//                     style={[styles.tab, mainTab === 'general' && styles.activeTab]} 
//                     onPress={() => setMainTab('general')}
//                 >
//                     <Text style={[styles.tabText, mainTab === 'general' && styles.activeTabText]}>Daily Log</Text>
//                 </TouchableOpacity>
//                 <TouchableOpacity 
//                     style={[styles.tab, mainTab === 'service' && styles.activeTab]} 
//                     onPress={() => setMainTab('service')}
//                 >
//                     <Text style={[styles.tabText, mainTab === 'service' && styles.activeTabText]}>Service / Repair</Text>
//                 </TouchableOpacity>
//             </View>

//             {/* Sub Header (Filters & Buttons) */}
//             <View style={styles.subHeader}>
//                 {mainTab === 'general' ? (
//                     <View style={{flexDirection:'row'}}>
//                         {['daily', 'monthly', 'overall'].map((t) => (
//                             <TouchableOpacity 
//                                 key={t} 
//                                 onPress={() => setGeneralSubTab(t as any)}
//                                 style={[styles.subTab, generalSubTab === t && styles.activeSubTab]}
//                             >
//                                 <Text style={{color: generalSubTab === t ? '#3182CE' : '#718096', textTransform:'capitalize', fontSize: 12, fontWeight: 'bold'}}>{t}</Text>
//                             </TouchableOpacity>
//                         ))}
//                     </View>
//                 ) : (
//                     <Text style={styles.sectionTitle}>Maintenance Records</Text>
//                 )}

//                 {/* Show Add button only for daily/service */}
//                 {(mainTab === 'service' || (mainTab === 'general' && generalSubTab === 'daily')) && (
//                     <TouchableOpacity 
//                         style={styles.addButton} 
//                         onPress={() => mainTab === 'general' ? openAddDaily() : openAddService()}
//                     >
//                         <Text style={{color:'white', fontWeight:'bold'}}>+ Add Entry</Text>
//                     </TouchableOpacity>
//                 )}
//             </View>

//             {/* Data Table */}
//             {loading ? <ActivityIndicator size="large" color="#3182CE" style={{marginTop: 50}} /> : (
//                 <View style={{flex: 1, padding: 10}}>
//                     {mainTab === 'general' && generalSubTab === 'daily' && renderHeader(['Date', 'Vehicle', 'Dist.', 'Fuel'])}
//                     {mainTab === 'general' && generalSubTab === 'monthly' && renderHeader(['Month', 'Vehicle', 'Total Dist.', 'Total Fuel'])}
//                     {mainTab === 'general' && generalSubTab === 'overall' && renderHeader(['Vehicle', 'Trips', 'Total Dist.', 'Total Fuel'])}
//                     {mainTab === 'service' && renderHeader(['Vehicle', 'Date', 'Details', 'Cost'])}

//                     <FlatList 
//                         data={logs}
//                         keyExtractor={(item, index) => index.toString()}
//                         renderItem={({item}) => renderRow(item)}
//                         ListEmptyComponent={<Text style={styles.emptyText}>No logs found.</Text>}
//                     />
//                 </View>
//             )}

//             {/* --- MODAL 1: Daily Log --- */}
//             <Modal visible={showDailyModal} transparent animationType="slide">
//                 <View style={styles.modalOverlay}>
//                     <View style={styles.modalContent}>
//                         <Text style={styles.modalTitle}>{isEditing ? 'Edit Log' : 'New Daily Log'}</Text>
                        
//                         <Text style={styles.label}>Select Vehicle:</Text>
//                         <View style={{flexDirection:'row', flexWrap:'wrap', marginBottom:15}}>
//                             {vehicles.map(v => (
//                                 <TouchableOpacity 
//                                     key={v.id} 
//                                     onPress={() => setFormData({...formData, vehicle_id: v.id})}
//                                     style={[styles.badge, formData.vehicle_id === v.id && styles.activeBadge]}
//                                 >
//                                     <Text style={formData.vehicle_id === v.id ? {color:'white', fontSize: 12} : {color:'#333', fontSize: 12}}>{v.bus_number}</Text>
//                                 </TouchableOpacity>
//                             ))}
//                         </View>

//                         <Text style={styles.label}>Log Details:</Text>
//                         <TextInput 
//                             placeholder="YYYY-MM-DD" 
//                             value={formData.log_date} 
//                             style={styles.input} 
//                             onChangeText={t => setFormData({...formData, log_date: t})} 
//                         />
//                         <Text style={{fontSize:10, color:'#718096', marginBottom:10, marginTop:-8}}>Format: YYYY-MM-DD</Text>

//                         <TextInput placeholder="Distance Traveled (km)" value={formData.distance_km} keyboardType="numeric" style={styles.input} onChangeText={t => setFormData({...formData, distance_km: t})} />
//                         <TextInput placeholder="Fuel Consumed (Litres)" value={formData.fuel_consumed} keyboardType="numeric" style={styles.input} onChangeText={t => setFormData({...formData, fuel_consumed: t})} />
//                         <TextInput placeholder="Notes (Optional)" value={formData.notes} style={styles.input} onChangeText={t => setFormData({...formData, notes: t})} />

//                         <View style={styles.modalBtns}>
//                             <TouchableOpacity onPress={() => setShowDailyModal(false)} style={styles.cancelBtn}><Text style={{color:'#E53E3E'}}>Cancel</Text></TouchableOpacity>
//                             <TouchableOpacity onPress={handleSubmitDaily} style={styles.saveBtn}><Text style={{color:'white', fontWeight:'bold'}}>{isEditing ? 'Update' : 'Save'}</Text></TouchableOpacity>
//                         </View>
//                     </View>
//                 </View>
//             </Modal>

//             {/* --- MODAL 2: Service Log --- */}
//             <Modal visible={showServiceModal} transparent animationType="slide">
//                 <View style={styles.modalOverlay}>
//                     <View style={styles.modalContent}>
//                         <Text style={styles.modalTitle}>{isEditing ? 'Edit Record' : 'New Service Record'}</Text>

//                         <Text style={styles.label}>Select Vehicle:</Text>
//                         <View style={{flexDirection:'row', flexWrap:'wrap', marginBottom:15}}>
//                             {vehicles.map(v => (
//                                 <TouchableOpacity 
//                                     key={v.id} 
//                                     onPress={() => setFormData({...formData, vehicle_id: v.id})}
//                                     style={[styles.badge, formData.vehicle_id === v.id && styles.activeBadge]}
//                                 >
//                                     <Text style={formData.vehicle_id === v.id ? {color:'white', fontSize: 12} : {color:'#333', fontSize: 12}}>{v.bus_number}</Text>
//                                 </TouchableOpacity>
//                             ))}
//                         </View>

//                         <Text style={styles.label}>Service Details:</Text>
//                         <TextInput placeholder="YYYY-MM-DD" value={formData.service_date} style={styles.input} onChangeText={t => setFormData({...formData, service_date: t})} />
//                         <TextInput placeholder="Prev Date (YYYY-MM-DD)" value={formData.prev_service_date} style={styles.input} onChangeText={t => setFormData({...formData, prev_service_date: t})} />
//                         <TextInput placeholder="Work Details (Oil change, tires...)" value={formData.service_details} style={styles.input} onChangeText={t => setFormData({...formData, service_details: t})} />
//                         <TextInput placeholder="Total Cost (₹)" value={formData.cost} keyboardType="numeric" style={styles.input} onChangeText={t => setFormData({...formData, cost: t})} />

//                         <View style={styles.modalBtns}>
//                             <TouchableOpacity onPress={() => setShowServiceModal(false)} style={styles.cancelBtn}><Text style={{color:'#E53E3E'}}>Cancel</Text></TouchableOpacity>
//                             <TouchableOpacity onPress={handleSubmitService} style={styles.saveBtn}><Text style={{color:'white', fontWeight:'bold'}}>{isEditing ? 'Update' : 'Save'}</Text></TouchableOpacity>
//                         </View>
//                     </View>
//                 </View>
//             </Modal>

//         </SafeAreaView>
//     );
// };

// const styles = StyleSheet.create({
//     container: { flex: 1, backgroundColor: '#F7FAFC' },
    
//     // Header
//     header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#E2E8F0' },
//     backButton: { padding: 5 },
//     backIcon: { width: 24, height: 24, tintColor: '#2D3748' },
//     headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#2D3748' },

//     // Restricted View
//     restrictedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
//     deniedIcon: { width: 80, height: 80, marginBottom: 20, tintColor: '#E53E3E' },
//     restrictedTitle: { fontSize: 22, fontWeight: 'bold', color: '#2D3748', marginBottom: 10 },
//     restrictedText: { fontSize: 16, color: '#4A5568', textAlign: 'center', marginBottom: 30 },
//     goBackBtn: { backgroundColor: '#3182CE', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25 },
//     goBackText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

//     // Tabs
//     tabContainer: { flexDirection: 'row', backgroundColor: 'white', elevation: 2 },
//     tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
//     activeTab: { borderBottomColor: '#3182CE' },
//     tabText: { fontSize: 16, color: '#718096', fontWeight: 'bold' },
//     activeTabText: { color: '#3182CE' },

//     // Sub Header
//     subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#EDF2F7' },
//     sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#2D3748' },
//     subTab: { paddingVertical: 6, paddingHorizontal: 12, marginRight: 5, borderRadius: 15, backgroundColor: '#E2E8F0' },
//     activeSubTab: { backgroundColor: '#BEE3F8' },
//     addButton: { backgroundColor: '#38A169', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 },

//     // Table
//     tableHeader: { flexDirection: 'row', backgroundColor: '#CBD5E0', padding: 10, borderRadius: 5, marginBottom: 5 },
//     headerText: { fontWeight: 'bold', fontSize: 12, color: '#2D3748' },
//     tableRow: { flexDirection: 'row', backgroundColor: 'white', padding: 12, borderBottomWidth: 1, borderBottomColor: '#EDF2F7', alignItems:'center' },
//     cell: { flex: 1, fontSize: 12, color: '#4A5568', textAlign: 'center' },
//     emptyText: { textAlign: 'center', marginTop: 30, color: '#A0AEC0' },

//     // Edit Button
//     editBtn: { padding: 5, width: 30, alignItems: 'center' },
//     editIcon: { width: 16, height: 16, tintColor: '#3182CE' },

//     // Modal
//     modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
//     modalContent: { backgroundColor: 'white', borderRadius: 10, padding: 20 },
//     modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
//     input: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 5, padding: 10, marginBottom: 12 },
//     label: { marginBottom: 8, fontWeight:'bold', color: '#4A5568', marginTop: 5},
//     modalBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
//     cancelBtn: { padding: 12, flex: 1, alignItems: 'center' },
//     saveBtn: { backgroundColor: '#3182CE', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, flex: 1, alignItems: 'center', marginLeft: 10 },
    
//     // Vehicle Selection Badge
//     badge: { padding: 8, borderRadius: 5, backgroundColor: '#E2E8F0', marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: '#CBD5E0' },
//     activeBadge: { backgroundColor: '#3182CE', borderColor: '#3182CE' }
// });

// export default VehicleLogScreen;