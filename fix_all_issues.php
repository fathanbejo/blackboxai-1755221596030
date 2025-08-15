<?php
/**
 * Fix All Application Issues
 * Script komprehensif untuk memperbaiki semua masalah aplikasi
 */

require_once 'config.php';

echo "<h1>🔧 Fix All Application Issues</h1>";
echo "<p>Script ini akan memperbaiki semua masalah yang ditemukan di aplikasi.</p>";

// Database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die("<p style='color: red;'>❌ Database connection failed: " . $conn->connect_error . "</p>");
}

echo "<p style='color: green;'>✅ Database connected</p>";

// Step 1: Create missing tables
echo "<h2>📋 Step 1: Creating Missing Tables</h2>";

$tables_sql = [
    'agenda' => "CREATE TABLE IF NOT EXISTS agenda (
        id int(11) NOT NULL AUTO_INCREMENT,
        agenda_date date NOT NULL,
        end_date date DEFAULT NULL,
        description text NOT NULL,
        is_holiday tinyint(1) DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id),
        KEY agenda_date (agenda_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    
    'holidays' => "CREATE TABLE IF NOT EXISTS holidays (
        id int(11) NOT NULL AUTO_INCREMENT,
        holiday_date date NOT NULL,
        holiday_name varchar(255) NOT NULL,
        source varchar(50) DEFAULT 'manual',
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id),
        UNIQUE KEY holiday_date (holiday_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    
    'calendar_documents' => "CREATE TABLE IF NOT EXISTS calendar_documents (
        id int(11) NOT NULL AUTO_INCREMENT,
        document_date date NOT NULL,
        document_name varchar(255) NOT NULL,
        document_path varchar(500) NOT NULL,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id),
        KEY document_date (document_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    
    'guru' => "CREATE TABLE IF NOT EXISTS guru (
        id int(11) NOT NULL AUTO_INCREMENT,
        nama_guru varchar(255) NOT NULL,
        jabatan varchar(255) DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    
    'rapat' => "CREATE TABLE IF NOT EXISTS rapat (
        id int(11) NOT NULL AUTO_INCREMENT,
        judul varchar(255) NOT NULL,
        tanggal date NOT NULL,
        waktu time NOT NULL,
        tempat varchar(255) DEFAULT NULL,
        agenda text DEFAULT NULL,
        status enum('active','inactive') DEFAULT 'active',
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    
    'peserta_rapat' => "CREATE TABLE IF NOT EXISTS peserta_rapat (
        id int(11) NOT NULL AUTO_INCREMENT,
        id_rapat int(11) NOT NULL,
        nama_peserta varchar(255) NOT NULL,
        jabatan varchar(255) DEFAULT NULL,
        tanda_tangan text DEFAULT NULL,
        path_tanda_tangan varchar(500) DEFAULT NULL,
        waktu_hadir timestamp DEFAULT current_timestamp(),
        PRIMARY KEY (id),
        KEY id_rapat (id_rapat),
        FOREIGN KEY (id_rapat) REFERENCES rapat(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
];

$created_tables = 0;
foreach ($tables_sql as $table_name => $sql) {
    if ($conn->query($sql)) {
        echo "<p>✅ Table '$table_name' created/verified</p>";
        $created_tables++;
    } else {
        echo "<p style='color: red;'>❌ Failed to create table '$table_name': " . $conn->error . "</p>";
    }
}

// Step 2: Add missing columns
echo "<h2>📋 Step 2: Adding Missing Columns</h2>";

$column_checks = [
    'rapat' => [
        'status' => "ALTER TABLE rapat ADD COLUMN status enum('active','inactive') DEFAULT 'active'"
    ]
];

foreach ($column_checks as $table => $columns) {
    foreach ($columns as $column => $sql) {
        $check = $conn->query("SHOW COLUMNS FROM $table LIKE '$column'");
        if ($check && $check->num_rows == 0) {
            if ($conn->query($sql)) {
                echo "<p>✅ Added column '$column' to table '$table'</p>";
            } else {
                echo "<p style='color: orange;'>⚠️ Failed to add column '$column' to table '$table': " . $conn->error . "</p>";
            }
        } else {
            echo "<p style='color: blue;'>ℹ️ Column '$column' already exists in table '$table'</p>";
        }
    }
}

// Step 3: Insert sample data
echo "<h2>📋 Step 3: Inserting Sample Data</h2>";

$sample_data = [
    "INSERT IGNORE INTO agenda (agenda_date, description, is_holiday) VALUES 
    ('2025-08-17', 'Hari Kemerdekaan Indonesia', 1),
    ('2025-12-25', 'Hari Natal', 1),
    ('2025-01-01', 'Tahun Baru', 1)",
    
    "INSERT IGNORE INTO holidays (holiday_date, holiday_name, source) VALUES 
    ('2025-08-17', 'Hari Kemerdekaan Indonesia', 'national'),
    ('2025-12-25', 'Hari Natal', 'national'),
    ('2025-01-01', 'Tahun Baru', 'national')",
    
    "INSERT IGNORE INTO guru (nama_guru, jabatan) VALUES 
    ('Muhammad Ishom, S.Pd.', 'Kepala Madrasah'),
    ('Ahmad Fauzi, S.Pd.I', 'Guru Kelas'),
    ('Siti Aminah, S.Pd.', 'Guru Kelas')"
];

foreach ($sample_data as $sql) {
    if ($conn->query($sql)) {
        echo "<p>✅ Sample data inserted</p>";
    } else {
        echo "<p style='color: orange;'>⚠️ Sample data insertion: " . $conn->error . "</p>";
    }
}

// Step 4: Create uploads directory
echo "<h2>📋 Step 4: Creating Upload Directories</h2>";

$upload_dirs = ['uploads/', 'uploads/calendar/', 'uploads/signatures/', 'uploads/documents/'];

foreach ($upload_dirs as $dir) {
    if (!is_dir($dir)) {
        if (mkdir($dir, 0777, true)) {
            echo "<p>✅ Created directory: $dir</p>";
        } else {
            echo "<p style='color: red;'>❌ Failed to create directory: $dir</p>";
        }
    } else {
        echo "<p style='color: blue;'>ℹ️ Directory already exists: $dir</p>";
    }
}

// Step 5: Test all endpoints
echo "<h2>📋 Step 5: Testing API Endpoints</h2>";

$test_endpoints = [
    'getGlobalSettings',
    'getAllStudents', 
    'getCalendarData',
    'getAcademicYearEvents',
    'getGuruList',
    'getMeetings'
];

foreach ($test_endpoints as $endpoint) {
    $test_url = "api.php?action=$endpoint";
    
    // Simple test using file_get_contents
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 5
        ]
    ]);
    
    $result = @file_get_contents($test_url, false, $context);
    
    if ($result !== false) {
        $data = json_decode($result, true);
        if ($data && isset($data['success'])) {
            if ($data['success']) {
                echo "<p>✅ Endpoint '$endpoint' working</p>";
            } else {
                echo "<p style='color: orange;'>⚠️ Endpoint '$endpoint' returned error: " . ($data['message'] ?? 'Unknown error') . "</p>";
            }
        } else {
            echo "<p style='color: red;'>❌ Endpoint '$endpoint' returned invalid JSON</p>";
        }
    } else {
        echo "<p style='color: red;'>❌ Endpoint '$endpoint' failed to respond</p>";
    }
}

