import React, { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  LayoutAnimation, UIManager, Dimensions
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import apiClient from '../api/client';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

const CLASS_CATEGORIES = [ 'Admins', 'Teachers', 'Others', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10' ];

const DISPLAY_USER_ROLES = [
  { label: 'Management Admin', value: 'Management Admin' },
  { label: 'General Admin', value: 'General Admin' },
  { label: 'Teacher', value: 'teacher' },
  { label: 'Student', value: 'student' },
  { label: 'Others', value: 'others' },
];

interface User {
  id: number;
  username: string;
  password?: string;
  full_name: string;
  role: 'student' | 'teacher' | 'admin' | 'others';
  class_group: string;
  subjects_taught?: string[];
  roll_no?: string;
  admission_no?: string;
  parent_name?: string;
  pen_no?: string;
  admission_date?: string;
  aadhar_no?: string;
  joining_date?: string;
  previous_salary?: string;
  present_salary?: string;
  experience?: string;
}

const AdminLM = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [currentSubjectInput, setCurrentSubjectInput] = useState('');
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');

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
    // 1. Filter logic
    const query = searchQuery.toLowerCase().trim();
    const filteredUsers = users.filter(user => {
        if (!query) return true;
        return (
            (user.full_name && user.full_name.toLowerCase().includes(query)) ||
            (user.username && user.username.toLowerCase().includes(query)) ||
            (user.roll_no && user.roll_no.toString().toLowerCase().includes(query)) ||
            (user.admission_no && user.admission_no.toLowerCase().includes(query))
        );
    });

    // 2. Group logic
    const groups: { [key: string]: User[] } = {};
    CLASS_CATEGORIES.forEach(category => {
        let categoryUsers: User[] = [];

        if (category === 'Admins') {
             categoryUsers = filteredUsers.filter(user => user.role === 'admin');
        } else if (category === 'Others') {
             categoryUsers = filteredUsers.filter(user => user.role === 'others');
        } else {
            categoryUsers = filteredUsers.filter(user => user.class_group === category);
        }

        // 3. Sorting Logic (Fix for sequential display)
        groups[category] = categoryUsers.sort((a, b) => {
            // If both represent students with roll numbers, sort numerically (1, 2, 10) instead of string (1, 10, 2)
            const rollA = a.roll_no ? parseInt(a.roll_no, 10) : 0;
            const rollB = b.roll_no ? parseInt(b.roll_no, 10) : 0;

            if (rollA > 0 || rollB > 0) {
                return rollA - rollB;
            }

            // Fallback: Sort alphabetically by name (for Teachers/Admins)
            return a.full_name.localeCompare(b.full_name);
        });
    });
    return groups;
  }, [users, searchQuery]);

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      username: '', password: '', full_name: '', role: 'student',
      class_group: 'LKG', subjects_taught: [],
      roll_no: '', admission_no: '', parent_name: '', aadhar_no: '', pen_no: '', admission_date: '',
      joining_date: '', previous_salary: '', present_salary: '', experience: ''
    });
    setIsPasswordVisible(false);
    setCurrentSubjectInput('');
    setIsModalVisible(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    // Initialize formData with the user's existing data INCLUDING PASSWORD
    setFormData({ ...user, subjects_taught: user.subjects_taught || [] }); 
    setIsPasswordVisible(false);
    setCurrentSubjectInput('');
    setIsModalVisible(true);
  };

  // --- VALIDATION & SANITIZATION LOGIC ---
  const validateInput = (key: string, value: string) => {
    let sanitized = value;

    switch (key) {
      // 1. Numeric Only Fields
      case 'roll_no':
      case 'admission_no':
      case 'aadhar_no':
      case 'pen_no':
      case 'previous_salary':
      case 'present_salary':
        sanitized = value.replace(/[^0-9]/g, '');
        break;

      // 2. Alphabetical Only (A-Z, a-z, spaces)
      case 'parent_name':
        sanitized = value.replace(/[^a-zA-Z\s]/g, '');
        break;

      // 3. Full Name (Alpha + spaces, hyphens, apostrophes)
      case 'full_name':
        sanitized = value.replace(/[^a-zA-Z\s\-']/g, '');
        break;
      
      // 4. Username (AlphaNumeric + dots, underscores, hyphens - No emojis)
      case 'username':
        sanitized = value.replace(/[^a-zA-Z0-9._-]/g, '');
        break;

      // 5. General Text (No Emojis, allow basic punctuation)
      case 'experience':
      case 'subjects_taught':
        sanitized = value.replace(/[^\w\s.,\-()]/g, ''); 
        break;

      default:
        // Default blocker for emojis/special chars
        if(key !== 'password' && key !== 'admission_date' && key !== 'joining_date') {
           sanitized = value.replace(/[^\w\s\-@.]/g, ''); 
        }
        break;
    }

    setFormData({ ...formData, [key]: sanitized });
  };

  const getChangedFields = (original: User, current: any) => {
    const changes: any = {};
    
    Object.keys(current).forEach(key => {
        if (key === 'subjects_taught') return;
        if (key === 'password') return; // Handled specifically below
        
        if (original[key as keyof User] != current[key]) {
            changes[key] = current[key];
        }
    });

    // Handle Password: Only add if it is different from the original
    if (current.password && current.password !== original.password) {
        changes.password = current.password;
    }

    if (original.role === 'teacher') {
        const originalSubjects = JSON.stringify(original.subjects_taught || []);
        const currentSubjects = JSON.stringify(current.subjects_taught || []);
        if (originalSubjects !== currentSubjects) {
            changes.subjects_taught = current.subjects_taught;
        }
    }

    return changes;
  };

  const handleSave = async () => {
    if (!formData.username || !formData.full_name) {
      Alert.alert('Error', 'Username and Full Name are required.');
      return;
    }

    if (formData.role === 'student') {
        if(!formData.roll_no || !formData.class_group) {
             Alert.alert('Error', 'Class and Roll Number are mandatory for students.');
             return;
        }
    }
    
    const isEditing = !!editingUser;

    if (!isEditing && !formData.password) {
        Alert.alert('Error', 'Password cannot be empty for new users.');
        return;
    }

    try {
      if (isEditing) {
        const changes = getChangedFields(editingUser!, formData);
        
        if (Object.keys(changes).length === 0) {
            Alert.alert('Info', 'No changes detected.');
            return;
        }

        await apiClient.put(`/users/${editingUser!.id}`, changes);
      } else {
        const payload = { ...formData };
        if (payload.role !== 'teacher') {
            delete payload.subjects_taught;
        }
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

  const handleAddSubject = () => {
      const subjectToAdd = currentSubjectInput.trim();
      if(/[^a-zA-Z0-9\s]/.test(subjectToAdd)) {
           Alert.alert("Invalid Input", "Subject names should not contain special characters.");
           return;
      }

      if (subjectToAdd && !formData.subjects_taught?.includes(subjectToAdd)) {
          const updatedSubjects = [...(formData.subjects_taught || []), subjectToAdd];
          setFormData({ ...formData, subjects_taught: updatedSubjects });
          setCurrentSubjectInput('');
      }
  };

  const handleRemoveSubject = (subjectToRemove: string) => {
      const updatedSubjects = formData.subjects_taught.filter((sub: string) => sub !== subjectToRemove);
      setFormData({ ...formData, subjects_taught: updatedSubjects });
  };

  const renderUserItem = (item: User) => (
    <View style={styles.userRow}>
      <View style={styles.userIconWrapper}>
        <Icon
          name={ item.role === 'admin' ? 'admin-panel-settings' : item.role === 'teacher' ? 'school' : item.role === 'others' ? 'group' : 'person' }
          size={30} color="#008080"
        />
      </View>

      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.full_name.toUpperCase()}</Text>
        <Text style={styles.userSubtitle}>
           Username: {item.username} 
           {item.role === 'admin' ? ` | Type: ${item.class_group}` : ''}
        </Text>

        {item.role === 'teacher' && item.subjects_taught && item.subjects_taught.length > 0 && (
             <Text style={styles.userDetailText}>Subjects: {item.subjects_taught.join(', ')}</Text>
        )}

        {item.role === 'student' && (
            <View>
                {item.roll_no ? <Text style={styles.userDetailText}>Roll: {item.roll_no}</Text> : null}
                {item.admission_no ? <Text style={styles.userDetailText}>Admission No: {item.admission_no}</Text> : null}
            </View>
        )}
      </View>
      
      <View style={styles.actionRow}>
        <TouchableOpacity onPress={() => handleShowPassword(item)} style={styles.actionButton}>
            <Icon name="vpn-key" size={24} color="#F39C12" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionButton}>
            <Icon name="edit" size={24} color="#3498DB" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}>
            <Icon name="delete-outline" size={24} color="#E74C3C" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#008080" /></View>;
  }

  const isEditing = !!editingUser;
  const displayRole = formData.role === 'admin' ? formData.class_group : formData.role;

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerLeftContainer}>
             <View style={styles.headerIconContainer}>
                <Icon name="manage-accounts" size={32} color="#008080" />
            </View>
            <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>User Management</Text>
                <Text style={styles.headerSubtitle}>Manage and view user data</Text>
            </View>
        </View>
       
        {/* Add Button */}
        <TouchableOpacity style={styles.headerAddBtn} onPress={openAddModal}>
            <Icon name="add" size={18} color="#fff" />
            <Text style={styles.headerAddBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Search Bar Card */}
        <View style={styles.searchCard}>
            <Icon name="search" size={26} color="#90A4AE" style={styles.searchIcon} />
            <TextInput
                style={styles.searchInput}
                placeholder="Search by name or roll number..."
                placeholderTextColor="#90A4AE"
                value={searchQuery}
                onChangeText={(val) => {
                     setSearchQuery(val.replace(/[^\w\s]/g, ''));
                }}
            />
             {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Icon name="close" size={22} color="#90A4AE" />
                </TouchableOpacity>
            )}
        </View>

        {/* List Items */}
        {CLASS_CATEGORIES.map((className, index) => (
          <Animatable.View key={className} animation="fadeInUp" duration={400} delay={index * 50} style={styles.accordionCard}>
            <TouchableOpacity style={styles.accordionHeader} onPress={() => handleToggleAccordion(className)} activeOpacity={0.7}>
              <View style={styles.accordionLeft}>
                  <Text style={styles.accordionTitle}>{className}</Text>
                   <View style={styles.badgeContainer}>
                      <Text style={styles.badgeText}>{groupedUsers[className]?.length || 0}</Text>
                   </View>
              </View>
              <Icon name={expandedClass === className ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={28} color="#666" />
            </TouchableOpacity>

            {expandedClass === className && (
              <View style={styles.userListContainer}>
                {groupedUsers[className]?.length > 0 ? (
                  groupedUsers[className].map((user) => ( <Animatable.View key={user.id} animation="fadeIn">{renderUserItem(user)}</Animatable.View> ))
                ) : (
                  <Text style={styles.emptySectionText}>No matching users found.</Text>
                )}
              </View>
            )}
          </Animatable.View>
        ))}
      </ScrollView>

      {/* Modal Section */}
      <Modal animationType="fade" transparent={true} visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <Animatable.View animation="zoomIn" duration={400} style={styles.modalContainer}>
                <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                    <Text style={styles.modalTitle}>{isEditing ? 'Edit User' : 'Add New User'}</Text>
                    <View style={styles.modalDivider} />

                    <Text style={styles.inputLabel}>Username (AlphaNumeric only)</Text>
                    <TextInput style={styles.input} placeholder="e.g. john.doe" value={formData.username} onChangeText={(val) => validateInput('username', val)} autoCapitalize="none" />

                    <Text style={styles.inputLabel}>Password</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder="Enter password"
                        value={formData.password}
                        onChangeText={(val) => setFormData({ ...formData, password: val })}
                        secureTextEntry={!isPasswordVisible}
                      />
                      <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)} style={styles.eyeIcon}>
                        <Icon name={isPasswordVisible ? 'visibility' : 'visibility-off'} size={20} color="#7F8C8D" />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.inputLabel}>Full Name (Letters, spaces, hyphens only)</Text>
                    <TextInput style={styles.input} placeholder="Full Name" value={formData.full_name} onChangeText={(val) => validateInput('full_name', val)} />

                    <Text style={styles.inputLabel}>Role</Text>
                    <View style={styles.pickerWrapper}>
                        <Picker selectedValue={displayRole} onValueChange={(val) => {
                                const newFormData = { ...formData };
                                if (val === 'Management Admin' || val === 'General Admin') {
                                    newFormData.role = 'admin';
                                    newFormData.class_group = val;
                                } else {
                                    newFormData.role = val;
                                    if (val === 'teacher') newFormData.class_group = 'Teachers';
                                    else if (val === 'others') newFormData.class_group = 'Others';
                                }
                                setFormData(newFormData);
                            }} style={styles.modalPicker}>
                            {DISPLAY_USER_ROLES.map((role) => (<Picker.Item key={role.value} label={role.label} value={role.value} />))}
                        </Picker>
                    </View>

                    {formData.role === 'teacher' && (
                        <>
                            <Text style={styles.inputLabel}>Subjects Taught</Text>
                            <View style={styles.subjectInputContainer}>
                                <TextInput
                                    style={styles.subjectInput}
                                    placeholder="Subject"
                                    value={currentSubjectInput}
                                    onChangeText={(val) => setCurrentSubjectInput(val.replace(/[^a-zA-Z0-9\s]/g, ''))}
                                    onSubmitEditing={handleAddSubject}
                                />
                                <TouchableOpacity style={styles.subjectAddButton} onPress={handleAddSubject}>
                                    <Text style={styles.subjectAddButtonText}>ADD</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.subjectTagContainer}>
                                {formData.subjects_taught?.map((subject: string, index: number) => (
                                    <View key={index} style={styles.subjectTag}>
                                        <Text style={styles.subjectTagText}>{subject}</Text>
                                        <TouchableOpacity onPress={() => handleRemoveSubject(subject)} style={styles.removeTagButton}>
                                            <Icon name="close" size={14} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        </>
                    )}

                    {formData.role === 'student' ? (
                        <>
                          <Text style={styles.inputLabel}>Class / Group</Text>
                          <View style={styles.pickerWrapper}>
                              <Picker selectedValue={formData.class_group} onValueChange={(val) => setFormData({ ...formData, class_group: val })} style={styles.modalPicker}>
                              {CLASS_CATEGORIES.filter(c => !['Admins', 'Teachers', 'Others'].includes(c)).map((level) => ( <Picker.Item key={level} label={level} value={level} /> ))}
                              </Picker>
                          </View>
                          <Text style={styles.inputLabel}>Roll No. (Numeric Only)</Text>
                          <TextInput style={styles.input} placeholder="Roll Number" value={formData.roll_no} onChangeText={(val) => validateInput('roll_no', val)} keyboardType="numeric" />
                          
                          <Text style={styles.inputLabel}>Admission No. (Numeric Only)</Text>
                          <TextInput style={styles.input} placeholder="Admission No" value={formData.admission_no} onChangeText={(val) => validateInput('admission_no', val)} keyboardType="numeric" />
                          
                          <Text style={styles.inputLabel}>Parent Name (Letters Only)</Text>
                          <TextInput style={styles.input} placeholder="Parent Name" value={formData.parent_name} onChangeText={(val) => validateInput('parent_name', val)} />
                          
                          <Text style={styles.inputLabel}>Aadhar No. (Numeric Only)</Text>
                          <TextInput style={styles.input} placeholder="Aadhar Number" value={formData.aadhar_no} onChangeText={(val) => validateInput('aadhar_no', val)} keyboardType="numeric" maxLength={12} />
                          
                          <Text style={styles.inputLabel}>PEN No. (Numeric Only)</Text>
                          <TextInput style={styles.input} placeholder="PEN Number" value={formData.pen_no} onChangeText={(val) => validateInput('pen_no', val)} keyboardType="numeric" />
                        </>
                    ) : (
                        <>
                          <Text style={styles.inputLabel}>Aadhar No. (Numeric Only)</Text>
                          <TextInput style={styles.input} placeholder="Aadhar Number" value={formData.aadhar_no} onChangeText={(val) => validateInput('aadhar_no', val)} keyboardType="numeric" maxLength={12} />
                          
                          <Text style={styles.inputLabel}>Joining Date</Text>
                          <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={formData.joining_date} onChangeText={(val) => setFormData({ ...formData, joining_date: val })} />
                          
                          <Text style={styles.inputLabel}>Previous Salary (Numeric Only)</Text>
                          <TextInput style={styles.input} placeholder="Amount" value={formData.previous_salary} onChangeText={(val) => validateInput('previous_salary', val)} keyboardType="numeric" />
                          
                          <Text style={styles.inputLabel}>Present Salary (Numeric Only)</Text>
                          <TextInput style={styles.input} placeholder="Amount" value={formData.present_salary} onChangeText={(val) => validateInput('present_salary', val)} keyboardType="numeric" />
                          
                          <Text style={styles.inputLabel}>Experience</Text>
                          <TextInput style={styles.input} placeholder="Years of experience" value={formData.experience} onChangeText={(val) => validateInput('experience', val)} />
                        </>
                    )}

                    <View style={styles.modalButtonContainer}>
                        <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsModalVisible(false)}>
                        <Text style={styles.modalButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.submitButton]} onPress={handleSave}>
                        <Text style={styles.modalButtonText}>{isEditing ? 'Update' : 'Save'}</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </Animatable.View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F5F8' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F5F8' },
  container: { paddingVertical: 10, paddingBottom: 50 },

  // --- Header Card Style ---
  headerCard: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    width: '96%',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  headerLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    backgroundColor: '#E0F2F1',
    borderRadius: 30,
    width: 50,
    height: 50,
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
    color: '#333333',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  
  headerAddBtn: {
    backgroundColor: '#008080',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    gap: 4,
    elevation: 2,
  },
  headerAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },

  // --- Search Bar Card Style ---
  searchCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      width: '96%',
      alignSelf: 'center',
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 15,
      height: 55,
      elevation: 2,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  searchIcon: {
      marginRight: 10,
  },
  searchInput: {
      flex: 1,
      fontSize: 16,
      color: '#333333',
      height: '100%',
  },

  // --- Accordion Card Style ---
  accordionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '96%',
    alignSelf: 'center',
    marginBottom: 6,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  accordionHeader: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  accordionLeft: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  accordionTitle: { 
    fontSize: 18,
    fontWeight: '700',
    color: '#2C3E50' 
  },
  badgeContainer: {
      backgroundColor: '#EAEAEA',
      paddingHorizontal: 12, 
      paddingVertical: 5,
      borderRadius: 15, 
      marginLeft: 12,
      justifyContent: 'center',
      alignItems: 'center'
  },
  badgeText: { 
    fontSize: 14,
    color: '#333333', 
    fontWeight: 'bold' 
  },

  // --- User Row List ---
  userListContainer: { 
    borderTopWidth: 1, 
    borderTopColor: '#F5F5F5' 
  },
  userRow: {
    flexDirection: 'row', 
    alignItems: 'center',
    paddingVertical: 15, 
    paddingHorizontal: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F9F9F9',
    backgroundColor: '#FFFFFF',
  },
  userIconWrapper: {
      width: 45, 
      alignItems: 'center', 
      justifyContent: 'center', 
      marginRight: 12
  },
  userInfo: { 
    flex: 1, 
    justifyContent: 'center' 
  },
  userName: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#2C3E50', 
    marginBottom: 4 
  },
  userSubtitle: { 
    fontSize: 14, 
    color: '#7F8C8D', 
    marginBottom: 2 
  },
  userDetailText: { 
    fontSize: 14, 
    color: '#008080', 
    fontWeight: '500', 
    marginTop: 1 
  },
  actionRow: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  actionButton: { 
    padding: 8, 
    marginLeft: 2 
  },
  emptySectionText: { 
    textAlign: 'center', 
    padding: 20, 
    color: '#999', 
    fontStyle: 'italic',
    fontSize: 15
  },

  // --- Modal Styles ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: {
    width: width > 400 ? '80%' : '92%', 
    maxHeight: '85%', 
    backgroundColor: '#fff', 
    borderRadius: 15,
    elevation: 10, 
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, 
    overflow: 'hidden'
  },
  modalContent: { padding: 25 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#008080', textAlign: 'center' },
  modalDivider: { height: 2, width: 40, backgroundColor: '#008080', alignSelf: 'center', marginTop: 8, marginBottom: 20 },

  inputLabel: { fontSize: 14, color: '#555', marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#f9f9f9', borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12,
    fontSize: 15, color: '#333', borderWidth: 1, borderColor: '#eee', marginBottom: 15,
  },
  passwordContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9',
    borderRadius: 8, borderWidth: 1, borderColor: '#eee', marginBottom: 15,
  },
  passwordInput: { flex: 1, paddingHorizontal: 15, paddingVertical: 12, fontSize: 15, color: '#333' },
  eyeIcon: { padding: 10 },

  pickerWrapper: {
    backgroundColor: '#f9f9f9', borderRadius: 8, borderWidth: 1, borderColor: '#eee',
    justifyContent: 'center', marginBottom: 15,
  },
  modalPicker: { height: 50, width: '100%', color: '#333' },

  subjectInputContainer: { flexDirection: 'row', marginBottom: 10 },
  subjectInput: {
    flex: 1, backgroundColor: '#f9f9f9', borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12,
    fontSize: 15, color: '#333', borderWidth: 1, borderColor: '#eee',
    borderTopRightRadius: 0, borderBottomRightRadius: 0,
  },
  subjectAddButton: {
    paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#008080', borderTopRightRadius: 8, borderBottomRightRadius: 8,
  },
  subjectAddButtonText: { color: '#fff', fontWeight: 'bold' },
  subjectTagContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
  subjectTag: {
    flexDirection: 'row', backgroundColor: '#008080', borderRadius: 20,
    paddingVertical: 5, paddingHorizontal: 12, marginRight: 8, marginTop: 8, alignItems: 'center',
  },
  subjectTagText: { color: '#fff', fontSize: 13, marginRight: 6 },
  removeTagButton: { backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 12, padding: 2 },

  modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', elevation: 1 },
  cancelButton: { backgroundColor: '#7f8c8d', marginRight: 10 },
  submitButton: { backgroundColor: '#008080', marginLeft: 10 },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default AdminLM;