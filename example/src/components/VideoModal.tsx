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
import { styles } from '../App.styles';

interface VideoModalProps {
  visible: boolean;
  videoUrl: string;
  onClose: () => void;
}

export function VideoModal({ visible, videoUrl, onClose }: VideoModalProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [playbackError, setPlaybackError] = useState(false);
  const [showControls, setShowControls] = useState(true);
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
    setPlaybackError(true);
    setIsPlaying(false);
    setIsBuffering(false);
  }, []);

  const handleVideoLoad = useCallback(() => {
    setPlaybackError(false);
    setIsBuffering(false);
  }, []);

  const handleVideoBuffer = useCallback(
    ({ isBuffering: buffering }: { isBuffering: boolean }) => {
      setIsBuffering(buffering);
    },
    []
  );

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

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setIsPlaying(true);
      setPlaybackError(false);
      setIsBuffering(true);
      setShowControls(true);
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
                source={{ uri: videoUrl }}
                style={styles.videoModalVideo}
                resizeMode="contain"
                paused={!isPlaying}
                muted={isMuted}
                onLoad={handleVideoLoad}
                onError={handleVideoError}
                onBuffer={handleVideoBuffer}
                controls={false}
                repeat={false}
                poster={videoUrl}
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
                          {playbackError ? '🌐' : '▶️'}
                        </Text>
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

                  {playbackError && (
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
                </View>
              </View>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
