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
    Animated // <-- Import Animated
} from 'react-native';
// Make sure you have this installed: npm install react-native-linear-gradient
import LinearGradient from 'react-native-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');
const isSmallScreen = screenWidth < 480;

// ====================================================================
// Reusable Animated Component for Dynamic Sections
// This component wraps your sections to make them animate on screen entry.
// ====================================================================
const AnimatedSection = ({ children, delay = 0 }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        // A combination of a fade and a subtle slide-up effect
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
    const handleLinkPress = (url) => {
        Linking.openURL(url).catch(err => console.error('An error occurred', err));
    };

    const ServiceItem = ({ children, style: customStyle, textStyle: customTextStyle, isCta }) => {
        const baseItemStyle = isCta ? styles.ctaServiceItem : styles.serviceItem;
        const baseTextStyle = isCta ? styles.ctaServiceItemText : styles.serviceItemText;
        return (
            <Pressable style={({ pressed }) => [baseItemStyle, customStyle, pressed && styles.serviceItemPressed]}>
                <Text style={[baseTextStyle, customTextStyle]}>{children}</Text>
            </Pressable>
        );
    };

    const committeeData = {
        patrons: ["Padma Vibhushan Dr Palle Rama Rao Garu", "Sri B.D. Jain"], president: "C. Vidya Sagar", vicePresidents: ["Dr. Y.Krishna", "G.Shankar"], secretary: "Dhathri Priya", treasurer: "Dr. H.Sarvothaman", jointSecretary: "Renuka Chekkala", organisingSecretary: "Smita Rane", executiveMembers: ["Yugandhara Babu Lella", "Aarti Joshi", "M. Vijaya"]
    };

    return (
        <ScrollView style={styles.scrollViewContainer} contentContainerStyle={styles.container}>
            <View style={styles.newHeader}>
                <Image source={require("../assets/logo.png")} style={styles.newHeaderLogo} resizeMode="contain"/>
                <Text style={styles.newHeaderSchoolName}>Vivekananda Public School</Text>
                <Text style={styles.newHeaderSchoolSubName}>(English Medium school for underprivileged students)</Text>
                <Text style={styles.newHeaderTagline}>Knowledge is Light</Text>
            </View>

            <LinearGradient colors={['#ff6b6b', '#ee5a24']} style={styles.quoteBanner}>
                <Text style={styles.quoteBannerText}>"They Alone Live Who Live For Others"</Text>
            </LinearGradient>

            <View style={styles.content}>
                {/* --- Sections are now wrapped in AnimatedSection for dynamic entry --- */}
                <AnimatedSection delay={100}>
                    <View style={styles.managementSection}>
                        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.managementSectionTopBorder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                        <View style={styles.sectionTitleContainer}><Text style={styles.sectionTitleEmoji}>👥</Text><Text style={styles.sectionTitle}>Management Committee</Text></View>
                        <View style={styles.committeeRoleGroup}><Text style={styles.committeeRoleTitle}>Patrons:</Text>{committeeData.patrons.map((name, index) => (<Text key={`patron-${index}`} style={styles.committeeMemberName}>{name}</Text>))}</View>
                        <View style={styles.committeeRoleGroup}><Text style={styles.committeeRoleTitle}>President:</Text><Text style={styles.committeeMemberName}>{committeeData.president}</Text></View>
                        <View style={styles.committeeRoleGroup}><Text style={styles.committeeRoleTitle}>Vice Presidents:</Text>{committeeData.vicePresidents.map((name, index) => (<Text key={`vp-${index}`} style={styles.committeeMemberName}>{name}</Text>))}</View>
                        <View style={styles.committeeRoleGroup}><Text style={styles.committeeRoleTitle}>Secretary:</Text><Text style={styles.committeeMemberName}>{committeeData.secretary}</Text></View>
                        <View style={styles.committeeRoleGroup}><Text style={styles.committeeRoleTitle}>Treasurer:</Text><Text style={styles.committeeMemberName}>{committeeData.treasurer}</Text></View>
                        <View style={styles.committeeRoleGroup}><Text style={styles.committeeRoleTitle}>Joint Secretary:</Text><Text style={styles.committeeMemberName}>{committeeData.jointSecretary}</Text></View>
                        <View style={styles.committeeRoleGroup}><Text style={styles.committeeRoleTitle}>Organising Secretary:</Text><Text style={styles.committeeMemberName}>{committeeData.organisingSecretary}</Text></View>
                        <View style={styles.committeeRoleGroup}><Text style={styles.committeeRoleTitle}>Executive Committee Members:</Text>{committeeData.executiveMembers.map((name, index) => (<Text key={`exec-${index}`} style={styles.committeeMemberName}>{name}</Text>))}</View>
                    </View>
                </AnimatedSection>
                
                <AnimatedSection delay={200}>
                    <View style={styles.missionSection}>
                        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.missionSectionTopBorder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                        <View style={styles.sectionTitleContainer}><Text style={styles.sectionTitleEmoji}>🎯</Text><Text style={styles.sectionTitle}>Our Mission</Text></View>
                        <Text style={styles.missionText}>At Vivekananda Public School, we are dedicated to providing quality English medium education to underprivileged students. Our vision is rooted in the noble ideals of Swami Vivekananda, focusing on holistic development and character building. We believe that education is the most powerful tool to transform lives and communities.</Text>
                    </View>
                </AnimatedSection>

                <AnimatedSection delay={300}>
                    <View style={styles.missionSection}>
                        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.missionSectionTopBorder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                        <View style={styles.sectionTitleContainer}><Text style={styles.sectionTitleEmoji}>✨</Text><Text style={styles.sectionTitle}>What We Offer</Text></View>
                        <View style={[styles.serviceList, isSmallScreen && styles.serviceListSmallScreen]}>
                            <ServiceItem>Free Education</ServiceItem><ServiceItem>Midday Meals</ServiceItem><ServiceItem>Free Uniform</ServiceItem><ServiceItem>Free Books & Stationary</ServiceItem><ServiceItem>Medical Assistance</ServiceItem><ServiceItem>Quality Teaching</ServiceItem>
                        </View>
                    </View>
                </AnimatedSection>

                <AnimatedSection delay={400}>
                    <LinearGradient colors={['#ff6b6b', '#ee5a24']} style={styles.ctaSection}>
                        <Text style={styles.ctaTitle}>JOIN US FOR A NOBLE CAUSE</Text>
                        <Text style={styles.ctaText}>Be part of our mission to transform young lives through education. Your support can make a real difference in a child's future.</Text>
                        <View style={[styles.serviceList, styles.ctaServiceListContainer]}>
                            <ServiceItem isCta>Sponsor a Child</ServiceItem><ServiceItem isCta>Donate in Kind</ServiceItem><ServiceItem isCta>Sponsor Mid Day Meal</ServiceItem><ServiceItem isCta>Volunteer with Us</ServiceItem>
                        </View>
                    </LinearGradient>
                </AnimatedSection>

                <AnimatedSection delay={500}>
                    <View style={styles.missionSection}>
                        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.missionSectionTopBorder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                        <View style={styles.sectionTitleContainer}><Text style={styles.sectionTitleEmoji}>🎓</Text><Text style={styles.sectionTitle}>Our Students</Text></View>
                        <View style={styles.galleryGrid}>
                            <Pressable style={({ pressed }) => [styles.galleryPressable, pressed && styles.serviceItemPressed]}>
                                <LinearGradient colors={['#667eea', '#764ba2']} style={styles.galleryItem} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}><Text style={styles.galleryItemText}>📚{'\n'}Dedicated Learners</Text></LinearGradient>
                            </Pressable>
                            <Pressable style={({ pressed }) => [styles.galleryPressable, pressed && styles.serviceItemPressed]}>
                                <LinearGradient colors={['#667eea', '#764ba2']} style={styles.galleryItem} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}><Text style={styles.galleryItemText}>🌟{'\n'}Future Leaders</Text></LinearGradient>
                            </Pressable>
                             <Pressable style={({ pressed }) => [styles.galleryPressable, pressed && styles.serviceItemPressed]}>
                                <LinearGradient colors={['#667eea', '#764ba2']} style={styles.galleryItem} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}><Text style={styles.galleryItemText}>💡{'\n'}Bright Minds</Text></LinearGradient>
                            </Pressable>
                             <Pressable style={({ pressed }) => [styles.galleryPressable, pressed && styles.serviceItemPressed]}>
                                <LinearGradient colors={['#667eea', '#764ba2']} style={styles.galleryItem} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}><Text style={styles.galleryItemText}>💫{'\n'}Inspired Souls</Text></LinearGradient>
                            </Pressable>
                        </View>
                    </View>
                </AnimatedSection>

                <AnimatedSection delay={600}>
                    <LinearGradient colors={['#2c3e50', '#34495e']} style={styles.contactSection}>
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

            {/* --- NEW & IMPROVED FOOTER --- */}
            <LinearGradient colors={['#E0F7FA', '#B2EBF2']} style={styles.footer}>
                <Text style={styles.footerTitle}>© 2025 Vivekananda Educational Centre</Text>
                <Text style={styles.footerText}>Income Tax Exemption under 80G</Text>
                <Text style={styles.footerText}>DIT(E)80G/17/(07)/(09)-10 | PAN: AAGFV4558E</Text>
            </LinearGradient>
        </ScrollView>
    );
};

