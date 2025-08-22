import React, { useState, useEffect } from 'react';
import { View, Linking, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NostrNavigator } from './components/NostrNavigator';
import { WalletScreen } from './components/WalletScreen';
import { EventsScreen } from './components/EventsScreen';
import { EventDetail } from './components/EventDetail';
import { CalendarDetail } from './components/CalendarDetail';
import { EventMapScreen } from './components/EventMapScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { BottomTabNavigation } from './components/BottomTabNavigation';
import { MyEventsScreen } from './components/MyEventsScreen';
import { MyCalendarsScreen } from './components/MyCalendarsScreen';
import { UserPostsScreen } from './components/UserPostsScreen';
import { NostrClientService, LoginType } from './services/NostrClient';
import { PostActionService } from './services/PostActionService';
import { PublicKey } from 'kashir';
import type { MainTabType } from './types';
import type { CalendarEvent } from './hooks/useEvents';
import type { Calendar } from './hooks/useCalendars';

// Root stack for the entire app
export type RootStackParamList = {
  MainApp: undefined;
  UserPosts: {
    userNpub: string;
    userName: string;
  };
  MyEvents: {
    userNpub: string;
    isLoggedIn: boolean;
  };
  MyCalendars: {
    userNpub: string;
    isLoggedIn: boolean;
  };
  EventDetail: {
    event: CalendarEvent;
    userNpub: string;
    isLoggedIn: boolean;
  };
  CalendarDetail: {
    calendar: Calendar;
    userNpub: string;
    isLoggedIn: boolean;
  };
  EventMap: {
    userNpub: string;
    onEventSelect: (event: CalendarEvent) => void;
    myEventsOnly?: boolean;
  };
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

function MainAppScreen({
  activeMainTab,
  isLoggedIn,
  userNpub,
  loginType,
  handleLogin,
  handleLogout,
  handleMainTabChange,
  navigation,
}: {
  activeMainTab: MainTabType;
  isLoggedIn: boolean;
  userNpub: string;
  loginType: LoginType;
  handleLogin: (npub: string, loginType: LoginType) => Promise<void>;
  handleLogout: () => Promise<void>;
  handleMainTabChange: (tab: MainTabType) => void;
  navigation: any;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        {/* Keep WalletScreen always mounted to preserve state */}
        <View
          style={[
            styles.fullContainer,
            activeMainTab === 'wallet' ? styles.activeTab : styles.hiddenTab,
          ]}
        >
          <WalletScreen />
        </View>

        {/* Nostr content - show based on login state */}
        <View
          style={[
            styles.fullContainer,
            activeMainTab === 'nostr' ? styles.activeTab : styles.hiddenTab,
          ]}
        >
          <NostrNavigator
            isLoggedIn={isLoggedIn}
            userNpub={userNpub}
            loginType={loginType}
            onLogin={handleLogin}
            onLogout={handleLogout}
          />
        </View>

        {/* Events Screen */}
        <View
          style={[
            styles.fullContainer,
            activeMainTab === 'events' ? styles.activeTab : styles.hiddenTab,
          ]}
        >
          <EventsScreen
            isLoggedIn={isLoggedIn}
            userNpub={userNpub}
            navigation={navigation}
          />
        </View>

        {/* Settings Screen */}
        <View
          style={[
            styles.fullContainer,
            activeMainTab === 'settings' ? styles.activeTab : styles.hiddenTab,
          ]}
        >
          <SettingsScreen
            isVisible={activeMainTab === 'settings'}
            userNpub={userNpub}
            profileLoading={false}
            onLogout={isLoggedIn ? handleLogout : undefined}
          />
        </View>
      </View>

      <BottomTabNavigation
        activeTab={activeMainTab}
        onTabChange={handleMainTabChange}
      />
    </View>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userNpub, setUserNpub] = useState('');
  const [loginType, setLoginType] = useState<LoginType>(LoginType.Amber);
  const [activeMainTab, setActiveMainTab] = useState<MainTabType>('wallet');
  const [isLoadingStoredSession, setIsLoadingStoredSession] = useState(true);

  // Custom dark theme to match existing app styling
  const customDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: '#81b0ff',
      background: '#1a1a1a',
      card: '#2a2a2a',
      text: '#ffffff',
      border: '#333333',
      notification: '#81b0ff',
    },
  };

  // Global deep link listener for debugging
  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {
      console.log('App: Received deep link:', url);
    };

    // Listen for deep links when app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check for initial URL when app launches
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('App: Initial URL:', url);
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // Check for stored session on app startup
  useEffect(() => {
    const checkStoredSession = async () => {
      try {
        const nostrClient = NostrClientService.getInstance();
        const session = await nostrClient.loadStoredSession();

        if (session && session.publicKey) {
          // Convert hex to npub for display
          const publicKey = PublicKey.parse(session.publicKey);
          const npub = publicKey.toBech32();

          // Set user data but don't mark as logged in until client is ready
          setUserNpub(npub);
          setLoginType(session.type);

          // Load user's relay list and initialize client with proper relays
          console.log('App: Loading user relay list for stored session...');
          try {
            const userRelays = await nostrClient.loadAndApplyUserRelays();
            console.log(
              `App: Loaded ${userRelays.length} user relays for stored session`
            );

            // Initialize the client with user's relays
            await nostrClient.initialize(userRelays);

            // Wait for client to be ready before marking as logged in
            const isReady = await nostrClient.waitForReady(10000); // 10 second timeout
            if (isReady) {
              console.log('App: Client ready, marking user as logged in');
              setIsLoggedIn(true);
            } else {
              console.error(
                'App: Client not ready after timeout, login failed'
              );
              setUserNpub('');
              setLoginType(LoginType.Amber);
            }
          } catch (relayError) {
            console.error(
              'App: Failed to load user relays for stored session, using default:',
              relayError
            );
            try {
              // Fallback to default initialization
              await nostrClient.initialize();
              const isReady = await nostrClient.waitForReady(10000);
              if (isReady) {
                console.log(
                  'App: Client ready with default relays, marking user as logged in'
                );
                setIsLoggedIn(true);
              } else {
                console.error(
                  'App: Client not ready with default relays, login failed'
                );
                setUserNpub('');
                setLoginType(LoginType.Amber);
              }
            } catch (fallbackError) {
              console.error(
                'App: Fallback client initialization failed:',
                fallbackError
              );
              setUserNpub('');
              setLoginType(LoginType.Amber);
            }
          }
        } else {
          // No stored session - initialize client for anonymous browsing
          console.log(
            'App: No stored session, initializing client for anonymous browsing...'
          );
          try {
            await nostrClient.initialize();
            console.log('App: Client initialized for anonymous browsing');
          } catch (error) {
            console.error(
              'App: Failed to initialize client for anonymous browsing:',
              error
            );
          }
        }
      } catch (error) {
        console.error('Error loading stored session:', error);
      } finally {
        setIsLoadingStoredSession(false);
      }
    };

    checkStoredSession();
  }, []);

  const handleLogin = async (npub: string, type: LoginType) => {
    try {
      // Set user data but don't mark as logged in until client is ready
      setUserNpub(npub);
      setLoginType(type);

      // Load and apply user's relay list after successful login
      console.log('App: Loading user relay list after login...');
      const nostrClient = NostrClientService.getInstance();
      try {
        const userRelays = await nostrClient.loadAndApplyUserRelays();
        console.log(
          `App: Loaded ${userRelays.length} user relays, reinitializing client...`
        );

        // Reinitialize client with user's relays
        await nostrClient.reconnectWithNewRelays(userRelays);

        // Wait for client to be ready before marking as logged in
        const isReady = await nostrClient.waitForReady(10000); // 10 second timeout
        if (isReady) {
          console.log(
            'App: Client ready after login, marking user as logged in'
          );
          setIsLoggedIn(true);
        } else {
          console.error('App: Client not ready after login timeout');
          setUserNpub('');
          setLoginType(LoginType.Amber);
          throw new Error('Client failed to connect to relays');
        }
      } catch (relayError) {
        console.error(
          'App: Failed to load user relays, continuing with default relays:',
          relayError
        );
        // Try to continue with login using default relays
        try {
          await nostrClient.initialize();
          const isReady = await nostrClient.waitForReady(5000); // Shorter timeout for fallback
          if (isReady) {
            console.log('App: Client ready with default relays after login');
            setIsLoggedIn(true);
          } else {
            throw new Error(
              'Client failed to connect even with default relays'
            );
          }
        } catch (fallbackError) {
          console.error('App: Fallback initialization failed:', fallbackError);
          setUserNpub('');
          setLoginType(LoginType.Amber);
          throw new Error('Login failed: unable to connect to any relays');
        }
      }
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      console.log('App: Starting logout process');
      const nostrClient = NostrClientService.getInstance();

      // Use the new async logout method that restores default relays
      await nostrClient.logout();

      console.log('App: User logged out and default relays restored');

      // Update UI state
      setIsLoggedIn(false);
      setUserNpub('');
      setLoginType(LoginType.Amber);

      // Small delay to ensure storage operations are complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log('App: Logout complete, UI updated');
    } catch (error) {
      console.error('Error during logout:', error);
      // Still update UI even if there was an error
      setIsLoggedIn(false);
      setUserNpub('');
      setLoginType(LoginType.Amber);
    }
  };

  const handleMainTabChange = (tab: MainTabType) => {
    setActiveMainTab(tab);
  };

  // Show loading state while checking for stored session
  if (isLoadingStoredSession) {
    return <View style={styles.container} />;
  }

  return (
    <NavigationContainer theme={customDarkTheme}>
      <SafeAreaProvider>
        <RootStack.Navigator
          id={undefined}
          screenOptions={{ headerShown: false }}
        >
          <RootStack.Screen name="MainApp">
            {({ navigation }) => (
              <MainAppScreen
                activeMainTab={activeMainTab}
                isLoggedIn={isLoggedIn}
                userNpub={userNpub}
                loginType={loginType}
                handleLogin={handleLogin}
                handleLogout={handleLogout}
                handleMainTabChange={handleMainTabChange}
                navigation={navigation}
              />
            )}
          </RootStack.Screen>
          <RootStack.Screen
            name="UserPosts"
            component={UserPostsScreen}
            options={{
              headerShown: true,
              title: 'User Posts',
              headerStyle: {
                backgroundColor: '#2a2a2a',
              },
              headerTintColor: '#81b0ff',
              headerTitleStyle: {
                fontWeight: 'bold',
                color: '#ffffff',
              },
            }}
          />
          <RootStack.Screen
            name="MyEvents"
            component={MyEventsScreen}
            options={{
              headerShown: true,
              title: 'My Events',
              headerStyle: {
                backgroundColor: '#2a2a2a',
              },
              headerTintColor: '#81b0ff',
              headerTitleStyle: {
                fontWeight: 'bold',
                color: '#ffffff',
              },
            }}
          />
          <RootStack.Screen
            name="MyCalendars"
            component={MyCalendarsScreen}
            options={{
              headerShown: true,
              title: 'My Calendars',
              headerStyle: {
                backgroundColor: '#2a2a2a',
              },
              headerTintColor: '#81b0ff',
              headerTitleStyle: {
                fontWeight: 'bold',
                color: '#ffffff',
              },
            }}
          />
          <RootStack.Screen
            name="EventDetail"
            options={{
              headerShown: true,
              title: 'Event Details',
              headerStyle: {
                backgroundColor: '#2a2a2a',
              },
              headerTintColor: '#81b0ff',
              headerTitleStyle: {
                fontWeight: 'bold',
                color: '#ffffff',
              },
            }}
          >
            {(props) => (
              <EventDetail
                {...props}
                onRSVP={
                  props.route.params.isLoggedIn
                    ? async (status) => {
                        try {
                          const postActionService =
                            PostActionService.getInstance();
                          const event = props.route.params.event;

                          // Create event coordinates for NIP-52: kind:pubkey:d-tag
                          // For calendar events, we use the event ID as d-tag
                          const dTag =
                            event.tags.find((tag) => tag[0] === 'd')?.[1] ||
                            event.id;
                          const eventCoordinates = `${event.kind}:${event.pubkey}:${dTag}`;

                          await postActionService.submitRSVP(
                            event.id,
                            eventCoordinates,
                            event.pubkey,
                            status
                          );
                        } catch (error) {
                          console.error('RSVP submission failed:', error);
                          throw error; // Re-throw so EventDetail can show error alert
                        }
                      }
                    : undefined
                }
              />
            )}
          </RootStack.Screen>
          <RootStack.Screen
            name="CalendarDetail"
            component={CalendarDetail}
            options={{
              headerShown: true,
              title: 'Calendar Events',
              headerStyle: {
                backgroundColor: '#2a2a2a',
              },
              headerTintColor: '#81b0ff',
              headerTitleStyle: {
                fontWeight: 'bold',
                color: '#ffffff',
              },
            }}
          />
          <RootStack.Screen
            name="EventMap"
            component={EventMapScreen}
            options={{
              headerShown: true,
              title: 'Event Map',
              headerStyle: {
                backgroundColor: '#2a2a2a',
              },
              headerTintColor: '#81b0ff',
              headerTitleStyle: {
                fontWeight: 'bold',
                color: '#ffffff',
              },
            }}
          />
        </RootStack.Navigator>
      </SafeAreaProvider>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  tabContainer: {
    flex: 1,
    position: 'relative',
  },
  fullContainer: {
    flex: 1,
  },
  activeTab: {
    position: 'relative',
    zIndex: 1,
  },
  hiddenTab: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    pointerEvents: 'none',
  },
});
