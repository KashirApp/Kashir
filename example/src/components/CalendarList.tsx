import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { ProfileService } from '../services/ProfileService';
import type { Calendar } from '../hooks/useCalendars';

interface CalendarListProps {
  calendars: Calendar[];
  loading: boolean;
  profileService: ProfileService;
  title?: string;
  onCalendarPress?: (calendar: Calendar) => void;
  showMyCalendarsOnly?: boolean;
  onMyCalendarsPress?: () => void;
  onEditCalendar?: (calendar: Calendar) => void; // Add edit calendar callback
  userNpub?: string;
  onEventsModePress?: () => void; // Callback for switching back to events view
}

export function CalendarList({
  calendars,
  loading,
  profileService,
  title = 'Calendars',
  onCalendarPress,
  showMyCalendarsOnly = false,
  onMyCalendarsPress,
  onEditCalendar,
  userNpub,
  onEventsModePress,
}: CalendarListProps) {
  const getOrganizerName = (pubkey: string) => {
    const cached = profileService.getProfileCache().get(pubkey);
    return cached?.name || `${pubkey.substring(0, 8)}...`;
  };

  // Helper function to check if user can edit this calendar
  const canEditCalendar = (calendar: Calendar): boolean => {
    if (!showMyCalendarsOnly || !userNpub) return false;

    // Convert userNpub to hex for comparison
    try {
      const { PublicKey } = require('kashir');
      const userPubkey = PublicKey.parse(userNpub);
      return calendar.pubkey === userPubkey.toHex();
    } catch {
      return false;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#81b0ff" />
        <Text style={styles.loadingText}>Loading calendars...</Text>
      </View>
    );
  }

  if (calendars.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>📅 No calendars found</Text>
        <Text style={styles.emptySubtext}>
          Calendars will appear here when they are created
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.leftButtons}>
          {onMyCalendarsPress && (
            <TouchableOpacity
              style={styles.myCalendarsButton}
              onPress={onMyCalendarsPress}
              activeOpacity={0.7}
            >
              <Text style={styles.myCalendarsButtonText}>👤</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.centerSection}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, !onEventsModePress && styles.tabDisabled]}
              onPress={onEventsModePress}
              activeOpacity={onEventsModePress ? 0.7 : 1}
            >
              <Text
                style={[
                  styles.tabText,
                  !onEventsModePress && styles.tabTextDisabled,
                ]}
              >
                🍻
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                styles.activeTab, // Calendars tab is always active since this is CalendarList
              ]}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, styles.activeTabText]}>📅</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.headerText}>
            {title} ({calendars.length})
          </Text>
        </View>
        <View style={styles.headerButtons}>
          {/* Right section with consistent width */}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {calendars.map((calendar) => (
          <TouchableOpacity
            key={calendar.id}
            style={styles.calendarItem}
            onPress={() => onCalendarPress?.(calendar)}
            activeOpacity={0.7}
          >
            <View style={styles.calendarRow}>
              <View style={styles.calendarContent}>
                <View style={styles.calendarHeader}>
                  <Text style={styles.calendarIndicator}>📅</Text>
                  <Text style={styles.calendarTitle} numberOfLines={2}>
                    {calendar.title || 'Untitled Calendar'}
                  </Text>
                </View>

                {calendar.description && (
                  <Text style={styles.calendarDescription} numberOfLines={2}>
                    {calendar.description}
                  </Text>
                )}

                <View style={styles.calendarMeta}>
                  <Text style={styles.eventCount}>
                    {calendar.eventCoordinates?.length || 0} events
                  </Text>
                  <Text style={styles.createdAt}>
                    Created:{' '}
                    {new Date(calendar.created_at * 1000).toLocaleDateString()}
                  </Text>
                </View>

                <View style={styles.calendarFooter}>
                  <Text style={styles.organizer}>
                    by {getOrganizerName(calendar.pubkey)}
                  </Text>
                  <Text style={styles.calendarId}>
                    ID: {calendar.uuid?.substring(0, 8)}...
                  </Text>
                </View>
              </View>

              {canEditCalendar(calendar) && (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    onEditCalendar?.(calendar);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.editButtonText}>⚙️</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#2a2a2a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80, // Ensure consistent width
  },
  myCalendarsButton: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  myCalendarsButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120, // Ensure consistent width to match EventList right section
    justifyContent: 'flex-end',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 2,
    marginBottom: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 18,
    marginHorizontal: 2,
  },
  activeTab: {
    backgroundColor: '#81b0ff',
  },
  tabText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#000',
  },
  tabDisabled: {
    opacity: 0.5,
  },
  tabTextDisabled: {
    color: '#666',
  },
  headerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  calendarItem: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  calendarContent: {
    flex: 1,
    paddingRight: 12,
  },
  editButton: {
    padding: 8,
    marginTop: 4,
  },
  editButtonText: {
    fontSize: 18,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  calendarIndicator: {
    fontSize: 18,
    marginRight: 8,
    marginTop: 2,
  },
  calendarTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    lineHeight: 22,
  },
  calendarDescription: {
    color: '#999',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  calendarMeta: {
    marginBottom: 8,
  },
  eventCount: {
    color: '#81b0ff',
    fontSize: 12,
    fontWeight: '500',
  },
  createdAt: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  calendarFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  organizer: {
    color: '#999',
    fontSize: 12,
  },
  calendarId: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
});
