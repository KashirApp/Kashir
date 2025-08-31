import React, { memo } from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NostrStackParamList } from './NostrNavigator';
import type { RootStackParamList } from '../App';
import { TappableContent } from './TappableContent';
import { ProfileService } from '../services/ProfileService';

interface EmbeddedPostProps {
  post: {
    event: {
      id: string;
      content: string;
      created_at: number;
      pubkey: string;
      kind: number;
    };
    originalEvent: any;
  };
  authorName?: string;
  profileService: ProfileService;
}

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString();
};

const EmbeddedPostComponent = ({
  post,
  authorName,
  profileService,
}: EmbeddedPostProps) => {
  const navigation =
    useNavigation<
      CompositeNavigationProp<
        NativeStackNavigationProp<NostrStackParamList>,
        NativeStackNavigationProp<RootStackParamList>
      >
    >();

  const handlePostPress = () => {
    navigation.navigate('PostDetail', {
      post: {
        event: post.event,
        stats: {
          event_id: post.event.id,
          likes: 0,
          reposts: 0,
          replies: 0,
          mentions: 0,
          zaps: 0,
          satszapped: 0,
          score: 0,
          score24h: 0,
        },
        authorName,
        // Cast to any to add originalEvent like other components do
        ...(post as any),
      },
    });
  };

  const handleAuthorPress = () => {
    try {
      const authorPubkey = post.originalEvent.author();
      const authorNpub = authorPubkey.toBech32();

      navigation.push('UserPosts', {
        userNpub: authorNpub,
        userName: authorName || 'Loading...',
      });
    } catch (error) {
      console.error('Failed to navigate to user posts:', error);
    }
  };

  return (
    <View style={styles.embeddedPostContainer}>
      <TouchableOpacity onPress={handlePostPress} activeOpacity={0.7}>
        <View style={styles.embeddedPostHeader}>
          {authorName ? (
            <TouchableOpacity onPress={handleAuthorPress} activeOpacity={0.7}>
              <Text style={styles.embeddedPostAuthor}>@{authorName}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.embeddedPostAuthor}>
              @{post.event.pubkey.slice(0, 8)}...
            </Text>
          )}
          <Text style={styles.embeddedPostDate}>
            {formatTimestamp(post.event.created_at)}
          </Text>
        </View>
        <TappableContent
          content={post.event.content}
          textStyle={styles.embeddedPostContent}
          profileService={profileService}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  embeddedPostContainer: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#81b0ff',
  },
  embeddedPostHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  embeddedPostAuthor: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#81b0ff',
  },
  embeddedPostDate: {
    fontSize: 10,
    color: '#999',
  },
  embeddedPostContent: {
    fontSize: 14,
    lineHeight: 20,
    color: '#ccc',
  },
});

export const EmbeddedPost = memo(
  EmbeddedPostComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.post.event.id === nextProps.post.event.id &&
      prevProps.post.event.content === nextProps.post.event.content &&
      prevProps.authorName === nextProps.authorName &&
      prevProps.profileService === nextProps.profileService
    );
  }
);
