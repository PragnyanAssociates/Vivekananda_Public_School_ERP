import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image, TouchableOpacity, SafeAreaView,
    Modal, TextInput, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import Geolocation from 'react-native-geolocation-service';
import { io } from 'socket.io-client';
import { useNavigation } from '@react-navigation/native';

// Custom Imports
import { getRoadPath } from '../../utils/routeHelper'; 
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { SERVER_URL } from '../../../apiConfig';

// --- CONFIG ---
const MAPTILER_KEY = 'LcjtfAnfWsn73mRnaArK'; 

// ✅ CORRECT: Using Vector Style JSON for full details (roads, buildings, names)
const STYLE_URL = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;

// ✅ FIXED: Proper Initialization
MapLibreGL.setAccessToken(null); 
MapLibreGL.setConnected(true);

const socket = io(SERVER_URL);

// --- ICONS ---
const BUS_ICON = 'https://cdn-icons-png.flaticon.com/128/3448/3448339.png';
const EDIT_ICON = 'https://cdn-icons-png.flaticon.com/128/1159/1159633.png';
const TRASH_ICON = 'https://cdn-icons-png.flaticon.com/128/6861/6861362.png';
const USER_ADD = 'https://cdn-icons-png.flaticon.com/128/1077/1077114.png';
const CHECK_ICON = 'https://cdn-icons-png.flaticon.com/128/5290/5290058.png';
const MAP_ICON = 'https://cdn-icons-png.flaticon.com/128/854/854878.png'; 
const BACK_ICON = 'https://cdn-icons-png.flaticon.com/128/271/271220.png';

