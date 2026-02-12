// src/components/AboutUs.jsx
import React, { useEffect, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ScrollView,
    Dimensions,
    TouchableOpacity,
    Linking,
    Pressable,
    Image,
    Animated,
    SafeAreaView,
    StatusBar,
    useColorScheme
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 480;

// --- THEME DEFINITIONS ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    gradientStart: '#667eea',
    gradientEnd: '#764ba2',
    quoteBgStart: '#ff6b6b',
    quoteBgEnd: '#ee5a24',
    footerBgStart: '#E0F7FA',
    footerBgEnd: '#B2EBF2',
    contactBgStart: '#2c3e50',
    contactBgEnd: '#34495e',
    sectionTitle: '#667eea',
    footerText: '#005662'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    gradientStart: '#3b4c9b',
    gradientEnd: '#4a2c6d',
    quoteBgStart: '#b71c1c',
    quoteBgEnd: '#c62828',
    footerBgStart: '#004D40',
    footerBgEnd: '#00695C',
    contactBgStart: '#1a252f',
    contactBgEnd: '#2c3e50',
    sectionTitle: '#9fa8da',
    footerText: '#E0F2F1'
};

// ====================================================================
// Reusable Animated Component
// ====================================================================
const AnimatedSection = ({ children, delay = 0 }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            delay,
            useNativeDriver: true,
        }).start();
        Animated.spring(slideAnim, {
            toValue: 0,
            friction: 6,
            delay,
            useNativeDriver: true,
        }).start();
    }, [fadeAnim, slideAnim, delay]);

    return (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {children}
        </Animated.View>
    );
};

