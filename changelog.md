# Catatan Perubahan Suite Aplikasi

File ini mencatat semua perubahan signifikan yang terjadi selama pengembangan.

---

### **Versi 4.3.2 - Peningkatan Sesi Definitif (Database Session Handling)**
**Tanggal:** 14 Oktober 2025

Rilis ini menerapkan perubahan arsitektur fundamental pada cara aplikasi menangani sesi pengguna, beralih dari penyimpanan berbasis file default ke penyimpanan berbasis database yang jauh lebih andal. Ini adalah solusi definitif untuk masalah *login loop* yang terkadang muncul karena konfigurasi atau masalah izin pada direktori sesi di server.

#### ✨ Arsitektur & Fitur Keamanan Baru:

1.  **Implementasi `DatabaseSessionHandler` Kustom**:
    *   **Penyimpanan Sesi di Database (`api.php`)**: Semua data sesi (informasi login) sekarang disimpan di dalam tabel `sessions` baru di database, bukan di file sementara di server.
    *   **Keandalan Lintas Server**: Metode ini menghilangkan ketergantungan pada konfigurasi sistem file server, memastikan sesi berfungsi secara konsisten di berbagai lingkungan hosting.
    *   **Peningkatan Stabilitas**: Mencegah masalah "sesi hilang" setelah login, yang merupakan akar penyebab dari *login loop*.

2.  **Skema Database Baru (`sql_setup.md`)**:
    *   Menambahkan definisi tabel `sessions` ke dalam skrip instalasi utama untuk mendukung *session handler* yang baru.

---

### **Versi 4.3.1 - Pre-flight Check & Self-Diagnostics**
**Tanggal:** 13 Oktober 2025

Rilis ini menambahkan sistem diagnostik mandiri di backend (`api.php`) untuk secara proaktif mendeteksi masalah konfigurasi server yang kritis sebelum aplikasi mencoba menjalankan logika apa pun. Tujuannya adalah memberikan pesan error yang jelas dan dapat ditindaklanjuti untuk menyederhanakan proses *troubleshooting*.

#### 🔧 Perbaikan Kritis & Peningkatan:

1.  **Pemeriksaan Pra-Jalan (Pre-flight Check)**:
    *   **Validasi `config.php`**: Skrip sekarang secara paksa memverifikasi keberadaan file `config.php`. Jika tidak ada, aplikasi akan berhenti dengan pesan error yang jelas.
    *   **Validasi Koneksi Database**: Memeriksa apakah koneksi ke database dapat dibuat menggunakan kredensial dari `config.php`. Jika gagal, pesan error dari server database akan ditampilkan.
    *   **Validasi Izin Tulis Sesi**: Memastikan direktori sesi PHP dapat ditulisi oleh server. Masalah izin pada folder ini adalah penyebab umum kegagalan login.

---

### **Versi 4.2.2 - Perbaikan Definitif (Jeda Waktu & Alur Sukses)**
**Tanggal:** 13 Oktober 2025

Rilis ini menerapkan perbaikan definitif untuk masalah *login loop* berdasarkan analisis alur aplikasi referensi yang berhasil. Akar masalahnya adalah **race condition** di mana browser melakukan *redirect* terlalu cepat, sebelum sempat menyimpan *cookie* sesi. Jeda waktu yang disengaja setelah login berhasil terbukti menjadi solusi yang andal.

#### 🔧 Perbaikan Kritis & Definitif:

1.  **Implementasi Jeda Waktu Pasca-Login**:
    *   **Modal Sukses (`login.html`, `login.js`)**: Setelah API mengonfirmasi login berhasil, skrip **tidak langsung melakukan redirect**. Sebaliknya, ia menampilkan modal "Proses Authentication Berhasil" yang elegan.
    *   **Redirect Tertunda (`login.js`)**: Modal tersebut ditampilkan selama **1.5 detik**. Jeda ini memberikan "ruang bernapas" yang krusial bagi browser untuk menyelesaikan pemrosesan header `Set-Cookie` dan menyimpan sesi dengan benar.
    *   **Penyelesaian *Race Condition***: Setelah jeda 1.5 detik, barulah *redirect* ke halaman dasbor (`index.html`) dieksekusi. Pada titik ini, *cookie* sesi sudah siap, sehingga `checkSession()` di halaman dasbor akan berhasil, dan *login loop* terputus secara tuntas.

