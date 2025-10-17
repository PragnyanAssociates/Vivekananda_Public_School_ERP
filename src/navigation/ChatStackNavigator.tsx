import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Import the three screens that will be part of this navigation stack
import GroupListScreen from '../screens/chat/GroupListScreen';
import GroupChatScreen from '../screens/chat/GroupChatScreen';
import CreateGroupScreen from '../screens/chat/CreateGroupScreen';

// Initialize the stack navigator
const Stack = createStackNavigator();

/**
 * This component bundles all chat-related screens together.
 * It manages the navigation between the group list, the chat screen,
 * and the create group screen.
 * This entire stack is what you will link to from your main dashboard.
 */
const ChatStackNavigator = () => {
    return (
        <Stack.Navigator>
            {/* The first screen users will see when they enter the chat feature */}
            <Stack.Screen 
                name="GroupList" 
                component={GroupListScreen} 
                options={{ 
                    // We hide the default header because GroupListScreen has its own custom header
                    headerShown: false 
                }}
            />
            
            {/* When a user taps on a group from the list, they navigate to this screen */}
            <Stack.Screen 
                name="GroupChat" 
                component={GroupChatScreen} 
                options={{ 
                    // This screen also has its own custom header
                    headerShown: false 
                }}
            />

            {/* When an admin/teacher taps the '+' button, this screen opens */}
            <Stack.Screen 
                name="CreateGroup" 
                component={CreateGroupScreen} 
                options={{ 
                    // 'modal' makes it slide up from the bottom on iOS, a standard UI pattern
                    presentation: 'modal', 
                    // We can use the default header for this simple form screen
                    headerShown: true, 
                    title: 'Create New Group',
                }} 
            />
        </Stack.Navigator>
    );
};

export default ChatStackNavigator;