<?php
/**
 * Script Setup Database untuk Suite Aplikasi
 * Jalankan sekali untuk membuat semua tabel yang diperlukan
 */

require_once 'config.php';

// Koneksi database
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die("Koneksi database gagal: " . $conn->connect_error);
}

echo "Memulai setup database...\n";

// 1. Tabel sessions
$sql_sessions = "CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(128) NOT NULL PRIMARY KEY,
    data TEXT,
    expires DATETIME NOT NULL,
    INDEX idx_expires (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

if ($conn->query($sql_sessions)) {
    echo "✅ Tabel 'sessions' berhasil dibuat/diverifikasi\n";
} else {
    echo "❌ Error membuat tabel 'sessions': " . $conn->error . "\n";
}

// 2. Tabel users
$sql_users = "CREATE TABLE IF NOT EXISTS users (
    id int(11) NOT NULL AUTO_INCREMENT,
    username varchar(50) NOT NULL,
    password varchar(255) NOT NULL,
    nama_lengkap varchar(100) DEFAULT NULL,
    role enum('admin','operator','user') NOT NULL DEFAULT 'user',
    created_at timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (id),
    UNIQUE KEY username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

if ($conn->query($sql_users)) {
    echo "✅ Tabel 'users' berhasil dibuat/diverifikasi\n";
} else {
    echo "❌ Error membuat tabel 'users': " . $conn->error . "\n";
}

// 3. Tabel global_settings
$sql_global_settings = "CREATE TABLE IF NOT EXISTS global_settings (
    id int(11) NOT NULL AUTO_INCREMENT,
    setting_key varchar(100) NOT NULL,
    setting_value TEXT,
    created_at timestamp NOT NULL DEFAULT current_timestamp(),
    updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (id),
    UNIQUE KEY setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

if ($conn->query($sql_global_settings)) {
    echo "✅ Tabel 'global_settings' berhasil dibuat/diverifikasi\n";
} else {
    echo "❌ Error membuat tabel 'global_settings': " . $conn->error . "\n";
}

// 4. Tabel app_settings
$sql_app_settings = "CREATE TABLE IF NOT EXISTS app_settings (
    id int(11) NOT NULL AUTO_INCREMENT,
    setting_key varchar(100) NOT NULL,
    setting_value LONGTEXT,
    created_at timestamp NOT NULL DEFAULT current_timestamp(),
    updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (id),
    UNIQUE KEY setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

if ($conn->query($sql_app_settings)) {
    echo "✅ Tabel 'app_settings' berhasil dibuat/diverifikasi\n";
} else {
    echo "❌ Error membuat tabel 'app_settings': " . $conn->error . "\n";
}

// 5. Tabel students (jika belum ada)
$sql_students = "CREATE TABLE IF NOT EXISTS students (
    id int(11) NOT NULL AUTO_INCREMENT,
    ID_SISWA int(11) NOT NULL,
    NAMA varchar(255) NOT NULL,
    ROMBEL varchar(50) DEFAULT NULL,
    KELAS_BILQOLAM varchar(50) DEFAULT NULL,
    Tanggal_Update_Terakhir timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (id),
    UNIQUE KEY ID_SISWA (ID_SISWA)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

if ($conn->query($sql_students)) {
    echo "✅ Tabel 'students' berhasil dibuat/diverifikasi\n";
} else {
    echo "❌ Error membuat tabel 'students': " . $conn->error . "\n";
}

// 6. Tabel absensi
$sql_absensi = "CREATE TABLE IF NOT EXISTS absensi (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

if ($conn->query($sql_absensi)) {
    echo "✅ Tabel 'absensi' berhasil dibuat/diverifikasi\n";
} else {
    echo "❌ Error membuat tabel 'absensi': " . $conn->error . "\n";
}

// 7. Tabel guru
$sql_guru = "CREATE TABLE IF NOT EXISTS guru (
    id int(11) NOT NULL AUTO_INCREMENT,
    nama_guru varchar(255) NOT NULL,
    jabatan varchar(100) DEFAULT NULL,
    created_at timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

if ($conn->query($sql_guru)) {
    echo "✅ Tabel 'guru' berhasil dibuat/diverifikasi\n";
} else {
    echo "❌ Error membuat tabel 'guru': " . $conn->error . "\n";
}

// 8. Tabel rapat
$sql_rapat = "CREATE TABLE IF NOT EXISTS rapat (
    id int(11) NOT NULL AUTO_INCREMENT,
    judul varchar(255) NOT NULL,
    tanggal date NOT NULL,
    waktu time NOT NULL,
    tempat varchar(255) DEFAULT NULL,
    agenda text,
    path_dokumentasi text,
    created_at timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

if ($conn->query($sql_rapat)) {
    echo "✅ Tabel 'rapat' berhasil dibuat/diverifikasi\n";
} else {
    echo "❌ Error membuat tabel 'rapat': " . $conn->error . "\n";
}

// 9. Tabel peserta_rapat
$sql_peserta_rapat = "CREATE TABLE IF NOT EXISTS peserta_rapat (
    id int(11) NOT NULL AUTO_INCREMENT,
    id_rapat int(11) NOT NULL,
    nama varchar(255) NOT NULL,
    jabatan varchar(100) DEFAULT NULL,
    hadir enum('ya','tidak') NOT NULL DEFAULT 'ya',
    path_tanda_tangan varchar(500) DEFAULT NULL,
    created_at timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (id),
    KEY id_rapat (id_rapat)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

if ($conn->query($sql_peserta_rapat)) {
    echo "✅ Tabel 'peserta_rapat' berhasil dibuat/diverifikasi\n";
} else {
    echo "❌ Error membuat tabel 'peserta_rapat': " . $conn->error . "\n";
}

// 10. Buat user admin default jika belum ada
$admin_check = $conn->query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
if ($admin_check->num_rows == 0) {
    $default_username = 'admin';
    $default_password_hash = password_hash('admin123', PASSWORD_DEFAULT);
    $default_full_name = 'Administrator Utama';
    $default_role = 'admin';

    $stmt = $conn->prepare("INSERT INTO users (username, password, nama_lengkap, role) VALUES (?, ?, ?, ?)");
    $stmt->bind_param('ssss', $default_username, $default_password_hash, $default_full_name, $default_role);
    
    if ($stmt->execute()) {
        echo "✅ User admin default berhasil dibuat (username: admin, password: admin123)\n";
    } else {
        echo "❌ Error membuat user admin: " . $stmt->error . "\n";
    }
} else {
    echo "✅ User admin sudah ada\n";
}

// 11. Insert default global settings
$default_settings = [
    'dashboard_title' => 'Suite Aplikasi Administrasi',
    'dashboard_subtitle' => 'MI ALMAARIF 02 SINGOSARI',
    'logo_path' => 'https://mia02sgs.sch.id/wp-content/uploads/2024/01/cropped-Tagline-1.png'
];

foreach ($default_settings as $key => $value) {
    $check = $conn->prepare("SELECT id FROM global_settings WHERE setting_key = ?");
    $check->bind_param('s', $key);
    $check->execute();
    $result = $check->get_result();
    
    if ($result->num_rows == 0) {
        $insert = $conn->prepare("INSERT INTO global_settings (setting_key, setting_value) VALUES (?, ?)");
        $insert->bind_param('ss', $key, $value);
        if ($insert->execute()) {
            echo "✅ Setting '$key' berhasil ditambahkan\n";
        }
    }
}

echo "\n🎉 Setup database selesai!\n";
echo "Anda sekarang dapat login dengan:\n";
echo "Username: admin\n";
echo "Password: admin123\n";

$conn->close();
?>
