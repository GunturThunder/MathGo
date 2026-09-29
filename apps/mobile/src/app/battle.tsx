import { useTranslation } from 'react-i18next';
import { Placeholder } from '../components/Placeholder';

export default function Battle() {
  const { t } = useTranslation();
  return <Placeholder title={t('battle.title')} note={t('battle.note')} />;
}
