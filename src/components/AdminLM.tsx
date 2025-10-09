import React, { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, LayoutAnimation, UIManager
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import apiClient from '../api/client';

// ✨ NEW: Enable LayoutAnimation for Android for smooth accordion transitions
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Constants for categories and roles
const CLASS_CATEGORIES = [ 'Admins', 'Teachers', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10' ];
const USER_ROLES = ['admin', 'teacher', 'student'];

// User interface definition
interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'student' | 'teacher' | 'admin';
  class_group: string;
  subjects_taught?: string[];
}

const AdminLM = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

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
    setFormData({ username: '', password: '', full_name: '', role: 'student', class_group: 'LKG', subjects_taught: [] });
    setIsModalVisible(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({ ...user, password: '', subjects_taught: user.subjects_taught || [] });
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.username || !formData.full_name) {
      Alert.alert('Error', 'Username and Full Name are required.');
      return;
    }
    if (!editingUser && !formData.password) {
        Alert.alert('Error', 'Password is required for new users.');
        return;
    }

    const payload = { ...formData };
    if (editingUser && !payload.password) {
        delete payload.password;
    }
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

  const handleResetPassword = (user: User) => {
    Alert.prompt(
      'Reset Password', `Enter a new temporary password for "${user.full_name}":`,
      [ { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: async (newPassword) => {
            if (!newPassword || newPassword.trim() === '') {
              Alert.alert('Error', 'Password cannot be empty.');
              return;
            }
            try {
              const response = await apiClient.patch(`/users/${user.id}/reset-password`, { newPassword });
              Alert.alert('Success', response.data.message);
            } catch (error: any) {
              Alert.alert('Reset Failed', error.response?.data?.message || 'An unknown error occurred.');
            }
        }},
      ], 'plain-text'
    );
  };

  const handleToggleAccordion = (className: string) => {
    // ✨ NEW: Use LayoutAnimation for a smooth expand/collapse effect
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedClass(expandedClass === className ? null : className);
  };
  
  const renderUserItem = (item: User) => (
    <View style={styles.userRow}>
      <Icon 
        name={
            item.role === 'admin' ? 'admin-panel-settings' :
            item.role === 'teacher' ? 'school' : 'person'
        } 
        size={24} 
        color="#008080" 
        style={styles.userIcon} 
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.full_name}</Text>
        <Text style={styles.userUsername}>Username: {item.username}</Text>
        {item.role === 'teacher' && item.subjects_taught && item.subjects_taught.length > 0 && (
          <Text style={styles.userSubjects}>
            Subjects: {item.subjects_taught.join(', ')}
          </Text>
        )}
      </View>
      <TouchableOpacity onPress={() => handleResetPassword(item)} style={styles.actionButton}>
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
                  groupedUsers[className].map((user) => (
                    <Animatable.View key={user.id} animation="fadeIn">
                        {renderUserItem(user)}
                    </Animatable.View>
                  ))
                ) : (
                  <Text style={styles.emptySectionText}>No users in this section.</Text>
                )}
              </View>
            )}
          </Animatable.View>
        ))}
      </ScrollView>

      {/* Add/Edit User Modal */}
      <Modal animationType="fade" transparent={true} visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <Animatable.View animation="zoomIn" duration={400} style={styles.modalContainer}>
                <ScrollView contentContainerStyle={styles.modalContent}>
                    <Text style={styles.modalTitle}>{isEditing ? 'Edit User' : 'Add New User'}</Text>
                    <View style={styles.modalTitleSeparator} />
                    
                    <Text style={styles.inputLabel}>Username</Text>
                    <TextInput style={styles.input} placeholder="e.g., john.doe, STU101" value={formData.username} onChangeText={(val) => setFormData({ ...formData, username: val })} autoCapitalize="none" />
                    
                    <Text style={styles.inputLabel}>{isEditing ? 'New Password (Optional)' : 'Password'}</Text>
                    <TextInput style={styles.input} placeholder={isEditing ? "Leave blank to keep current" : "Enter temporary password"} value={formData.password} onChangeText={(val) => setFormData({ ...formData, password: val })} secureTextEntry />
                    
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <TextInput style={styles.input} placeholder="Enter user's full name" value={formData.full_name} onChangeText={(val) => setFormData({ ...formData, full_name: val })} />
                    
                    <Text style={styles.inputLabel}>Role</Text>
                    <View style={styles.pickerWrapper}>
                        <Picker 
                            selectedValue={formData.role} 
                            onValueChange={(val) => {
                                const newClassGroup = val === 'teacher' ? 'Teachers' : (val === 'admin' ? 'Admins' : formData.class_group || 'LKG');
                                setFormData({ ...formData, role: val, class_group: newClassGroup });
                            }} 
                            style={styles.modalPicker}>
                            {USER_ROLES.map((role) => (<Picker.Item key={role} label={role.charAt(0).toUpperCase() + role.slice(1)} value={role} />))}
                        </Picker>
                    </View>
                    
                    {formData.role === 'teacher' ? (
                        <>
                        <Text style={styles.inputLabel}>Subjects Taught (comma-separated)</Text>
                        <TextInput style={styles.input} placeholder="e.g., Mathematics, Science" value={formData.subjects_taught?.join(', ') || ''} onChangeText={(val) => setFormData({ ...formData, subjects_taught: val.split(',').map(s => s.trim()).filter(Boolean) })}/>
                        </>
                    ) : formData.role === 'student' ? (
                        <>
                        <Text style={styles.inputLabel}>Class / Group</Text>
                        <View style={styles.pickerWrapper}>
                            <Picker selectedValue={formData.class_group} onValueChange={(val) => setFormData({ ...formData, class_group: val })} style={styles.modalPicker}>
                            {CLASS_CATEGORIES.filter(c => c !== 'Teachers' && c !== 'Admins').map((level) => ( <Picker.Item key={level} label={level} value={level} /> ))}
                            </Picker>
                        </View>
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

// ✨ NEW: Completely revamped styles for a modern and dynamic UI
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F9FC' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 15, 
    backgroundColor: '#FFFFFF', 
    borderBottomWidth: 1, 
    borderBottomColor: '#E0E0E0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#008080' },
  addButton: { 
    flexDirection: 'row', 
    backgroundColor: '#27AE60', 
    paddingVertical: 10, 
    paddingHorizontal: 14, 
    borderRadius: 20, 
    alignItems: 'center', 
    elevation: 2,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginLeft: 5 },
  container: { padding: 10 },
  accordionSection: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 12, 
    marginBottom: 12, 
    overflow: 'hidden', 
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 15 },
  accordionTitle: { fontSize: 18, fontWeight: '600', color: '#2C3E50' },
  userListContainer: { borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  userRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14, 
    paddingHorizontal: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#ECEFF1', 
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
    width: '90%',
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    overflow: 'hidden',
  },
  modalContent: {
    padding: 25,
  },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#2C3E50', textAlign: 'center' },
  modalTitleSeparator: {
    height: 3,
    width: 40,
    backgroundColor: '#008080',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 25,
  },
  inputLabel: { fontSize: 16, color: '#34495E', marginBottom: 8, fontWeight: '500' },
  input: { 
    backgroundColor: '#F7F9FC', 
    borderRadius: 10, 
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16, 
    color: '#2C3E50', 
    borderWidth: 1, 
    borderColor: '#E0E0E0',
    marginBottom: 20,
  },
  pickerWrapper: {
    backgroundColor: '#F7F9FC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalPicker: { height: 50, width: '100%', color: '#2C3E50' },
  modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', elevation: 2 },
  cancelButton: { backgroundColor: '#95A5A6', marginRight: 10 },
  submitButton: { backgroundColor: '#27AE60', marginLeft: 10 },
  modalButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

export default AdminLM;