import React, { useState, useCallback, useMemo, useLayoutEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Image, RefreshControl, SafeAreaView, Platform, UIManager,
  TextInput, useColorScheme, StatusBar, Dimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons'; 
import apiClient from '../api/client';
import { SERVER_URL } from '../../apiConfig';

// Enable Layout Animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION (Master Style Guide) ---
const LightColors = {
  primary: '#008080',
  background: '#F5F7FA',
  cardBg: '#FFFFFF',
  textMain: '#263238',
  textSub: '#546E7A',
  border: '#CFD8DC',
  inputBg: '#FAFAFA',
  placeholder: '#B0BEC5',
  iconGrey: '#90A4AE',
  shadow: '#000'
};

const DarkColors = {
  primary: '#008080',
  background: '#121212',
  cardBg: '#1E1E1E',
  textMain: '#E0E0E0',
  textSub: '#B0B0B0',
  border: '#333333',
  inputBg: '#2C2C2C',
  placeholder: '#616161',
  iconGrey: '#757575',
  shadow: '#000'
};

const CLASS_ORDER = ['LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];

const StudentListScreen = ({ navigation }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const COLORS = isDark ? DarkColors : LightColors;

  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('Class 10');
  const [searchText, setSearchText] = useState(''); // Search State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Hide default header
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const loadStudentData = async () => {
    try {
      const response = await apiClient.get('/students/all');
      setStudents(response.data || []);
    } catch (error) {
      console.error('Error fetching student list:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (students.length === 0) {
        setLoading(true);
      }
      loadStudentData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadStudentData();
  };

  // Grouping and Sorting Logic
  const groupedStudents = useMemo(() => {
    const groups = {};
    students.forEach(student => {
      const groupName = student.class_group;
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(student);
    });

    for (const groupName in groups) {
      groups[groupName].sort((a, b) => {
        const rollA = parseInt(a.roll_no, 10) || 9999;
        const rollB = parseInt(b.roll_no, 10) || 9999;
        return rollA - rollB;
      });
    }
    return groups;
  }, [students]);

  // Filtering Logic (Class + Search)
  const filteredStudents = useMemo(() => {
    const classStudents = groupedStudents[selectedClass] || [];
    if (!searchText) return classStudents;

    const lowerSearch = searchText.toLowerCase();
    return classStudents.filter(student => 
      (student.full_name && student.full_name.toLowerCase().includes(lowerSearch)) ||
      (student.roll_no && String(student.roll_no).includes(lowerSearch))
    );
  }, [groupedStudents, selectedClass, searchText]);

  // Student Item Component
  const StudentMember = ({ item }) => {
    const imageUrl = item.profile_image_url
      ? `${SERVER_URL}${item.profile_image_url.startsWith('/') ? '' : '/'}${item.profile_image_url}`
      : null;

    return (
      <TouchableOpacity
        style={styles.studentMemberContainer}
        onPress={() => navigation.navigate('StudentDetail', { studentId: item.id })}
      >
        <View style={[styles.avatarContainer, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.shadow }]}>
          <Image
            source={imageUrl ? { uri: imageUrl } : require('../assets/default_avatar.png')}
            style={[styles.avatar, { backgroundColor: COLORS.inputBg }]}
          />
        </View>
        <Text style={[styles.studentName, { color: COLORS.textMain }]} numberOfLines={2}>
          {item.full_name}
        </Text>
        {item.roll_no ? (
          <Text style={[styles.rollNumber, { color: COLORS.primary }]}>
            Roll: {item.roll_no}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />

      {/* 1. Header Card */}
      <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.shadow }]}>
        <View style={[styles.headerIconContainer, { backgroundColor: isDark ? '#333' : '#E0F2F1' }]}>
          <Icon name="groups" size={24} color={COLORS.primary} />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Student Directory</Text>
          <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>View profiles by class</Text>
        </View>
      </View>

      {/* 2. Controls Container (Search + Filter) */}
      <View style={styles.controlsContainer}>
        
        {/* Search Bar */}
        <View style={[styles.searchWrapper, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
          <Icon name="search" size={20} color={COLORS.textSub} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: COLORS.textMain }]}
            placeholder="Search Name or Roll No..."
            placeholderTextColor={COLORS.placeholder}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Icon name="close" size={20} color={COLORS.textSub} />
            </TouchableOpacity>
          )}
        </View>

        {/* Class Picker */}
        <View style={[styles.pickerCard, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
          <Icon name="class" size={20} color={COLORS.primary} style={{ marginLeft: 10 }} />
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedClass}
              onValueChange={(itemValue) => setSelectedClass(itemValue)}
              style={[styles.picker, { color: COLORS.textMain }]}
              dropdownIconColor={COLORS.primary}
              mode="dropdown"
            >
              {CLASS_ORDER.map(className => (
                <Picker.Item key={className} label={className} value={className} color={COLORS.textMain} />
              ))}
            </Picker>
          </View>
        </View>
      </View>

      {/* 3. Grid Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {filteredStudents.length > 0 ? (
          <View style={styles.studentGrid}>
            {filteredStudents.map(item => (
              <StudentMember key={item.id} item={item} />
            ))}
          </View>
        ) : (
          <View style={styles.noDataContainer}>
            <Icon name="person-off" size={60} color={COLORS.border} />
            <Text style={[styles.noDataText, { color: COLORS.textSub }]}>
              {searchText ? `No results for "${searchText}"` : `No students found in ${selectedClass}`}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // --- Header Card Style ---
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
    elevation: 3,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  headerIconContainer: {
    borderRadius: 30,
    width: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    justifyContent: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },

  // --- Controls (Search & Filter) ---
  controlsContainer: {
    width: '96%',
    alignSelf: 'center',
    marginBottom: 10,
    gap: 10, // Adds space between Search and Picker
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 45,
    borderWidth: 1,
    elevation: 1,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  pickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    height: 45,
    elevation: 1,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
  },
  pickerWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
    height: 50, // Standard height for touch targets
  },

  // --- Content Area ---
  scrollContent: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  studentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  studentMemberContainer: {
    width: '25%', // 4 columns grid
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  avatarContainer: {
    elevation: 3,
    borderRadius: 35,
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    padding: 2, // Slight border effect
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  studentName: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  rollNumber: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
    fontWeight: 'bold',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
    opacity: 0.7,
  },
  noDataText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default StudentListScreen;