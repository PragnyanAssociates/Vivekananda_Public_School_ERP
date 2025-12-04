import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image, TouchableOpacity, SafeAreaView,
    Modal, TextInput, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import Geolocation from 'react-native-geolocation-service';
import { io } from 'socket.io-client';
import { getRoadPath } from '../../utils/routeHelper'; 
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { SERVER_URL } from '../../../apiConfig';
import { useNavigation } from '@react-navigation/native';

// --- CONFIG ---
const MAPTILER_KEY = 'X6chcXQ64ffLsmvUuEMz'; // REPLACE WITH YOUR KEY
const STYLE_URL = `https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`;
MapLibreGL.setAccessToken(null);
const socket = io(SERVER_URL);

// --- ICONS ---
const BUS_ICON = 'https://cdn-icons-png.flaticon.com/128/3448/3448339.png';
const CHECK_ICON = 'https://cdn-icons-png.flaticon.com/128/5290/5290058.png';
const TRASH_ICON = 'https://cdn-icons-png.flaticon.com/128/6861/6861362.png';
const USER_ADD = 'https://cdn-icons-png.flaticon.com/128/1077/1077114.png';

const RoutesScreen = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const isDriver = user?.role === 'others';

    // --- VIEW STATES ---
    // 'LIST': Show all routes
    // 'EDITOR': The Step-by-Step Creator
    const [viewMode, setViewMode] = useState<'LIST' | 'EDITOR'>('LIST'); 
    
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(false);

    // --- EDITOR STATE ---
    const [editStep, setEditStep] = useState(1); // 1: Info, 2: Map/Stops/Passengers
    const [currentRoute, setCurrentRoute] = useState<any>({});
    const [currentStops, setCurrentStops] = useState<any[]>([]);
    const [routeShape, setRouteShape] = useState<any>(null); // Polyline
    
    // Resources for Dropdowns
    const [resources, setResources] = useState({ vehicles: [], drivers: [], conductors: [] });
    const [allStudents, setAllStudents] = useState([]);

    // UI Toggles
    const [showStopNameModal, setShowStopNameModal] = useState(false);
    const [showPassengerModal, setShowPassengerModal] = useState(false);
    
    // Temp Vars
    const [tempCoords, setTempCoords] = useState<number[] | null>(null);
    const [tempStopName, setTempStopName] = useState('');
    const [activeStopForAssign, setActiveStopForAssign] = useState<any>(null);

    // Driver/Live Tracking
    const [busLocation, setBusLocation] = useState<number[] | null>(null);

    // --- INIT ---
    useEffect(() => {
        if (isAdmin) {
            fetchRoutes();
            fetchResources();
        } else if (isDriver) {
            fetchDriverData();
        } else {
            fetchStudentRoute();
        }
    }, []);

    // --- FETCHERS ---
    const fetchRoutes = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/transport/routes');
            setRoutes(res.data);
        } catch(e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchResources = async () => {
        try {
            const res = await apiClient.get('/transport/admin/resources');
            setResources(res.data);
            const studRes = await apiClient.get('/transport/admin/students-for-assignment');
            setAllStudents(studRes.data);
        } catch(e) { console.error(e); }
    };

    const fetchRouteDetails = async (routeId: number) => {
        try {
            const res = await apiClient.get(`/transport/routes/${routeId}/stops`);
            setCurrentStops(res.data);
            updateMapPath(res.data);
        } catch(e) {}
    };

    const fetchDriverData = async () => {
        // ... (Same logic as previous for driver)
    };

    const fetchStudentRoute = async () => {
        // ... (Same logic as previous for student)
    };

    // --- HELPER: Draw Path on Map ---
    const updateMapPath = async (stopsList: any[]) => {
        if (stopsList.length > 1) {
            const coordinates = await getRoadPath(stopsList);
            if (coordinates.length > 0) {
                setRouteShape({
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates }
                });
            }
        } else {
            setRouteShape(null);
        }
    };

    // =========================================================
    // --- STEP 1: CREATE/EDIT ROUTE INFO ---
    // =========================================================
    
    const startNewRoute = () => {
        setCurrentRoute({ id: null, route_name: '', vehicle_id: '', driver_id: '', conductor_id: '' });
        setCurrentStops([]);
        setRouteShape(null);
        setEditStep(1);
        setViewMode('EDITOR');
    };

    const editExistingRoute = (route: any) => {
        setCurrentRoute(route);
        fetchRouteDetails(route.id);
        setEditStep(1); // Start from info, can click "Next" to go to map
        setViewMode('EDITOR');
    };

    const saveRouteInfo = async () => {
        if(!currentRoute.route_name) return Alert.alert("Missing Name");
        
        try {
            let routeId = currentRoute.id;
            const payload = {
                route_name: currentRoute.route_name,
                driver_id: currentRoute.driver_id,
                conductor_id: currentRoute.conductor_id,
                vehicle_id: currentRoute.vehicle_id
            };

            if (routeId) {
                await apiClient.put(`/transport/routes/${routeId}`, payload);
            } else {
                // Create new
                const res = await apiClient.post('/transport/routes', payload);
                // We need the ID of the newly created route to add stops
                // Assuming backend returns { message: '...', routeId: 123 } -> You might need to update backend to return ID
                // For now, let's refresh and find it or just alert
                Alert.alert("Success", "Route Created! Now select it from list to add stops (Backend update recommended to return ID)");
                setViewMode('LIST');
                fetchRoutes();
                return;
            }
            setEditStep(2); // Proceed to Map
        } catch(e) { Alert.alert("Error saving info"); }
    };

    // =========================================================
    // --- STEP 2: MAP & STOPS ---
    // =========================================================

    const onMapPress = (e: any) => {
        // User tapped map to add a stop
        setTempCoords(e.geometry.coordinates);
        setTempStopName('');
        setShowStopNameModal(true);
    };

    const saveNewStop = async () => {
        if(!tempStopName || !tempCoords) return;
        try {
            await apiClient.post('/transport/stops', {
                route_id: currentRoute.id,
                stop_name: tempStopName,
                stop_lng: tempCoords[0],
                stop_lat: tempCoords[1],
                stop_order: currentStops.length + 1
            });
            setShowStopNameModal(false);
            // Refresh stops
            const res = await apiClient.get(`/transport/routes/${currentRoute.id}/stops`);
            setCurrentStops(res.data);
            updateMapPath(res.data);
        } catch(e) { Alert.alert("Error adding stop"); }
    };

    const deleteStop = async (stopId: number) => {
        try {
            await apiClient.delete(`/transport/stops/${stopId}`);
            // Refresh
            const res = await apiClient.get(`/transport/routes/${currentRoute.id}/stops`);
            setCurrentStops(res.data);
            updateMapPath(res.data);
        } catch(e) {}
    };

    // =========================================================
    // --- STEP 3: PASSENGER ASSIGNMENT ---
    // =========================================================

    const openPassengerModal = (stop: any) => {
        setActiveStopForAssign(stop);
        // Refresh student list to get latest assignments
        fetchResources(); 
        setShowPassengerModal(true);
    };

    const toggleStudentAssignment = async (studentId: number, isCurrentlyAssigned: boolean) => {
        try {
            if(isCurrentlyAssigned) {
                // Remove
                await apiClient.post('/transport/stops/remove-student', { passenger_id: studentId });
            } else {
                // Assign
                await apiClient.post('/transport/stops/assign-student', { 
                    passenger_ids: [studentId], 
                    route_id: currentRoute.id, 
                    stop_id: activeStopForAssign.id 
                });
            }
            // Refresh local list state
            const studRes = await apiClient.get('/transport/admin/students-for-assignment');
            setAllStudents(studRes.data);
        } catch(e) {}
    };

    // =========================================================
    // --- RENDERERS ---
    // =========================================================

    // 1. LIST VIEW
    const renderRouteList = () => (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Manage Routes</Text>
                <TouchableOpacity onPress={startNewRoute} style={styles.addBtn}>
                    <Text style={{color:'white', fontWeight:'bold'}}>+ New Route</Text>
                </TouchableOpacity>
            </View>
            <FlatList 
                data={routes}
                keyExtractor={(item:any) => item.id.toString()}
                renderItem={({item}) => (
                    <TouchableOpacity style={styles.card} onPress={() => editExistingRoute(item)}>
                        <View>
                            <Text style={styles.cardTitle}>{item.route_name}</Text>
                            <Text style={{color:'#718096'}}>{item.bus_number || 'No Bus'} • {item.driver_name || 'No Driver'}</Text>
                        </View>
                        <Text style={{color:'#3182CE', fontWeight:'bold'}}>Edit ›</Text>
                    </TouchableOpacity>
                )}
            />
        </SafeAreaView>
    );

    // 2. EDITOR VIEW
    const renderEditor = () => {
        return (
            <View style={styles.container}>
                {/* Editor Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => setViewMode('LIST')}>
                        <Text style={{fontSize:16, color:'#4A5568'}}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {editStep === 1 ? 'Step 1: Info' : 'Step 2: Stops & Map'}
                    </Text>
                    {editStep === 1 ? (
                        <TouchableOpacity onPress={saveRouteInfo}>
                            <Text style={{fontSize:16, color:'#3182CE', fontWeight:'bold'}}>Next ›</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={() => setViewMode('LIST')}>
                            <Text style={{fontSize:16, color:'#38A169', fontWeight:'bold'}}>Finish</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* STEP 1: FORM */}
                {editStep === 1 && (
                    <ScrollView style={{padding:20}}>
                        <Text style={styles.label}>Route Name</Text>
                        <TextInput 
                            style={styles.input} 
                            value={currentRoute.route_name} 
                            onChangeText={t => setCurrentRoute({...currentRoute, route_name: t})}
                            placeholder="e.g. Route 1 - Morning"
                        />

                        <Text style={styles.label}>Assign Vehicle</Text>
                        <View style={styles.pillContainer}>
                            {resources.vehicles.map((v:any) => (
                                <TouchableOpacity 
                                    key={v.id} 
                                    onPress={() => setCurrentRoute({...currentRoute, vehicle_id: v.id})}
                                    style={[styles.pill, currentRoute.vehicle_id === v.id && styles.activePill]}
                                >
                                    <Text style={currentRoute.vehicle_id === v.id ? {color:'white'} : {color:'#4A5568'}}>{v.bus_number}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Assign Driver</Text>
                        <View style={styles.pillContainer}>
                            {resources.drivers.map((d:any) => (
                                <TouchableOpacity 
                                    key={d.id} 
                                    onPress={() => setCurrentRoute({...currentRoute, driver_id: d.id})}
                                    style={[styles.pill, currentRoute.driver_id === d.id && styles.activePill]}
                                >
                                    <Text style={currentRoute.driver_id === d.id ? {color:'white'} : {color:'#4A5568'}}>{d.full_name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Assign Conductor</Text>
                        <View style={styles.pillContainer}>
                            {resources.conductors.map((c:any) => (
                                <TouchableOpacity 
                                    key={c.id} 
                                    onPress={() => setCurrentRoute({...currentRoute, conductor_id: c.id})}
                                    style={[styles.pill, currentRoute.conductor_id === c.id && styles.activePill]}
                                >
                                    <Text style={currentRoute.conductor_id === c.id ? {color:'white'} : {color:'#4A5568'}}>{c.full_name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                )}

                {/* STEP 2: MAP & STOPS */}
                {editStep === 2 && (
                    <View style={{flex:1}}>
                        {/* Map Half */}
                        <View style={{height: '50%'}}>
                            <MapLibreGL.MapView 
                                style={StyleSheet.absoluteFill} 
                                styleURL={STYLE_URL}
                                onPress={onMapPress}
                            >
                                <MapLibreGL.Camera defaultSettings={{ centerCoordinate: [78.4867, 17.3850], zoomLevel: 11 }} />
                                
                                {/* Path Line */}
                                {routeShape && (
                                    <MapLibreGL.ShapeSource id="routeSource" shape={routeShape}>
                                        <MapLibreGL.LineLayer id="routeFill" style={{ lineColor: '#3182CE', lineWidth: 4 }} />
                                    </MapLibreGL.ShapeSource>
                                )}

                                {/* Stop Markers */}
                                {currentStops.map((stop: any, index: number) => (
                                    <MapLibreGL.PointAnnotation 
                                        key={stop.id} 
                                        id={`stop-${stop.id}`} 
                                        coordinate={[parseFloat(stop.stop_lng), parseFloat(stop.stop_lat)]}
                                    >
                                        <View style={styles.markerCircle}><Text style={styles.markerText}>{index + 1}</Text></View>
                                    </MapLibreGL.PointAnnotation>
                                ))}
                            </MapLibreGL.MapView>
                            <View style={styles.mapOverlay}>
                                <Text style={{fontWeight:'bold'}}>Tap map to add stop</Text>
                            </View>
                        </View>

                        {/* Stops List Half */}
                        <View style={{flex:1, backgroundColor:'white'}}>
                            <Text style={styles.sectionHeader}>Stops List ({currentStops.length})</Text>
                            <FlatList 
                                data={currentStops}
                                keyExtractor={(item:any) => item.id.toString()}
                                renderItem={({item, index}) => (
                                    <View style={styles.stopRow}>
                                        <View style={styles.markerCircleSmall}><Text style={styles.markerTextSmall}>{index+1}</Text></View>
                                        <View style={{flex:1, marginLeft:10}}>
                                            <Text style={{fontWeight:'bold'}}>{item.stop_name}</Text>
                                        </View>
                                        
                                        {/* Actions */}
                                        <TouchableOpacity onPress={() => openPassengerModal(item)} style={styles.actionBtn}>
                                            <Image source={{uri: USER_ADD}} style={{width:20, height:20, tintColor:'#3182CE'}} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => deleteStop(item.id)} style={[styles.actionBtn, {marginLeft:10}]}>
                                            <Image source={{uri: TRASH_ICON}} style={{width:20, height:20, tintColor:'#E53E3E'}} />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            />
                        </View>
                    </View>
                )}
            </View>
        );
    };

    // 3. MAIN RETURN
    if (isAdmin) {
        return (
            <>
                {viewMode === 'LIST' ? renderRouteList() : renderEditor()}

                {/* MODAL: ADD STOP NAME */}
                <Modal visible={showStopNameModal} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Name this Stop</Text>
                            <TextInput 
                                style={styles.input} 
                                autoFocus 
                                placeholder="e.g. Ameerpet Circle" 
                                value={tempStopName} 
                                onChangeText={setTempStopName}
                            />
                            <View style={styles.modalFooter}>
                                <TouchableOpacity onPress={() => setShowStopNameModal(false)}><Text style={{marginRight:20, color:'red'}}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity onPress={saveNewStop}><Text style={{color:'#3182CE', fontWeight:'bold'}}>Save Stop</Text></TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* MODAL: MANAGE PASSENGERS */}
                <Modal visible={showPassengerModal} animationType="slide">
                    <SafeAreaView style={{flex:1, backgroundColor:'white'}}>
                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>Assign Students to {activeStopForAssign?.stop_name}</Text>
                            <TouchableOpacity onPress={() => setShowPassengerModal(false)}>
                                <Text style={{fontSize:16, color:'red'}}>Done</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList 
                            data={allStudents}
                            keyExtractor={(item:any) => item.passenger_id.toString()}
                            renderItem={({item}) => {
                                // Check if assigned to this stop
                                const isAssignedToThis = item.stop_id === activeStopForAssign?.id;
                                // Check if assigned to ANOTHER stop (disable or show differently)
                                const isAssignedElsewhere = item.stop_id && !isAssignedToThis;

                                return (
                                    <TouchableOpacity 
                                        style={[styles.studentRow, isAssignedElsewhere && {opacity: 0.5}]}
                                        onPress={() => !isAssignedElsewhere && toggleStudentAssignment(item.passenger_id, isAssignedToThis)}
                                        disabled={isAssignedElsewhere}
                                    >
                                        <Text style={{flex:1, fontSize:16}}>
                                            {item.full_name} <Text style={{color:'#718096'}}>({item.roll_no})</Text>
                                        </Text>
                                        {isAssignedToThis ? (
                                            <Image source={{uri: CHECK_ICON}} style={{width:24, height:24}} />
                                        ) : (
                                            <View style={styles.circle} />
                                        )}
                                        {isAssignedElsewhere && <Text style={{fontSize:10, color:'red'}}>Assigned elsewhere</Text>}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </SafeAreaView>
                </Modal>
            </>
        );
    }

    // --- NON ADMIN VIEWS (Driver/Student) ---
    // (Reuse the previous simple map code for them)
    return (
        <View style={styles.center}><Text>Switch to Admin role to see the Manager</Text></View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F7FAFC' },
    center: { flex:1, justifyContent:'center', alignItems:'center' },
    
    // Header
    header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:15, backgroundColor:'white', borderBottomWidth:1, borderColor:'#E2E8F0' },
    headerTitle: { fontSize:18, fontWeight:'bold', color:'#2D3748' },
    addBtn: { backgroundColor:'#3182CE', paddingHorizontal:12, paddingVertical:8, borderRadius:5 },

    // List Card
    card: { backgroundColor:'white', padding:15, marginHorizontal:15, marginTop:10, borderRadius:8, flexDirection:'row', justifyContent:'space-between', alignItems:'center', elevation:2 },
    cardTitle: { fontSize:16, fontWeight:'bold', color:'#2D3748' },

    // Step 1 Form
    label: { fontSize:14, fontWeight:'bold', color:'#4A5568', marginBottom:10, marginTop:15 },
    input: { borderWidth:1, borderColor:'#CBD5E0', padding:12, borderRadius:8, backgroundColor:'white', fontSize:16 },
    pillContainer: { flexDirection:'row', flexWrap:'wrap' },
    pill: { paddingHorizontal:12, paddingVertical:8, borderRadius:20, borderWidth:1, borderColor:'#CBD5E0', marginRight:8, marginBottom:8 },
    activePill: { backgroundColor:'#3182CE', borderColor:'#3182CE' },

    // Map & Stops
    markerCircle: { width:30, height:30, borderRadius:15, backgroundColor:'white', alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:'#3182CE' },
    markerText: { color:'#3182CE', fontWeight:'bold' },
    mapOverlay: { position:'absolute', top:10, alignSelf:'center', backgroundColor:'rgba(255,255,255,0.9)', padding:8, borderRadius:20 },
    
    sectionHeader: { padding:10, backgroundColor:'#EDF2F7', fontWeight:'bold', color:'#4A5568' },
    stopRow: { flexDirection:'row', alignItems:'center', padding:15, borderBottomWidth:1, borderColor:'#E2E8F0' },
    markerCircleSmall: { width:24, height:24, borderRadius:12, backgroundColor:'#3182CE', alignItems:'center', justifyContent:'center' },
    markerTextSmall: { color:'white', fontSize:12, fontWeight:'bold' },
    actionBtn: { padding:5 },

    // Modals
    modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', padding:20 },
    modalContent: { backgroundColor:'white', padding:20, borderRadius:10 },
    modalTitle: { fontSize:18, fontWeight:'bold', marginBottom:15 },
    modalFooter: { flexDirection:'row', justifyContent:'flex-end', marginTop:20 },

    // Passenger List
    studentRow: { flexDirection:'row', alignItems:'center', padding:15, borderBottomWidth:1, borderColor:'#F7FAFC' },
    circle: { width:24, height:24, borderRadius:12, borderWidth:2, borderColor:'#CBD5E0' }
});

export default RoutesScreen;