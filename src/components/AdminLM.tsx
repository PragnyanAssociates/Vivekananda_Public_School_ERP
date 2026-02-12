import React, { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  LayoutAnimation, UIManager, Dimensions, StatusBar, useColorScheme
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import apiClient from '../api/client';

// Enable Layout Animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- CONSTANTS & THEME ---
const { width, height } = Dimensions.get('window');

const LightColors = {
    primary: '#008080',
    background: '#F2F5F8',
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    error: '#E74C3C',
    iconGrey: '#90A4AE',
    inputBg: '#F5F7FA',
    modalOverlay: 'rgba(0,0,0,0.5)',
    badgeBg: '#EAEAEA',
    badgeText: '#333333'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    error: '#EF5350',
    iconGrey: '#757575',
    inputBg: '#2C2C2C',
    modalOverlay: 'rgba(0,0,0,0.7)',
    badgeBg: '#333333',
    badgeText: '#E0E0E0'
};

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
  // --- THEME HOOK ---
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const COLORS = isDark ? DarkColors : LightColors;

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [currentSubjectInput, setCurrentSubjectInput] = useState('');
  
  // List State
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // --- NEW MENU STATE ---
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedUserForMenu, setSelectedUserForMenu] = useState<User | null>(null);

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

        groups[category] = categoryUsers.sort((a, b) => {
            const rollA = a.roll_no ? parseInt(a.roll_no, 10) : 0;
            const rollB = b.roll_no ? parseInt(b.roll_no, 10) : 0;

            if (rollA > 0 || rollB > 0) {
                return rollA - rollB;
            }
            return a.full_name.localeCompare(b.full_name);
        });
    });
    return groups;
  }, [users, searchQuery]);

  // --- MODAL & FORM HANDLERS ---
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
    setFormData({ ...user, subjects_taught: user.subjects_taught || [] }); 
    setIsPasswordVisible(false);
    setCurrentSubjectInput('');
    setIsModalVisible(true);
  };

  // --- VALIDATION LOGIC ---
  const validateInput = (key: string, value: string) => {
    let sanitized = value;
    switch (key) {
      case 'roll_no':
      case 'admission_no':
      case 'aadhar_no':
      case 'pen_no':
      case 'previous_salary':
      case 'present_salary':
        sanitized = value.replace(/[^0-9]/g, '');
        break;
      case 'parent_name':
        sanitized = value.replace(/[^a-zA-Z\s]/g, '');
        break;
      case 'full_name':
        sanitized = value.replace(/[^a-zA-Z\s\-']/g, '');
        break;
      case 'username':
        sanitized = value.replace(/[^a-zA-Z0-9._-]/g, '');
        break;
      case 'experience':
      case 'subjects_taught':
        sanitized = value.replace(/[^\w\s.,\-()]/g, ''); 
        break;
      default:
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
        if (key === 'password') return;
        if (original[key as keyof User] != current[key]) {
            changes[key] = current[key];
        }
    });
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
    if (formData.role === 'student' && (!formData.roll_no || !formData.class_group)) {
         Alert.alert('Error', 'Class and Roll Number are mandatory for students.');
         return;
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
        if (payload.role !== 'teacher') delete payload.subjects_taught;
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
             Alert.alert('Encrypted', `This is an old, encrypted password. Set a new one to view it.`);
        } else {
             Alert.alert('Password', `User: ${user.full_name}\nPass: ${user.password}`);
        }
    } else {
        Alert.alert('Error', 'No password found.');
    }
  };

  const handleToggleAccordion = (className: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedClass(expandedClass === className ? null : className);
  };

  const handleAddSubject = () => {
      const subjectToAdd = currentSubjectInput.trim();
      if(/[^a-zA-Z0-9\s]/.test(subjectToAdd)) {
           Alert.alert("Invalid", "Subject names should not contain special characters.");
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

  // --- MENU HANDLER ---
  const handleMenuPress = (user: User) => {
      setSelectedUserForMenu(user);
      setMenuVisible(true);
  };

  const performMenuAction = (action: string) => {
      setMenuVisible(false);
      if (!selectedUserForMenu) return;

      setTimeout(() => {
        switch(action) {
            case 'VIEW':
                handleShowPassword(selectedUserForMenu);
                break;
            case 'EDIT':
                openEditModal(selectedUserForMenu);
                break;
            case 'DELETE':
                handleDelete(selectedUserForMenu);
                break;
            default:
                break;
        }
      }, 300);
  };

  // --- RENDER USER ITEM ---
  const renderUserItem = (item: User) => {
    let iconName = 'person';
    if(item.role === 'admin') iconName = 'admin-panel-settings';
    else if(item.role === 'teacher') iconName = 'school';
    else if(item.role === 'others') iconName = 'group';

    return (
      <View style={[styles.card, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
        {/* Header Part of Card */}
        <View style={styles.cardHeader}>
            <View style={styles.userInfoLeft}>
                <View style={[styles.userIconWrapper, { backgroundColor: isDark ? '#333' : '#E0F2F1' }]}>
                    <Icon name={iconName} size={28} color={COLORS.primary} />
                </View>
                <View style={styles.textBlock}>
                    <Text style={[styles.userName, { color: COLORS.textMain }]}>{item.full_name}</Text>
                    <Text style={[styles.userRole, { color: COLORS.textSub }]}>
                        {item.role === 'admin' ? item.class_group : item.role.toUpperCase()}
                        {item.role === 'student' && item.roll_no ? ` | Roll: ${item.roll_no}` : ''}
                    </Text>
                </View>
            </View>

            {/* 3-DOT MENU BUTTON */}
            <TouchableOpacity 
                style={styles.menuButton} 
                onPress={() => handleMenuPress(item)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            >
                <Icon name="more-vert" size={24} color={COLORS.iconGrey} />
            </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: COLORS.border }]} />

        {/* Details Part of Card */}
        <View style={styles.cardDetails}>
            <Text style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: COLORS.textSub }]}>Username: </Text> 
                <Text style={[styles.detailValue, { color: COLORS.textMain }]}>{item.username}</Text>
            </Text>

            {item.role === 'teacher' && item.subjects_taught && item.subjects_taught.length > 0 && (
                <Text style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: COLORS.textSub }]}>Subjects: </Text>
                    <Text style={[styles.detailValue, { color: COLORS.textMain }]}>{item.subjects_taught.join(', ')}</Text>
                </Text>
            )}

            {item.role === 'student' && (
                <>
                    {item.admission_no && (
                         <Text style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: COLORS.textSub }]}>Admission No: </Text>
                            <Text style={[styles.detailValue, { color: COLORS.textMain }]}>{item.admission_no}</Text>
                        </Text>
                    )}
                    {item.parent_name && (
                        <Text style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: COLORS.textSub }]}>Parent: </Text>
                            <Text style={[styles.detailValue, { color: COLORS.textMain }]}>{item.parent_name}</Text>
                        </Text>
                    )}
                </>
            )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return <View style={[styles.loadingContainer, { backgroundColor: COLORS.background }]}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  const isEditing = !!editingUser;
  const displayRole = formData.role === 'admin' ? formData.class_group : formData.role;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: COLORS.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
      
      {/* Header Card */}
      <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#ccc' }]}>
        <View style={styles.headerLeftContainer}>
             <View style={[styles.headerIconContainer, { backgroundColor: isDark ? '#333' : '#E0F2F1' }]}>
                <Icon name="manage-accounts" size={32} color={COLORS.primary} />
            </View>
            <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>User Management</Text>
                <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Manage and view user data</Text>
            </View>
        </View>
       
        <TouchableOpacity style={[styles.headerAddBtn, { backgroundColor: COLORS.primary }]} onPress={openAddModal}>
            <Icon name="add" size={18} color="#fff" />
            <Text style={styles.headerAddBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Search Bar */}
        <View style={[styles.searchCard, { backgroundColor: COLORS.cardBg, borderColor: COLORS.border }]}>
            <Icon name="search" size={24} color={COLORS.textSub} style={styles.searchIcon} />
            <TextInput
                style={[styles.searchInput, { color: COLORS.textMain }]}
                placeholder="Search by name or roll number..."
                placeholderTextColor={COLORS.textSub}
                value={searchQuery}
                onChangeText={(val) => setSearchQuery(val.replace(/[^\w\s]/g, ''))}
            />
             {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Icon name="close" size={22} color={COLORS.textSub} />
                </TouchableOpacity>
            )}
        </View>

        {/* List Items */}
        {CLASS_CATEGORIES.map((className, index) => (
          <Animatable.View key={className} animation="fadeInUp" duration={400} delay={index * 50} style={styles.accordionContainer}>
            <TouchableOpacity style={[styles.accordionHeader, { backgroundColor: COLORS.cardBg }]} onPress={() => handleToggleAccordion(className)} activeOpacity={0.8}>
              <View style={styles.accordionLeft}>
                  <Text style={[styles.accordionTitle, { color: COLORS.textMain }]}>{className}</Text>
                   <View style={[styles.badgeContainer, { backgroundColor: COLORS.badgeBg }]}>
                      <Text style={[styles.badgeText, { color: COLORS.badgeText }]}>{groupedUsers[className]?.length || 0}</Text>
                   </View>
              </View>
              <Icon name={expandedClass === className ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={28} color={COLORS.textSub} />
            </TouchableOpacity>

            {expandedClass === className && (
              <View style={styles.userListContainer}>
                {groupedUsers[className]?.length > 0 ? (
                  groupedUsers[className].map((user) => ( 
                      <Animatable.View key={user.id} animation="fadeIn" duration={300}>
                          {renderUserItem(user)}
                      </Animatable.View> 
                  ))
                ) : (
                  <Text style={[styles.emptySectionText, { color: COLORS.iconGrey }]}>No matching users found.</Text>
                )}
              </View>
            )}
          </Animatable.View>
        ))}
      </ScrollView>

      {/* --- CUSTOM MENU MODAL --- */}
      <Modal 
        transparent 
        visible={menuVisible} 
        animationType="fade" 
        onRequestClose={() => setMenuVisible(false)}
      >
          <TouchableOpacity 
            style={[styles.menuModalOverlay, { backgroundColor: COLORS.modalOverlay }]} 
            activeOpacity={1} 
            onPress={() => setMenuVisible(false)}
          >
              <Animatable.View animation="zoomIn" duration={200} style={[styles.menuModalContainer, { backgroundColor: COLORS.cardBg }]}>
                  <Text style={[styles.menuModalTitle, { color: COLORS.textMain }]}>Manage User</Text>
                  <Text style={[styles.menuModalSubtitle, { color: COLORS.textSub }]}>
                    Options for "{selectedUserForMenu?.full_name}"
                  </Text>
                  
                  {/* Row 1: View, Edit, Delete */}
                  <View style={styles.menuRowThree}>
                      <TouchableOpacity onPress={() => performMenuAction('VIEW')}>
                          <Text style={[styles.menuBtnText, { color: COLORS.primary }]}>VIEW</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => performMenuAction('EDIT')}>
                          <Text style={[styles.menuBtnText, { color: COLORS.primary }]}>EDIT</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => performMenuAction('DELETE')}>
                          <Text style={[styles.menuBtnText, { color: COLORS.error }]}>DELETE</Text>
                      </TouchableOpacity>
                  </View>

                  {/* Row 2: Cancel (Centered and Boxed) */}
                  <View style={styles.menuRowCenter}>
                      <TouchableOpacity 
                        style={[styles.cancelButtonBox, { borderColor: COLORS.primary }]} 
                        onPress={() => setMenuVisible(false)}
                      >
                          <Text style={[styles.menuBtnText, { color: COLORS.primary }]}>CANCEL</Text>
                      </TouchableOpacity>
                  </View>
              </Animatable.View>
          </TouchableOpacity>
      </Modal>

      {/* --- ADD/EDIT USER MODAL --- */}
      <Modal animationType="fade" transparent={true} visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalOverlay, { backgroundColor: COLORS.modalOverlay }]}>
            <Animatable.View animation="zoomIn" duration={400} style={[styles.modalContainer, { backgroundColor: COLORS.cardBg }]}>
                <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.modalHeaderRow}>
                         <Text style={[styles.modalTitle, { color: COLORS.primary }]}>{isEditing ? 'Edit User' : 'Add New User'}</Text>
                         <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                             <Icon name="close" size={24} color={COLORS.textSub} />
                         </TouchableOpacity>
                    </View>
                    <View style={[styles.modalDivider, { backgroundColor: COLORS.primary }]} />

                    <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>Username</Text>
                    <TextInput 
                        style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} 
                        placeholder="e.g. john.doe" 
                        placeholderTextColor={COLORS.iconGrey} 
                        value={formData.username} 
                        onChangeText={(val) => validateInput('username', val)} 
                        autoCapitalize="none" 
                    />

                    <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>Password</Text>
                    <View style={[styles.passwordContainer, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                      <TextInput
                        style={[styles.passwordInput, { color: COLORS.textMain }]}
                        placeholder="Enter password"
                        placeholderTextColor={COLORS.iconGrey}
                        value={formData.password}
                        onChangeText={(val) => setFormData({ ...formData, password: val })}
                        secureTextEntry={!isPasswordVisible}
                      />
                      <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)} style={styles.eyeIcon}>
                        <Icon name={isPasswordVisible ? 'visibility' : 'visibility-off'} size={20} color={COLORS.textSub} />
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>Full Name</Text>
                    <TextInput 
                        style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} 
                        placeholder="Full Name" 
                        placeholderTextColor={COLORS.iconGrey} 
                        value={formData.full_name} 
                        onChangeText={(val) => validateInput('full_name', val)} 
                    />

                    <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>Role</Text>
                    <View style={[styles.pickerWrapper, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                        <Picker 
                            selectedValue={displayRole} 
                            onValueChange={(val) => {
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
                            }} 
                            style={[styles.modalPicker, { color: COLORS.textMain }]} 
                            dropdownIconColor={COLORS.textSub}
                            mode="dropdown"
                        >
                            {DISPLAY_USER_ROLES.map((role) => (
                                <Picker.Item key={role.value} label={role.label} value={role.value} color={COLORS.textMain} />
                            ))}
                        </Picker>
                    </View>

                    {formData.role === 'teacher' && (
                        <>
                            <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>Subjects Taught</Text>
                            <View style={styles.subjectInputContainer}>
                                <TextInput
                                    style={[styles.subjectInput, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]}
                                    placeholder="Subject"
                                    placeholderTextColor={COLORS.iconGrey}
                                    value={currentSubjectInput}
                                    onChangeText={(val) => setCurrentSubjectInput(val.replace(/[^a-zA-Z0-9\s]/g, ''))}
                                    onSubmitEditing={handleAddSubject}
                                />
                                <TouchableOpacity style={[styles.subjectAddButton, { backgroundColor: COLORS.primary }]} onPress={handleAddSubject}>
                                    <Text style={styles.subjectAddButtonText}>ADD</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.subjectTagContainer}>
                                {formData.subjects_taught?.map((subject: string, index: number) => (
                                    <View key={index} style={[styles.subjectTag, { backgroundColor: COLORS.primary }]}>
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
                          <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>Class / Group</Text>
                          <View style={[styles.pickerWrapper, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]}>
                              <Picker 
                                selectedValue={formData.class_group} 
                                onValueChange={(val) => setFormData({ ...formData, class_group: val })} 
                                style={[styles.modalPicker, { color: COLORS.textMain }]} 
                                dropdownIconColor={COLORS.textSub}
                              >
                              {CLASS_CATEGORIES.filter(c => !['Admins', 'Teachers', 'Others'].includes(c)).map((level) => ( 
                                <Picker.Item key={level} label={level} value={level} color={COLORS.textMain} /> 
                              ))}
                              </Picker>
                          </View>
                          <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>Roll No.</Text>
                          <TextInput style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} placeholder="Roll Number" placeholderTextColor={COLORS.iconGrey} value={formData.roll_no} onChangeText={(val) => validateInput('roll_no', val)} keyboardType="numeric" />
                          
                          <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>Admission No.</Text>
                          <TextInput style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} placeholder="Admission No" placeholderTextColor={COLORS.iconGrey} value={formData.admission_no} onChangeText={(val) => validateInput('admission_no', val)} keyboardType="numeric" />
                          
                          <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>Parent Name</Text>
                          <TextInput style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} placeholder="Parent Name" placeholderTextColor={COLORS.iconGrey} value={formData.parent_name} onChangeText={(val) => validateInput('parent_name', val)} />
                          
                          <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>Aadhar No.</Text>
                          <TextInput style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} placeholder="Aadhar Number" placeholderTextColor={COLORS.iconGrey} value={formData.aadhar_no} onChangeText={(val) => validateInput('aadhar_no', val)} keyboardType="numeric" maxLength={12} />
                          
                          <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>PEN No.</Text>
                          <TextInput style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} placeholder="PEN Number" placeholderTextColor={COLORS.iconGrey} value={formData.pen_no} onChangeText={(val) => validateInput('pen_no', val)} keyboardType="numeric" />
                        </>
                    ) : (
                        <>
                          <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>Aadhar No.</Text>
                          <TextInput style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} placeholder="Aadhar Number" placeholderTextColor={COLORS.iconGrey} value={formData.aadhar_no} onChangeText={(val) => validateInput('aadhar_no', val)} keyboardType="numeric" maxLength={12} />
                          
                          <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>Joining Date</Text>
                          <TextInput style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.iconGrey} value={formData.joining_date} onChangeText={(val) => setFormData({ ...formData, joining_date: val })} />
                          
                          <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>Previous Salary</Text>
                          <TextInput style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} placeholder="Amount" placeholderTextColor={COLORS.iconGrey} value={formData.previous_salary} onChangeText={(val) => validateInput('previous_salary', val)} keyboardType="numeric" />
                          
                          <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>Present Salary</Text>
                          <TextInput style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} placeholder="Amount" placeholderTextColor={COLORS.iconGrey} value={formData.present_salary} onChangeText={(val) => validateInput('present_salary', val)} keyboardType="numeric" />
                          
                          <Text style={[styles.inputLabel, { color: COLORS.textSub }]}>Experience</Text>
                          <TextInput style={[styles.input, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border, color: COLORS.textMain }]} placeholder="Years of experience" placeholderTextColor={COLORS.iconGrey} value={formData.experience} onChangeText={(val) => validateInput('experience', val)} />
                        </>
                    )}

                    <View style={styles.modalButtonContainer}>
                        <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsModalVisible(false)}>
                            <Text style={styles.modalButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, { backgroundColor: COLORS.primary, marginLeft: 10 }]} onPress={handleSave}>
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
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { paddingVertical: 10, paddingBottom: 50 },

  // --- Header Card Style ---
  headerCard: {
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
    fontSize: 13,
    marginTop: 2,
  },
  headerAddBtn: {
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

  // --- Search Bar Style ---
  searchCard: {
      borderRadius: 12,
      width: '96%',
      alignSelf: 'center',
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 15,
      height: 50,
      elevation: 2,
      borderWidth: 1,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  searchIcon: {
      marginRight: 10,
  },
  searchInput: {
      flex: 1,
      fontSize: 16,
      height: '100%',
  },

  // --- Accordion Container ---
  accordionContainer: {
      marginBottom: 10,
      width: '96%',
      alignSelf: 'center',
  },
  accordionHeader: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 10,
    elevation: 1,
  },
  accordionLeft: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  accordionTitle: { 
    fontSize: 18,
    fontWeight: '700',
  },
  badgeContainer: {
      paddingHorizontal: 10, 
      paddingVertical: 4,
      borderRadius: 12, 
      marginLeft: 12,
      justifyContent: 'center',
      alignItems: 'center'
  },
  badgeText: { 
    fontSize: 14,
    fontWeight: 'bold' 
  },
  userListContainer: { 
    marginTop: 5,
  },

  // --- CARD STYLE ---
  card: {
      borderRadius: 12,
      padding: 15,
      marginBottom: 8,
      elevation: 2,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: {width: 0, height: 1},
      borderWidth: 1,
  },
  cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
  },
  userInfoLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
  },
  userIconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12
  },
  textBlock: {
      flex: 1
  },
  userName: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 2
  },
  userRole: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.5
  },
  menuButton: {
      padding: 5,
      marginTop: -5,
      marginRight: -5
  },
  divider: {
      height: 1,
      marginVertical: 10
  },
  cardDetails: {
      paddingLeft: 4
  },
  detailRow: {
      marginBottom: 4,
      flexDirection: 'row',
      flexWrap: 'wrap'
  },
  detailLabel: {
      fontSize: 14,
      fontWeight: '500'
  },
  detailValue: {
      fontSize: 14,
      fontWeight: '400'
  },
  emptySectionText: { 
    textAlign: 'center', 
    padding: 20, 
    fontStyle: 'italic',
    fontSize: 15
  },

  // --- Menu Modal Styles ---
  menuModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuModalContainer: {
    width: '85%',
    borderRadius: 4, 
    padding: 20,
    elevation: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84,
  },
  menuModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  menuModalSubtitle: {
    fontSize: 16,
    marginBottom: 30, 
  },
  
  menuRowThree: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10, 
    paddingHorizontal: 10
  },
  
  menuRowCenter: {
    flexDirection: 'row',
    justifyContent: 'center', 
    marginTop: 20, 
  },

  cancelButtonBox: {
      borderWidth: 1,
      borderRadius: 4,
      paddingVertical: 8,
      paddingHorizontal: 40,
  },

  menuBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },

  // --- Add/Edit User Modal Styles ---
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalContainer: {
    width: width > 400 ? '80%' : '92%', 
    maxHeight: '85%', 
    borderRadius: 15,
    elevation: 10, 
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, 
    overflow: 'hidden'
  },
  modalContent: { padding: 25 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalDivider: { height: 2, width: 40, alignSelf: 'flex-start', marginTop: 8, marginBottom: 20 },

  inputLabel: { fontSize: 14, marginBottom: 6, fontWeight: '600' },
  input: {
    borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12,
    fontSize: 15, borderWidth: 1, marginBottom: 15,
  },
  passwordContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 8, borderWidth: 1, marginBottom: 15,
  },
  passwordInput: { flex: 1, paddingHorizontal: 15, paddingVertical: 12, fontSize: 15 },
  eyeIcon: { padding: 10 },

  pickerWrapper: {
    borderRadius: 8, borderWidth: 1,
    justifyContent: 'center', marginBottom: 15,
  },
  modalPicker: { height: 50, width: '100%' },

  subjectInputContainer: { flexDirection: 'row', marginBottom: 10 },
  subjectInput: {
    flex: 1, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12,
    fontSize: 15, borderWidth: 1,
    borderTopRightRadius: 0, borderBottomRightRadius: 0,
  },
  subjectAddButton: {
    paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center',
    borderTopRightRadius: 8, borderBottomRightRadius: 8,
  },
  subjectAddButtonText: { color: '#fff', fontWeight: 'bold' },
  subjectTagContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
  subjectTag: {
    flexDirection: 'row', borderRadius: 20,
    paddingVertical: 5, paddingHorizontal: 12, marginRight: 8, marginTop: 8, alignItems: 'center',
  },
  subjectTagText: { color: '#fff', fontSize: 13, marginRight: 6 },
  removeTagButton: { backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 12, padding: 2 },

  modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', elevation: 1 },
  cancelButton: { backgroundColor: '#7f8c8d', marginRight: 10 },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default AdminLM;