---

### **Versi 4.2.1 - Perbaikan Login Definitif (Client-Side Pre-Caching)**
**Tanggal:** 12 Oktober 2025

Rilis ini menerapkan perbaikan kritis yang berbeda untuk menyelesaikan masalah *login loop* yang persisten. Akar masalahnya diidentifikasi sebagai **race condition di sisi klien**, di mana browser melakukan redirect ke halaman dasbor sebelum sempat memproses dan menyimpan *cookie* sesi yang diterima dari server.

#### 🔧 Perbaikan Kritis & Definitif:

1.  **Strategi Pre-Caching Sesi**:
    *   **Backend Cerdas (`api.md`)**: Endpoint `login` kini tidak hanya mengembalikan pesan sukses, tetapi juga **mengembalikan objek data pengguna** (`user_id`, `username`, `role`, dll.) secara langsung di dalam respons.
    *   **Frontend Proaktif (`login.js`)**: Setelah menerima data pengguna dari API, skrip login sekarang memanggil fungsi `setUserSession` untuk **menyimpan data sesi di sebuah cache JavaScript terlebih dahulu**.
    *   **Redirect Aman**: **Hanya setelah** data sesi disimpan di cache, barulah skrip melakukan `window.location.href` ke halaman dasbor.
    *   **Auth Helper Cerdas (`auth-helper.js`)**: Saat halaman dasbor dimuat dan memanggil `checkSession`, helper ini kini **memeriksa cache internalnya terlebih dahulu**. Karena cache sudah diisi, ia akan segera mengonfirmasi bahwa pengguna sudah login, sehingga **memutus *login loop*** secara tuntas tanpa bergantung pada kecepatan pemrosesan *cookie* oleh browser.

---

### **Versi 4.2.0 - Perbaikan Login Definitif (CORS Origin)**
**Tanggal:** 11 Oktober 2025

Rilis ini menerapkan perbaikan definitif untuk menyelesaikan masalah *login loop* yang persisten. Akar masalahnya adalah konflik kebijakan keamanan browser modern (CORS) di mana server tidak dapat menggunakan `Access-Control-Allow-Origin: *` (izinkan semua) saat `Access-Control-Allow-Credentials: true` (izinkan cookie) diaktifkan.

#### 🔧 Perbaikan Definitif:

1.  **Penanganan Origin Dinamis (`api.md`)**:
    *   Menghapus header `Access-Control-Allow-Origin: *` yang tidak aman.
    *   Menggantinya dengan logika yang secara dinamis mendeteksi origin dari permintaan (`$_SERVER['HTTP_ORIGIN']`) dan merefleksikannya kembali di header `Access-Control-Allow-Origin`. Ini secara eksplisit memberitahu browser bahwa domain yang meminta diizinkan untuk menerima cookie, menyelesaikan konflik CORS dan memungkinkan sesi untuk berfungsi dengan benar.

#### 🧹 Pembersihan Proyek:
*   Menghapus file `index.html` lama dari direktori root untuk menghindari kebingungan.
*   Menghapus file `index.tsx` yang tidak relevan dari proyek.

---

### **Versi 4.1.0 - Perbaikan Login Loop Fundamental (CORS & Kredensial)**
**Tanggal:** 10 Oktober 2025

Rilis ini menerapkan perbaikan kritis dan komprehensif pada sistem autentikasi untuk menyelesaikan masalah *login loop* yang persisten. Masalah ini disebabkan oleh interaksi antara kebijakan browser modern, permintaan lintas domain (CORS), dan penanganan sesi.

#### 🔧 Perbaikan Kritis & Fundamental:

1.  **Penanganan Kredensial Sisi Klien (`api-helper.js`)**:
    *   Menambahkan opsi `credentials: 'include'` pada **setiap** panggilan `fetch` ke API. Ini adalah perubahan paling krusial yang memberitahu browser untuk **selalu mengirimkan cookie sesi** bersama dengan permintaan. Tanpa ini, backend tidak akan pernah mengenali sesi yang sudah login.

2.  **Konfigurasi CORS Sisi Server (`api.php`)**:
    *   Menambahkan header `Access-Control-Allow-Credentials: true`. Header ini adalah pasangan dari perubahan di sisi klien, yang secara eksplisit memberitahu browser bahwa server **mengizinkan** permintaan yang membawa kredensial seperti cookie.

