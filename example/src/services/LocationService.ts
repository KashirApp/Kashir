import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export class LocationService {
  private static instance: LocationService;
  private currentLocation: Coordinates | null = null;
  private locationPromise: Promise<Coordinates> | null = null;

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message:
              'This app needs access to your location to sort events by distance.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Error requesting location permission:', err);
        return false;
      }
    }
    return true; // iOS handles permissions automatically
  }

  async getCurrentLocation(): Promise<Coordinates> {
    // Return cached location if available and recent (within 5 minutes)
    if (this.currentLocation) {
      return this.currentLocation;
    }

    // Return existing promise if one is in progress
    if (this.locationPromise) {
      return this.locationPromise;
    }

    // Create new location request
    this.locationPromise = new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          this.currentLocation = coords;
          this.locationPromise = null;
          resolve(coords);
        },
        (error) => {
          console.warn('Error getting location:', error);
          this.locationPromise = null;
          reject(error);
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 300000, // 5 minutes
        }
      );
    });

    return this.locationPromise;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in kilometers
   */
  calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(coord2.latitude - coord1.latitude);
    const dLon = this.toRadians(coord2.longitude - coord1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coord1.latitude)) *
        Math.cos(this.toRadians(coord2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Format distance for display
   */
  formatDistance(distance: number): string {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    } else if (distance < 10) {
      return `${distance.toFixed(1)}km`;
    } else {
      return `${Math.round(distance)}km`;
    }
  }

  /**
   * Clear cached location (useful for testing or when user moves significantly)
   */
  clearCache(): void {
    this.currentLocation = null;
  }
}
