import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Button } from '../components/Button';
import { ShapeFighter } from '../components/ShapeFighter';
import { openStore, storeUrl } from '../net/store-link';
import { colors, shapes, space, typography } from '../theme';

/**
 * The server refused this app version (S4-12, design: 19 Update required). Online play waits for
 * the update; practice vs bot works without it.
 */
export default function UpdateRequired() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl },
      ]}
      testID="update-required"
    >
      <View style={styles.spacer} />
      <View style={styles.art} importantForAccessibility="no-hide-descendants">
        <View style={styles.tile}>
          <ShapeFighter shape="square" size={96} />
        </View>
        <View style={styles.badge}>
          <Svg
            width={28}
            height={28}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.white}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M12 19V5" />
            <Path d="M6 11l6-6 6 6" />
          </Svg>
        </View>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} accessibilityRole="header">
          {t('updateRequired.title')}
        </Text>
        <Text style={styles.text}>{t('updateRequired.text')}</Text>
      </View>
      <View style={styles.spacer} />
      <View style={styles.buttons}>
        {storeUrl() !== null ? (
          <Button
            label={t('updateRequired.update')}
            onPress={() => void openStore()}
            testID="update-now"
          />
        ) : null}
        <Button
          label={t('updateRequired.practice')}
          variant="secondary"
          onPress={() => router.replace('/practice')}
          testID="update-practice"
        />
      </View>
      <Text style={styles.note}>{t('updateRequired.note')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.xl, backgroundColor: colors.ground },
  spacer: { flex: 1 },
  art: { alignSelf: 'center', width: 150, height: 150 },
  tile: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 44,
    backgroundColor: shapes.square.tile,
  },
  badge: {
    position: 'absolute',
    right: -8,
    top: -8,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    borderWidth: 4,
    borderColor: colors.ground,
    backgroundColor: colors.blue,
    boxShadow: `0 5px 0 ${colors.blueBase}`,
  },
  copy: { alignItems: 'center', gap: space.sm, marginTop: space.xxl + 4 },
  title: { ...typography.headline, color: colors.ink, textAlign: 'center' },
  text: { ...typography.body, color: colors.ink2, textAlign: 'center', maxWidth: 310 },
  buttons: { gap: space.md + 2 },
  note: { ...typography.caption, color: colors.ink2, textAlign: 'center', marginTop: space.md + 2 },
});
