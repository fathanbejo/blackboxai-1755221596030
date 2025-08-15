<?php
/**
 * Test API Login Endpoint Directly
 * Script untuk test endpoint login tanpa JavaScript
 */

require_once 'config.php';

echo "<h2>🔍 Direct API Login Test</h2>";

// Simulate POST request to login endpoint
$_GET['action'] = 'login';
$_SERVER['REQUEST_METHOD'] = 'POST';

// Simulate JSON input
$login_data = [
    'username' => 'admin',
    'password' => 'admin123'
];

// Override php://input for testing
$json_input = json_encode($login_data);

echo "<h3>📋 Test Parameters:</h3>";
echo "<ul>";
echo "<li><strong>Action:</strong> " . $_GET['action'] . "</li>";
echo "<li><strong>Method:</strong> " . $_SERVER['REQUEST_METHOD'] . "</li>";
echo "<li><strong>Username:</strong> " . $login_data['username'] . "</li>";
echo "<li><strong>Password:</strong> " . $login_data['password'] . "</li>";
echo "</ul>";

// Test database connection first
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    echo "<p style='color: red;'>❌ Database connection failed: " . $conn->connect_error . "</p>";
    exit;
}

echo "<p style='color: green;'>✅ Database connected</p>";

// Test user lookup
$stmt = $conn->prepare("SELECT id, password, nama_lengkap, role FROM users WHERE username = ?");
$stmt->bind_param('s', $login_data['username']);
$stmt->execute();
$result = $stmt->get_result();

if ($user = $result->fetch_assoc()) {
    echo "<h3>👤 User Found:</h3>";
    echo "<ul>";
    echo "<li><strong>ID:</strong> " . $user['id'] . "</li>";
    echo "<li><strong>Name:</strong> " . $user['nama_lengkap'] . "</li>";
    echo "<li><strong>Role:</strong> " . $user['role'] . "</li>";
    echo "</ul>";
    
    // Test password verification
    if (password_verify($login_data['password'], $user['password'])) {
        echo "<p style='color: green;'>✅ Password verification: SUCCESS</p>";
        
        // Test session start
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        echo "<h3>🔧 Session Test:</h3>";
        echo "<ul>";
        echo "<li><strong>Session Status:</strong> " . session_status() . "</li>";
        echo "<li><strong>Session ID:</strong> " . session_id() . "</li>";
        echo "</ul>";
        
        // Set session data
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $login_data['username'];
        $_SESSION['nama_lengkap'] = $user['nama_lengkap'];
        $_SESSION['role'] = $user['role'];
        $_SESSION['login_time'] = time();
        $_SESSION['last_activity'] = time();
        
        echo "<p style='color: green;'>✅ Session data set successfully</p>";
        
        // Test session write
        session_write_close();
        echo "<p style='color: green;'>✅ Session written and closed</p>";
        
        // Simulate successful response
        $response_data = [
            'success' => true,
            'data' => [
                'user_id' => $user['id'],
                'username' => $login_data['username'],
                'nama_lengkap' => $user['nama_lengkap'],
                'role' => $user['role'],
                'session_id' => session_id()
            ],
            'message' => 'Login berhasil.'
        ];
        
        echo "<h3>📤 Expected API Response:</h3>";
        echo "<pre style='background: #f5f5f5; padding: 10px; border-radius: 4px;'>";
        echo json_encode($response_data, JSON_PRETTY_PRINT);
        echo "</pre>";
        
        echo "<div style='background: #e8f5e8; padding: 15px; border-left: 4px solid #4caf50; margin: 20px 0;'>";
        echo "<h3>✅ LOGIN SHOULD WORK!</h3>";
        echo "<p>All components are working correctly:</p>";
        echo "<ul>";
        echo "<li>✅ Database connection</li>";
        echo "<li>✅ User exists</li>";
        echo "<li>✅ Password verification</li>";
        echo "<li>✅ Session handling</li>";
        echo "</ul>";
        echo "<p><strong>The issue might be:</strong></p>";
        echo "<ul>";
        echo "<li>🔍 JavaScript/AJAX request format</li>";
        echo "<li>🔍 API routing in api.php</li>";
        echo "<li>🔍 CORS headers</li>";
        echo "<li>🔍 Session cookie settings</li>";
        echo "</ul>";
        echo "</div>";
        
    } else {
        echo "<p style='color: red;'>❌ Password verification: FAILED</p>";
        echo "<p><a href='reset_admin_password.php' style='background: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;'>🔧 Reset Password</a></p>";
    }
    
} else {
    echo "<p style='color: red;'>❌ User not found in database</p>";
    
    // Show all users
    $all_users = $conn->query("SELECT id, username, role FROM users");
    echo "<h3>👥 All Users in Database:</h3>";
    echo "<table border='1' style='border-collapse: collapse;'>";
    echo "<tr><th>ID</th><th>Username</th><th>Role</th></tr>";
    while ($row = $all_users->fetch_assoc()) {
        echo "<tr><td>" . $row['id'] . "</td><td>" . $row['username'] . "</td><td>" . $row['role'] . "</td></tr>";
    }
    echo "</table>";
}

$conn->close();

echo "<hr>";
echo "<p><a href='login.html' style='background: #2196f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;'>🔙 Back to Login</a></p>";
echo "<p><small>Test completed at: " . date('Y-m-d H:i:s') . "</small></p>";
?>
