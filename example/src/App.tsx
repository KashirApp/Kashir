import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { LoginScreen } from './components/LoginScreen';
import { PostsScreen } from './components/PostsScreen';
import { WalletScreen } from './components/WalletScreen';
import { StorageService } from './services/StorageService';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userNpub, setUserNpub] = useState('');
  const [showWallet, setShowWallet] = useState(false);
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
    setShowWallet(false);
  };

  const handleShowWallet = () => {
    setShowWallet(true);
  };

  const handleCloseWallet = () => {
    setShowWallet(false);
  };

  // Show loading state while checking for stored npub
  if (isLoadingStoredNpub) {
    return <View style={{ flex: 1, backgroundColor: '#1a1a1a' }} />;
  }

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
      {/* Keep PostsScreen always mounted */}
      <View style={{ flex: 1 }}>
        <PostsScreen userNpub={userNpub} onLogout={handleLogout} onShowWallet={handleShowWallet} />
      </View>
      
      {/* WalletScreen overlays on top when needed */}
      {showWallet && (
        <View style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0,
          backgroundColor: '#1a1a1a',
          zIndex: 999
        }}>
          <WalletScreen onClose={handleCloseWallet} />
        </View>
      )}
    </View>
  );
} 