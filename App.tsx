// 📂 File: App.tsx (FINAL AND COMPLETE WITH DEEP LINKING)

import 'react-native-gesture-handler';
import React, { useEffect } from 'react'; // ✅ Import useEffect
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native'; // ✅ Import useNavigationContainerRef
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native'; // ✅ Import Linking
import { AuthProvider, useAuth } from './src/context/AuthContext';

// --- Screen Imports (Your full list) ---

// ✅ --- 1. IMPORT THE NEW ADS SCREENS AND THE DISPLAY COMPONENT --- ✅
// import CreateAdScreen from './src/screens/ads/CreateAdScreen';
import AdminAdDashboardScreen from './src/screens/ads/AdminAdDashboardScreen';
// import AdDisplay from './src/screens/ads/AdDisplay';


// Public (Pre-Login) Screens
import WelcomePage from './src/components/WelcomePage';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
// import DonorRegistrationScreen from './src/screens/DonorRegistrationScreen';
// import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import AboutUs from './src/components/AboutUs';

// import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';

// Authenticated Dashboards
import AdminDashboard from './src/components/AdminDashboard';
import TeacherDashboard from './src/components/TeacherDashboard';
import StudentDashboard from './src/components/StudentDashboard';


// Shared Authenticated Sub-screens
import ProfileScreen from './src/screens/ProfileScreen';
import AcademicCalendar from './src/components/AcademicCalendar';
import TimetableScreen from './src/screens/TimetableScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
// import TransportScreen from './src/screens/transport/TransportScreen';
import GalleryScreen from './src/screens/gallery/GalleryScreen';
import AlbumDetailScreen from './src/screens/gallery/AlbumDetailScreen';
// import GroupChatScreen from './src/screens/chat/GroupChatScreen';

// Admin-Specific Screens
// import AdminNotifications from './src/components/AdminNotifications';
import AdminLM from './src/components/AdminLM';
// import AdminHelpDeskScreen from './src/screens/helpdesk/AdminHelpDeskScreen';
// import AdminEventsScreen from './src/screens/events/AdminEventsScreen';
// import TeacherAdminPTMScreen from './src/screens/ptm/TeacherAdminPTMScreen';
import TeacherAdminHomeworkScreen from './src/screens/homework/TeacherAdminHomeworkScreen';
// import TeacherAdminExamScreen from './src/screens/exams_Schedule/TeacherAdminExamScreen';
// import TeacherAdminResultsScreen from './src/screens/results/TeacherAdminResultsScreen';
// import AdminSyllabusScreen from './src/screens/syllabus/AdminSyllabusScreen';
// import AdminSuggestionsScreen from './src/screens/suggestions/AdminSuggestionsScreen';
// import AdminPaymentScreen from './src/screens/payments/AdminPaymentScreen';
// import KitchenScreen from './src/screens/kitchen/KitchenScreen';
// import FoodScreen from './src/screens/food/FoodScreen';
// import AlumniScreen from './src/screens/Alumni/AlumniScreen';
// import PreAdmissionsScreen from './src/screens/Pre-Admissions/PreAdmissionsScreen';
// import TeacherAdminResourcesScreen from './src/screens/syllabus_Textbook/TeacherAdminResourcesScreen';

// Teacher-Specific Screens
// import TeacherHealthAdminScreen from './src/screens/health/TeacherHealthAdminScreen';
// import TeacherAdminLabsScreen from './src/screens/labs/TeacherAdminLabsScreen';
// import TeacherAdminMaterialsScreen from './src/screens/study-materials/TeacherAdminMaterialsScreen';
// import TeacherSyllabusScreen from './src/screens/syllabus/TeacherSyllabusScreen';

// Student-Specific Screens
// import StudentNotifications from './src/components/StudentNotifications';
// import StudentHealthScreen from './src/screens/health/StudentHealthScreen';

// import StudentResultsScreen from './src/screens/results/StudentResultsScreen';
// import StudentSyllabusScreen from './src/screens/syllabus/StudentSyllabusScreen';

// import StudentExamsScreen from './src/screens/exams/StudentExamsScreen';
// import StudentSportsScreen from './src/screens/sports/StudentSportsScreen';
// import StudentEventsScreen from './src/screens/events/StudentEventsScreen';
// import StudentPTMScreen from './src/screens/ptm/StudentPTMScreen';
// import StudentExamScreen from './src/screens/exams_Schedule/StudentExamScreen';
// import StudentMaterialsScreen from './src/screens/study-materials/StudentMaterialsScreen';
// import ReportDetailScreen from './src/screens/results/ReportDetailScreen';
// import ChatAIScreen from './src/screens/chatai/ChatAIScreen';
// import OnlineClassScreen from './src/screens/Online_Class/OnlineClassScreen';
// import StudentResourcesScreen from './src/screens/syllabus_Textbook/StudentResourcesScreen';

// Donor-Specific Screens
// import DonorNotifications from './src/components/DonorNotifications';

