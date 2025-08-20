import React, { useState, useEffect } from 'react';
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
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { styles } from '../App.styles';
import { PostActionService } from '../services/PostActionService';
import type { CalendarEventData } from '../types';
import type { CalendarEvent } from '../hooks/useEvents';

interface CreateEventModalProps {
  visible: boolean;
  onClose: () => void;
  onEventCreated?: () => void;
  isLoggedIn: boolean;
  existingEvent?: CalendarEvent; // Add support for editing existing events
}

export function CreateEventModal({
  visible,
  onClose,
  onEventCreated,
  isLoggedIn,
  existingEvent,
}: CreateEventModalProps) {
  // Helper function to get next rounded hour
  const getNextRoundedHour = () => {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0); // Set to next hour, 0 minutes, 0 seconds, 0 ms
    return nextHour;
  };

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState(''); // Note: summary not in CalendarEvent interface
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(getNextRoundedHour());
  const [endDate, setEndDate] = useState(() => {
    const start = getNextRoundedHour();
    return new Date(start.getTime() + 2 * 60 * 60 * 1000); // +2 hours from start
  });
  const [location, setLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isDateBased, setIsDateBased] = useState(false);
  const [hasEndDate, setHasEndDate] = useState(true);

  const [isCreating, setIsCreating] = useState(false);

  // Update form fields when existingEvent changes
  useEffect(() => {
    const initializeDate = (
      dateString?: string,
      defaultDate: Date = getNextRoundedHour()
    ) => {
      if (!dateString) return defaultDate;

      // Handle both date-based (YYYY-MM-DD) and time-based (Unix timestamp) formats
      if (existingEvent?.kind === 31922) {
        // Date-based event
        return new Date(dateString + 'T12:00:00');
      } else {
        // Time-based event - Unix timestamp in seconds
        return new Date(parseInt(dateString, 10) * 1000);
      }
    };

    if (existingEvent) {
      setTitle(existingEvent.title || '');
      setDescription(existingEvent.description || '');
      setStartDate(initializeDate(existingEvent.startDate));
      if (existingEvent.endDate) {
        setEndDate(initializeDate(existingEvent.endDate));
      } else {
        const start = initializeDate(existingEvent.startDate);
        setEndDate(new Date(start.getTime() + 2 * 60 * 60 * 1000));
      }
      setLocation(existingEvent.location || '');
      setImageUrl(existingEvent.image || '');
      setIsDateBased(existingEvent.kind === 31922);
    } else {
      // Reset form for new event creation
      setTitle('');
      setDescription('');
      setStartDate(getNextRoundedHour());
      const start = getNextRoundedHour();
      setEndDate(new Date(start.getTime() + 2 * 60 * 60 * 1000));
      setLocation('');
      setImageUrl('');
      setIsDateBased(false);
    }
  }, [existingEvent]);

  // Date picker visibility state
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const handleClose = () => {
    if (isCreating) return;
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setTitle('');
    setSummary('');
    setDescription('');
    const nextHour = getNextRoundedHour();
    setStartDate(nextHour);
    setEndDate(new Date(nextHour.getTime() + 2 * 60 * 60 * 1000));
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
      const url = new URL(string);
      return Boolean(url);
    } catch {
      return false;
    }
  };

  const handleSaveEvent = async () => {
    if (!isLoggedIn) {
      Alert.alert('Error', 'You must be logged in to save events.');
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

      Alert.alert(
        'Success',
        existingEvent
          ? 'Event updated successfully!'
          : 'Event created successfully!'
      );
      resetForm();
      onClose();
      onEventCreated?.();
    } catch (error) {
      console.error('Failed to save event:', error);
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : existingEvent
            ? 'Failed to update event. Please try again.'
            : 'Failed to create event. Please try again.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartDateInOneHour = () => {
    const newStart = new Date(Date.now() + 60 * 60 * 1000);
    setStartDate(newStart);
    if (hasEndDate && endDate <= newStart) {
      setEndDate(new Date(newStart.getTime() + 2 * 60 * 60 * 1000));
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
    setEndDate(new Date(endDate.getTime() + 60 * 60 * 1000));
  };

  // Date picker handlers
  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      const newStartDate = new Date(startDate);
      newStartDate.setFullYear(selectedDate.getFullYear());
      newStartDate.setMonth(selectedDate.getMonth());
      newStartDate.setDate(selectedDate.getDate());
      setStartDate(newStartDate);

      // Auto-adjust end date if it's before the new start date
      if (hasEndDate && endDate <= newStartDate) {
        setEndDate(new Date(newStartDate.getTime() + 2 * 60 * 60 * 1000));
      }
    }
  };

  const handleStartTimeChange = (event: any, selectedDate?: Date) => {
    setShowStartTimePicker(false);
    if (selectedDate) {
      const newStartDate = new Date(startDate);
      newStartDate.setHours(selectedDate.getHours());
      newStartDate.setMinutes(selectedDate.getMinutes());
      setStartDate(newStartDate);

      // Auto-adjust end date if it's before the new start date
      if (hasEndDate && endDate <= newStartDate) {
        setEndDate(new Date(newStartDate.getTime() + 2 * 60 * 60 * 1000));
      }
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      const newEndDate = new Date(endDate);
      newEndDate.setFullYear(selectedDate.getFullYear());
      newEndDate.setMonth(selectedDate.getMonth());
      newEndDate.setDate(selectedDate.getDate());
      setEndDate(newEndDate);
    }
  };

  const handleEndTimeChange = (event: any, selectedDate?: Date) => {
    setShowEndTimePicker(false);
    if (selectedDate) {
      const newEndDate = new Date(endDate);
      newEndDate.setHours(selectedDate.getHours());
      newEndDate.setMinutes(selectedDate.getMinutes());
      setEndDate(newEndDate);
    }
  };

  const handleSetStartToNow = () => {
    const nextHour = getNextRoundedHour();
    setStartDate(nextHour);
    if (hasEndDate && endDate <= nextHour) {
      setEndDate(new Date(nextHour.getTime() + 2 * 60 * 60 * 1000));
    }
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
            <Text style={styles.modalTitle}>
              {existingEvent ? 'Edit Event' : 'Create Event'}
            </Text>
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

              {/* Date Selection */}
              <TouchableOpacity
                style={styles.formDateButton}
                onPress={() => setShowStartDatePicker(true)}
                disabled={isCreating}
              >
                <Text style={styles.formDateText}>
                  📅 {startDate.toDateString()}
                </Text>
              </TouchableOpacity>

              {/* Time Selection - only show for time-based events */}
              {!isDateBased && (
                <TouchableOpacity
                  style={[styles.formDateButton, styles.formTimeButton]}
                  onPress={() => setShowStartTimePicker(true)}
                  disabled={isCreating}
                >
                  <Text style={styles.formDateText}>
                    🕒{' '}
                    {startDate.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Quick Select Buttons */}
              <View style={styles.quickSelectRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.quickSelectButton]}
                  onPress={handleSetStartToNow}
                  disabled={isCreating}
                >
                  <Text style={styles.modalButtonText}>Next hour</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.quickSelectButton]}
                  onPress={handleStartDateInOneHour}
                  disabled={isCreating}
                >
                  <Text style={styles.modalButtonText}>In 1 hour</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.quickSelectButton]}
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

                {/* Date Selection */}
                <TouchableOpacity
                  style={styles.formDateButton}
                  onPress={() => setShowEndDatePicker(true)}
                  disabled={isCreating}
                >
                  <Text style={styles.formDateText}>
                    📅 {endDate.toDateString()}
                  </Text>
                </TouchableOpacity>

                {/* Time Selection - only show for time-based events */}
                {!isDateBased && (
                  <TouchableOpacity
                    style={[styles.formDateButton, styles.formTimeButton]}
                    onPress={() => setShowEndTimePicker(true)}
                    disabled={isCreating}
                  >
                    <Text style={styles.formDateText}>
                      🕒{' '}
                      {endDate.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Quick Select Button */}
                <View style={styles.endDateQuickSelectRow}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.quickSelectButton]}
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
              onPress={handleSaveEvent}
              disabled={isCreating || !title.trim() || !isLoggedIn}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>
                  {existingEvent ? 'Update Event' : 'Create Event'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Native DateTimePicker Components */}
      {showStartDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleStartDateChange}
        />
      )}

      {showStartTimePicker && (
        <DateTimePicker
          value={startDate}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleStartTimeChange}
        />
      )}

      {showEndDatePicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleEndDateChange}
          minimumDate={startDate}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={endDate}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleEndTimeChange}
        />
      )}
    </Modal>
  );
}
