import React, { useState, useEffect } from 'react';
import { View, Linking } from 'react-native';
import { LoginScreen } from './components/LoginScreen';
import { PostsScreen } from './components/PostsScreen';
import { WalletScreen } from './components/WalletScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { BottomTabNavigation } from './components/BottomTabNavigation';
import { StorageService } from './services/StorageService';
import { NostrClientService, LoginType } from './services/NostrClient';
import { PublicKey } from 'kashir';
import type { MainTabType } from './types';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userNpub, setUserNpub] = useState('');
  const [loginType, setLoginType] = useState<LoginType>(LoginType.Amber);
  const [activeMainTab, setActiveMainTab] = useState<MainTabType>('wallet');
  const [isLoadingStoredSession, setIsLoadingStoredSession] = useState(true);

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

          setUserNpub(npub);
          setLoginType(session.type);
          setIsLoggedIn(true);

          // Initialize the client
          await nostrClient.initialize();
        }
      } catch (error) {
        console.error('Error loading stored session:', error);
      } finally {
        setIsLoadingStoredSession(false);
      }
    };

    checkStoredSession();
  }, []);

  const handleLogin = async (npub: string, loginType: LoginType) => {
    try {
      setUserNpub(npub);
      setLoginType(loginType);
      setIsLoggedIn(true);
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      const nostrClient = NostrClientService.getInstance();
      nostrClient.logout();

      // Legacy cleanup
      await StorageService.removeNpub();
    } catch (error) {
      console.error('Error during logout:', error);
    }

    setIsLoggedIn(false);
    setUserNpub('');
    setLoginType(LoginType.Amber);
  };

  const handleMainTabChange = (tab: MainTabType) => {
    setActiveMainTab(tab);
  };

  // Show loading state while checking for stored session
  if (isLoadingStoredSession) {
    return <View style={{ flex: 1, backgroundColor: '#1a1a1a' }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
      <View style={{ flex: 1 }}>
        {/* Keep WalletScreen always mounted to preserve state */}
        <View
          style={{
            flex: 1,
            display: activeMainTab === 'wallet' ? 'flex' : 'none',
          }}
        >
          <WalletScreen />
        </View>

        {/* Nostr content - show based on login state */}
        <View
          style={{
            flex: 1,
            display: activeMainTab === 'nostr' ? 'flex' : 'none',
          }}
        >
          {isLoggedIn ? (
            <PostsScreen
              userNpub={userNpub}
              loginType={loginType}
              onLogout={handleLogout}
            />
          ) : (
            <LoginScreen onLogin={handleLogin} />
          )}
        </View>

        {/* Settings Screen */}
        <View
          style={{
            flex: 1,
            display: activeMainTab === 'settings' ? 'flex' : 'none',
          }}
        >
          <SettingsScreen isVisible={activeMainTab === 'settings'} />
        </View>
      </View>

      <BottomTabNavigation
        activeTab={activeMainTab}
        onTabChange={handleMainTabChange}
      />
    </View>
  );
}
