import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

// Where "Update now" goes (S4-12). Android: the Play Store page for this app id. iOS has no App
// Store listing yet (S6-10), so there is no link there until then.

const ANDROID_PACKAGE = Constants.expoConfig?.android?.package ?? 'com.mathgo.app';

/** This app's store page, or null where there is no listing yet. */
export function storeUrl(os: string = Platform.OS): string | null {
  return os === 'android'
    ? `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`
    : null;
}

/** Opens the Play Store app, or its web page when the store app isn't there. */
export async function openStore(): Promise<void> {
  const web = storeUrl();
  if (web === null) return;
  try {
    await Linking.openURL(`market://details?id=${ANDROID_PACKAGE}`);
  } catch {
    await Linking.openURL(web);
  }
}
