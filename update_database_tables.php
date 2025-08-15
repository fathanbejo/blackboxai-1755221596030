<?php
/**
 * Update Database Tables untuk Kalender, Agenda, dan Rapat
 * Jalankan script ini untuk menambahkan tabel yang diperlukan
 */

require_once 'config.php';

echo "<h2>🔧 Update Database Tables</h2>";

// Database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die("<p style='color: red;'>❌ Database connection failed: " . $conn->connect_error . "</p>");
}

echo "<p style='color: green;'>✅ Database connected</p>";

// Array of SQL commands to execute
$sql_commands = [
    // Tabel agenda
    "CREATE TABLE IF NOT EXISTS agenda (
        id int(11) NOT NULL AUTO_INCREMENT,
        agenda_date date NOT NULL,
        end_date date DEFAULT NULL,
        description text NOT NULL,
        is_holiday tinyint(1) DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id),
        KEY agenda_date (agenda_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    
    // Tabel holidays
    "CREATE TABLE IF NOT EXISTS holidays (
        id int(11) NOT NULL AUTO_INCREMENT,
        holiday_date date NOT NULL,
        holiday_name varchar(255) NOT NULL,
        source varchar(50) DEFAULT 'manual',
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id),
        UNIQUE KEY holiday_date (holiday_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    
    // Tabel calendar_documents
    "CREATE TABLE IF NOT EXISTS calendar_documents (
        id int(11) NOT NULL AUTO_INCREMENT,
        document_date date NOT NULL,
        document_name varchar(255) NOT NULL,
        document_path varchar(500) NOT NULL,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (id),
        KEY document_date (document_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    
    // Sample agenda data
    "INSERT IGNORE INTO agenda (agenda_date, description, is_holiday) VALUES 
    ('2025-08-17', 'Hari Kemerdekaan Indonesia', 1),
    ('2025-12-25', 'Hari Natal', 1)",
    
    // Sample holidays
    "INSERT IGNORE INTO holidays (holiday_date, holiday_name, source) VALUES 
    ('2025-08-17', 'Hari Kemerdekaan Indonesia', 'national'),
    ('2025-12-25', 'Hari Natal', 'national')"
];

$success_count = 0;
$error_count = 0;

echo "<h3>📋 Executing SQL Commands:</h3>";
echo "<div style='font-family: monospace; background: #f8f9fa; padding: 15px; border-radius: 4px;'>";

foreach ($sql_commands as $index => $sql) {
    $command_num = $index + 1;
    echo "<p><strong>Command $command_num:</strong></p>";
    
    if ($conn->query($sql)) {
        echo "<p style='color: green;'>✅ Success</p>";
        $success_count++;
    } else {
        echo "<p style='color: red;'>❌ Error: " . $conn->error . "</p>";
        $error_count++;
    }
    echo "<hr style='margin: 10px 0;'>";
}

echo "</div>";

// Check if rapat table needs status column
echo "<h3>🔍 Checking rapat table:</h3>";
$check_rapat = $conn->query("SHOW COLUMNS FROM rapat LIKE 'status'");
if ($check_rapat && $check_rapat->num_rows == 0) {
    echo "<p>Adding status column to rapat table...</p>";
    if ($conn->query("ALTER TABLE rapat ADD COLUMN status enum('active','inactive') DEFAULT 'active'")) {
        echo "<p style='color: green;'>✅ Status column added to rapat table</p>";
        $success_count++;
    } else {
        echo "<p style='color: red;'>❌ Failed to add status column: " . $conn->error . "</p>";
        $error_count++;
    }
} else {
    echo "<p style='color: blue;'>ℹ️ Status column already exists in rapat table</p>";
}

// Summary
echo "<div style='background: " . ($error_count > 0 ? '#fff3cd' : '#d4edda') . "; padding: 15px; border-left: 4px solid " . ($error_count > 0 ? '#ffc107' : '#28a745') . "; margin: 20px 0;'>";
echo "<h3>📊 Summary:</h3>";
echo "<ul>";
echo "<li><strong>Successful operations:</strong> $success_count</li>";
echo "<li><strong>Failed operations:</strong> $error_count</li>";
echo "</ul>";

if ($error_count == 0) {
    echo "<p style='color: green; font-weight: bold;'>🎉 All database updates completed successfully!</p>";
    echo "<p>Your application should now work properly with:</p>";
    echo "<ul>";
    echo "<li>✅ Kalender functionality</li>";
    echo "<li>✅ Agenda management</li>";
    echo "<li>✅ Holiday management</li>";
    echo "<li>✅ Document upload</li>";
    echo "<li>✅ Meeting management</li>";
    echo "</ul>";
} else {
    echo "<p style='color: orange; font-weight: bold;'>⚠️ Some operations failed. Please check the errors above.</p>";
}
echo "</div>";

// Test the new tables
echo "<h3>🧪 Testing New Tables:</h3>";
$test_tables = ['agenda', 'holidays', 'calendar_documents'];

foreach ($test_tables as $table) {
    $result = $conn->query("SELECT COUNT(*) as count FROM $table");
    if ($result) {
        $row = $result->fetch_assoc();
        echo "<p>✅ Table '$table': " . $row['count'] . " records</p>";
    } else {
        echo "<p>❌ Table '$table': Error - " . $conn->error . "</p>";
    }
}

$conn->close();

echo "<hr>";
echo "<p><a href='kalender.html' style='background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin: 5px;'>🗓️ Test Kalender</a></p>";
echo "<p><a href='izin.html' style='background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin: 5px;'>📝 Test Form Izin</a></p>";
echo "<p><a href='kaldik.html' style='background: #17a2b8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin: 5px;'>📅 Test Kaldik</a></p>";
echo "<p><a href='rapat-entri.html' style='background: #6f42c1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin: 5px;'>👥 Test Rapat</a></p>";

echo "<p><small>Update completed at: " . date('Y-m-d H:i:s') . "</small></p>";
?>
