<?php
/**
 * Debug Login Process
 * Akses file ini untuk debug masalah login
 */

header("Content-Type: application/json; charset=UTF-8");

require_once 'config.php';

// Test database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die(json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]));
}

// Test login dengan credentials yang sama
$username = 'admin';
$password = 'admin123';

echo json_encode([
    'step1_db_connection' => 'OK',
    'step2_testing_user' => $username
]);

// Check if user exists
$stmt = $conn->prepare("SELECT id, username, password, nama_lengkap, role FROM users WHERE username = ?");
$stmt->bind_param('s', $username);
$stmt->execute();
$result = $stmt->get_result();

if ($user = $result->fetch_assoc()) {
    echo json_encode([
        'step3_user_found' => 'YES',
        'user_id' => $user['id'],
        'username' => $user['username'],
        'role' => $user['role'],
        'nama_lengkap' => $user['nama_lengkap'],
        'password_hash_in_db' => substr($user['password'], 0, 20) . '...'
    ]);
    
    // Test password verification
    $password_valid = password_verify($password, $user['password']);
    
    echo json_encode([
        'step4_password_test' => $password_valid ? 'VALID' : 'INVALID',
        'test_password' => $password,
        'hash_algorithm' => password_get_info($user['password'])
    ]);
    
    if ($password_valid) {
        // Test session start
        session_start();
        $_SESSION['test'] = 'working';
        
        echo json_encode([
            'step5_session_test' => 'OK',
            'session_id' => session_id(),
            'session_status' => session_status(),
            'session_save_path' => session_save_path()
        ]);
    }
    
} else {
    echo json_encode([
        'step3_user_found' => 'NO',
        'error' => 'User admin not found in database'
    ]);
    
    // Show all users for debugging
    $all_users = $conn->query("SELECT id, username, role FROM users");
    $users_list = [];
    while ($row = $all_users->fetch_assoc()) {
        $users_list[] = $row;
    }
    
    echo json_encode([
        'all_users_in_db' => $users_list
    ]);
}

$conn->close();
?>
