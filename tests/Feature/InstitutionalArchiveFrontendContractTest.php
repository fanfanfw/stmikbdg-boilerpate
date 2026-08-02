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
const { uploadPercent, validationErrors, runDownload } = await import(process.argv[1]);
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
}
