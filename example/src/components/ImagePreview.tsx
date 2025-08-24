import React, { useState, useCallback, memo } from 'react';
import { View, Image, Text, TouchableOpacity } from 'react-native';
import { styles } from '../App.styles';
import { ImageModal } from './ImageModal';

interface ImagePreviewProps {
  imageUrls: string[];
  maxImages?: number;
}

function ImagePreviewComponent({
  imageUrls,
  maxImages = 4,
}: ImagePreviewProps) {
  const [, setLoadingStates] = useState<Record<string, boolean>>({});
  const [errorStates, setErrorStates] = useState<Record<string, boolean>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const displayUrls = imageUrls.slice(0, maxImages);
  const remainingCount = imageUrls.length - maxImages;

  const handleImageLoad = useCallback((url: string) => {
    setLoadingStates((prev) => ({ ...prev, [url]: false }));
  }, []);

  const handleImageError = useCallback((url: string) => {
    console.warn('Failed to load image:', url);
    setLoadingStates((prev) => ({ ...prev, [url]: false }));
    setErrorStates((prev) => ({ ...prev, [url]: true }));
  }, []);

  const handleImagePress = useCallback((index: number) => {
    setSelectedImageIndex(index);
    setModalVisible(true);
  }, []);

  const getWrapperStyle = useCallback(() => {
    if (displayUrls.length === 1) {
      return null; // imageLarge uses 100% width
    } else if (displayUrls.length === 2) {
      return styles.imageMediumWrapper;
    } else {
      return styles.imageSmallWrapper;
    }
  }, [displayUrls.length]);

  const getImageStyle = useCallback(() => {
    if (displayUrls.length === 1) {
      return styles.imageLarge;
    } else if (displayUrls.length === 2) {
      return styles.imageMedium;
    } else {
      return styles.imageSmall;
    }
  }, [displayUrls.length]);

  const getContainerStyle = useCallback(() => {
    if (displayUrls.length === 1) {
      return styles.imageContainerSingle;
    } else if (displayUrls.length === 2) {
      return styles.imageContainerDouble;
    } else {
      return styles.imageContainerGrid;
    }
  }, [displayUrls.length]);

  const wrapperStyle = getWrapperStyle();
  const imageStyle = getImageStyle();
  const containerStyle = getContainerStyle();

  if (imageUrls.length === 0) {
    return null;
  }

  return (
    <View style={styles.imagePreviewContainer}>
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
                  style={[styles.postImage, imageStyle] as any}
                  onLoad={() => handleImageLoad(url)}
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
              <View style={[styles.imageError, imageStyle]}>
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
      prevProps.maxImages === nextProps.maxImages
    );
  }
);
