/**
 * File: src/screens/report/ReportNavigator.js
 * Purpose: Manages the navigation stack for the Report Card module.
 * Updated: Dark/Light Mode Support for Navigation Headers.
 */
import React from 'react';
import { useColorScheme } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';

import ClassListScreen from './ClassListScreen';
import MarksEntryScreen from './MarksEntryScreen';
import StudentReportCardScreen from './StudentReportCardScreen';
import TeacherAssignmentScreen from './TeacherAssignmentScreen';

const Stack = createStackNavigator();

// --- THEME COLORS FOR NAVIGATION HEADERS ---
const LightTheme = {
    headerBg: '#e0f2f7',
    headerTint: '#008080',
};

const DarkTheme = {
    headerBg: '#1E1E1E', // Matches standard Dark Card BG
    headerTint: '#E0E0E0', // Light Grey/White for readability on dark
};

// Navigator for Teacher and Admin roles
const ReportNavigator = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkTheme : LightTheme;

    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: theme.headerBg },
                headerTintColor: theme.headerTint,
                headerTitleStyle: { fontWeight: 'bold' },
                headerBackTitleVisible: false, // Cleaner look on small screens
            }}
        >
            <Stack.Screen 
                name="ReportClassList" 
                component={ClassListScreen} 
                options={{ title: 'Select Class' }} 
            />
            <Stack.Screen 
                name="MarksEntry" 
                component={MarksEntryScreen} 
                options={({ route }) => ({ title: `${route.params.classGroup} - Report Card` })}
            />
            <Stack.Screen 
                name="TeacherAssignment" 
                component={TeacherAssignmentScreen} 
                options={({ route }) => ({ title: `${route.params.classGroup} - Assign Teachers` })}
            />
        </Stack.Navigator>
    );
};

// Navigator for Student role
export const StudentReportNavigator = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DarkTheme : LightTheme;

    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: theme.headerBg },
                headerTintColor: theme.headerTint,
                headerTitleStyle: { fontWeight: 'bold' },
                headerBackTitleVisible: false,
            }}
        >
            <Stack.Screen
                name="StudentReportCard"
                component={StudentReportCardScreen} 
                options={{ title: 'My Progress Report' }}
            />
        </Stack.Navigator>
    );
};

export default ReportNavigator;