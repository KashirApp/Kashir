import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import {
  MintRecommendationService,
  type MintRecommendation,
} from '../../../services';

interface MintRecommendationsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectMint: (url: string) => void;
}

export function MintRecommendationsModal({
  visible,
  onClose,
  onSelectMint,
}: MintRecommendationsModalProps) {
  const [recommendations, setRecommendations] = useState<MintRecommendation[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchRecommendations();
    }
  }, [visible]);

  const fetchRecommendations = async () => {
    setIsLoading(true);
    try {
      const service = MintRecommendationService.getInstance();
      const recs = await service.fetchMintRecommendations();
      setRecommendations(recs);
    } catch (error) {
      console.error('Failed to fetch mint recommendations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectMint = (url: string) => {
    onSelectMint(url);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Recommended Mints</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading recommendations...</Text>
            </View>
          ) : recommendations.length > 0 ? (
            <View style={styles.recommendationsList}>
              {recommendations.map((rec, index) => (
                <TouchableOpacity
                  key={rec.url}
                  style={styles.recommendationItem}
                  onPress={() => handleSelectMint(rec.url)}
                >
                  <View style={styles.recommendationContent}>
                    <Text style={styles.recommendationUrl}>{rec.url}</Text>
                    <Text style={styles.recommendationCount}>
                      Recommended by {rec.count}{' '}
                      {rec.count === 1 ? 'user' : 'users'}
                    </Text>
                  </View>
                  <View style={styles.selectButton}>
                    <Text style={styles.selectButtonText}>Select</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.noRecommendationsContainer}>
              <Text style={styles.noRecommendations}>
                No recommendations available at the moment.
              </Text>
              <Text style={styles.noRecommendationsSubtext}>
                You can still enter a mint URL manually.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 16,
    color: '#007AFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 40, // Extra padding at bottom to avoid overlap with navigation bar
  },
  subtitle: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 24,
    lineHeight: 22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#888888',
    marginTop: 16,
  },
  recommendationsList: {
    gap: 12,
  },
  recommendationItem: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444444',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recommendationContent: {
    flex: 1,
    marginRight: 16,
  },
  recommendationUrl: {
    fontSize: 15,
    color: '#ffffff',
    fontFamily: 'monospace',
    marginBottom: 6,
    lineHeight: 20,
  },
  recommendationCount: {
    fontSize: 13,
    color: '#888888',
  },
  selectButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  selectButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  noRecommendationsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noRecommendations: {
    fontSize: 16,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 8,
  },
  noRecommendationsSubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
});
