import React, { useState, useCallback, memo } from 'react';
import { View, Image, Text, TouchableOpacity, Dimensions } from 'react-native';
import { styles } from '../App.styles';
import { ImageModal } from './ImageModal';

interface ImagePreviewProps {
  imageUrls: string[];
  maxImages?: number;
  isEmbedded?: boolean;
}

// Calculate content width: screen width minus post card margins (20px) and padding (30px)
const contentWidth = Dimensions.get('window').width - 50;
// For embedded posts: screen width minus outer post margins/padding (50px) and embedded post padding (30px)
const embeddedContentWidth = Dimensions.get('window').width - 80;

function ImagePreviewComponent({
  imageUrls,
  maxImages = 4,
  isEmbedded = false,
}: ImagePreviewProps) {
  const [errorStates, setErrorStates] = useState<Record<string, boolean>>({});
  const [imageDimensions, setImageDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const displayUrls = imageUrls.slice(0, maxImages);
  const remainingCount = imageUrls.length - maxImages;
  const effectiveContentWidth = isEmbedded
    ? embeddedContentWidth
    : contentWidth;

  const handleImageError = useCallback((url: string) => {
    console.warn('Failed to load image:', url);
    setErrorStates((prev) => ({ ...prev, [url]: true }));
  }, []);

  // Get image dimensions when loaded for single images
  const handleSingleImageLoad = useCallback((url: string, event: any) => {
    const { width, height } = event.nativeEvent.source;
    setImageDimensions((prev) => ({ ...prev, [url]: { width, height } }));
  }, []);

  const handleImagePress = useCallback((index: number) => {
    setSelectedImageIndex(index);
    setModalVisible(true);
  }, []);

  const getWrapperStyle = useCallback(() => {
    if (displayUrls.length === 1) {
      return [
        styles.imageLargeWrapper,
        styles.imageSingleWrapper,
        { width: effectiveContentWidth },
      ];
    } else if (displayUrls.length === 2) {
      return styles.imageMediumWrapper;
    } else {
      return styles.imageSmallWrapper;
    }
  }, [displayUrls.length, effectiveContentWidth]);

  const getImageStyle = useCallback(
    (url?: string) => {
      if (displayUrls.length === 1 && url && imageDimensions[url]) {
        const { width, height } = imageDimensions[url];
        const aspectRatio = width / height;
        const calculatedHeight = effectiveContentWidth / aspectRatio;
        return [
          styles.imageLarge,
          styles.postImageSingle,
          {
            width: effectiveContentWidth,
            height: calculatedHeight,
          },
        ];
      } else if (displayUrls.length === 1) {
        return [
          styles.imageLarge,
          styles.postImageSingle,
          { width: effectiveContentWidth },
        ];
      } else if (displayUrls.length === 2) {
        return styles.imageMedium;
      } else {
        return styles.imageSmall;
      }
    },
    [displayUrls.length, imageDimensions, effectiveContentWidth]
  );

  const getContainerStyle = useCallback(() => {
    if (displayUrls.length === 1) {
      return styles.imageContainerSingle;
    } else if (displayUrls.length === 2) {
      return styles.imageContainerDouble;
    } else {
      return styles.imageContainerGrid;
    }
  }, [displayUrls.length]);

  const getPreviewContainerStyle = useCallback(() => {
    if (displayUrls.length === 1) {
      return styles.imagePreviewContainerSingle;
    } else {
      return styles.imagePreviewContainer;
    }
  }, [displayUrls.length]);

  const wrapperStyle = getWrapperStyle();
  const containerStyle = getContainerStyle();
  const previewContainerStyle = getPreviewContainerStyle();

  if (imageUrls.length === 0) {
    return null;
  }

  return (
    <View style={previewContainerStyle}>
      <View style={containerStyle}>
        {displayUrls.map((url, index) => (
          <TouchableOpacity
            key={`${url}-${index}`}
            onPress={() => handleImagePress(index)}
            style={[
              styles.imageWrapper,
              wrapperStyle,
              index === displayUrls.length - 1 &&
                remainingCount > 0 &&
                styles.lastImageWrapper,
            ]}
            activeOpacity={0.8}
          >
            {!errorStates[url] ? (
              <>
                <Image
                  source={{ uri: url }}
                  style={[styles.postImage, getImageStyle(url)] as any}
                  onLoad={(event) =>
                    displayUrls.length === 1
                      ? handleSingleImageLoad(url, event)
                      : undefined
                  }
                  onError={() => handleImageError(url)}
                  resizeMode="cover"
                  fadeDuration={200}
                />
                {index === displayUrls.length - 1 && remainingCount > 0 && (
                  <View style={styles.moreImagesOverlay}>
                    <Text style={styles.moreImagesText}>+{remainingCount}</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={[styles.imageError, getImageStyle(url)]}>
                <Text style={styles.imageErrorText}>📷</Text>
                <Text style={styles.imageErrorTextSmall}>Failed to load</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      {remainingCount > 0 && displayUrls.length === maxImages && (
        <Text style={styles.moreImagesIndicator}>
          And {remainingCount} more image{remainingCount > 1 ? 's' : ''}
        </Text>
      )}

      <ImageModal
        visible={modalVisible}
        imageUrls={imageUrls}
        initialIndex={selectedImageIndex}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

export const ImagePreview = memo(
  ImagePreviewComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.imageUrls.length === nextProps.imageUrls.length &&
      prevProps.imageUrls.every(
        (url, index) => url === nextProps.imageUrls[index]
      ) &&
      prevProps.maxImages === nextProps.maxImages &&
      prevProps.isEmbedded === nextProps.isEmbedded
    );
  }
);
