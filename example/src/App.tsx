import React, { useState } from 'react';
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

  if (showWallet) {
    return <WalletScreen onClose={handleCloseWallet} />;
  }

  return <PostsScreen userNpub={userNpub} onLogout={handleLogout} onShowWallet={handleShowWallet} />;
} 