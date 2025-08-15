import React, { useState, useEffect } from 'react';
import { View, Linking, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { NostrNavigator } from './components/NostrNavigator';
import { WalletScreen } from './components/WalletScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { BottomTabNavigation } from './components/BottomTabNavigation';
import { NostrClientService, LoginType } from './services/NostrClient';
import { PublicKey } from 'kashir';
import type { MainTabType } from './types';

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
        <View style={styles.container}>
          <View style={styles.fullContainer}>
            {/* Keep WalletScreen always mounted to preserve state */}
            <View
              style={[
                styles.fullContainer,
                activeMainTab === 'wallet'
                  ? styles.tabContent
                  : styles.hiddenTabContent,
              ]}
            >
              <WalletScreen />
            </View>

            {/* Nostr content - show based on login state */}
            <View
              style={[
                styles.fullContainer,
                activeMainTab === 'nostr'
                  ? styles.tabContent
                  : styles.hiddenTabContent,
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

            {/* Settings Screen */}
            <View
              style={[
                styles.fullContainer,
                activeMainTab === 'settings'
                  ? styles.tabContent
                  : styles.hiddenTabContent,
              ]}
            >
              <SettingsScreen isVisible={activeMainTab === 'settings'} />
            </View>
          </View>

          <BottomTabNavigation
            activeTab={activeMainTab}
            onTabChange={handleMainTabChange}
          />
        </View>
      </SafeAreaProvider>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  fullContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  hiddenTabContent: {
    position: 'absolute',
    left: -10000,
    top: -10000,
  },
});