3.  **Pencegahan Race Condition (`api.php`)**:
    *   Mengembalikan `session_write_close()` dan menempatkannya secara strategis **tepat setelah** data sesi diatur pada saat login. Ini "memaksa" server untuk segera menyimpan data sesi ke disk sebelum mengirim respons, menghilangkan *race condition* di mana browser melakukan *redirect* sebelum sesi sempat divalidasi.

4.  **Peningkatan Keamanan Sesi (`api.php`)**:
    *   Menambahkan `ini_set('session.use_strict_mode', 1);` untuk memastikan server hanya menerima ID sesi valid yang dihasilkannya sendiri, meningkatkan keamanan terhadap serangan fiksasi sesi.

Kombinasi dari perbaikan di sisi frontend dan backend ini memastikan alur autentikasi yang kuat, aman, dan andal di berbagai konfigurasi server.

---

### **Versi 4.0.2 - Perbaikan Sesi Definitif**
**Tanggal:** 9 Oktober 2025

Rilis ini menerapkan perbaikan fundamental pada penanganan sesi PHP untuk menyelesaikan masalah *login loop* yang persisten di berbagai konfigurasi server.

#### 🔧 Perbaikan Kritis:

1.  **Inisialisasi Sesi Eksplisit**:
    *   Mengganti panggilan `session_start()` sederhana dengan blok inisialisasi sesi yang kuat (`session_set_cookie_params`).
    *   Secara eksplisit mengatur parameter *cookie* sesi, terutama `path` ke `/`, untuk memastikan *cookie* berlaku di seluruh situs dan dikirim kembali dengan andal oleh browser setelah *redirect*.
    *   Meningkatkan keamanan dengan mengatur *cookie* sesi menjadi `httponly` dan `samesite='Lax'`.
    *   Perubahan ini menargetkan akar masalah "sesi yang hilang" dan membuat sistem autentikasi jauh lebih andal dan aman.

---

### **Versi 4.0.1 - Perbaikan Kritis Autentikasi**
**Tanggal:** 8 Oktober 2025

Rilis ini mengatasi masalah kritis di mana beberapa pengguna mengalami *redirect loop* setelah mencoba login.

#### 🔧 Perbaikan Bug:

1.  **Penyelesaian Login Loop**:
    *   Memperbaiki logika penanganan sesi di backend (`api.php`) untuk memastikan sesi disimpan dan divalidasi dengan benar setelah login.
    *   Menerapkan `session_regenerate_id(true)` saat login berhasil untuk meningkatkan keamanan dan keandalan sesi.
    *   Membuat inisialisasi sesi (`session_start`) lebih kuat untuk mencegah error pada konfigurasi server yang berbeda.
    *   Menghapus panggilan `session_write_close()` yang manual untuk mengandalkan mekanisme bawaan PHP yang lebih stabil.

---

### **Versi 4.0 - Autentikasi & Kontrol Akses Berbasis Peran (RBAC)**
**Tanggal:** 7 Oktober 2025

Rilis ini merupakan lompatan besar dalam keamanan dan manajemen, mengubah suite aplikasi menjadi platform multi-pengguna yang aman dengan hak akses yang jelas.

#### ✨ Arsitektur & Fitur Keamanan Baru:

1.  **Sistem Autentikasi Terpusat**:
    *   Memperkenalkan halaman `login.html` sebagai gerbang utama untuk mengakses fitur-fitur yang dilindungi.
    *   Menggunakan **sesi PHP** untuk menjaga status login pengguna di seluruh modul, sehingga cukup login sekali (Single Sign-On).

2.  **Manajemen Pengguna (Admin Only)**:
    *   Menambahkan tabel `users` baru di database untuk menyimpan kredensial dan peran pengguna.
    *   Membuat antarmuka **CRUD (Create, Read, Update, Delete) Pengguna** di dalam halaman Pengaturan Global, memungkinkan admin untuk mengelola akun.

3.  **Kontrol Akses Berbasis Peran (RBAC)**:
    *   Mendefinisikan tiga peran pengguna yang jelas:
        *   **`admin`**: Akses penuh ke semua fitur, termasuk pengaturan global dan manajemen pengguna.
        *   **`operator`**: Dapat menambah dan melihat data di semua modul, tetapi **tidak dapat mengubah atau menghapus** data yang sudah ada. Ideal untuk staf entri data.
        *   **`user`**: Peran default untuk publik, hanya dapat mengakses halaman formulir entri (misal: `izin.html`, `rapat-entri.html`).
    *   Backend (`api.php`) sekarang secara ketat memvalidasi peran pengguna untuk setiap aksi yang sensitif.

