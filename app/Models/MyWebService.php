<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Facades\Session;

// * Guzzle
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ClientException;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\RequestOptions;

class MyWebService
{
    use HasFactory;

    protected $baseURL;
    protected $endPoints;
    protected $client;
    protected $fullURL;

    public function __construct(string $endPoints) {
        $this->baseURL = config('myconfig.api.base_url');
        $this->endPoints = $endPoints;
        $this->fullURL = $this->baseURL . $this->endPoints;
        $this->client = new Client();
    }

    private function setHeaders(string $accessToken = null) {
        return [
            'Content-Type' => 'application/json',
            'Authorization' => 'Bearer ' . $accessToken
        ];
    }

    private function setSuccessResponse($response) {
        $statusCode = $response->getStatusCode();
        $getBody = isset(json_decode($response->getBody())->data)
            ? json_decode($response->getBody())->data
            : null;
        $message = isset(json_decode($response->getBody())->message)
            ? json_decode($response->getBody())->message
            : null;

        return response()->json([
            'status' => 'success',
            'message' => $message,
            'data' => $getBody,
        ], $statusCode);
    }

    private function setBadResponse($response) {
        $decodedResponse = json_decode($response->getResponse()->getBody());
        $statusCode = $response->getResponse()->getStatusCode();
        $message = isset($decodedResponse->message) ? $decodedResponse->message : null;

        return response()->json([
            'status' => 'fail',
            'message' => $message,
        ], $statusCode);
    }

    public function get($payload = null, string $query = null) {
        $fullURL = $this->fullURL . ($query ? $query : '');

        if ($this->endPoints === 'authentications') {
            if ($query === '/check') {
                $accessToken = $payload['token'];
            }

            if (explode('?', $query)[0] === '/check/site') {
                $accessToken = Session::get('token');
            }

        } else {
            $accessToken = Session::get('token');
        }

        try {
            $response = $this->client->get(
                $fullURL,
                [
                    RequestOptions::HEADERS => $this->setHeaders($accessToken),
                    RequestOptions::JSON => $payload,
                ]
            );

            return $this->setSuccessResponse($response);
        } catch (ClientException $e) {
            return $this->setBadResponse($e);
        } catch (RequestException $e) {
            return $this->setBadResponse($e);
        }
    }

    public function post($payload, string $query = null) {
        $fullURL = $this->fullURL . ($query ? $query : '');
        $accessToken = Session::get('token');

        try {
            $response = $this->client->post($fullURL, [
                RequestOptions::HEADERS => $this->setHeaders($accessToken),
                RequestOptions::JSON => $payload,
            ]);

            return $this->setSuccessResponse($response, $this->endPoints);
        } catch (ClientException $e) {
            return $this->setBadResponse($e);
        } catch (RequestException $e) {
            return $this->setBadResponse($e);
        }
    }

    public function put($payload = null, string $query = null) {
        $fullURL = $this->fullURL . ($query ? $query : '');
        $accessToken = Session::get('token');

        try {
            $response = $this->client->put(
                $fullURL,
                [
                    RequestOptions::HEADERS => $this->setHeaders($accessToken),
                    RequestOptions::JSON => $payload,
                ]
            );

            return $this->setSuccessResponse($response);
        } catch (ClientException $e) {
            return $this->setBadResponse($e);
        } catch (RequestException $e) {
            return $this->setBadResponse($e);
        }
    }

    public function delete($payload = null, string $query = null) {
        $fullURL = $this->fullURL . ($query ? $query : '');
        $accessToken = Session::get('token');

        if ($this->endPoints === 'authentications') {
            Session::remove('token');
        }

        try {
            $response = $this->client->delete($fullURL, [
                RequestOptions::HEADERS => $this->setHeaders($accessToken),
                RequestOptions::JSON => $payload,
            ]);

            return $this->setSuccessResponse($response);
        } catch (ClientException $e) {
            return $this->setBadResponse($e);
        } catch (RequestException $e) {
            return $this->setBadResponse($e);
        }
    }

    public function postFile($filePath, string $query = null) {
        $fullURL = $this->fullURL . ($query ? $query : '');
        $accessToken = Session::get('token');

        try {
            $response = $this->client->post($fullURL, [
                RequestOptions::HEADERS => [
                    'Authorization' => 'Bearer ' . $accessToken,
                ],
                RequestOptions::MULTIPART => [
                    [
                        'name' => 'file',
                        'contents' => fopen($filePath, 'r'),
                        'filename' => basename($filePath),
                    ],
                ],
            ]);

            return $this->setSuccessResponse($response);
        } catch (ClientException $e) {
            return $this->setBadResponse($e);
        } catch (RequestException $e) {
            return $this->setBadResponse($e);
        }
    }
}
