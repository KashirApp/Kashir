import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PostsScreen } from './PostsScreen';
import { PostDetail } from './PostDetail';
import { EventDetail } from './EventDetail';
import { EventMapScreen } from './EventMapScreen';
import { LoginScreen } from './LoginScreen';
import { LoginType } from '../services/NostrClient';
import { PostActionService } from '../services/PostActionService';
import type { CalendarEvent } from '../hooks/useEvents';
import type { PostWithStats } from '../types/EventStats';

export type NostrStackParamList = {
  PostsMain: {
    userNpub: string;
    loginType: LoginType;
  };
  PostDetail: {
    post: PostWithStats;
  };
  EventDetail: {
    event: CalendarEvent;
    userNpub: string;
    isLoggedIn: boolean;
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
            name="PostDetail"
            options={{
              title: 'Post Details',
            }}
            component={PostDetail}
          />
          <Stack.Screen
            name="EventDetail"
            options={{
              title: 'Event Details',
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
          </Stack.Screen>
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
