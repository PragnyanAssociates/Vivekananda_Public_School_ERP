import React, { useState, useEffect, useRef } from "react";
import { 
  View, Text, StyleSheet, TextInput, Image, 
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, 
  ScrollView, StatusBar, SafeAreaView, Pressable, Animated 
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';

import LinearGradient from 'react-native-linear-gradient';
import Feather from 'react-native-vector-icons/Feather';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type LoginScreenProps = {
  route: { params: { role: 'admin' | 'teacher' | 'student' |  'Driver'; } }
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

  // --- Animation Hooks ---
  const headerAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // --- Focus State for Inputs ---
  const [isUserFocused, setIsUserFocused] = useState(false);
  const [isPassFocused, setIsPassFocused] = useState(false);
  
  // --- NEW: State for Password Visibility ---
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  useEffect(() => {
    // Staggered entry animation for a smooth, professional appearance
    Animated.stagger(200, [
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true }),
      Animated.spring(formAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, []);

  const triggerShake = () => {
    shakeAnim.setValue(0); // Reset before shaking
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
      triggerShake(); // Shake on validation error
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
        if (data.user.role !== role) {
          Alert.alert("Login Failed", `You are not registered as a ${role}.`);
          triggerShake(); // Shake on role mismatch
        } else {
          await login(data.user, data.token);
        }
      } else {
        Alert.alert("Login Failed", data.message || "Invalid credentials.");
        triggerShake(); // Shake on invalid credentials
      }
    } catch (error) {
      Alert.alert("An Error Occurred", "Could not connect to the server.");
      triggerShake(); // Shake on network error
    } finally {
      setIsLoggingIn(false);
    }
  };

  // --- Animated Styles ---
  const headerStyle = { opacity: headerAnim, transform: [{ scale: headerAnim }] };
  const formStyle = { opacity: formAnim, transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] };
  const shakeStyle = { transform: [{ translateX: shakeAnim }] };

  return (
    <SafeAreaView style={{flex: 1}}>
      <LinearGradient colors={['#E0F7FA', '#B2EBF2', '#dd9eb2ff']} style={styles.gradient}>
        <StatusBar barStyle="dark-content" />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            
            <Animated.View style={[styles.header, headerStyle]}>
              <Image source={require("../assets/logo.png")} style={styles.logo}/>
              <Text style={styles.welcomeText}>Welcome Back!</Text>
            </Animated.View>

            <Animated.View style={[styles.formContainer, formStyle, shakeStyle]}>
              <Text style={styles.title}>{capitalize(role)} Login</Text>
              
              <View style={[styles.inputContainer, isUserFocused && styles.inputContainerFocused]}>
                <Feather name={role === 'student' ? 'hash' : 'user'} size={20} color={isUserFocused ? "#007BFF" : "#888"} style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder={role === 'student' ? 'Student ID' : 'Username'} 
                  value={username} 
                  onChangeText={setUsername} 
                  autoCapitalize="none" 
                  placeholderTextColor="#888"
                  onFocus={() => setIsUserFocused(true)}
                  onBlur={() => setIsUserFocused(false)}
                />
              </View>

              {/* --- MODIFIED PASSWORD INPUT --- */}
              <View style={[styles.inputContainer, isPassFocused && styles.inputContainerFocused]}>
                <Feather name="lock" size={20} color={isPassFocused ? "#007BFF" : "#888"} style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Password" 
                  secureTextEntry={!isPasswordVisible} // Dynamic visibility
                  value={password} 
                  onChangeText={setPassword}
                  placeholderTextColor="#888"
                  onFocus={() => setIsPassFocused(true)}
                  onBlur={() => setIsPassFocused(false)}
                  textContentType="password" // Helps with password managers
                />
                <Pressable 
                  onPress={() => setIsPasswordVisible(!isPasswordVisible)} 
                  style={styles.eyeIconContainer}
                >
                  <Feather 
                    name={isPasswordVisible ? "eye" : "eye-off"} 
                    size={20} 
                    color={isPassFocused ? "#007BFF" : "#888"} 
                  />
                </Pressable>
              </View>
              
              <Pressable style={({ pressed }) => [styles.loginButton, { transform: [{scale: pressed ? 0.98 : 1}] }]} onPress={handleLogin} disabled={isLoggingIn}>
                {isLoggingIn ? (<ActivityIndicator color="#fff" />) : (<Text style={styles.loginButtonText}>Login</Text>)}
              </Pressable>

            </Animated.View>
            
            <Text style={styles.footerText}>© 2025 Vivekananda Public School</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

// --- YOUR ORIGINAL STYLES WITH DYNAMIC ENHANCEMENTS & NEW ADDITION ---
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
    width: 370,
    height: 250,
    resizeMode: "contain",
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#005662',
    marginTop: -30,
  },
  formContainer: {
    width: '90%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    marginTop: -10,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    marginBottom: 25,
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputContainerFocused: {
    borderColor: '#007BFF',
    backgroundColor: '#fff',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  // --- NEW STYLE for the eye icon ---
  eyeIconContainer: {
    padding: 5, // Increases the touchable area for the icon
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
    color: '#005662',
    fontSize: 16,
    marginTop: 20,
  },
});