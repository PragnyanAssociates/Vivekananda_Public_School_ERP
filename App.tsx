// 📂 File: App.tsx (FINAL AND COMPLETE WITH DEEP LINKING)

import 'react-native-gesture-handler';
import React, { useEffect } from 'react'; // ✅ Import useEffect
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native'; // ✅ Import useNavigationContainerRef
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native'; // ✅ Import Linking
import { AuthProvider, useAuth } from './src/context/AuthContext';

// --- Screen Imports (Your full list) ---

// ✅ --- 1. IMPORT THE NEW ADS SCREENS AND THE DISPLAY COMPONENT --- ✅
import CreateAdScreen from './src/screens/ads/CreateAdScreen';
import AdminAdDashboardScreen from './src/screens/ads/AdminAdDashboardScreen';
import AdDisplay from './src/screens/ads/AdDisplay';


// Public (Pre-Login) Screens
import WelcomePage from './src/components/WelcomePage';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
// import DonorRegistrationScreen from './src/screens/DonorRegistrationScreen';
// import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import AboutUs from './src/components/AboutUs';

// import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';

// ★★★ FIX 1: Import BOTH navigators from the same file ★★★
import ReportNavigator, { StudentReportNavigator } from './src/screens/report/ReportNavigator';

// Authenticated Dashboards
import AdminDashboard from './src/components/AdminDashboard';
import TeacherDashboard from './src/components/TeacherDashboard';
import StudentDashboard from './src/components/StudentDashboard';
import OthersDashboard from './src/components/OthersDashboard';


// Shared Authenticated Sub-screens
import ProfileScreen from './src/screens/ProfileScreen';
import AcademicCalendar from './src/components/AcademicCalendar';
import TimetableScreen from './src/screens/TimetableScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import MarkStudentAttendance from './src/screens/MarkStudentAttendance';
// import TransportScreen from './src/screens/transport/TransportScreen';
import GalleryScreen from './src/screens/gallery/GalleryScreen';
import AlbumDetailScreen from './src/screens/gallery/AlbumDetailScreen';
// import GroupChatScreen from './src/screens/chat/GroupChatScreen';
import ChatStackNavigator from './src/navigation/ChatStackNavigator';

import AdminLM from './src/components/AdminLM';
import AdminEventsScreen from './src/screens/events/AdminEventsScreen';
import TeacherAdminPTMScreen from './src/screens/ptm/TeacherAdminPTMScreen';
import TeacherAdminHomeworkScreen from './src/screens/homework/TeacherAdminHomeworkScreen';
import TeacherAdminExamScreen from './src/screens/exams_Schedule/TeacherAdminExamScreen';
// import TeacherAdminResultsScreen from './src/screens/results/TeacherAdminResultsScreen';
import AdminSyllabusScreen from './src/screens/syllabus/AdminSyllabusScreen';
// import AdminSuggestionsScreen from './src/screens/suggestions/AdminSuggestionsScreen';
// import AdminPaymentScreen from './src/screens/payments/AdminPaymentScreen';
import KitchenScreen from './src/screens/kitchen/KitchenScreen';
import FoodScreen from './src/screens/food/FoodScreen';
import AlumniScreen from './src/screens/Alumni/AlumniScreen';
import PreAdmissionsScreen from './src/screens/Pre-Admissions/PreAdmissionsScreen';
import TeacherAdminResourcesScreen from './src/screens/syllabus_Textbook/TeacherAdminResourcesScreen';

import WrittenAnswerScreen from './src/screens/homework/WrittenAnswerScreen'; // Adjust the path to where you created the file

// Teacher-Specific Screens
import TeacherHealthAdminScreen from './src/screens/health/TeacherHealthAdminScreen';
import TeacherAdminLabsScreen from './src/screens/labs/TeacherAdminLabsScreen';
import StudentLabsScreen from './src/screens/labs/StudentLabsScreen';
import TeacherAdminMaterialsScreen from './src/screens/study-materials/TeacherAdminMaterialsScreen';
import TeacherSyllabusScreen from './src/screens/syllabus/TeacherSyllabusScreen';

// Student-Specific Screens
import StudentHealthScreen from './src/screens/health/StudentHealthScreen';
// import StudentResultsScreen from './src/screens/results/StudentResultsScreen';
import StudentSyllabusNavigator from './src/screens/syllabus/StudentSyllabusScreen';

