<?php
/**
 * Simplified API for testing login without complex session handler
 */

// Basic error handling
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Set JSON header
header("Content-Type: application/json; charset=UTF-8");

// CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Load config
if (!file_exists('config.php')) {
    http_response_code(500);
    die(json_encode(['success' => false, 'message' => 'Config file not found']));
}
require_once 'config.php';

// Database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    die(json_encode(['success' => false, 'message' => 'Database connection failed: ' . $conn->connect_error]));
}

// Use simple file-based sessions instead of database
session_start();

// Helper functions
function send_response($success, $data = null, $message = '', $http_code = null) {
    if ($http_code) {
        http_response_code($http_code);
    } else {
        http_response_code($success ? 200 : 400);
    }
    echo json_encode(['success' => $success, 'data' => $data, 'message' => $message]);
    exit();
}

function get_post_data() {
    $data = json_decode(file_get_contents('php://input'), true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        send_response(false, null, 'Invalid JSON in request body.');
    }
    return $data;
}

// Get action
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Log the request for debugging
error_log("API Request: $method $action");

try {
    switch ($action) {
        case 'login':
            error_log("Processing login request");
            
            $data = get_post_data();
            $username = $data['username'] ?? '';
            $password = $data['password'] ?? '';
            
            error_log("Login attempt for user: $username");
            
            if (empty($username) || empty($password)) {
                error_log("Login failed: Empty username or password");
                send_response(false, null, 'Username dan password harus diisi.', 400);
            }
            
            $stmt = $conn->prepare("SELECT id, password, nama_lengkap, role FROM users WHERE username = ?");
            if (!$stmt) {
                error_log("Login failed: Prepare statement error - " . $conn->error);
                send_response(false, null, 'Database error', 500);
            }
            
            $stmt->bind_param('s', $username);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($user = $result->fetch_assoc()) {
                error_log("User found: " . $user['username']);
                
                if (password_verify($password, $user['password'])) {
                    error_log("Password verified successfully");
                    
                    // Regenerate session ID for security
                    session_regenerate_id(true);
                    
                    // Set session data
                    $_SESSION['user_id'] = $user['id'];
                    $_SESSION['username'] = $username;
                    $_SESSION['nama_lengkap'] = $user['nama_lengkap'];
                    $_SESSION['role'] = $user['role'];
                    $_SESSION['login_time'] = time();
                    $_SESSION['last_activity'] = time();
                    
                    error_log("Session data set for user: $username (ID: {$user['id']})");
                    
                    $user_data_for_client = [
                        'user_id' => $user['id'],
                        'username' => $username,
                        'nama_lengkap' => $user['nama_lengkap'],
                        'role' => $user['role'],
                        'session_id' => session_id()
                    ];
                    
                    error_log("Login successful for user: $username");
                    send_response(true, $user_data_for_client, 'Login berhasil.');
                } else {
                    error_log("Login failed: Invalid password for user: $username");
                    send_response(false, null, 'Username atau password salah.', 401);
                }
            } else {
                error_log("Login failed: User not found: $username");
                send_response(false, null, 'Username atau password salah.', 401);
            }
            break;

        case 'check_session':
            error_log("Checking session");
            
            if (isset($_SESSION['user_id']) && isset($_SESSION['login_time'])) {
                // Check session timeout (24 hours)
                $session_timeout = 86400;
                $current_time = time();
                
                if (isset($_SESSION['last_activity']) && 
                    ($current_time - $_SESSION['last_activity']) > $session_timeout) {
                    error_log("Session expired for user: " . $_SESSION['username']);
                    session_destroy();
                    send_response(false, null, 'Sesi telah berakhir. Silakan login kembali.', 401);
                }
                
                // Update last activity
                $_SESSION['last_activity'] = $current_time;
                
                error_log("Session valid for user: " . $_SESSION['username']);
                
                send_response(true, [
                    'user_id' => $_SESSION['user_id'],
                    'username' => $_SESSION['username'],
                    'nama_lengkap' => $_SESSION['nama_lengkap'],
                    'role' => $_SESSION['role'],
                    'session_id' => session_id(),
                    'last_activity' => $_SESSION['last_activity']
                ]);
            } else {
                error_log("No active session found");
                send_response(false, null, 'Tidak ada sesi aktif.', 401);
            }
            break;

        case 'logout':
            error_log("Processing logout");
            if (session_status() === PHP_SESSION_ACTIVE) {
                session_destroy();
            }
            send_response(true, null, 'Logout berhasil.');
            break;

        case 'getGlobalSettings':
            error_log("Getting global settings");
            $result = $conn->query("SELECT setting_key, setting_value FROM global_settings");
            if (!$result) {
                error_log("Failed to get global settings: " . $conn->error);
                send_response(false, null, 'Gagal mengambil pengaturan global: ' . $conn->error);
            }
            $settings = [];
            while ($row = $result->fetch_assoc()) {
                $settings[$row['setting_key']] = $row['setting_value'];
            }
            error_log("Global settings retrieved: " . count($settings) . " items");
            send_response(true, $settings);
            break;

        default:
            error_log("Invalid action: $action");
            send_response(false, null, 'Aksi tidak valid: ' . htmlspecialchars($action), 404);
            break;
    }
} catch (Throwable $e) {
    error_log("API Error: " . $e->getMessage());
    send_response(false, null, 'Server error: ' . $e->getMessage(), 500);
}
?>
