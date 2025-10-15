import React, { useEffect, useRef } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  SafeAreaView, 
  StatusBar, 
  Animated, 
  Dimensions,
  Pressable 
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import LinearGradient from 'react-native-linear-gradient';

// Define a consistent color palette
const COLORS = {
  primary: '#007AFF',
  background: '#F7F9FC',
  textPrimary: '#1D2A3F',
  textSecondary: '#6C7A9C',
  white: '#FFFFFF',
  gradientStart: '#E0F7FA', // Light cyan for header/footer
  gradientEnd: '#B2EBF2',   // Slightly darker cyan
};

// Get screen width for responsive card sizing
const { width } = Dimensions.get('window');

// Define navigation prop type for better TypeScript support
type NavigationProp = {
  navigate: (screen: string, params?: { role: string } | object) => void;
};

// Define the structure for a role item
type RoleItem = {
  id: number;
  name: string;
  icon: string;
  type: 'login' | 'navigate';
  target: string;
};

// ====================================================================
// Reusable, Animated RoleCard Component
// ====================================================================
const RoleCard = ({ item, index, onPress }: { item: RoleItem, index: number, onPress: () => void }) => {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 500,
      delay: index * 150,
      useNativeDriver: true,
    }).start();
    
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      delay: index * 150,
      useNativeDriver: true,
    }).start();
  }, [opacityAnim, scaleAnim, index]);

  return (
    <Animated.View style={{ opacity: opacityAnim, transform: [{ scale: scaleAnim }] }}>
      <Pressable 
        style={({ pressed }) => [
          styles.card,
          { transform: [{ scale: pressed ? 0.96 : 1 }] }
        ]} 
        onPress={onPress}
      >
        <Image source={{ uri: item.icon }} style={styles.cardIcon} resizeMode="contain" />
        <Text style={styles.cardText}>{item.name}</Text>
      </Pressable>
    </Animated.View>
  );
};


// ====================================================================
// Main HomeScreen Component
// ====================================================================
export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const headerAnim = useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [headerAnim]);

  const roles: RoleItem[] = [
    { id: 2, name: "Admin",   icon: "https://cdn-icons-png.flaticon.com/512/17003/17003310.png", type: 'login', target: 'admin' },
    { id: 3, name: "Student", icon: "https://cdn-icons-png.flaticon.com/512/2784/2784403.png", type: 'login', target: 'student' },
    { id: 4, name: "Teacher", icon: "https://cdn-icons-png.freepik.com/512/1995/1995574.png", type: 'login', target: 'teacher' },
    { id: 5, name: "Driver",  icon: "https://cdn-icons-png.flaticon.com/512/2798/2798177.png", type: 'login', target: 'Driver' },
  ];

  const handleRolePress = (item: RoleItem) => {
    if (item.type === 'login') {
      navigation.navigate('Login', { role: item.target });
    } else if (item.type === 'navigate') {
      navigation.navigate(item.target);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.gradientStart} />
      
      <Animated.View style={{ transform: [{ translateY: headerAnim }] }}>
        <LinearGradient
          colors={[COLORS.gradientStart, COLORS.gradientEnd]}
          style={styles.header}
        >
          <Image 
            source={require("../assets/logo.png")} 
            style={styles.logo} 
            resizeMode="contain" 
          />
          <Text style={styles.subtitle}>Empowering Easy Institutional Management</Text>
        </LinearGradient>
      </Animated.View>
      
      <View style={styles.contentWrapper}>
        {/* CHANGE: Added the "Select your role" title here */}
        <Text style={styles.roleTitle}>Select your role</Text>
        
        <View style={styles.gridContainer}>
          {roles.map((roleItem, index) => (
            <RoleCard 
              key={roleItem.id} 
              item={roleItem}
              index={index}
              onPress={() => handleRolePress(roleItem)}
            />
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 Vivekananda Public School</Text>
      </View>
    </SafeAreaView>
  );
}

// ====================================================================
// Enhanced StyleSheet
// ====================================================================
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background,
  },
  header: { 
    paddingTop: 40,
    paddingBottom: 80, // Adjusted padding for better balance with the new title
    alignItems: "center", 
    justifyContent: "center",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  logo: { 
    width: 370, 
    height: 270, // Adjusted height for better proportion
    marginBottom: -20,
    marginTop: -70, 
  },
  subtitle: {
    fontSize: 18,
    color: '#2f0062ff',
    paddingTop: -30, 
  },
  contentWrapper: {
    flex: 1, 
  },
  // CHANGE: Added style for the new title
  roleTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: 30, // Space from the header
  },
  gridContainer: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    justifyContent: "space-around", 
    paddingTop: 20, // Adjusted space from the new title
    paddingHorizontal: 10,
  },
  card: { 
    width: (width / 2) - 35, 
    backgroundColor: COLORS.white, 
    borderRadius: 16,
    paddingVertical: 25,
    paddingHorizontal: 15,
    alignItems: "center", 
    justifyContent: "center",
    marginBottom: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  cardIcon: { 
    width: 50, 
    height: 50, 
    marginBottom: 12 
  },
  cardText: { 
    fontSize: 16, 
    fontWeight: "600", 
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  footer: {
    backgroundColor: COLORS.gradientStart,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#005662',
  },
});