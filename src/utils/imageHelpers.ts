import { SERVER_URL } from '../../apiConfig';
import { ImageSourcePropType } from 'react-native';
import FastImage from 'react-native-fast-image';

/**
 * A centralized helper function to determine the correct image source for profile pictures.
 * It handles null/undefined URLs, local file URIs, and server-relative paths.
 * It also appends a timestamp to server URLs to break the cache when an image is updated.
 * 
 * @param url The profile_image_url or group_dp_url from your database.
 * @returns An object suitable for the `source` prop of an Image or FastImage component.
 */
export const getProfileImageSource = (url?: string | null): ImageSourcePropType => {
  // If the URL is missing, return the local default avatar.
  // The path '../assets/...' is correct because this file is in 'src/utils/'.
  if (!url || typeof url !== 'string') {
    return require('../assets/default_avatar.png');
  }

  // If the URL is already a full URI (e.g., from the image picker), use it directly.
  if (url.startsWith('http') || url.startsWith('file')) {
    return { uri: url, priority: FastImage.priority.normal };
  }

  // If it's a server path, construct the full URL and add a timestamp to bust the cache.
  const fullUrl = url.startsWith('/') ? `${SERVER_URL}${url}` : `${SERVER_URL}/${url}`;
  return { 
    uri: `${fullUrl}?t=${new Date().getTime()}`, 
    priority: FastImage.priority.high 
  };
};