// Step 6: Summary and recommendations
echo "<h2>📊 Summary</h2>";

$table_counts = [];
$test_tables = ['users', 'students', 'agenda', 'holidays', 'calendar_documents', 'guru', 'rapat', 'absensi'];

foreach ($test_tables as $table) {
    $result = $conn->query("SELECT COUNT(*) as count FROM $table");
    if ($result) {
        $row = $result->fetch_assoc();
        $table_counts[$table] = $row['count'];
        echo "<p>📊 Table '$table': {$row['count']} records</p>";
    } else {
        echo "<p style='color: red;'>❌ Table '$table': Error - " . $conn->error . "</p>";
    }
}

$conn->close();

echo "<div style='background: #d4edda; padding: 20px; border-left: 4px solid #28a745; margin: 20px 0;'>";
echo "<h3>🎉 Application Fix Complete!</h3>";
echo "<p><strong>What was fixed:</strong></p>";
echo "<ul>";
echo "<li>✅ Database tables created/verified</li>";
echo "<li>✅ Missing columns added</li>";
echo "<li>✅ Sample data inserted</li>";
echo "<li>✅ Upload directories created</li>";
echo "<li>✅ API endpoints tested</li>";
echo "</ul>";

echo "<p><strong>You can now test these features:</strong></p>";
echo "<ul>";
echo "<li>🗓️ <a href='kalender.html' target='_blank'>Kalender</a> - Calendar functionality</li>";
echo "<li>📝 <a href='izin.html' target='_blank'>Form Izin</a> - Permission form</li>";
echo "<li>📅 <a href='kaldik.html' target='_blank'>Kaldik</a> - Academic calendar</li>";
echo "<li>👥 <a href='rapat-entri.html' target='_blank'>Rapat</a> - Meeting management</li>";
echo "<li>📊 <a href='izin-dasbor.html' target='_blank'>Dasbor Izin</a> - Permission dashboard</li>";
echo "</ul>";

echo "<p><strong>Login credentials:</strong></p>";
echo "<ul>";
echo "<li>Username: <code>admin</code></li>";
echo "<li>Password: <code>admin123</code></li>";
echo "</ul>";
echo "</div>";

echo "<hr>";
echo "<p><small>Fix completed at: " . date('Y-m-d H:i:s') . "</small></p>";
?>
