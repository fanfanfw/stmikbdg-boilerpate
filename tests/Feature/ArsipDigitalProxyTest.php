<?php

namespace Tests\Feature;

use App\Http\Middleware\hasToken;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Session;
use Tests\TestCase;

class ArsipDigitalProxyTest extends TestCase
{
    public function test_proxy_forwards_token_and_active_role_headers(): void
    {
        config(['app.key' => 'base64:' . base64_encode(str_repeat('a', 32))]);
        config(['myconfig.api.base_url' => 'http://stmikbdg-api.test/api']);
        Session::put('token', 'jwt-smoke-token');
        Session::put('role', ['is_mhs' => true]);

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
}
