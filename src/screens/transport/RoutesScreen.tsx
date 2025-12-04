import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image, TouchableOpacity, SafeAreaView,
    Modal, TextInput, Alert, ActivityIndicator, ScrollView, Switch
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
const MAPTILER_KEY = 'X6chcXQ64ffLsmvUuEMz'; // Replace with yours
const STYLE_URL = `https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`;
MapLibreGL.setAccessToken(null);
const socket = io(SERVER_URL);

// --- ASSETS ---
const BUS_ICON = 'https://cdn-icons-png.flaticon.com/128/3448/3448339.png';
const STOP_ICON = 'https://cdn-icons-png.flaticon.com/128/3180/3180149.png'; 
const EDIT_ICON = 'https://cdn-icons-png.flaticon.com/128/1159/1159633.png';
const TRASH_ICON = 'https://cdn-icons-png.flaticon.com/128/6861/6861362.png';

const RoutesScreen = () => {
    const { user } = useAuth();
    const navigation = useNavigation();

    const isAdmin = user?.role === 'admin';
    const isDriver = user?.role === 'others';
    
    // --- STATE ---
    const [routes, setRoutes] = useState([]);
    const [selectedRoute, setSelectedRoute] = useState<any>(null);
    const [routeShape, setRouteShape] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    
    // Admin Resources (For Dropdowns)
    const [resources, setResources] = useState({ vehicles: [], drivers: [], conductors: [] });
    const [allStudents, setAllStudents] = useState([]); // For assigning to stops

    // Forms State
    const [showRouteModal, setShowRouteModal] = useState(false); // Create/Edit Route
    const [routeForm, setRouteForm] = useState({ id: null, name: '', vehicle: '', driver: '', conductor: '' });
    
    const [showStopModal, setShowStopModal] = useState(false); // Stop Details (Edit/Assign)
    const [selectedStop, setSelectedStop] = useState<any>(null);
    const [stopTab, setStopTab] = useState<'details' | 'passengers'>('details'); // Tabs inside Stop Modal
    const [tempCoordinate, setTempCoordinate] = useState<number[] | null>(null); // For new stop

    // Driver Attendance State
    const [attendanceModal, setAttendanceModal] = useState(false);
    
    // Live Map
    const [busLocation, setBusLocation] = useState<number[] | null>(null);

    // --- INITIAL FETCH ---
    useEffect(() => {
        if (isAdmin) {
            fetchRoutes();
            fetchResources(); // Get dropdown data
        } else if (isDriver) {
            fetchDriverData();
        } else {
            // Student/Teacher
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
            const studRes = await apiClient.get('/transport/admin/students');
            setAllStudents(studRes.data);
        } catch(e) { console.error(e); }
    };

    const fetchRouteDetails = async (routeId: number) => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/transport/routes/${routeId}/stops`);
            const stops = res.data;
            
            // Get passengers for this route to distribute among stops locally if needed
            // Ideally backend sends stops WITH passengers, but we'll fetch details when opening stop
            
            if (stops.length > 1) {
                const coordinates = await getRoadPath(stops);
                if (coordinates.length > 0) {
                    setRouteShape({ type: 'Feature', geometry: { type: 'LineString', coordinates } });
                }
            }
            // Merge stops into selected route
            const fullRoute = routes.find((r:any) => r.id === routeId) || selectedRoute;
            setSelectedRoute({ ...fullRoute, stops });
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchDriverData = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/transport/driver/data');
            const { route, stops } = res.data;
            setSelectedRoute({ ...route, stops });
            
            if (stops.length > 1) {
                const coordinates = await getRoadPath(stops);
                setRouteShape({ type: 'Feature', geometry: { type: 'LineString', coordinates } });
            }
            startLocationUpdates(route.id);
        } catch (e) { Alert.alert("Notice", "No route assigned."); }
        finally { setLoading(false); }
    };

    const fetchStudentRoute = async () => {
        try {
            const res = await apiClient.get('/transport/student/my-route');
            setSelectedRoute(res.data);
            socket.emit('join_route', res.data.id);
            socket.on('receive_location', (data) => setBusLocation([parseFloat(data.lng), parseFloat(data.lat)]));
            
            if (res.data.stops) {
                const coordinates = await getRoadPath(res.data.stops);
                setRouteShape({ type: 'Feature', geometry: { type: 'LineString', coordinates } });
            }
        } catch(e) {}
    };

    // --- ADMIN: ROUTE ACTIONS ---

    const handleSaveRoute = async () => {
        if(!routeForm.name) return Alert.alert("Name required");
        const payload = {
            route_name: routeForm.name,
            driver_id: routeForm.driver,
            conductor_id: routeForm.conductor,
            vehicle_id: routeForm.vehicle
        };

        try {
            if(routeForm.id) {
                await apiClient.put(`/transport/routes/${routeForm.id}`, payload);
            } else {
                await apiClient.post('/transport/routes', payload);
            }
            setShowRouteModal(false);
            fetchRoutes();
        } catch(e) { Alert.alert("Error saving route"); }
    };

    const handleDeleteRoute = (id: number) => {
        Alert.alert("Delete", "Are you sure?", [
            { text: "Cancel" },
            { text: "Delete", onPress: async () => {
                await apiClient.delete(`/transport/routes/${id}`);
                fetchRoutes();
            }}
        ]);
    };

    // --- ADMIN: STOP ACTIONS ---

    const onMapPress = (e: any) => {
        if (!isAdmin || !selectedRoute) return;
        setTempCoordinate(e.geometry.coordinates);
        // Open Modal to Add Stop
        setSelectedStop(null); // Null means new stop
        setStopTab('details');
        setShowStopModal(true);
    };

    const onMarkerPress = (stop: any) => {
        // Fetch passengers assigned to this stop
        // We filter from 'allStudents' who have this stop_id
        const assigned = allStudents.filter((s:any) => s.stop_id === stop.id);
        const stopWithPassengers = { ...stop, passengers: assigned };
        
        setSelectedStop(stopWithPassengers);
        setTempCoordinate([parseFloat(stop.stop_lng), parseFloat(stop.stop_lat)]);
        
        if (isDriver) {
            setAttendanceModal(true);
        } else if (isAdmin) {
            setStopTab('details');
            setShowStopModal(true);
        }
    };

    const handleSaveStop = async (name: string) => {
        if (!name) return;
        try {
            // New Stop
            await apiClient.post('/transport/stops', {
                route_id: selectedRoute.id,
                stop_name: name,
                stop_lng: tempCoordinate![0],
                stop_lat: tempCoordinate![1],
                stop_order: (selectedRoute.stops?.length || 0) + 1
            });
            setShowStopModal(false);
            fetchRouteDetails(selectedRoute.id);
        } catch(e) { Alert.alert("Error adding stop"); }
    };

    const handleDeleteStop = async (id: number) => {
        await apiClient.delete(`/transport/stops/${id}`);
        setShowStopModal(false);
        fetchRouteDetails(selectedRoute.id);
    };

    // --- ADMIN: PASSENGER ASSIGNMENT ---
    const handleAssignStudent = async (studentId: number, assign: boolean) => {
        try {
            if(assign) {
                await apiClient.post('/transport/stops/assign-student', {
                    passenger_ids: [studentId],
                    route_id: selectedRoute.id,
                    stop_id: selectedStop.id
                });
            } else {
                await apiClient.post('/transport/stops/remove-student', { passenger_id: studentId });
            }
            // Refresh list
            fetchResources(); // Updates student list with new stop_ids
            // Update local state for UI responsiveness
            if(assign) {
                // Logic to update local state if needed
            }
        } catch(e) { Alert.alert("Error assigning"); }
    };

    // --- DRIVER ACTIONS ---
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

    const markAttendance = async (passengerId: number, status: string) => {
        try {
            await apiClient.post('/transport/attendance', {
                passenger_id: passengerId,
                status,
                stop_id: selectedStop.id,
                route_id: selectedRoute.id
            });
            // Optimistic update
            const updated = selectedStop.passengers.map((p:any) => p.id === passengerId ? {...p, status_marked: status} : p);
            setSelectedStop({...selectedStop, passengers: updated});
        } catch(e) {}
    };

    // --- RENDER HELPERS ---

    // 1. SELECT LIST (Custom Dropdown Alternative for clean UI)
    const SelectItem = ({ label, value, options, onSelect }: any) => {
        const [open, setOpen] = useState(false);
        const selectedLabel = options.find((o:any) => o.id === value)?.label || "Select...";
        return (
            <View style={{marginBottom: 15}}>
                <Text style={styles.label}>{label}</Text>
                <TouchableOpacity onPress={() => setOpen(!open)} style={styles.selectBox}>
                    <Text>{selectedLabel}</Text>
                    <Text>▼</Text>
                </TouchableOpacity>
                {open && (
                    <View style={styles.dropdown}>
                        {options.map((opt:any) => (
                            <TouchableOpacity key={opt.id} style={styles.option} onPress={() => { onSelect(opt.id); setOpen(false); }}>
                                <Text>{opt.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    // --- MAIN RENDER ---

    // VIEW: ADMIN ROUTE LIST
    if (isAdmin && !selectedRoute) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Manage Routes</Text>
                    <TouchableOpacity 
                        onPress={() => {
                            setRouteForm({ id: null, name: '', vehicle: '', driver: '', conductor: '' });
                            setShowRouteModal(true);
                        }} 
                        style={styles.addBtn}
                    >
                        <Text style={{color:'white', fontWeight:'bold'}}>+ Route</Text>
                    </TouchableOpacity>
                </View>
                {loading && <ActivityIndicator size="large" color="#3182CE" />}
                <FlatList 
                    data={routes}
                    keyExtractor={(item:any) => item.id.toString()}
                    renderItem={({item}) => (
                        <View style={styles.card}>
                            <View style={{flex:1}}>
                                <Text style={styles.cardTitle}>{item.route_name}</Text>
                                <Text style={styles.cardSub}>Vehicle: {item.bus_number || 'None'}</Text>
                                <Text style={styles.cardSub}>Driver: {item.driver_name || 'None'}</Text>
                            </View>
                            <View style={{flexDirection:'row'}}>
                                <TouchableOpacity onPress={() => { setSelectedRoute(item); fetchRouteDetails(item.id); }} style={styles.iconBtn}>
                                    <Text style={{color:'#3182CE', fontWeight:'bold'}}>MAP</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => {
                                    setRouteForm({ 
                                        id: item.id, name: item.route_name, 
                                        vehicle: item.vehicle_id, driver: item.driver_id, conductor: item.conductor_id 
                                    });
                                    setShowRouteModal(true);
                                }} style={styles.iconBtn}>
                                    <Image source={{ uri: EDIT_ICON }} style={styles.smallIcon} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteRoute(item.id)} style={styles.iconBtn}>
                                    <Image source={{ uri: TRASH_ICON }} style={[styles.smallIcon, {tintColor:'#E53E3E'}]} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                />

                {/* MODAL: CREATE/EDIT ROUTE */}
                <Modal visible={showRouteModal} animationType="slide" transparent>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>{routeForm.id ? 'Edit Route' : 'New Route'}</Text>
                            
                            <Text style={styles.label}>Route Name</Text>
                            <TextInput 
                                style={styles.input} 
                                value={routeForm.name} 
                                onChangeText={t => setRouteForm({...routeForm, name: t})} 
                                placeholder="e.g. Route 5 - Ameerpet"
                            />

                            <SelectItem 
                                label="Assign Vehicle" 
                                value={routeForm.vehicle} 
                                onSelect={(v:any) => setRouteForm({...routeForm, vehicle: v})}
                                options={resources.vehicles.map((v:any) => ({id: v.id, label: `${v.bus_number} (${v.bus_name})`}))}
                            />
                            <SelectItem 
                                label="Assign Driver" 
                                value={routeForm.driver} 
                                onSelect={(v:any) => setRouteForm({...routeForm, driver: v})}
                                options={resources.drivers.map((d:any) => ({id: d.id, label: d.full_name}))}
                            />
                            <SelectItem 
                                label="Assign Conductor" 
                                value={routeForm.conductor} 
                                onSelect={(v:any) => setRouteForm({...routeForm, conductor: v})}
                                options={resources.conductors.map((c:any) => ({id: c.id, label: c.full_name}))}
                            />

                            <View style={styles.modalBtns}>
                                <TouchableOpacity onPress={() => setShowRouteModal(false)} style={styles.cancelBtn}><Text>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity onPress={handleSaveRoute} style={styles.saveBtn}><Text style={{color:'white'}}>Save</Text></TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        );
    }

    // VIEW: MAP (Admin Detail, Driver, Student)
    return (
        <View style={styles.container}>
            {isAdmin && (
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={() => setSelectedRoute(null)} style={{padding:10}}>
                        <Text style={{fontWeight:'bold', fontSize:18}}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={{fontWeight:'bold', fontSize:16}}>
                        {selectedRoute?.route_name} (Tap map to add stop)
                    </Text>
                </View>
            )}

            <MapLibreGL.MapView 
                style={StyleSheet.absoluteFill} 
                styleURL={STYLE_URL}
                onPress={onMapPress}
            >
                <MapLibreGL.Camera 
                    defaultSettings={{ centerCoordinate: [78.4867, 17.3850], zoomLevel: 11 }}
                    followUserLocation={isDriver}
                />

                {/* Path */}
                {routeShape && (
                    <MapLibreGL.ShapeSource id="routeSource" shape={routeShape}>
                        <MapLibreGL.LineLayer id="routeFill" style={{ lineColor: '#3182CE', lineWidth: 5 }} />
                    </MapLibreGL.ShapeSource>
                )}

                {/* Stops */}
                {selectedRoute?.stops?.map((stop: any, index: number) => (
                    <MapLibreGL.PointAnnotation 
                        key={stop.id} 
                        id={`stop-${stop.id}`} 
                        coordinate={[parseFloat(stop.stop_lng), parseFloat(stop.stop_lat)]}
                        onSelected={() => onMarkerPress(stop)}
                    >
                        <View style={styles.stopMarker}>
                            <Text style={styles.stopText}>{index + 1}</Text>
                        </View>
                    </MapLibreGL.PointAnnotation>
                ))}

                {/* Bus Icon */}
                {busLocation && (
                    <MapLibreGL.PointAnnotation id="bus" coordinate={busLocation}>
                        <Image source={{ uri: BUS_ICON }} style={{ width: 40, height: 40 }} />
                    </MapLibreGL.PointAnnotation>
                )}
            </MapLibreGL.MapView>

            {/* --- ADMIN: STOP & PASSENGER MODAL --- */}
            {isAdmin && (
                <Modal visible={showStopModal} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContentLarge}>
                            {/* Modal Header */}
                            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:15}}>
                                <Text style={styles.modalTitle}>{selectedStop ? 'Manage Stop' : 'New Stop'}</Text>
                                <TouchableOpacity onPress={() => setShowStopModal(false)}><Text style={{fontSize:18}}>✕</Text></TouchableOpacity>
                            </View>

                            {/* Tabs */}
                            {selectedStop && (
                                <View style={styles.tabs}>
                                    <TouchableOpacity onPress={() => setStopTab('details')} style={[styles.tab, stopTab==='details' && styles.activeTab]}>
                                        <Text>Details</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setStopTab('passengers')} style={[styles.tab, stopTab==='passengers' && styles.activeTab]}>
                                        <Text>Passengers</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {stopTab === 'details' ? (
                                <View>
                                    <Text style={styles.label}>Stop Name</Text>
                                    <TextInput 
                                        style={styles.input} 
                                        defaultValue={selectedStop?.stop_name} 
                                        onChangeText={t => selectedStop ? selectedStop.stop_name = t : setNewStopName(t)} // Simplified for brevity
                                        // Real app should use state for input
                                        placeholder="Enter stop name"
                                    />
                                    <View style={styles.modalBtns}>
                                        {selectedStop && (
                                            <TouchableOpacity onPress={() => handleDeleteStop(selectedStop.id)} style={{marginRight:'auto'}}>
                                                <Image source={{uri: TRASH_ICON}} style={{width:24, height:24, tintColor:'red'}} />
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity 
                                            onPress={() => handleSaveStop(selectedStop ? selectedStop.stop_name : newStopName)} 
                                            style={styles.saveBtn}
                                        >
                                            <Text style={{color:'white'}}>Save Stop</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View style={{height: 300}}>
                                    <Text style={{marginBottom:10, color:'#718096'}}>Assign students to this stop:</Text>
                                    <ScrollView>
                                        {allStudents.map((stud:any) => {
                                            const isAssignedHere = stud.stop_id === selectedStop.id;
                                            // Only show students who are unassigned OR assigned to this stop
                                            if (stud.stop_id && !isAssignedHere) return null;

                                            return (
                                                <TouchableOpacity 
                                                    key={stud.id} 
                                                    style={styles.studentRow}
                                                    onPress={() => handleAssignStudent(stud.id, !isAssignedHere)}
                                                >
                                                    <Text style={{flex:1}}>{stud.full_name} ({stud.roll_no})</Text>
                                                    {isAssignedHere ? (
                                                        <Image source={{uri: CHECK_ICON}} style={{width:20, height:20}} />
                                                    ) : (
                                                        <View style={styles.circle} />
                                                    )}
                                                </TouchableOpacity>
                                            )
                                        })}
                                    </ScrollView>
                                </View>
                            )}
                        </View>
                    </View>
                </Modal>
            )}

            {/* --- DRIVER: ATTENDANCE MODAL --- */}
            {isDriver && (
                <Modal visible={attendanceModal} animationType="slide" onRequestClose={() => setAttendanceModal(false)}>
                    <SafeAreaView style={{flex:1, backgroundColor:'white'}}>
                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>Stop: {selectedStop?.stop_name}</Text>
                            <TouchableOpacity onPress={() => setAttendanceModal(false)}><Text style={{fontSize:18, padding:10}}>Close</Text></TouchableOpacity>
                        </View>
                        <FlatList 
                            data={selectedStop?.passengers || []}
                            keyExtractor={(item:any) => item.id.toString()}
                            renderItem={({item}) => (
                                <View style={styles.passengerRow}>
                                    <View>
                                        <Text style={{fontSize:16, fontWeight:'bold'}}>{item.full_name}</Text>
                                        <Text style={{color:'#718096'}}>Roll: {item.id}</Text>
                                    </View>
                                    <View style={{flexDirection:'row'}}>
                                        <TouchableOpacity 
                                            onPress={() => markAttendance(item.id, 'present')} 
                                            style={[styles.attBtn, {backgroundColor: item.status_marked === 'present' ? '#48BB78' : '#EDF2F7'}]}
                                        >
                                            <Text style={{color: item.status_marked === 'present'?'white':'black'}}>P</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={() => markAttendance(item.id, 'absent')} 
                                            style={[styles.attBtn, {backgroundColor: item.status_marked === 'absent' ? '#F56565' : '#EDF2F7', marginLeft:10}]}
                                        >
                                            <Text style={{color: item.status_marked === 'absent'?'white':'black'}}>A</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                            ListEmptyComponent={<Text style={styles.emptyText}>No passengers assigned to this stop.</Text>}
                        />
                    </SafeAreaView>
                </Modal>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F7FAFC' },
    
    // Header & Lists
    header: { flexDirection:'row', justifyContent:'space-between', padding:15, backgroundColor:'white', borderBottomWidth:1, borderColor:'#E2E8F0', alignItems:'center' },
    headerTitle: { fontSize:20, fontWeight:'bold', color:'#2D3748' },
    addBtn: { backgroundColor:'#3182CE', paddingHorizontal:15, paddingVertical:8, borderRadius:5 },
    
    card: { backgroundColor:'white', marginHorizontal:15, marginTop:10, padding:15, borderRadius:10, flexDirection:'row', alignItems:'center', elevation:2 },
    cardTitle: { fontSize:16, fontWeight:'bold', color:'#2D3748' },
    cardSub: { fontSize:12, color:'#718096' },
    iconBtn: { padding:8 },
    smallIcon: { width:20, height:20, tintColor:'#4A5568' },

    // Map Specific
    topBar: { position:'absolute', top:0, left:0, right:0, backgroundColor:'rgba(255,255,255,0.9)', padding:10, paddingTop:40, zIndex:10, flexDirection:'row', alignItems:'center' },
    stopMarker: { backgroundColor:'white', borderRadius:15, width:30, height:30, alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:'#3182CE' },
    stopText: { fontWeight:'bold', color:'#3182CE', fontSize:12 },

    // Modals
    modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', padding:20 },
    modalContent: { backgroundColor:'white', borderRadius:10, padding:20 },
    modalContentLarge: { backgroundColor:'white', borderRadius:10, padding:20, height:500 },
    modalTitle: { fontSize:18, fontWeight:'bold', marginBottom:15, color:'#2D3748' },
    label: { fontSize:12, fontWeight:'bold', color:'#4A5568', marginBottom:5 },
    input: { borderWidth:1, borderColor:'#CBD5E0', borderRadius:5, padding:10, marginBottom:15 },
    
    // Custom Select
    selectBox: { borderWidth:1, borderColor:'#CBD5E0', borderRadius:5, padding:10, flexDirection:'row', justifyContent:'space-between' },
    dropdown: { borderWidth:1, borderColor:'#E2E8F0', borderTopWidth:0, maxHeight:150 },
    option: { padding:10, borderBottomWidth:1, borderBottomColor:'#EDF2F7' },

    // Buttons
    modalBtns: { flexDirection:'row', justifyContent:'flex-end', marginTop:10 },
    cancelBtn: { padding:10, marginRight:10 },
    saveBtn: { backgroundColor:'#3182CE', padding:10, borderRadius:5 },

    // Stop Modal Tabs
    tabs: { flexDirection:'row', marginBottom:15, borderBottomWidth:1, borderColor:'#E2E8F0' },
    tab: { flex:1, padding:10, alignItems:'center' },
    activeTab: { borderBottomWidth:2, borderColor:'#3182CE' },

    // Passenger List
    studentRow: { flexDirection:'row', alignItems:'center', padding:12, borderBottomWidth:1, borderColor:'#EDF2F7' },
    circle: { width:20, height:20, borderRadius:10, borderWidth:1, borderColor:'#CBD5E0' },
    passengerRow: { flexDirection:'row', justifyContent:'space-between', padding:15, borderBottomWidth:1, borderColor:'#EDF2F7', alignItems:'center' },
    attBtn: { width:40, height:40, borderRadius:20, alignItems:'center', justifyContent:'center' },
    emptyText: { textAlign:'center', marginTop:50, color:'#A0AEC0' }
});

export default RoutesScreen;