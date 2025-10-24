/**
 * File: src/screens/report/ReportNavigator.js
 * Purpose: Manages the navigation stack for the Report Card module.
 * It exports two separate navigators:
 * - ReportNavigator: For Teachers and Admins (Class List -> Marks Entry)
 * - StudentReportNavigator: For Students (Directly to their Report Card)
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Import the screen components for this module
import ClassListScreen from './ClassListScreen';
import MarksEntryScreen from './MarksEntryScreen';
import StudentReportCardScreen from './StudentReportCardScreen';

const Stack = createStackNavigator();

// This is the navigator for Teacher and Admin roles.
const ReportNavigator = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: '#2c3e50' },
                headerTintColor: '#ffffff',
                headerTitleStyle: { fontWeight: 'bold' },
            }}
        >
            <Stack.Screen 
                name="ReportClassList" 
                component={ClassListScreen} 
                options={{ title: 'Select Class for Report Card' }} 
            />
            <Stack.Screen 
                name="MarksEntry" 
                component={MarksEntryScreen} 
                options={({ route }) => ({ title: `${route.params.classGroup} - Marks Entry` })}
            />
        </Stack.Navigator>
    );
};

// This is the separate, simpler navigator for the Student role.
export const StudentReportNavigator = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: '#2c3e50' },
                headerTintColor: '#ffffff',
                headerTitleStyle: { fontWeight: 'bold' },
            }}
        >
            <Stack.Screen
                name="StudentReportCard"
                component={StudentReportCardScreen}
                options={{ title: 'My Progress Report' }}
            />
        </Stack.Navigator>
    );
}

export default ReportNavigator;