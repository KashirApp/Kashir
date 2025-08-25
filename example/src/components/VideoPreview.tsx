import React, { useState, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Video from 'react-native-video';
import { styles } from '../App.styles';
import { VideoModal } from './VideoModal';

interface VideoPreviewProps {
  videoUrls: string[];
  maxVideos?: number;
}

function VideoPreviewComponent({
  videoUrls,
  maxVideos = 2,
}: VideoPreviewProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string>('');

  const displayUrls = videoUrls.slice(0, maxVideos);
  const remainingCount = videoUrls.length - maxVideos;

  const handleVideoPress = useCallback((url: string) => {
    setSelectedVideoUrl(url);
    setModalVisible(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalVisible(false);
    setSelectedVideoUrl('');
  }, []);

  const getVideoStyle = useCallback(() => {
    if (displayUrls.length === 1) {
      return styles.videoLarge;
    } else {
      return styles.videoMedium;
    }
  }, [displayUrls.length]);

  const getContainerStyle = useCallback(() => {
    if (displayUrls.length === 1) {
      return styles.videoContainerSingle;
    } else {
      return styles.videoContainerDouble;
    }
  }, [displayUrls.length]);

  const videoStyle = getVideoStyle();
  const containerStyle = getContainerStyle();

  if (videoUrls.length === 0) {
    return null;
  }

  return (
    <View style={styles.videoPreviewContainer}>
      <View style={containerStyle}>
        {displayUrls.map((url, index) => (
          <View
            key={`${url}-${index}`}
            style={[styles.videoWrapper, videoStyle]}
          >
            {/* Always show video preview, handle errors during playback */}
            <View style={styles.videoThumbnailContainer}>
              {/* Fallback solid background - Primal style */}
              <View style={[styles.videoPlaceholder, videoStyle]} />

              {/* Always render Video component to show thumbnail/first frame */}
              <Video
                source={{ uri: url }}
                style={[styles.postVideo, videoStyle]}
                resizeMode="cover"
                paused={true} // Always paused for preview
                muted={true} // Always muted for preview
                controls={false}
                repeat={false}
                poster={url} // Use video URL as poster to show first frame
              />

              <TouchableOpacity
                onPress={() => handleVideoPress(url)}
                style={styles.videoTouchable}
                activeOpacity={0.8}
              >
                <View style={styles.videoOverlay}>
                  <View style={styles.videoPlayButton}>
                    <Text style={styles.videoPlayButtonText}>▶️</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
      {remainingCount > 0 && displayUrls.length === maxVideos && (
        <Text style={styles.moreVideosIndicator}>
          And {remainingCount} more video{remainingCount > 1 ? 's' : ''}
        </Text>
      )}

      <VideoModal
        visible={modalVisible}
        videoUrl={selectedVideoUrl}
        onClose={handleModalClose}
      />
    </View>
  );
}

export const VideoPreview = memo(
  VideoPreviewComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.videoUrls.length === nextProps.videoUrls.length &&
      prevProps.videoUrls.every(
        (url, index) => url === nextProps.videoUrls[index]
      ) &&
      prevProps.maxVideos === nextProps.maxVideos
    );
  }
);