const AboutUs = () => {
    const navigation = useNavigation();
    
    // Theme Hook
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const handleLinkPress = (url) => {
        Linking.openURL(url).catch(err => console.error('An error occurred', err));
    };

    const ServiceItem = ({ children, style: customStyle, textStyle: customTextStyle, isCta }) => {
        const baseItemStyle = isCta ? styles.ctaServiceItem : [styles.serviceItem, { backgroundColor: COLORS.gradientStart }];
        const baseTextStyle = isCta ? styles.ctaServiceItemText : styles.serviceItemText;
        return (
            <Pressable style={({ pressed }) => [baseItemStyle, customStyle, pressed && styles.serviceItemPressed]}>
                <Text style={[baseTextStyle, customTextStyle]}>{children}</Text>
            </Pressable>
        );
    };

    const committeeData = {
        patrons: ["Padma Vibhushan Dr Palle Rama Rao Garu", "Sri B.D. Jain"], 
        president: "C. Vidya Sagar", 
        vicePresidents: ["Dr. Y.Krishna", "G.Shankar"], 
        secretary: "Dhathri Priya", 
        treasurer: "Dr. H.Sarvothaman", 
        jointSecretary: "Renuka Chekkala", 
        organisingSecretary: "Smita Rane", 
        executiveMembers: ["Yugandhara Babu Lella", "Aarti Joshi", "M. Vijaya"]
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#888' }]}>
                <View style={styles.headerLeft}>
                    <View style={[styles.headerIconContainer, { backgroundColor: isDark ? '#333' : '#E0F2F1' }]}>
                        <MaterialIcons name="info" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>About Us</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>School Profile</Text>
                    </View>
                </View>
            </View>

            <ScrollView style={[styles.scrollViewContainer, { backgroundColor: COLORS.background }]} contentContainerStyle={styles.container}>
                
                {/* --- HERO / LOGO CARD --- */}
                <AnimatedSection delay={0}>
                    <View style={[styles.logoCard, { backgroundColor: COLORS.cardBg }]}>
                        <Image source={require("../assets/logo.png")} style={styles.logoImage} resizeMode="contain"/>
                        <Text style={[styles.schoolName, { color: COLORS.primary }]}>Vivekananda Public School</Text>
                        <Text style={[styles.schoolSubName, { color: COLORS.textSub }]}>(English Medium school for underprivileged students)</Text>
                        <Text style={[styles.tagline, { color: COLORS.textSub }]}>Knowledge is Light</Text>
                    </View>
                </AnimatedSection>

                <AnimatedSection delay={100}>
                    <LinearGradient colors={[COLORS.quoteBgStart, COLORS.quoteBgEnd]} style={styles.quoteBanner}>
                        <Text style={styles.quoteBannerText}>"They Alone Live Who Live For Others"</Text>
                    </LinearGradient>
                </AnimatedSection>

                <View style={styles.content}>
                    
                    {/* Management Section */}
                    <AnimatedSection delay={200}>
                        <View style={[styles.sectionCard, { backgroundColor: COLORS.cardBg }]}>
                            <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.cardTopBorder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                            <View style={styles.sectionTitleContainer}><Text style={styles.sectionTitleEmoji}>👥</Text><Text style={[styles.sectionTitle, { color: COLORS.sectionTitle }]}>Management Committee</Text></View>
                            
                            <View style={styles.committeeRoleGroup}><Text style={[styles.committeeRoleTitle, { color: COLORS.textMain }]}>Patrons:</Text>{committeeData.patrons.map((name, index) => (<Text key={`patron-${index}`} style={[styles.committeeMemberName, { color: COLORS.textSub }]}>{name}</Text>))}</View>
                            <View style={styles.committeeRoleGroup}><Text style={[styles.committeeRoleTitle, { color: COLORS.textMain }]}>President:</Text><Text style={[styles.committeeMemberName, { color: COLORS.textSub }]}>{committeeData.president}</Text></View>
                            <View style={styles.committeeRoleGroup}><Text style={[styles.committeeRoleTitle, { color: COLORS.textMain }]}>Vice Presidents:</Text>{committeeData.vicePresidents.map((name, index) => (<Text key={`vp-${index}`} style={[styles.committeeMemberName, { color: COLORS.textSub }]}>{name}</Text>))}</View>
                            <View style={styles.committeeRoleGroup}><Text style={[styles.committeeRoleTitle, { color: COLORS.textMain }]}>Secretary:</Text><Text style={[styles.committeeMemberName, { color: COLORS.textSub }]}>{committeeData.secretary}</Text></View>
                            <View style={styles.committeeRoleGroup}><Text style={[styles.committeeRoleTitle, { color: COLORS.textMain }]}>Treasurer:</Text><Text style={[styles.committeeMemberName, { color: COLORS.textSub }]}>{committeeData.treasurer}</Text></View>
                            <View style={styles.committeeRoleGroup}><Text style={[styles.committeeRoleTitle, { color: COLORS.textMain }]}>Joint Secretary:</Text><Text style={[styles.committeeMemberName, { color: COLORS.textSub }]}>{committeeData.jointSecretary}</Text></View>
                            <View style={styles.committeeRoleGroup}><Text style={[styles.committeeRoleTitle, { color: COLORS.textMain }]}>Organising Secretary:</Text><Text style={[styles.committeeMemberName, { color: COLORS.textSub }]}>{committeeData.organisingSecretary}</Text></View>
                            <View style={styles.committeeRoleGroup}><Text style={[styles.committeeRoleTitle, { color: COLORS.textMain }]}>Executive Committee Members:</Text>{committeeData.executiveMembers.map((name, index) => (<Text key={`exec-${index}`} style={[styles.committeeMemberName, { color: COLORS.textSub }]}>{name}</Text>))}</View>
                        </View>
                    </AnimatedSection>
                    
                    {/* Mission Section */}
                    <AnimatedSection delay={300}>
                        <View style={[styles.sectionCard, { backgroundColor: COLORS.cardBg }]}>
                            <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.cardTopBorder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                            <View style={styles.sectionTitleContainer}><Text style={styles.sectionTitleEmoji}>🎯</Text><Text style={[styles.sectionTitle, { color: COLORS.sectionTitle }]}>Our Mission</Text></View>
                            <Text style={[styles.missionText, { color: COLORS.textSub }]}>At Vivekananda Public School, we are dedicated to providing quality English medium education to underprivileged students. Our vision is rooted in the noble ideals of Swami Vivekananda, focusing on holistic development and character building. We believe that education is the most powerful tool to transform lives and communities.</Text>
                        </View>
                    </AnimatedSection>

                    {/* Offerings Section */}
                    <AnimatedSection delay={400}>
                        <View style={[styles.sectionCard, { backgroundColor: COLORS.cardBg }]}>
                            <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.cardTopBorder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                            <View style={styles.sectionTitleContainer}><Text style={styles.sectionTitleEmoji}>✨</Text><Text style={[styles.sectionTitle, { color: COLORS.sectionTitle }]}>What We Offer</Text></View>
                            <View style={[styles.serviceList, isSmallScreen && styles.serviceListSmallScreen]}>
                                <ServiceItem>Free Education</ServiceItem><ServiceItem>Midday Meals</ServiceItem><ServiceItem>Free Uniform</ServiceItem><ServiceItem>Free Books & Stationary</ServiceItem><ServiceItem>Medical Assistance</ServiceItem><ServiceItem>Quality Teaching</ServiceItem>
                            </View>
                        </View>
                    </AnimatedSection>

                    {/* CTA Section */}
                    <AnimatedSection delay={500}>
                        <LinearGradient colors={[COLORS.quoteBgStart, COLORS.quoteBgEnd]} style={styles.ctaSection}>
                            <Text style={styles.ctaTitle}>JOIN US FOR A NOBLE CAUSE</Text>
                            <Text style={styles.ctaText}>Be part of our mission to transform young lives through education. Your support can make a real difference in a child's future.</Text>
                            <View style={[styles.serviceList, styles.ctaServiceListContainer]}>
                                <ServiceItem isCta>Sponsor a Child</ServiceItem><ServiceItem isCta>Donate in Kind</ServiceItem><ServiceItem isCta>Sponsor Mid Day Meal</ServiceItem><ServiceItem isCta>Volunteer with Us</ServiceItem>
                            </View>
                        </LinearGradient>
                    </AnimatedSection>

                    {/* Students Section */}
                    <AnimatedSection delay={600}>
                        <View style={[styles.sectionCard, { backgroundColor: COLORS.cardBg }]}>
                            <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.cardTopBorder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                            <View style={styles.sectionTitleContainer}><Text style={styles.sectionTitleEmoji}>🎓</Text><Text style={[styles.sectionTitle, { color: COLORS.sectionTitle }]}>Our Students</Text></View>
                            <View style={styles.galleryGrid}>
                                <Pressable style={({ pressed }) => [styles.galleryPressable, pressed && styles.serviceItemPressed]}>
                                    <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.galleryItem} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}><Text style={styles.galleryItemText}>📚{'\n'}Dedicated Learners</Text></LinearGradient>
                                </Pressable>
                                <Pressable style={({ pressed }) => [styles.galleryPressable, pressed && styles.serviceItemPressed]}>
                                    <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.galleryItem} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}><Text style={styles.galleryItemText}>🌟{'\n'}Future Leaders</Text></LinearGradient>
                                </Pressable>
                                 <Pressable style={({ pressed }) => [styles.galleryPressable, pressed && styles.serviceItemPressed]}>
                                    <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.galleryItem} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}><Text style={styles.galleryItemText}>💡{'\n'}Bright Minds</Text></LinearGradient>
                                </Pressable>
                                 <Pressable style={({ pressed }) => [styles.galleryPressable, pressed && styles.serviceItemPressed]}>
                                    <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.galleryItem} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}><Text style={styles.galleryItemText}>💫{'\n'}Inspired Souls</Text></LinearGradient>
                                </Pressable>
                            </View>
                        </View>
                    </AnimatedSection>

                    {/* Contact Section */}
                    <AnimatedSection delay={700}>
                        <LinearGradient colors={[COLORS.contactBgStart, COLORS.contactBgEnd]} style={styles.contactSection}>
                            <Text style={styles.contactTitle}>Visit Us</Text>
                            <View style={styles.contactInfo}>
                                <View style={styles.contactItem}><Text style={styles.contactIcon}>📍</Text><Text style={styles.contactItemText}>H.No. 8-3-1100, A&A1, Plot No. 112,{'\n'}Srinagar Colony, Hyderabad,{'\n'}Telangana-500073, India</Text></View>
                                <TouchableOpacity onPress={() => handleLinkPress('tel:040-23355998')}><View style={styles.contactItem}><Text style={styles.contactIcon}>📞</Text><Text style={styles.contactItemText}>040-23355998</Text></View></TouchableOpacity>
                                <TouchableOpacity onPress={() => handleLinkPress('tel:+919394073325')}><View style={styles.contactItem}><Text style={styles.contactIcon}>📱</Text><Text style={styles.contactItemText}>+91 9394073325</Text></View></TouchableOpacity>
                                <TouchableOpacity onPress={() => handleLinkPress('http://www.vpsngo.org')}><View style={styles.contactItem}><Text style={styles.contactIcon}>🌐</Text><Text style={[styles.contactItemText, styles.contactItemTextUnderline]}>www.vpsngo.org</Text></View></TouchableOpacity>
                                <TouchableOpacity onPress={() => handleLinkPress('mailto:vivekanandaschoolhyd@gmail.com')}><View style={styles.contactItem}><Text style={styles.contactIcon}>✉️</Text><Text style={[styles.contactItemText, styles.contactItemTextUnderline]}>vivekanandaschoolhyd@gmail.com</Text></View></TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </AnimatedSection>
                </View>

                {/* --- FOOTER --- */}
                <LinearGradient colors={[COLORS.footerBgStart, COLORS.footerBgEnd]} style={[styles.footer, { borderTopColor: COLORS.border }]}>
                    <Text style={[styles.footerTitle, { color: COLORS.footerText }]}>© 2025 Vivekananda Educational Centre</Text>
                    <Text style={[styles.footerText, { color: COLORS.footerText }]}>Income Tax Exemption under 80G</Text>
                    <Text style={[styles.footerText, { color: COLORS.footerText }]}>DIT(E)80G/17/(07)/(09)-10 | PAN: AAGFV4558E</Text>
                </LinearGradient>
            </ScrollView>
        </SafeAreaView>
    );
};

