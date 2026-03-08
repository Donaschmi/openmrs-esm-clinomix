import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  IconButton,
  Layer,
  Modal,
  OverflowMenu,
  OverflowMenuItem,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  Tile,
} from '@carbon/react';
import { Add, Upload, View } from '@carbon/react/icons';
import { isDesktop, showSnackbar, useLayoutType, usePagination } from '@openmrs/esm-framework';
import {
  type FhirQuestionnaire,
  type QuestionnaireStatus,
  devGetQuestionnaires,
  devSaveQuestionnaires,
  useQuestionnaires,
} from './questionnaire.resource';
import { isXmlFile, parseFhirXml } from './fhir-xml.parser';
import styles from './questionnaire-list.scss';

interface QuestionnaireListProps {
  onNew: () => void;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
  onRespond: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const QuestionnairList: React.FC<QuestionnaireListProps> = ({ onNew, onEdit, onView, onRespond, onDuplicate }) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';
  const [searchString, setSearchString] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuestionnaireStatus | 'all'>('all');
  const [pageSize, setPageSize] = useState(10);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = isXmlFile(file) ? parseFhirXml(text) : (JSON.parse(text) as unknown);

        // Collect Questionnaire resources (single resource or FHIR Bundle)
        const resources: FhirQuestionnaire[] = [];
        const rt = (parsed as { resourceType?: string }).resourceType;

        if (rt === 'Bundle') {
          const entries = (parsed as { entry?: { resource?: unknown }[] }).entry ?? [];
          for (const entry of entries) {
            if ((entry.resource as { resourceType?: string })?.resourceType === 'Questionnaire') {
              resources.push(entry.resource as FhirQuestionnaire);
            }
          }
        } else if (rt === 'Questionnaire') {
          resources.push(parsed as FhirQuestionnaire);
        }

        if (resources.length === 0) {
          showSnackbar({
            kind: 'error',
            title: t('importFailed', 'Import failed'),
            subtitle: t('notAQuestionnaire', 'The file does not contain a valid FHIR Questionnaire resource.'),
          });
          return;
        }

        const existing = devGetQuestionnaires();
        const merged = [...existing];
        let added = 0;
        let updated = 0;

