<?php
/**
 * Script untuk mengecek status database dan tabel
 */

// Nonaktifkan output buffering untuk real-time output
ob_implicit_flush(true);
ob_end_flush();

echo "=== CHECKING DATABASE STATUS ===\n\n";

// Check config.php
if (!file_exists('config.php')) {
    echo "❌ File config.php tidak ditemukan!\n";
    exit(1);
}

echo "✅ File config.php ditemukan\n";
require_once 'config.php';

// Check database connection
echo "🔍 Mengecek koneksi database...\n";
echo "Host: " . DB_HOST . "\n";
echo "User: " . DB_USER . "\n";
echo "Database: " . DB_NAME . "\n\n";

// Coba koneksi tanpa mysqli (karena tidak tersedia)
// Kita akan menggunakan PDO sebagai alternatif
try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "✅ Koneksi database berhasil!\n\n";
} catch (PDOException $e) {
    echo "❌ Koneksi database gagal: " . $e->getMessage() . "\n";
    echo "\n🔧 SOLUSI:\n";
    echo "1. Periksa kredensial database di config.php\n";
    echo "2. Pastikan database server berjalan\n";
    echo "3. Pastikan database 'form_dinamis' sudah dibuat\n";
    exit(1);
}

// Check required tables
$required_tables = [
    'sessions',
    'users', 
    'global_settings',
    'app_settings',
    'students',
    'absensi',
    'guru',
    'rapat',
    'peserta_rapat'
];

echo "🔍 Mengecek tabel yang diperlukan...\n";
$missing_tables = [];

foreach ($required_tables as $table) {
    try {
        $stmt = $pdo->query("SHOW TABLES LIKE '$table'");
        if ($stmt->rowCount() > 0) {
            echo "✅ Tabel '$table' ada\n";
        } else {
            echo "❌ Tabel '$table' TIDAK ADA\n";
            $missing_tables[] = $table;
        }
    } catch (PDOException $e) {
        echo "❌ Error checking table '$table': " . $e->getMessage() . "\n";
        $missing_tables[] = $table;
    }
}

if (!empty($missing_tables)) {
    echo "\n🚨 MASALAH DITEMUKAN!\n";
    echo "Tabel yang hilang: " . implode(', ', $missing_tables) . "\n\n";
    echo "🔧 SOLUSI:\n";
    echo "1. Jalankan script setup_database.sql di database Anda\n";
    echo "2. Atau gunakan phpMyAdmin untuk import script SQL\n";
    echo "3. Atau jalankan perintah: mysql -u " . DB_USER . " -p " . DB_NAME . " < setup_database.sql\n\n";
} else {
    echo "\n✅ Semua tabel sudah ada!\n";
    
    // Check admin user
    echo "\n🔍 Mengecek user admin...\n";
    try {
        $stmt = $pdo->query("SELECT username, nama_lengkap, role FROM users WHERE role = 'admin' LIMIT 1");
        if ($stmt->rowCount() > 0) {
            $admin = $stmt->fetch(PDO::FETCH_ASSOC);
            echo "✅ User admin ditemukan: " . $admin['username'] . " (" . $admin['nama_lengkap'] . ")\n";
        } else {
            echo "❌ User admin tidak ditemukan!\n";
            echo "🔧 Menambahkan user admin default...\n";
            
            $username = 'admin';
            $password_hash = password_hash('admin123', PASSWORD_DEFAULT);
            $nama_lengkap = 'Administrator Utama';
            $role = 'admin';
            
            $stmt = $pdo->prepare("INSERT INTO users (username, password, nama_lengkap, role) VALUES (?, ?, ?, ?)");
            if ($stmt->execute([$username, $password_hash, $nama_lengkap, $role])) {
                echo "✅ User admin berhasil ditambahkan!\n";
                echo "   Username: admin\n";
                echo "   Password: admin123\n";
            } else {
                echo "❌ Gagal menambahkan user admin\n";
            }
        }
    } catch (PDOException $e) {
        echo "❌ Error checking admin user: " . $e->getMessage() . "\n";
    }
    
    // Check global settings
    echo "\n🔍 Mengecek global settings...\n";
    try {
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM global_settings");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($result['count'] > 0) {
            echo "✅ Global settings ada (" . $result['count'] . " entries)\n";
        } else {
            echo "⚠️  Global settings kosong, menambahkan default settings...\n";
            
            $default_settings = [
                ['dashboard_title', 'Suite Aplikasi Administrasi'],
                ['dashboard_subtitle', 'MI ALMAARIF 02 SINGOSARI'],
                ['logo_path', 'https://mia02sgs.sch.id/wp-content/uploads/2024/01/cropped-Tagline-1.png']
            ];
            
            $stmt = $pdo->prepare("INSERT INTO global_settings (setting_key, setting_value) VALUES (?, ?)");
            foreach ($default_settings as $setting) {
                $stmt->execute($setting);
            }
            echo "✅ Default settings berhasil ditambahkan\n";
        }
    } catch (PDOException $e) {
        echo "❌ Error checking global settings: " . $e->getMessage() . "\n";
    }
}

echo "\n=== STATUS CHECK SELESAI ===\n";

if (empty($missing_tables)) {
    echo "\n🎉 DATABASE SIAP DIGUNAKAN!\n";
    echo "Anda dapat login dengan:\n";
    echo "Username: admin\n";
    echo "Password: admin123\n";
} else {
    echo "\n⚠️  DATABASE BELUM SIAP!\n";
    echo "Silakan jalankan setup_database.sql terlebih dahulu.\n";
}
?>
