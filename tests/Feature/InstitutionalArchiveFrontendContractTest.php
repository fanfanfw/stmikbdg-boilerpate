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
const { classificationDialogState, classificationPayload, requestSequence, routeLifecycle, runClassificationCreate, runClassificationLoad, uploadPercent, validationErrors, clearNativeFileInput, runDownload, runPreview, archivePaginationTransition, archiveFilterTransition, archiveSortTransition, archiveTableView, institutionalArchiveTableController } = await import(process.argv[1]);
assert.equal(uploadPercent({ loaded: 25, total: 100 }), 25);
assert.equal(uploadPercent({ loaded: 150, total: 100 }), 100);
assert.equal(uploadPercent({ loaded: 1, total: 0 }), null);
assert.deepEqual(validationErrors({ errors: { title: ['Wajib'] } }), { title: ['Wajib'] });
assert.deepEqual(validationErrors({}), {});
assert.deepEqual(classificationPayload('unit', { name: ' TU ', code: ' ', description: ' desc ' }), { name: 'TU', code: null, description: 'desc' });
assert.deepEqual(classificationPayload('folder', { name: ' Root ', parent_category_id: '', description: ' ' }), { name: 'Root', parent_category_id: null, description: null });
const preservedUpload={title:'Arsip',file:{name:'arsip.pdf'}}; assert.deepEqual(classificationDialogState(true,'unit',preservedUpload),{uploadOpen:false,createOpen:true,uploadForm:preservedUpload}); assert.deepEqual(classificationDialogState(true,'',preservedUpload),{uploadOpen:true,createOpen:false,uploadForm:preservedUpload});
const uploadForm = { title: 'Arsip', unit_id: '', category_id: '', file: { name: 'arsip.pdf' }, description: 'tetap' }; const createLock = { current: false }; let createCalls = 0, options = [], selected, warning = '', createFailure = 0, fieldFailure = {}, releaseCreate;
const pending = runClassificationCreate({ type: 'unit', form: { name: ' TU ', code: '', description: '' }, uploadForm, lock: createLock, create: async payload => { createCalls++; assert.deepEqual(payload, { name: 'TU', code: null, description: null }); await new Promise(resolve => { releaseCreate = resolve; }); return { data: { unit: { unit_id: 7, name: 'TU' } } }; }, refresh: async () => { throw new Error('refresh'); }, formatError: async () => ({ message: 'create failed', errors: {} }), onCreated: (created, updateForm) => { options = [...options, created]; selected = updateForm(uploadForm); }, onRefreshed: () => assert.fail('refresh failed'), onWarning: value => { warning = value; }, onError: () => createFailure++ });
assert.equal(typeof createLock.current, 'symbol'); assert.equal(await runClassificationCreate({ type: 'unit', form: { name: 'duplicate', code: '', description: '' }, uploadForm, lock: createLock, create: async () => createCalls++, refresh: async () => [], formatError: async () => ({}), onCreated: () => {}, onRefreshed: () => {}, onWarning: () => {}, onError: () => {} }), false); assert.equal(createCalls, 1); releaseCreate(); assert.equal(await pending, true); assert.equal(createLock.current, false); assert.deepEqual(options, [{ unit_id: 7, name: 'TU' }]); assert.equal(selected.unit_id, 7); assert.equal(selected.file, uploadForm.file); assert.equal(selected.title, 'Arsip'); assert.equal(selected.description, 'tetap'); assert.match(warning, /berhasil dibuat/); assert.equal(createFailure, 0); assert.equal(createCalls, 1);
const failedLock = { current: false }; assert.equal(await runClassificationCreate({ type: 'folder', form: { name: ' Root ', parent_category_id: '', description: '' }, uploadForm, lock: failedLock, create: async payload => { createCalls++; assert.equal(payload.parent_category_id, null); throw new Error('api'); }, refresh: async () => [], formatError: async () => ({ message: 'Validasi gagal', errors: { name: ['Sudah ada'] } }), onCreated: () => assert.fail('must preserve'), onRefreshed: () => {}, onWarning: () => {}, onError: (message, errors) => { createFailure++; fieldFailure = errors; assert.equal(message, 'Validasi gagal'); } }), false); assert.equal(failedLock.current, false); assert.deepEqual(fieldFailure, { name: ['Sudah ada'] }); assert.equal(createFailure, 1); assert.equal(uploadForm.file.name, 'arsip.pdf');
const generalLock = { current: false }; let generalError = '', generalCreated = 0, generalRefreshed = 0; assert.equal(await runClassificationCreate({ type: 'unit', form: { name: 'X', code: '', description: '' }, lock: generalLock, create: async () => { throw new Error('private'); }, refresh: async () => [], formatError: async () => ({ message: 'Layanan gagal.', errors: {} }), onCreated: () => generalCreated++, onRefreshed: () => generalRefreshed++, onWarning: () => {}, onError: (message, errors) => { generalError = message; assert.deepEqual(errors, {}); } }), false); assert.equal(generalLock.current, false); assert.equal(generalError, 'Layanan gagal.'); assert.deepEqual([generalCreated, generalRefreshed], [0, 0]); assert.equal(uploadForm.file.name, 'arsip.pdf');
const race = requestSequence(); const staleRequest = race.next(); const currentRequest = race.next(); let appliedOptions = ''; if (race.valid(currentRequest)) appliedOptions = 'new'; if (race.valid(staleRequest)) appliedOptions = 'old'; assert.equal(appliedOptions, 'new');
const staleLoads = requestSequence(); let rejectStale, loadErrors = 0; const staleLoad = runClassificationLoad({ requests: staleLoads, load: () => new Promise((_, reject) => { rejectStale = reject; }), formatError: async () => ({ message: 'stale' }), onSuccess: () => assert.fail('stale success'), onError: () => loadErrors++ }); staleLoads.next(); rejectStale(new Error('stale')); assert.equal(await staleLoad, false); assert.equal(loadErrors, 0);
const unmountedLoads = requestSequence(); let rejectUnmounted; const unmountedLoad = runClassificationLoad({ requests: unmountedLoads, load: () => new Promise((_, reject) => { rejectUnmounted = reject; }), formatError: async () => ({ message: 'unmounted' }), onSuccess: () => assert.fail('unmounted success'), onError: () => loadErrors++ }); unmountedLoads.invalidate(); rejectUnmounted(new Error('unmounted')); assert.equal(await unmountedLoad, false); assert.equal(loadErrors, 0);
const staleCreateLifecycle = routeLifecycle('create'); const staleCreateLock = { current: false }; let resolveStaleCreate, staleCallbacks = 0; const staleCreate = runClassificationCreate({ type: 'unit', form: { name: 'Stale', code: '', description: '' }, lock: staleCreateLock, capture: staleCreateLifecycle, create: () => new Promise(resolve => { resolveStaleCreate = resolve; }), refresh: async () => [], formatError: async () => ({ message: 'x' }), onBusy: () => staleCallbacks++, onCreated: () => staleCallbacks++, onRefreshed: () => staleCallbacks++, onWarning: () => staleCallbacks++, onError: () => staleCallbacks++ }); assert.equal(staleCallbacks, 1); staleCreateLifecycle.invalidate(); resolveStaleCreate({ data: { unit: { unit_id: 9 } } }); assert.equal(await staleCreate, false); assert.equal(staleCallbacks, 1); assert.equal(staleCreateLock.current, false);
const rejectLifecycle = routeLifecycle('reject'); const rejectLock = { current: false }; let rejectCreate; staleCallbacks = 0; const staleReject = runClassificationCreate({ type: 'unit', form: { name: 'Reject', code: '', description: '' }, lock: rejectLock, capture: rejectLifecycle, create: () => new Promise((_, reject) => { rejectCreate = reject; }), refresh: async () => [], formatError: async () => ({ message: 'x' }), onBusy: () => staleCallbacks++, onCreated: () => staleCallbacks++, onRefreshed: () => staleCallbacks++, onWarning: () => staleCallbacks++, onError: () => staleCallbacks++ }); rejectLifecycle.invalidate(); rejectCreate(new Error('x')); assert.equal(await staleReject, false); assert.equal(staleCallbacks, 1); assert.equal(rejectLock.current, false);
const refreshLifecycle = routeLifecycle('refresh'); const refreshLock = { current: false }; let resolveRefresh; staleCallbacks = 0; const staleRefresh = runClassificationCreate({ type: 'unit', form: { name: 'Refresh', code: '', description: '' }, lock: refreshLock, capture: refreshLifecycle, create: async () => ({ data: { unit: { unit_id: 10 } } }), refresh: () => new Promise(resolve => { resolveRefresh = resolve; }), formatError: async () => ({}), onBusy: () => staleCallbacks++, onCreated: () => staleCallbacks++, onRefreshed: () => staleCallbacks++, onWarning: () => staleCallbacks++, onError: () => staleCallbacks++ }); await Promise.resolve(); assert.equal(staleCallbacks, 2); refreshLifecycle.invalidate(); resolveRefresh([]); assert.equal(await staleRefresh, false); assert.equal(staleCallbacks, 2); assert.equal(refreshLock.current, false); const freshLifecycle = routeLifecycle('fresh'); let freshBusy = []; assert.equal(await runClassificationCreate({ type: 'unit', form: { name: 'Fresh', code: '', description: '' }, lock: refreshLock, capture: freshLifecycle, create: async () => ({ data: { unit: { unit_id: 11 } } }), refresh: async () => [], formatError: async () => ({}), onBusy: value => freshBusy.push(value), onCreated: () => {}, onRefreshed: () => {}, onWarning: () => {}, onError: () => {} }), true); assert.deepEqual(freshBusy, [true, false]);
let createWarning = 'old warning'; const warningLock = { current: false }; createWarning = ''; assert.equal(await runClassificationCreate({ type: 'unit', form: { name: 'New', code: '', description: '' }, lock: warningLock, create: async () => ({ data: { unit: { unit_id: 8 } } }), refresh: async () => ['fresh'], formatError: async () => ({}), onCreated: () => {}, onRefreshed: () => { createWarning = ''; }, onWarning: value => { createWarning = value; }, onError: () => {} }), true); assert.equal(createWarning, '');
const nativeFileInput = { current: { value: 'selected.pdf' } }; clearNativeFileInput(nativeFileInput); assert.equal(nativeFileInput.current.value, '');
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
let lifecycleActive=true, staleErrors=0; closed=false; assert.equal(await runPreview(() => popup, async () => { lifecycleActive=false; throw new Error('stale private'); }, urlApi, () => staleErrors++, async () => ({message:'must not render'}), setTimeout, {valid:()=>lifecycleActive}), false); assert.equal(closed,true); assert.equal(staleErrors,0);
revoked=[]; const order=[]; const orderedPopup={...popup,location:{replace:value=>order.push(`navigate:${value}`)},addEventListener:()=>order.push('listener')}; assert.equal(await runPreview(()=>orderedPopup,async()=>'blob',urlApi,()=>{},async()=>({message:'x'}),(callback,delay)=>{order.push(`timer:${delay}`);scheduledCallback=callback;}),true); assert.deepEqual(order,['navigate:blob:test','timer:60000']); assert.deepEqual(revoked,[]); scheduledCallback(); assert.deepEqual(revoked,['blob:test']);
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

    public function test_upload_modal_supports_inline_classification_creation_and_internal_access(): void
    {
        $source = file_get_contents(base_path('resources/js/features/arsip-digital/admin/AdminInstitutionalArchives.jsx'));

        foreach (['+ Buat Unit', '+ Buat Folder', 'arsipApi.createInstitutionalUnit(payload)', 'arsipApi.createInstitutionalCategory(payload)', 'runClassificationCreate({', 'setForm(updateForm)', "data.append('access_level', 'internal')", 'createLock.current', 'createFieldErrors', 'disabled={creating}'] as $contract) {
            $this->assertStringContainsString($contract, $source);
        }
        $this->assertStringContainsString('<Dialog open={Boolean(createType)}', $source);
        $this->assertStringContainsString('classificationDialogState(open, createType, form)', $source);
        $this->assertStringContainsString('<Dialog open={dialogs.uploadOpen}', $source);
        $this->assertStringContainsString('setRefreshWarning(', $source);
        $this->assertStringContainsString('<strong>Akses: Internal.</strong> Arsip dikelola bersama oleh admin.', $source);
        $this->assertStringContainsString('classificationRequests.current.next()', $source);
        $this->assertStringContainsString('classificationRequests.current.invalidate()', $source);
        $this->assertStringContainsString('classificationLifecycle.current.invalidate()', $source);
        $this->assertStringContainsString('capture: classificationLifecycle.current, onBusy: setCreating', $source);
        $this->assertStringContainsString('runClassificationLoad({ requests: classificationRequests.current', $source);
        $this->assertStringContainsString("setCreateFieldErrors({}); setRefreshWarning('')", $source);
        $this->assertStringContainsString("onRefreshed: () => setRefreshWarning('')", $source);
        $this->assertStringNotContainsString("input('access_level', 'Akses'", $source);
        $this->assertStringNotContainsString('label="Akses"', $source);
        $this->assertStringNotContainsString('value="restricted"', $source);
        $this->assertStringNotContainsString("access_level: 'internal'", $source);
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
        $this->assertStringContainsString('renderCell: ({ row })', $source);

        $table = file_get_contents(base_path('resources/js/components/CustomDataTable.jsx'));
        foreach (['rows={rows}', 'columns={columns}', 'loading={loading}', "paginationMode: 'server'", 'rowCount:', 'paginationModel,', 'onPaginationModelChange,'] as $contract) {
            $this->assertStringContainsString($contract, $table);
        }

        $detail = file_get_contents(base_path('resources/js/features/arsip-digital/admin/AdminInstitutionalArchiveDetail.jsx'));
        $this->assertStringContainsString('runPreview(window.open.bind(window), () => arsipApi.previewVerified(archiveId), URL, value => { if (lifecycle.valid()) setError(value); }, formatArsipError, setTimeout, lifecycle)', $detail);
    }

    public function test_versioning_helpers_execute_success_failure_pagination_and_exact_download_contracts(): void
    {
        $helper = base_path('resources/js/features/arsip-digital/admin/institutionalArchiveUi.js');
        $script = <<<'JS'
import assert from 'node:assert/strict';
const { exactVersionDownload, institutionalArchiveRouteReset, requestSequence, retryVersionRefresh, routeActionAllowed, routeLifecycle, runExactVersionDownload, runVersionUpload, versionHistoryRequest, versionHistoryState, versionHistoryView } = await import(process.argv[1]);
const file = new Blob(['pdf'], { type: 'application/pdf' }); const input = { current: { value: 'revisi.pdf' } };
let uploads = 0, busy = [], progress = [], detail = 0, history = [], success = 0, error = '';
const options = { busy: false, file, reason: '  Koreksi isi  ', fileInput: input,
 upload: async (data, report) => { uploads++; assert.equal(data.get('file').size, file.size); assert.equal(data.get('file').type, file.type); assert.equal(data.get('reason'), 'Koreksi isi'); report({ loaded: 1, total: 2 }); },
 refreshDetail: async () => { detail++; }, refreshHistory: async page => { history.push(page); },
 onBusy: value => busy.push(value), onProgress: value => progress.push(value), onSuccess: () => { success++; }, onError: value => { error = value?.message || value; } };
assert.equal(await runVersionUpload(options), true); assert.equal(uploads, 1); assert.deepEqual(busy, [true, false]); assert.deepEqual(progress, [0, 50, null]); assert.equal(input.current.value, ''); assert.equal(detail, 1); assert.deepEqual(history, [1]); assert.equal(success, 1); assert.equal(error, '');
assert.equal(await runVersionUpload({ ...options, busy: true }), false); assert.equal(uploads, 1);
error = ''; success = 0; progress = []; detail = 0; history = [];
assert.equal(await runVersionUpload({ ...options, file: null }), false); assert.match(error, /wajib/); assert.equal(uploads, 1);
error = ''; busy = []; progress = [];
assert.equal(await runVersionUpload({ ...options, upload: async () => { throw new Error('private'); }, formatError: async () => ({ message: 'Upload gagal.' }) }), false); assert.equal(error, 'Upload gagal.'); assert.equal(success, 0); assert.equal(detail, 0); assert.deepEqual(history, []); assert.deepEqual(progress, [0, null]); assert.deepEqual(busy, [true, false]);
assert.deepEqual(versionHistoryRequest(3), { page: 3, per_page: 10 });
const rows = versionHistoryState([{ file_id: 9, version_number: 3, is_current: true }, { file_id: 4, version_number: 2, is_current: false }]); assert.equal(rows[0].current_label, 'Saat ini'); assert.equal(rows[1].current_label, ''); assert.deepEqual(rows.map(x => x.version_number), [3, 2]);
let exact; await exactVersionDownload(async (archiveId, version) => { exact = [archiveId, version]; }, 7, { file_id: 4, display_filename: 'lama.pdf', storage_path: 'secret' }); assert.deepEqual(exact, [7, { file_id: 4, display_filename: 'lama.pdf' }]);
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const gate = deferred(); const lock = { current: false }; uploads = 0; busy = []; progress = []; let oldCallbacks = 0, oldRefresh = 0;
const uploadRouteA = routeLifecycle('A');
const lockedOptions = { ...options, lifecycle: uploadRouteA, lock, upload: async () => { uploads++; await gate.promise; }, refreshDetail: async () => oldRefresh++, refreshHistory: async () => oldRefresh++, onBusy: () => oldCallbacks++, onProgress: () => oldCallbacks++, onSuccess: () => oldCallbacks++, onError: () => oldCallbacks++ };
const first = runVersionUpload(lockedOptions); uploadRouteA.invalidate(); const uploadRouteB = routeLifecycle('B'); const second = runVersionUpload({ ...options, lifecycle: uploadRouteB, lock }); assert.equal(await second, false); assert.equal(uploads, 1); assert.equal(lock.current, true); const callbacksBeforeResolve = oldCallbacks; gate.resolve(); assert.equal(await first, false); assert.equal(oldCallbacks, callbacksBeforeResolve); assert.equal(oldRefresh, 0); assert.equal(lock.current, false); assert.equal(await runVersionUpload({ ...options, lifecycle: uploadRouteB, lock }), true); assert.equal(lock.current, false);
const failedLock = { current: false }; assert.equal(await runVersionUpload({ ...options, lock: failedLock, upload: async () => { throw new Error('fail'); } }), false); assert.equal(failedLock.current, false);
let currentRoute = 'A'; const renderRace = routeLifecycle('A', archiveId => archiveId === currentRoute); currentRoute = 'B'; let renderRaceUploads = 0; assert.equal(routeActionAllowed(renderRace, currentRoute, 'A'), false); assert.equal(await runVersionUpload({ ...options, lifecycle: renderRace, upload: async () => renderRaceUploads++ }), false); assert.equal(renderRaceUploads, 0);
assert.deepEqual(institutionalArchiveRouteReset(), { saving: false, downloading: false, versionProgress: null, versions: [], versionPage: 1, versionPages: 1, historyInitialLoading: true, historyPageLoading: false, historyError: '', archive: null, form: {}, success: '', error: '', refreshWarning: '', versionFile: null, reason: '' });
const routeA = routeLifecycle('A'); assert.equal(routeA.archiveId, 'A'); routeA.invalidate(); assert.equal(routeA.valid(), false); const routeB = routeLifecycle('B'); assert.equal(routeB.valid(), true);
const oldRequests = requestSequence(); const oldFirst = oldRequests.next(); const oldLatest = oldRequests.next(); assert.equal(oldRequests.valid(oldFirst), false); assert.equal(oldRequests.valid(oldLatest), true); oldRequests.invalidate(); assert.equal(oldRequests.valid(oldLatest), false); const freshRequests = requestSequence(); assert.equal(freshRequests.valid(freshRequests.next()), true);
let partial = '', fullSuccess = 0; const partialLock = { current: false }; assert.equal(await runVersionUpload({ ...options, lock: partialLock, refreshDetail: async () => { throw new Error('refresh'); }, onSuccess: () => fullSuccess++, onPartialSuccess: value => { partial = value.message; }, formatError: async () => ({ message: 'Sinkronisasi gagal.' }) }), false); assert.equal(partial, 'Sinkronisasi gagal.'); assert.equal(fullSuccess, 0); assert.equal(partialLock.current, false);
let refreshDetail = 0, refreshHistory = 0, retrySuccess = 0, retryError = 0, retryUploads = 0; assert.equal(await retryVersionRefresh({ refreshDetail: async () => refreshDetail++, refreshHistory: async page => { assert.equal(page, 1); refreshHistory++; }, onSuccess: () => retrySuccess++, onError: () => retryError++ }), true); assert.deepEqual([refreshDetail, refreshHistory, retrySuccess, retryError, retryUploads], [1, 1, 1, 0, 0]); assert.equal(await retryVersionRefresh({ refreshDetail: async () => { throw new Error('retry'); }, refreshHistory: async () => refreshHistory++, onSuccess: () => retrySuccess++, onError: () => retryError++ }), false); assert.equal(retryError, 1); assert.equal(retryUploads, 0); const retryGate = deferred(); const retryLock = { current: false }; let overlapSuccess = 0, overlapError = 0; const overlapLifecycle = routeLifecycle('R'); const overlapFirst = retryVersionRefresh({ lock: retryLock, lifecycle: overlapLifecycle, refreshDetail: () => retryGate.promise, refreshHistory: async () => {}, onSuccess: () => overlapSuccess++, onError: () => overlapError++ }); assert.equal(retryLock.current, true); assert.equal(await retryVersionRefresh({ lock: retryLock, lifecycle: overlapLifecycle, refreshDetail: async () => {}, refreshHistory: async () => {}, onSuccess: () => overlapSuccess++, onError: () => overlapError++ }), false); retryGate.resolve(); assert.equal(await overlapFirst, true); assert.deepEqual([overlapSuccess, overlapError, retryLock.current], [1, 0, false]); const retryFailureLock = { current: false }; assert.equal(await retryVersionRefresh({ lock: retryFailureLock, lifecycle: overlapLifecycle, refreshDetail: async () => { throw new Error('x'); }, refreshHistory: async () => {}, onSuccess: () => overlapSuccess++, onError: () => overlapError++ }), false); assert.equal(retryFailureLock.current, false); assert.equal(overlapError, 1);
let exactErrors = 0, exactReject; const exactGate = new Promise((_, reject) => { exactReject = reject; }); currentRoute = 'A'; const exactLifecycle = routeLifecycle('A', archiveId => archiveId === currentRoute); const exactPending = runExactVersionDownload({ lifecycle: exactLifecycle, currentArchiveId: () => currentRoute, displayedArchiveId: () => 'A', download: () => exactGate, archiveId: 'A', version: { file_id: 1, display_filename: 'x.pdf' }, onError: () => exactErrors++, formatError: async () => ({ message: 'x' }) }); currentRoute = 'B'; exactReject(new Error('x')); assert.equal(await exactPending, false); assert.equal(exactErrors, 0);
for (const [input, view] of [[{ initialLoading: true, pageLoading: false, error: '', rows: [] }, 'loading'], [{ initialLoading: false, pageLoading: true, error: '', rows: [{}] }, 'page-loading'], [{ initialLoading: false, pageLoading: false, error: 'x', rows: [] }, 'error'], [{ initialLoading: false, pageLoading: false, error: '', rows: [] }, 'empty'], [{ initialLoading: false, pageLoading: false, error: '', rows: [{}] }, 'rows']]) assert.equal(versionHistoryView(input), view);
console.log('version-behavior-ok lock=exclusive release=success+failure lifecycle=guarded sequence=latest+invalidate+fresh partial=warning retry=refresh-only history=all-states');
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
        $this->assertStringContainsString('version-behavior-ok', $stdout);

        $api = file_get_contents(base_path('resources/js/libs/arsip_api.js'));
        $detail = file_get_contents(base_path('resources/js/features/arsip-digital/admin/AdminInstitutionalArchiveDetail.jsx'));
        $this->assertStringNotContainsString('deleteInstitutionalArchiveVersion', $api);
        $this->assertStringNotContainsString('deleteInstitutionalArchiveVersion', $detail);
    }

    public function test_phase_five_helpers_and_wiring_are_executable_and_safe(): void
    {
        $helper = base_path('resources/js/features/arsip-digital/admin/institutionalArchiveUi.js');
        $script = <<<'JS'
import assert from 'node:assert/strict';
const { compactQuery, requestSequence, restoreDialogController, routeLifecycle, runArchiveDelete, runLifecycleAction, safeTimelineItem, timelineRequest, timelineRequestController, timelineView, trashRequest } = await import(process.argv[1]);
assert.deepEqual(timelineRequest(2, 25), { page: 2, per_page: 25 });
assert.deepEqual(compactQuery({ empty: '', absent: undefined, nil: null, zero: 0, text: 'x' }), { zero: 0, text: 'x' });
assert.deepEqual(trashRequest(1, 25, { search: '', unit_id: '', document_year: '', sort: 'deleted_at', direction: 'desc' }), { page: 1, per_page: 25 });
assert.deepEqual(trashRequest(3, 50, { search: 'surat', unit_id: 0, document_year: 2026, sort: 'title', direction: 'asc' }), { page: 3, per_page: 50, search: 'surat', unit_id: 0, document_year: 2026, sort: 'title', direction: 'asc' });
assert.deepEqual(trashRequest(1, 10, { search: '', unit_id: '', document_year: '', sort: 'deleted_at', direction: 'desc' }), { page: 1, per_page: 10 });
for (const [input, expected] of [[{initialLoading:true,pageLoading:false,error:'',rows:[]},'loading'],[{initialLoading:false,pageLoading:true,error:'',rows:[{}]},'page-loading'],[{initialLoading:false,pageLoading:false,error:'x',rows:[]},'error'],[{initialLoading:false,pageLoading:false,error:'',rows:[]},'empty'],[{initialLoading:false,pageLoading:false,error:'',rows:[{}]},'rows']]) assert.equal(timelineView(input), expected);
assert.deepEqual(safeTimelineItem({ audit_log_id: 1, label: ['bad'], actor_user_id: '1', actor_display_name: '  ', occurred_at: 7, reason: { secret: true }, changed_fields: ['title', 9] }), { audit_log_id: 1, label: 'Aktivitas arsip', actor_display_name: null, occurred_at: null, reason: null, changed_fields: ['title'] });
assert.equal(safeTimelineItem({ actor_display_name: ' Admin Test ' }).actor_display_name, 'Admin Test');
let calls=0, refreshed=0, navigated=0, error=''; const lock={current:false}; const gate={}; gate.promise=new Promise(resolve=>gate.resolve=resolve);
const first=runLifecycleAction({lock,action:async()=>{calls++;await gate.promise;},refresh:async()=>refreshed++,navigate:()=>navigated++,onError:value=>error=value,formatError:async()=>({message:'safe'})});
assert.equal(lock.current,true); assert.equal(await runLifecycleAction({lock,action:async()=>calls++,onError:()=>{},formatError:async()=>({message:'x'})}),false); gate.resolve(); assert.equal(await first,true); assert.deepEqual([calls,refreshed,navigated,lock.current,error],[1,1,1,false,'']);
assert.equal(await runLifecycleAction({lock,action:async()=>{throw new Error('secret');},onError:value=>error=value,formatError:async()=>({message:'Konflik nomor.'})}),false); assert.equal(error,'Konflik nomor.'); assert.equal(lock.current,false);
navigated=0; let deleteCalls=0; const deleteLock={current:false}; const deleteLifecycle=routeLifecycle('A'); const deleteOptions={lock:deleteLock,lifecycle:deleteLifecycle,reason:' hapus ',archiveId:'A',currentArchiveId:'A',displayedArchiveId:'A',action:async()=>deleteCalls++,navigate:()=>navigated++,onError:value=>error=value,formatError:async()=>({message:'Delete gagal.'})};
assert.equal(await runArchiveDelete({...deleteOptions,reason:'   '}),false); assert.equal(deleteCalls,0); assert.equal(await runArchiveDelete({...deleteOptions,currentArchiveId:'B'}),false); assert.equal(await runArchiveDelete({...deleteOptions,displayedArchiveId:'B'}),false); assert.equal(deleteCalls,0);
const deleteGate={}; deleteGate.promise=new Promise(resolve=>deleteGate.resolve=resolve); const pendingDelete=runArchiveDelete({...deleteOptions,action:async()=>{deleteCalls++;await deleteGate.promise;}}); const duplicateDelete=runArchiveDelete(deleteOptions); assert.equal(await duplicateDelete,false); assert.equal(deleteCalls,1); deleteGate.resolve(); assert.equal(await pendingDelete,true); assert.equal(navigated,1); assert.equal(deleteLock.current,false);
error=''; assert.equal(await runArchiveDelete({...deleteOptions,action:async()=>{throw new Error('secret');}}),false); assert.equal(error,'Delete gagal.'); assert.equal(deleteLock.current,false);
const staleGate={}; staleGate.promise=new Promise((_,reject)=>staleGate.reject=reject); let staleNavigate=0, staleError=0, staleFormat=0; const staleLifecycle=routeLifecycle('A'); const staleDelete=runArchiveDelete({...deleteOptions,lifecycle:staleLifecycle,action:()=>staleGate.promise,navigate:()=>staleNavigate++,onError:()=>staleError++,formatError:async()=>{staleFormat++;return {message:'x'};}}); staleLifecycle.invalidate(); staleGate.reject(new Error('secret')); assert.equal(await staleDelete,false); assert.deepEqual([staleNavigate,staleError,staleFormat,deleteLock.current],[0,0,0,false]);
const restoreLifecycle=routeLifecycle('trash'); const dialogs=restoreDialogController(restoreLifecycle); dialogs.select(1); const restoreA=dialogs.capture(1); const restoreLock={current:false}; const restoreGate={}; restoreGate.promise=new Promise(resolve=>restoreGate.resolve=resolve); let restoreActions=0,restoreRefresh=0,restoreClose=0,restoreError=0; const pendingRestore=runLifecycleAction({lock:restoreLock,lifecycle:restoreA,action:async()=>{restoreActions++;await restoreGate.promise;},refresh:async()=>restoreRefresh++,navigate:()=>restoreClose++,onError:()=>restoreError++,formatError:async()=>({message:'restore'})}); assert.equal(restoreLock.current,true); assert.equal(await runLifecycleAction({lock:restoreLock,lifecycle:restoreA,action:async()=>restoreActions++,onError:()=>{},formatError:async()=>({message:'x'})}),false); assert.equal(restoreActions,1); if(!restoreLock.current){dialogs.close();restoreClose++;} assert.equal(restoreA.valid(),true); dialogs.select(2); assert.equal(restoreA.valid(),false); restoreGate.resolve(); assert.equal(await pendingRestore,false); assert.deepEqual([restoreRefresh,restoreClose,restoreError,restoreLock.current],[0,0,0,false]);
const restoreB=dialogs.capture(2); assert.equal(restoreB.valid(),true); assert.equal(await runLifecycleAction({lock:restoreLock,lifecycle:restoreB,action:async()=>{},refresh:async()=>restoreRefresh++,navigate:()=>restoreClose++,onError:()=>restoreError++,formatError:async()=>({message:'x'})}),true); assert.deepEqual([restoreRefresh,restoreClose,restoreLock.current],[1,1,false]); assert.equal(await runLifecycleAction({lock:restoreLock,lifecycle:restoreB,action:async()=>{throw new Error('x');},onError:()=>restoreError++,formatError:async()=>({message:'safe'})}),false); assert.equal(restoreError,1); assert.equal(restoreLock.current,false); restoreLifecycle.invalidate(); assert.equal(restoreB.valid(),false);
const sequence=requestSequence(); const old=sequence.next(); const latest=sequence.next(); assert.equal(sequence.valid(old),false); assert.equal(sequence.valid(latest),true); sequence.invalidate(); assert.equal(sequence.valid(latest),false);
const controller=timelineRequestController(); controller.select('A'); const delayedA=controller.capture('A'); controller.select('B'); const delayedB=controller.capture('B'); assert.equal(delayedB.valid(),true); assert.equal(delayedA.valid(),false); let displayed=''; if(delayedB.valid()) displayed='B rows'; assert.equal(displayed,'B rows'); if(delayedA.valid()) displayed='A rows'; assert.equal(displayed,'B rows'); let timelineError=''; if(delayedA.valid()) timelineError='A failed'; assert.equal(timelineError,''); const page1=controller.capture('B'); const page2=controller.capture('B'); assert.equal(page1.valid(),false); assert.equal(page2.valid(),true); controller.close(); assert.equal(page2.valid(),false);
const oldLifecycle=routeLifecycle('old'); const oldTimeline=requestSequence(); const oldTimelineToken=oldTimeline.next(); oldLifecycle.invalidate(); oldTimeline.invalidate(); assert.equal(oldLifecycle.valid()&&oldTimeline.valid(oldTimelineToken),false); const currentLifecycle=routeLifecycle('current'); const currentTimeline=requestSequence(); const retryToken=currentTimeline.next(); const retryValid=()=>currentLifecycle.valid()&&currentTimeline.valid(retryToken); assert.equal(retryValid(),true); const supersedingToken=currentTimeline.next(); assert.equal(retryValid(),false); assert.equal(currentLifecycle.valid()&&currentTimeline.valid(supersedingToken),true);
console.log('phase5-behavior-ok');
JS;
        $command = ['node', '--input-type=module', '--eval', $script, 'file://'.$helper];
        $pipes = [];
        $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, base_path());
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $this->assertSame(0, proc_close($process), $stderr);
        $this->assertStringContainsString('phase5-behavior-ok', $stdout);
        $routes = file_get_contents(base_path('resources/js/features/arsip-digital/routes.jsx'));
        $this->assertLessThan(strpos($routes, '/home/arsip-lembaga/:id'), strpos($routes, '/home/arsip-lembaga/sampah'));
        $api = file_get_contents(base_path('resources/js/libs/arsip_api.js'));
        $this->assertStringContainsString('institutionalArchiveTrash', $api);
        $this->assertStringNotContainsString('hardDeleteInstitutionalArchive', $api);
        $trash = file_get_contents(base_path('resources/js/features/arsip-digital/admin/AdminInstitutionalArchiveTrash.jsx'));
        foreach (['unit_id', 'document_year', 'sort', 'direction', 'pageSize', 'runLifecycleAction', 'timelineRequests.current.close()', 'trashRequest(nextPage, nextSize, nextFilters)'] as $value) {
            $this->assertStringContainsString($value, $trash);
        } $this->assertStringNotContainsString('Hapus permanen', $trash);
        $detail = file_get_contents(base_path('resources/js/features/arsip-digital/admin/AdminInstitutionalArchiveDetail.jsx'));
        foreach (['timelineView', 'timelineRequests', 'safeTimelineItem', 'Pagination page={timelinePage}', 'timelineRequests.current.invalidate()', 'const lifecycle = lifecycleRef.current; const archiveId = id; const requests = retryRequests.current', 'requests.valid(sequence)'] as $value) {
            $this->assertStringContainsString($value, $detail);
        }
        foreach (['const [restoring, setRestoring] = useState(false)', 'disabled={restoring}', 'if (restoreLock.current) return', 'restoreDialogs.current.capture(row.institutional_archive_id)'] as $value) {
            $this->assertStringContainsString($value, $trash);
        }
    }

    public function test_phase_six_distribution_helpers_and_wiring_execute(): void
    {
        $helper = base_path('resources/js/features/arsip-digital/admin/institutionalArchiveUi.js');
        $script = <<<'JS'
import assert from 'node:assert/strict';
const { distributionActionPolicy, distributionCountLabel, distributionEffectiveStatus, distributionExpiry, distributionListRequest, distributionPanelController, distributionPayload, distributionPreviewConfirmed, distributionPreviewSamples, distributionRecipientStatus, distributionTargetChange, distributionTargetFingerprint, exactDistributionSource, fetchDistributionPanelData, loadControlledPage, recipientPageRequest, recipientPreviewEndpoint, recipientStatus, requestSequence, recipientStatusView, routeLifecycle, runAuthoritativePublish, runControlledPageRefresh, runDistributionMutation, runRecipientAction, userDistributionController } = await import(process.argv[1]);
const targets={target_role:'mahasiswa',scope_type:'specific',target_identifiers:['22010001']};
assert.equal(distributionExpiry('2026-08-03T12:00:00+02:00'),'2026-08-03T10:00:00.000Z'); assert.equal(distributionExpiry(''),null);
assert.deepEqual(distributionPayload({title:' Kirim ',description:'',expires_at:''},targets),{...targets,title:'Kirim',description:null,expires_at:null});
const targetFingerprint=distributionTargetFingerprint(targets);
assert.equal(distributionPreviewConfirmed({total_valid:101,total_invalid:0},targets,targetFingerprint),true);
assert.equal(distributionPreviewConfirmed({total_valid:1,total_invalid:1},targets,targetFingerprint),false);
assert.equal(distributionPreviewConfirmed({total_valid:1,total_invalid:0},targets,'changed'),false);
assert.deepEqual(distributionPreviewSamples({total_valid:999,total_invalid:1,valid_targets:Array.from({length:10},(_,i)=>({identifier:i})),invalid_targets:[]}),{rows:Array.from({length:10},(_,i)=>({identifier:i})),remaining:990});
const mixedSamples=distributionPreviewSamples({total_valid:8,total_invalid:4,valid_targets:Array.from({length:8},(_,i)=>({identifier:i})),invalid_targets:Array.from({length:4},(_,i)=>({identifier:`bad-${i}`}))}); assert.equal(mixedSamples.rows.length,10); assert.equal(mixedSamples.remaining,2); assert.equal(mixedSamples.rows[9].identifier,'bad-1');
const confirmedPreview={total_valid:1,total_invalid:0}; assert.deepEqual(distributionTargetChange(targets,structuredClone(targets),confirmedPreview,targetFingerprint),{targets,preview:confirmedPreview,previewFingerprint:targetFingerprint}); assert.deepEqual(distributionTargetChange(targets,{...targets,target_identifiers:['changed']},confirmedPreview,targetFingerprint).preview,null);
assert.equal(distributionTargetFingerprint({...targets,target_identifiers:['2','1']}),distributionTargetFingerprint({...targets,target_identifiers:['1','2']}));
assert.notEqual(distributionTargetFingerprint({...targets,target_filters:{status:['aktif']}}),distributionTargetFingerprint({...targets,target_filters:{status:['lulus']}}));
assert.notEqual(distributionTargetFingerprint({...targets,target_segment_ids:[1]}),distributionTargetFingerprint({...targets,target_segment_ids:[2]}));
assert.deepEqual(distributionActionPolicy(false),{create:false,previewTargets:false,publish:false,list:true,recipients:true,withdraw:true}); assert.equal(distributionEffectiveStatus({status:'published',effective_status:'expired'}),'expired'); assert.deepEqual(distributionActionPolicy(true),{create:true,previewTargets:true,publish:true,list:true,recipients:true,withdraw:true}); assert.equal(distributionCountLabel({status:'draft',target_count:3,recipients_count:0}),'Target draft: 3'); assert.equal(distributionCountLabel({status:'draft',target_count:null,recipients_count:0}),'Target draft tersimpan'); assert.equal(distributionCountLabel({status:'published',target_count:3,recipients_count:2}),'Penerima: 2'); assert.equal(distributionCountLabel({status:'closed',target_count:3,recipients_count:2}),'Penerima: 2'); assert.equal(recipientPreviewEndpoint(42),'/distribution-recipients/42/preview'); assert.deepEqual(recipientPageRequest(3),{page:3,per_page:25}); assert.deepEqual(recipientPageRequest(-2,999),{page:1,per_page:100}); assert.deepEqual(distributionListRequest(2,5),{page:2,per_page:10}); assert.equal(recipientStatus({delivery_status:'available',download_count:0}),'available'); assert.equal(recipientStatus({delivery_status:'available',download_count:2}),'downloaded'); assert.equal(recipientStatus({delivery_status:'available',download_count:2,availability_status:'expired'}),'expired'); assert.equal(recipientStatus({delivery_status:'revoked',download_count:2}),'withdrawn'); assert.equal(recipientStatus({status:'closed',download_count:2}),'withdrawn'); assert.equal(recipientStatus({status:'withdrawn',download_count:2}),'withdrawn'); assert.equal(recipientStatus({deleted_at:'x',delivery_status:'revoked',download_count:2}),'deleted');
const source={source_file_id:7,source_file:{file_id:7,version_number:3,display_filename:'exact.pdf',storage_path:'secret'}}; assert.deepEqual(exactDistributionSource(source),{source_file_id:7,version_number:3,filename:'exact.pdf'}); assert.equal(exactDistributionSource({source_file_id:7}),null); assert.equal(exactDistributionSource({...source,source_file:{...source.source_file,file_id:8}}),null); assert.deepEqual(recipientStatusView({delivery_status:'available',download_count:2}),{status:'downloaded',color:'success'}); assert.deepEqual(recipientStatusView({availability_status:'expired',download_count:2}),{status:'expired',color:'default'}); assert.equal(distributionRecipientStatus({availability_status:'expired',download_count:2},{status:'published'}),'expired'); assert.equal(distributionRecipientStatus({availability_status:'available',download_count:2},{status:'closed'}),'withdrawn'); assert.equal(distributionRecipientStatus({availability_status:'available',download_count:2},{status:'withdrawn'}),'withdrawn');
let controlledParams; const controlledCapture={valid:()=>true}; assert.deepEqual(await loadControlledPage({capture:controlledCapture,page:3,perPage:25,requestParams:recipientPageRequest,rowsKey:'recipients',request:async params=>{controlledParams=params;return{recipients:[{recipient_id:1}],meta:{current_page:3,last_page:4,total:76}}}}),{rows:[{recipient_id:1}],meta:{current_page:3,last_page:4,total:76}}); assert.deepEqual(controlledParams,{page:3,per_page:25}); assert.equal(await loadControlledPage({capture:{valid:()=>false},page:1,perPage:10,requestParams:distributionListRequest,rowsKey:'distributions',request:async()=>({distributions:[{distribution_id:1}]})}),null); let pageError='',formatCalls=0; const pageCapture={valid:()=>true}; assert.equal(await runControlledPageRefresh({capture:pageCapture,refresh:async()=>{throw new Error('private')},onError:value=>pageError=value,formatError:async()=>{formatCalls++;return{message:'Halaman gagal dimuat.'}}}),null); assert.deepEqual([pageError,formatCalls],['Halaman gagal dimuat.',1]); let stalePageError=0,staleFormat=0,activePage=true; const stalePageCapture={valid:()=>activePage}; assert.equal(await runControlledPageRefresh({capture:stalePageCapture,refresh:async()=>{activePage=false;throw new Error('private')},onError:()=>stalePageError++,formatError:async()=>{staleFormat++;return{message:'x'}}}),null); assert.deepEqual([stalePageError,staleFormat],[0,0]);
const lifecycle=routeLifecycle('A'); const sequence=requestSequence(); const stale=sequence.next(); const current=sequence.next(); assert.equal(sequence.valid(stale),false); assert.equal(sequence.valid(current),true); lifecycle.invalidate(); assert.equal(lifecycle.valid(),false);
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject}}; let currentArchive='A'; const controller=distributionPanelController(id=>id===currentArchive); controller.select('A');
const kinds=['list','preview','recipients']; const staleWrites=[]; for(const kind of kinds){const gate=deferred();const capture=controller.capture(kind);const pending=fetchDistributionPanelData(capture,()=>gate.promise);currentArchive='B';controller.select('B');gate.resolve(`${kind}-A`);staleWrites.push(await pending);currentArchive='A';controller.select('A');} assert.deepEqual(staleWrites,[null,null,null]);
currentArchive='A';controller.select('A');const actionGate=deferred();const actionA=controller.beginAction();assert.ok(actionA);assert.equal(controller.beginAction(),null);assert.equal(controller.busy(),true);currentArchive='B';controller.select('B');actionGate.resolve();await actionGate.promise;assert.equal(actionA.valid(),false);assert.equal(controller.release(actionA),false);assert.equal(controller.busy(),false);
const rejected=deferred();currentArchive='A';controller.select('A');const errorCapture=controller.capture('preview');const errorPending=fetchDistributionPanelData(errorCapture,()=>rejected.promise).catch(()=>errorCapture.valid()?'mutated':null);currentArchive='B';controller.select('B');rejected.reject(new Error('A'));assert.equal(await errorPending,null);
const fresh=controller.capture('list');assert.equal((await fetchDistributionPanelData(fresh,async()=>['B']))[0],'B'); let publishedPayload=null, confirmedSource=null, publishRefresh=0, staleNotice=0, publishError=''; const publishCapture=controller.beginAction(); assert.equal(await runAuthoritativePublish({capture:publishCapture,distributionId:4,fetchDistribution:async()=>source,fetchTargets:async()=>({updated_at:'2026-08-04T00:00:00.000000Z',target_fingerprint:'fingerprint'}),confirm:value=>{confirmedSource=value;return true},publish:async(id,payload)=>{assert.equal(id,4);publishedPayload=payload},refresh:async()=>publishRefresh++,onStale:()=>staleNotice++,onError:value=>publishError=value,formatError:async()=>({message:'safe'})}),true); assert.deepEqual(confirmedSource,{source_file_id:7,version_number:3,filename:'exact.pdf'}); assert.deepEqual(publishedPayload,{source_file_id:7,expected_updated_at:'2026-08-04T00:00:00.000000Z',target_fingerprint:'fingerprint'}); assert.equal(publishRefresh,1); controller.release(publishCapture); const cancelCapture=controller.beginAction(); let cancelledPublish=0; assert.equal(await runAuthoritativePublish({capture:cancelCapture,distributionId:4,fetchDistribution:async()=>source,fetchTargets:async()=>({updated_at:'2026-08-04T00:00:00.000000Z',target_fingerprint:'fingerprint'}),confirm:async()=>{await Promise.resolve();return false},publish:async()=>cancelledPublish++,refresh:async()=>{},onStale:()=>{},onError:()=>{},formatError:async()=>({message:'x'})}),false); assert.equal(cancelledPublish,0); controller.release(cancelCapture); const stalePublishCapture=controller.beginAction(); await assert.rejects(()=>runAuthoritativePublish({capture:stalePublishCapture,distributionId:4,fetchDistribution:async()=>source,fetchTargets:async()=>({updated_at:'2026-08-04T00:00:00.000000Z',target_fingerprint:'fingerprint'}),confirm:()=>true,publish:async()=>{throw {response:{status:409}}},refresh:async()=>publishRefresh++,onStale:()=>staleNotice++,onError:value=>publishError=value,formatError:async()=>({message:'should-not-leak'})})); assert.deepEqual([publishRefresh,staleNotice,publishError],[2,1,'']); controller.release(stalePublishCapture); const previewGate=deferred();const previewCapture=controller.capture('preview');const previewFingerprint=distributionTargetFingerprint(targets);const pendingPreview=fetchDistributionPanelData(previewCapture,()=>previewGate.promise);const changedTargets={...targets,target_filters:{status:['aktif']}};controller.capture('preview');previewGate.resolve({total_valid:1,total_invalid:0});assert.equal(await pendingPreview,null);assert.equal(distributionPreviewConfirmed(null,changedTargets,previewFingerprint),false);let creates=0;const createNow=()=>{if(!distributionPreviewConfirmed({total_valid:1,total_invalid:0},changedTargets,previewFingerprint))return false;creates++;return true};assert.equal(createNow(),false);assert.equal(creates,0);const freshAction=controller.beginAction();assert.ok(freshAction);assert.equal(controller.release(freshAction),true);assert.equal(controller.busy(),false);controller.close();assert.equal(fresh.valid(),false);assert.equal(controller.beginAction(),null);
let mutationSuccess=0,mutationRefresh=0,mutationPartial=0,mutationError=0; const mutationCapture={valid:()=>true}; assert.equal(await runDistributionMutation({capture:mutationCapture,mutate:async()=>false,refresh:async()=>mutationRefresh++,onSuccess:()=>mutationSuccess++,onPartial:()=>mutationPartial++,onError:()=>mutationError++,formatError:async()=>({message:'safe'})}),false); assert.deepEqual([mutationSuccess,mutationRefresh,mutationPartial,mutationError],[0,0,0,0]); assert.equal(await runDistributionMutation({capture:mutationCapture,mutate:async()=>({ok:true}),refresh:async()=>mutationRefresh++,onSuccess:()=>mutationSuccess++,onPartial:()=>mutationPartial++,onError:()=>mutationError++,formatError:async()=>({message:'safe'})}),true); assert.deepEqual([mutationSuccess,mutationRefresh,mutationPartial],[1,1,0]); assert.equal(await runDistributionMutation({capture:mutationCapture,mutate:async()=>({ok:true}),refresh:async()=>{throw new Error('refresh')},onSuccess:()=>mutationSuccess++,onPartial:()=>mutationPartial++,onError:()=>mutationError++,formatError:async()=>({message:'safe'})}),true); assert.deepEqual([mutationSuccess,mutationRefresh,mutationPartial,mutationError],[2,1,1,0]);
const userController=userDistributionController(); const userAction=userController.begin(); let userToast=0,userRefresh=0,userError=0; const userGate=deferred(); const pendingUser=runRecipientAction({capture:userAction,action:()=>userGate.promise,refresh:async()=>userRefresh++,onSuccess:()=>userToast++,onError:()=>userError++,formatError:async()=>({message:'safe'})}); assert.equal(userController.begin(),null); userController.close(); userGate.resolve(); assert.equal(await pendingUser,false); assert.deepEqual([userToast,userRefresh,userError,userController.release(userAction)],[0,0,0,false]); const freshUserController=userDistributionController(); const freshUser=freshUserController.begin(); assert.equal(await runRecipientAction({capture:freshUser,action:async()=>{},refresh:async()=>{const listCapture=freshUserController.capture();assert.equal(listCapture.valid(),true);userRefresh++},onSuccess:()=>userToast++,onError:()=>userError++,formatError:async()=>({message:'safe'})}),true); assert.deepEqual([userToast,userRefresh,freshUser.valid()],[1,1,true]); assert.equal(freshUserController.release(freshUser),true); const failedController=userDistributionController(); const failedAction=failedController.begin(); assert.equal(await runRecipientAction({capture:failedAction,action:async()=>{throw {response:{status:410}}},onError:async(error,formatted)=>{assert.equal(error.response.status,410);assert.equal(formatted.message,'safe');const listCapture=failedController.capture();assert.equal(listCapture.valid(),true);userRefresh++;assert.equal(failedAction.valid(),true);userError++},formatError:async()=>({message:'safe'})}),false); assert.deepEqual([userRefresh,userError,failedAction.valid()],[2,1,true]); assert.equal(failedController.release(failedAction),true);
console.log('phase6-behavior-ok stale=list+preview+recipients+action+error fresh=B duplicate=blocked unmount=safe');
JS;
        $process = proc_open(['node', '--input-type=module', '--eval', $script, 'file://'.$helper], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, base_path());
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $this->assertSame(0, proc_close($process), $stderr);
        $this->assertStringContainsString('phase6-behavior-ok', $stdout);
        $api = file_get_contents(base_path('resources/js/libs/arsip_api.js'));
        foreach (['previewInstitutionalDistributionTargets', 'createInstitutionalDistribution', 'institutionalDistributionTargets', 'updateInstitutionalDistribution', 'cancelInstitutionalDistribution', 'publishInstitutionalDistribution', 'withdrawInstitutionalDistribution', 'institutionalDistributionRecipients'] as $method) {
            $this->assertStringContainsString($method, $api);
        }
        $panel = file_get_contents(base_path('resources/js/features/arsip-digital/admin/InstitutionalDistributionPanel.jsx'));
        foreach (['TargetPicker', 'confirmAction', 'fetchTargets:', 'expected_updated_at', 'current_page', 'last_page', 'distributionPanelController', 'currentArchiveId', 'Lihat target', 'Edit draft', 'Batalkan draft', 'Lihat penerima', 'capture(`edit:${id}`)', "capture('viewer')", 'Tambah/hapus target', 'Preview target draft', 'Kriteria segment aktif', 'target_segment_ids', "status === 'published' && active", 'refresh(capture, page)', 'Unduhan pertama', 'Unduhan terakhir', 'Total unduhan', "new Intl.DateTimeFormat('id-ID'"] as $contract) {
            $this->assertStringContainsString($contract, $panel);
        }
        $this->assertStringContainsString('const capture = controller.current.beginAction()', $panel);
        $this->assertStringContainsString('scope="col" key={x} className="p-2 text-left border-b"', $panel);
        $this->assertStringContainsString("viewer.type === 'targets' ? 'Target draft' : 'Penerima materialized'", $panel);
        $this->assertStringNotContainsString('window.confirm', $panel);
        $archives = file_get_contents(base_path('resources/js/features/arsip-digital/admin/AdminInstitutionalArchives.jsx'));
        $this->assertStringContainsString("import { bytes } from '../../../libs/format';", $archives);
        $this->assertStringContainsString('bytes(row.current_file?.file_size_bytes)', $archives);
    }

    public function test_phase_seven_storage_helpers_and_wiring_execute(): void
    {
        $helper = base_path('resources/js/features/arsip-digital/admin/institutionalArchiveUi.js');
        $script = <<<'JS'
import assert from 'node:assert/strict';
const { reconciliationProgress, runStorageSync, storageAvailability, storageDashboardController, storageDashboardView, storageFilesRequest, storageFileSort, storageSummaryState } = await import(process.argv[1]);
const { runPollingJobTick } = await import(process.argv[2]);
assert.deepEqual(storageSummaryState({total_bytes:'100',current_bytes:40,total_files:3,soft_deleted_bytes:10,soft_limit_bytes:200}),{total:100,current:40,versions:3,deleted:10,limit:200});
assert.deepEqual(storageSummaryState({}),{total:0,current:0,versions:0,deleted:0,limit:null});
assert.deepEqual(storageFilesRequest(2,25,{unit_id:7,category_id:'root',version:'historical',storage_availability:'missing',deleted:'only',sort:'created_at',direction:'asc'}),{page:2,per_page:25,storage_availability:'missing',unit_id:7,category_id:'root',version:'historical',deleted:'only',sort:'created_at',direction:'asc'});
assert.deepEqual(storageFileSort([{field:'storage_availability',sort:'asc'}]),{sort:'storage_availability',direction:'asc'}); assert.deepEqual(storageFileSort([]),{sort:'file_size_bytes',direction:'desc'});
assert.equal(storageAvailability('available'),'available'); assert.equal(storageAvailability('missing'),'missing'); assert.equal(storageAvailability('unknown'),'unknown'); assert.equal(storageAvailability('provider_error'),'unknown');
assert.deepEqual(reconciliationProgress({status:'running',checked_files:3,total_files:4}),{status:'running',percent:75}); for(const status of ['queued','running','completed','failed']) assert.equal(reconciliationProgress({status}).status,status);
for(const [input,view] of [[{loading:true,error:'',summary:null},'loading'],[{loading:false,error:'x',summary:null},'error'],[{loading:false,error:'',summary:null},'empty'],[{loading:false,error:'',summary:{}},'ready']]) assert.equal(storageDashboardView(input),view);
const controller=storageDashboardController(); const old=controller.capture('summary'); const latest=controller.capture('summary'); assert.equal(old.valid(),false); assert.equal(latest.valid(),true); const action=controller.beginSync(); assert.ok(action); assert.equal(controller.beginSync(),null); let resumed=null,error=''; assert.equal(await runStorageSync({capture:action,trigger:async()=>({data:{job:{job_id:9,status:'queued'}}}),onJob:value=>resumed=value,onError:value=>error=value,formatError:async()=>({message:'safe'})}),true); assert.equal(resumed.job_id,9); assert.equal(controller.release(action),true);
const conflict=controller.beginSync(); resumed=null; assert.equal(await runStorageSync({capture:conflict,trigger:async()=>{throw {response:{status:409,data:{data:{job:{job_id:10,status:'running'}}}}}},onJob:value=>resumed=value,onError:value=>error=value,formatError:async()=>({message:'must not leak'})}),true); assert.equal(resumed.job_id,10); controller.release(conflict);
const staleJob=controller.resume(10); const currentJob=controller.resume(11); assert.equal(staleJob.valid(),false); assert.equal(currentJob.valid(),true); controller.change(); assert.equal(currentJob.valid(),false); const staleAction=controller.beginSync(); let staleToast=0; controller.close(); assert.equal(await runStorageSync({capture:staleAction,trigger:async()=>{throw new Error('secret')},onJob:()=>staleToast++,onError:()=>staleToast++,formatError:async()=>{staleToast++;return{message:'x'}}}),false); assert.equal(staleToast,0); assert.equal(controller.release(staleAction),false);
const statuses=['queued','running','completed']; const busy={current:false}; let calls=0,updates=[],terminals=0,refreshes=0,stops=0,active=true; const pollFn=async id=>{calls++;assert.equal(id,21);return{job_id:id,status:statuses.shift()}}; const tick=()=>runPollingJobTick({active:()=>active,busy,pollFn,jobId:21,terminalStatuses:['completed','failed'],onUpdate:value=>updates.push(value.status),onTerminal:()=>{terminals++;refreshes++;},stop:()=>stops++}); assert.equal(await tick(),true); assert.equal(await tick(),true); assert.equal(await tick(),true); assert.deepEqual(updates,['queued','running','completed']); assert.deepEqual([calls,terminals,refreshes,stops],[3,1,1,1]);
let releaseOverlap; const overlapGate=new Promise(resolve=>releaseOverlap=resolve); calls=0; const overlapping=runPollingJobTick({active:()=>active,busy,pollFn:async()=>{calls++;await overlapGate;return{status:'running'}},jobId:21,terminalStatuses:['completed'],stop:()=>{}}); assert.equal(await runPollingJobTick({active:()=>active,busy,pollFn:async()=>{calls++;return{status:'running'}},jobId:21,terminalStatuses:['completed'],stop:()=>{}}),false); assert.equal(calls,1); releaseOverlap(); assert.equal(await overlapping,true);
let staleUpdates=0,resolveStale; active=true; const stalePending=runPollingJobTick({active:()=>active,busy,pollFn:()=>new Promise(resolve=>resolveStale=resolve),jobId:22,terminalStatuses:['completed'],onUpdate:()=>staleUpdates++,onTerminal:()=>staleUpdates++,stop:()=>staleUpdates++}); active=false; resolveStale({job_id:22,status:'completed'}); assert.equal(await stalePending,false); assert.equal(staleUpdates,0);
let generation=1,resolveOld,oldUpdates=0,newUpdates=0,newStops=0,newTerminals=0; const oldBusy={current:false},newBusy={current:false}; const oldPending=runPollingJobTick({active:()=>generation===1,busy:oldBusy,pollFn:()=>new Promise(resolve=>resolveOld=resolve),jobId:22,terminalStatuses:['completed'],onUpdate:()=>oldUpdates++,onTerminal:()=>oldUpdates++,stop:()=>oldUpdates++}); generation=2; assert.equal(await runPollingJobTick({active:()=>generation===2,busy:newBusy,pollFn:async()=>({job_id:23,status:'running'}),jobId:23,terminalStatuses:['completed'],onUpdate:value=>{assert.equal(value.job_id,23);newUpdates++;},onTerminal:()=>newTerminals++,stop:()=>newStops++}),true); resolveOld({job_id:22,status:'completed'}); assert.equal(await oldPending,false); assert.deepEqual([oldUpdates,newUpdates,newStops,newTerminals],[0,1,0,0]); assert.equal(await runPollingJobTick({active:()=>generation===2,busy:newBusy,pollFn:async()=>({job_id:23,status:'completed'}),jobId:23,terminalStatuses:['completed'],onUpdate:()=>newUpdates++,onTerminal:()=>newTerminals++,stop:()=>newStops++}),true); assert.deepEqual([newUpdates,newStops,newTerminals],[2,1,1]);
console.log('phase7-behavior-ok');
JS;
        $polling = base_path('resources/js/features/arsip-digital/hooks/usePollingJob.js');
        $process = proc_open(['node', '--input-type=module', '--eval', $script, 'file://'.$helper, 'file://'.$polling], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, base_path());
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $this->assertSame(0, proc_close($process), $stderr);
        $this->assertStringContainsString('phase7-behavior-ok', $stdout);
        $api = file_get_contents(base_path('resources/js/libs/arsip_api.js'));
        foreach (['institutionalStorageSummary', 'institutionalStorageFiles', 'triggerInstitutionalStorageReconciliation', 'institutionalStorageReconciliationJob'] as $method) {
            $this->assertStringContainsString($method, $api);
        }
        $page = file_get_contents(base_path('resources/js/features/arsip-digital/admin/AdminInstitutionalStorage.jsx'));
        foreach (['CustomDataTable', 'paginationMode="server"', 'sortingMode="server"', 'usePollingJob', "['queued', 'running']", "['completed', 'failed']", 'reconciliation_stale', 'Bukan kapasitas provider', 'available', 'missing', 'unknown', "setSummaryError('')", "setFilesError('')", 'actionError || summaryError || filesError'] as $contract) {
            $this->assertStringContainsString($contract, $page);
        }
        foreach (['storage_path', 'requested_by_user_id', 'error_message', 'deleteInstitutionalStorage'] as $secret) {
            $this->assertStringNotContainsString($secret, $page);
        }
        $routes = file_get_contents(base_path('resources/js/features/arsip-digital/routes.jsx'));
        $this->assertLessThan(strpos($routes, '/home/arsip-lembaga/:id'), strpos($routes, '/home/arsip-lembaga/storage'));
    }

    public function test_versioning_detail_wires_production_helpers_api_routes_and_visible_contract(): void
    {
        $detail = file_get_contents(base_path('resources/js/features/arsip-digital/admin/AdminInstitutionalArchiveDetail.jsx'));
        $api = file_get_contents(base_path('resources/js/libs/arsip_api.js'));

        $this->assertStringContainsString('requestSequence, retryVersionRefresh, routeActionAllowed, routeLifecycle, runDownload, runExactVersionDownload, runPreview, runVersionUpload', $detail);
        $this->assertStringContainsString('arsipApi.institutionalArchiveVersions(archiveId, versionHistoryRequest(page))', $detail);
        $this->assertStringContainsString('setVersions(versionHistoryState(response.data.versions))', $detail);
        $this->assertStringContainsString('runVersionUpload({ busy: saving, lock: uploadLock, lifecycle, file: versionFile', $detail);
        $this->assertStringContainsString('arsipApi.uploadInstitutionalArchiveVersion(archiveId, data, progress)', $detail);
        $this->assertStringContainsString('refreshHistory: page => loadVersions(lifecycle, historyRequests.current, archiveId, page)', $detail);
        $this->assertStringContainsString('runExactVersionDownload({ lifecycle, currentArchiveId: () => currentRouteId.current', $detail);
        $this->assertStringContainsString('runDownload(() => arsipApi.downloadVerified(item)', $detail);
        $this->assertStringNotContainsString('downloadInstitutionalArchive(item)', $detail);

        $this->assertStringContainsString('type="file" inputRef={versionInput}', $detail);
        $this->assertStringContainsString("breadcrumbs={[{ label: 'Arsip Lembaga', href: '/home/arsip-lembaga' }, { label: 'Detail' }]}", $detail);
        $this->assertStringContainsString('startIcon={<ArrowBackOutlined />}>Kembali</Button>', $detail);
        $this->assertStringContainsString('Detail metadata, versi, aktivitas, dan distribusi arsip lembaga.', $detail);
        $this->assertStringNotContainsString('<PageHeader title={archive.title} subtitle="Detail Arsip Lembaga"', $detail);
        $this->assertStringNotContainsString('</Alert>}<Button component={Link} to="/home/arsip-lembaga">Kembali</Button>', $detail);
        $this->assertStringContainsString('required label="Alasan perubahan" value={reason}', $detail);
        $this->assertStringContainsString('<LinearProgress variant="determinate" value={versionProgress}', $detail);
        $this->assertStringContainsString('<Pagination page={versionPage} count={versionPages}', $detail);
        $this->assertStringContainsString('loadVersions(lifecycle, historyRequests.current, id, page).catch(() => {})', $detail);
        $this->assertStringContainsString('version.current_label ? ` (${version.current_label})`', $detail);
        foreach (['Uploader ID: {version.uploaded_by_user_id}', '{date(version.created_at)}', '{version.file_size_bytes} byte', 'Checksum: {version.checksum_sha256}', "Alasan: {version.version_reason || '-'}"] as $versionMetadata) {
            $this->assertStringContainsString($versionMetadata, $detail);
        }

        $this->assertStringContainsString('downloadVerified: (archive) => downloadBlob(`/admin/institutional-archives/${archive.institutional_archive_id}/download`', $api);
        $this->assertStringNotContainsString('downloadInstitutionalArchive: (archive)', $api);
        $this->assertStringContainsString('uploadInstitutionalArchiveVersion: (id, formData, onUploadProgress) => uploadFormData(`/admin/institutional-archives/${id}/versions`, formData, { onUploadProgress })', $api);
        $this->assertStringContainsString('institutionalArchiveVersions: (id, params) => getJson(`/admin/institutional-archives/${id}/versions`, params)', $api);
        $this->assertStringContainsString('downloadInstitutionalArchiveVersion: (archiveId, file) => downloadBlob(`/admin/institutional-archives/${archiveId}/versions/${file.file_id}/download`', $api);
        $this->assertStringNotContainsString('deleteInstitutionalArchiveVersion', $api);
        $this->assertStringNotContainsString('deleteInstitutionalArchiveVersion', $detail);
    }

    public function test_download_helper_rejects_html_and_uses_response_filename(): void
    {
        $http = file_get_contents(base_path('resources/js/libs/arsip_http.js'));
        $api = file_get_contents(base_path('resources/js/libs/arsip_api.js'));

        $this->assertStringContainsString("contentType.includes('text/html')", $http);
        $this->assertStringContainsString("JSON.parse(await blob.text()).message", $http);
        $this->assertStringContainsString("response.headers?.['content-disposition']", $http);
        $this->assertStringContainsString("link.download = headerFilename || filename", $http);
        $this->assertStringContainsString('const requestFileId = requestFile?.request_file_id;', $api);
        $this->assertStringNotContainsString('requestFile?.file_id', $api);
    }
}
