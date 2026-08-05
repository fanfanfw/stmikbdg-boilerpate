<?php

namespace Tests\Feature;

use App\Http\Middleware\hasToken;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Session;
use Tests\TestCase;

class ArsipDigitalProxyTest extends TestCase
{
    public function test_proxy_without_session_returns_json_401_instead_of_redirect_html(): void
    {
        $this->withoutMiddleware(hasToken::class)
            ->get('/arsip-digital/proxy/files/1/download')
            ->assertUnauthorized()
            ->assertHeader('content-type', 'application/json')
            ->assertExactJson(['status' => 'fail', 'message' => 'Unauthenticated.']);
    }

    public function test_proxy_preserves_backend_html_for_frontend_rejection(): void
    {
        $this->withProxySession(['is_mhs' => true]);
        Http::fake(fn () => Http::response('<html>login</html>', 401, ['content-type' => 'text/html']));

        $this->withoutMiddleware(hasToken::class)
            ->get('/arsip-digital/proxy/files/1/download')
            ->assertUnauthorized()
            ->assertHeader('content-type', 'text/html; charset=UTF-8')
            ->assertSee('<html>login</html>', false);
    }

    public function test_proxy_forwards_token_and_active_role_headers(): void
    {
        $this->withProxySession(['is_mhs' => true]);

        Http::fake(function ($request) {
            $this->assertSame('Bearer jwt-smoke-token', $request->header('Authorization')[0] ?? null);
            $this->assertSame('mahasiswa', $request->header('X-Active-Role')[0] ?? null);
            $this->assertSame('http://stmikbdg-api.test/api/arsip-digital/me/archive-summary', (string) $request->url());

            return Http::response([
                'status' => 'success',
                'data' => ['role' => 'mahasiswa'],
            ]);
        });

        $response = $this->withoutMiddleware(hasToken::class)
            ->get('/arsip-digital/proxy/me/archive-summary');

        $response->assertOk()
            ->assertJsonPath('data.role', 'mahasiswa');
    }

    public function test_proxy_forwards_multipart_upload(): void
    {
        $this->withProxySession(['is_mhs' => true]);

        Http::fake(function ($request) {
            $this->assertSame('POST', $request->method());
            $this->assertSame('Bearer jwt-smoke-token', $request->header('Authorization')[0] ?? null);
            $this->assertSame('mahasiswa', $request->header('X-Active-Role')[0] ?? null);
            $this->assertStringContainsString('multipart/form-data', $request->header('Content-Type')[0] ?? '');
            $this->assertStringContainsString('dokumen.pdf', $request->body());
            $this->assertStringContainsString('Dokumen test', $request->body());

            return Http::response([
                'status' => 'success',
                'data' => ['file' => ['file_id' => 10]],
            ], 201);
        });

        $response = $this->withoutMiddleware(hasToken::class)
            ->post('/arsip-digital/proxy/files', [
                'display_filename' => 'Dokumen test',
                'file' => UploadedFile::fake()->createWithContent('dokumen.pdf', '%PDF-1.4 proxy'),
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.file.file_id', 10);
    }

    public function test_proxy_forwards_multipart_zip_upload(): void
    {
        $this->withProxySession(['is_admin' => true]);

        Http::fake(function ($request) {
            $this->assertSame('POST', $request->method());
            $this->assertSame('admin', $request->header('X-Active-Role')[0] ?? null);
            $this->assertStringContainsString('multipart/form-data', $request->header('Content-Type')[0] ?? '');
            $this->assertStringContainsString('name="zip_file"', $request->body());
            $this->assertStringContainsString('bulk.zip', $request->body());
            $this->assertStringContainsString('name="dry_run"', $request->body());
            $this->assertStringContainsString('1', $request->body());

            return Http::response([
                'status' => 'success',
                'data' => ['job_id' => 11],
            ], 201);
        });

        $response = $this->withoutMiddleware(hasToken::class)
            ->post('/arsip-digital/proxy/admin/distributions/bulk-upload', [
                'dry_run' => '1',
                'zip_file' => UploadedFile::fake()->createWithContent('bulk.zip', 'PK proxy'),
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.job_id', 11);
    }

    public function test_proxy_preserves_binary_download_headers(): void
    {
        $this->withProxySession(['is_admin' => true]);

        Http::fake(fn () => Http::response('zip-binary', 200, [
            'content-type' => 'application/zip',
            'content-disposition' => 'attachment; filename="export.zip"',
        ]));

        $response = $this->withoutMiddleware(hasToken::class)
            ->get('/arsip-digital/proxy/admin/export-jobs/1/download');

        $response->assertOk();
        $this->assertSame('application/zip', $response->headers->get('content-type'));
        $this->assertSame('attachment; filename="export.zip"', $response->headers->get('content-disposition'));
        $this->assertSame('zip-binary', $response->streamedContent());
    }

    public function test_proxy_preserves_rate_limit_headers(): void
    {
        $this->withProxySession(['is_mhs' => true]);

        Http::fake(fn () => Http::response(['message' => 'Too Many Attempts.'], 429, [
            'Retry-After' => '7',
            'X-RateLimit-Limit' => '20',
            'X-RateLimit-Remaining' => '0',
        ]));

        $response = $this->withoutMiddleware(hasToken::class)
            ->get('/arsip-digital/proxy/sign-sessions/1');

        $response->assertStatus(429);
        $this->assertSame('7', $response->headers->get('Retry-After'));
        $this->assertSame('20', $response->headers->get('X-RateLimit-Limit'));
        $this->assertSame('0', $response->headers->get('X-RateLimit-Remaining'));
    }

    public function test_proxy_returns_backend_validation_errors_unchanged(): void
    {
        $this->withProxySession(['is_admin' => true]);

        Http::fake(fn () => Http::response([
            'status' => 'fail',
            'message' => 'The title field is required.',
            'errors' => ['title' => ['The title field is required.']],
        ], 422));

        $response = $this->withoutMiddleware(hasToken::class)
            ->postJson('/arsip-digital/proxy/admin/requests', []);

        $response->assertStatus(422)
            ->assertExactJson([
                'status' => 'fail',
                'message' => 'The title field is required.',
                'errors' => ['title' => ['The title field is required.']],
            ]);
    }

    public function test_proxy_returns_stable_response_when_api_connection_fails(): void
    {
        $this->withProxySession(['is_admin' => true]);
        Http::fake(fn () => throw new ConnectionException('Connection failed with token=secret'));
        Log::spy();

        $response = $this->withoutMiddleware(hasToken::class)
            ->get('/arsip-digital/proxy/admin/requests');

        $response->assertStatus(503)
            ->assertExactJson([
                'status' => 'fail',
                'message' => 'Koneksi API tidak tersedia.',
            ]);
        Log::shouldHaveReceived('error')->once();
    }

    private function withProxySession(array $role): void
    {
        config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32))]);
        config(['myconfig.api.base_url' => 'http://stmikbdg-api.test/api']);
        Session::put('token', 'jwt-smoke-token');
        Session::put('role', $role);
    }
}
