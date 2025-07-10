/**
 * Utility functions for working with Nostr SDK FFI objects
 */

/**
 * Converts a tag object to a simple array format
 * Handles different possible tag interfaces from nostr-sdk-ffi
 */
export function tagToArray(tag: any): any[] {
  if (Array.isArray(tag)) {
    return tag;
  }

  if (tag && typeof tag.as_vec === 'function') {
    return tag.as_vec();
  }

  if (tag && typeof tag.asVec === 'function') {
    return tag.asVec();
  }

  if (tag && typeof tag.toVec === 'function') {
    return tag.toVec();
  }

  return [];
}

/**
 * Converts tags collection to an array of tag arrays
 * Handles different possible tags interfaces from nostr-sdk-ffi
 */
export function tagsToArray(tags: any): any[][] {
  let tagArray: any[] = [];

  try {
    if (tags && typeof tags.toVec === 'function') {
      tagArray = tags.toVec();
    } else if (Array.isArray(tags)) {
      tagArray = tags;
    }
  } catch (e) {
    console.error('Error converting tags to array:', e);
    return [];
  }

  return tagArray.map((tag) => tagToArray(tag));
}
