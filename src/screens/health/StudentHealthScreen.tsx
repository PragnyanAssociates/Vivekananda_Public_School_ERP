// 📂 File: src/screens/health/StudentHealthScreen.tsx (UPDATED)

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
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

const PRIMARY_COLOR = '#008080';
const TEXT_COLOR_DARK = '#333';
const TEXT_COLOR_MEDIUM = '#555';
const BACKGROUND_COLOR = '#f0f4f7';

// ★★★ NEW REUSABLE COMPONENT ★★★
const ScreenHeader = ({ icon, title, subtitle }) => (
  <View style={styles.headerCard}>
    <View style={styles.headerContent}>
      <View style={styles.headerIconContainer}>
        <MaterialIcons name={icon} size={28} color={PRIMARY_COLOR} />
      </View>
      <View style={styles.headerTextContainer}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>
    </View>
  </View>
);


const StudentHealthScreen = () => {
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
    return <View style={styles.centered}><ActivityIndicator size="large" color={PRIMARY_COLOR} /></View>;
  }
  
  if (!healthData) {
      return (
        <View style={styles.fullScreenContainer}>
            <ScreenHeader 
              icon="favorite"
              title="My Health Record"
              subtitle="Your personal health information"
            />
            <View style={styles.centered}>
              <Text style={styles.errorText}>Your health record has not been updated yet.</Text>
            </View>
        </View>
      );
  }

  return (
    <View style={styles.fullScreenContainer}>
       <ScreenHeader 
          icon="favorite"
          title="My Health Record"
          subtitle="Your personal health information"
        />
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.card}>
          <View style={styles.grid}>
            <InfoBox icon="opacity" label="Blood Group" value={healthData?.blood_group || 'N/A'} color="#e53935" />
            <InfoBox icon="height" label="Height" value={healthData?.height_cm ? `${healthData.height_cm} cm` : 'N/A'} color="#1e88e5" />
            <InfoBox icon="monitor-weight" label="Weight" value={healthData?.weight_kg ? `${healthData.weight_kg} kg` : 'N/A'} color="#fdd835" />
            <InfoBox icon="calculate" label="BMI" value={calculatedBmi} color="#43a047" />
          </View>
          <InfoBox icon="event" label="Last Checkup" value={formatDate(healthData?.last_checkup_date)} color="#8e24aa" isFullWidth />
        </View>
        
        <Section title="Allergies" icon="warning" content={healthData?.allergies || 'None reported'} />
        <Section title="Medical Conditions" icon="local-hospital" content={healthData?.medical_conditions || 'None reported'} />
        <Section title="Medications" icon="healing" content={healthData?.medications || 'None'} />
      </ScrollView>
    </View>
  );
};

const InfoBox = ({ icon, label, value, color, isFullWidth = false }) => (
  <View style={[styles.infoBox, isFullWidth && styles.fullWidth]}>
    <MaterialIcons name={icon} size={28} color={color} />
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const Section = ({ title, icon, content }) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
      <MaterialIcons name={icon} size={22} color={PRIMARY_COLOR} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    <Text style={styles.sectionContent}>{content}</Text>
  </View>
);

const styles = StyleSheet.create({
  fullScreenContainer: { flex: 1, backgroundColor: BACKGROUND_COLOR },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: TEXT_COLOR_MEDIUM, textAlign: 'center' },
  scrollContainer: { flex: 1, padding: 10, },
  // Header Styles
  headerCard: { backgroundColor: '#fff', padding: 15, margin: 10, borderRadius: 10, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  headerIconContainer: { backgroundColor: '#e0f2f1', borderRadius: 25, width: 50, height: 50, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: TEXT_COLOR_DARK },
  headerSubtitle: { fontSize: 14, color: TEXT_COLOR_MEDIUM, marginTop: 2 },
  // Card Styles
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 15, elevation: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  infoBox: { width: '48%', backgroundColor: '#f8f9fa', borderRadius: 8, padding: 15, alignItems: 'center', marginBottom: 10 },
  fullWidth: { width: '100%' },
  infoLabel: { fontSize: 13, color: TEXT_COLOR_MEDIUM, marginTop: 5 },
  infoValue: { fontSize: 16, fontWeight: 'bold', color: TEXT_COLOR_DARK, marginTop: 2 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 15, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: PRIMARY_COLOR, marginLeft: 10 },
  sectionContent: { fontSize: 14, color: TEXT_COLOR_MEDIUM, lineHeight: 20 },
});

export default StudentHealthScreen;