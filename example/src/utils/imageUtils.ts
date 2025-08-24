// Utility functions for handling images in posts

// Regular expression to match image URLs
const IMAGE_URL_REGEX =
  /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?[^\s]*)?)/gi;

/**
 * Extract image URLs from post content
 * @param content - The post content text
 * @returns Array of image URLs found in the content
 */
export function extractImageUrls(content: string): string[] {
  const matches = content.match(IMAGE_URL_REGEX);
  return matches ? [...new Set(matches)] : []; // Remove duplicates
}

/**
 * Remove image URLs from text content to avoid showing them twice
 * @param content - The original post content
 * @param imageUrls - Array of image URLs to remove
 * @returns Content with image URLs removed
 */
export function removeImageUrlsFromContent(
  content: string,
  imageUrls: string[]
): string {
  let cleanedContent = content;
  imageUrls.forEach((url) => {
    cleanedContent = cleanedContent.replace(url, '').trim();
  });
  return cleanedContent.replace(/\s+/g, ' ').trim(); // Clean up extra whitespace
}
