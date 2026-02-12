/**
 * File: src/screens/report/TeacherFilter.tsx
 * Purpose: Filter Teachers by Performance (Class & Subject).
 * Updated: Converted Class & Subject filters to Dropdowns.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    TouchableOpacity, ScrollView, RefreshControl, StatusBar, SafeAreaView, Platform, UIManager, Image,
    Dimensions, useColorScheme
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker'; // Added Dropdown Picker
import apiClient from '../../api/client';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Enable Layout Animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',      
    background: '#F2F5F8',   
    cardBg: '#FFFFFF',
    textMain: '#333333',
    textSub: '#666666',
    border: '#E0E0E0',
    inputBg: '#FAFAFA',
    pillActive: '#008080',
    pillInactive: '#F5F7FA',
    pillBorderInactive: '#E0E0E0',
    tabBg: '#E0E7FF',
    iconBg: '#E0F2F1',
    success: '#00C853',      // Above Average (> 85%)
    average: '#2979FF',      // Average (50% - 85%)
    poor: '#FF5252',         // Below Average (< 50%)
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
    progressTrack: '#ECEFF1'
};

const DarkColors = {
    primary: '#008080',      
    background: '#121212',   
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    inputBg: '#2C2C2C',
    pillActive: '#008080',
    pillInactive: '#2C2C2C',
    pillBorderInactive: '#333333',
    tabBg: '#2C2C2C',
    iconBg: '#333333',
    success: '#00C853',      
    average: '#2979FF',      
    poor: '#FF5252',         
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
    progressTrack: '#424242'
};

const CLASS_SUBJECTS: any = {
    'LKG': ['All Subjects'], 'UKG': ['All Subjects'], 
    'Class 1': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 2': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 
    'Class 3': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 4': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'], 
    'Class 5': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 6': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 
    'Class 7': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 8': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'], 
    'Class 9': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 10': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social']
};

// --- HELPER: CUSTOM ROUNDING ---
const getRoundedPercentage = (value: number | string): number => {
    const floatVal = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(floatVal)) return 0;
    
    const decimalPart = floatVal - Math.floor(floatVal);
    
    if (decimalPart > 0.5) {
        return Math.ceil(floatVal);
    } else {
        return Math.floor(floatVal);
    }
};

const TeacherFilter = () => {
    // Theme Hook
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    // Navigation Hook
    const navigation = useNavigation();

    // --- State ---
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    
    // Data State
    const [classList, setClassList] = useState<string[]>([]);
    const [rawTeacherData, setRawTeacherData] = useState<any[]>([]);

    // Filters
    const [selectedClass, setSelectedClass] = useState('All Classes');
    const [selectedSubject, setSelectedSubject] = useState('All Subjects');
    
    // Tabs - Default 'All'
    const [activeTab, setActiveTab] = useState<'All' | 'Above Average' | 'Average' | 'Below Average'>('All');

    // --- 1. Fetch Classes ---
    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const response = await apiClient.get('/reports/classes');
                const classes = response.data || [];
                // Add "All Classes" option
                setClassList(['All Classes', ...classes]);
            } catch (error) {
                console.error('Error fetching classes:', error);
            }
        };
        fetchClasses();
    }, []);

    // --- 2. Fetch Teacher Data ---
    useEffect(() => {
        fetchTeacherData();
    }, []);

    const fetchTeacherData = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/performance/admin/all-teachers`);
            setRawTeacherData(response.data || []);
        } catch (error) {
            console.error('Error fetching teacher data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchTeacherData();
    };

    // --- 3. Calculation & Filtering Logic ---
    const processedList = useMemo(() => {
        if (!rawTeacherData || rawTeacherData.length === 0) return [];

        let calculatedTeachers = rawTeacherData.map(teacher => {
            let rawPercentage = 0;
            let displayLabel = 'Overall';
            let totalObtained = 0;
            let totalPossible = 0;

            // Logic to calculate percentage based on filters
            if (selectedClass === 'All Classes') {
                rawPercentage = parseFloat(teacher.overall_average) || 0;
                totalObtained = teacher.overall_total || 0;
                totalPossible = teacher.overall_possible || 0;
            } else {
                displayLabel = selectedClass;
                if (selectedSubject !== 'All Subjects') {
                    displayLabel += ` - ${selectedSubject}`;
                }

                if (teacher.detailed_performance) {
                    teacher.detailed_performance.forEach((detail: any) => {
                        if (detail.class_group !== selectedClass) return;
                        if (selectedSubject !== 'All Subjects' && detail.subject !== selectedSubject) return;

                        totalObtained += parseFloat(detail.total_marks) || 0;
                        totalPossible += parseFloat(detail.max_possible_marks) || 0;
                    });
                }

                if (totalPossible > 0) {
                    rawPercentage = (totalObtained / totalPossible) * 100;
                } else {
                    rawPercentage = -1; // Mark as invalid if no data
                }
            }

            // Apply custom rounding logic
            const percentage = rawPercentage >= 0 ? getRoundedPercentage(rawPercentage) : -1;

            return {
                id: teacher.teacher_id,
                full_name: teacher.teacher_name,
                percentage: percentage,
                obtained: totalObtained,
                max: totalPossible,
                displayLabel: displayLabel
            };
        });

        // Filter out those with no data (percentage = -1)
        calculatedTeachers = calculatedTeachers.filter(t => t.percentage >= 0 && t.max > 0);
        
        // Sort based on the rounded integer
        calculatedTeachers.sort((a, b) => b.percentage - a.percentage);
        calculatedTeachers = calculatedTeachers.map((t, index) => ({ ...t, rank: index + 1 }));

        return calculatedTeachers;
    }, [selectedClass, selectedSubject, rawTeacherData]);

    // --- 4. Tab Filtering Logic (Updated Ranges & All Tab) ---
    const filteredList = useMemo(() => {
        if (processedList.length === 0) return [];
        const list = [...processedList];

        if (activeTab === 'All') return list;

        // Above Average: 85% to 100%
        if (activeTab === 'Above Average') return list.filter(s => s.percentage >= 85);
        
        // Average: 50% to 85%
        if (activeTab === 'Average') return list.filter(s => s.percentage >= 50 && s.percentage < 85);
        
        // Below Average: 0% to 50%
        if (activeTab === 'Below Average') return list.filter(s => s.percentage < 50).sort((a, b) => a.percentage - b.percentage);

        return [];
    }, [activeTab, processedList]);

    // --- Helper for Colors ---
    const getStatusColor = (perc: number) => {
        if (perc >= 85) return COLORS.success;
        if (perc >= 50) return COLORS.average;
        return COLORS.poor;
    };

    const getRankColor = (rank: number) => {
        if (rank === 1) return COLORS.gold;
        if (rank === 2) return COLORS.silver;
        if (rank === 3) return COLORS.bronze;
        return COLORS.textSub;
    };

    const getInitials = (name: string) => {
        if (!name) return 'T';
        return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
    };

    const getListTitle = () => {
        switch(activeTab) {
            case 'All': return 'Teacher Performance';
            case 'Above Average': return 'Top Teachers';
            case 'Average': return 'Average Performers';
            case 'Below Average': return 'Need Attention';
            default: return 'Teachers';
        }
    };

    // --- RENDER ITEM ---
    const renderTeacherItem = ({ item }: any) => {
        const color = getStatusColor(item.percentage);
        const rankColor = getRankColor(item.rank);
        
        return (
            <View style={[styles.card, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                <View style={styles.rankContainer}>
                    <View style={[styles.rankBadge, { borderColor: rankColor, backgroundColor: isDark ? '#333' : '#FAFAFA' }]}>
                        <Text style={[styles.rankText, { color: rankColor }]}>#{item.rank}</Text>
                    </View>
                </View>

                <View style={styles.infoContainer}>
                    <View style={styles.headerRow}>
                        <View style={[styles.avatar, { backgroundColor: color + '20' }]}>
                            <Text style={[styles.avatarText, { color: color }]}>{getInitials(item.full_name)}</Text>
                        </View>
                        <View style={styles.textColumn}>
                            <Text style={[styles.name, { color: COLORS.textMain }]} numberOfLines={1}>{item.full_name}</Text>
                            <Text style={[styles.subText, { color: COLORS.textSub }]}>{item.displayLabel}</Text>
                        </View>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: COLORS.progressTrack }]}>
                        <View style={[styles.progressFill, { width: `${item.percentage}%`, backgroundColor: color }]} />
                    </View>
                </View>

                <View style={styles.scoreContainer}>
                    <Text style={[styles.percentage, { color: color }]}>{item.percentage}%</Text>
                    <Text style={[styles.marks, { color: COLORS.textSub }]}>{Math.round(item.obtained)}/{Math.round(item.max)}</Text>
                </View>
            </View>
        );
    };

    const currentSubjects = selectedClass === 'All Classes' 
        ? ['All Subjects'] 
        : ['All Subjects', ...(CLASS_SUBJECTS[selectedClass] || [])];

    const TABS = ['All', 'Above Average', 'Average', 'Below Average'];

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
            
            {/* 1. Header Card with Quick Access */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
                <View style={[styles.headerIconContainer, { backgroundColor: COLORS.iconBg }]}>
                    <Icon name="chart-line" size={28} color={COLORS.primary} />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Teacher Analytics</Text>
                    <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Monitor staff performance</Text>
                </View>

                <TouchableOpacity 
                    style={[styles.quickAccessBtn, { backgroundColor: COLORS.iconBg, borderColor: COLORS.primary }]} 
                    onPress={() => navigation.navigate('TeacherPerformanceScreen' as never)}
                    activeOpacity={0.7}
                >
                    <Image 
                        source={{ uri: 'https://cdn-icons-png.flaticon.com/128/12489/12489385.png' }} 
                        style={styles.quickAccessIcon}
                    />
                </TouchableOpacity>
            </View>

            <View style={styles.bodyContainer}>
                
                {/* 2. Filter Card */}
                <View style={[styles.filterCard, { backgroundColor: COLORS.cardBg }]}>
                    
                    {/* Class Dropdown */}
                    <View style={styles.pickerContainer}>
                        <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>Select Class:</Text>
                        <View style={[styles.pickerWrapper, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                            <Picker
                                selectedValue={selectedClass}
                                onValueChange={(itemValue) => {
                                    setSelectedClass(itemValue);
                                    setSelectedSubject('All Subjects');
                                }}
                                style={{ color: COLORS.textMain }}
                                dropdownIconColor={COLORS.textSub}
                                mode="dropdown"
                            >
                                {classList.map((cls) => (
                                    <Picker.Item key={cls} label={cls} value={cls} style={{fontSize: 14}} />
                                ))}
                            </Picker>
                        </View>
                    </View>

                    {/* Subject Dropdown */}
                    <View style={styles.pickerContainer}>
                        <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>Subject:</Text>
                        <View style={[styles.pickerWrapper, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                            <Picker
                                selectedValue={selectedSubject}
                                onValueChange={setSelectedSubject}
                                enabled={selectedClass !== 'All Classes'}
                                style={{ color: selectedClass === 'All Classes' ? COLORS.textSub : COLORS.textMain }}
                                dropdownIconColor={COLORS.textSub}
                                mode="dropdown"
                            >
                                {currentSubjects.map((sub) => (
                                    <Picker.Item key={sub} label={sub} value={sub} style={{fontSize: 14}} />
                                ))}
                            </Picker>
                        </View>
                    </View>
                </View>

                {/* 3. Tabs */}
                <View style={[styles.tabWrapper, { backgroundColor: COLORS.tabBg }]}>
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab;
                        let iconName = 'poll'; 
                        if(tab === 'Above Average') iconName = 'trophy-variant';
                        if(tab === 'Average') iconName = 'scale-balance';
                        if(tab === 'Below Average') iconName = 'arrow-down-circle-outline';

                        return (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.tabButton, isActive && { backgroundColor: COLORS.primary }]}
                                onPress={() => setActiveTab(tab as any)}
                            >
                                <Icon 
                                    name={iconName} 
                                    size={16} 
                                    color={isActive ? '#FFF' : COLORS.textSub} 
                                />
                                <Text 
                                    style={[styles.tabText, { color: isActive ? '#FFF' : COLORS.textSub }]}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.8}
                                >
                                    {tab}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* 4. List Content */}
                <View style={styles.contentArea}>
                    {loading ? (
                        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
                    ) : (
                        <>
                            <View style={styles.listHeader}>
                                <Text style={[styles.listHeaderTitle, { color: COLORS.textMain }]}>
                                    {getListTitle()}
                                </Text>
                                <View style={[styles.badgeCount, { backgroundColor: COLORS.pillInactive }]}>
                                    <Text style={[styles.badgeCountText, { color: COLORS.textMain }]}>
                                        {filteredList.length} / {processedList.length}
                                    </Text>
                                </View>
                            </View>

                            <FlatList
                                data={filteredList}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={renderTeacherItem}
                                contentContainerStyle={styles.listContent}
                                showsVerticalScrollIndicator={false}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
                                ListEmptyComponent={
                                    <View style={styles.emptyContainer}>
                                        <Icon name="clipboard-text-off-outline" size={60} color={COLORS.border} />
                                        <Text style={[styles.emptyText, { color: COLORS.textMain }]}>No Teachers Found</Text>
                                        <Text style={[styles.emptySubText, { color: COLORS.textSub }]}>Try changing the class filters.</Text>
                                    </View>
                                }
                            />
                        </>
                    )}
                </View>
            </View>

            {/* 5. Footer Legend */}
            <View style={[styles.footerContainer, { backgroundColor: COLORS.cardBg, borderTopColor: COLORS.border }]}>
                <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
                        <Text style={[styles.legendText, { color: COLORS.textSub }]}>Above Avg (&gt;85%)</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: COLORS.average }]} />
                        <Text style={[styles.legendText, { color: COLORS.textSub }]}>Avg (50-85%)</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: COLORS.poor }]} />
                        <Text style={[styles.legendText, { color: COLORS.textSub }]}>Below Avg (&lt;50%)</Text>
                    </View>
                </View>
            </View>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },

    // Header Card
    headerCard: {
        paddingHorizontal: 15,
        paddingVertical: 10,
        width: '96%',
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 3,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    headerIconContainer: {
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
        fontSize: 20,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        fontSize: 13,
        marginTop: 1,
    },
    quickAccessBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8,
        marginLeft: 10,
        borderRadius: 12,
        borderWidth: 1,
        elevation: 2,
    },
    quickAccessIcon: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
    },

    // Body
    bodyContainer: {
        flex: 1,
        paddingHorizontal: 8,
    },

    // Filter Card
    filterCard: {
        borderRadius: 16,
        padding: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        marginBottom: 10,
        width: '96%',
        alignSelf: 'center'
    },
    // Picker
    pickerContainer: {
        marginBottom: 8
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 4,
        marginLeft: 2
    },
    pickerWrapper: {
        borderWidth: 1,
        borderRadius: 10,
        height: 45,
        justifyContent: 'center',
        overflow: 'hidden'
    },
    
    // Tabs
    tabWrapper: {
        flexDirection: 'row',
        borderRadius: 15,
        padding: 4,
        marginBottom: 10,
        width: '96%',
        alignSelf: 'center',
        justifyContent: 'space-between',
    },
    tabButton: {
        flex: 1, 
        flexDirection: 'column',
        paddingVertical: 6,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        marginHorizontal: 2, 
    },
    tabText: { 
        fontSize: 10,
        fontWeight: '700', 
        marginTop: 2,
        textAlign: 'center'
    },

    // Content
    contentArea: { flex: 1, width: '96%', alignSelf: 'center' },
    listHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    listHeaderTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    badgeCount: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 8,
    },
    badgeCountText: { fontSize: 11, fontWeight: 'bold' },
    listContent: { paddingBottom: 60 }, // Added padding for footer

    // Teacher Card
    card: {
        flexDirection: 'row',
        borderRadius: 16,
        marginBottom: 10,
        padding: 12,
        alignItems: 'center',
        elevation: 2,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    rankContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    rankBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankText: { fontSize: 12, fontWeight: '900' },
    infoContainer: { flex: 1, justifyContent: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    avatarText: { fontSize: 12, fontWeight: 'bold' },
    textColumn: { flex: 1 },
    name: { fontSize: 14, fontWeight: 'bold' },
    subText: { fontSize: 11 },
    progressTrack: {
        height: 5,
        borderRadius: 3,
        overflow: 'hidden',
        width: '90%',
    },
    progressFill: { height: '100%', borderRadius: 3 },
    scoreContainer: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        minWidth: 50,
    },
    percentage: { fontSize: 16, fontWeight: 'bold' },
    marks: { fontSize: 10, marginTop: 2 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 50 },
    emptyText: { marginTop: 15, fontSize: 16, fontWeight: 'bold' },
    emptySubText: { marginTop: 5, fontSize: 13, textAlign: 'center' },

    // Footer Legend
    footerContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderTopWidth: 1,
        elevation: 10,
    },
    legendRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 5,
    },
    legendText: {
        fontSize: 11,
        fontWeight: '600',
    }
});

export default TeacherFilter;