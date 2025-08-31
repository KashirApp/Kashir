import { isImageUrl } from './imageUtils';
import { isVideoUrl } from './videoUtils';

/**
 * Extracts URLs from content string, excluding image and video URLs
 */
export function extractUrls(content: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const allUrls = content.match(urlRegex) || [];

  // Filter out image and video URLs since they're handled by other components
  return allUrls.filter((url) => !isImageUrl(url) && !isVideoUrl(url));
}

/**
 * Removes URLs from content string
 */
export function removeUrlsFromContent(content: string, urls: string[]): string {
  let cleanedContent = content;
  urls.forEach((url) => {
    cleanedContent = cleanedContent.replace(url, '').trim();
  });
  // Clean up any extra whitespace
  cleanedContent = cleanedContent.replace(/\s+/g, ' ').trim();
  return cleanedContent;
}
