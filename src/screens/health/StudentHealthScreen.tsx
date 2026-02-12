// 📂 File: src/screens/health/StudentHealthScreen.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, 
    useColorScheme, StatusBar 
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

interface HealthData {
  full_name: string;
  blood_group?: string;
  height_cm?: number;
  weight_kg?: number;
  last_checkup_date?: string;
  allergies?: string;
  medical_conditions?: string;
  medications?: string;
}

// --- THEME CONFIGURATION ---
const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#333333',
    textSub: '#555555',
    border: '#CFD8DC',
    iconBg: '#E0F2F1',
    infoBoxBg: '#f8f9fa',
    shadow: '#000'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    iconBg: '#333333',
    infoBoxBg: '#2C2C2C',
    shadow: '#000'
};

// --- REUSABLE HEADER ---
const ScreenHeader = ({ icon, title, subtitle, colors }) => (
  <View style={[styles.headerCard, { backgroundColor: colors.cardBg, shadowColor: colors.shadow }]}>
    <View style={styles.headerContent}>
      <View style={[styles.headerIconContainer, { backgroundColor: colors.iconBg }]}>
        <MaterialIcons name={icon} size={28} color={colors.primary} />
      </View>
      <View style={styles.headerTextContainer}>
        <Text style={[styles.headerTitle, { color: colors.textMain }]}>{title}</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSub }]}>{subtitle}</Text>
      </View>
    </View>
  </View>
);

const StudentHealthScreen = () => {
  // Theme Hook
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const COLORS = isDark ? DarkColors : LightColors;

  const { user, isLoading: isAuthLoading } = useAuth();
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(true);

  useEffect(() => {
    const fetchHealthRecord = async () => {
      if (!isAuthLoading && user) {
        setIsHealthLoading(true);
        try {
          const response = await apiClient.get(`/health/my-record/${user.id}`);
          setHealthData(response.data);
        } catch (error: any) {
          Alert.alert("Error", error.response?.data?.message || "Could not load your health record.");
          setHealthData(null);
        } finally {
          setIsHealthLoading(false);
        }
      } else if (!isAuthLoading && !user) {
        setIsHealthLoading(false);
        setHealthData(null);
      }
    };
    fetchHealthRecord();
  }, [user, isAuthLoading]);

  const calculatedBmi = useMemo(() => {
    if (healthData?.height_cm && healthData?.weight_kg) {
      const heightM = healthData.height_cm / 100;
      const bmi = healthData.weight_kg / (heightM * heightM);
      return bmi.toFixed(2);
    }
    return 'N/A';
  }, [healthData]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not Set';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  if (isAuthLoading || isHealthLoading) {
    return <View style={[styles.centered, { backgroundColor: COLORS.background }]}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }
  
  if (!healthData) {
      return (
        <View style={[styles.fullScreenContainer, { backgroundColor: COLORS.background }]}>
            <ScreenHeader 
              icon="favorite"
              title="My Health Record"
              subtitle="Your personal health information"
              colors={COLORS}
            />
            <View style={styles.centered}>
              <Text style={[styles.errorText, { color: COLORS.textSub }]}>Your health record has not been updated yet.</Text>
            </View>
        </View>
      );
  }

  return (
    <View style={[styles.fullScreenContainer, { backgroundColor: COLORS.background }]}>
       <StatusBar backgroundColor={COLORS.background} barStyle={isDark ? 'light-content' : 'dark-content'} />
       <ScreenHeader 
          icon="favorite"
          title="My Health Record"
          subtitle="Your personal health information"
          colors={COLORS}
        />
      <ScrollView style={styles.scrollContainer}>
        <View style={[styles.card, { backgroundColor: COLORS.cardBg }]}>
          <View style={styles.grid}>
            <InfoBox icon="opacity" label="Blood Group" value={healthData?.blood_group || 'N/A'} color="#e53935" colors={COLORS} />
            <InfoBox icon="height" label="Height" value={healthData?.height_cm ? `${healthData.height_cm} cm` : 'N/A'} color="#1e88e5" colors={COLORS} />
            <InfoBox icon="monitor-weight" label="Weight" value={healthData?.weight_kg ? `${healthData.weight_kg} kg` : 'N/A'} color="#fdd835" colors={COLORS} />
            <InfoBox icon="calculate" label="BMI" value={calculatedBmi} color="#43a047" colors={COLORS} />
          </View>
          <InfoBox icon="event" label="Last Checkup" value={formatDate(healthData?.last_checkup_date)} color="#8e24aa" isFullWidth colors={COLORS} />
        </View>
        
        <Section title="Allergies" icon="warning" content={healthData?.allergies || 'None reported'} colors={COLORS} />
        <Section title="Medical Conditions" icon="local-hospital" content={healthData?.medical_conditions || 'None reported'} colors={COLORS} />
        <Section title="Medications" icon="healing" content={healthData?.medications || 'None'} colors={COLORS} />
      </ScrollView>
    </View>
  );
};

const InfoBox = ({ icon, label, value, color, isFullWidth = false, colors }) => (
  <View style={[styles.infoBox, isFullWidth && styles.fullWidth, { backgroundColor: colors.infoBoxBg }]}>
    <MaterialIcons name={icon} size={28} color={color} />
    <Text style={[styles.infoLabel, { color: colors.textSub }]}>{label}</Text>
    <Text style={[styles.infoValue, { color: colors.textMain }]}>{value}</Text>
  </View>
);

const Section = ({ title, icon, content, colors }) => (
  <View style={[styles.sectionCard, { backgroundColor: colors.cardBg }]}>
    <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
      <MaterialIcons name={icon} size={22} color={colors.primary} />
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>{title}</Text>
    </View>
    <Text style={[styles.sectionContent, { color: colors.textSub }]}>{content}</Text>
  </View>
);

const styles = StyleSheet.create({
  fullScreenContainer: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, textAlign: 'center' },
  scrollContainer: { flex: 1, padding: 10 },
  // Header Styles
  headerCard: { padding: 15, margin: 10, borderRadius: 10, elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5 },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  headerIconContainer: { borderRadius: 25, width: 50, height: 50, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 14, marginTop: 2 },
  // Card Styles
  card: { borderRadius: 10, padding: 10, marginBottom: 15, elevation: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  infoBox: { width: '48%', borderRadius: 8, padding: 15, alignItems: 'center', marginBottom: 10 },
  fullWidth: { width: '100%' },
  infoLabel: { fontSize: 13, marginTop: 5 },
  infoValue: { fontSize: 16, fontWeight: 'bold', marginTop: 2 },
  sectionCard: { borderRadius: 10, padding: 15, marginBottom: 15, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, paddingBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  sectionContent: { fontSize: 14, lineHeight: 20 },
});

export default StudentHealthScreen;