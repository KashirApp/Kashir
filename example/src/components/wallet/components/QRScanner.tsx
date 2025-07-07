import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';

interface QRScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}

export function QRScanner({ visible, onClose, onScan }: QRScannerProps) {
  const [hasPermission, setHasPermission] = React.useState<boolean | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (visible) {
      checkCameraPermission();
    }
  }, [visible]);

  const checkCameraPermission = async () => {
    try {
      // Let the camera component handle permissions
      setHasPermission(true);
    } catch (error) {
      console.error('Permission check error:', error);
      setHasPermission(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScan = (event: any) => {
    // Try different possible event structures for react-native-camera-kit
    let data = null;
    
    if (event?.nativeEvent?.codeStringValue) {
      data = event.nativeEvent.codeStringValue;
    } else if (event?.codeStringValue) {
      data = event.codeStringValue;
    } else if (typeof event === 'string') {
      data = event;
    } else if (event?.data) {
      data = event.data;
    } else if (event?.value) {
      data = event.value;
    }
    
    if (data && typeof data === 'string' && data.trim()) {
      // Extract Lightning invoice from QR code data
      let invoice = data.trim();
      if (invoice.toLowerCase().startsWith('lightning:')) {
        invoice = invoice.substring(10);
      }
      
      onScan(invoice);
      onClose();
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.message}>Checking camera permission...</Text>
        </View>
      );
    }

    if (hasPermission === false) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.message}>Camera permission is required to scan QR codes</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={() => {
            checkCameraPermission();
          }}>
            <Text style={styles.permissionButtonText}>Request Permission</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (hasPermission === true) {
      return (
        <View style={styles.cameraContainer}>
          <Text style={styles.instructionText}>
            Point your camera at a Lightning invoice QR code
          </Text>
          
          <View style={styles.cameraWrapper}>
            <Camera
              style={styles.camera}
              cameraType={CameraType.Back}
              scanBarcode={true}
              onReadCode={handleScan}
              showFrame={true}
            />
          </View>
          
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {renderContent()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraWrapper: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  instructionText: {
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 60,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  message: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  cancelButton: {
    backgroundColor: '#ff4444',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 40,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 