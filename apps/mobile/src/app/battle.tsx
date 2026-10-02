import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Placeholder } from '../components/Placeholder';
import { updateRequired } from '../net/update-required';
import { onlineLocked } from '../profile/online';

export default function Battle() {
  const { t } = useTranslation();
  // Online battles are locked under 18 without a parent's consent (S3-09).
  if (onlineLocked()) return <Redirect href="/ask-parent" />;
  // This version was refused by the server (S4-12).
  if (updateRequired()) return <Redirect href="/update-required" />;
  return <Placeholder title={t('battle.title')} note={t('battle.note')} />;
}
