<?php

namespace Tests\Feature;

use Tests\TestCase;

class AuditNotesFrontendContractTest extends TestCase
{
    public function test_audit_notes_use_active_api_wrapper_and_required_contract(): void
    {
        $api = file_get_contents(base_path('resources/js/libs/arsip_api.js'));

        foreach ([
            "auditLogNote: (id) => getJson(`/admin/audit-logs/\${id}/note`)",
            "createAuditLogNote: (id, payload) => postJson(`/admin/audit-logs/\${id}/note`, payload)",
            "updateAuditLogNote: (id, payload) => putJson(`/admin/audit-logs/\${id}/note`, payload)",
        ] as $contract) {
            $this->assertStringContainsString($contract, $api);
        }

        $source = file_get_contents(base_path('resources/js/features/arsip-digital/admin/AdminAudit.jsx'));
        foreach ([
            "field: 'note'",
            "headerName: 'Notes'",
            'Tambah note',
            'openNotes(row)',
            'arsipApi.auditLogNote(id)',
            'arsipApi.createAuditLogNote(id, { note: value })',
            'arsipApi.updateAuditLogNote(id, { note: value, expected_updated_at: currentNote.updated_at })',
            'noteRequestRef.current',
            'noteActionRef.current',
            'formatted.status === 409',
            'Catatan sudah diubah admin lain.',
            'await Promise.all([loadNote(row), loadLogs()])',
            "`\${row.actor_role || '-'} #\${row.actor_user_id || '-'}`",
            'noteActor(row.note.creator_user_id, row.note.creator_name_snapshot)',
            'noteActor(currentNote.creator_user_id, currentNote.creator_name_snapshot)',
            'currentNote.last_editor_user_id != null || currentNote.last_editor_name_snapshot',
            'noteActor(currentNote.last_editor_user_id, currentNote.last_editor_name_snapshot)',
            'noteData.revisions.map',
            'revision.audit_log_note_revision_id',
            'Versi {revision.version}',
            'noteActor(revision.actor_user_id, revision.actor_name_snapshot)',
            'disabled={!noteLoaded || noteLoading || noteSubmitting || !noteText.trim() || Boolean(noteUnchanged)}',
        ] as $contract) {
            $this->assertStringContainsString($contract, $source);
        }

        foreach (['created_by_name', 'created_by_user_id', 'last_edited_by_name', 'last_edited_by_user_id', 'edited_by_name', 'edited_by_user_id', 'Admin #1', 'Admin #2'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $source);
        }
        $this->assertStringContainsString('function noteActor(id, name)', $source);
        $this->assertStringContainsString("const displayName = /^Admin\\s+#\\d+$/i.test(value) ? 'Admin' : value || 'Admin';", $source);
        $this->assertStringContainsString('return `Admin #${id ?? \'-\'} - ${displayName}`;', $source);
        $this->assertLessThan(strpos($source, "field: 'metadata'"), strpos($source, "field: 'note'"));
        $this->assertStringNotContainsString('disabled={!metadataOf(params.row)}', $source);
        $this->assertStringNotContainsString('deleteAuditLogNote', $api.$source);
    }
}
