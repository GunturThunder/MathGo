import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2/700Bold';
import BalooIos_700Bold from '../../assets/fonts/baloo-ios/Baloo2_700Bold.ttf';
import BalooIos_800ExtraBold from '../../assets/fonts/baloo-ios/Baloo2_800ExtraBold.ttf';
import { Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2/800ExtraBold';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { useFonts } from 'expo-font';
import { Platform } from 'react-native';
import { fonts } from './tokens';

// Only the weights the design uses are bundled (OFL-1.1, from Google Fonts).
// iOS gets copies of Baloo 2 with line metrics for Latin text: with the original ones, iOS cut
// the tops off tight display text (scripts/fix-baloo-ios-metrics.py explains).
const BALOO = Platform.select({
  ios: { display: BalooIos_800ExtraBold, displayBold: BalooIos_700Bold },
  default: { display: Baloo2_800ExtraBold, displayBold: Baloo2_700Bold },
});

const FONT_FILES = {
  [fonts.display]: BALOO.display,
  [fonts.displayBold]: BALOO.displayBold,
  [fonts.body]: Nunito_700Bold,
  [fonts.bodySemibold]: Nunito_600SemiBold,
  [fonts.bodyHeavy]: Nunito_800ExtraBold,
  [fonts.label]: Nunito_900Black,
};

/**
 * Loads the design's fonts. True once they are ready, or once loading failed: the app then
 * falls back to the system font rather than staying blank.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(FONT_FILES);
  return loaded || error !== null;
}
