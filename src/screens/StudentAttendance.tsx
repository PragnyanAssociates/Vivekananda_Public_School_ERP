import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar
} from 'react-native';

// =================================================================
// IMPORT YOUR EXISTING FILES HERE
// =================================================================
import MarkStudentAttendance from './MarkStudentAttendance'; 
import AttendanceScreen from './AttendanceScreen';           

// --- Constants ---
const PRIMARY_COLOR = '#008080'; // Teal
const BACKGROUND_COLOR = '#F2F5F8';
const CARD_BG = '#FFFFFF';
const TEXT_COLOR_MEDIUM = '#546E7A';
const BORDER_COLOR = '#CFD8DC';

const StudentAttendance = () => {
    // State to switch between tabs
    const [activeTab, setActiveTab] = useState('marking'); // 'marking' | 'reporting'

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor={BACKGROUND_COLOR} barStyle="dark-content" />

            {/* --- TAB NAVIGATION --- */}
            <View style={styles.tabContainer}>
                <TouchableOpacity 
                    style={[styles.tabButton, activeTab === 'marking' && styles.tabButtonActive]} 
                    onPress={() => setActiveTab('marking')}
                >
                    <Text style={[styles.tabButtonText, activeTab === 'marking' && styles.tabButtonTextActive]}>
                        Mark Attendance
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.tabButton, activeTab === 'reporting' && styles.tabButtonActive]} 
                    onPress={() => setActiveTab('reporting')}
                >
                    <Text style={[styles.tabButtonText, activeTab === 'reporting' && styles.tabButtonTextActive]}>
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
        backgroundColor: BACKGROUND_COLOR 
    },
    
    // Tab Styles
    tabContainer: { 
        flexDirection: 'row', 
        marginHorizontal: '2%', 
        marginTop: 15, // Added margin top since header is gone
        marginBottom: 5, 
        backgroundColor: CARD_BG, 
        borderRadius: 8, 
        overflow: 'hidden', 
        elevation: 2, 
        borderWidth: 1, 
        borderColor: BORDER_COLOR 
    },
    tabButton: { 
        flex: 1, 
        paddingVertical: 12, 
        alignItems: 'center' 
    },
    tabButtonActive: { 
        backgroundColor: '#F0FDF4', 
        borderBottomWidth: 3, 
        borderBottomColor: PRIMARY_COLOR 
    },
    tabButtonText: { 
        fontSize: 14, 
        fontWeight: '600', 
        color: TEXT_COLOR_MEDIUM 
    },
    tabButtonTextActive: { 
        color: PRIMARY_COLOR 
    },

    // Content Area
    contentContainer: {
        flex: 1,
    }
});

export default StudentAttendance;