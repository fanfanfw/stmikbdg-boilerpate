<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;

class AuthService extends MyWebService
{
    use HasFactory;

    public function __construct()
    {
        parent::__construct('authentications');
    }

    public function validateUserSiteAccess($siteURL)
    {
        $query = '/check/site?'.http_build_query(['url' => $siteURL]);

        return $this->get(null, $query);
    }

    public function checkToken($token)
    {
        $payload = [
            'token' => $token,
        ];

        return $this->get($payload, '/check');
    }
}
