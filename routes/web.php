<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ArsipDigitalProxyController;
use Illuminate\Support\Facades\Route;

/**
 * ! Jangan ubah route yang ada dalam group ini
 * */
Route::controller(AuthController::class)
    ->group(function () {
        Route::get('/', 'checkToken')->name('check');
        Route::get('/logout', 'logout')->name('logout'); // gunakan untuk logout
        Route::get('/roles', 'changeUserRole')->middleware('auth.token');
    });

/**
 * ! Jadikan route di bawah sebagai halaman utama dari web
 * ! harap tidak mengubah nilai pada name();
 */
Route::middleware('auth.token')
    ->group(function () {
        Route::get('/home', function () {
            return view('welcome');
        })->name('home');

        Route::get('/session/me', function () {
            $role = session('role');

            return response()->json([
                'role' => is_array($role) ? array_key_first(array_filter($role)) : $role,
                'account' => session('account'),
                'profile' => session('profile'),
                'user_email' => session('user_email'),
                'user_image' => session('user_image'),
            ]);
        });

        Route::match(['GET', 'POST', 'PUT', 'DELETE'], '/arsip-digital/proxy/{path?}', [ArsipDigitalProxyController::class, 'handle'])
            ->where('path', '.*');
    });

/**
 * * Buat route-route baru di bawah ini
 * * Pastikan untuk selalu menggunakan middleware('auth.token')
 * * middleware tersebut digunakan untuk verifikasi access pengguna dengan web
 *
 * * Bisa juga ditambahkan dengan middleware lainnya.
 * * Berikut adalah beberapa middleware lain yang telah tersedia,
 * * dapat digunakan untuk mengatur akses route berdasarkan role user
 *
 * 1.) auth.admin -> biasa digunakan untuk akses route untuk manage user lain
 * 2.) auth.mahasiswa -> akses route untuk user dengan role mahasiswa
 * 3.) auth.dosen -> akses route untuk user dengan role dosen
 * 4.) auth.developer -> akses route untuk user developer
 *
 * ? contoh penggunaan: middleware(['auth.token', 'auth.mahasiswa'])
 */

Route::middleware('auth.token')->get('/react/{any?}', function () {
    return view('react-app');
})->where('any', '.*')->name('react-app');
