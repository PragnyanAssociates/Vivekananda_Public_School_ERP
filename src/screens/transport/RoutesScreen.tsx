import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    SafeAreaView,
    Alert,
    ActivityIndicator,
    PermissionsAndroid,
    Platform,
    ScrollView
} from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import Geolocation from 'react-native-geolocation-service';
import { io } from 'socket.io-client';
// ✅ IMPORT YOUR HELPER
import { getRoadPath } from '../../utils/routeHelper'; 
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { SERVER_URL } from '../../../apiConfig';

// ==========================================================
// 🔑 CONFIGURATION
// ==========================================================
// 🔴 REPLACE WITH YOUR MAPTILER KEY
const MAPTILER_KEY = 'X6chcXQ64ffLsmvUuEMz'; 

// We use the "streets" style to avoid black screens
const STYLE_URL = `https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`;

// Fix for Android TextureView issues
MapLibreGL.setAccessToken(null); 

const socket = io(SERVER_URL);

// --- ASSETS ---
const BUS_ICON = 'https://cdn-icons-png.flaticon.com/128/3448/3448339.png';
const DRIVER_ICON = 'https://cdn-icons-png.flaticon.com/128/2684/2684218.png';
const CONDUCTOR_ICON = 'https://cdn-icons-png.flaticon.com/128/1533/1533506.png';
const BACK_ICON = 'https://cdn-icons-png.flaticon.com/128/271/271220.png';

// --- HELPER: SAFE FLOAT PARSING ---
const safeFloat = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(value);
    return (isNaN(num) || !isFinite(num)) ? null : num;
};

