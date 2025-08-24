// Utility functions for handling videos in posts

// Regular expression to match video URLs
const VIDEO_URL_REGEX =
  /(https?:\/\/[^\s]+\.(?:mp4|webm|ogg|avi|mov|wmv|flv|m4v|3gp|mkv)(?:\?[^\s]*)?)/gi;

/**
 * Extract video URLs from post content
 * @param content - The post content text
 * @returns Array of video URLs found in the content
 */
export function extractVideoUrls(content: string): string[] {
  const matches = content.match(VIDEO_URL_REGEX);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Remove video URLs from text content to avoid showing them twice
 * @param content - The original post content
 * @param videoUrls - Array of video URLs to remove
 * @returns Content with video URLs removed
 */
export function removeVideoUrlsFromContent(
  content: string,
  videoUrls: string[]
): string {
  let cleanedContent = content;
  videoUrls.forEach((url) => {
    cleanedContent = cleanedContent.replace(url, '').trim();
  });

  return cleanedContent.replace(/\s+/g, ' ').trim();
}

/**
 * Check if a URL is a video URL
 * @param url - The URL to check
 * @returns true if the URL is a video URL
 */
export function isVideoUrl(url: string): boolean {
  return VIDEO_URL_REGEX.test(url);
}