        for (const q of resources) {
          const id = q.id ?? `q-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const withId = { ...q, id };
          const idx = merged.findIndex((x) => x.id === id);
          if (idx >= 0) {
            merged[idx] = withId;
            updated++;
          } else {
            merged.push(withId);
            added++;
          }
        }

        devSaveQuestionnaires(merged);
        setRefreshKey((k) => k + 1);
        showSnackbar({
          kind: 'success',
          title: t('imported', 'Imported'),
          subtitle:
            added > 0 && updated > 0
              ? `${added} added, ${updated} updated`
              : added > 0
                ? `${added} questionnaire(s) imported`
                : `${updated} questionnaire(s) updated`,
        });
      } catch (err) {
        showSnackbar({
          kind: 'error',
          title: t('importFailed', 'Import failed'),
          subtitle: err instanceof Error ? err.message : t('invalidFile', 'The file could not be parsed.'),
        });
      }
    };
    reader.readAsText(file);
  };

  const { questionnaires, isLoading, error } = useQuestionnaires();

  const deleteCandidate = useMemo(() => questionnaires.find((q) => q.id === deleteId), [questionnaires, deleteId]);

  const handleDelete = () => {
    if (!deleteId) return;
    const updated = devGetQuestionnaires().filter((q) => q.id !== deleteId);
    devSaveQuestionnaires(updated);
    setDeleteId(null);
    setRefreshKey((k) => k + 1);
    showSnackbar({
      kind: 'success',
      title: t('deleted', 'Deleted'),
      subtitle: t('questionnaireDeleted', 'Questionnaire deleted successfully'),
    });
  };

  const filtered = useMemo(
    () =>
      questionnaires.filter((q) => {
        if (statusFilter !== 'all' && q.status !== statusFilter) return false;
        const search = searchString.toLowerCase();
        if (!search) return true;
        return q.title?.toLowerCase().includes(search) || q.name?.toLowerCase().includes(search);
      }),
    [questionnaires, searchString, statusFilter],
  );

  const { results, goTo, currentPage } = usePagination(filtered, pageSize);

  const headers = [
    { key: 'title', header: t('title', 'Title') },
    { key: 'name', header: t('name', 'Name') },
    { key: 'status', header: t('status', 'Status') },
    { key: 'publisher', header: t('publisher', 'Publisher') },
    { key: 'date', header: t('lastUpdated', 'Last updated') },
  ];

  const rows = useMemo(
    () =>
      results.map((q) => ({
        id: q.id,
        title: q.title ?? '--',
        name: q.name ?? '--',
        status: <Tag type={q.status === 'active' ? 'green' : q.status === 'draft' ? 'blue' : 'gray'}>{q.status}</Tag>,
        publisher: q.publisher ?? '--',
        date: q.date ? new Date(q.date).toLocaleDateString() : '--',
      })),
    [results],
  );

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" rowCount={10} columnCount={headers.length} />;
  }

  if (error) {
    console.error('Error loading questionnaires:', error);
    return (
      <Layer>
        <Tile className={styles.errorTile}>
          <p>{t('errorLoadingQuestionnaires', 'Error loading questionnaires. Please try again.')}</p>
        </Tile>
      </Layer>
    );
  }

  return (
    <>
      <Modal
        open={Boolean(deleteId)}
        danger
        modalHeading={t('deleteQuestionnaire', 'Delete questionnaire')}
        primaryButtonText={t('delete', 'Delete')}
        secondaryButtonText={t('cancel', 'Cancel')}
        onRequestSubmit={handleDelete}
        onRequestClose={() => setDeleteId(null)}
        onSecondarySubmit={() => setDeleteId(null)}
      >
        <p>
          {t('deleteConfirmation', 'Are you sure you want to delete')}{' '}
          <strong>{deleteCandidate?.title ?? deleteId}</strong>? {t('deleteWarning', 'This action cannot be undone.')}
        </p>
      </Modal>
      <Layer className={styles.container} key={refreshKey}>
        <DataTable rows={rows} headers={headers} isSortable size={responsiveSize} useZebraStyles>
          {({ rows, headers, getHeaderProps, getRowProps, getTableProps, getTableContainerProps, getToolbarProps }) => (
            <>
              <TableContainer {...getTableContainerProps()}>
                <TableToolbar {...getToolbarProps()} size={responsiveSize}>
                  <TableToolbarContent>
                    <TableToolbarSearch
                      persistent
                      size={responsiveSize}
                      placeholder={t('searchQuestionnaires', 'Search questionnaires')}
                      labelText={t('searchQuestionnaires', 'Search questionnaires')}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchString(e.target.value)}
                    />
                    <Dropdown
                      id="filter-status"
                      titleText=""
                      label={t('status', 'Status')}
                      items={['all', 'draft', 'active', 'retired', 'unknown'] as const}
                      itemToString={(item) => {
                        if (!item || item === 'all') return t('allStatuses', 'All statuses');
                        return item.charAt(0).toUpperCase() + item.slice(1);
                      }}
                      selectedItem={statusFilter}
                      onChange={({ selectedItem }) =>
                        setStatusFilter((selectedItem ?? 'all') as QuestionnaireStatus | 'all')
                      }
                      size={responsiveSize}
                    />
                    <Button
                      kind="ghost"
                      renderIcon={Upload}
                      size={responsiveSize}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {t('import', 'Import')}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,.xml,application/json,application/xml,text/xml"
                      style={{ display: 'none' }}
                      onChange={handleImport}
                    />
                    <Button renderIcon={Add} size={responsiveSize} onClick={onNew}>
                      {t('newQuestionnaire', 'New questionnaire')}
                    </Button>
                  </TableToolbarContent>
                </TableToolbar>
                <Table {...getTableProps()} aria-label={t('questionnairesTable', 'Questionnaires table')}>
                  <TableHead>
                    <TableRow>
                      {headers.map((header) => (
                        <TableHeader {...getHeaderProps({ header })} key={header.key}>
                          {header.header}
                        </TableHeader>
                      ))}
                      <TableHeader aria-label={t('actions', 'Actions')} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => {
                      return (
                        <TableRow {...getRowProps({ row })} key={row.id}>
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>{cell.value?.content ?? cell.value}</TableCell>
                          ))}
                          <TableCell className="cds--table-column-menu">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              <IconButton
                                label={t('view', 'View')}
                                kind="ghost"
                                size={responsiveSize}
                                onClick={() => onView(row.id)}
                              >
                                <View />
                              </IconButton>
                              <OverflowMenu
                                align="left"
                                flipped
                                size={responsiveSize}
                                aria-label={t('actions', 'Actions')}
                              >
                                <OverflowMenuItem itemText={t('use', 'Use')} onClick={() => onRespond(row.id)} />
                                <OverflowMenuItem itemText={t('edit', 'Edit')} onClick={() => onEdit(row.id)} />
                                <OverflowMenuItem
                                  itemText={t('duplicate', 'Duplicate')}
                                  onClick={() => onDuplicate(row.id)}
                                />
                                <OverflowMenuItem
                                  itemText={t('delete', 'Delete')}
                                  isDelete
                                  onClick={() => setDeleteId(row.id)}
                                />
                              </OverflowMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              {rows.length === 0 && (
                <Layer>
                  <Tile className={styles.emptyTile}>
                    <p className={styles.emptyContent}>
                      {searchString
                        ? t('noMatchingQuestionnaires', 'No questionnaires match your search')
                        : t('noQuestionnaires', 'No questionnaires found')}
                    </p>
                  </Tile>
                </Layer>
              )}
            </>
          )}
        </DataTable>
        <Pagination
          backwardText={t('previousPage', 'Previous page')}
          forwardText={t('nextPage', 'Next page')}
          itemsPerPageText={t('itemsPerPage', 'Items per page') + ':'}
          page={currentPage}
          pageNumberText={t('pageNumber', 'Page number')}
          pageSize={pageSize}
          pageSizes={[10, 20, 50]}
          totalItems={filtered.length}
          onChange={({ page, pageSize }) => {
            goTo(page);
            setPageSize(pageSize);
          }}
        />
      </Layer>
    </>
  );
};

export default QuestionnairList;
