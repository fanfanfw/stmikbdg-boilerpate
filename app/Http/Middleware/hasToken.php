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
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $unauthorized = fn () => $request->is('arsip-digital/proxy/*') || $request->expectsJson()
            ? response()->json(['status' => 'fail', 'message' => 'Unauthenticated.'], 401)
            : redirect()->route('logout');

        if (Session::exists('token')) {
            $auth = new AuthService;
            $token = Session::get('token');
            $checkToken = $auth->checkToken($token);
            $siteAccess = $auth->validateUserSiteAccess(config('app.url'));

            if ($siteAccess->getData('data')['status'] === 'fail') {
                if ($request->is('arsip-digital/proxy/*') || $request->expectsJson()) {
                    return $unauthorized();
                }

                return redirect()->away(
                    config('myconfig.login.base_url').'verify?'.http_build_query([
                        'site' => config('app.url'),
                    ])
                );
            }

            if ($checkToken->getData('data')['status'] !== 'success') {
                return $unauthorized();
            }

            return $next($request);
        }

        return $unauthorized();
    }
}
