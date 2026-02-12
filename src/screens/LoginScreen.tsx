import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, Image,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StatusBar, SafeAreaView, Pressable, Animated,
  Dimensions, useColorScheme
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';

import LinearGradient from 'react-native-linear-gradient';
import Feather from 'react-native-vector-icons/Feather';

const { width } = Dimensions.get('window');

// --- THEME COLORS CONFIGURATION ---
const COLORS = {
  light: {
    gradient: ['#E0F7FA', '#B2EBF2', '#dd9eb2ff'],
    text: '#333333',
    cardBg: 'rgba(255, 255, 255, 0.9)',
    inputBg: '#F0F4F8',
    inputBorder: 'transparent',
    placeholder: '#888888',
    primary: '#007BFF',
    iconDefault: '#888888',
    footer: '#005662',
    shadow: '#000000'
  },
  dark: {
    gradient: ['#0f2027', '#203a43', '#2c5364'], // Dark teal/slate gradient
    text: '#FFFFFF',
    cardBg: 'rgba(30, 30, 30, 0.95)',
    inputBg: '#2C2C2C',
    inputBorder: '#444444',
    placeholder: '#AAAAAA',
    primary: '#007BFF',
    iconDefault: '#CCCCCC',
    footer: '#80CBC4',
    shadow: '#000000'
  }
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type LoginScreenProps = {
  route: { params: { role: 'admin' | 'teacher' | 'student' | 'others'; } }
};

type NavigationProp = {
  navigate: (screen: string) => void;
};

export default function LoginScreen({ route }: LoginScreenProps) {
  const { role } = route.params;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { login } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  // --- THEME HOOKS ---
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const theme = isDarkMode ? COLORS.dark : COLORS.light;

  const headerAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const [isUserFocused, setIsUserFocused] = useState(false);
  const [isPassFocused, setIsPassFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  useEffect(() => {
    Animated.stagger(200, [
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true }),
      Animated.spring(formAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, []);

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Input Required", "Please enter your details.");
      triggerShake();
      return;
    }
    setIsLoggingIn(true);
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok) {
        // ==========================================================
        // --- THIS IS THE CORRECTED LINE ---
        // ==========================================================
        // Compare roles in a case-insensitive way to fix the "Others" login issue.
        if (data.user.role.toLowerCase() !== role.toLowerCase()) {
        // ==========================================================
        // --- END OF CORRECTION ---
        // ==========================================================
          Alert.alert("Login Failed", `You are not registered as a ${role}.`);
          triggerShake();
        } else {
          await login(data.user, data.token);
        }
      } else {
        Alert.alert("Login Failed", data.message || "Invalid credentials.");
        triggerShake();
      }
    } catch (error) {
      Alert.alert("An Error Occurred", "Could not connect to the server.");
      triggerShake();
    } finally {
      setIsLoggingIn(false);
    }
  };

  const headerStyle = { opacity: headerAnim, transform: [{ scale: headerAnim }] };
  const formStyle = { opacity: formAnim, transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] };
  const shakeStyle = { transform: [{ translateX: shakeAnim }] };

  return (
    <SafeAreaView style={{flex: 1}}>
      <LinearGradient colors={theme.gradient} style={styles.gradient}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>

            <Animated.View style={[styles.header, headerStyle]}>
              <Image source={require("../assets/logo.png")} style={styles.logo}/>
              <Text style={[styles.welcomeText, { color: theme.footer }]}>Welcome Back!</Text>
            </Animated.View>

            <Animated.View style={[styles.formContainer, formStyle, shakeStyle, { backgroundColor: theme.cardBg, shadowColor: theme.shadow }]}>
              <Text style={[styles.title, { color: theme.text }]}>{capitalize(role)} Login</Text>

              <View style={[
                  styles.inputContainer, 
                  { backgroundColor: theme.inputBg, borderColor: theme.inputBorder },
                  isUserFocused && { borderColor: theme.primary, backgroundColor: theme.inputBg }
                ]}>
                <Feather 
                  name={role === 'student' ? 'hash' : 'user'} 
                  size={20} 
                  color={isUserFocused ? theme.primary : theme.iconDefault} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder={role === 'student' ? 'Student ID' : 'Username'}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  placeholderTextColor={theme.placeholder}
                  onFocus={() => setIsUserFocused(true)}
                  onBlur={() => setIsUserFocused(false)}
                />
              </View>

              <View style={[
                  styles.inputContainer, 
                  { backgroundColor: theme.inputBg, borderColor: theme.inputBorder },
                  isPassFocused && { borderColor: theme.primary, backgroundColor: theme.inputBg }
                ]}>
                <Feather 
                  name="lock" 
                  size={20} 
                  color={isPassFocused ? theme.primary : theme.iconDefault} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Password"
                  secureTextEntry={!isPasswordVisible}
                  value={password}
                  onChangeText={setPassword}
                  placeholderTextColor={theme.placeholder}
                  onFocus={() => setIsPassFocused(true)}
                  onBlur={() => setIsPassFocused(false)}
                  textContentType="password"
                />
                <Pressable
                  onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                  style={styles.eyeIconContainer}
                >
                  <Feather
                    name={isPasswordVisible ? "eye" : "eye-off"}
                    size={20}
                    color={isPassFocused ? theme.primary : theme.iconDefault}
                  />
                </Pressable>
              </View>

              <Pressable style={({ pressed }) => [styles.loginButton, { transform: [{scale: pressed ? 0.98 : 1}] }]} onPress={handleLogin} disabled={isLoggingIn}>
                {isLoggingIn ? (<ActivityIndicator color="#fff" />) : (<Text style={styles.loginButtonText}>Login</Text>)}
              </Pressable>

            </Animated.View>

            <Text style={[styles.footerText, { color: theme.footer }]}>© 2025 Vivekananda Public School</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: width * 0.85, // Responsive width
    height: 250,
    resizeMode: "contain",
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: -30,
  },
  formContainer: {
    width: '90%',
    borderRadius: 20,
    padding: 25,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    marginTop: -10,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 25,
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 15,
    borderWidth: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
  },
  eyeIconContainer: {
    padding: 5,
  },
  loginButton: {
    backgroundColor: "#007BFF",
    height: 55,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#007BFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  footerText: {
    fontSize: 16,
    marginTop: 20,
  },
});