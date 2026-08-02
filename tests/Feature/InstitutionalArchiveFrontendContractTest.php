<?php

namespace Tests\Feature;

use Tests\TestCase;

class InstitutionalArchiveFrontendContractTest extends TestCase
{
    public function test_ui_helpers_execute_progress_validation_and_download_behaviors(): void
    {
        $helper = base_path('resources/js/features/arsip-digital/admin/institutionalArchiveUi.js');
        $script = <<<'JS'
import assert from 'node:assert/strict';
const { uploadPercent, validationErrors, runDownload, runPreview, archivePaginationTransition, archiveFilterTransition, archiveSortTransition, archiveTableView, institutionalArchiveTableController } = await import(process.argv[1]);
assert.equal(uploadPercent({ loaded: 25, total: 100 }), 25);
assert.equal(uploadPercent({ loaded: 150, total: 100 }), 100);
assert.equal(uploadPercent({ loaded: 1, total: 0 }), null);
assert.deepEqual(validationErrors({ errors: { title: ['Wajib'] } }), { title: ['Wajib'] });
assert.deepEqual(validationErrors({}), {});
let message = '';
assert.equal(await runDownload(async () => {}, value => { message = value; }, async () => ({ message: 'unused' })), true);
assert.equal(message, '');
assert.equal(await runDownload(async () => { throw new Error('private detail'); }, value => { message = value; }, async () => ({ message: 'Unduhan gagal.' })), false);
assert.equal(message, 'Unduhan gagal.');
assert.deepEqual(archivePaginationTransition({ page: 1, pageSize: 25 }, 25), { page: 2, pageSize: 25 });
assert.deepEqual(archivePaginationTransition({ page: 4, pageSize: 50 }, 25), { page: 1, pageSize: 50 });
assert.deepEqual(archiveFilterTransition({ search: 'surat', unit_id: 2 }, 50, { sort: 'file_size', direction: 'asc' }), { page: 1, pageSize: 50, filters: { search: 'surat', unit_id: 2, sort: 'file_size', direction: 'asc' } });
assert.deepEqual(archiveSortTransition([{ field: 'size', sort: 'asc' }]), { page: 1, sortModel: [{ field: 'size', sort: 'asc' }], filters: { sort: 'file_size', direction: 'asc' } });
assert.deepEqual(archiveSortTransition([]), { page: 1, sortModel: [], filters: { sort: 'created_at', direction: 'desc' } });
assert.equal(archiveTableView({ loading: true, error: '', rows: [] }), 'loading');
assert.equal(archiveTableView({ loading: false, error: 'Gagal', rows: [] }), 'error');
assert.equal(archiveTableView({ loading: false, error: '', rows: [] }), 'empty');
assert.equal(archiveTableView({ loading: false, error: '', rows: [{}] }), 'rows');
const applied = { search: '', sort: 'title', direction: 'asc' };
assert.deepEqual(institutionalArchiveTableController.pagination({ page: 1, pageSize: 25 }, 25, applied), { state: { page: 2, pageSize: 25 }, request: { page: 2, per_page: 25, ...applied } });
assert.deepEqual(institutionalArchiveTableController.pagination({ page: 3, pageSize: 50 }, 25, applied), { state: { page: 1, pageSize: 50 }, request: { page: 1, per_page: 50, ...applied } });
assert.deepEqual(institutionalArchiveTableController.filter({ search: 'surat' }, 25, applied), { state: { page: 1, pageSize: 25, filters: { search: 'surat', sort: 'title', direction: 'asc' } }, request: { page: 1, per_page: 25, search: 'surat', sort: 'title', direction: 'asc' } });
assert.deepEqual(institutionalArchiveTableController.sort([{ field: 'size', sort: 'desc' }], 50, applied), { state: { page: 1, pageSize: 50, sortModel: [{ field: 'size', sort: 'desc' }], filters: { search: '', sort: 'file_size', direction: 'desc' } }, request: { page: 1, per_page: 50, search: '', sort: 'file_size', direction: 'desc' } });
assert.deepEqual(institutionalArchiveTableController.upload(50, applied), { state: { page: 1, pageSize: 50 }, request: { page: 1, per_page: 50, ...applied } });
for (const [input, state] of [[{ loading: true, error: '', rows: [] }, 'loading'], [{ loading: false, error: 'x', rows: [] }, 'error'], [{ loading: false, error: '', rows: [] }, 'empty'], [{ loading: false, error: '', rows: [{}] }, 'rows']]) {
    const view = institutionalArchiveTableController.view(input);
    assert.equal(view.state, state); assert.deepEqual(view.props, { loading: input.loading, rows: input.rows, paginationMode: 'server', sortingMode: 'server', toolbar: false });
}
let requests = 0; let navigated = ''; let closed = false; let revoked = []; let placeholder = ''; let documentClosed = false; let scheduled = 0; let scheduledCallback;
const popup = { opener: {}, document: { write: value => { placeholder = value; }, close: () => { documentClosed = true; } }, location: { replace: value => { navigated = value; } }, close: () => { closed = true; } };
const urlApi = { createObjectURL: blob => { assert.equal(blob, 'blob'); return 'blob:test'; }, revokeObjectURL: value => { revoked.push(value); } };
assert.equal(await runPreview(() => popup, async () => { requests += 1; assert.match(placeholder, /Memuat preview arsip/); return 'blob'; }, urlApi, value => { message = value; }, async () => ({ message: 'Preview gagal.' }), (callback, delay) => { scheduled = delay; scheduledCallback = callback; }), true);
assert.equal(requests, 1); assert.equal(popup.opener, null); assert.equal(documentClosed, true); assert.equal(navigated, 'blob:test'); assert.deepEqual(revoked, []); assert.equal(scheduled, 60000); scheduledCallback(); assert.deepEqual(revoked, ['blob:test']);
closed = false;
assert.equal(await runPreview(() => popup, async () => { throw new Error('private'); }, urlApi, value => { message = value; }, async () => ({ message: 'Preview gagal.' })), false);
assert.equal(closed, true); assert.equal(message, 'Preview gagal.');
requests = 0;
assert.equal(await runPreview(() => null, async () => { requests += 1; }, urlApi, value => { message = value; }, async () => ({ message: 'unused' })), false);
assert.equal(requests, 0); assert.match(message, /Popup preview diblokir/);
closed = false; revoked = [];
const brokenPopup = { ...popup, location: { replace: () => { throw new Error('replace failed'); } } };
assert.equal(await runPreview(() => brokenPopup, async () => 'blob', urlApi, value => { message = value; }, async () => ({ message: 'Preview gagal.' })), false);
assert.deepEqual(revoked, ['blob:test']); assert.equal(closed, true); assert.equal(message, 'Preview gagal.');
console.log('behavior-ok');
JS;
        $command = ['node', '--input-type=module', '--eval', $script, 'file://'.$helper];
        $pipes = [];
        $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, base_path());
        $this->assertIsResource($process);
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);

        $this->assertSame(0, proc_close($process), $stderr);
        $this->assertStringContainsString('behavior-ok', $stdout);
    }

    public function test_archive_list_uses_controlled_server_datagrid_contract(): void
    {
        $source = file_get_contents(base_path('resources/js/features/arsip-digital/admin/AdminInstitutionalArchives.jsx'));
        $this->assertStringContainsString('<CustomDataTable {...table.props} columns={columns}', $source);
        $this->assertStringContainsString('getRowId={row => row.institutional_archive_id}', $source);
        $this->assertStringContainsString('rowCount={pagination.total ?? 0}', $source);
        $this->assertStringContainsString('paginationModel={{ page: page - 1, pageSize }}', $source);
        $this->assertStringContainsString('onPaginationModelChange={handlePaginationChange}', $source);
        $this->assertStringContainsString('pageSizeOptions={[10, 25, 50, 100]}', $source);
        $this->assertStringContainsString('institutionalArchiveTableController.pagination(model, pageSize, appliedFilters)', $source);
        $this->assertStringContainsString('setPageSize(next.state.pageSize)', $source);
        $this->assertStringContainsString('setRows([]); setError', $source);
        $this->assertStringContainsString('institutionalArchiveTableController.filter(filters, pageSize, appliedFilters)', $source);
        $this->assertStringContainsString('sortingMode="server" sortModel={sortModel} onSortModelChange={handleSortChange}', $source);
        $this->assertStringContainsString('institutionalArchiveTableController.sort(model, pageSize, appliedFilters)', $source);
        $this->assertStringContainsString('data-table-view={table.state}', $source);
        $this->assertStringContainsString("field: 'title', headerName: 'Judul'", $source);
        foreach (['document_number', 'unit', 'category', 'version', 'status', 'actions'] as $field) {
            $this->assertStringContainsString("field: '{$field}', headerName:", $source);
            $this->assertMatchesRegularExpression("/field: '{$field}', headerName: [^,]+, sortable: false/", $source);
        }
        $this->assertStringNotContainsString("input('sort'", $source);
        $this->assertStringNotContainsString("input('direction'", $source);
        $this->assertStringContainsString("renderCell: ({ row })", $source);

        $table = file_get_contents(base_path('resources/js/components/CustomDataTable.jsx'));
        foreach (['rows={rows}', 'columns={columns}', 'loading={loading}', "paginationMode: 'server'", 'rowCount:', 'paginationModel,', 'onPaginationModelChange,'] as $contract) {
            $this->assertStringContainsString($contract, $table);
        }

        $detail = file_get_contents(base_path('resources/js/features/arsip-digital/admin/AdminInstitutionalArchiveDetail.jsx'));
        $this->assertStringContainsString('runPreview(window.open.bind(window), () => arsipApi.previewInstitutionalArchive(id), URL, setError, formatArsipError)', $detail);
    }
}
