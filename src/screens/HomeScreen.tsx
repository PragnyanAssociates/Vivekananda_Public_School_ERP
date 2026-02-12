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
  Pressable,
  useColorScheme 
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import LinearGradient from 'react-native-linear-gradient';

// Get screen dimensions for responsive design
const { width } = Dimensions.get('window');

// --- THEME COLORS CONFIGURATION ---
const COLORS = {
  light: {
    background: '#F7F9FC',
    cardBg: '#FFFFFF',
    textPrimary: '#1D2A3F',
    textSecondary: '#6C7A9C',
    gradientStart: '#E0F7FA', // Light cyan
    gradientEnd: '#B2EBF2',   // Slightly darker cyan
    subtitle: '#2f0062ff',
    footerBg: '#E0F7FA',
    footerText: '#005662',
    shadow: '#000000',
  },
  dark: {
    background: '#121212',
    cardBg: '#1E1E1E',
    textPrimary: '#E0E0E0',
    textSecondary: '#B0B0B0',
    gradientStart: '#004D40', // Dark Teal
    gradientEnd: '#00251F',   // Very Dark Teal
    subtitle: '#80CBC4',      // Light Teal for contrast
    footerBg: '#1E1E1E',
    footerText: '#80CBC4',
    shadow: '#000000',
  }
};

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
const RoleCard = ({ item, index, onPress, theme }: { item: RoleItem, index: number, onPress: () => void, theme: any }) => {
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
          { 
            backgroundColor: theme.cardBg,
            shadowColor: theme.shadow,
            transform: [{ scale: pressed ? 0.96 : 1 }] 
          }
        ]} 
        onPress={onPress}
      >
        <Image source={{ uri: item.icon }} style={styles.cardIcon} resizeMode="contain" />
        <Text style={[styles.cardText, { color: theme.textPrimary }]}>{item.name}</Text>
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

  // --- THEME HOOKS ---
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const theme = isDarkMode ? COLORS.dark : COLORS.light;

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
    { id: 5, name: "Others",  icon: "https://cdn-icons-png.flaticon.com/128/3701/3701573.png", type: 'login', target: 'Others' },
  ];

  const handleRolePress = (item: RoleItem) => {
    if (item.type === 'login') {
      navigation.navigate('Login', { role: item.target });
    } else if (item.type === 'navigate') {
      navigation.navigate(item.target);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor={theme.gradientStart} 
      />
      
      <Animated.View style={{ transform: [{ translateY: headerAnim }] }}>
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientEnd]}
          style={styles.header}
        >
          <Image 
            source={require("../assets/logo.png")} 
            style={styles.logo} 
            resizeMode="contain" 
          />
          <Text style={[styles.subtitle, { color: theme.subtitle }]}>Empowering Easy Institutional Management</Text>
        </LinearGradient>
      </Animated.View>
      
      <View style={styles.contentWrapper}>
        <Text style={[styles.roleTitle, { color: theme.textPrimary }]}>Select your role</Text>
        
        <View style={styles.gridContainer}>
          {roles.map((roleItem, index) => (
            <RoleCard 
              key={roleItem.id} 
              item={roleItem}
              index={index}
              theme={theme}
              onPress={() => handleRolePress(roleItem)}
            />
          ))}
        </View>
      </View>

      <View style={[styles.footer, { backgroundColor: theme.footerBg }]}>
        <Text style={[styles.footerText, { color: theme.footerText }]}>© 2025 Vivekananda Public School</Text>
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
  },
  header: { 
    paddingTop: 40,
    paddingBottom: 80, 
    alignItems: "center", 
    justifyContent: "center",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  logo: { 
    width: width * 0.9, // Responsive Width (90% of screen)
    height: width * 0.65, // Maintain aspect ratio
    marginBottom: -20,
    marginTop: -60, 
  },
  subtitle: {
    fontSize: width > 350 ? 18 : 15, // Adjust font size for small screens
    paddingTop: -30, 
    textAlign: 'center',
    fontWeight: '500',
  },
  contentWrapper: {
    flex: 1, 
  },
  roleTitle: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 30, 
  },
  gridContainer: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    justifyContent: "space-around", 
    paddingTop: 20, 
    paddingHorizontal: 10,
  },
  card: { 
    width: (width / 2) - 35, 
    borderRadius: 16,
    paddingVertical: 25,
    paddingHorizontal: 15,
    alignItems: "center", 
    justifyContent: "center",
    marginBottom: 25,
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
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 14,
  },
});