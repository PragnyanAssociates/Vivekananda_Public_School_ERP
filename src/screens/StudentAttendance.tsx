import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  useColorScheme,
  Dimensions
} from 'react-native';

// =================================================================
// IMPORT YOUR EXISTING FILES HERE
// =================================================================
import MarkStudentAttendance from './MarkStudentAttendance'; 
import AttendanceScreen from './AttendanceScreen';          

const { width } = Dimensions.get('window');

// --- THEME COLORS CONFIGURATION ---
const COLORS = {
    light: {
        primary: '#008080', // Teal
        background: '#F2F5F8',
        cardBg: '#FFFFFF',
        textPrimary: '#008080',
        textSecondary: '#546E7A',
        border: '#CFD8DC',
        activeTabBg: '#F0FDF4',
        shadow: '#000000'
    },
    dark: {
        primary: '#008080',
        background: '#121212',
        cardBg: '#1E1E1E',
        textPrimary: '#80CBC4', // Lighter teal for dark mode text
        textSecondary: '#B0B0B0',
        border: '#333333',
        activeTabBg: 'rgba(0, 128, 128, 0.15)',
        shadow: '#000000'
    }
};

const StudentAttendance = () => {
    // State to switch between tabs
    const [activeTab, setActiveTab] = useState('marking'); // 'marking' | 'reporting'

    // --- THEME HOOKS ---
    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === 'dark';
    const theme = isDarkMode ? COLORS.dark : COLORS.light;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar 
                backgroundColor={theme.background} 
                barStyle={isDarkMode ? "light-content" : "dark-content"} 
            />

            {/* --- TAB NAVIGATION --- */}
            <View style={[
                styles.tabContainer, 
                { 
                    backgroundColor: theme.cardBg, 
                    borderColor: theme.border,
                    shadowColor: theme.shadow
                }
            ]}>
                <TouchableOpacity 
                    style={[
                        styles.tabButton, 
                        activeTab === 'marking' && { 
                            backgroundColor: theme.activeTabBg,
                            borderBottomColor: theme.primary
                        },
                        activeTab === 'marking' && styles.tabButtonActiveBorder
                    ]} 
                    onPress={() => setActiveTab('marking')}
                >
                    <Text style={[
                        styles.tabButtonText, 
                        { color: activeTab === 'marking' ? theme.primary : theme.textSecondary }
                    ]}>
                        Mark Attendance
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[
                        styles.tabButton, 
                        activeTab === 'reporting' && { 
                            backgroundColor: theme.activeTabBg,
                            borderBottomColor: theme.primary
                        },
                        activeTab === 'reporting' && styles.tabButtonActiveBorder
                    ]} 
                    onPress={() => setActiveTab('reporting')}
                >
                    <Text style={[
                        styles.tabButtonText, 
                        { color: activeTab === 'reporting' ? theme.primary : theme.textSecondary }
                    ]}>
                        View Reports
                    </Text>
                </TouchableOpacity>
            </View>

            {/* --- CONTENT AREA --- */}
            <View style={styles.contentContainer}>
                {activeTab === 'marking' ? (
                    <MarkStudentAttendance />
                ) : (
                    <AttendanceScreen />
                )}
            </View>

        </SafeAreaView>
    );
};

// --- STYLES ---
const styles = StyleSheet.create({
    container: { 
        flex: 1, 
    },
    
    // Tab Styles
    tabContainer: { 
        flexDirection: 'row', 
        marginHorizontal: width * 0.03, // Responsive margin
        marginTop: 15, 
        marginBottom: 5, 
        borderRadius: 8, 
        overflow: 'hidden', 
        elevation: 2, 
        borderWidth: 1, 
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    tabButton: { 
        flex: 1, 
        paddingVertical: 14, 
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 0, // Default no border
    },
    tabButtonActiveBorder: {
        borderBottomWidth: 3,
    },
    tabButtonText: { 
        fontSize: 14, 
        fontWeight: '600', 
    },

    // Content Area
    contentContainer: {
        flex: 1,
    }
});

export default StudentAttendance;