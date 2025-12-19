import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';

const DigitalLibraryScreen = () => {
    const navigation = useNavigation();
    const [resources, setResources] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        React.useCallback(() => {
            fetchResources();
        }, [])
    );

    useEffect(() => {
        AsyncStorage.getItem('userData').then(data => {
            if(data) {
                const user = JSON.parse(data);
                setIsAdmin(user.role === 'admin' || user.role === 'teacher');
            }
        });
    }, []);

    const fetchResources = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/library/digital');
            setResources(res.data);
        } catch (e) { console.error(e); } 
        finally { setLoading(false); }
    };

    const renderItem = ({ item }: {item:any}) => (
        <TouchableOpacity style={styles.card} onPress={() => Linking.openURL(`${SERVER_URL}${item.file_url}`)}>
            <View style={styles.iconBox}><Text style={{fontSize:20}}>📄</Text></View>
            <View style={styles.info}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.sub}>{item.subject} • {item.class_group || 'General'}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {loading ? <ActivityIndicator size="large" color="#2563EB" style={{marginTop:50}} /> :
                <FlatList 
                    data={resources} 
                    renderItem={renderItem} 
                    keyExtractor={(i:any) => i.id.toString()} 
                    contentContainerStyle={{ padding: 15 }} 
                    ListEmptyComponent={<Text style={styles.empty}>No digital resources found.</Text>}
                />
            }
            {/* Upload Button - Only visible to Admin/Teacher */}
            {isAdmin && (
                <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddDigitalResourceScreen' as never)}>
                    <Text style={styles.fabText}>+</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    card: { flexDirection: 'row', backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 12, alignItems: 'center', elevation: 2 },
    iconBox: { width: 45, height: 45, backgroundColor: '#EFF6FF', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    info: { flex: 1 },
    title: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
    sub: { fontSize: 13, color: '#64748B', marginTop: 2 },
    empty: { textAlign: 'center', marginTop: 50, color: '#94A3B8' },
    fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#2563EB', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
    fabText: { color: '#FFF', fontSize: 30, fontWeight: 'bold', marginTop: -2 }
});

export default DigitalLibraryScreen;