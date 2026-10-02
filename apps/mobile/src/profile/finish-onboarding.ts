import { router } from 'expo-router';
import { profile } from './store';

/** Ends the first launch flow: from now on the app opens on Home. */
export function finishOnboarding(): void {
  profile.completeOnboarding();
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
}
