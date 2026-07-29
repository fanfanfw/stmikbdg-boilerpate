<?php

namespace Tests\Feature;

use Tests\TestCase;

class AuthRedirectUrlTest extends TestCase
{
    public function test_auth_redirects_encode_app_url_and_preserve_trailing_slash(): void
    {
        config([
            'app.url' => 'https://app.example.test/nested/',
            'myconfig.login.base_url' => 'https://login.example.test/',
        ]);

        $query = 'site=https%3A%2F%2Fapp.example.test%2Fnested%2F';

        $this->get('/')->assertRedirect('https://login.example.test/verify?'.$query);
        $this->get('/logout')->assertRedirect('https://login.example.test/logout?'.$query);
    }
}
