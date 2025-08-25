import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  Text,
} from 'react-native';
import Video from 'react-native-video';
import { videoCache } from '../utils/videoCache';
import { styles } from '../App.styles';

interface VideoModalProps {
  visible: boolean;
  videoUrl: string;
  onClose: () => void;
}

export function VideoModal({ visible, videoUrl, onClose }: VideoModalProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [playbackError, setPlaybackError] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [cachedVideoUrl, setCachedVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<any>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hideControlsAfterDelay = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    hideControlsAfterDelay();
  }, [hideControlsAfterDelay]);

  const handleVideoError = useCallback(() => {
    console.log('Video error occurred, retry count:', retryCount);
    if (retryCount < 3) {
      setRetryCount((prev) => prev + 1);
      // Auto-retry after a short delay
      setTimeout(() => {
        setPlaybackError(false);
        setIsBuffering(true);
        if (videoRef.current) {
          videoRef.current.seek(currentTime);
        }
      }, 1000);
    } else {
      setPlaybackError(true);
      setIsPlaying(false);
      setIsBuffering(false);
    }
  }, [retryCount, currentTime]);

  const handleVideoLoad = useCallback((data: any) => {
    console.log('Video loaded:', data);
    setPlaybackError(false);
    setIsBuffering(false);
    setDuration(data.duration || 0);
    setRetryCount(0); // Reset retry count on successful load
  }, []);

  const handleVideoBuffer = useCallback(
    ({ isBuffering: buffering }: { isBuffering: boolean }) => {
      console.log('Video buffering:', buffering);
      setIsBuffering(buffering);
    },
    []
  );

  const handleVideoProgress = useCallback((data: any) => {
    setCurrentTime(data.currentTime || 0);
  }, []);

  const handleOpenInBrowser = useCallback(async () => {
    const { Linking } = require('react-native');
    try {
      const canOpen = await Linking.canOpenURL(videoUrl);
      if (canOpen) {
        await Linking.openURL(videoUrl);
        onClose();
      }
    } catch {
      // Silently fail - user can try other methods
    }
  }, [videoUrl, onClose]);

  const handlePlayPause = useCallback(() => {
    if (playbackError) {
      // Try to open in browser if playback failed
      handleOpenInBrowser();
      return;
    }
    setIsPlaying(!isPlaying);
    showControlsTemporarily();
  }, [isPlaying, playbackError, handleOpenInBrowser, showControlsTemporarily]);

  const handleMuteToggle = useCallback(() => {
    setIsMuted(!isMuted);
    showControlsTemporarily();
  }, [isMuted, showControlsTemporarily]);

  const handleScreenTap = useCallback(() => {
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  const handleClose = useCallback(() => {
    setIsPlaying(false);
    setPlaybackError(false);
    setIsBuffering(true);
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    onClose();
  }, [onClose]);

  // Cache video when modal opens
  useEffect(() => {
    if (visible && videoUrl) {
      const loadCachedVideo = async () => {
        try {
          // First check if we have cached version
          let cachedPath = await videoCache.getCachedVideoPath(videoUrl);

          if (cachedPath) {
            console.log('Using cached video:', cachedPath);
            setCachedVideoUrl(cachedPath);
          } else {
            // Use original URL while caching in background
            setCachedVideoUrl(videoUrl);

            // Cache video in background for next time
            videoCache
              .cacheVideo(videoUrl)
              .then((newCachedPath) => {
                if (newCachedPath && visible) {
                  console.log('Video cached for future use:', newCachedPath);
                }
              })
              .catch((error) => {
                console.warn('Failed to cache video:', error);
              });
          }
        } catch (error) {
          console.warn('Error loading cached video:', error);
          setCachedVideoUrl(videoUrl);
        }
      };

      loadCachedVideo();
    }
  }, [visible, videoUrl]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setIsPlaying(true);
      setPlaybackError(false);
      setIsBuffering(true);
      setShowControls(true);
      setCurrentTime(0);
      setDuration(0);
      setRetryCount(0);
      hideControlsAfterDelay();
    }
  }, [visible, hideControlsAfterDelay]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar hidden />
      <View style={styles.videoModalOverlay}>
        <SafeAreaView style={styles.videoModalContainer}>
          <TouchableOpacity
            style={styles.videoModalContent}
            activeOpacity={1}
            onPress={handleScreenTap}
          >
            {/* Video Player */}
            <View style={styles.videoModalVideoContainer}>
              <Video
                ref={videoRef}
                source={{ uri: cachedVideoUrl || videoUrl }}
                style={styles.videoModalVideo}
                resizeMode="contain"
                paused={!isPlaying}
                muted={isMuted}
                onLoad={handleVideoLoad}
                onError={handleVideoError}
                onBuffer={handleVideoBuffer}
                onProgress={handleVideoProgress}
                controls={true} // Use native system controls
                repeat={false}
                playInBackground={false} // Ensure no background playback
                playWhenInactive={false} // Pause when app becomes inactive
                ignoreSilentSwitch="ignore" // Keep playing even if device is muted
                allowsExternalPlayback={false} // Disable AirPlay to avoid extra buttons
                progressUpdateInterval={250} // Update progress every 250ms
                bufferConfig={{
                  minBufferMs: 15000,
                  maxBufferMs: 50000,
                  bufferForPlaybackMs: 2500,
                  bufferForPlaybackAfterRebufferMs: 5000,
                }}
              />
            </View>

            {/* Controls Overlay */}
            {showControls && (
              <View style={styles.videoModalControls}>
                {/* Header with close button */}
                <View style={styles.videoModalHeader}>
                  <TouchableOpacity
                    style={styles.videoModalCloseButton}
                    onPress={handleClose}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.videoModalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Center play/pause button */}
                {(isBuffering || playbackError || !isPlaying) && (
                  <View style={styles.videoModalCenterControls}>
                    {isBuffering ? (
                      <View style={styles.videoModalBuffering}>
                        <Text style={styles.videoModalBufferingText}>
                          Loading...
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.videoModalPlayButton}
                        onPress={handlePlayPause}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.videoModalPlayButtonText}>
                          {playbackError
                            ? retryCount < 3
                              ? '🔄'
                              : '🌐'
                            : '▶️'}
                        </Text>
                        {playbackError && retryCount < 3 && (
                          <Text style={styles.videoModalRetryText}>
                            Retrying... ({retryCount}/3)
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Bottom controls */}
                <View style={styles.videoModalBottomControls}>
                  <TouchableOpacity
                    style={styles.videoModalMuteButton}
                    onPress={handleMuteToggle}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.videoModalMuteButtonText}>
                      {isMuted ? '🔇' : '🔊'}
                    </Text>
                  </TouchableOpacity>

                  {playbackError && retryCount >= 3 && (
                    <TouchableOpacity
                      style={styles.videoModalBrowserButton}
                      onPress={handleOpenInBrowser}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.videoModalBrowserButtonText}>
                        Open in Browser
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Video info - only show when controls are visible */}
                  {duration > 0 && (
                    <View style={styles.videoModalInfo}>
                      <Text style={styles.videoModalTimeText}>
                        {Math.floor(currentTime)}s / {Math.floor(duration)}s
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
