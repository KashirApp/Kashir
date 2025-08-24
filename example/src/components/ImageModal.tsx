import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Image,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  SafeAreaView,
  Animated,
  PanResponder,
  ScrollView,
} from 'react-native';
import { styles } from '../App.styles';

interface ImageModalProps {
  visible: boolean;
  imageUrls: string[];
  initialIndex: number;
  onClose: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export function ImageModal({
  visible,
  imageUrls,
  initialIndex,
  onClose,
}: ImageModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageError, setImageError] = useState<Record<number, boolean>>({});

  // Animation values
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const modalOpacity = useRef(new Animated.Value(1)).current;

  // Track values for gesture calculations
  const lastScale = useRef(1);
  const lastX = useRef(0);
  const lastY = useRef(0);

  const resetImageTransform = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();
    lastScale.current = 1;
    lastX.current = 0;
    lastY.current = 0;
  }, [scale, translateX, translateY]);

  const handleClose = useCallback(() => {
    Animated.timing(modalOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
    resetImageTransform();
  }, [modalOpacity, onClose, resetImageTransform]);

  const navigateToImage = useCallback(
    (index: number) => {
      if (index >= 0 && index < imageUrls.length) {
        setCurrentIndex(index);
        resetImageTransform();
        setImageError((prev) => ({ ...prev, [index]: false }));
      }
    },
    [imageUrls.length, resetImageTransform]
  );

  const handlePreviousImage = useCallback(() => {
    navigateToImage(currentIndex - 1);
  }, [currentIndex, navigateToImage]);

  const handleNextImage = useCallback(() => {
    navigateToImage(currentIndex + 1);
  }, [currentIndex, navigateToImage]);

  const handleImageError = useCallback(() => {
    setImageError((prev) => ({ ...prev, [currentIndex]: true }));
  }, [currentIndex]);

  // Pan responder for handling touch gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Store current values when gesture starts
        scale.stopAnimation((value) => {
          lastScale.current = value;
        });
        translateX.stopAnimation((value) => {
          lastX.current = value;
        });
        translateY.stopAnimation((value) => {
          lastY.current = value;
        });
      },
      onPanResponderMove: (evt, gestureState) => {
        const { dx, dy, numberActiveTouches } = gestureState;

        if (numberActiveTouches === 1) {
          // Single finger - pan
          translateX.setValue(lastX.current + dx);
          translateY.setValue(lastY.current + dy);

          // Swipe to dismiss gesture (only at 1x scale)
          if (lastScale.current === 1 && Math.abs(dy) > 100) {
            const opacity = Math.max(0.3, 1 - Math.abs(dy) / screenHeight);
            modalOpacity.setValue(opacity);
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dy } = gestureState;

        // Swipe to dismiss
        if (lastScale.current === 1 && Math.abs(dy) > 150) {
          handleClose();
          return;
        }

        // Reset opacity
        Animated.spring(modalOpacity, {
          toValue: 1,
          useNativeDriver: true,
        }).start();

        // Constrain position based on scale
        const maxTranslateX = ((lastScale.current - 1) * screenWidth) / 2;
        const maxTranslateY = ((lastScale.current - 1) * screenHeight) / 2;

        const constrainedX = Math.max(
          -maxTranslateX,
          Math.min(maxTranslateX, lastX.current + gestureState.dx)
        );
        const constrainedY = Math.max(
          -maxTranslateY,
          Math.min(maxTranslateY, lastY.current + gestureState.dy)
        );

        Animated.parallel([
          Animated.spring(translateX, {
            toValue: constrainedX,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: constrainedY,
            useNativeDriver: true,
          }),
        ]).start();

        lastX.current = constrainedX;
        lastY.current = constrainedY;
      },
    })
  ).current;

  // Reset values when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      modalOpacity.setValue(1);
      resetImageTransform();
      setImageError({});
    }
  }, [visible, initialIndex, resetImageTransform, modalOpacity, imageUrls]);

  const currentImageUrl = imageUrls[currentIndex];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar hidden />
      <Animated.View
        style={[styles.imageModalOverlay, { opacity: modalOpacity }]}
      >
        <SafeAreaView style={styles.imageModalContainer}>
          {/* Header with close button and counter */}
          <View style={styles.imageModalHeader}>
            <TouchableOpacity
              style={styles.imageModalCloseButton}
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <Text style={styles.imageModalCloseText}>✕</Text>
            </TouchableOpacity>
            {imageUrls.length > 1 && (
              <Text style={styles.imageModalCounter}>
                {currentIndex + 1} / {imageUrls.length}
              </Text>
            )}
          </View>

          {/* Main image container */}
          <View style={styles.imageModalContent}>
            <Animated.View
              style={[
                styles.imageModalImageContainer,
                {
                  transform: [{ scale }, { translateX }, { translateY }],
                },
              ]}
              {...panResponder.panHandlers}
            >
              {!imageError[currentIndex] ? (
                <TouchableOpacity
                  onPress={() => {
                    // Double tap to zoom
                    if (lastScale.current === 1) {
                      Animated.spring(scale, {
                        toValue: 2,
                        useNativeDriver: true,
                      }).start();
                      lastScale.current = 2;
                    } else {
                      resetImageTransform();
                    }
                  }}
                  activeOpacity={1}
                >
                  <Image
                    source={{ uri: currentImageUrl }}
                    style={[styles.imageModalImage, { width: screenWidth, height: screenHeight * 0.8 }]}
                    resizeMode="contain"
                    onError={handleImageError}
                  />
                </TouchableOpacity>
              ) : (
                <View style={styles.imageModalError}>
                  <Text style={styles.imageModalErrorIcon}>📷</Text>
                  <Text style={styles.imageModalErrorText}>
                    Failed to load image
                  </Text>
                </View>
              )}
            </Animated.View>
          </View>

          {/* Navigation arrows for multiple images */}
          {imageUrls.length > 1 && (
            <>
              {currentIndex > 0 && (
                <TouchableOpacity
                  style={[
                    styles.imageModalNavButton,
                    styles.imageModalPrevButton,
                  ]}
                  onPress={handlePreviousImage}
                  activeOpacity={0.8}
                >
                  <Text style={styles.imageModalNavText}>‹</Text>
                </TouchableOpacity>
              )}
              {currentIndex < imageUrls.length - 1 && (
                <TouchableOpacity
                  style={[
                    styles.imageModalNavButton,
                    styles.imageModalNextButton,
                  ]}
                  onPress={handleNextImage}
                  activeOpacity={0.8}
                >
                  <Text style={styles.imageModalNavText}>›</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Thumbnail strip for multiple images */}
          {imageUrls.length > 1 && (
            <View style={styles.imageModalThumbnails}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageModalThumbnailsContainer}
              >
                {imageUrls.map((url, index) => (
                  <TouchableOpacity
                    key={`thumb-${index}`}
                    style={[
                      styles.imageModalThumbnail,
                      currentIndex === index &&
                        styles.imageModalThumbnailActive,
                    ]}
                    onPress={() => navigateToImage(index)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: url }}
                      style={styles.imageModalThumbnailImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}