// --- STYLES (with enhancements) ---
const styles = StyleSheet.create({
    scrollViewContainer: { flex: 1, backgroundColor: '#f0f8ff' },
    container: { paddingBottom: 0 },
    newHeader: { backgroundColor: "#e0f2f7", paddingTop: 40, paddingBottom: 20, alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderBottomColor: "#b2ebf2" },
    newHeaderLogo: { width: 300, height: 160, marginBottom: -20, marginTop: -40, },
    newHeaderSchoolName: { fontSize: 22, fontWeight: "bold", color: "#008080", textAlign: 'center' },
    newHeaderSchoolSubName: { fontSize: 14, fontWeight: "300", color: "#008080", textAlign: 'center', marginTop: 2 },
    newHeaderTagline: { fontSize: 15, fontStyle: 'italic', color: '#558b8b', marginTop: 5, textAlign: 'center' },
    quoteBanner: { paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
    quoteBannerText: { color: 'white', fontStyle: 'italic', fontSize: 16, fontWeight: '500', textAlign: 'center' },
    content: { padding: 20 },
    managementSection: { backgroundColor: 'white', borderRadius: 15, padding: 25, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 25, elevation: 5, position: 'relative', overflow: 'hidden' },
    managementSectionTopBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
    committeeRoleGroup: { marginBottom: 15 },
    committeeRoleTitle: { fontSize: 16, fontWeight: 'bold', color: '#4a4a4a', marginBottom: 5 },
    committeeMemberName: { fontSize: 15, color: '#555', lineHeight: 22, marginLeft: 10 },
    missionSection: { backgroundColor: 'white', borderRadius: 15, padding: 25, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 25, elevation: 5, position: 'relative', overflow: 'hidden' },
    missionSectionTopBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
    sectionTitleContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    sectionTitleEmoji: { marginRight: 10, fontSize: 20 },
    sectionTitle: { color: '#667eea', fontSize: 20, fontWeight: 'bold' },
    missionText: { color: '#555', fontSize: 15, lineHeight: 25 },
    serviceList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginVertical: 10 },
    serviceListSmallScreen: { flexDirection: 'column', alignItems: 'stretch' },
    serviceItem: { backgroundColor: '#667eea', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', width: isSmallScreen ? '100%' : '48%', marginBottom: 10, shadowColor: 'rgba(102, 126, 234, 0.3)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.8, shadowRadius: 10, elevation: 3 },
    serviceItemText: { color: 'white', fontSize: 14, fontWeight: '500', textAlign: 'center' },
    serviceItemPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
    ctaSection: { borderRadius: 15, paddingHorizontal: 20, paddingVertical: 25, alignItems: 'center', marginVertical: 20 },
    ctaTitle: { fontSize: 18, fontWeight: 'bold', color: 'white', marginBottom: 15, textAlign: 'center' },
    ctaText: { fontSize: 14, color: 'white', lineHeight: 22, marginBottom: 20, textAlign: 'center' },
    ctaServiceListContainer: { width: '100%' },
    ctaServiceItem: { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', width: '48%', marginBottom: 10, minHeight: 50 },
    ctaServiceItemText: { color: 'white', fontSize: 13, fontWeight: '500', textAlign: 'center' },
    galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 15 },
    galleryPressable: { width: '48%', marginBottom: 10 }, // Style for the Pressable wrapper
    galleryItem: { width: '100%', height: 120, borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 8 },
    galleryItemText: { color: 'white', fontSize: 14, fontWeight: '600', textAlign: 'center' },
    contactSection: { borderRadius: 15, padding: 25, marginTop: 20, },
    contactTitle: { fontSize: 20, fontWeight: 'bold', color: 'white', marginBottom: 20, textAlign: 'center' },
    contactInfo: {},
    contactItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingVertical: 8 },
    contactIcon: { width: 25, textAlign: 'center', marginRight: 12, color: '#76c7f7', fontSize: 18 },
    contactItemText: { color: 'white', fontSize: 14, flexShrink: 1 },
    contactItemTextUnderline: { textDecorationLine: 'underline' },
    // --- NEW FOOTER STYLES ---
    footer: {
        paddingVertical: 25,
        paddingHorizontal: 20,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#B2EBF2'
    },
    footerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#005662',
        marginBottom: 10,
    },
    footerText: {
        color: '#005662',
        textAlign: 'center',
        fontSize: 12,
        lineHeight: 18,
    },
});

export default AboutUs;