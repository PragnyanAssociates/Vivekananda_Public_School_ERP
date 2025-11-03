import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// 1. Import your screen components
import StaffListScreen from './StaffListScreen'; // Adjust the path if necessary
import StaffDetailScreen from './StaffDetailScreen'; // Adjust the path if necessary

// 2. Create a new Stack navigator instance
const Stack = createStackNavigator();

// 3. Define the navigator component
const StaffNavigator = () => {
  return (
    // 4. Configure the screens within the navigator
    <Stack.Navigator
      initialRouteName="StaffList"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#164e09ff', // A consistent header color
        },
        headerTintColor: '#ffffff', // Header text and back button color
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="StaffList"
        component={StaffListScreen}
        options={{ title: 'Staff Directory' }} // Sets the header title for this screen
      />
      <Stack.Screen
        name="StaffDetail"
        component={StaffDetailScreen}
        options={{ title: 'Staff Profile' }} // Sets the header title for the detail screen
      />
    </Stack.Navigator>
  );
};

export default StaffNavigator;