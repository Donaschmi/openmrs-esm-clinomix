import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppointmentsPictogram, PageHeader, PageHeaderContent } from '@openmrs/esm-framework';
import styles from './clinomix-header.scss';

const ClinomixHeader: React.FC = () => {
  const { t } = useTranslation();

  return (
    <PageHeader className={styles.header} data-testid="clinomix-header">
      <PageHeaderContent illustration={<AppointmentsPictogram />} title={t('clinomix', 'Clinomix')} />
    </PageHeader>
  );
};

export default ClinomixHeader;
