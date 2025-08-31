import { Nip19, Nip19Enum_Tags } from 'kashir';
import { ProfileService } from '../services/ProfileService';

/**
 * Parses nostr:nprofile URIs and replaces them with @username format
 */
export function parseNostrContent(
  content: string,
  profileService: ProfileService
): string {
  // Regex to match nostr:nprofile URIs
  const nprofileRegex = /nostr:nprofile1[a-z0-9]+/g;

  let parsedContent = content;
  const matches = content.match(nprofileRegex);

  if (!matches) {
    return content;
  }

  // For each nprofile match, try to replace with @username
  matches.forEach((nprofileUri) => {
    try {
      const username = getUsernameFromNprofile(nprofileUri, profileService);
      if (username) {
        parsedContent = parsedContent.replace(nprofileUri, `@${username}`);
      }
    } catch {
      // Keep the original nprofile if parsing fails
    }
  });

  return parsedContent;
}

/**
 * Extracts username from nprofile URI using Kashir's NIP19 decoder and profile service
 */
function getUsernameFromNprofile(
  nprofileUri: string,
  profileService: ProfileService
): string | null {
  try {
    // Remove 'nostr:' prefix to get the bech32 encoded nprofile
    const bech32Profile = nprofileUri.replace('nostr:', '');

    // Decode the nprofile using Kashir's NIP19 implementation
    const nip19 = Nip19.fromBech32(bech32Profile);
    const nip19Enum = nip19.asEnum();

    // Check if it's a profile type
    if (nip19Enum.tag === Nip19Enum_Tags.Profile) {
      const profile = nip19Enum.inner.nprofile;
      const publicKey = profile.publicKey();
      const pubkeyHex = publicKey.toHex();

      // Try to get the cached profile name
      const profileCache = profileService.getProfileCache();
      const cachedProfile = profileCache.get(pubkeyHex);

      if (cachedProfile && cachedProfile.name) {
        return cachedProfile.name;
      }

      // Fallback to shortened pubkey if no name is available
      return pubkeyHex.substring(0, 8) + '...';
    }

    return null;
  } catch {
    // Fallback: try to extract some identifier from the original URI
    try {
      const profileId = nprofileUri.substring(13, 21); // Take some chars after "nostr:nprofile1"

      // Try to find a matching profile in cache by partial match
      const profileCache = profileService.getProfileCache();
      for (const [pubkey, profile] of profileCache.entries()) {
        if (pubkey.includes(profileId) && profile.name) {
          return profile.name;
        }
      }

      // Final fallback to shortened identifier
      return profileId + '...';
    } catch {
      return null;
    }
  }
}
