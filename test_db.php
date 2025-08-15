<?php
/**
 * Test Database Connection
 * Akses file ini via browser untuk test koneksi database
 */

echo "<h2>🔍 Database Connection Test</h2>";

// Check config.php
if (!file_exists('config.php')) {
    echo "<p style='color: red;'>❌ File config.php tidak ditemukan!</p>";
    exit;
}

echo "<p style='color: green;'>✅ File config.php ditemukan</p>";
require_once 'config.php';

echo "<h3>📋 Database Configuration:</h3>";
echo "<ul>";
echo "<li><strong>Host:</strong> " . DB_HOST . "</li>";
echo "<li><strong>User:</strong> " . DB_USER . "</li>";
echo "<li><strong>Database:</strong> " . DB_NAME . "</li>";
echo "<li><strong>Charset:</strong> " . DB_CHARSET . "</li>";
echo "</ul>";

// Check mysqli extension
if (!extension_loaded('mysqli')) {
    echo "<p style='color: red;'>❌ MySQLi extension tidak tersedia!</p>";
    echo "<p><strong>Solusi:</strong></p>";
    echo "<ul>";
    echo "<li>Install PHP MySQLi: <code>sudo apt-get install php-mysqli</code></li>";
    echo "<li>Restart web server: <code>sudo systemctl restart apache2</code></li>";
    echo "</ul>";
    exit;
}

echo "<p style='color: green;'>✅ MySQLi extension tersedia</p>";

// Test database connection
echo "<h3>🔌 Testing Database Connection...</h3>";

$conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    echo "<p style='color: red;'>❌ Koneksi database gagal: " . htmlspecialchars($conn->connect_error) . "</p>";
    echo "<p><strong>Kemungkinan penyebab:</strong></p>";
    echo "<ul>";
    echo "<li>Database server tidak berjalan</li>";
    echo "<li>Username/password salah</li>";
    echo "<li>Database 'form_dinamis' belum dibuat</li>";
    echo "<li>Firewall memblokir koneksi</li>";
    echo "</ul>";
    exit;
}

echo "<p style='color: green;'>✅ Koneksi database berhasil!</p>";

// Test required tables
echo "<h3>📊 Checking Required Tables...</h3>";

$required_tables = [
    'sessions' => 'Session storage',
    'users' => 'User accounts', 
    'global_settings' => 'Application settings',
    'app_settings' => 'Form settings',
    'students' => 'Student data'
];

$missing_tables = [];
echo "<table border='1' style='border-collapse: collapse; width: 100%;'>";
echo "<tr><th>Table</th><th>Description</th><th>Status</th></tr>";

foreach ($required_tables as $table => $description) {
    $result = $conn->query("SHOW TABLES LIKE '$table'");
    $exists = $result && $result->num_rows > 0;
    
    echo "<tr>";
    echo "<td><strong>$table</strong></td>";
    echo "<td>$description</td>";
    
    if ($exists) {
        echo "<td style='color: green;'>✅ EXISTS</td>";
    } else {
        echo "<td style='color: red;'>❌ MISSING</td>";
        $missing_tables[] = $table;
    }
    echo "</tr>";
}
echo "</table>";

if (!empty($missing_tables)) {
    echo "<div style='background: #ffebee; padding: 15px; border-left: 4px solid #f44336; margin: 20px 0;'>";
    echo "<h3 style='color: #d32f2f;'>🚨 MISSING TABLES DETECTED!</h3>";
    echo "<p>Tables yang hilang: <strong>" . implode(', ', $missing_tables) . "</strong></p>";
    echo "<p><strong>Solusi:</strong></p>";
    echo "<ol>";
    echo "<li>Buka phpMyAdmin</li>";
    echo "<li>Pilih database 'form_dinamis'</li>";
    echo "<li>Import file 'setup_database.sql'</li>";
    echo "</ol>";
    echo "</div>";
} else {
    echo "<p style='color: green; font-size: 18px;'>🎉 <strong>Semua tabel sudah ada!</strong></p>";
    
    // Check admin user
    echo "<h3>👤 Checking Admin User...</h3>";
    $result = $conn->query("SELECT username, nama_lengkap, role FROM users WHERE role = 'admin' LIMIT 1");
    
    if ($result && $result->num_rows > 0) {
        $admin = $result->fetch_assoc();
        echo "<p style='color: green;'>✅ Admin user found: <strong>" . htmlspecialchars($admin['username']) . "</strong> (" . htmlspecialchars($admin['nama_lengkap']) . ")</p>";
        
        echo "<div style='background: #e8f5e8; padding: 15px; border-left: 4px solid #4caf50; margin: 20px 0;'>";
        echo "<h3 style='color: #2e7d32;'>🎉 DATABASE READY!</h3>";
        echo "<p>Anda dapat login dengan:</p>";
        echo "<ul>";
        echo "<li><strong>Username:</strong> admin</li>";
        echo "<li><strong>Password:</strong> admin123</li>";
        echo "</ul>";
        echo "<p><a href='login.html' style='background: #4caf50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;'>🚀 GO TO LOGIN</a></p>";
        echo "</div>";
    } else {
        echo "<p style='color: orange;'>⚠️ Admin user tidak ditemukan</p>";
        echo "<p>Jalankan query berikut di phpMyAdmin:</p>";
        echo "<pre style='background: #f5f5f5; padding: 10px; border-radius: 4px;'>";
        echo "INSERT INTO users (username, password, nama_lengkap, role) VALUES \n";
        echo "('admin', '\$2y\$10\$I0aDBx.71.g.j5k2L1J5HeR.l5IeozME43Q4J8B25I4Y0J8k.itS.', 'Administrator Utama', 'admin');";
        echo "</pre>";
    }
}

$conn->close();

echo "<hr>";
echo "<p><small>Test completed at: " . date('Y-m-d H:i:s') . "</small></p>";
?>
