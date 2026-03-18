import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTable,
  Dropdown,
  IconButton,
  Layer,
  Modal,
  OverflowMenu,
  OverflowMenuItem,
  Pagination,
  RadioButton,
  RadioButtonGroup,
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
import { DocumentExport, Upload, View } from '@carbon/react/icons';
import { isDesktop, showSnackbar, useLayoutType, usePagination } from '@openmrs/esm-framework';
import {
  type FhirQuestionnaireResponse,
  type QuestionnaireResponseStatus,
  useResponses,
  useImportResponses,
  useDeleteResponse,
} from './questionnaire-response.resource';
import { type ExportFormat, type GroupMode, exportJsonBundle, exportPdfGrouped } from './questionnaire-response-export';
import { isXmlFile, parseFhirXml } from '@/questionnaire/fhir-xml.parser';
import styles from './questionnaire-response-list.scss';

interface QuestionnaireResponseListProps {
  onView: (id: string) => void;
}

interface FilterItem {
  id: string;
  label: string;
}

function statusTag(status: QuestionnaireResponseStatus) {
  const typeMap: Record<QuestionnaireResponseStatus, 'green' | 'blue' | 'teal' | 'red' | 'cool-gray'> = {
    completed: 'green',
    'in-progress': 'blue',
    amended: 'teal',
    'entered-in-error': 'red',
    stopped: 'cool-gray',
  };
  return (
    <Tag type={typeMap[status] ?? 'cool-gray'} size="sm">
      {status}
    </Tag>
  );
}

const ALL_ID = '__all__';

