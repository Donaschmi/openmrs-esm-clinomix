import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import ClinomixHeader from './header/clinomix-header.component';
import QuestionnaireList from './questionnaire/questionnaire-list.component';
import QuestionnaireForm from './questionnaire/form/questionnaire-form.component';
import QuestionnaireView from './questionnaire/view/questionnaire-view.component';
import QuestionnaireResponseForm from './questionnaire/response/questionnaire-response.component';
import QuestionnaireResponseList from './questionnaire/response/questionnaire-response-list.component';
import QuestionnaireResponseView from './questionnaire/response/questionnaire-response-view.component';
import { devGetQuestionnaires, type FhirQuestionnaire } from './questionnaire/questionnaire.resource';
import { devGetResponses } from './questionnaire/response/questionnaire-response.resource';
import styles from './root.scss';

type View =
  | { kind: 'list' }
  | { kind: 'create'; template?: FhirQuestionnaire }
  | { kind: 'edit'; id: string }
  | { kind: 'view'; id: string }
  | { kind: 'respond'; id: string }
  | { kind: 'viewResponse'; id: string }
  | { kind: 'viewSnapshot'; snapshot: FhirQuestionnaire; parentId: string };

const ClinomixDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [view, setView] = useState<View>({ kind: 'list' });

  const goToList = () => setView({ kind: 'list' });
  const findById = (id: string): FhirQuestionnaire | undefined => devGetQuestionnaires().find((q) => q.id === id);

  if (view.kind === 'create') {
    return <QuestionnaireForm template={view.template} onBack={goToList} />;
  }

  if (view.kind === 'edit') {
    return <QuestionnaireForm questionnaire={findById(view.id)} onBack={goToList} />;
  }

  if (view.kind === 'respond') {
    const questionnaire = findById(view.id);
    if (!questionnaire) {
      goToList();
      return null;
    }
    return <QuestionnaireResponseForm questionnaire={questionnaire} onBack={goToList} />;
  }

  if (view.kind === 'view') {
    const questionnaire = findById(view.id);
    if (!questionnaire) {
      goToList();
      return null;
    }
    return (
      <QuestionnaireView
        questionnaire={questionnaire}
        onBack={goToList}
        onEdit={() => setView({ kind: 'edit', id: view.id })}
        onViewSnapshot={(snapshot) => setView({ kind: 'viewSnapshot', snapshot, parentId: view.id })}
        onRestored={() => setView({ kind: 'view', id: view.id })}
      />
    );
  }

  if (view.kind === 'viewSnapshot') {
    return (
      <QuestionnaireView
        questionnaire={view.snapshot}
        onBack={() => setView({ kind: 'view', id: view.parentId })}
        onEdit={() => {}}
        readOnly
      />
    );
  }

  if (view.kind === 'viewResponse') {
    const response = devGetResponses().find((r) => r.id === view.id);
    if (!response) {
      goToList();
      return null;
    }
    return <QuestionnaireResponseView response={response} onBack={goToList} />;
  }

  return (
    <div className={styles.container}>
      <ClinomixHeader />
      <div className={styles.content}>
        <Tabs>
          <TabList aria-label={t('navigation', 'Navigation')} contained>
            <Tab>{t('questionnaires', 'Questionnaires')}</Tab>
            <Tab>{t('responses', 'Responses')}</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <QuestionnaireList
                onNew={() => setView({ kind: 'create' })}
                onEdit={(id) => setView({ kind: 'edit', id })}
                onView={(id) => setView({ kind: 'view', id })}
                onRespond={(id) => setView({ kind: 'respond', id })}
                onDuplicate={(id) => setView({ kind: 'create', template: findById(id) })}
              />
            </TabPanel>
            <TabPanel>
              <QuestionnaireResponseList onView={(id) => setView({ kind: 'viewResponse', id })} />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};

export default ClinomixDashboard;
