import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { styles } from '../App.styles';
import { PostActionService } from '../services/PostActionService';
import type { CalendarEventData } from '../types';

interface CreateEventModalProps {
  visible: boolean;
  onClose: () => void;
  onEventCreated?: () => void;
  isLoggedIn: boolean;
}

export function CreateEventModal({
  visible,
  onClose,
  onEventCreated,
  isLoggedIn,
}: CreateEventModalProps) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 60 * 60 * 1000)); // +1 hour
  const [location, setLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isDateBased, setIsDateBased] = useState(false);
  const [hasEndDate, setHasEndDate] = useState(true);

  const [isCreating, setIsCreating] = useState(false);

  const handleClose = () => {
    if (isCreating) return;
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setTitle('');
    setSummary('');
    setDescription('');
    setStartDate(new Date());
    setEndDate(new Date(Date.now() + 60 * 60 * 1000));
    setLocation('');
    setImageUrl('');
    setIsDateBased(false);
    setHasEndDate(true);
  };

  const validateForm = (): string | null => {
    if (!title.trim()) {
      return 'Please enter a title for your event.';
    }

    if (hasEndDate && endDate <= startDate) {
      return 'End date must be after start date.';
    }

    if (imageUrl.trim() && !isValidUrl(imageUrl)) {
      return 'Please enter a valid image URL.';
    }

    return null;
  };

  const isValidUrl = (string: string): boolean => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  const handleCreateEvent = async () => {
    if (!isLoggedIn) {
      Alert.alert('Error', 'You must be logged in to create events.');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Validation Error', validationError);
      return;
    }

    setIsCreating(true);

    try {
      const eventData: CalendarEventData = {
        title: title.trim(),
        summary: summary.trim() || undefined,
        description: description.trim() || undefined,
        startDate,
        endDate: hasEndDate ? endDate : undefined,
        location: location.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        isDateBased,
      };

      const postActionService = PostActionService.getInstance();
      await postActionService.createCalendarEvent(eventData);

      Alert.alert('Success', 'Event created successfully!');
      resetForm();
      onClose();
      onEventCreated?.();
    } catch (error) {
      console.error('Failed to create event:', error);
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to create event. Please try again.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const formatDateForDisplay = (date: Date): string => {
    if (isDateBased) {
      return date.toDateString();
    }
    return date.toLocaleString();
  };

  const handleStartDateInOneHour = () => {
    const newStart = new Date(Date.now() + 60 * 60 * 1000);
    setStartDate(newStart);
    if (hasEndDate && endDate <= newStart) {
      setEndDate(new Date(newStart.getTime() + 60 * 60 * 1000));
    }
  };

  const handleStartDateTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0); // Set to noon
    setStartDate(tomorrow);
    if (hasEndDate) {
      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(13, 0, 0, 0); // Set to 1 PM
      setEndDate(tomorrowEnd);
    }
  };

  const handleEndDateOneHourLater = () => {
    setEndDate(new Date(startDate.getTime() + 60 * 60 * 1000));
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, styles.eventModalContainer]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Event</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              disabled={isCreating}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.eventModalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput
                style={styles.formInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter event title"
                placeholderTextColor="#666"
                editable={!isCreating}
              />
            </View>

            {/* Event Type Toggle */}
            <View style={styles.formGroup}>
              <View style={styles.formToggleRow}>
                <Text style={styles.formLabel}>All-day event</Text>
                <Switch
                  value={isDateBased}
                  onValueChange={setIsDateBased}
                  disabled={isCreating}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={isDateBased ? '#ffffff' : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Start Date */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Start {isDateBased ? 'Date' : 'Date & Time'} *
              </Text>
              <View style={styles.formDateButton}>
                <Text style={styles.formDateText}>
                  {formatDateForDisplay(startDate)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { flex: 1, backgroundColor: '#444' },
                  ]}
                  onPress={handleStartDateInOneHour}
                  disabled={isCreating}
                >
                  <Text style={styles.modalButtonText}>In 1 hour</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { flex: 1, backgroundColor: '#444' },
                  ]}
                  onPress={handleStartDateTomorrow}
                  disabled={isCreating}
                >
                  <Text style={styles.modalButtonText}>Tomorrow</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* End Date Toggle */}
            <View style={styles.formGroup}>
              <View style={styles.formToggleRow}>
                <Text style={styles.formLabel}>
                  Has end {isDateBased ? 'date' : 'time'}
                </Text>
                <Switch
                  value={hasEndDate}
                  onValueChange={setHasEndDate}
                  disabled={isCreating}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={hasEndDate ? '#ffffff' : '#f4f3f4'}
                />
              </View>
            </View>

            {/* End Date */}
            {hasEndDate && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  End {isDateBased ? 'Date' : 'Date & Time'}
                </Text>
                <View style={styles.formDateButton}>
                  <Text style={styles.formDateText}>
                    {formatDateForDisplay(endDate)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      { flex: 1, backgroundColor: '#444' },
                    ]}
                    onPress={handleEndDateOneHourLater}
                    disabled={isCreating}
                  >
                    <Text style={styles.modalButtonText}>+1 hour</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Location */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Location</Text>
              <TextInput
                style={styles.formInput}
                value={location}
                onChangeText={setLocation}
                placeholder="Enter location"
                placeholderTextColor="#666"
                editable={!isCreating}
              />
            </View>

            {/* Summary */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Summary</Text>
              <TextInput
                style={styles.formInput}
                value={summary}
                onChangeText={setSummary}
                placeholder="Brief event summary"
                placeholderTextColor="#666"
                editable={!isCreating}
              />
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Detailed event description"
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
                editable={!isCreating}
              />
            </View>

            {/* Image URL */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Image URL</Text>
              <TextInput
                style={styles.formInput}
                value={imageUrl}
                onChangeText={setImageUrl}
                placeholder="https://example.com/image.png"
                placeholderTextColor="#666"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isCreating}
              />
            </View>
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={handleClose}
              disabled={isCreating}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.postButton,
                isCreating || !title.trim()
                  ? styles.disabledButton
                  : styles.enabledButton,
              ]}
              onPress={handleCreateEvent}
              disabled={isCreating || !title.trim() || !isLoggedIn}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>Create Event</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
