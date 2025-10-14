// 📂 File: WrittenAnswerScreen.js (NO CHANGES, VERIFIED)

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
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { useNavigation } from '@react-navigation/native';

const WrittenAnswerScreen = ({ route }) => {
  const { assignment } = route.params;
  const { user } = useAuth();
  const navigation = useNavigation();

  const [answer, setAnswer] = useState(assignment.written_answer || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to submit your answer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{assignment.title}</Text>
          <Text style={styles.subject}>
            {assignment.subject} | Due: {new Date(assignment.due_date).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.questionBox}>
          <Text style={styles.questionHeader}>Questions / Instructions</Text>
          <Text style={styles.description}>{assignment.description || 'No specific instructions provided.'}</Text>
        </View>

        <View style={styles.answerBox}>
          <Text style={styles.answerHeader}>Your Answer</Text>
          <TextInput
            style={styles.textInput}
            multiline
            placeholder="Start typing your answer here..."
            placeholderTextColor="#999"
            value={answer}
            onChangeText={setAnswer}
            editable={!isSubmitting}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
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
    backgroundColor: '#f4f6f8',
  },
  container: {
    padding: 15,
    paddingBottom: 100, // Space for the floating button
  },
  header: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderLeftWidth: 5,
    borderLeftColor: '#FF7043',
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#263238',
  },
  subject: {
    fontSize: 14,
    color: '#546e7a',
    marginTop: 5,
  },
  questionBox: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
  },
  questionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#37474f',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 5,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },
  answerBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    padding: 15,
  },
  answerHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#37474f',
    marginBottom: 10,
  },
  textInput: {
    minHeight: 250,
    textAlignVertical: 'top',
    fontSize: 16,
    color: '#212121',
    lineHeight: 24,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fdfdfd',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    backgroundColor: '#f4f6f8',
    borderTopWidth: 1,
    borderColor: '#e0e0e0',
  },
  submitButton: {
    backgroundColor: '#28a745',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 8,
    elevation: 2,
  },
  submitButtonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});

export default WrittenAnswerScreen;