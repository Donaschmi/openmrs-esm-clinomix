import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import ClinomixHeader from './header/clinomix-header.component';
import QuestionnaireList from '@/questionnaire/questionnaire-list.component';
import QuestionnaireForm from '@/questionnaire/form/questionnaire-form.component';
import QuestionnaireView from '@/questionnaire/view/questionnaire-view.component';
import QuestionnaireResponseForm from '@/questionnaire-response/questionnaire-response.component';
import QuestionnaireResponseList from '@/questionnaire-response/questionnaire-response-list.component';
import QuestionnaireResponseView from '@/questionnaire-response/questionnaire-response-view.component';
import StudyList from './study/study-list.component';
import StudyForm from './study/form/study-form.component';
import StudyView from './study/view/study-view.component';
import { useQuestionnaires, type FhirQuestionnaire } from '@/questionnaire/questionnaire.resource';
import { useResponses } from '@/questionnaire-response/questionnaire-response.resource';
import styles from './root.scss';

type View =
  | { kind: 'list'; tab?: number }
  | { kind: 'create'; template?: FhirQuestionnaire }
  | { kind: 'edit'; id: string }
  | { kind: 'view'; id: string }
  | { kind: 'respond'; id: string }
  | { kind: 'viewResponse'; id: string }
  | { kind: 'viewSnapshot'; snapshot: FhirQuestionnaire; parentId: string }
  | { kind: 'studyCreate' }
  | { kind: 'studyEdit'; uuid: string }
  | { kind: 'studyView'; uuid: string };

const ClinomixDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [view, setView] = useState<View>({ kind: 'list', tab: 0 });
  const { questionnaires } = useQuestionnaires();
  const { responses } = useResponses();

  const goToList = (tab = 0) => setView({ kind: 'list', tab });
  const findById = (id: string): FhirQuestionnaire | undefined => questionnaires.find((q) => q.id === id);

  if (view.kind === 'create') {
    return <QuestionnaireForm template={view.template} onBack={() => goToList(0)} />;
  }

  if (view.kind === 'edit') {
    return <QuestionnaireForm questionnaire={findById(view.id)} onBack={() => goToList(0)} />;
  }

  if (view.kind === 'respond') {
    const questionnaire = findById(view.id);
    if (!questionnaire) {
      goToList(0);
      return null;
    }
    return <QuestionnaireResponseForm questionnaire={questionnaire} onBack={() => goToList(0)} />;
  }

  if (view.kind === 'view') {
    const questionnaire = findById(view.id);
    if (!questionnaire) {
      goToList(0);
      return null;
    }
    return (
      <QuestionnaireView
        questionnaire={questionnaire}
        onBack={() => goToList(0)}
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
    const response = responses.find((r) => r.id === view.id);
    if (!response) {
      goToList(1);
      return null;
    }
    return <QuestionnaireResponseView response={response} onBack={() => goToList(1)} />;
  }

  if (view.kind === 'studyCreate') {
    return <StudyForm onBack={() => goToList(2)} onSaved={(uuid) => setView({ kind: 'studyView', uuid })} />;
  }

  if (view.kind === 'studyEdit') {
    return (
      <StudyForm
        studyUuid={view.uuid}
        onBack={() => setView({ kind: 'studyView', uuid: view.uuid })}
        onSaved={(uuid) => setView({ kind: 'studyView', uuid })}
      />
    );
  }

  if (view.kind === 'studyView') {
    return (
      <StudyView
        studyUuid={view.uuid}
        onBack={() => goToList(2)}
        onEdit={() => setView({ kind: 'studyEdit', uuid: view.uuid })}
        onViewQuestionnaire={(id) => setView({ kind: 'view', id })}
        onViewResponse={(id) => setView({ kind: 'viewResponse', id })}
      />
    );
  }

  const initialTab = view.kind === 'list' ? (view.tab ?? 0) : 0;

  return (
    <div className={styles.container}>
      <ClinomixHeader />
      <div className={styles.content}>
        <Tabs defaultSelectedIndex={initialTab}>
          <TabList aria-label={t('navigation', 'Navigation')} contained>
            <Tab>{t('questionnaires', 'Questionnaires')}</Tab>
            <Tab>{t('responses', 'Responses')}</Tab>
            <Tab>{t('studies', 'Studies')}</Tab>
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
            <TabPanel>
              <StudyList
                onNew={() => setView({ kind: 'studyCreate' })}
                onView={(uuid) => setView({ kind: 'studyView', uuid })}
                onEdit={(uuid) => setView({ kind: 'studyEdit', uuid })}
              />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  );
};

export default ClinomixDashboard;