import StudentExamsScreen from './src/screens/exams/StudentExamsScreen';
import TeacherAdminExamsScreen from './src/screens/exams/TeacherAdminExamsScreen';
// import StudentSportsScreen from './src/screens/sports/StudentSportsScreen';
import StudentEventsScreen from './src/screens/events/StudentEventsScreen';
import StudentPTMScreen from './src/screens/ptm/StudentPTMScreen';
import StudentExamScreen from './src/screens/exams_Schedule/StudentExamScreen';
import StudentMaterialsScreen from './src/screens/study-materials/StudentMaterialsScreen';
// import ReportDetailScreen from './src/screens/results/ReportDetailScreen';
import StudentHomeworkScreen from './src/screens/homework/StudentHomeworkScreen';
import OnlineClassScreen from './src/screens/Online_Class/OnlineClassScreen';
import StudentResourcesScreen from './src/screens/syllabus_Textbook/StudentResourcesScreen';


import TeacherAttendanceMarkingScreen from './src/screens/teacher_attendence/TeacherAttendanceMarkingScreen';
import TeacherAttendanceReportScreen from './src/screens/teacher_attendence/TeacherAttendanceReportScreen';

import TeacherPerformanceScreen from './src/screens/Performance/TeacherPerformanceScreen';
import StudentPerformance from './src/screens/Performance/StudentPerformance';


import PDFViewerScreen from './src/screens/syllabus_Textbook/PDFViewerScreen';

import StaffNavigator from './src/screens/StaffNavigator';
import StudentStackNavigator from './src/screens/StudentStackNavigator';

import AccountsScreen from './src/screens/Accounts/AccountsScreen';
import VouchersScreen from './src/screens/Accounts/VouchersScreen';
import RegistersScreen from './src/screens/Accounts/RegistersScreen';
import TransactionsScreen from './src/screens/Accounts/TransactionsScreen';
import ReportsScreen from './src/screens/Accounts/ReportsScreen';
import CalendarScreen from './src/screens/Accounts/CalendarScreen';
import Screenshots from './src/screens/Accounts/Screenshots';

import ActivitiesScreen from './src/screens/Extra_activity/ActivitiesScreen';
import SportsScreen from './src/screens/Extra_activity/SportsScreen';

import DictionaryScreen from './src/screens/dictionary/DictionaryScreen';

import TransportScreen from './src/screens/transport/TransportScreen';
import PassengersScreen from './src/screens/transport/PassengersScreen';
import VehicalDetails from './src/screens/transport/VehicalDetails';
import BusStaffDetails from './src/screens/transport/BusStaffDetails';
import RoutesScreen from './src/screens/transport/RoutesScreen';
import ProofsScreen from './src/screens/transport/ProofsScreen';
import ComplaintsScreen from './src/screens/transport/ComplaintsScreen';
import VehicleLogScreen from './src/screens/transport/VehicleLogScreen';


