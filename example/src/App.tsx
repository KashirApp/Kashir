import React, { useState } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { PostsScreen } from './components/PostsScreen';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userNpub, setUserNpub] = useState('');

  const handleLogin = (npub: string) => {
    setUserNpub(npub);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserNpub('');
  };

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <PostsScreen userNpub={userNpub} onLogout={handleLogout} />;
} 