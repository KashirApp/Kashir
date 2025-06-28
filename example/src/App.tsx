import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { LoginScreen } from './components/LoginScreen';
import { PostsScreen } from './components/PostsScreen';
import { WalletScreen } from './components/WalletScreen';
import { BottomTabNavigation } from './components/BottomTabNavigation';
import { StorageService } from './services/StorageService';
import type { MainTabType } from './types';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userNpub, setUserNpub] = useState('');
  const [activeMainTab, setActiveMainTab] = useState<MainTabType>('nostr');
  const [isLoadingStoredNpub, setIsLoadingStoredNpub] = useState(true);

  // Check for stored npub on app startup
  useEffect(() => {
    const checkStoredNpub = async () => {
      try {
        const storedNpub = await StorageService.loadNpub();
        if (storedNpub) {
          setUserNpub(storedNpub);
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.error('Error loading stored npub:', error);
      } finally {
        setIsLoadingStoredNpub(false);
      }
    };

    checkStoredNpub();
  }, []);

  const handleLogin = async (npub: string) => {
    try {
      // Save npub to storage
      await StorageService.saveNpub(npub);
      setUserNpub(npub);
      setIsLoggedIn(true);
    } catch (error) {
      console.error('Error saving npub:', error);
      // Continue with login even if storage fails
      setUserNpub(npub);
      setIsLoggedIn(true);
    }
  };

  const handleLogout = async () => {
    try {
      // Remove npub from storage
      await StorageService.removeNpub();
    } catch (error) {
      console.error('Error removing npub from storage:', error);
    }
    
    setIsLoggedIn(false);
    setUserNpub('');
    // Keep current tab - don't reset to nostr automatically
  };

  const handleMainTabChange = (tab: MainTabType) => {
    setActiveMainTab(tab);
  };

  // Show loading state while checking for stored npub
  if (isLoadingStoredNpub) {
    return <View style={{ flex: 1, backgroundColor: '#1a1a1a' }} />;
  }

  const renderActiveTab = () => {
    if (activeMainTab === 'wallet') {
      return <WalletScreen />;
    }
    
    // Nostr tab
    if (isLoggedIn) {
      return <PostsScreen userNpub={userNpub} onLogout={handleLogout} />;
    } else {
      return <LoginScreen onLogin={handleLogin} />;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
      <View style={{ flex: 1 }}>
        {renderActiveTab()}
      </View>
      
      <BottomTabNavigation
        activeTab={activeMainTab}
        onTabChange={handleMainTabChange}
      />
    </View>
  );
} 