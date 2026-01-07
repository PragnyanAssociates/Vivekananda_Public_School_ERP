import React, { useState, useCallback, useMemo, useLayoutEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, Image, RefreshControl, SafeAreaView, Platform, UIManager
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons'; 
import apiClient from '../api/client';
import { SERVER_URL } from '../../apiConfig';

// Enable Layout Animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CLASS_ORDER = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

const StudentListScreen = ({ navigation }) => {
    const [students, setStudents] = useState([]);
    const [selectedClass, setSelectedClass] = useState('Class 10');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // --- NEW: HIDE DEFAULT HEADER ---
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const loadStudentData = async () => {
        try {
            const response = await apiClient.get('/students/all');
            setStudents(response.data || []);
        } catch (error) {
            console.error('Error fetching student list:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
      useCallback(() => {
        if (students.length === 0) {
            setLoading(true);
        }
        loadStudentData();
      }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadStudentData();
    };

    // Sorting logic
    const groupedStudents = useMemo(() => {
        const groups = {};
        students.forEach(student => {
            const groupName = student.class_group;
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(student);
        });

        for (const groupName in groups) {
            groups[groupName].sort((a, b) => {
                const rollA = parseInt(a.roll_no, 10) || 9999;
                const rollB = parseInt(b.roll_no, 10) || 9999;
                return rollA - rollB;
            });
        }

        return groups;
    }, [students]);

    const StudentMember = ({ item }) => {
        const imageUrl = item.profile_image_url
            ? `${SERVER_URL}${item.profile_image_url.startsWith('/') ? '' : '/'}${item.profile_image_url}`
            : null;

        return (
            <TouchableOpacity
                style={styles.studentMemberContainer}
                onPress={() => navigation.navigate('StudentDetail', { studentId: item.id })}
            >
                <View style={styles.avatarContainer}>
                    <Image
                        source={
                            imageUrl
                                ? { uri: imageUrl }
                                : require('../assets/default_avatar.png')
                        }
                        style={styles.avatar}
                    />
                </View>
                <Text style={styles.studentName} numberOfLines={2}>
                    {item.full_name}
                </Text>
                {item.roll_no && (
                    <Text style={styles.rollNumber}>
                        Roll: {item.roll_no}
                    </Text>
                )}
            </TouchableOpacity>
        );
    };

    const currentClassStudents = groupedStudents[selectedClass] || [];

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#008080" /></View>;
    }

    return (
        <SafeAreaView style={styles.container}>
            
            {/* 1. Header Card */}
            <View style={styles.headerCard}>
                <View style={styles.headerIconContainer}>
                    <Icon name="groups" size={28} color="#008080" />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>Student Directory</Text>
                    <Text style={styles.headerSubtitle}>View profiles by class</Text>
                </View>
            </View>

            {/* 2. Filter Card (Class Picker) */}
            <View style={styles.filterCard}>
                <View style={styles.pickerRow}>
                    <Icon name="class" size={20} color="#008080" style={{ marginRight: 10 }} />
                    <View style={styles.pickerWrapper}>
                        <Picker
                            selectedValue={selectedClass}
                            onValueChange={(itemValue) => setSelectedClass(itemValue)}
                            style={styles.picker}
                            dropdownIconColor="#008080"
                            mode="dropdown"
                        >
                            {CLASS_ORDER.map(className => (
                                <Picker.Item key={className} label={className} value={className} />
                            ))}
                        </Picker>
                    </View>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#008080']} />}
                showsVerticalScrollIndicator={false}
            >
                {currentClassStudents.length > 0 ? (
                    <View style={styles.studentGrid}>
                        {currentClassStudents.map(item => (
                            <StudentMember key={item.id} item={item} />
                        ))}
                    </View>
                ) : (
                    <View style={styles.noDataContainer}>
                        <Icon name="person-off" size={40} color="#BDC3C7" />
                        <Text style={styles.noDataText}>No students found in {selectedClass}.</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F5F8', // Light Blue-Grey Background
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F2F5F8',
    },

    // --- Header Card Style ---
    headerCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 15,
        paddingVertical: 10,
        width: '96%',
        alignSelf: 'center',
        marginTop: 15, // Margin from top of safe area
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    headerIconContainer: {
        backgroundColor: '#E0F2F1', // Light Teal Circle
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: {
        justifyContent: 'center',
        flex: 1,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333333',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666666',
        marginTop: 1,
    },

    // --- Filter Card (Picker) ---
    filterCard: {
        backgroundColor: '#FFFFFF',
        width: '96%',
        alignSelf: 'center',
        borderRadius: 12,
        padding: 5,
        marginBottom: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
    },
    pickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    pickerWrapper: {
        flex: 1,
    },
    picker: {
        width: '100%',
        color: '#2C3E50',
    },

    // --- Content Area ---
    scrollContent: {
        paddingHorizontal: 8,
        paddingBottom: 20,
    },
    studentGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    studentMemberContainer: {
        width: '25%', // 4 columns
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 4,
    },
    avatarContainer: {
        elevation: 3,
        backgroundColor: '#FFF',
        borderRadius: 35,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 2 },
    },
    avatar: {
        width: 65,
        height: 65,
        borderRadius: 32.5,
        backgroundColor: '#ECF0F1',
    },
    studentName: {
        marginTop: 6,
        fontSize: 12,
        fontWeight: '600',
        color: '#2C3E50',
        textAlign: 'center',
    },
    rollNumber: {
        fontSize: 11,
        color: '#008080', // Teal color for roll number
        textAlign: 'center',
        marginTop: 2,
        fontWeight: '500',
    },
    noDataContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 50,
    },
    noDataText: {
        marginTop: 10,
        fontSize: 16,
        color: '#95a5a6',
    },
});

export default StudentListScreen;