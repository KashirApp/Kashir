import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { styles } from '../App.styles';

interface UrlMetadata {
  title?: string;
  description?: string;
  image?: string;
  url: string;
}

// Helper function to extract hostname from URL (React Native compatible)
const extractHostname = (url: string): string => {
  try {
    // Remove protocol
    let hostname = url.replace(/^https?:\/\//, '');
    // Remove path and parameters
    hostname = hostname.split('/')[0];
    // Remove port if present
    hostname = hostname.split(':')[0];
    return hostname;
  } catch {
    return url;
  }
};

interface UrlPreviewProps {
  url: string;
}

export function UrlPreview({ url }: UrlPreviewProps) {
  const [metadata, setMetadata] = useState<UrlMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUrlMetadata(url);
  }, [url]);

  const fetchUrlMetadata = async (urlToFetch: string) => {
    try {
      setLoading(true);
      setError(null);

      // Use a simple approach - try to fetch basic metadata
      // In a production app, you'd want to use a proper service or API
      const response = await fetch(urlToFetch);
      const html = await response.text();

      // Extract basic metadata using regex (simplified approach)
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const descriptionMatch = html.match(
        /<meta[^>]*name=['"](description|og:description)['"][^>]*content=['"]([^'"]+)['"]/i
      );
      const imageMatch = html.match(
        /<meta[^>]*property=['"](og:image|twitter:image)['"][^>]*content=['"]([^'"]+)['"]/i
      );

      const extractedMetadata: UrlMetadata = {
        url: urlToFetch,
        title: titleMatch ? titleMatch[1].trim() : undefined,
        description: descriptionMatch ? descriptionMatch[2].trim() : undefined,
        image: imageMatch ? imageMatch[2].trim() : undefined,
      };

      setMetadata(extractedMetadata);
    } catch (err) {
      console.error('Failed to fetch URL metadata:', err);
      setError('Failed to load preview');
      // Fallback to basic URL display
      setMetadata({
        url: urlToFetch,
        title: urlToFetch,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePress = async () => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', "Can't open this URL");
      }
    } catch (linkError) {
      console.error('Failed to open URL:', linkError);
      Alert.alert('Error', 'Failed to open URL');
    }
  };

  if (loading) {
    return (
      <View style={styles.urlPreviewContainer}>
        <View style={styles.urlPreviewLoading}>
          <Text style={styles.urlPreviewLoadingText}>Loading preview...</Text>
        </View>
      </View>
    );
  }

  if (error && !metadata) {
    return (
      <TouchableOpacity
        style={styles.urlPreviewContainer}
        onPress={handlePress}
      >
        <View style={styles.urlPreviewError}>
          <Text style={styles.urlPreviewErrorText}>🔗 {url}</Text>
          <Text style={styles.urlPreviewErrorSubtext}>Tap to open</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (!metadata) return null;

  return (
    <TouchableOpacity
      style={styles.urlPreviewContainer}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.urlPreviewCard}>
        {metadata.image && (
          <Image
            source={{ uri: metadata.image }}
            style={styles.urlPreviewImage as any}
            resizeMode="cover"
          />
        )}
        <View style={styles.urlPreviewContent}>
          <Text style={styles.urlPreviewTitle} numberOfLines={2}>
            {metadata.title || url}
          </Text>
          {metadata.description && (
            <Text style={styles.urlPreviewDescription} numberOfLines={3}>
              {metadata.description}
            </Text>
          )}
          <Text style={styles.urlPreviewUrl} numberOfLines={1}>
            {extractHostname(url)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