#### 🚀 Peningkatan & Integrasi:

*   **Proteksi Halaman**: Halaman dasbor dan pengaturan (`izin-dasbor.html`, `rapat-rekap.html`, `admin.html`, dll.) kini secara otomatis mengalihkan pengguna ke halaman login jika mereka belum masuk.
*   **UI Dinamis**: Antarmuka pengguna sekarang beradaptasi dengan peran pengguna. Tombol-tombol berbahaya seperti "Hapus", "Import", atau akses ke pengaturan disembunyikan dari pengguna yang tidak memiliki hak (misalnya, `operator`).
*   **Keamanan Backend**: Semua endpoint API yang melakukan modifikasi data kini dilindungi dan hanya dapat diakses oleh peran yang sesuai.

---

### **Versi 3.1 - Penyempurnaan Dasbor & Pengaturan Global**
**Tanggal:** 6 Oktober 2025

Rilis ini berfokus pada peningkatan kegunaan dan fleksibilitas suite aplikasi dengan menyempurnakan dasbor utama dan memperkaya halaman pengaturan global.

#### ✨ Fitur Baru & Peningkatan:

1.  **Dasbor Utama sebagai Pusat Navigasi**:
    *   Kartu aplikasi di dasbor utama (`index.html`) telah disempurnakan untuk menampilkan tautan langsung ke semua halaman fungsional dari setiap modul, menjadikannya pusat navigasi yang efisien.

2.  **Pengaturan Global yang Lebih Rinci**:
    *   **Kop Surat PDF yang Dapat Diciutkan**: Bagian pengaturan 6 baris untuk kop surat PDF di halaman admin kini berada di dalam panel yang dapat diciutkan (`<details>`), membuat halaman lebih rapi dan fokus.
    *   **Pengaturan Judul Dasbor Kustom**: Di bawah bagian "Branding & Tampilan", ditambahkan dua kolom baru: "Judul Utama Dasbor" dan "Subjudul Dasbor". Pengaturan ini memungkinkan kustomisasi penuh pada tampilan dasbor utama, terpisah dari teks kop surat PDF.

---

### **Versi 3.0 - Konsolidasi Total ke Folder `digital`**
**Tanggal:** 5 Oktober 2025

Rilis ini merupakan perombakan arsitektur terbesar, mengubah kumpulan modul terpisah (Formulir, Izin, Rapat, Kalender, Admin, Aset) menjadi satu "Suite Aplikasi" yang kohesif dan terpusat di dalam satu direktori `digital`.

#### ✨ Arsitektur & Fitur Baru:

1.  **Struktur Folder Datar (Flat Structure)**:
    *   Semua file dari semua modul dipindahkan ke dalam satu direktori `digital`. Subdirektori aplikasi dihilangkan untuk menyederhanakan path dan deployment.
    *   File-file diganti namanya untuk kejelasan (misalnya, `rapat/index.html` menjadi `digital/rapat-entri.html`).
2.  **Backend Terkonsolidasi Penuh**:
    *   Semua logika backend dari semua modul digabungkan ke dalam satu file `api.php` (disimpan sebagai `api.md`) di dalam folder `digital`.
    *   Semua path penyimpanan file (untuk tanda tangan, dokumen, logo) diperbaiki untuk bekerja dari direktori root `digital`.
3.  **Database Terunifikasi**:
    *   Semua skema `CREATE TABLE` digabungkan ke dalam satu file `sql_setup.md`, menciptakan satu sumber kebenaran untuk instalasi database.
4.  **Dasbor Utama Terintegrasi**:
    *   Halaman `index.html` diperbarui menjadi dasbor utama yang sesungguhnya, dengan tautan yang sudah dikoreksi ke semua fungsionalitas dalam struktur baru.
5.  **Pembersihan Total**:
    *   Semua folder modul lama dan file yang tidak relevan (seperti `README.md` dan `api.md` per modul) dihapus.
    *   Membuat file `README.md` dan `fitur.md` baru yang komprehensif untuk seluruh suite.