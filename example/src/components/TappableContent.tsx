import React from 'react';
import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NostrStackParamList } from './NostrNavigator';
import type { RootStackParamList } from '../App';
import { NostrPublicKey as PublicKey } from 'kashir';
import { ProfileService } from '../services/ProfileService';
import { styles } from '../App.styles';

interface TappableContentProps {
  content: string;
  textStyle: any;
  profileService: ProfileService;
}

type NavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<NostrStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * Component that renders text content with tappable @username mentions
 */
export function TappableContent({
  content,
  textStyle,
  profileService,
}: TappableContentProps) {
  const navigation = useNavigation<NavigationProp>();

  // Parse content to find @username mentions
  const parseContent = (text: string) => {
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const parts: Array<{
      text: string;
      isMention: boolean;
      username?: string;
    }> = [];
    let lastIndex = 0;
    let match;

    // Get profile cache to check if mentions are valid
    const profileCache = profileService.getProfileCache();

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        parts.push({
          text: text.slice(lastIndex, match.index),
          isMention: false,
        });
      }

      const username = match[1];
      const fullMatch = match[0]; // @username

      // Check if this username exists in the profile cache
      let isValidMention = false;
      for (const [, profile] of profileCache.entries()) {
        if (profile.name === username) {
          isValidMention = true;
          break;
        }
      }

      // Only treat as mention if the username exists in profile cache
      if (isValidMention) {
        parts.push({
          text: fullMatch,
          isMention: true,
          username: username,
        });
      } else {
        // Treat as regular text if username not found in cache
        parts.push({
          text: fullMatch,
          isMention: false,
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        text: text.slice(lastIndex),
        isMention: false,
      });
    }

    return parts;
  };

  const handleMentionPress = (username: string) => {
    // Try to find the user's pubkey from the profile cache
    const profileCache = profileService.getProfileCache();

    // Search through cached profiles to find matching username
    for (const [pubkeyHex, profile] of profileCache.entries()) {
      if (profile.name === username) {
        try {
          // Convert hex pubkey to npub format using Kashir's PublicKey
          const publicKey = PublicKey.parse('hex:' + pubkeyHex);
          const userNpub = publicKey.toBech32();

          navigation.push('UserPosts', {
            userNpub: userNpub,
            userName: username, // Always use the original @username we clicked on
          });
          return;
        } catch {
          // Fall back to using hex directly
          navigation.push('UserPosts', {
            userNpub: pubkeyHex,
            userName: username, // Always use the original @username we clicked on
          });
          return;
        }
      }
    }

    // If profile not found in cache, we can't navigate since we don't know the npub
  };

  const contentParts = parseContent(content);

  return (
    <Text style={textStyle}>
      {contentParts.map((part, index) => {
        if (part.isMention && part.username) {
          return (
            <Text
              key={index}
              style={[textStyle, styles.mentionText]}
              onPress={() => handleMentionPress(part.username!)}
            >
              {part.text}
            </Text>
          );
        } else {
          return (
            <Text key={index} style={textStyle}>
              {part.text}
            </Text>
          );
        }
      })}
    </Text>
  );
}