import LibraryHomeScreen from './src/screens/library/LibraryHomeScreen';
import BookListScreen from './src/screens/library/BookListScreen';
import DigitalLibraryScreen from './src/screens/library/DigitalLibraryScreen';
import AddBookScreen from './src/screens/library/AddBookScreen';
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
const GalleryNavigator = () => (
    <Stack.Navigator>
        <Stack.Screen
            name="GalleryAlbums"
            component={GalleryScreen}
            options={{ 
              title: 'Gallery ',
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
            options={({ route }: any) => ({ 
              title: route.params.title,
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

// ★★★ MODIFIED: Moved this navigator definition to the top level for best practice ★★★
const StudentHomeworkNavigator = () => (
    <Stack.Navigator>
        <Stack.Screen 
            name="HomeworkList"
            component={StudentHomeworkScreen} 
            options={{ 
                title: 'Assignments & Homework',
                headerStyle: { backgroundColor: '#e0f2f7' }, // Light orange theme
                headerTintColor: '#008080',
                headerTitleStyle: { fontWeight: 'bold' },
            }}
        />
        <Stack.Screen 
            name="WrittenAnswerScreen" 
            component={WrittenAnswerScreen}
            options={({ route }: any) => ({ 
                title: route.params?.assignment?.title || 'Answer Homework',
                headerStyle: { backgroundColor: '#e0f2f7' },
                headerTintColor: '#008080',
                headerTitleStyle: { fontWeight: 'bold' },
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
      case 'others':   return 'OthersDashboard';
      case 'student': return 'StudentDashboard';
      default:        return 'StudentDashboard';
    }
  };

  return (
    <Stack.Navigator initialRouteName={getInitialRouteName()} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
      <Stack.Screen name="TeacherDashboard" component={TeacherDashboard} />
      <Stack.Screen name="StudentDashboard" component={StudentDashboard} />
      <Stack.Screen name="OthersDashboard" component={OthersDashboard} />
      
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="AcademicCalendar" component={AcademicCalendar} />

      <Stack.Screen name="TimetableScreen" component={TimetableScreen} />
      <Stack.Screen name="Attendance" component={AttendanceScreen} />
      <Stack.Screen name="MarkStudentAttendance" component={MarkStudentAttendance} />
      <Stack.Screen name="AdminLM" component={AdminLM} />
      <Stack.Screen name="FoodScreen" component={FoodScreen} />
      <Stack.Screen name="AdminEventsScreen" component={AdminEventsScreen} />
      <Stack.Screen name="NotificationsScreen" component={NotificationsScreen} />
      <Stack.Screen name="StudentHealthScreen" component={StudentHealthScreen} />
      <Stack.Screen name="TeacherHealthAdminScreen" component={TeacherHealthAdminScreen} />
      <Stack.Screen name="StudentEventsScreen" component={StudentEventsScreen} />
      <Stack.Screen name="StudentExamScreen" component={StudentExamScreen} />
      <Stack.Screen name="TeacherAdminExamScreen" component={TeacherAdminExamScreen} />
      <Stack.Screen name="StudentMaterialsScreen" component={StudentMaterialsScreen} />
      <Stack.Screen name="TeacherAdminMaterialsScreen" component={TeacherAdminMaterialsScreen} />
      <Stack.Screen name="TeacherSyllabusScreen" component={TeacherSyllabusScreen} />
      <Stack.Screen name="StudentSyllabusScreen" component={StudentSyllabusNavigator} />
      <Stack.Screen name="AdminSyllabusScreen" component={AdminSyllabusScreen} />
      <Stack.Screen name="StudentResourcesScreen" component={StudentResourcesScreen} />
      <Stack.Screen name="TeacherAdminResourcesScreen" component={TeacherAdminResourcesScreen} />
      {/* <Stack.Screen name="StudentSportsScreen" component={StudentSportsScreen} /> */}
      
      <Stack.Screen name="StudentExamsScreen" component={StudentExamsScreen} />
      <Stack.Screen name="StudentPTMScreen" component={StudentPTMScreen} />
      
      <Stack.Screen name="TeacherAdminExamsScreen" component={TeacherAdminExamsScreen} />
       <Stack.Screen name="TeacherAdminPTMScreen" component={TeacherAdminPTMScreen} />
      
      <Stack.Screen name="TeacherAdminLabsScreen" component={TeacherAdminLabsScreen} />
      <Stack.Screen name="StudentLabsScreen" component={StudentLabsScreen} /> 
      <Stack.Screen name="TeacherAdminHomeworkScreen" component={TeacherAdminHomeworkScreen} />
       
      {/* <Stack.Screen name="TransportScreen" component={TransportScreen} /> */}
      <Stack.Screen name="AboutUs" component={AboutUs} />
      {/* <Stack.Screen name="GroupChatScreen" component={GroupChatScreen} /> */}
      <Stack.Screen name="AlumniScreen" component={AlumniScreen} />
      <Stack.Screen name="PreAdmissionsScreen" component={PreAdmissionsScreen} />
      <Stack.Screen name="KitchenScreen" component={KitchenScreen} />
      <Stack.Screen name="OnlineClassScreen" component={OnlineClassScreen} />
      <Stack.Screen name="ChatFeature" component={ChatStackNavigator} options={{ headerShown: true, 
          title: 'Group chat',
          headerStyle: { backgroundColor: '#e0f2f7' },
          headerTintColor: '#008080',
          headerTitleStyle: { fontWeight: 'bold' } }} />
      <Stack.Screen name="TeacherAttendanceMarkingScreen" component={TeacherAttendanceMarkingScreen} />
      <Stack.Screen name="TeacherAttendanceReportScreen" component={TeacherAttendanceReportScreen} />

      <Stack.Screen name="StaffNavigator" component={StaffNavigator}  />
      <Stack.Screen name="StudentStackNavigator" component={StudentStackNavigator}  />

      <Stack.Screen name="AccountsScreen" component={AccountsScreen}  />
      <Stack.Screen name="VouchersScreen" component={VouchersScreen} />
      <Stack.Screen name="RegistersScreen" component={RegistersScreen} /> 
      <Stack.Screen name="TransactionsScreen" component={TransactionsScreen} />
      <Stack.Screen name="ReportsScreen" component={ReportsScreen} />
      <Stack.Screen name="CalendarScreen" component={CalendarScreen} />
      <Stack.Screen name="Screenshots" component={Screenshots} />

      <Stack.Screen name="ActivitiesScreen" component={ActivitiesScreen} /> 
      <Stack.Screen name="SportsScreen" component={SportsScreen} />

      <Stack.Screen name="DictionaryScreen" component={DictionaryScreen} />

      <Stack.Screen name="TransportScreen" component={TransportScreen} />
      <Stack.Screen name="PassengersScreen" component={PassengersScreen} />
      <Stack.Screen name="VehicalDetails" component={VehicalDetails} />
      <Stack.Screen name="BusStaffDetails" component={BusStaffDetails} />
      <Stack.Screen name="RoutesScreen" component={RoutesScreen} />
      <Stack.Screen name="ProofsScreen" component={ProofsScreen} />
      <Stack.Screen name="ComplaintsScreen" component={ComplaintsScreen} />
      <Stack.Screen name="VehicleLogScreen" component={VehicleLogScreen} />

      
      <Stack.Screen name="LibraryHomeScreen" component={LibraryHomeScreen} />
      <Stack.Screen name="BookListScreen" component={BookListScreen} />
      <Stack.Screen name="DigitalLibraryScreen" component={DigitalLibraryScreen} />
      <Stack.Screen name="AddBookScreen" component={AddBookScreen} />

      <Stack.Screen name="TeacherPerformanceScreen" component={TeacherPerformanceScreen} />
      <Stack.Screen name="StudentPerformance" component={StudentPerformance} />
      <Stack.Screen name="ReportScreen" component={ReportNavigator} options={{ headerShown: false, 
          title: 'Progress Reports',
          headerStyle: { backgroundColor: '#e0f2f7' },
          headerTintColor: '#008080',
          headerTitleStyle: { fontWeight: 'bold' } }} />
      <Stack.Screen name="StudentProgressReport" component={StudentReportNavigator} options={{ headerShown: false }} />

      <Stack.Screen name="PDFViewer" component={PDFViewerScreen} options={{ headerShown: false }} />
      {/* <Stack.Screen name="ChatAIScreen" component={ChatAIScreen} />
      <Stack.Screen name="DonorSuggestionsScreen" component={DonorSuggestionsScreen} />
      <Stack.Screen name="AdminSuggestionsScreen" component={AdminSuggestionsScreen} />
      <Stack.Screen name="DonorSponsorScreen" component={DonorSponsorScreen} />
      <Stack.Screen name="DonorPaymentScreen" component={DonorPaymentScreen} />
      <Stack.Screen name="AdminPaymentScreen" component={AdminPaymentScreen} /> */}
      <Stack.Screen 
        name="Gallery" 
        component={GalleryNavigator} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="StudentHomework" 
        component={StudentHomeworkNavigator}
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="CreateAdScreen" 
        component={CreateAdScreen} 
        options={{ 
          headerShown: true, 
          title: 'Create Advertisement',
          headerStyle: { backgroundColor: '#e0f2f7' },
          headerTintColor: '#008080',
          headerTitleStyle: { fontWeight: 'bold' }
        }} 
      />
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
  const navigationRef = useNavigationContainerRef();

  const linking = {
    prefixes: ['vspngo://'],
    config: {
      screens: {
        ResetPasswordScreen: 'reset-password/:token',
      },
    },
  };

  useEffect(() => {
    const onReceiveURL = ({ url }: { url: string }) => {
      console.log("Deep link received: ", url);
    };
    const subscription = Linking.addEventListener('url', onReceiveURL);
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

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef} linking={linking} fallback={<ActivityIndicator color="#008080" />}>
        {user ? <AuthenticatedStack /> : <PublicStack />}
      </NavigationContainer>
      
      This is the "small key". It will now float on top of all screens.
      We add a check to only show it if a user is logged in.
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