// ==========================================================
// 1. LIVE MAP COMPONENT (FIXED ZOOM & LINE)
// ==========================================================
const LiveMapRoute = ({ routeId, onBack, isAdmin }) => {
    const [routeData, setRouteData] = useState(null);
    const [routeShape, setRouteShape] = useState(null); 
    const [busLocation, setBusLocation] = useState(null); 
    const [busBearing, setBusBearing] = useState(0);
    
    // State to hold camera settings (Bounds OR Center)
    const [cameraState, setCameraState] = useState({
        centerCoordinate: [78.4867, 17.3850], // Default Hyderabad
        zoomLevel: 10,
    });

    const cameraRef = useRef(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                let url = routeId ? `/transport/routes/${routeId}` : '/transport/student/my-route';
                const res = await apiClient.get(url);
                setRouteData(res.data);

                // 1. Setup Bus Location
                const lat = safeFloat(res.data.current_lat);
                const lng = safeFloat(res.data.current_lng);
                if (lat && lng) {
                    setBusLocation([lng, lat]);
                }

                // 2. Calculate Bounds & Route Path
                if (res.data.stops && res.data.stops.length > 0) {
                    
                    // --- A. CALCULATE BOUNDS (Fixes the black/zoomed out screen) ---
                    const lats = res.data.stops.map(s => safeFloat(s.stop_lat)).filter(l => l !== null);
                    const lngs = res.data.stops.map(s => safeFloat(s.stop_lng)).filter(l => l !== null);
                    
                    if (lats.length > 0 && lngs.length > 0) {
                        const minLat = Math.min(...lats);
                        const maxLat = Math.max(...lats);
                        const minLng = Math.min(...lngs);
                        const maxLng = Math.max(...lngs);

                        // Update Camera to look at these bounds
                        setCameraState({
                            bounds: {
                                ne: [maxLng, maxLat], // North East
                                sw: [minLng, minLat], // South West
                            },
                            padding: { top: 50, bottom: 50, left: 50, right: 50 },
                            animationDuration: 1000,
                        });
                    }

                    // --- B. DRAW ROUTE LINE (Using Helper) ---
                    try {
                        // helper returns [{latitude, longitude}]
                        const pathObjects = await getRoadPath(res.data.stops);
                        
                        // Convert to MapLibre format [[lng, lat]]
                        const coordinates = pathObjects.map(p => [p.longitude, p.latitude]);

                        if (coordinates.length > 0) {
                            setRouteShape({
                                type: 'Feature',
                                properties: {},
                                geometry: {
                                    type: 'LineString',
                                    coordinates: coordinates,
                                },
                            });
                        }
                    } catch (err) {
                        console.log("Error fetching road path", err);
                    }
                }
            } catch (e) {
                console.log("Error loading route", e);
                Alert.alert("Error", "Could not load route details");
            }
        };
        fetchInitialData();
    }, [routeId]);

    // Socket Listener
    useEffect(() => {
        if (!routeData) return;
        
        socket.emit('join_route', routeData.id);

        const handleReceiveLocation = (data) => {
            const lat = safeFloat(data.lat);
            const lng = safeFloat(data.lng);
            const bearing = safeFloat(data.bearing) || 0;

            if (lat && lng) {
                const newLoc = [lng, lat];
                setBusLocation(newLoc);
                setBusBearing(bearing);
            }
        };

        socket.on('receive_location', handleReceiveLocation);
        return () => socket.off('receive_location', handleReceiveLocation);
    }, [routeData]);

    if (!routeData) return <ActivityIndicator size="large" color="#008080" style={{marginTop: 50}} />;

    return (
        <View style={styles.container}>
            {/* --- MAP SECTION --- */}
            <View style={styles.mapContainer}>
                {isAdmin && (
                    <TouchableOpacity onPress={onBack} style={styles.backOverlay}>
                        <Image source={{ uri: BACK_ICON }} style={{ width: 24, height: 24 }} />
                    </TouchableOpacity>
                )}
                
                <MapLibreGL.MapView
                    style={StyleSheet.absoluteFill}
                    styleURL={STYLE_URL}
                    logoEnabled={false}
                    attributionEnabled={false}
                >
                    {/* 
                       ✅ FIX: We spread the cameraState here.
                       It will contain EITHER 'centerCoordinate' OR 'bounds', never both.
                    */}
                    <MapLibreGL.Camera
                        ref={cameraRef}
                        {...cameraState}
                    />

                    {/* 1. The Red Route Line (Road Path) */}
                    {routeShape && (
                        <MapLibreGL.ShapeSource id="routeSource" shape={routeShape}>
                            <MapLibreGL.LineLayer
                                id="routeFill"
                                style={{
                                    lineColor: '#E53E3E', // Red
                                    lineWidth: 4,
                                    lineCap: 'round',
                                    lineJoin: 'round',
                                }}
                            />
                        </MapLibreGL.ShapeSource>
                    )}

                    {/* 2. Stop Markers */}
                    {routeData.stops && routeData.stops.map((stop, i) => {
                        const lat = safeFloat(stop.stop_lat);
                        const lng = safeFloat(stop.stop_lng);
                        if (!lat || !lng) return null;

                        return (
                            <MapLibreGL.PointAnnotation
                                key={`stop-${i}`}
                                id={`stop-${i}`}
                                coordinate={[lng, lat]}
                            >
                                <View style={styles.stopMarker}>
                                    <Text style={styles.stopMarkerText}>{i + 1}</Text>
                                </View>
                            </MapLibreGL.PointAnnotation>
                        );
                    })}

                    {/* 3. Live Bus */}
                    {busLocation && (
                        <MapLibreGL.PointAnnotation id="bus" coordinate={busLocation}>
                            <View style={{ transform: [{ rotate: `${busBearing}deg` }] }}>
                                <Image source={{ uri: BUS_ICON }} style={{ width: 45, height: 45 }} />
                            </View>
                        </MapLibreGL.PointAnnotation>
                    )}
                </MapLibreGL.MapView>
            </View>

            {/* --- DETAILS SECTION --- */}
            <ScrollView style={styles.infoContainer}>
                
                <View style={styles.headerRow}>
                    <Text style={styles.routeTitle}>{routeData.route_name}</Text>
                    <View style={styles.statusBadge}>
                        <View style={styles.dot} />
                        <Text style={styles.statusText}>Live</Text>
                    </View>
                </View>

                {/* Staff Cards */}
                <View style={styles.staffRow}>
                    <View style={[styles.staffCard, { backgroundColor: '#FEFCBF' }]}> 
                        <View style={styles.staffHeader}>
                            <Image source={{ uri: DRIVER_ICON }} style={styles.staffIcon} />
                            <Text style={styles.staffLabel}>Driver</Text>
                        </View>
                        <Text style={styles.staffName}>
                            {routeData.driver_name || 'Unassigned'}
                        </Text>
                    </View>

                    <View style={[styles.staffCard, { backgroundColor: '#C6F6D5' }]}>
                        <View style={styles.staffHeader}>
                            <Image source={{ uri: CONDUCTOR_ICON }} style={styles.staffIcon} />
                            <Text style={styles.staffLabel}>Conductor</Text>
                        </View>
                        <Text style={styles.staffName}>
                            {routeData.conductor_name || 'Unassigned'}
                        </Text>
                    </View>
                </View>

                {/* Stops List */}
                <View style={styles.stopsSection}>
                    <Text style={styles.stopsHeader}>Stops:</Text>
                    <View style={styles.divider} />
                    
                    {routeData.stops && routeData.stops.map((stop, index) => (
                        <View key={index} style={styles.stopItem}>
                            <View style={styles.stopIndexCircle}>
                                <Text style={styles.stopIndexText}>{index + 1}</Text>
                            </View>
                            <View>
                                <Text style={styles.stopName}>{stop.stop_name}</Text>
                            </View>
                        </View>
                    ))}
                    
                    {(!routeData.stops || routeData.stops.length === 0) && (
                        <Text style={{color: '#999', fontStyle: 'italic'}}>No stops added yet.</Text>
                    )}
                </View>
                
                <View style={{height: 40}} />
            </ScrollView>
        </View>
    );
};

