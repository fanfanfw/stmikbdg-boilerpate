<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 - Role Tidak Didukung</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
</head>
<body class="bg-light">
    <main class="container min-vh-100 d-flex align-items-center justify-content-center">
        <section class="card border-0 shadow-sm text-center p-4 p-md-5" style="max-width: 560px">
            <div class="display-1 fw-bold text-primary">404</div>
            <h1 class="h3 mt-2">Role tidak tersedia</h1>
            <p class="text-secondary mt-3">
                Arsip Digital hanya dapat diakses menggunakan role Admin, Mahasiswa, atau Dosen.
                Gunakan SIMAK untuk mengakses menu sesuai role yang dipilih.
            </p>
            <div class="d-flex flex-column flex-sm-row gap-2 justify-content-center mt-3">
                <button type="button" class="btn btn-outline-secondary" onclick="history.back()">
                    Kembali
                </button>
                @if ($simakUrl)
                    <a href="{{ $simakUrl }}" class="btn btn-primary">Buka SIMAK</a>
                @endif
            </div>
        </section>
    </main>
</body>
</html>
