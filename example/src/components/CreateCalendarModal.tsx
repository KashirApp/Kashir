import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { styles } from '../App.styles';
import { PostActionService } from '../services/PostActionService';
import { NostrClientService } from '../services/NostrClient';
import { ProfileService } from '../services/ProfileService';
import { useEvents } from '../hooks/useEvents';
import type { CalendarData } from '../types';
import type { Calendar } from '../hooks/useCalendars';
import type { CalendarEvent } from '../hooks/useEvents';
import { Client } from 'kashir';

interface CreateCalendarModalProps {
  visible: boolean;
  onClose: () => void;
  onCalendarCreated?: () => void;
  isLoggedIn: boolean;
  userNpub?: string; // Add userNpub to fetch user's events
  existingCalendar?: Calendar; // Add support for editing existing calendars
}

export function CreateCalendarModal({
  visible,
  onClose,
  onCalendarCreated,
  isLoggedIn,
  userNpub,
  existingCalendar,
}: CreateCalendarModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Initialize services and client for fetching user's events
  const clientService = useMemo(() => NostrClientService.getInstance(), []);
  const profileService = useMemo(() => new ProfileService(), []);
  const [client, setClient] = useState<Client | null>(null);

  // Use events hook to fetch user's events
  const {
    events,
    loading: eventsLoading,
    fetchEvents,
  } = useEvents(client, profileService);

  // Validation helpers following iOS pattern
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const trimmedImageUrl = imageUrl.trim();

  const isValidImageUrl = (url: string): boolean => {
    try {
      const validUrl = new URL(url);
      return Boolean(validUrl);
    } catch {
      return false;
    }
  };

  const canSave =
    trimmedTitle.length > 0 &&
    (trimmedImageUrl.length === 0 || isValidImageUrl(trimmedImageUrl));

  // Get modal title based on mode (create vs edit)
  const modalTitle = existingCalendar ? 'Edit Calendar' : 'Create Calendar';
  const actionButtonText = existingCalendar
    ? 'Update Calendar'
    : 'Create Calendar';

  // Initialize client when modal opens
  useEffect(() => {
    if (visible && !client) {
      const currentClient = clientService.getClient();
      if (currentClient && clientService.isReady()) {
        setClient(currentClient);
      }
    }
  }, [visible, clientService, client]);

  // Fetch user's events when client is ready and modal is visible
  useEffect(() => {
    if (visible && client && userNpub && isLoggedIn) {
      fetchEvents(userNpub, true); // Fetch only user's events
    }
  }, [visible, client, userNpub, isLoggedIn, fetchEvents]);

  // Helper function to generate event coordinates from CalendarEvent
  const generateEventCoordinates = (event: CalendarEvent): string => {
    // Event coordinates format: kind:pubkey:d-tag
    // For replaceable events, use d-tag if available, otherwise use event id
    const dTag = event.tags.find((tag) => tag[0] === 'd')?.[1];
    const identifier = dTag ? dTag : event.id;
    return `${event.kind}:${event.pubkey}:${identifier}`;
  };

  // Filter user's events (exclude events already in other calendars if needed)
  const userEvents = events.filter((event) => {
    try {
      const { PublicKey } = require('kashir');
      const userPubkey = PublicKey.parse(userNpub || '');
      return event.pubkey === userPubkey.toHex();
    } catch {
      return false;
    }
  });

  // Initialize form with existing calendar data
  useEffect(() => {
    if (existingCalendar) {
      setTitle(existingCalendar.title || '');
      setDescription(existingCalendar.description || '');
      // Try to extract image URL from tags
      const imageTag = existingCalendar.tags.find((tag) => tag[0] === 'image');
      setImageUrl(imageTag ? imageTag[1] : '');
      // Set selected events from existing calendar
      setSelectedEventIds(existingCalendar.eventCoordinates || []);
    } else {
      // Reset for new calendar
      setTitle('');
      setDescription('');
      setImageUrl('');
      setSelectedEventIds([]);
    }
    setImageError(false);
  }, [existingCalendar, visible]);

  // Reset form when modal closes
  const handleClose = () => {
    setTitle('');
    setDescription('');
    setImageUrl('');
    setSelectedEventIds([]);
    setImageError(false);
    setIsCreating(false);
    onClose();
  };

  // Handle event selection toggle
  const toggleEventSelection = (event: CalendarEvent) => {
    const eventCoord = generateEventCoordinates(event);
    setSelectedEventIds((prev) =>
      prev.includes(eventCoord)
        ? prev.filter((id) => id !== eventCoord)
        : [...prev, eventCoord]
    );
  };

  const handleCreateOrUpdate = async () => {
    if (!trimmedTitle) {
      Alert.alert('Validation Error', 'Calendar title is required');
      return;
    }

    if (trimmedImageUrl && !isValidImageUrl(trimmedImageUrl)) {
      Alert.alert('Validation Error', 'Please enter a valid image URL');
      return;
    }

    if (!isLoggedIn) {
      Alert.alert(
        'Authentication Required',
        'Please log in to create calendars'
      );
      return;
    }

    setIsCreating(true);

    try {
      const calendarData: CalendarData = {
        title: trimmedTitle,
        description: trimmedDescription || undefined,
        imageUrl: trimmedImageUrl || undefined,
        eventCoordinates: selectedEventIds,
      };

      const postActionService = PostActionService.getInstance();

      if (existingCalendar) {
        // Update existing calendar using the same UUID (replaceable event)
        await postActionService.updateCalendar(existingCalendar, calendarData);
        Alert.alert('Success', 'Calendar updated successfully!');
      } else {
        // Create new calendar
        await postActionService.createCalendar(calendarData);
        Alert.alert('Success', 'Calendar created successfully!');
      }

      handleClose();

      if (onCalendarCreated) {
        onCalendarCreated();
      }
    } catch (error) {
      console.error('Calendar creation/update error:', error);
      const action = existingCalendar ? 'update' : 'create';
      Alert.alert('Error', `Failed to ${action} calendar: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Calendar Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter calendar title"
                placeholderTextColor="#999"
                editable={!isCreating}
              />
            </View>

            {/* Calendar Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter calendar description (optional)"
                placeholderTextColor="#999"
                multiline={true}
                numberOfLines={4}
                editable={!isCreating}
              />
            </View>

            {/* Calendar Image URL */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Image URL</Text>
              <TextInput
                style={styles.input}
                value={imageUrl}
                onChangeText={(text) => {
                  setImageUrl(text);
                  setImageError(false);
                }}
                placeholder="https://example.com/image.png"
                placeholderTextColor="#999"
                textContentType="URL"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isCreating}
              />

              {/* Image Preview */}
              {trimmedImageUrl && isValidImageUrl(trimmedImageUrl) && (
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: trimmedImageUrl }}
                    style={styles.imagePreview}
                    onError={() => setImageError(true)}
                    onLoad={() => setImageError(false)}
                  />
                  {imageError && (
                    <Text style={styles.imageErrorText}>
                      Failed to load image
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Event Selection - Only show when editing and user has events */}
            {existingCalendar && userEvents.length > 0 && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Include Events ({selectedEventIds.length} selected)
                </Text>
                <Text style={styles.eventSelectionSubtext}>
                  Select events to include in this calendar
                </Text>

                <View style={styles.eventsList}>
                  {userEvents.slice(0, 10).map((event) => {
                    const eventCoord = generateEventCoordinates(event);
                    const isSelected = selectedEventIds.includes(eventCoord);

                    return (
                      <TouchableOpacity
                        key={event.id}
                        style={[
                          styles.eventItem,
                          isSelected && styles.eventItemSelected,
                        ]}
                        onPress={() => toggleEventSelection(event)}
                        disabled={isCreating}
                      >
                        <View style={styles.eventItemContent}>
                          <View style={styles.eventCheckbox}>
                            <Text style={styles.eventCheckboxText}>
                              {isSelected ? '✓' : '○'}
                            </Text>
                          </View>
                          <View style={styles.eventDetails}>
                            <Text style={styles.eventTitle} numberOfLines={1}>
                              {event.title || 'Untitled Event'}
                            </Text>
                            <Text style={styles.eventDate} numberOfLines={1}>
                              {event.startDate
                                ? new Date(
                                    parseInt(event.startDate, 10) * 1000
                                  ).toLocaleDateString()
                                : 'No date'}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {userEvents.length > 10 && (
                    <View style={styles.moreEventsIndicator}>
                      <Text style={styles.moreEventsText}>
                        Showing first 10 of {userEvents.length} events
                      </Text>
                    </View>
                  )}
                </View>

                {eventsLoading && (
                  <View style={styles.eventsLoadingContainer}>
                    <ActivityIndicator size="small" color="#81b0ff" />
                    <Text style={styles.eventsLoadingText}>
                      Loading your events...
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.button, styles.buttonSecondary]}
              disabled={isCreating}
            >
              <Text style={styles.buttonSecondaryText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCreateOrUpdate}
              style={[styles.button, styles.buttonPrimary]}
              disabled={isCreating || !canSave}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.buttonPrimaryText}>{actionButtonText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
