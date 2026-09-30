import { useTranslation } from 'react-i18next';
import { Placeholder } from '../components/Placeholder';

export default function Practice() {
  const { t } = useTranslation();
  return <Placeholder title={t('practice.title')} note={t('practice.note')} />;
}
