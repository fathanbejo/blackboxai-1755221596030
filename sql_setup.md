-- SQL Setup untuk Suite Aplikasi Administrasi Sekolah v4.0
-- Jalankan query ini di database Anda untuk membuat semua tabel yang diperlukan.

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+07:00";

-- ========================================================
-- TABEL BARU UNTUK AUTENTIKASI PENGGUNA (v4.0)
-- ========================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `nama_lengkap` varchar(100) DEFAULT NULL,
  `role` enum('admin','operator','user') NOT NULL DEFAULT 'user',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Menambahkan pengguna admin default untuk login pertama kali
-- Username: admin
-- Password: admin123
-- Ganti SEGERA setelah login pertama kali!
INSERT IGNORE INTO `users` (`id`, `username`, `password`, `nama_lengkap`, `role`) VALUES
(1, 'admin', '$2y$10$I0aDBx.71.g.j5k2L1J5HeR.l5IeozME43Q4J8B25I4Y0J8k.itS.', 'Administrator Utama', 'admin');


--
-- Tabel untuk menyimpan data sesi PHP di database (v4.3.2)
--
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` VARCHAR(128) NOT NULL,
  `data` TEXT,
  `expires` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_expires` (`expires`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- --------------------------------------------------------

--
-- Tabel untuk Pengaturan Global (Branding, Kop Surat, Header Aplikasi)
--
CREATE TABLE IF NOT EXISTS `global_settings` (
  `setting_key` varchar(255) NOT NULL,
  `setting_value` text DEFAULT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Data default untuk global_settings (Gunakan INSERT IGNORE agar aman dijalankan ulang)
--
INSERT IGNORE INTO `global_settings` (`setting_key`, `setting_value`) VALUES
('header_line_1', 'YAYASAN PENDIDIKAN ALMAARIF SINGOSARI'),
('header_line_1_size', '14'),
('header_line_1_color', '#2E7D32'),
('header_line_2', 'SK Menkumham No. AHU-0003189.ah.01.04 Tahun 2015'),
('header_line_2_size', '8'),
('header_line_2_color', '#2E7D32'),
('header_line_3', 'MADRASAH IBTIDAIYAH ALMAARIF 02'),
('header_line_3_size', '20'),
('header_line_3_color', '#2E7D32'),
('header_line_4', 'TERAKREDITASI \"A\"'),
('header_line_4_size', '16'),
('header_line_4_color', '#2E7D32'),
('header_line_5', 'Jl. Masjid 33, Telp. (0341) 451542 Singosari Malang 65153'),
('header_line_5_size', '9'),
('header_line_5_color', '#000000'),
('header_line_6', 'email : mia02sgs@gmail.com - www.mia02sgs.sch.id'),
('header_line_6_size', '9'),
('header_line_6_color', '#000000'),
('logo_path', 'https://mia02sgs.sch.id/wp-content/uploads/2024/01/cropped-Tagline-1.png'),
('dashboard_title', 'Suite Aplikasi Administrasi'),
('dashboard_subtitle', 'MI ALMAARIF 02 SINGOSARI'),
('izin_form_title', 'MI ALMAARIF 02'),
('izin_form_subtitle', 'Formulir Izin'),
('izin_dasbor_title', 'Dasbor Absensi MIA02'),
('rapat_form_title', 'Daftar Hadir Rapat');


-- ========================================================
-- TABEL UNTUK MODUL: FORM DINAMIS
-- ========================================================

--
-- Tabel untuk menyimpan konfigurasi formulir
--
CREATE TABLE IF NOT EXISTS `app_settings` (
  `setting_key` varchar(255) NOT NULL,
  `setting_value` longtext NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Data default untuk app_settings
--
INSERT IGNORE INTO `app_settings` (`setting_key`, `setting_value`) VALUES
('formSettings', '{\"fields\":[{\"name\":\"ID_SISWA\",\"label\":\"ID_SISWA\",\"type\":\"text\",\"visible\":false,\"editable\":false,\"required\":true,\"isNamaField\":false,\"placeholder\":\"\",\"hiddenInSettings\":false,\"defaultHiddenInSettings\":false},{\"name\":\"NAMA\",\"label\":\"NAMA\",\"type\":\"text\",\"visible\":true,\"editable\":true,\"required\":true,\"isNamaField\":true,\"placeholder\":\"Ketik nama siswa...\",\"hiddenInSettings\":false,\"defaultHiddenInSettings\":false,\"dropdownSourceType\":\"auto\"},{\"name\":\"ROMBEL\",\"label\":\"ROMBEL\",\"type\":\"text\",\"visible\":true,\"editable\":true,\"required\":false,\"isNamaField\":false,\"placeholder\":\"\",\"hiddenInSettings\":false,\"defaultHiddenInSettings\":false,\"dropdownSourceType\":\"auto\"}]}'),
('presets', '{\"presets\":{}}');


--
-- Tabel untuk menyimpan data siswa (SHARED)
--
CREATE TABLE IF NOT EXISTS `students` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ID_SISWA` int(5) NOT NULL,
  `NAMA` varchar(255) CHARACTER SET utf8mb4 DEFAULT NULL,
  `ROMBEL` varchar(255) CHARACTER SET utf8mb4 DEFAULT NULL,
  `KELAS_BILQOLAM` varchar(255) CHARACTER SET utf8mb4 DEFAULT NULL,
  `Tanggal_Update_Terakhir` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ID_SISWA_UNIQUE` (`ID_SISWA`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ========================================================
-- TABEL UNTUK MODUL: APLIKASI PERIZINAN & KALENDER
-- ========================================================

--
-- Tabel untuk menyimpan data absensi/izin
--
CREATE TABLE IF NOT EXISTS `absensi` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_siswa` int(11) NOT NULL,
  `tanggal_izin` date NOT NULL,
  `alasan` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `keterangan` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kelas_bilqolam` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unik_siswa_tanggal` (`id_siswa`,`tanggal_izin`),
  KEY `fk_absensi_students` (`id_siswa`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel untuk menyimpan agenda kustom
--
CREATE TABLE IF NOT EXISTS `agenda` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `agenda_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_holiday` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `agenda_date_index` (`agenda_date`),
  KEY `end_date_index` (`end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel untuk menyimpan dokumen/lampiran kalender
--
CREATE TABLE IF NOT EXISTS `calendar_documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `document_date` date NOT NULL,
  `file_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `document_date_index` (`document_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel untuk menyimpan cache hari libur
--
CREATE TABLE IF NOT EXISTS `holidays` (
  `holiday_date` date NOT NULL,
  `holiday_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'API',
  PRIMARY KEY (`holiday_date`),
  KEY `source_index` (`source`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ========================================================
-- TABEL UNTUK MODUL: DAFTAR HADIR RAPAT
-- ========================================================

--
-- Tabel untuk menyimpan daftar guru (SHARED)
--
CREATE TABLE IF NOT EXISTS `guru` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nama_guru` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `jabatan` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nama_guru_unique` (`nama_guru`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel untuk menyimpan informasi rapat
--
CREATE TABLE IF NOT EXISTS `rapat` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `topik_rapat` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tanggal_rapat` date NOT NULL,
  `status_rapat` enum('Draft','Selesai') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Draft',
  `notulen` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `path_dokumentasi` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Tabel untuk menyimpan kehadiran peserta rapat
--
CREATE TABLE IF NOT EXISTS `peserta_rapat` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_rapat` int(11) NOT NULL,
  `nama_peserta` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `path_tanda_tangan` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `waktu_hadir` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `id_rapat` (`id_rapat`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


--
-- Menambahkan Foreign Key Constraints (jika belum ada)
--
ALTER TABLE `absensi`
  ADD CONSTRAINT `fk_absensi_students` FOREIGN KEY (`id_siswa`) REFERENCES `students` (`ID_SISWA`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `peserta_rapat`
  ADD CONSTRAINT `peserta_rapat_ibfk_1` FOREIGN KEY (`id_rapat`) REFERENCES `rapat` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;