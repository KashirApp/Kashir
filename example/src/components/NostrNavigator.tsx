import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PostsScreen } from './PostsScreen';
import { EventDetail } from './EventDetail';
import { EventMapScreen } from './EventMapScreen';
import { LoginScreen } from './LoginScreen';
import { UserPostsScreen } from './UserPostsScreen';
import { LoginType } from '../services/NostrClient';
import type { CalendarEvent } from '../hooks/useEvents';

export type NostrStackParamList = {
  PostsMain: {
    userNpub: string;
    loginType: LoginType;
    onLogout: () => void;
  };
  EventDetail: {
    event: CalendarEvent;
    userNpub: string; 
  };
  EventMap: {
    userNpub: string;
    onEventSelect: (event: CalendarEvent) => void;
  };
  UserPosts: {
    userNpub: string;
    userName: string;
  };
  Login: {
    onLogin: (npub: string, loginType: LoginType) => void;
  };
};

const Stack = createNativeStackNavigator<NostrStackParamList>();

interface NostrNavigatorProps {
  isLoggedIn: boolean;
  userNpub: string;
  loginType: LoginType;
  onLogin: (npub: string, loginType: LoginType) => void;
  onLogout: () => void;
}

export function NostrNavigator({
  isLoggedIn,
  userNpub,
  loginType,
  onLogin,
  onLogout,
}: NostrNavigatorProps) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2a2a2a',
        },
        headerTintColor: '#81b0ff',
        headerTitleStyle: {
          fontWeight: 'bold',
          color: '#ffffff',
        },
        headerBackTitleVisible: false,
        animation: 'slide_from_right',
      }}
    >
      {isLoggedIn ? (
        <>
          <Stack.Screen
            name="PostsMain"
            component={PostsScreen}
            initialParams={{
              userNpub,
              loginType,
              onLogout,
            }}
            options={{
              headerShown: false, // PostsScreen has its own header
            }}
          />
          <Stack.Screen
            name="EventDetail"
            component={EventDetail}
            options={{
              title: 'Event Details',
            }}
          />
          <Stack.Screen
            name="EventMap"
            component={EventMapScreen}
            options={{
              title: 'Event Map',
            }}
          />
          <Stack.Screen
            name="UserPosts"
            component={UserPostsScreen}
            options={{
              title: 'User Posts',
            }}
          />
        </>
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          initialParams={{
            onLogin,
          }}
          options={{
            headerShown: false, // LoginScreen has its own styling
          }}
        />
      )}
    </Stack.Navigator>
  );
}