// --- STYLES ---
const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    scrollViewContainer: { flex: 1 },
    container: { paddingBottom: 0 },
    
    // --- HEADER CARD ---
    headerCard: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '96%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 3,
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },

    // --- LOGO CARD ---
    logoCard: {
        marginHorizontal: 15,
        marginTop: 10,
        marginBottom: 20,
        borderRadius: 15,
        alignItems: 'center',
        paddingVertical: 25,
        paddingHorizontal: 15,
        elevation: 2,
        shadowColor: '#000', 
        shadowOpacity: 0.08, 
        shadowRadius: 5, 
        shadowOffset: { width: 0, height: 2 },
    },
    logoImage: { width: 280, height: 140, marginBottom: 10 },
    schoolName: { fontSize: 20, fontWeight: "bold", textAlign: 'center' },
    schoolSubName: { fontSize: 13, fontWeight: "400", textAlign: 'center', marginTop: 4 },
    tagline: { fontSize: 14, fontStyle: 'italic', marginTop: 8, textAlign: 'center' },

    quoteBanner: { paddingVertical: 15, paddingHorizontal: 20, marginHorizontal: 15, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
    quoteBannerText: { color: 'white', fontStyle: 'italic', fontSize: 16, fontWeight: '500', textAlign: 'center' },
    
    content: { padding: 15 },
    
    // --- SECTION CARD STYLE ---
    sectionCard: { borderRadius: 15, padding: 25, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3, position: 'relative', overflow: 'hidden' },
    cardTopBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
    
    sectionTitleContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    sectionTitleEmoji: { marginRight: 10, fontSize: 20 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold' },
    
    committeeRoleGroup: { marginBottom: 15 },
    committeeRoleTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 5 },
    committeeMemberName: { fontSize: 14, lineHeight: 22, marginLeft: 10 },
    missionText: { fontSize: 15, lineHeight: 25 },
    
    serviceList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginVertical: 10 },
    serviceListSmallScreen: { flexDirection: 'column', alignItems: 'stretch' },
    serviceItem: { paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', width: isSmallScreen ? '100%' : '48%', marginBottom: 10, shadowColor: 'rgba(102, 126, 234, 0.3)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.8, shadowRadius: 10, elevation: 3 },
    serviceItemText: { color: 'white', fontSize: 13, fontWeight: '500', textAlign: 'center' },
    serviceItemPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
    
    ctaSection: { borderRadius: 15, paddingHorizontal: 20, paddingVertical: 25, alignItems: 'center', marginVertical: 10 },
    ctaTitle: { fontSize: 18, fontWeight: 'bold', color: 'white', marginBottom: 15, textAlign: 'center' },
    ctaText: { fontSize: 14, color: 'white', lineHeight: 22, marginBottom: 20, textAlign: 'center' },
    ctaServiceListContainer: { width: '100%' },
    ctaServiceItem: { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', width: '48%', marginBottom: 10, minHeight: 50 },
    ctaServiceItemText: { color: 'white', fontSize: 13, fontWeight: '500', textAlign: 'center' },
    
    galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 15 },
    galleryPressable: { width: '48%', marginBottom: 10 },
    galleryItem: { width: '100%', height: 120, borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 8 },
    galleryItemText: { color: 'white', fontSize: 14, fontWeight: '600', textAlign: 'center' },
    
    contactSection: { borderRadius: 15, padding: 25, marginTop: 10, },
    contactTitle: { fontSize: 20, fontWeight: 'bold', color: 'white', marginBottom: 20, textAlign: 'center' },
    contactInfo: {},
    contactItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingVertical: 8 },
    contactIcon: { width: 25, textAlign: 'center', marginRight: 12, color: '#76c7f7', fontSize: 18 },
    contactItemText: { color: 'white', fontSize: 14, flexShrink: 1 },
    contactItemTextUnderline: { textDecorationLine: 'underline' },
    
    footer: {
        paddingVertical: 25,
        paddingHorizontal: 20,
        alignItems: 'center',
        borderTopWidth: 1,
    },
    footerTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 8 },
    footerText: { textAlign: 'center', fontSize: 12, lineHeight: 18 },
});

export default AboutUs;