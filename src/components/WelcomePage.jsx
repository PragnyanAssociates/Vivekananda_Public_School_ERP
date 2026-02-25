// Date Modified: 25/02/2026 (DD/MM/YYYY)
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  Animated,
  Dimensions,
  ImageBackground,
  useColorScheme,
  StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/AntDesign';

// Get screen dimensions for responsive design
const { width, height } = Dimensions.get('window');

// --- THEME COLORS CONFIGURATION ---
const COLORS = {
  light: {
    background: '#FFFFFF',
    text: '#333333',
    // Light mode: White wash over image, dark text
    overlay: 'rgba(255, 255, 255, 0.65)', 
    primary: '#008080', // Teal to match dashboards
    buttonText: '#FFFFFF',
    shadow: '#000000',
    textShadow: 'rgba(255, 255, 255, 0.5)',
  },
  dark: {
    background: '#121212',
    text: '#E0E0E0',
    // Dark mode: Dark wash over image, light text
    overlay: 'rgba(0, 0, 0, 0.75)', 
    primary: '#008080', // Teal
    buttonText: '#FFFFFF',
    shadow: '#000000',
    textShadow: 'rgba(0, 0, 0, 0.8)',
  }
};

const WelcomePage = () => {
  const navigation = useNavigation();

  // --- THEME HOOKS ---
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const theme = isDarkMode ? COLORS.dark : COLORS.light;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.stagger(200,[
        Animated.spring(logoScaleAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
        Animated.spring(slideUpAnim, {
          toValue: 0,
          friction: 5,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  },[fadeAnim, slideUpAnim, logoScaleAnim]);

  const handleGetStarted = () => {
    navigation.navigate('HomeScreen');
  };

  // Animated styles
  const animatedContainerStyle = {
    opacity: fadeAnim,
  };
  const animatedLogoStyle = {
    opacity: fadeAnim,
    transform: [{ scale: logoScaleAnim }],
  };
  const animatedContentStyle = {
    opacity: fadeAnim,
    transform: [{ translateY: slideUpAnim }],
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor="transparent" 
        translucent 
      />
      
      <ImageBackground
        source={require('../assets/background-4.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Dynamic Overlay based on Theme */}
        <Animated.View style={[styles.overlay, animatedContainerStyle, { backgroundColor: theme.overlay }]}>
          
          {/* --- MODIFIED SECTION: Wrapper --- */}
          {/* Grouped the main content inside a View to shift them all further upwards seamlessly */}
          <View style={styles.mainContent}>
            {/* Main Logo */}
            <Animated.Image
              source={require("../assets/logo.png")}
              style={[styles.logo, animatedLogoStyle]}
              resizeMode="contain"
            />
            
            {/* Tagline Text */}
            <Animated.Text 
              style={[
                styles.tagline, 
                animatedContentStyle, 
                { 
                  color: theme.text,
                  textShadowColor: theme.textShadow 
                }
              ]}
            >
              The unified platform to manage your institution's resources and operations.
            </Animated.Text>
            
            {/* Get Started Button */}
            <Animated.View style={animatedContentStyle}>
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: theme.primary, shadowColor: theme.shadow }]} 
                onPress={handleGetStarted} 
                activeOpacity={0.8}
              >
                <Text style={[styles.buttonText, { color: theme.buttonText }]}>Get Started</Text>
                <Icon name="arrowright" size={24} color={theme.buttonText} />
              </TouchableOpacity>
            </Animated.View>
          </View>
          {/* --------------------------------------- */}

          {/* --- MODIFIED SECTION: Powered By Footer --- */}
          {/* Position further shifted up via responsive bottom spacing in styles to match the upper block */}
          <Animated.View style={[styles.footerContainer, { opacity: fadeAnim }]}>
            <Text style={[styles.poweredByText, { color: theme.text }]}>Powered by:</Text>
            
            <Image
              source={require('../assets/pragnyan-logo.png')} 
              style={styles.companyLogo}
              resizeMode="contain"
            />
          </Animated.View>
          {/* --------------------------------------- */}

        </Animated.View>
      </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: width * 0.05, 
    position: 'relative', 
  },
  // --- UPDATED STYLE ---
  // Shifts the entire central block (Logo, Tagline, Button) further upwards responsibly
  mainContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: -height * 0.24, // CHANGED from 0.12 to 0.24: Moves the block significantly higher to reach the marked line
  },
  logo: {
    width: width * 0.85, 
    height: width * 0.7, 
    marginBottom: -height * 0.08, 
  },
  tagline: {
    fontSize: width > 360 ? 18 : 16, 
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: '95%',
    fontStyle: "italic",
    marginBottom: height * 0.08, 
    marginTop: 0,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 12,
  },
  // --- UPDATED STYLE ---
  footerContainer: {
    position: 'absolute',
    bottom: height * 0.16, // CHANGED from 0.08 to 0.16: Moved footer significantly higher to maintain distance from the button
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column', 
  },
  poweredByText: {
    fontSize: 22,
    fontWeight: '500',
    marginBottom: -13, 
    opacity: 0.8,
    marginTop: 20,
    color: '#121dc2', 
  },
  companyLogo: {
    width: 220, 
    height: 100,
    marginTop: 10,
    marginBottom: 20, 
  },
});

export default WelcomePage;