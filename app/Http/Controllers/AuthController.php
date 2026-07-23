<?php

namespace App\Http\Controllers;

use App\Models\AuthService;
use App\Models\UserService;
// ? Services
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;

class AuthController extends Controller
{
    protected $service;

    public function __construct()
    {
        $this->service = new AuthService;
    }

    public function checkToken(Request $request)
    {
        if ($request->query('token') and $request->query('role')) {
            $token = $request->query('token');
            $role = $request->query('role');

            if (! $token) {
                return self::redirectToLogin();
            }

            $checkToken = $this->service->checkToken($token);

            if ($checkToken->getData('data')['status'] !== 'success') {
                return redirect()->route('logout');
            }

            // save token to session
            Session::put('token', $token);

            // get user profile
            $userService = new UserService;
            $user = $userService->getMyProfile()->getData('data')['data'];
            $userProfile = $user['profile'];
            $userAccount = $user['account'];
            Session::put('account', $userAccount);

            // verify role
            $allowedRoles = ['is_admin', 'is_mhs', 'is_dosen'];
            if (! in_array($role, $allowedRoles, true)) {
                return self::changeUserRole($role);
            }

            if (empty($userAccount[$role])) {
                return self::changeUserRole();
            }

            Session::put('role', [$role => true]);

            // save user data to session
            Session::put('profile', $userProfile);
            Session::put('user_image', $user['account']['image']);
            Session::put('user_email', $user['account']['email']);

            return redirect()->route('home');
        } else {
            if (Session::has('role') and Session::has('token')) {
                return redirect()->route('home');
            }

            return self::redirectToVerifyPage();
        }
    }

    public function logout()
    {
        if (Session::exists('token')) {
            Session::remove('token');
            Session::remove('role');
            Session::remove('profile');
            Session::remove('user_image');
            Session::remove('user_email');
        }

        return self::redirectToLogout();
    }

    public function switchUserRole(Request $request)
    {
        $validated = $request->validate([
            'role' => 'required|in:is_admin,is_mhs,is_dosen',
        ]);
        $account = Session::get('account');

        abort_unless(is_array($account) && ! empty($account[$validated['role']]), 403);

        Session::put('role', [$validated['role'] => true]);

        return redirect()->route('home');
    }

    public function changeUserRole(?string $unsupportedRole = null)
    {
        $tempSessionRole = Session::get('account');
        if (! is_array($tempSessionRole)) {
            return self::redirectToVerifyPage();
        }

        $allowedKeys = ['is_admin', 'is_mhs', 'is_dosen'];
        $data = [
            'roles' => array_filter($tempSessionRole, function ($item, $key) use ($allowedKeys) {
                return in_array($key, $allowedKeys, true) && is_bool($item) && $item === true;
            }, ARRAY_FILTER_USE_BOTH),
            'unsupportedRole' => $unsupportedRole,
            'simakUrl' => config('myconfig.simak.base_url'),
        ];

        return view('auth.roles', $data);
    }

    private function redirectToVerifyPage()
    {
        return redirect()->away(
            config('myconfig.login.base_url').'verify?site='.config('app.url')
        );
    }

    private function redirectToLogin()
    {
        return redirect()->away(
            config('myconfig.login.base_url').'login?site='.config('app.url')
        );
    }

    private function redirectToLogout()
    {
        return redirect()->away(
            config('myconfig.login.base_url').'logout?site='.config('app.url')
        );
    }
}
