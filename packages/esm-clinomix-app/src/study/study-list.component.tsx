import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTable,
  Dropdown,
  IconButton,
  InlineLoading,
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
import { Add, View } from '@carbon/react/icons';
import { isDesktop, showSnackbar, useLayoutType, usePagination } from '@openmrs/esm-framework';
import { type Study, useStudies, useDeleteStudy } from './study.resource';
import styles from './study-list.scss';

interface StudyListProps {
  onNew: () => void;
  onView: (uuid: string) => void;
  onEdit: (uuid: string) => void;
}

const StudyList: React.FC<StudyListProps> = ({ onNew, onView, onEdit }) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';

  const [searchString, setSearchString] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED'>('ALL');
  const [pageSize, setPageSize] = useState(10);
  const [deleteUuid, setDeleteUuid] = useState<string | null>(null);

  const { studies, isLoading, mutate } = useStudies();
  const deleteStudy = useDeleteStudy();

  const deleteCandidate = useMemo(() => studies.find((s) => s.uuid === deleteUuid), [studies, deleteUuid]);

  const handleDelete = () => {
    if (!deleteUuid) return;
    deleteStudy(deleteUuid)
      .then(() => {
        mutate();
        showSnackbar({ kind: 'success', title: t('deleted', 'Deleted'), subtitle: t('studyDeleted', 'Study deleted') });
      })
      .catch((err: unknown) => {
        showSnackbar({
          kind: 'error',
          title: t('deleteFailed', 'Delete failed'),
          subtitle: err instanceof Error ? err.message : String(err),
        });
      });
    setDeleteUuid(null);
  };

  const filtered = useMemo(
    () =>
      studies.filter((s) => {
        if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
        const q = searchString.toLowerCase();
        return !q || s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q);
      }),
    [studies, searchString, statusFilter],
  );

  const { results, goTo, currentPage } = usePagination(filtered, pageSize);

  const headers = [
    { key: 'name', header: t('name', 'Name') },
    { key: 'status', header: t('status', 'Status') },
    { key: 'questionnaires', header: t('questionnaires', 'Questionnaires') },
    { key: 'responses', header: t('responses', 'Responses') },
    { key: 'dateCreated', header: t('created', 'Created') },
  ];

  const rows = useMemo(
    () =>
      results.map((s) => ({
        id: s.uuid,
        name: s.name,
        status: (
          <Tag type={s.status === 'ACTIVE' ? 'green' : 'gray'} size="sm">
            {s.status}
          </Tag>
        ),
        questionnaires: s.questionnaireIds.length,
        responses: s.responses.length,
        dateCreated: new Date(s.dateCreated).toLocaleDateString(),
      })),
    [results],
  );

  return (
    <>
      <Modal
        open={Boolean(deleteUuid)}
        danger
        modalHeading={t('deleteStudy', 'Delete study')}
        primaryButtonText={t('delete', 'Delete')}
        secondaryButtonText={t('cancel', 'Cancel')}
        onRequestSubmit={handleDelete}
        onRequestClose={() => setDeleteUuid(null)}
        onSecondarySubmit={() => setDeleteUuid(null)}
      >
        <p>
          {t('deleteStudyConfirm', 'Are you sure you want to delete')}{' '}
          <strong>{deleteCandidate?.name ?? deleteUuid}</strong>? {t('deleteWarning', 'This action cannot be undone.')}
        </p>
      </Modal>

      {isLoading && <InlineLoading description={t('loadingStudies', 'Loading studies…')} />}
      <Layer className={styles.container}>
        <DataTable rows={rows} headers={headers} isSortable size={responsiveSize} useZebraStyles>
          {({ rows, headers, getHeaderProps, getRowProps, getTableProps, getTableContainerProps, getToolbarProps }) => (
            <>
              <TableContainer {...getTableContainerProps()}>
                <TableToolbar {...getToolbarProps()} size={responsiveSize}>
                  <TableToolbarContent>
                    <TableToolbarSearch
                      persistent
                      size={responsiveSize}
                      placeholder={t('searchStudies', 'Search studies')}
                      labelText={t('searchStudies', 'Search studies')}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchString(e.target.value)}
                    />
                    <Dropdown
                      id="filter-study-status"
                      titleText=""
                      label={t('status', 'Status')}
                      items={['ALL', 'ACTIVE', 'CLOSED'] as const}
                      itemToString={(item) => {
                        if (!item || item === 'ALL') return t('allStatuses', 'All statuses');
                        return item.charAt(0) + item.slice(1).toLowerCase();
                      }}
                      selectedItem={statusFilter}
                      onChange={({ selectedItem }) => setStatusFilter((selectedItem ?? 'ALL') as typeof statusFilter)}
                      size={responsiveSize}
                    />
                    <Button renderIcon={Add} size={responsiveSize} onClick={onNew}>
                      {t('newStudy', 'New study')}
                    </Button>
                  </TableToolbarContent>
                </TableToolbar>
                <Table {...getTableProps()} aria-label={t('studiesTable', 'Studies table')}>
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
                    {rows.map((row) => (
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
                              <OverflowMenuItem itemText={t('edit', 'Edit')} onClick={() => onEdit(row.id)} />
                              <OverflowMenuItem
                                itemText={t('delete', 'Delete')}
                                isDelete
                                onClick={() => setDeleteUuid(row.id)}
                              />
                            </OverflowMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {rows.length === 0 && (
                <Layer>
                  <Tile className={styles.emptyTile}>
                    <p className={styles.emptyContent}>
                      {searchString
                        ? t('noMatchingStudies', 'No studies match your search')
                        : t('noStudies', 'No studies yet. Create one to group questionnaires and responses.')}
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

export default StudyList;
