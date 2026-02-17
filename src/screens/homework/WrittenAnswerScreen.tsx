import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  useColorScheme,
  StatusBar,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const LightColors = {
  primary: '#008080',
  background: '#F5F7FA',
  cardBg: '#FFFFFF',
  textMain: '#263238',
  textSub: '#546E7A',
  border: '#CFD8DC',
  inputBg: '#FAFAFA',
  success: '#43A047',
  headerIconBg: '#E0F2F1',
  placeholder: '#B0BEC5'
};

const DarkColors = {
  primary: '#008080',
  background: '#121212',
  cardBg: '#1E1E1E',
  textMain: '#E0E0E0',
  textSub: '#B0B0B0',
  border: '#333333',
  inputBg: '#2C2C2C',
  success: '#66BB6A',
  headerIconBg: '#333333',
  placeholder: '#616161'
};

const WrittenAnswerScreen = ({ route }) => {
  const { assignment } = route.params;
  const { user } = useAuth();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const COLORS = isDark ? DarkColors : LightColors;

  const [answer, setAnswer] = useState(assignment.written_answer || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- PARSE QUESTIONS ---
  let questionsList = [];
  try {
      if (assignment.questions) {
          const parsed = JSON.parse(assignment.questions);
          if (Array.isArray(parsed)) questionsList = parsed;
      }
  } catch (e) {}

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit.');
      return;
    }
    if (!answer.trim()) {
      Alert.alert('Validation Error', 'Your answer cannot be empty.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await apiClient.post('/homework/submit-written', {
        assignment_id: assignment.id,
        student_id: user.id,
        written_answer: answer,
      });

      Alert.alert('Success', 'Your answer has been submitted!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      if (err.response && typeof err.response.data === 'string' && err.response.data.includes('<!DOCTYPE html>')) {
          Alert.alert("Connection Error", "The app cannot reach the homework server. Please check your internet or try again later.");
      } else {
          Alert.alert('Error', err.response?.data?.message || 'Failed to submit your answer.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
      
      {/* Header Card */}
      <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
        <View style={styles.headerContentWrapper}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10, padding: 4}}>
                <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
            </TouchableOpacity>
            <View style={[styles.headerIconContainer, { backgroundColor: COLORS.headerIconBg }]}>
                 <MaterialIcons name="edit" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: COLORS.textMain }]} numberOfLines={1}>{assignment.title}</Text>
                <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>
                    {assignment.subject} | Due: {formatDate(assignment.due_date)}
                </Text>
            </View>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={{flex: 1}} 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
      >
        <ScrollView contentContainerStyle={styles.container}>
            <View style={[styles.questionBox, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
            <Text style={[styles.questionHeader, { color: COLORS.textMain, borderBottomColor: COLORS.border }]}>Instructions & Questions</Text>
            
            {/* --- DISPLAY DESCRIPTION --- */}
            {assignment.description ? <Text style={[styles.description, { color: COLORS.textMain, marginBottom: 15, fontStyle: 'italic' }]}>{assignment.description}</Text> : null}

            {/* --- DISPLAY QUESTIONS --- */}
            {questionsList.length > 0 && (
                    <View>
                        <Text style={{fontWeight: 'bold', color: COLORS.textMain, marginBottom: 8}}>Questions:</Text>
                        {questionsList.map((q, i) => (
                            <View key={i} style={{flexDirection: 'row', marginBottom: 8}}>
                                <Text style={{color: COLORS.primary, marginRight: 8, fontWeight: 'bold'}}>{i+1}.</Text>
                                <Text style={{color: COLORS.textMain, flex: 1, lineHeight: 20}}>{q}</Text>
                            </View>
                        ))}
                    </View>
            )}

            </View>

            <View style={[styles.answerBox, { backgroundColor: COLORS.cardBg, shadowColor: COLORS.border }]}>
            <Text style={[styles.answerHeader, { color: COLORS.textMain }]}>Your Answer</Text>
            <TextInput
                style={[styles.textInput, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]}
                multiline
                placeholder="Start typing your answer here..."
                placeholderTextColor={COLORS.placeholder}
                value={answer}
                onChangeText={setAnswer}
                editable={!isSubmitting}
            />
            </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { backgroundColor: COLORS.background, borderTopColor: COLORS.border }]}>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: COLORS.success, opacity: isSubmitting ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="send" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Final Answer</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
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
  headerContentWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerIconContainer: { borderRadius: 30, width: 45, height: 45, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTextContainer: { justifyContent: 'center', flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 12, marginTop: 1 },
  container: {
    padding: 15,
    paddingBottom: 100, 
  },
  questionBox: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }
  },
  questionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    borderBottomWidth: 1,
    paddingBottom: 5,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  answerBox: {
    borderRadius: 12,
    elevation: 2,
    padding: 15,
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }
  },
  answerHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  textInput: {
    minHeight: 250,
    textAlignVertical: 'top',
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    borderTopWidth: 1,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    elevation: 2,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});

export default WrittenAnswerScreen;