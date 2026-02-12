/**
 * File: src/screens/study-materials/StudyMaterialsScreen.tsx
 * Purpose: Role-based navigator for Study Materials (Student vs Teacher/Admin).
 * Updated: Dark/Light Mode support for loading state.
 */
import React from 'react';
import { View, ActivityIndicator, StyleSheet, useColorScheme, StatusBar } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import TeacherAdminMaterialsScreen from './TeacherAdminMaterialsScreen';
import StudentMaterialsScreen from './StudentMaterialsScreen';

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8', 
};

const DarkColors = {
    primary: '#008080',
    background: '#121212', 
};

const StudyMaterialsScreen = ({ navigation }) => {
    // Theme Hooks
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkColors : LightColors;

    const { user } = useAuth();

    if (!user) {
        return (
            <View style={[styles.centered, { backgroundColor: theme.background }]}>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    if (user.role === 'student') {
        return <StudentMaterialsScreen navigation={navigation} />;
    } else if (user.role === 'teacher' || user.role === 'admin') {
        return <TeacherAdminMaterialsScreen navigation={navigation} />;
    }

    return (
        <View style={[styles.centered, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
            {/* Optional: Add a message if no role matches */}
        </View>
    ); 
};

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default StudyMaterialsScreen;