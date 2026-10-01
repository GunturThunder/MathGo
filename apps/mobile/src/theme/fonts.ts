import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2/700Bold';
import { Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2/800ExtraBold';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { useFonts } from 'expo-font';
import { fonts } from './tokens';

// Only the weights the design uses are bundled (OFL-1.1, from Google Fonts).
const FONT_FILES = {
  [fonts.display]: Baloo2_800ExtraBold,
  [fonts.displayBold]: Baloo2_700Bold,
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
