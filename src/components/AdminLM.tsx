import React, { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, LayoutAnimation, UIManager
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import apiClient from '../api/client';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CLASS_CATEGORIES = [ 'Admins', 'Teachers', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10' ];
const USER_ROLES = ['admin', 'teacher', 'student'];

interface User {
  id: number;
  username: string;
  password?: string;
  full_name: string;
  role: 'student' | 'teacher' | 'admin';
  class_group: string;
  subjects_taught?: string[];
  roll_no?: string;
  admission_no?: string;
  parent_name?: string;
  aadhar_no?: string;
  pen_no?: string;
}

const AdminLM = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  // NEW: State to manage the text input for adding a single subject
  const [currentSubjectInput, setCurrentSubjectInput] = useState('');

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/users');
      setUsers(response.data);
    } catch (error: any) {
      Alert.alert('Network Error', error.response?.data?.message || 'Failed to fetch users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const groupedUsers = useMemo(() => {
    const groups: { [key: string]: User[] } = {};
    CLASS_CATEGORIES.forEach(category => {
        if (category === 'Admins') {
             groups[category] = users.filter(user => user.role === 'admin');
        } else {
            groups[category] = users.filter(user => user.class_group === category);
        }
    });
    return groups;
  }, [users]);

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({ 
      username: '', password: '', full_name: '', role: 'student', 
      class_group: 'LKG', subjects_taught: [], roll_no: '',
      admission_no: '', parent_name: '', aadhar_no: '', pen_no: ''
    });
    setIsPasswordVisible(false);
    setCurrentSubjectInput(''); // NEW: Reset subject input
    setIsModalVisible(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({ ...user, subjects_taught: user.subjects_taught || [] });
    setIsPasswordVisible(false);
    setCurrentSubjectInput(''); // NEW: Reset subject input
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.username || !formData.full_name) {
      Alert.alert('Error', 'Username and Full Name are required.');
      return;
    }
    if (!formData.password) {
        Alert.alert('Error', 'Password cannot be empty.');
        return;
    }

    const payload = { ...formData };
    if (payload.role === 'student' || payload.role === 'admin') {
        delete payload.subjects_taught;
    }
    if (payload.role === 'admin') {
        payload.class_group = 'Admins';
    }

    const isEditing = !!editingUser;

    try {
      if (isEditing) {
        await apiClient.put(`/users/${editingUser!.id}`, payload);
      } else {
        await apiClient.post('/users', payload);
      }
      
      Alert.alert('Success', `User ${isEditing ? 'updated' : 'created'} successfully!`);
      setIsModalVisible(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      Alert.alert('Save Failed', error.response?.data?.message || 'An error occurred.');
    }
  };

  const handleDelete = (user: User) => {
     Alert.alert('Confirm Delete', `Are you sure you want to delete "${user.full_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiClient.delete(`/users/${user.id}`);
            Alert.alert('Deleted!', `"${user.full_name}" was removed successfully.`);
            fetchUsers();
          } catch (error: any) { 
            Alert.alert('Error', error.response?.data?.message || 'Failed to delete the user.'); 
          }
      }},
    ]);
  };

  const handleShowPassword = (user: User) => {
    if (user.password) {
        if (user.password.length > 30 && user.password.startsWith('$2b$')) {
             Alert.alert('Old Password', `This is an old, encrypted password. Please edit the user and set a new one to view it here.`);
        } else {
             Alert.alert('User Password', `The password for ${user.full_name} is:\n\n${user.password}`);
        }
    } else {
        Alert.alert('Password Not Found', 'Could not retrieve a password for this user.');
    }
  };

  const handleToggleAccordion = (className: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedClass(expandedClass === className ? null : className);
  };
  
  // NEW: Function to add a subject to the formData state
  const handleAddSubject = () => {
      const subjectToAdd = currentSubjectInput.trim();
      if (subjectToAdd && !formData.subjects_taught?.includes(subjectToAdd)) {
          const updatedSubjects = [...(formData.subjects_taught || []), subjectToAdd];
          setFormData({ ...formData, subjects_taught: updatedSubjects });
          setCurrentSubjectInput(''); // Clear the input field after adding
      }
  };

  // NEW: Function to remove a subject from the formData state
  const handleRemoveSubject = (subjectToRemove: string) => {
      const updatedSubjects = formData.subjects_taught.filter((sub: string) => sub !== subjectToRemove);
      setFormData({ ...formData, subjects_taught: updatedSubjects });
  };


  const renderUserItem = (item: User) => (
    <View style={styles.userRow}>
      <Icon 
        name={ item.role === 'admin' ? 'admin-panel-settings' : item.role === 'teacher' ? 'school' : 'person' } 
        size={24} color="#008080" style={styles.userIcon} 
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.full_name}</Text>
        <Text style={styles.userUsername}>Username: {item.username} {item.roll_no ? `| Roll: ${item.roll_no}` : ''}</Text>
        {item.admission_no && (<Text style={styles.userSubjects}>Admission No: {item.admission_no}</Text>)}
        {item.role === 'teacher' && item.subjects_taught && item.subjects_taught.length > 0 && (
          <Text style={styles.userSubjects}>Subjects: {item.subjects_taught.join(', ')}</Text>
        )}
      </View>
      <TouchableOpacity onPress={() => handleShowPassword(item)} style={styles.actionButton}>
        <Icon name="vpn-key" size={22} color="#F39C12" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionButton}>
        <Icon name="edit" size={24} color="#3498DB" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}>
        <Icon name="delete-outline" size={24} color="#E74C3C" />
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#008080" /></View>;
  }

  const isEditing = !!editingUser;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animatable.View animation="fadeInDown" duration={500}>
        <View style={styles.header}>
            <Text style={styles.headerTitle}>User Management</Text>
            <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
                <Icon name="add" size={20} color="#fff" />
                <Text style={styles.addButtonText}>Add User</Text>
            </TouchableOpacity>
        </View>
      </Animatable.View>

      <ScrollView contentContainerStyle={styles.container}>
        {CLASS_CATEGORIES.map((className, index) => (
          <Animatable.View key={className} animation="fadeInUp" duration={600} delay={index * 100} style={styles.accordionSection}>
            <TouchableOpacity style={styles.accordionHeader} onPress={() => handleToggleAccordion(className)} activeOpacity={0.8}>
              <Text style={styles.accordionTitle}>{className} ({groupedUsers[className]?.length || 0})</Text>
              <Icon name={expandedClass === className ? 'expand-less' : 'expand-more'} size={28} color="#555" />
            </TouchableOpacity>

            {expandedClass === className && (
              <View style={styles.userListContainer}>
                {groupedUsers[className]?.length > 0 ? (
                  groupedUsers[className].map((user) => ( <Animatable.View key={user.id} animation="fadeIn">{renderUserItem(user)}</Animatable.View> ))
                ) : (
                  <Text style={styles.emptySectionText}>No users in this section.</Text>
                )}
              </View>
            )}
          </Animatable.View>
        ))}
      </ScrollView>

      <Modal animationType="fade" transparent={true} visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <Animatable.View animation="zoomIn" duration={400} style={styles.modalContainer}>
                <ScrollView contentContainerStyle={styles.modalContent}>
                    <Text style={styles.modalTitle}>{isEditing ? 'Edit User' : 'Add New User'}</Text>
                    <View style={styles.modalTitleSeparator} />
                    
                    <Text style={styles.inputLabel}>Username</Text>
                    <TextInput style={styles.input} placeholder="e.g., john.doe, STU101" value={formData.username} onChangeText={(val) => setFormData({ ...formData, username: val })} autoCapitalize="none" />
                    
                    <Text style={styles.inputLabel}>Password</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput 
                        style={styles.passwordInput} 
                        placeholder="Enter user password" 
                        value={formData.password} 
                        onChangeText={(val) => setFormData({ ...formData, password: val })} 
                        secureTextEntry={!isPasswordVisible} 
                      />
                      <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)} style={styles.eyeIcon}>
                        <Icon name={isPasswordVisible ? 'visibility' : 'visibility-off'} size={22} color="#7F8C8D" />
                      </TouchableOpacity>
                    </View>
                    
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <TextInput style={styles.input} placeholder="Enter user's full name" value={formData.full_name} onChangeText={(val) => setFormData({ ...formData, full_name: val })} />
                    
                    <Text style={styles.inputLabel}>Role</Text>
                    <View style={styles.pickerWrapper}>
                        <Picker selectedValue={formData.role} onValueChange={(val) => {
                                const newClassGroup = val === 'teacher' ? 'Teachers' : (val === 'admin' ? 'Admins' : formData.class_group || 'LKG');
                                setFormData({ ...formData, role: val, class_group: newClassGroup });
                            }} style={styles.modalPicker}>
                            {USER_ROLES.map((role) => (<Picker.Item key={role} label={role.charAt(0).toUpperCase() + role.slice(1)} value={role} />))}
                        </Picker>
                    </View>
                    
                    {/* MODIFIED: Complete overhaul of the teacher subjects input section */}
                    {formData.role === 'teacher' ? (
                        <>
                            <Text style={styles.inputLabel}>Subjects Taught</Text>
                            <View style={styles.subjectInputContainer}>
                                <TextInput
                                    style={styles.subjectInput}
                                    placeholder="e.g., English"
                                    value={currentSubjectInput}
                                    onChangeText={setCurrentSubjectInput}
                                    onSubmitEditing={handleAddSubject} // Allows adding by pressing 'enter' on keyboard
                                />
                                <TouchableOpacity style={styles.subjectAddButton} onPress={handleAddSubject}>
                                    <Text style={styles.subjectAddButtonText}>Add</Text>
                                </TouchableOpacity>
                            </View>
                            
                            <View style={styles.subjectTagContainer}>
                                {formData.subjects_taught?.map((subject: string, index: number) => (
                                    <Animatable.View animation="fadeIn" duration={300} key={index} style={styles.subjectTag}>
                                        <Text style={styles.subjectTagText}>{subject}</Text>
                                        <TouchableOpacity onPress={() => handleRemoveSubject(subject)} style={styles.removeTagButton}>
                                            <Icon name="close" size={16} color="#fff" />
                                        </TouchableOpacity>
                                    </Animatable.View>
                                ))}
                            </View>
                        </>
                    ) : formData.role === 'student' ? (
                        <>
                          <Text style={styles.inputLabel}>Class / Group</Text>
                          <View style={styles.pickerWrapper}>
                              <Picker selectedValue={formData.class_group} onValueChange={(val) => setFormData({ ...formData, class_group: val })} style={styles.modalPicker}>
                              {CLASS_CATEGORIES.filter(c => c !== 'Teachers' && c !== 'Admins').map((level) => ( <Picker.Item key={level} label={level} value={level} /> ))}
                              </Picker>
                          </View>
                          
                          <Text style={styles.inputLabel}>Roll No.</Text>
                          <TextInput style={styles.input} placeholder="Enter class roll number" value={formData.roll_no} onChangeText={(val) => setFormData({ ...formData, roll_no: val })} keyboardType="numeric" />

                          <Text style={styles.inputLabel}>Admission No.</Text>
                          <TextInput style={styles.input} placeholder="Enter admission number" value={formData.admission_no} onChangeText={(val) => setFormData({ ...formData, admission_no: val })} />

                          <Text style={styles.inputLabel}>Parent Name</Text>
                          <TextInput style={styles.input} placeholder="Enter parent's full name" value={formData.parent_name} onChangeText={(val) => setFormData({ ...formData, parent_name: val })} />
                          
                          <Text style={styles.inputLabel}>Aadhar No.</Text>
                          <TextInput style={styles.input} placeholder="Enter 12-digit Aadhar number" value={formData.aadhar_no} onChangeText={(val) => setFormData({ ...formData, aadhar_no: val })} keyboardType="numeric" maxLength={12} />

                          <Text style={styles.inputLabel}>PEN No.</Text>
                          <TextInput style={styles.input} placeholder="Enter PEN number" value={formData.pen_no} onChangeText={(val) => setFormData({ ...formData, pen_no: val })} />
                        </>
                    ) : null}
                    
                    <View style={styles.modalButtonContainer}>
                        <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsModalVisible(false)}>
                        <Text style={styles.modalButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.submitButton]} onPress={handleSave}>
                        <Text style={styles.modalButtonText}>{isEditing ? 'Save Changes' : 'Add User'}</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </Animatable.View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

// MODIFIED: Added new styles for the subject tag input system
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F9FC' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, 
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2,
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#008080' },
  addButton: { 
    flexDirection: 'row', backgroundColor: '#27AE60', paddingVertical: 10, paddingHorizontal: 14, 
    borderRadius: 20, alignItems: 'center', elevation: 2,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginLeft: 5 },
  container: { padding: 10 },
  accordionSection: { 
    backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 12, overflow: 'hidden', 
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3,
  },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 15 },
  accordionTitle: { fontSize: 18, fontWeight: '600', color: '#2C3E50' },
  userListContainer: { borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  userRow: { 
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 15, 
    borderBottomWidth: 1, borderBottomColor: '#ECEFF1', 
  },
  userIcon: { marginRight: 15 },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '500', color: '#2C3E50' },
  userUsername: { fontSize: 14, color: '#7F8C8D', marginTop: 2 },
  userSubjects: { fontSize: 13, color: '#008080', fontStyle: 'italic', marginTop: 4 },
  actionButton: { padding: 8 },
  emptySectionText: { textAlign: 'center', padding: 20, color: '#95A5A6', fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: {
    width: '90%', maxHeight: '85%', backgroundColor: '#FFFFFF', borderRadius: 20,
    elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, overflow: 'hidden',
  },
  modalContent: { padding: 25 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#2C3E50', textAlign: 'center' },
  modalTitleSeparator: {
    height: 3, width: 40, backgroundColor: '#008080', borderRadius: 2,
    alignSelf: 'center', marginTop: 8, marginBottom: 25,
  },
  inputLabel: { fontSize: 16, color: '#34495E', marginBottom: 8, fontWeight: '500' },
  input: { 
    backgroundColor: '#F7F9FC', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12,
    fontSize: 16, color: '#2C3E50', borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 20,
  },
  passwordContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F9FC',
    borderRadius: 10, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 20,
  },
  passwordInput: {
    flex: 1, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, color: '#2C3E50',
  },
  eyeIcon: {
    padding: 10,
  },
  pickerWrapper: {
    backgroundColor: '#F7F9FC', borderRadius: 10, borderWidth: 1,
    borderColor: '#E0E0E0', justifyContent: 'center', marginBottom: 20,
  },
  modalPicker: { height: 50, width: '100%', color: '#2C3E50' },
  modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', elevation: 2 },
  cancelButton: { backgroundColor: '#95A5A6', marginRight: 10 },
  submitButton: { backgroundColor: '#27AE60', marginLeft: 10 },
  modalButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  
  // NEW STYLES: For the subject input and tags
  subjectInputContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  subjectInput: {
    flex: 1,
    backgroundColor: '#F7F9FC',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2C3E50',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  subjectAddButton: {
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#008080',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  subjectAddButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  subjectTagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  subjectTag: {
    flexDirection: 'row',
    backgroundColor: '#3498DB',
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  subjectTagText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginRight: 8,
  },
  removeTagButton: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    padding: 2,
  },
});

export default AdminLM;