<?php
/**
 * Reset Admin Password
 * Script untuk reset password admin jika ada masalah dengan hash
 */

require_once 'config.php';

echo "<h2>🔧 Reset Admin Password</h2>";

// Database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die("<p style='color: red;'>❌ Database connection failed: " . $conn->connect_error . "</p>");
}

echo "<p style='color: green;'>✅ Database connected</p>";

// Check current admin user
$stmt = $conn->prepare("SELECT id, username, password, nama_lengkap, role FROM users WHERE username = 'admin'");
$stmt->execute();
$result = $stmt->get_result();

if ($user = $result->fetch_assoc()) {
    echo "<h3>📋 Current Admin User:</h3>";
    echo "<ul>";
    echo "<li><strong>ID:</strong> " . $user['id'] . "</li>";
    echo "<li><strong>Username:</strong> " . $user['username'] . "</li>";
    echo "<li><strong>Name:</strong> " . $user['nama_lengkap'] . "</li>";
    echo "<li><strong>Role:</strong> " . $user['role'] . "</li>";
    echo "<li><strong>Current Hash:</strong> " . substr($user['password'], 0, 30) . "...</li>";
    echo "</ul>";
    
    // Test current password
    $test_password = 'admin123';
    $is_valid = password_verify($test_password, $user['password']);
    
    echo "<h3>🔍 Password Test:</h3>";
    echo "<p>Testing password '<strong>admin123</strong>': ";
    if ($is_valid) {
        echo "<span style='color: green;'>✅ VALID</span></p>";
        echo "<div style='background: #e8f5e8; padding: 15px; border-left: 4px solid #4caf50;'>";
        echo "<h3>✅ Password is correct!</h3>";
        echo "<p>The issue might be elsewhere. Check:</p>";
        echo "<ul>";
        echo "<li>Session configuration</li>";
        echo "<li>API endpoint routing</li>";
        echo "<li>JavaScript errors</li>";
        echo "</ul>";
        echo "</div>";
    } else {
        echo "<span style='color: red;'>❌ INVALID</span></p>";
        
        // Generate new password hash
        $new_hash = password_hash($test_password, PASSWORD_DEFAULT);
        
        echo "<h3>🔧 Generating New Password Hash:</h3>";
        echo "<p><strong>New Hash:</strong> " . substr($new_hash, 0, 50) . "...</p>";
        
        // Update password
        $update_stmt = $conn->prepare("UPDATE users SET password = ? WHERE username = 'admin'");
        $update_stmt->bind_param('s', $new_hash);
        
        if ($update_stmt->execute()) {
            echo "<div style='background: #e8f5e8; padding: 15px; border-left: 4px solid #4caf50;'>";
            echo "<h3>✅ Password Updated Successfully!</h3>";
            echo "<p>You can now login with:</p>";
            echo "<ul>";
            echo "<li><strong>Username:</strong> admin</li>";
            echo "<li><strong>Password:</strong> admin123</li>";
            echo "</ul>";
            echo "<p><a href='login.html' style='background: #4caf50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;'>🚀 Try Login Now</a></p>";
            echo "</div>";
            
            // Verify the new password
            $verify_stmt = $conn->prepare("SELECT password FROM users WHERE username = 'admin'");
            $verify_stmt->execute();
            $verify_result = $verify_stmt->get_result();
            $verify_user = $verify_result->fetch_assoc();
            
            $verify_test = password_verify($test_password, $verify_user['password']);
            echo "<p><strong>Verification:</strong> ";
            if ($verify_test) {
                echo "<span style='color: green;'>✅ New password works!</span></p>";
            } else {
                echo "<span style='color: red;'>❌ New password verification failed!</span></p>";
            }
            
        } else {
            echo "<p style='color: red;'>❌ Failed to update password: " . $update_stmt->error . "</p>";
        }
    }
    
} else {
    echo "<p style='color: red;'>❌ Admin user not found!</p>";
    
    // Create admin user
    echo "<h3>🔧 Creating Admin User...</h3>";
    
    $username = 'admin';
    $password_hash = password_hash('admin123', PASSWORD_DEFAULT);
    $nama_lengkap = 'Administrator Utama';
    $role = 'admin';
    
    $create_stmt = $conn->prepare("INSERT INTO users (username, password, nama_lengkap, role) VALUES (?, ?, ?, ?)");
    $create_stmt->bind_param('ssss', $username, $password_hash, $nama_lengkap, $role);
    
    if ($create_stmt->execute()) {
        echo "<div style='background: #e8f5e8; padding: 15px; border-left: 4px solid #4caf50;'>";
        echo "<h3>✅ Admin User Created!</h3>";
        echo "<p>Login credentials:</p>";
        echo "<ul>";
        echo "<li><strong>Username:</strong> admin</li>";
        echo "<li><strong>Password:</strong> admin123</li>";
        echo "</ul>";
        echo "<p><a href='login.html' style='background: #4caf50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;'>🚀 Try Login Now</a></p>";
        echo "</div>";
    } else {
        echo "<p style='color: red;'>❌ Failed to create admin user: " . $create_stmt->error . "</p>";
    }
}

$conn->close();

echo "<hr>";
echo "<p><small>Reset completed at: " . date('Y-m-d H:i:s') . "</small></p>";
?>
