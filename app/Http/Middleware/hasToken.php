<?php

namespace App\Http\Middleware;

use App\Models\AuthService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;
use Symfony\Component\HttpFoundation\Response;

class hasToken
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (Session::exists('token')) {
            $auth = new AuthService();
            $token = Session::get('token');
            $checkToken = $auth->checkToken($token);
            $siteAccess = $auth->validateUserSiteAccess(config('app.url'));

            if ($siteAccess->getData('data')['status'] === 'fail') {
                return redirect()
                    ->away(config('myconfig.login.base_url')
                        . 'verify?site='
                        . config('app.url'));
            }

            if ($checkToken->getData('data')['status'] !== 'success') {
                return redirect()->route('logout');
            }

            return $next($request);
        }

        return redirect()->route('logout');
    }
}
