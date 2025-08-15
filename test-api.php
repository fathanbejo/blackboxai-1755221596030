<?php
/**
 * Test API untuk simulasi tanpa database - hanya untuk testing session logic
 */

// Set header early for JSON responses
header("Content-Type: application/json; charset=UTF-8");

// Enable CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Start session
session_start();

// Helper functions
function send_response($success, $data = null, $message = '', $http_code = null) {
    if (!headers_sent()) {
        if ($http_code) {
            http_response_code($http_code);
        } else {
            http_response_code($success ? 200 : 400);
        }
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

// Simulate users data (normally from database)
$users = [
    'admin' => [
        'id' => 1,
        'password' => password_hash('admin123', PASSWORD_DEFAULT), // Generate fresh hash
        'nama_lengkap' => 'Administrator Utama',
        'role' => 'admin'
    ]
];

// Debug: Log the generated hash
error_log("Generated password hash for admin: " . $users['admin']['password']);

try {
    switch ($action) {
        case 'login':
            $data = get_post_data();
            $username = $data['username'] ?? '';
            $password = $data['password'] ?? '';
            
            if (empty($username) || empty($password)) {
                send_response(false, null, 'Username dan password harus diisi.', 400);
            }
            
            if (isset($users[$username])) {
                $user = $users[$username];
                if (password_verify($password, $user['password'])) {
                    // Regenerate session ID untuk keamanan
                    session_regenerate_id(true);
                    
                    // Set session data
                    $_SESSION['user_id'] = $user['id'];
                    $_SESSION['username'] = $username;
                    $_SESSION['nama_lengkap'] = $user['nama_lengkap'];
                    $_SESSION['role'] = $user['role'];
                    $_SESSION['login_time'] = time();
                    $_SESSION['last_activity'] = time();
                    
                    // Log successful login
                    error_log("Login berhasil untuk user: $username (ID: {$user['id']})");
                    
                    $user_data_for_client = [
                        'user_id' => $user['id'],
                        'username' => $username,
                        'nama_lengkap' => $user['nama_lengkap'],
                        'role' => $user['role'],
                        'session_id' => session_id()
                    ];
                    
                    send_response(true, $user_data_for_client, 'Login berhasil.');
                } else {
                    error_log("Login gagal untuk user: $username - Password salah");
                    send_response(false, null, 'Username atau password salah.', 401);
                }
            } else {
                error_log("Login gagal untuk user: $username - User tidak ditemukan");
                send_response(false, null, 'Username atau password salah.', 401);
            }
            break;

        case 'check_session':
            // Periksa apakah session ada dan valid
            if (isset($_SESSION['user_id']) && isset($_SESSION['login_time'])) {
                // Periksa timeout session (24 jam)
                $session_timeout = 86400; // 24 jam dalam detik
                $current_time = time();
                
                if (isset($_SESSION['last_activity']) && 
                    ($current_time - $_SESSION['last_activity']) > $session_timeout) {
                    // Session expired
                    session_destroy();
                    send_response(false, null, 'Sesi telah berakhir. Silakan login kembali.', 401);
                }
                
                // Update last activity
                $_SESSION['last_activity'] = $current_time;
                
                // Simulate user validation (normally from database)
                if (isset($users[$_SESSION['username']])) {
                    $user = $users[$_SESSION['username']];
                    
                    send_response(true, [
                        'user_id' => $_SESSION['user_id'],
                        'username' => $_SESSION['username'],
                        'nama_lengkap' => $user['nama_lengkap'],
                        'role' => $user['role'],
                        'session_id' => session_id(),
                        'last_activity' => $_SESSION['last_activity']
                    ]);
                } else {
                    // User tidak ditemukan, hapus session
                    session_destroy();
                    send_response(false, null, 'Akun tidak valid. Silakan login kembali.', 401);
                }
            } else {
                send_response(false, null, 'Tidak ada sesi aktif.', 401);
            }
            break;

        case 'logout':
            if (session_status() === PHP_SESSION_ACTIVE) {
                session_destroy();
            }
            send_response(true, null, 'Logout berhasil.');
            break;

        case 'getGlobalSettings':
            // Simulate global settings
            $settings = [
                'logo_path' => 'https://mia02sgs.sch.id/wp-content/uploads/2024/01/cropped-Tagline-1.png',
                'dashboard_title' => 'Suite Aplikasi Administrasi',
                'dashboard_subtitle' => 'MI ALMAARIF 02 SINGOSARI'
            ];
            send_response(true, $settings);
            break;

        default:
            send_response(false, null, 'Aksi tidak valid: ' . htmlspecialchars($action), 404);
            break;
    }
} catch (Throwable $e) {
    error_log("API Error: " . $e->getMessage());
    send_response(false, null, 'Terjadi kesalahan server: ' . $e->getMessage(), 500);
}
?>
