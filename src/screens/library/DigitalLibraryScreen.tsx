import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking } from 'react-native';
import apiClient from '../../api/client';
import { SERVER_URL } from '../../../apiConfig';

const DigitalLibraryScreen = () => {
    const [resources, setResources] = useState([]);

    useEffect(() => {
        apiClient.get('/library/digital')
            .then(res => setResources(res.data))
            .catch(err => console.error(err));
    }, []);

    const openResource = (url) => {
        if (url) Linking.openURL(`${SERVER_URL}${url}`);
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity style={styles.row} onPress={() => openResource(item.file_url)}>
            <View style={styles.iconBox}>
                <Text style={styles.iconText}>PDF</Text>
            </View>
            <View style={styles.info}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.sub}>{item.subject} • {item.class_group}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={resources}
                keyExtractor={item => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 15 }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    row: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, borderColor: '#EEE', alignItems: 'center' },
    iconBox: { width: 40, height: 40, backgroundColor: '#FFE4E6', justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
    iconText: { color: '#E11D48', fontWeight: 'bold', fontSize: 12 },
    info: { marginLeft: 15, flex: 1 },
    title: { fontSize: 15, fontWeight: '600', color: '#333' },
    sub: { fontSize: 12, color: '#888', marginTop: 2 }
});

export default DigitalLibraryScreen;