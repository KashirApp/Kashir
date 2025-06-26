import React, { useState } from 'react';
import { View } from 'react-native';
import { LoginScreen } from './components/LoginScreen';
import { PostsScreen } from './components/PostsScreen';
import { WalletScreen } from './components/WalletScreen';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userNpub, setUserNpub] = useState('');
  const [showWallet, setShowWallet] = useState(false);

  const handleLogin = (npub: string) => {
    setUserNpub(npub);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
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