const RoutesScreen = () => {
    const { user } = useAuth();
    const navigation = useNavigation();

    // Roles
    const isAdmin = user?.role === 'admin';
    const isDriver = user?.role === 'others'; 
    const isStudent = user?.role === 'student' || user?.role === 'teacher';

    // --- STATE ---
    const [viewMode, setViewMode] = useState<'LIST' | 'EDITOR'>('LIST'); 
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(false);

    // --- EDITOR STATE ---
    const [editStep, setEditStep] = useState(1);
    const [currentRoute, setCurrentRoute] = useState<any>({});
    const [currentStops, setCurrentStops] = useState<any[]>([]);
    const [routeShape, setRouteShape] = useState<any>(null); 
    
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
    const [attendanceModal, setAttendanceModal] = useState(false);
    const [currentStopPassengers, setCurrentStopPassengers] = useState([]);
    const [currentStopId, setCurrentStopId] = useState<number | null>(null);

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

    // --- API CALLS ---
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
        setLoading(true);
        try {
            const res = await apiClient.get('/transport/driver/data');
            const { route, stops } = res.data;
            setCurrentRoute({ ...route }); 
            setCurrentStops(stops);
            updateMapPath(stops);
            startLocationUpdates(route.id);
        } catch (e) { Alert.alert("Notice", "No route assigned."); }
        finally { setLoading(false); }
    };

    const fetchStudentRoute = async () => {
        try {
            const res = await apiClient.get('/transport/student/my-route');
            setCurrentRoute(res.data);
            setCurrentStops(res.data.stops || []);
            
            socket.emit('join_route', res.data.id);
            socket.on('receive_location', (data) => {
                setBusLocation([parseFloat(data.lng), parseFloat(data.lat)]);
            });

            if (res.data.stops) updateMapPath(res.data.stops);
        } catch(e) {}
    };

    // --- HELPER: Draw Path ---
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
    // --- ADMIN ACTIONS ---
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
        setEditStep(1);
        setViewMode('EDITOR');
    };

    const viewRouteMap = (route: any) => {
        setCurrentRoute(route);
        fetchRouteDetails(route.id);
        setEditStep(2);
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
                const res = await apiClient.post('/transport/routes', payload);
                Alert.alert("Success", "Route Created! Please go back to the list and click 'Map' to add stops.");
                setViewMode('LIST');
                fetchRoutes();
                return;
            }
            setEditStep(2);
        } catch(e) { Alert.alert("Error saving info"); }
    };

    const deleteRoute = (id: number) => {
        Alert.alert("Delete", "Are you sure?", [
            { text: "Cancel" },
            { text: "Delete", style:'destructive', onPress: async () => {
                await apiClient.delete(`/transport/routes/${id}`);
                fetchRoutes();
            }}
        ]);
    };

    // --- MAP INTERACTIONS ---

    const onMapPress = (e: any) => {
        if (!isAdmin) return; 
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
            const res = await apiClient.get(`/transport/routes/${currentRoute.id}/stops`);
            setCurrentStops(res.data);
            updateMapPath(res.data);
        } catch(e) { Alert.alert("Error adding stop"); }
    };

    const deleteStop = async (stopId: number) => {
        try {
            await apiClient.delete(`/transport/stops/${stopId}`);
            const res = await apiClient.get(`/transport/routes/${currentRoute.id}/stops`);
            setCurrentStops(res.data);
            updateMapPath(res.data);
        } catch(e) {}
    };

    // --- PASSENGER ASSIGNMENT ---

    const openPassengerModal = (stop: any) => {
        setActiveStopForAssign(stop);
        fetchResources();
        setShowPassengerModal(true);
    };

    const toggleStudentAssignment = async (studentId: number, isCurrentlyAssigned: boolean) => {
        try {
            if(isCurrentlyAssigned) {
                await apiClient.post('/transport/stops/remove-student', { passenger_id: studentId });
            } else {
                await apiClient.post('/transport/stops/assign-student', { 
                    passenger_ids: [studentId], 
                    route_id: currentRoute.id, 
                    stop_id: activeStopForAssign.id 
                });
            }
            const studRes = await apiClient.get('/transport/admin/students-for-assignment');
            setAllStudents(studRes.data);
        } catch(e) {}
    };

    // --- DRIVER ATTENDANCE ---

    const startLocationUpdates = (routeId: number) => {
        Geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude, heading } = pos.coords;
                setBusLocation([longitude, latitude]);
                socket.emit('driver_location_update', { routeId, lat: latitude, lng: longitude, bearing: heading });
            },
            (err) => console.log(err),
            { enableHighAccuracy: true, distanceFilter: 10, interval: 3000 }
        );
    };

    const handleStopPress = (stop: any) => {
        if (isDriver) {
            setCurrentStopId(stop.id);
            setCurrentStopPassengers(stop.passengers || []); 
            setAttendanceModal(true);
        }
    };

    const markAttendance = async (passengerId: number, status: string) => {
        try {
            await apiClient.post('/transport/attendance', {
                passenger_id: passengerId,
                status,
                stop_id: currentStopId,
                route_id: currentRoute.id
            });
            setCurrentStopPassengers(prev => prev.map((p:any) => 
                p.id === passengerId ? { ...p, status_marked: status } : p
            ));
        } catch(e) { Alert.alert("Error"); }
    };

    // =========================================================
    // --- RENDERERS ---
    // =========================================================

    // 1. LIST VIEW
    const renderRouteList = () => (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={{flexDirection:'row', alignItems:'center'}}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10}}>
                        <Image source={{uri: BACK_ICON}} style={{width:24, height:24, tintColor: '#2D3748'}} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Manage Routes</Text>
                </View>
                <TouchableOpacity onPress={startNewRoute} style={styles.addBtn}>
                    <Text style={{color:'white', fontWeight:'bold'}}>+ New Route</Text>
                </TouchableOpacity>
            </View>
            <FlatList 
                data={routes}
                keyExtractor={(item:any) => item.id.toString()}
                contentContainerStyle={{paddingBottom: 20}}
                renderItem={({item}) => (
                    <View style={styles.card}>
                        <View style={{flex:1, marginRight:10}}>
                            <Text style={styles.cardTitle}>{item.route_name}</Text>
                            <Text style={{color:'#718096', fontSize:12, marginTop:2}}>
                                {item.bus_number || 'No Bus'} • {item.driver_name || 'No Driver'}
                            </Text>
                        </View>
                        <View style={{flexDirection:'row', alignItems:'center'}}>
                            
                            <TouchableOpacity onPress={() => viewRouteMap(item)} style={styles.mapActionBtn}>
                                <Image source={{ uri: MAP_ICON }} style={styles.mapActionIcon} />
                                <Text style={styles.mapActionText}>Map</Text>
                            </TouchableOpacity>
                            
                            <View style={styles.verticalDivider} />

                            <TouchableOpacity onPress={() => editExistingRoute(item)} style={{padding:5}}>
                                <Image source={{ uri: EDIT_ICON }} style={{width:20, height:20, tintColor:'#3182CE'}} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => deleteRoute(item.id)} style={{padding:5, marginLeft:5}}>
                                <Image source={{ uri: TRASH_ICON }} style={{width:20, height:20, tintColor:'#E53E3E'}} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            />
        </SafeAreaView>
    );

    // 2. EDITOR VIEW
    const renderEditor = () => {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => setViewMode('LIST')}>
                        <Text style={{fontSize:16, color:'#4A5568'}}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {editStep === 1 ? 'Step 1: Info' : 'Step 2: Map & Stops'}
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

                {editStep === 2 && (
                    <View style={{flex:1}}>
                        <View style={{height: '50%'}}>
                            <MapLibreGL.MapView 
                                style={StyleSheet.absoluteFill} 
                                styleURL={STYLE_URL}
                                onPress={onMapPress}
                                logoEnabled={false}
                                attributionEnabled={false}
                                surfaceView={true}
                                compassEnabled={true}
                            >
                                <MapLibreGL.Camera 
                                    defaultSettings={{ centerCoordinate: [78.4867, 17.3850], zoomLevel: 12 }} 
                                />
                                
                                {routeShape && (
                                    <MapLibreGL.ShapeSource id="routeSource" shape={routeShape}>
                                        <MapLibreGL.LineLayer 
                                            id="routeFill" 
                                            style={{ 
                                                lineColor: '#3182CE', 
                                                lineWidth: 4,
                                                lineCap: 'round',
                                                lineJoin: 'round'
                                            }} 
                                        />
                                    </MapLibreGL.ShapeSource>
                                )}

                                {currentStops.map((stop: any, index: number) => (
                                    <MapLibreGL.PointAnnotation 
                                        key={stop.id} 
                                        id={`stop-${stop.id}`} 
                                        coordinate={[parseFloat(stop.stop_lng), parseFloat(stop.stop_lat)]}
                                    >
                                        <View style={styles.pinContainer}>
                                            <View style={styles.pinHead}>
                                                <Text style={styles.pinText}>{index + 1}</Text>
                                            </View>
                                            <View style={styles.pinTail} />
                                        </View>
                                    </MapLibreGL.PointAnnotation>
                                ))}
                            </MapLibreGL.MapView>
                            <View style={styles.mapOverlay}>
                                <Text style={{fontWeight:'bold'}}>Tap map to add stop</Text>
                            </View>
                        </View>

                        <View style={{flex:1, backgroundColor:'white'}}>
                            <Text style={styles.sectionHeader}>Stops List ({currentStops.length})</Text>
                            <FlatList 
                                data={currentStops}
                                keyExtractor={(item:any) => item.id.toString()}
                                renderItem={({item, index}) => (
                                    <View style={styles.stopRow}>
                                        <View style={styles.markerCircleSmall}><Text style={styles.markerTextSmall}>{index+1}</Text></View>
                                        <View style={{flex:1, marginLeft:10}}>
                                            <Text style={{fontWeight:'bold', fontSize:14}}>{item.stop_name}</Text>
                                        </View>
                                        
                                        <TouchableOpacity onPress={() => openPassengerModal(item)} style={styles.actionBtn}>
                                            <Image source={{uri: USER_ADD}} style={{width:22, height:22, tintColor:'#3182CE'}} />
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
            </SafeAreaView>
        );
    };

    if (isAdmin) {
        return (
            <>
                {viewMode === 'LIST' ? renderRouteList() : renderEditor()}

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
                                const isAssignedToThis = item.stop_id === activeStopForAssign?.id;
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
                                            <Image source={{uri: CHECK_ICON}} style={{width:24, height:24, tintColor:'#38A169'}} />
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

    // --- NON-ADMIN VIEW ---
    return (
        <View style={styles.container}>
            <MapLibreGL.MapView 
                style={StyleSheet.absoluteFill} 
                styleURL={STYLE_URL}
                logoEnabled={false}
                attributionEnabled={false}
                surfaceView={true}
                compassEnabled={true}
            >
                <MapLibreGL.Camera 
                    defaultSettings={{ centerCoordinate: [78.4867, 17.3850], zoomLevel: 12 }} 
                    followUserLocation={isDriver}
                />
                
                {routeShape && (
                    <MapLibreGL.ShapeSource id="routeSource" shape={routeShape}>
                        <MapLibreGL.LineLayer 
                            id="routeFill" 
                            style={{ 
                                lineColor: '#3182CE', 
                                lineWidth: 4,
                                lineCap: 'round',
                                lineJoin: 'round'
                            }} 
                        />
                    </MapLibreGL.ShapeSource>
                )}

                {currentStops.map((stop: any, index: number) => (
                    <MapLibreGL.PointAnnotation 
                        key={stop.id} 
                        id={`stop-${stop.id}`} 
                        coordinate={[parseFloat(stop.stop_lng), parseFloat(stop.stop_lat)]}
                        onSelected={() => isDriver && handleStopPress(stop)}
                    >
                        <View style={styles.pinContainer}>
                            <View style={styles.pinHead}>
                                <Text style={styles.pinText}>{index + 1}</Text>
                            </View>
                            <View style={styles.pinTail} />
                        </View>
                    </MapLibreGL.PointAnnotation>
                ))}

                {busLocation && (
                    <MapLibreGL.PointAnnotation id="bus" coordinate={busLocation}>
                        <Image source={{ uri: BUS_ICON }} style={{ width: 40, height: 40 }} />
                    </MapLibreGL.PointAnnotation>
                )}
            </MapLibreGL.MapView>

            {isDriver && (
                <View style={styles.mapOverlay}>
                    <Text>Tap a stop marker to take attendance</Text>
                </View>
            )}

            {isDriver && (
                <Modal visible={attendanceModal} animationType="slide" onRequestClose={() => setAttendanceModal(false)}>
                    <SafeAreaView style={{flex:1, backgroundColor:'white'}}>
                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>Attendance</Text>
                            <TouchableOpacity onPress={() => setAttendanceModal(false)}><Text style={{fontSize:18}}>✕</Text></TouchableOpacity>
                        </View>
                        <FlatList 
                            data={currentStopPassengers}
                            keyExtractor={(item:any) => item.id.toString()}
                            renderItem={({item}) => (
                                <View style={styles.passengerRow}>
                                    <Text style={styles.passengerName}>{item.full_name}</Text>
                                    <View style={{flexDirection:'row'}}>
                                        <TouchableOpacity 
                                            onPress={() => markAttendance(item.id, 'present')}
                                            style={[styles.attBtn, {backgroundColor: item.status_marked === 'present' ? '#48BB78' : '#E2E8F0'}]}
                                        >
                                            <Text>P</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={() => markAttendance(item.id, 'absent')}
                                            style={[styles.attBtn, {backgroundColor: item.status_marked === 'absent' ? '#F56565' : '#E2E8F0', marginLeft: 10}]}
                                        >
                                            <Text>A</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                            ListEmptyComponent={<Text style={{textAlign:'center', marginTop:20}}>No passengers at this stop.</Text>}
                        />
                    </SafeAreaView>
                </Modal>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F7FAFC' },
    center: { flex:1, justifyContent:'center', alignItems:'center' },
    
    header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:15, backgroundColor:'white', borderBottomWidth:1, borderColor:'#E2E8F0' },
    headerTitle: { fontSize:18, fontWeight:'bold', color:'#2D3748' },
    addBtn: { backgroundColor:'#3182CE', paddingHorizontal:12, paddingVertical:8, borderRadius:5 },

    card: { backgroundColor:'white', padding:15, marginHorizontal:15, marginTop:10, borderRadius:8, flexDirection:'row', justifyContent:'space-between', alignItems:'center', elevation:2 },
    cardTitle: { fontSize:16, fontWeight:'bold', color:'#2D3748' },
    
    mapActionBtn: { flexDirection:'row', alignItems:'center', backgroundColor:'#EBF8FF', paddingVertical:6, paddingHorizontal:10, borderRadius:20, marginRight:10 },
    mapActionIcon: { width:14, height:14, tintColor:'#3182CE', marginRight:4 },
    mapActionText: { fontSize:12, fontWeight:'bold', color:'#3182CE' },
    verticalDivider: { width:1, height:20, backgroundColor:'#E2E8F0', marginRight:10 },

    label: { fontSize:14, fontWeight:'bold', color:'#4A5568', marginBottom:10, marginTop:15 },
    input: { borderWidth:1, borderColor:'#CBD5E0', padding:12, borderRadius:8, backgroundColor:'white', fontSize:16 },
    pillContainer: { flexDirection:'row', flexWrap:'wrap' },
    pill: { paddingHorizontal:12, paddingVertical:8, borderRadius:20, borderWidth:1, borderColor:'#CBD5E0', marginRight:8, marginBottom:8 },
    activePill: { backgroundColor:'#3182CE', borderColor:'#3182CE' },

    markerCircleSmall: { width:24, height:24, borderRadius:12, backgroundColor:'#3182CE', alignItems:'center', justifyContent:'center' },
    markerTextSmall: { color:'white', fontSize:12, fontWeight:'bold' },
    
    pinContainer: { alignItems: 'center', justifyContent: 'center', width: 40, height: 50 },
    pinHead: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E53E3E', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white', elevation: 4, zIndex: 2 },
    pinTail: { width: 0, height: 0, borderStyle: 'solid', borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#E53E3E', marginTop: -2 },
    pinText: { color: 'white', fontWeight: 'bold', fontSize: 14 },

    mapOverlay: { position:'absolute', top:10, alignSelf:'center', backgroundColor:'rgba(255,255,255,0.9)', padding:8, borderRadius:20 },
    sectionHeader: { padding:10, backgroundColor:'#EDF2F7', fontWeight:'bold', color:'#4A5568' },
    stopRow: { flexDirection:'row', alignItems:'center', padding:15, borderBottomWidth:1, borderColor:'#E2E8F0' },
    actionBtn: { padding:5 },

    modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', padding:20 },
    modalContent: { backgroundColor:'white', padding:20, borderRadius:10 },
    modalTitle: { fontSize:18, fontWeight:'bold', marginBottom:15 },
    modalFooter: { flexDirection:'row', justifyContent:'flex-end', marginTop:20 },

    studentRow: { flexDirection:'row', alignItems:'center', padding:15, borderBottomWidth:1, borderColor:'#F7FAFC' },
    circle: { width:24, height:24, borderRadius:12, borderWidth:2, borderColor:'#CBD5E0' },
    
    passengerRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:15, borderBottomWidth: 1, borderColor:'#EDF2F7' },
    passengerName: { fontSize: 16, color:'#2D3748' },
    attBtn: { padding: 8, borderRadius: 5, width: 30, alignItems:'center' }
});

export default RoutesScreen;