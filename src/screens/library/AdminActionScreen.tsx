import React, { useState, useCallback } from 'react';
import { 
    View, Text, FlatList, StyleSheet, TouchableOpacity, 
    Alert, ActivityIndicator, RefreshControl, TextInput, StatusBar 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../../api/client'; 

const AdminActionScreen = () => {
    const [requests, setRequests] = useState([]);
    const [stats, setStats] = useState({ issued: 0, overdue: 0, pending: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Default to PENDING to see new requests immediately
    const [activeFilter, setActiveFilter] = useState('PENDING'); 
    const [searchText, setSearchText] = useState('');

    const fetchData = async () => {
        try {
            const [reqRes, statRes] = await Promise.all([
                apiClient.get('/library/admin/requests'),
                apiClient.get('/api/library/stats')
            ]);
            setRequests(reqRes.data || []);
            setStats(statRes.data || { issued: 0, overdue: 0, pending: 0 });
        } catch (e) { 
            console.log("Error fetching data:", e);
        } finally { 
            setLoading(false); 
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => { fetchData(); }, [])
    );

    const getProcessedData = () => {
        let data = [...requests];

        if (activeFilter === 'PENDING') {
            data = data.filter(item => item.status === 'pending');
        } else if (activeFilter === 'OVERDUE') {
            data = data.filter(item => item.status === 'approved' && item.is_overdue === 1);
        } else if (activeFilter === 'ISSUED') {
            data = data.filter(item => item.status === 'approved' && item.is_overdue === 0);
        }

        if (searchText) {
            const lower = searchText.toLowerCase();
            data = data.filter(item => 
                (item.book_title?.toLowerCase().includes(lower)) ||
                (item.full_name?.toLowerCase().includes(lower))
            );
        }
        return data;
    };

    const handleAction = async (id, action) => {
        try {
            const endpoint = action === 'returned' 
                ? `/library/return/${id}` 
                : `/library/admin/request-action/${id}`;
            const body = action === 'returned' ? {} : { action };
            
            await apiClient.put(endpoint, body);
            Alert.alert("Success", "Updated successfully");
            fetchData();
        } catch (e) { 
            Alert.alert("Error", "Action failed"); 
        }
    };

    const StatCard = ({ label, count, type }) => {
        const isActive = activeFilter === type;
        const color = type === 'PENDING' ? '#F59E0B' : type === 'OVERDUE' ? '#EF4444' : '#2563EB';
        return (
            <TouchableOpacity 
                style={[styles.statCard, isActive && { backgroundColor: color + '15', borderColor: color }]} 
                onPress={() => setActiveFilter(type)}
            >
                <Text style={[styles.statNum, { color: isActive ? color : '#64748B' }]}>{count}</Text>
                <Text style={[styles.statLabel, { color: isActive ? color : '#64748B' }]}>{label}</Text>
            </TouchableOpacity>
        );
    };

    const renderItem = ({ item }) => {
        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={{flex:1}}>
                        <Text style={styles.title}>{item.book_title}</Text>
                        <Text style={styles.sub}>{item.full_name} ({item.roll_no})</Text>
                    </View>
                    <View style={styles.badge}>
                        <Text style={styles.badgeTxt}>{item.status.toUpperCase()}</Text>
                    </View>
                </View>
                
                <View style={styles.dates}>
                    <Text style={styles.dateTxt}>Borrow: {item.borrow_date ? item.borrow_date.split('T')[0] : '-'}</Text>
                    <Text style={[styles.dateTxt, item.is_overdue === 1 && {color:'red', fontWeight:'bold'}]}>
                        Return: {item.expected_return_date ? item.expected_return_date.split('T')[0] : '-'}
                    </Text>
                </View>

                {item.status === 'pending' && (
                    <View style={styles.btns}>
                        <TouchableOpacity style={[styles.btn, {backgroundColor:'#10B981'}]} onPress={()=>handleAction(item.id, 'approved')}>
                            <Text style={styles.btnTxt}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, {backgroundColor:'#EF4444'}]} onPress={()=>handleAction(item.id, 'rejected')}>
                            <Text style={styles.btnTxt}>Reject</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {item.status === 'approved' && (
                    <TouchableOpacity style={[styles.btn, {backgroundColor:'#3B82F6', marginTop:10}]} onPress={()=>handleAction(item.id, 'returned')}>
                        <Text style={styles.btnTxt}>Mark Returned</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headTitle}>Library Hub</Text>
                
                <View style={styles.searchBox}>
                    <Text>🔍</Text>
                    <TextInput style={styles.input} placeholder="Search..." value={searchText} onChangeText={setSearchText}/>
                </View>

                <View style={styles.stats}>
                    <StatCard label="Pending" count={stats.pending} type="PENDING" />
                    <StatCard label="Issued" count={stats.issued} type="ISSUED" />
                    <StatCard label="Overdue" count={stats.overdue} type="OVERDUE" />
                </View>
            </View>

            <FlatList 
                data={getProcessedData()} 
                renderItem={renderItem} 
                keyExtractor={i=>i.id.toString()}
                contentContainerStyle={{padding:15}}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true); fetchData();}} />}
                ListEmptyComponent={<Text style={{textAlign:'center', marginTop:50, color:'#999'}}>No {activeFilter.toLowerCase()} items.</Text>}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { padding: 20, backgroundColor: '#FFF', elevation: 2 },
    headTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: '#1E293B' },
    searchBox: { flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 10, borderRadius: 8, marginBottom: 15, alignItems:'center' },
    input: { flex:1, marginLeft:10 },
    stats: { flexDirection: 'row', gap: 10 },
    statCard: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    statNum: { fontSize: 18, fontWeight: 'bold' },
    statLabel: { fontSize: 12 },
    card: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10, elevation: 1 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    title: { fontWeight: 'bold', fontSize: 16 },
    sub: { color: '#64748B', fontSize: 13 },
    badge: { backgroundColor: '#F1F5F9', padding: 5, borderRadius: 5, justifyContent:'center' },
    badgeTxt: { fontSize: 10, fontWeight: 'bold' },
    dates: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, backgroundColor:'#F8FAFC', padding:8, borderRadius:6 },
    dateTxt: { fontSize: 12, color: '#334155' },
    btns: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center' },
    btnTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 12 }
});

export default AdminActionScreen;