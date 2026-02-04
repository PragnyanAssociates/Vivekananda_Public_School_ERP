import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, RefreshControl, Linking, Alert, SafeAreaView, useColorScheme } from 'react-native';
import apiClient from '../../api/client';
import { MeetingCard, Meeting } from './MeetingCard';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

// --- DYNAMIC THEME HELPERS ---
const getTheme = (scheme: string | null | undefined) => {
    const isDark = scheme === 'dark';
    return {
        isDark,
        primary: '#008080',    
        background: isDark ? '#121212' : '#F2F5F8', 
        cardBg: isDark ? '#1E1E1E' : '#FFFFFF',
        textMain: isDark ? '#E0E0E0' : '#263238',
        textSub: isDark ? '#B0BEC5' : '#546E7A',
        border: isDark ? '#424242' : '#CFD8DC'
    };
};

const StudentPTMScreen = () => {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMeetings = useCallback(async () => {
    try {
      setError(null);
      const response = await apiClient.get('/ptm');
      setMeetings(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not fetch meeting schedules.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);
  
  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const onRefresh = () => {
      setIsRefreshing(true);
      fetchMeetings();
  };

  const handleJoinMeeting = (link: string) => {
      if(link) {
          Linking.openURL(link).catch(() => Alert.alert("Error", "Could not open the meeting link."));
      }
  };

  if (isLoading) {
    return <View style={[styles.center, {backgroundColor: theme.background}]}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

  if (error) {
    return <View style={[styles.center, {backgroundColor: theme.background}]}><Text style={[styles.errorText, {color: '#ff5252'}]}>{error}</Text></View>;
  }

  const dynamicStyles = StyleSheet.create({
      headerCard: {
          backgroundColor: theme.cardBg,
          borderColor: theme.border,
          borderWidth: theme.isDark ? 1 : 0
      },
      headerTitle: { color: theme.textMain },
      headerSubtitle: { color: theme.textSub },
      emptyText: { color: theme.textSub }
  });

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.background}]}>
        
        {/* --- HEADER CARD --- */}
        <View style={[styles.headerCard, dynamicStyles.headerCard]}>
            <View style={styles.headerLeft}>
                <View style={styles.headerIconContainer}>
                    <MaterialIcons name="groups" size={24} color={theme.primary} />
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>PTM Schedules</Text>
                    <Text style={[styles.headerSubtitle, dynamicStyles.headerSubtitle]}>Parent-Teacher Meetings</Text>
                </View>
            </View>
        </View>

        <FlatList
            data={meetings}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
                <View style={styles.cardWrapper}>
                    <MeetingCard 
                        meeting={item} 
                        isAdmin={false} 
                        onJoin={handleJoinMeeting}
                    />
                </View>
            )}
            ListEmptyComponent={ 
                <View style={styles.center}>
                    <MaterialIcons name="event-busy" size={50} color={theme.border} />
                    <Text style={[styles.emptyText, dynamicStyles.emptyText]}>No meetings scheduled.</Text>
                </View> 
            }
            refreshControl={ <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary}/> }
            contentContainerStyle={{ paddingBottom: 20 }}
        />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, paddingTop: 50 },
    
    // Header
    headerCard: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '95%', 
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 8,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 3,
        shadowColor: '#000', 
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        backgroundColor: 'rgba(0, 128, 128, 0.1)',
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

    // List
    cardWrapper: {
        width: '95%',
        alignSelf: 'center',
        marginBottom: 8,
    },
    
    emptyText: { textAlign: 'center', fontSize: 16, marginTop: 10 },
    errorText: { fontSize: 16, textAlign: 'center' },
});

export default StudentPTMScreen;