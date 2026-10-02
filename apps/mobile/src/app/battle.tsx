import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Placeholder } from '../components/Placeholder';
import { onlineLocked } from '../profile/online';

export default function Battle() {
  const { t } = useTranslation();
  // Online battles are locked under 18 without a parent's consent (S3-09).
  if (onlineLocked()) return <Redirect href="/ask-parent" />;
  return <Placeholder title={t('battle.title')} note={t('battle.note')} />;
}
