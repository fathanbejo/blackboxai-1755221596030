-- Script Setup Database untuk Suite Aplikasi
-- Jalankan script ini di database MySQL/MariaDB Anda

-- 1. Tabel sessions
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(128) NOT NULL PRIMARY KEY,
    data TEXT,
    expires DATETIME NOT NULL,
    INDEX idx_expires (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabel users
CREATE TABLE IF NOT EXISTS users (
    id int(11) NOT NULL AUTO_INCREMENT,
    username varchar(50) NOT NULL,
    password varchar(255) NOT NULL,
    nama_lengkap varchar(100) DEFAULT NULL,
    role enum('admin','operator','user') NOT NULL DEFAULT 'user',
    created_at timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (id),
    UNIQUE KEY username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Tabel global_settings
CREATE TABLE IF NOT EXISTS global_settings (
    id int(11) NOT NULL AUTO_INCREMENT,
    setting_key varchar(100) NOT NULL,
    setting_value TEXT,
    created_at timestamp NOT NULL DEFAULT current_timestamp(),
    updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (id),
    UNIQUE KEY setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Tabel app_settings
CREATE TABLE IF NOT EXISTS app_settings (
    id int(11) NOT NULL AUTO_INCREMENT,
    setting_key varchar(100) NOT NULL,
    setting_value LONGTEXT,
    created_at timestamp NOT NULL DEFAULT current_timestamp(),
    updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (id),
    UNIQUE KEY setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Tabel students
CREATE TABLE IF NOT EXISTS students (
    id int(11) NOT NULL AUTO_INCREMENT,
    ID_SISWA int(11) NOT NULL,
    NAMA varchar(255) NOT NULL,
    ROMBEL varchar(50) DEFAULT NULL,
    KELAS_BILQOLAM varchar(50) DEFAULT NULL,
    Tanggal_Update_Terakhir timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (id),
    UNIQUE KEY ID_SISWA (ID_SISWA)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Tabel absensi
CREATE TABLE IF NOT EXISTS absensi (
    id int(11) NOT NULL AUTO_INCREMENT,
    id_siswa int(11) NOT NULL,
    tanggal_izin date NOT NULL,
    alasan varchar(255) NOT NULL,
    keterangan text,
    kelas_bilqolam varchar(50) DEFAULT NULL,
    created_at timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (id),
    KEY id_siswa (id_siswa),
    KEY tanggal_izin (tanggal_izin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Tabel guru
CREATE TABLE IF NOT EXISTS guru (
    id int(11) NOT NULL AUTO_INCREMENT,
    nama_guru varchar(255) NOT NULL,
    jabatan varchar(100) DEFAULT NULL,
    created_at timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Tabel rapat
CREATE TABLE IF NOT EXISTS rapat (
    id int(11) NOT NULL AUTO_INCREMENT,
    judul varchar(255) NOT NULL,
    tanggal date NOT NULL,
    waktu time NOT NULL,
    tempat varchar(255) DEFAULT NULL,
    agenda text,
    path_dokumentasi text,
    created_at timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Tabel peserta_rapat
CREATE TABLE IF NOT EXISTS peserta_rapat (
    id int(11) NOT NULL AUTO_INCREMENT,
    id_rapat int(11) NOT NULL,
    nama varchar(255) NOT NULL,
    jabatan varchar(100) DEFAULT NULL,
    hadir enum('ya','tidak') NOT NULL DEFAULT 'ya',
    path_tanda_tangan varchar(500) DEFAULT NULL,
    created_at timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (id),
    KEY id_rapat (id_rapat)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Insert user admin default (jika belum ada)
INSERT IGNORE INTO users (username, password, nama_lengkap, role) 
VALUES ('admin', '$2y$10$I0aDBx.71.g.j5k2L1J5HeR.l5IeozME43Q4J8B25I4Y0J8k.itS.', 'Administrator Utama', 'admin');

-- 10. Tabel agenda (untuk kalender)
CREATE TABLE IF NOT EXISTS agenda (
    id int(11) NOT NULL AUTO_INCREMENT,
    agenda_date date NOT NULL,
    end_date date DEFAULT NULL,
    description text NOT NULL,
    is_holiday tinyint(1) DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (id),
    KEY agenda_date (agenda_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Tabel holidays (untuk hari libur)
CREATE TABLE IF NOT EXISTS holidays (
    id int(11) NOT NULL AUTO_INCREMENT,
    holiday_date date NOT NULL,
    holiday_name varchar(255) NOT NULL,
    source varchar(50) DEFAULT 'manual',
    created_at timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (id),
    UNIQUE KEY holiday_date (holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Tabel calendar_documents (untuk dokumen kalender)
CREATE TABLE IF NOT EXISTS calendar_documents (
    id int(11) NOT NULL AUTO_INCREMENT,
    document_date date NOT NULL,
    document_name varchar(255) NOT NULL,
    document_path varchar(500) NOT NULL,
    created_at timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (id),
    KEY document_date (document_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. Update tabel rapat (tambah kolom status jika belum ada)
ALTER TABLE rapat ADD COLUMN IF NOT EXISTS status enum('active','inactive') DEFAULT 'active';

-- 14. Insert default global settings
INSERT IGNORE INTO global_settings (setting_key, setting_value) VALUES 
('dashboard_title', 'Suite Aplikasi Administrasi'),
('dashboard_subtitle', 'MI ALMAARIF 02 SINGOSARI'),
('logo_path', 'https://mia02sgs.sch.id/wp-content/uploads/2024/01/cropped-Tagline-1.png');

-- 15. Insert sample agenda data
INSERT IGNORE INTO agenda (agenda_date, description, is_holiday) VALUES 
('2025-08-17', 'Hari Kemerdekaan Indonesia', 1),
('2025-12-25', 'Hari Natal', 1);

-- 16. Insert sample holidays
INSERT IGNORE INTO holidays (holiday_date, holiday_name, source) VALUES 
('2025-08-17', 'Hari Kemerdekaan Indonesia', 'national'),
('2025-12-25', 'Hari Natal', 'national');

-- Selesai! Anda sekarang dapat login dengan:
-- Username: admin
-- Password: admin123