// ==========================================================
// 2. DRIVER TRACKER
// ==========================================================
const DriverTracker = () => {
    const [isTracking, setIsTracking] = useState(false);
    const [routeInfo, setRouteInfo] = useState(null);
    const watchId = useRef(null);

    useEffect(() => {
        const fetchRoute = async () => {
            try {
                const res = await apiClient.get('/transport/conductor/students');
                setRouteInfo(res.data.route);
            } catch (e) { }
        };
        fetchRoute();
    }, []);

    const requestPermission = async () => {
        if (Platform.OS === 'android') {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true;
    };

    const startTrip = async () => {
        const hasPermission = await requestPermission();
        if (!hasPermission) return Alert.alert("Permission denied");
        if (!routeInfo) return;

        setIsTracking(true);

        watchId.current = Geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, heading } = position.coords;
                socket.emit('driver_location_update', {
                    routeId: routeInfo.id,
                    lat: latitude,
                    lng: longitude,
                    bearing: heading || 0
                });
            },
            (error) => console.log(error),
            { enableHighAccuracy: true, distanceFilter: 10, interval: 3000 }
        );
    };

    const stopTrip = () => {
        if (watchId.current !== null) {
            Geolocation.clearWatch(watchId.current);
            watchId.current = null;
        }
        setIsTracking(false);
    };

    if (!routeInfo) return <View style={styles.center}><ActivityIndicator color="#008080" /></View>;

    return (
        <View style={styles.center}>
            <Image source={{ uri: BUS_ICON }} style={{ width: 100, height: 100, marginBottom: 20 }} />
            <Text style={styles.title}>{routeInfo.route_name}</Text>
            <Text style={{color: '#666', marginBottom: 30}}>Driver Console</Text>

            {!isTracking ? (
                <TouchableOpacity style={styles.btnStart} onPress={startTrip}>
                    <Text style={styles.btnText}>START TRIP</Text>
                </TouchableOpacity>
            ) : (
                <View style={{alignItems:'center'}}>
                    <Text style={{color:'green', fontSize:16, marginBottom:10, fontWeight:'bold'}}>Broadcasting Location...</Text>
                    <TouchableOpacity style={styles.btnStop} onPress={stopTrip}>
                        <Text style={styles.btnText}>END TRIP</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

// ==========================================================
// 3. MAIN SCREEN
// ==========================================================
const RoutesScreen = () => {
    const { user } = useAuth();
    const [adminRoutes, setAdminRoutes] = useState([]);
    const [selectedAdminRouteId, setSelectedAdminRouteId] = useState(null);

    if (user?.role === 'others') return <DriverTracker />;
    if (user?.role === 'student') return <LiveMapRoute />;

    useEffect(() => {
        if (user?.role === 'admin' || user?.role === 'teacher') {
            apiClient.get('/transport/routes').then(res => setAdminRoutes(res.data));
        }
    }, [user]);

    if (selectedAdminRouteId) {
        return <LiveMapRoute routeId={selectedAdminRouteId} onBack={() => setSelectedAdminRouteId(null)} isAdmin={true} />;
    }

    return (
        <SafeAreaView style={{flex: 1, padding: 16}}>
            <Text style={styles.mainHeader}>Transport Routes</Text>
            <FlatList 
                data={adminRoutes}
                keyExtractor={item => item.id.toString()}
                renderItem={({item}) => (
                    <TouchableOpacity style={styles.card} onPress={() => setSelectedAdminRouteId(item.id)}>
                        <View>
                            <Text style={styles.cardTitle}>{item.route_name}</Text>
                            <Text style={{color:'#666'}}>{item.driver_name || 'No Driver'}</Text>
                        </View>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                             <Text style={{color: '#3182CE', fontWeight:'bold', marginRight: 5}}>Track</Text>
                             <Image source={{uri: 'https://cdn-icons-png.flaticon.com/128/684/684908.png'}} style={{width:16, height:16, tintColor:'#E53E3E'}} />
                        </View>
                    </TouchableOpacity>
                )}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    mainHeader: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: '#2D3748' },
    card: { 
        padding: 20, 
        backgroundColor: 'white', 
        marginBottom: 12, 
        borderRadius: 12, 
        elevation: 2, 
        flexDirection:'row', 
        justifyContent:'space-between', 
        alignItems:'center',
        borderLeftWidth: 5,
        borderLeftColor: '#3182CE'
    },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D3748' },
    
    // Map & Layout
    mapContainer: {
        height: '45%', 
        width: '100%',
        backgroundColor: '#e2e8f0' // Light grey instead of black if tiles fail
    },
    backOverlay: {
        position: 'absolute', top: 40, left: 20, zIndex: 10,
        backgroundColor: 'white', padding: 10, borderRadius: 25, elevation: 5
    },
    infoContainer: {
        flex: 1,
        backgroundColor: 'white',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        marginTop: -20,
        padding: 20,
    },
    
    // Header Info
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    routeTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A202C' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#C6F6D5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'green', marginRight: 6 },
    statusText: { color: 'green', fontWeight: 'bold', fontSize: 12 },
    
    // Staff Cards
    staffRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    staffCard: { width: '48%', padding: 15, borderRadius: 15, elevation: 1, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
    staffHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    staffIcon: { width: 20, height: 20, marginRight: 8 },
    staffLabel: { fontSize: 14, fontWeight: 'bold', color: '#4A5568', textTransform: 'uppercase' },
    staffName: { fontSize: 16, fontWeight: '600', color: '#2D3748' },

    // Stops
    stopsSection: { marginTop: 10 },
    stopsHeader: { fontSize: 20, fontWeight: 'bold', color: '#2D3748', marginBottom: 5, textDecorationLine: 'underline', textDecorationColor: '#E53E3E' },
    divider: { height: 1, backgroundColor: '#E2E8F0', marginBottom: 15 },
    stopItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 },
    stopIndexCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#3182CE', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    stopIndexText: { color: 'white', fontWeight: 'bold' },
    stopName: { fontSize: 16, color: '#4A5568', fontWeight: '500' },

    // Markers
    stopMarker: { backgroundColor: 'white', padding: 5, borderRadius: 5, borderWidth: 1, borderColor: '#3182CE', elevation: 3 },
    stopMarkerText: { fontSize: 10, fontWeight: 'bold', color: '#3182CE' },

    // Buttons
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 10, color: '#2D3748' },
    btnStart: { backgroundColor: '#38A169', padding: 15, borderRadius: 30, width: 200, alignItems:'center' },
    btnStop: { backgroundColor: '#E53E3E', padding: 15, borderRadius: 30, width: 200, alignItems:'center' },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default RoutesScreen;