import * as geohash from 'ngeohash';
import type { CalendarEvent } from '../hooks/useEvents';
import type { Coordinates } from './LocationService';

export class EventLocationParser {
  /**
   * Parse location from event to coordinates
   * Supports geohash tags, coordinate strings, geo URIs, and parenthetical coordinates
   */
  static parseEventLocation(event: CalendarEvent): Coordinates | null {
    // First check for geohash tag (most precise)
    if (event.tags) {
      const geohashTag = event.tags.find((tag) => tag[0] === 'g');
      if (geohashTag && geohashTag[1]) {
        try {
          const decoded = geohash.decode(geohashTag[1]);

          if (this.isValidCoordinate(decoded.latitude, decoded.longitude)) {
            return {
              latitude: decoded.latitude,
              longitude: decoded.longitude,
            };
          }
        } catch (error) {
          // Silently handle geohash decode errors
        }
      }
    }

    // Parse text location
    const location = event.location;
    if (!location) return null;

    // Try different coordinate formats
    const patterns = [
      // Standard lat,lng format: "40.7128, -74.0060"
      /(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/,
      // Geo URI format: "geo:40.7128,-74.0060"
      /geo:(-?\d+\.?\d*),(-?\d+\.?\d*)/i,
      // Parenthetical format: "(40.7128, -74.0060)"
      /\((-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\)/,
    ];

    for (const pattern of patterns) {
      const match = location.match(pattern);
      if (match && match[1] && match[2]) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);

        if (this.isValidCoordinate(lat, lng)) {
          return { latitude: lat, longitude: lng };
        }
      }
    }

    return null;
  }

  private static isValidCoordinate(lat: number, lng: number): boolean {
    return (
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      !isNaN(lat) &&
      !isNaN(lng)
    );
  }
}
