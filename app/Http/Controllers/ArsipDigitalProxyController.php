<?php

namespace App\Http\Controllers;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response as ClientResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Session;

class ArsipDigitalProxyController extends Controller
{
    public function handle(Request $request, ?string $path = '')
    {
        $token = Session::get('token');
        $activeRole = $this->activeRole();

        if (! $token) {
            return redirect()->route('logout');
        }

        if (! $activeRole) {
            return response()->json([
                'status' => 'fail',
                'message' => 'Role session arsip digital tidak valid.',
            ], 403);
        }

        $baseUrl = rtrim((string) config('myconfig.api.base_url'), '/');
        if ($baseUrl === '') {
            return response()->json([
                'status' => 'fail',
                'message' => 'API_BASE_URL belum dikonfigurasi.',
            ], 500);
        }

        $targetUrl = $baseUrl.'/arsip-digital/'.ltrim((string) $path, '/');

        $client = Http::withToken($token)
            ->withHeaders([
                'X-Active-Role' => $activeRole,
                'Accept' => $request->header('Accept', 'application/json'),
            ])
            ->connectTimeout(5)
            ->timeout(120);

        try {
            $response = $request->allFiles() !== []
                ? $this->sendMultipart($client, $request, $targetUrl)
                : $this->sendRegular($client, $request, $targetUrl);
        } catch (ConnectionException $exception) {
            Log::error('Koneksi API arsip digital tidak tersedia.', [
                'route' => optional($request->route())->getName(),
                'path' => $path,
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'status' => 'fail',
                'message' => 'Koneksi API tidak tersedia.',
            ], 503);
        }

        return $this->toLaravelResponse($response);
    }

    private function activeRole(): ?string
    {
        $role = Session::get('role');

        if (is_string($role)) {
            return match ($role) {
                'admin', 'mahasiswa', 'dosen' => $role,
                'is_admin' => 'admin',
                'is_mhs' => 'mahasiswa',
                'is_dosen' => 'dosen',
                default => null,
            };
        }

        if (is_array($role)) {
            if (($role['is_admin'] ?? false) === true) {
                return 'admin';
            }

            if (($role['is_mhs'] ?? false) === true) {
                return 'mahasiswa';
            }

            if (($role['is_dosen'] ?? false) === true) {
                return 'dosen';
            }
        }

        return null;
    }

    private function sendRegular($client, Request $request, string $targetUrl): ClientResponse
    {
        $method = strtolower($request->method());
        $options = [
            'query' => $request->query(),
        ];

        if (in_array($method, ['post', 'put', 'patch', 'delete'], true)) {
            $options['json'] = $request->except(array_keys($request->query()));
        }

        return $client->send($request->method(), $targetUrl, $options);
    }

    private function sendMultipart($client, Request $request, string $targetUrl): ClientResponse
    {
        return $client->send($request->method(), $targetUrl, [
            'query' => $request->query(),
            'multipart' => array_merge(
                $this->multipartFields($request),
                $this->multipartFiles($request)
            ),
        ]);
    }

    private function multipartFields(Request $request): array
    {
        $fields = [];

        foreach ($request->except(array_keys($request->allFiles())) as $key => $value) {
            if (is_array($value)) {
                foreach ($value as $index => $item) {
                    $fields[] = [
                        'name' => $key.'['.$index.']',
                        'contents' => (string) $item,
                    ];
                }

                continue;
            }

            if ($value !== null) {
                $fields[] = [
                    'name' => $key,
                    'contents' => (string) $value,
                ];
            }
        }

        return $fields;
    }

    private function multipartFiles(Request $request): array
    {
        $parts = [];

        foreach ($request->allFiles() as $field => $file) {
            if (is_array($file)) {
                foreach ($file as $index => $item) {
                    $parts[] = [
                        'name' => $field.'['.$index.']',
                        'contents' => fopen($item->getRealPath(), 'r'),
                        'filename' => $item->getClientOriginalName(),
                    ];
                }

                continue;
            }

            $parts[] = [
                'name' => $field,
                'contents' => fopen($file->getRealPath(), 'r'),
                'filename' => $file->getClientOriginalName(),
            ];
        }

        return $parts;
    }

    private function toLaravelResponse(ClientResponse $response)
    {
        $headers = collect($response->headers())
            ->only(['content-type', 'content-disposition', 'cache-control'])
            ->mapWithKeys(fn (array $value, string $key): array => [$key => $value[0] ?? ''])
            ->filter()
            ->toArray();

        $contentType = strtolower($headers['content-type'] ?? '');
        $contentDisposition = $headers['content-disposition'] ?? null;
        $isBinary = $contentDisposition || ($contentType !== '' && ! str_contains($contentType, 'json') && ! str_contains($contentType, 'text'));

        if ($isBinary) {
            return response()->stream(function () use ($response): void {
                echo $response->body();
            }, $response->status(), $headers);
        }

        return response($response->body(), $response->status(), $headers);
    }
}
