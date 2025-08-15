import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PostsScreen } from './PostsScreen';
import { EventDetail } from './EventDetail';
import { EventMapScreen } from './EventMapScreen';
import { LoginScreen } from './LoginScreen';
import { LoginType } from '../services/NostrClient';
import type { CalendarEvent } from '../hooks/useEvents';

export type NostrStackParamList = {
  PostsMain: {
    userNpub: string;
    loginType: LoginType;
  };
  EventDetail: {
    event: CalendarEvent;
    userNpub: string;
  };
  EventMap: {
    userNpub: string;
    onEventSelect: (event: CalendarEvent) => void;
  };
  Login: undefined;
};

const Stack = createNativeStackNavigator<NostrStackParamList>();

interface NostrNavigatorProps {
  isLoggedIn: boolean;
  userNpub: string;
  loginType: LoginType;
  onLogin: (npub: string, loginType: LoginType) => Promise<void>;
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
      {...({} as any)}
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2a2a2a',
        },
        headerTintColor: '#81b0ff',
        headerTitleStyle: {
          fontWeight: 'bold',
          color: '#ffffff',
        },
        animation: 'slide_from_right',
      }}
    >
      {isLoggedIn ? (
        <>
          <Stack.Screen
            name="PostsMain"
            initialParams={{
              userNpub,
              loginType,
            }}
            options={{
              headerShown: false, // PostsScreen has its own header
            }}
          >
            {(props) => <PostsScreen {...props} onLogout={onLogout} />}
          </Stack.Screen>
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
        </>
      ) : (
        <Stack.Screen
          name="Login"
          options={{
            headerShown: false, // LoginScreen has its own styling
          }}
        >
          {(props) => <LoginScreen {...props} onLogin={onLogin} />}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
}
