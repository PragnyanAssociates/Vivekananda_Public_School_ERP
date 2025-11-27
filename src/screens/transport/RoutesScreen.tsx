import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    SafeAreaView,
    Modal,
    TextInput,
    Alert,
    ScrollView,
    ActivityIndicator,
    Linking
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { SERVER_URL } from '../../../apiConfig';

// Icons
const BACK_ICON = 'https://cdn-icons-png.flaticon.com/128/271/271220.png';
const BUS_ICON = 'https://cdn-icons-png.flaticon.com/128/3448/3448339.png'; // Bus Marker
const STOP_ICON = 'https://cdn-icons-png.flaticon.com/128/684/684908.png'; // Location Pin
const STUDENT_DEFAULT = 'https://cdn-icons-png.flaticon.com/128/3135/3135715.png';

// --- SUB-COMPONENTS ---

// 1. CONDUCTOR PANEL (Student In/Out)
const ConductorPanel = () => {
    const [routeData, setRouteData] = useState<any>(null);
    const [stopsData, setStopsData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchConductorData = async () => {
        try {
            const res = await apiClient.get('/transport/conductor/students');
            setRouteData(res.data.route);
            setStopsData(res.data.data);
        } catch (error: any) {
            Alert.alert("Notice", error.response?.data?.message || "No data found");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchConductorData(); }, []);

    const updateStatus = async (passengerId: number, status: 'in' | 'out') => {
        try {
            await apiClient.put('/transport/student-status', { passenger_id: passengerId, status });
            // Optimistic update
            const newStops = stopsData.map(stop => ({
                ...stop,
                students: stop.students.map((s: any) => 
                    s.passenger_id === passengerId ? { ...s, boarding_status: status } : s
                )
            }));
            setStopsData(newStops);
        } catch (e) {
            Alert.alert("Error", "Failed to update status");
        }
    };

    if (loading) return <ActivityIndicator size="large" color="#008080" style={{marginTop: 50}} />;
    if (!routeData) return <View style={styles.center}><Text>No Route Assigned.</Text></View>;

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.sectionTitle}>Route: {routeData.route_name}</Text>
            {stopsData.map((stop, index) => (
                <View key={index} style={styles.stopCard}>
                    <View style={styles.stopHeader}>
                        <Text style={styles.stopName}>{index+1}. {stop.stop_name}</Text>
                    </View>
                    {stop.students.length === 0 ? (
                        <Text style={styles.noStudentText}>No students boarding here.</Text>
                    ) : (
                        stop.students.map((student: any) => (
                            <View key={student.passenger_id} style={styles.studentRow}>
                                <Image source={{ uri: student.profile_image_url ? `${SERVER_URL}${student.profile_image_url}` : STUDENT_DEFAULT }} style={styles.studentAvatar} />
                                <View style={{flex: 1}}>
                                    <Text style={styles.studentName}>{student.full_name}</Text>
                                    <Text style={styles.studentPhone}>{student.phone}</Text>
                                </View>
                                <View style={styles.actionButtons}>
                                    <TouchableOpacity 
                                        style={[styles.statusBtn, student.boarding_status === 'in' ? styles.btnInActive : styles.btnIn]}
                                        onPress={() => updateStatus(student.passenger_id, 'in')}
                                    >
                                        <Text style={styles.btnText}>IN</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.statusBtn, student.boarding_status === 'out' ? styles.btnOutActive : styles.btnOut]}
                                        onPress={() => updateStatus(student.passenger_id, 'out')}
                                    >
                                        <Text style={styles.btnText}>OUT</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            ))}
            <View style={{height: 100}} />
        </ScrollView>
    );
};

// 2. STUDENT / TEACHER MAP VIEW
const LiveMapRoute = ({ routeId }: { routeId?: number }) => {
    const [routeData, setRouteData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const mapRef = useRef<MapView>(null);

    // Poll for live location
    useEffect(() => {
        const fetchData = async () => {
            try {
                let url = routeId ? `/transport/routes/${routeId}` : '/transport/student/my-route';
                const res = await apiClient.get(url);
                setRouteData(res.data);
                setLoading(false);
            } catch (e) {
                console.error(e);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [routeId]);

    if (loading) return <ActivityIndicator size="large" color="#008080" />;
    if (!routeData) return <View style={styles.center}><Text>Route Data Unavailable</Text></View>;

    const busLoc = { 
        latitude: parseFloat(routeData.current_lat) || 17.3850, 
        longitude: parseFloat(routeData.current_lng) || 78.4867 
    };

    return (
        <View style={styles.mapContainer}>
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                provider={PROVIDER_DEFAULT}
                initialRegion={{
                    latitude: busLoc.latitude,
                    longitude: busLoc.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }}
            >
                {/* Stops */}
                {routeData.stops && routeData.stops.map((stop: any) => (
                    <Marker 
                        key={stop.id}
                        coordinate={{ latitude: parseFloat(stop.stop_lat), longitude: parseFloat(stop.stop_lng) }}
                        title={stop.stop_name}
                    >
                        <Image source={{ uri: STOP_ICON }} style={{ width: 30, height: 30 }} />
                    </Marker>
                ))}

                {/* Bus Live Location */}
                <Marker coordinate={busLoc} title={routeData.route_name}>
                    <Image source={{ uri: BUS_ICON }} style={{ width: 40, height: 40 }} />
                </Marker>

                {/* Route Line (Simulated Line based on stops for now) */}
                {routeData.stops && routeData.stops.length > 1 && (
                    <Polyline 
                        coordinates={routeData.stops.map((s:any) => ({ latitude: parseFloat(s.stop_lat), longitude: parseFloat(s.stop_lng) }))}
                        strokeColor="#008080"
                        strokeWidth={4}
                    />
                )}
            </MapView>
            
            <View style={styles.driverCard}>
                <Text style={styles.driverTitle}>{routeData.route_name}</Text>
                <Text>Driver: {routeData.driver_name || 'N/A'}</Text>
                <Text>Conductor: {routeData.conductor_name || 'N/A'}</Text>
            </View>
        </View>
    );
};

// 3. ADMIN ROUTES LIST & ADD
const AdminRoutesPanel = () => {
    const navigation = useNavigation();
    const [routes, setRoutes] = useState([]);
    const [showModal, setShowModal] = useState(false);
    
    // Form State
    const [routeName, setRouteName] = useState('');
    const [driverId, setDriverId] = useState('');
    const [conductorId, setConductorId] = useState('');
    // For demo, just 2 static stops input, usually dynamic list
    const [stop1, setStop1] = useState(''); 
    const [stop2, setStop2] = useState('');

    const fetchRoutes = async () => {
        const res = await apiClient.get('/transport/routes');
        setRoutes(res.data);
    };

    useEffect(() => { fetchRoutes(); }, []);

    const handleCreateRoute = async () => {
        // Simplified Logic: Hardcoding lat/lng for demo stops (Hyderabad coords)
        const stops = [
            { name: stop1, lat: 17.4401, lng: 78.3489 },
            { name: stop2, lat: 17.4500, lng: 78.3600 }
        ];
        try {
            await apiClient.post('/transport/routes', {
                route_name: routeName,
                driver_id: driverId, // Input ID manually for now or use picker
                conductor_id: conductorId,
                stops: stops
            });
            Alert.alert("Success", "Route Created");
            setShowModal(false);
            fetchRoutes();
        } catch (e) {
            Alert.alert("Error", "Failed to create route");
        }
    };

    const deleteRoute = (id: number) => {
        Alert.alert("Delete", "Confirm delete?", [{ text: "Yes", onPress: async () => {
            await apiClient.delete(`/transport/routes/${id}`);
            fetchRoutes();
        }}]);
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
                <Text style={styles.addButtonText}>+ Create New Route</Text>
            </TouchableOpacity>

            <FlatList 
                data={routes}
                keyExtractor={(item:any) => item.id.toString()}
                renderItem={({item}) => (
                    <View style={styles.adminCard}>
                        <View>
                            <Text style={styles.cardTitle}>{item.route_name}</Text>
                            <Text style={styles.cardSub}>Driver: {item.driver_name || 'Unassigned'}</Text>
                            <Text style={styles.cardSub}>Conductor: {item.conductor_name || 'Unassigned'}</Text>
                        </View>
                        <TouchableOpacity onPress={() => deleteRoute(item.id)}>
                            <Text style={{color: 'red', fontWeight: 'bold'}}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                )}
            />

            <Modal visible={showModal} animationType="slide">
                <SafeAreaView style={styles.modalContainer}>
                    <Text style={styles.modalTitle}>Create Route</Text>
                    <TextInput placeholder="Route Name" style={styles.input} value={routeName} onChangeText={setRouteName} />
                    <TextInput placeholder="Driver User ID" style={styles.input} keyboardType="numeric" value={driverId} onChangeText={setDriverId} />
                    <TextInput placeholder="Conductor User ID" style={styles.input} keyboardType="numeric" value={conductorId} onChangeText={setConductorId} />
                    <Text style={{marginTop:10}}>Stops (Demo):</Text>
                    <TextInput placeholder="Stop 1 Name" style={styles.input} value={stop1} onChangeText={setStop1} />
                    <TextInput placeholder="Stop 2 Name" style={styles.input} value={stop2} onChangeText={setStop2} />
                    
                    <View style={styles.modalBtns}>
                        <TouchableOpacity onPress={() => setShowModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity onPress={handleCreateRoute}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>
        </View>
    );
};

// --- MAIN SCREEN ---
const RoutesScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    
    // Header
    const Header = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Image source={{ uri: BACK_ICON }} style={styles.icon} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Transport Routes</Text>
            <View style={{width: 30}} />
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <Header />
            <View style={{ flex: 1 }}>
                {user?.role === 'admin' && <AdminRoutesPanel />}
                {user?.role === 'teacher' && <AdminRoutesPanel />} 
                {user?.role === 'student' && <LiveMapRoute />}
                {user?.role === 'others' && (
                    // Logic to check if they are conductor or driver
                    // For simplicity, we assume they are conductor if assigned
                    <ConductorPanel />
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F7FAFC' },
    container: { flex: 1, padding: 16 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', elevation: 2 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A202C' },
    backBtn: { padding: 5 },
    icon: { width: 24, height: 24, tintColor: '#2D3748' },

    // Admin List
    addButton: { backgroundColor: '#3182CE', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 20 },
    addButtonText: { color: '#FFF', fontWeight: 'bold' },
    adminCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D3748' },
    cardSub: { color: '#718096', fontSize: 14 },

    // Modal
    modalContainer: { flex: 1, padding: 20, backgroundColor: '#FFF' },
    modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 8, padding: 12, marginBottom: 10 },
    modalBtns: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
    cancelText: { color: 'red', fontSize: 18 },
    saveText: { color: 'blue', fontSize: 18, fontWeight: 'bold' },

    // Map
    mapContainer: { flex: 1 },
    driverCard: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: 'white', padding: 15, borderRadius: 10, elevation: 5 },
    driverTitle: { fontSize: 18, fontWeight: 'bold' },

    // Conductor
    sectionTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: '#2D3748' },
    stopCard: { backgroundColor: '#FFF', borderRadius: 10, marginBottom: 20, padding: 15, elevation: 2 },
    stopHeader: { borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 10, marginBottom: 10 },
    stopName: { fontSize: 18, fontWeight: 'bold', color: '#3182CE' },
    noStudentText: { fontStyle: 'italic', color: '#A0AEC0' },
    studentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    studentAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: '#EDF2F7' },
    studentName: { fontSize: 16, fontWeight: 'bold', color: '#2D3748' },
    studentPhone: { color: '#718096', fontSize: 12 },
    actionButtons: { flexDirection: 'row' },
    statusBtn: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 5, marginLeft: 5, borderWidth: 1 },
    btnIn: { borderColor: '#38A169', backgroundColor: 'transparent' },
    btnInActive: { backgroundColor: '#38A169', borderColor: '#38A169' },
    btnOut: { borderColor: '#E53E3E', backgroundColor: 'transparent' },
    btnOutActive: { backgroundColor: '#E53E3E', borderColor: '#E53E3E' },
    btnText: { fontSize: 10, fontWeight: 'bold', color: '#2D3748' }
});

export default RoutesScreen;