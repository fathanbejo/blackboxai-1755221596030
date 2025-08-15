# Analisis Fitur Suite Aplikasi Administrasi v4.0

Dokumen ini menguraikan seluruh fitur yang ada dalam suite aplikasi terpadu, mencakup arsitektur, fitur global, dan fungsionalitas setiap modul individu dalam struktur folder `digital`.

## 1. Arsitektur & Fitur Global

Suite ini adalah kumpulan **Single Page Application (SPA)** yang terintegrasi, dengan backend PHP/MySQL terpusat.

-   **Backend Terpusat**:
    -   **API Server**: Sebuah file PHP tunggal (`api.php`) di dalam folder `digital` menangani semua permintaan dari semua modul.
    -   **Database**: Menggunakan **MySQL/MariaDB** tunggal. Semua modul berbagi database yang sama untuk konsistensi data.
-   **Dasbor Utama (`index.html`)**:
    -   Berfungsi sebagai halaman arahan dan **pusat navigasi utama**.
    -   Menampilkan status login pengguna (pesan selamat datang dan tombol logout).
    -   Menyembunyikan/menampilkan kartu aplikasi berdasarkan peran pengguna.
-   **Pengaturan Global (`admin.html`)**:
    -   **Manajemen Branding**: Admin dapat mengunggah **logo sekolah** dan mengatur **Judul Utama** serta **Subjudul** khusus untuk dasbor.
    -   **Kustomisasi Kop Surat PDF**: Admin dapat mendefinisikan 6 baris teks kustom (termasuk ukuran dan warna font) yang akan digunakan sebagai header di semua laporan PDF.

---

## 2. Autentikasi & Manajemen Pengguna (Fitur Baru v4.0)

Sistem keamanan terpusat untuk mengelola akses ke seluruh aplikasi.

-   **Halaman Login**: Satu halaman login (`login.html`) untuk semua pengguna.
-   **Manajemen Sesi**: Menggunakan sesi PHP untuk menjaga pengguna tetap login saat bernavigasi antar modul.
-   **Kontrol Akses Berbasis Peran (RBAC)**:
    -   **Admin**:
        -   Akses penuh ke semua fitur di semua modul.
        -   Satu-satunya peran yang dapat mengakses **Pengaturan Global** dan **Manajemen Pengguna**.
        -   Dapat melakukan **CRUD (Create, Read, Update, Delete)** pada semua data.
    -   **Operator**:
        -   Dapat **menambah data baru** (`Create`) dan **melihat data** (`Read`) di semua dasbor (izin, rapat, dll.).
        -   **Tidak dapat** mengubah atau menghapus data yang sudah ada.
        -   **Tidak dapat** mengakses Pengaturan Global atau Manajemen Pengguna.
    -   **User (Publik)**:
        -   Tidak perlu login.
        -   Hanya dapat mengakses halaman formulir entri publik, seperti `izin.html` dan `rapat-entri.html`.
-   **Manajemen Pengguna**:
    -   Di halaman `admin.html`, admin dapat menambah, mengedit (username, nama, peran), dan menghapus pengguna lain.

---

## 3. Modul: Formulir Dinamis

-   **Halaman Pengaturan (`form-settings.html`)**:
    -   (Akses: Admin, Operator)
    -   Manajemen Field, Drag-and-Drop, Manajemen Preset.
-   **Halaman Formulir (`form-entri.html`)**:
    -   (Akses: Publik)
    -   Formulir dirender secara dinamis berdasarkan preset.
-   **Halaman Grid (`form-grid.html`)**:
    -   (Akses: Admin, Operator)
    -   Tampilan data seperti spreadsheet. Admin dapat melakukan CRUD, Operator hanya dapat melihat.

---

## 4. Modul: Aplikasi Perizinan & Kalender

-   **Halaman Formulir Izin (`izin.html`)**:
    -   (Akses: Publik)
-   **Halaman Kalender Interaktif (`kalender.html`)**:
    -   (Akses: Publik untuk melihat, Admin untuk mengelola).
-   **Halaman Kalender Pendidikan (`kaldik.html`)**:
    -   (Akses: Publik untuk melihat, Admin untuk mengelola).
-   **Halaman Dasbor (`izin-dasbor.html`)**:
    -   (Akses: Admin, Operator)
    -   Pusat analisis data absensi. Admin dapat menghapus data, Operator hanya dapat melihat dan mengekspor.

---

## 5. Modul: Daftar Hadir Rapat

-   **Halaman Formulir (`rapat-entri.html`)**:
    -   (Akses: Publik, namun biasanya digunakan oleh staf/guru yang login).
-   **Halaman Rekapitulasi (`rapat-rekap.html`)**:
    -   (Akses: Admin, Operator)
    -   Menampilkan daftar semua rapat. Admin dapat menghapus rapat dan mengimpor guru. Operator hanya dapat melihat, mengunduh PDF, dan mengisi notulen.