const QuestionnaireResponseList: React.FC<QuestionnaireResponseListProps> = ({ onView }) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';
  const importResponses = useImportResponses();
  const deleteResponse = useDeleteResponse();

  const [searchString, setSearchString] = useState('');
  const [filterQuestionnaire, setFilterQuestionnaire] = useState<FilterItem | null>(null);
  const [filterPatient, setFilterPatient] = useState<FilterItem | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Export modal state ───────────────────────────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [groupMode, setGroupMode] = useState<GroupMode>('none');

  // ── Import ───────────────────────────────────────────────────────────────────

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = isXmlFile(file) ? parseFhirXml(text) : (JSON.parse(text) as unknown);

        const resources: FhirQuestionnaireResponse[] = [];
        const rt = (parsed as { resourceType?: string }).resourceType;

        if (rt === 'Bundle') {
          const entries = (parsed as { entry?: { resource?: unknown }[] }).entry ?? [];
          for (const entry of entries) {
            if ((entry.resource as { resourceType?: string })?.resourceType === 'QuestionnaireResponse') {
              resources.push(entry.resource as FhirQuestionnaireResponse);
            }
          }
        } else if (rt === 'QuestionnaireResponse') {
          resources.push(parsed as FhirQuestionnaireResponse);
        }

        if (resources.length === 0) {
          showSnackbar({
            kind: 'error',
            title: t('importFailed', 'Import failed'),
            subtitle: t('notAResponse', 'The file does not contain a valid FHIR QuestionnaireResponse resource.'),
          });
          return;
        }

        const { added, updated } = await importResponses(resources);
        mutate();
        showSnackbar({
          kind: 'success',
          title: t('imported', 'Imported'),
          subtitle:
            added > 0 && updated > 0
              ? `${added} added, ${updated} updated`
              : added > 0
                ? `${added} response(s) imported`
                : `${updated} response(s) updated`,
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

  // ── Data ─────────────────────────────────────────────────────────────────────

  const { responses, mutate } = useResponses();

  const allOption = useMemo<FilterItem>(() => ({ id: ALL_ID, label: t('all', 'All') }), [t]);

  const questionnaireOptions = useMemo<FilterItem[]>(() => {
    const unique = [...new Set(responses.map((r) => r.questionnaire).filter(Boolean))] as string[];
    return [allOption, ...unique.map((q) => ({ id: q, label: q }))];
  }, [responses, allOption]);

  const patientOptions = useMemo<FilterItem[]>(() => {
    const unique = [...new Set(responses.map((r) => r.subject?.display).filter(Boolean))] as string[];
    return [allOption, ...unique.map((p) => ({ id: p, label: p }))];
  }, [responses, allOption]);

  const hasActiveFilters =
    searchString.trim().length > 0 ||
    (filterQuestionnaire !== null && filterQuestionnaire.id !== ALL_ID) ||
    (filterPatient !== null && filterPatient.id !== ALL_ID);

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteResponse(deleteId);
      setDeleteId(null);
      mutate();
      showSnackbar({
        kind: 'success',
        title: t('deleted', 'Deleted'),
        subtitle: t('responseDeleted', 'Response deleted successfully'),
      });
    } catch (err) {
      showSnackbar({
        kind: 'error',
        title: t('error', 'Error'),
        subtitle: err instanceof Error ? err.message : t('deleteFailed', 'Failed to delete response'),
      });
    }
  };

  // ── Filtering ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const search = searchString.trim().toLowerCase();
    const qFilter = filterQuestionnaire?.id !== ALL_ID ? filterQuestionnaire?.id : null;
    const pFilter = filterPatient?.id !== ALL_ID ? filterPatient?.id : null;

    return responses.filter((r) => {
      if (qFilter && r.questionnaire !== qFilter) return false;
      if (pFilter && r.subject?.display !== pFilter) return false;
      if (search) {
        const inQuestionnaire = (r.questionnaire ?? '').toLowerCase().includes(search);
        const inPatient = (r.subject?.display ?? '').toLowerCase().includes(search);
        const inAuthor = (r.author?.display ?? '').toLowerCase().includes(search);
        if (!inQuestionnaire && !inPatient && !inAuthor) return false;
      }
      return true;
    });
  }, [responses, searchString, filterQuestionnaire, filterPatient]);

  // ── Export ───────────────────────────────────────────────────────────────────

  const handleExport = () => {
    if (filtered.length === 0) return;
    if (exportFormat === 'json') {
      exportJsonBundle(filtered);
    } else {
      exportPdfGrouped(filtered, groupMode);
    }
    setExportOpen(false);
  };

  // ── Table ────────────────────────────────────────────────────────────────────

  const { results, goTo, currentPage } = usePagination(filtered, pageSize);

  const headers = [
    { key: 'questionnaire', header: t('questionnaire', 'Questionnaire') },
    { key: 'patient', header: t('patient', 'Patient') },
    { key: 'author', header: t('author', 'Author') },
    { key: 'status', header: t('status', 'Status') },
    { key: 'date', header: t('date', 'Date') },
  ];

  const rows = useMemo(
    () =>
      results.map((r) => ({
        id: r.id ?? '',
        questionnaire: r.questionnaire ?? '—',
        patient: r.subject?.display ?? '—',
        author: r.author?.display ?? '—',
        status: statusTag(r.status),
        date: r.authored ? new Date(r.authored).toLocaleString() : '—',
      })),
    [results],
  );

  return (
    <>
      {/* ── Delete confirm ──────────────────────────────────── */}
      <Modal
        open={Boolean(deleteId)}
        danger
        modalHeading={t('deleteResponse', 'Delete response')}
        primaryButtonText={t('delete', 'Delete')}
        secondaryButtonText={t('cancel', 'Cancel')}
        onRequestSubmit={handleDelete}
        onRequestClose={() => setDeleteId(null)}
        onSecondarySubmit={() => setDeleteId(null)}
      >
        <p>
          {t(
            'deleteResponseConfirmation',
            'Are you sure you want to delete this response? This action cannot be undone.',
          )}
        </p>
      </Modal>

      {/* ── Export modal ────────────────────────────────────── */}
      <Modal
        open={exportOpen}
        modalHeading={t('exportResponses', 'Export responses')}
        primaryButtonText={t('export', 'Export')}
        primaryButtonDisabled={filtered.length === 0}
        secondaryButtonText={t('cancel', 'Cancel')}
        onRequestSubmit={handleExport}
        onRequestClose={() => setExportOpen(false)}
        onSecondarySubmit={() => setExportOpen(false)}
      >
        <p style={{ marginBottom: '1rem', color: '#525252', fontSize: '13px' }}>
          {t('exportCount', `${filtered.length} response(s) selected for export based on current filters.`)}
        </p>

        <RadioButtonGroup
          name="export-format"
          legendText={t('format', 'Format')}
          valueSelected={exportFormat}
          onChange={(val) => setExportFormat(val as ExportFormat)}
          orientation="vertical"
          style={{ marginBottom: '1.5rem' }}
        >
          <RadioButton
            id="ef-json"
            value="json"
            labelText={t('jsonBundle', 'JSON Bundle — FHIR R4 collection bundle (.json)')}
          />
          <RadioButton
            id="ef-pdf"
            value="pdf"
            labelText={t('pdfReport', 'PDF Report — printable / saveable report (.pdf)')}
          />
        </RadioButtonGroup>

        {exportFormat === 'pdf' && (
          <RadioButtonGroup
            name="export-grouping"
            legendText={t('groupBy', 'Group by')}
            valueSelected={groupMode}
            onChange={(val) => setGroupMode(val as GroupMode)}
            orientation="vertical"
          >
            <RadioButton id="eg-none" value="none" labelText={t('noGrouping', 'No grouping — chronological list')} />
            <RadioButton
              id="eg-questionnaire"
              value="questionnaire"
              labelText={t('byQuestionnaire', 'By questionnaire — one section per questionnaire')}
            />
            <RadioButton
              id="eg-patient"
              value="patient"
              labelText={t('byPatient', 'By patient — one section per patient')}
            />
            <RadioButton
              id="eg-both"
              value="questionnaire-patient"
              labelText={t('byBoth', 'By questionnaire then patient — two-level grouping')}
            />
          </RadioButtonGroup>
        )}
      </Modal>

      {/* ── List ────────────────────────────────────────────── */}
      <Layer className={styles.container}>
        <DataTable rows={rows} headers={headers} isSortable size={responsiveSize} useZebraStyles>
          {({
            rows: tableRows,
            headers: tableHeaders,
            getHeaderProps,
            getRowProps,
            getTableProps,
            getTableContainerProps,
            getToolbarProps,
          }) => (
            <>
              <TableContainer {...getTableContainerProps()}>
                <TableToolbar {...getToolbarProps()} size={responsiveSize}>
                  <TableToolbarContent>
                    <TableToolbarSearch
                      persistent
                      size={responsiveSize}
                      placeholder={t('searchResponses', 'Search responses')}
                      labelText={t('searchResponses', 'Search responses')}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setSearchString(e.target.value);
                        goTo(1);
                      }}
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
                    <Button
                      kind="ghost"
                      renderIcon={DocumentExport}
                      size={responsiveSize}
                      onClick={() => setExportOpen(true)}
                      disabled={filtered.length === 0}
                    >
                      {t('export', 'Export')}
                      {filtered.length > 0 ? ` (${filtered.length})` : ''}
                    </Button>
                    <Dropdown
                      id="filter-questionnaire"
                      titleText=""
                      label={t('questionnaire', 'Questionnaire')}
                      items={questionnaireOptions}
                      itemToString={(item) => item?.label ?? ''}
                      selectedItem={filterQuestionnaire}
                      onChange={({ selectedItem }) => {
                        setFilterQuestionnaire(selectedItem ?? null);
                        goTo(1);
                      }}
                      size={responsiveSize}
                      className={styles.filterDropdown}
                    />
                    <Dropdown
                      id="filter-patient"
                      titleText=""
                      label={t('patient', 'Patient')}
                      items={patientOptions}
                      itemToString={(item) => item?.label ?? ''}
                      selectedItem={filterPatient}
                      onChange={({ selectedItem }) => {
                        setFilterPatient(selectedItem ?? null);
                        goTo(1);
                      }}
                      size={responsiveSize}
                      className={styles.filterDropdown}
                    />
                  </TableToolbarContent>
                </TableToolbar>

                <Table {...getTableProps()} aria-label={t('responsesTable', 'Responses table')}>
                  <TableHead>
                    <TableRow>
                      {tableHeaders.map((header) => (
                        <TableHeader {...getHeaderProps({ header })} key={header.key}>
                          {header.header}
                        </TableHeader>
                      ))}
                      <TableHeader aria-label={t('actions', 'Actions')} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableRows.map((row) => (
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
                              <OverflowMenuItem
                                itemText={t('delete', 'Delete')}
                                isDelete
                                onClick={() => setDeleteId(row.id)}
                              />
                            </OverflowMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {tableRows.length === 0 && (
                <Layer>
                  <Tile className={styles.emptyTile}>
                    <p className={styles.emptyContent}>
                      {hasActiveFilters
                        ? t('noMatchingResponses', 'No responses match your filters')
                        : t('noResponses', 'No responses recorded yet')}
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
          onChange={({ page, pageSize: ps }) => {
            goTo(page);
            setPageSize(ps);
          }}
        />
      </Layer>
    </>
  );
};

export default QuestionnaireResponseList;