// import DonorSuggestionsScreen from './src/screens/suggestions/DonorSuggestionsScreen';
// import DonorSponsorScreen from './src/screens/sponsorship/DonorSponsorScreen';
// import DonorPaymentScreen from './src/screens/payments/DonorPaymentScreen';

// Unified Help Desk Screen for authenticated users
// import UserHelpDeskScreen from './src/screens/helpdesk/UserHelpDeskScreen';

const Stack = createStackNavigator();

// --- STACK 1: Screens available BEFORE a user logs in ---
const PublicStack = () => (
  <Stack.Navigator initialRouteName="WelcomePage" screenOptions={{ headerShown: false }}>
    <Stack.Screen name="WelcomePage" component={WelcomePage} />
    <Stack.Screen name="HomeScreen" component={HomeScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    {/* <Stack.Screen name="DonorRegistration" component={DonorRegistrationScreen} />
    <Stack.Screen name="ForgotPasswordScreen" component={ForgotPasswordScreen} /> */}
    
    {/* <Stack.Screen name="Transport" component={TransportFeatureNavigator} /> */}
    {/* <Stack.Screen name="ResetPasswordScreen" component={ResetPasswordScreen} /> */}
  </Stack.Navigator>
);

// --- THIS IS THE NESTED NAVIGATOR FOR THE GALLERY ---
// --- THIS IS THE NESTED NAVIGATOR FOR THE GALLERY (WITH STYLING) ---
const GalleryNavigator = () => (
    <Stack.Navigator>
        <Stack.Screen
            name="GalleryAlbums"
            component={GalleryScreen}
            options={{ 
              title: 'Photo & Video Albums',
              // --- STYLES ADDED HERE ---
              headerStyle: {
                backgroundColor: '#e0f2f7', // Light teal background from your dashboard
              },
              headerTintColor: '#008080', // Dark teal color for the title and back button
              headerTitleStyle: {
                fontWeight: 'bold', // Make the title bold
              },
            }}
        />
        <Stack.Screen
            name="AlbumDetail"
            component={AlbumDetailScreen}
            // Add the same styles to the detail screen for consistency
            options={({ route }: any) => ({ 
              title: route.params.title,
              // --- STYLES ADDED HERE ---
              headerStyle: {
                backgroundColor: '#e0f2f7',
              },
              headerTintColor: '#008080',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            })}
        />
    </Stack.Navigator>
);



// --- STACK 2: Screens available ONLY AFTER a user logs in ---
const AuthenticatedStack = () => {
  const { user } = useAuth();
  const getInitialRouteName = () => {
    switch (user?.role) {
      case 'admin':   return 'AdminDashboard';
      case 'teacher': return 'TeacherDashboard';
      // case 'driver':   return 'driverDashboard';
      case 'student': return 'StudentDashboard';
      default:        return 'StudentDashboard';
    }
  };

  return (
    <Stack.Navigator initialRouteName={getInitialRouteName()} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
      <Stack.Screen name="TeacherDashboard" component={TeacherDashboard} />
      <Stack.Screen name="StudentDashboard" component={StudentDashboard} />
      {/* <Stack.Screen name="DonorDashboard" component={DonorDashboard} /> */}
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="AcademicCalendar" component={AcademicCalendar} />
      <Stack.Screen name="Timetable" component={TimetableScreen} />
      <Stack.Screen name="Attendance" component={AttendanceScreen} />
      
      {/* <Stack.Screen name="UserHelpDesk" component={UserHelpDeskScreen} /> */}
      
      <Stack.Screen name="AdminLM" component={AdminLM} />
      
      {/* <Stack.Screen name="AdminHelpDeskScreen" component={AdminHelpDeskScreen} />
      <Stack.Screen name="AdminEventsScreen" component={AdminEventsScreen} /> */}
      <Stack.Screen name="NotificationsScreen" component={NotificationsScreen} />
      
      
      {/* <Stack.Screen name="TeacherSyllabusScreen" component={TeacherSyllabusScreen} />
      <Stack.Screen name="StudentResourcesScreen" component={StudentResourcesScreen} />
      <Stack.Screen name="TeacherHealthAdminScreen" component={TeacherHealthAdminScreen} />
      
      <Stack.Screen name="StudentHealthScreen" component={StudentHealthScreen} />
      
      <Stack.Screen name="StudentSportsScreen" component={StudentSportsScreen} />
      <Stack.Screen name="StudentEventsScreen" component={StudentEventsScreen} />
      <Stack.Screen name="TeacherAdminResourcesScreen" component={TeacherAdminResourcesScreen} />
      
      
      
      <Stack.Screen name="StudentExamScreen" component={StudentExamScreen} />
      <Stack.Screen name="StudentMaterialsScreen" component={StudentMaterialsScreen} />
      
      <Stack.Screen name="StudentSyllabusScreen" component={StudentSyllabusScreen} />
      <Stack.Screen name="StudentExamsScreen" component={StudentExamsScreen} /> */}
      
      
      {/* <Stack.Screen name="TeacherAdminPTMScreen" component={TeacherAdminPTMScreen} />
      <Stack.Screen name="StudentPTMScreen" component={StudentPTMScreen} />
      <Stack.Screen name="TeacherAdminLabsScreen" component={TeacherAdminLabsScreen} /> */}
      <Stack.Screen name="TeacherAdminHomeworkScreen" component={TeacherAdminHomeworkScreen} />
      {/* <Stack.Screen name="TeacherAdminExamScreen" component={TeacherAdminExamScreen} />
      <Stack.Screen name="TeacherAdminMaterialsScreen" component={TeacherAdminMaterialsScreen} />
      <Stack.Screen name="TeacherAdminResultsScreen" component={TeacherAdminResultsScreen} />
      <Stack.Screen name="ReportDetailScreen" component={ReportDetailScreen} /> 
      <Stack.Screen name="StudentResultsScreen" component={StudentResultsScreen} />
      <Stack.Screen name="AdminSyllabusScreen" component={AdminSyllabusScreen} />
      <Stack.Screen name="TransportScreen" component={TransportScreen} /> */}
      <Stack.Screen name="AboutUs" component={AboutUs} />
      {/* <Stack.Screen name="ChatAIScreen" component={ChatAIScreen} />
      <Stack.Screen name="DonorSuggestionsScreen" component={DonorSuggestionsScreen} />
      <Stack.Screen name="AdminSuggestionsScreen" component={AdminSuggestionsScreen} />
      <Stack.Screen name="DonorSponsorScreen" component={DonorSponsorScreen} />
      <Stack.Screen name="DonorPaymentScreen" component={DonorPaymentScreen} />
      <Stack.Screen name="AdminPaymentScreen" component={AdminPaymentScreen} />
      <Stack.Screen name="KitchenScreen" component={KitchenScreen} />
      <Stack.Screen name="FoodScreen" component={FoodScreen} />
      <Stack.Screen name="GroupChatScreen" component={GroupChatScreen} />
      <Stack.Screen name="OnlineClassScreen" component={OnlineClassScreen} />
      <Stack.Screen name="AlumniScreen" component={AlumniScreen} />
      <Stack.Screen name="PreAdmissionsScreen" component={PreAdmissionsScreen} /> */}

      {/* ADD THE GALLERY NAVIGATOR AS A SINGLE SCREEN IN THE MAIN STACK */}
      <Stack.Screen 
        name="Gallery" 
        component={GalleryNavigator} 
        options={{ headerShown: false }} 
      />
      
      {/* <Stack.Screen 
        name="CreateAdScreen" 
        component={CreateAdScreen} 
        options={{ 
          headerShown: true, 
          title: 'Create Advertisement',
          headerStyle: { backgroundColor: '#e0f2f7' },
          headerTintColor: '#008080',
          headerTitleStyle: { fontWeight: 'bold' }
        }} 
      /> */}
      <Stack.Screen 
        name="AdminAdDashboardScreen" 
        component={AdminAdDashboardScreen} 
        options={{ 
          headerShown: true, 
          title: 'Ads Management',
          headerStyle: { backgroundColor: '#e0f2f7' },
          headerTintColor: '#008080',
          headerTitleStyle: { fontWeight: 'bold' }
        }} 
      />
        
    </Stack.Navigator>
  );
};


// --- Main Router ---
const AppNavigator = () => {
  const { user, isLoading } = useAuth();
  const navigationRef = useNavigationContainerRef(); // ✅ Create a ref

  // ✅ This object defines your app's custom URL scheme and how to map it to screens
  const linking = {
    prefixes: ['vspngo://'],
    config: {
      screens: {
        // This name MUST match the screen name in the PublicStack
        ResetPasswordScreen: 'reset-password/:token',
      },
    },
  };

  // ✅ This effect listens for incoming deep links while the app is already running
  useEffect(() => {
    const onReceiveURL = ({ url }: { url: string }) => {
      // This function can be expanded to handle more complex links later if needed
      console.log("Deep link received: ", url);
    };

    // Set up the event listener
    const subscription = Linking.addEventListener('url', onReceiveURL);

    // Clean up the listener when the component is unmounted
    return () => {
      subscription.remove();
    };
  }, []);


  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#008080" />
      </View>
    );
  }

  // ✅ --- 3. WRAP THE NAVIGATOR TO DISPLAY ADS GLOBALLY --- ✅
  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef} linking={linking} fallback={<ActivityIndicator color="#008080" />}>
        {user ? <AuthenticatedStack /> : <PublicStack />}
      </NavigationContainer>
      
      {/* This is the "small key". It will now float on top of all screens. */}
      {/* We add a check to only show it if a user is logged in. */}
      {user && <AdDisplay />}
    </View>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8ff'
  }

});