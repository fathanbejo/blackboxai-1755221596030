<?php
/**
 * Backend API Terpusat untuk Suite Aplikasi Administrasi Sekolah v4.3.2
 * PENTING: Ganti nama file ini menjadi 'api.php' setelah diunggah.
 */

// --- DEBUGGING & ERROR HANDLING ---
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

function json_error_handler($severity, $message, $file, $line, $http_code = 500) {
    if (!(error_reporting() & $severity)) return;
    if (!headers_sent()) {
        header("Content-Type: application/json; charset=UTF-8");
        http_response_code($http_code);
    }
    die(json_encode(['success' => false, 'message' => "PHP Error: [$severity] $message in $file on line $line"]));
}

// Atur error handler kustom secepat mungkin untuk menangkap semua error sebagai JSON.
set_error_handler('json_error_handler');

// Set header early for pre-flight JSON responses.
header("Content-Type: application/json; charset=UTF-8");

// --- PRE-FLIGHT CHECK & SELF-DIAGNOSTICS ---
// Check 1: config.php existence
if (!file_exists('config.php')) {
    http_response_code(500);
    die(json_encode([
        'success' => false,
        'message' => "Miskonfigurasi Server Kritis: File 'config.php' tidak ditemukan. Aplikasi tidak dapat berjalan. Harap unggah dan konfigurasikan file tersebut."
    ]));
}
require_once 'config.php';

// Check 2: Database connection
$conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    die(json_encode([
        'success' => false,
        'message' => "Miskonfigurasi Server Kritis: Koneksi Database Gagal. Pesan dari server: '" . htmlspecialchars($conn->connect_error) . "'. Pastikan kredensial di 'config.php' sudah benar."
    ]));
}
// --- END PRE-FLIGHT CHECK ---

// --- DATABASE-BACKED SESSION HANDLER (v4.4.0 - PERBAIKAN SESI) ---
class DatabaseSessionHandler implements SessionHandlerInterface {
    private $conn;
    
    public function __construct($conn) { 
        $this->conn = $conn; 
    }
    
    public function open(string $path, string $name): bool { 
        return true; 
    }
    
    public function close(): bool { 
        return true; 
    }

    public function read(string $id): string {
        try {
            $stmt = $this->conn->prepare("SELECT data FROM sessions WHERE id = ? AND expires > NOW()");
            if ($stmt === false) {
                error_log("Session read: Failed to prepare statement");
                return '';
            }
            
            $stmt->bind_param('s', $id);
            if ($stmt->execute()) {
                $result = $stmt->get_result();
                if ($row = $result->fetch_assoc()) {
                    return (string) $row['data'];
                }
            }
            return '';
        } catch (Exception $e) {
            error_log("Session read error: " . $e->getMessage());
            return '';
        }
    }

    public function write(string $id, string $data): bool {
        try {
            // Sesi berlaku 24 jam
            $expires = date('Y-m-d H:i:s', time() + 86400);
            $stmt = $this->conn->prepare("REPLACE INTO sessions (id, data, expires) VALUES (?, ?, ?)");
            if ($stmt === false) { 
                error_log("Session write: Failed to prepare statement");
                return false; 
            }
            
            $stmt->bind_param('sss', $id, $data, $expires);
            $result = $stmt->execute();
            
            if (!$result) {
                error_log("Session write: Failed to execute - " . $stmt->error);
            }
            
            return $result;
        } catch (Exception $e) {
            error_log("Session write error: " . $e->getMessage());
            return false;
        }
    }
    
    public function destroy(string $id): bool {
        try {
            $stmt = $this->conn->prepare("DELETE FROM sessions WHERE id = ?");
            if ($stmt === false) { 
                error_log("Session destroy: Failed to prepare statement");
                return false; 
            }
            
            $stmt->bind_param('s', $id);
            return $stmt->execute();
        } catch (Exception $e) {
            error_log("Session destroy error: " . $e->getMessage());
            return false;
        }
    }

    public function gc(int $max_lifetime): int|false {
        try {
            $result = $this->conn->query("DELETE FROM sessions WHERE expires < NOW()");
            if ($result === false) {
                error_log("Session GC: Failed to delete expired sessions");
                return false;
            }
            
            $affected = $this->conn->affected_rows;
            return $affected >= 0 ? $affected : 0;
        } catch (Exception $e) {
            error_log("Session GC error: " . $e->getMessage());
            return false;
        }
    }
}
// Self-healing: Create sessions table if it doesn't exist
$create_sessions_table_sql = "CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(128) NOT NULL PRIMARY KEY,
    data TEXT,
    expires DATETIME NOT NULL,
    INDEX idx_expires (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

// PERBAIKAN KRITIS: Periksa apakah query `CREATE TABLE` berhasil.
if ($conn->query($create_sessions_table_sql) === false) {
    json_error_handler(E_ERROR, "Koneksi DB berhasil, tetapi GAGAL membuat tabel 'sessions' yang diperlukan. Periksa izin ('CREATE TABLE') untuk pengguna database. Pesan error: " . $conn->error, __FILE__, __LINE__);
}

// Set the custom handler
$handler = new DatabaseSessionHandler($conn);
session_set_save_handler($handler, true);
// --- END SESSION HANDLER ---

// --- SESSION & SECURITY ---
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.use_strict_mode', 1);
    session_set_cookie_params([
        'lifetime' => 86400, 'path' => '/', 'domain' => '',
        'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
        'httponly' => true, 'samesite' => 'Lax'
    ]);
    session_start();
}

// --- CORS & INITIALIZATION ---
if (isset($_SERVER['HTTP_ORIGIN']) && !empty($_SERVER['HTTP_ORIGIN'])) {
    $origin = $_SERVER['HTTP_ORIGIN'];
    header("Access-Control-Allow-Origin: $origin");
}
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

$conn->set_charset(DB_CHARSET);

// --- SELF-HEALING & AUTO-INSTALL MECHANISM (v4.3.0) ---
function run_initial_setup($conn) {
    // 1. Check if 'users' table exists
    $table_check = $conn->query("SHOW TABLES LIKE 'users'");
    if ($table_check->num_rows == 0) {
        $create_table_sql = "
        CREATE TABLE `users` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `username` varchar(50) NOT NULL,
          `password` varchar(255) NOT NULL,
          `nama_lengkap` varchar(100) DEFAULT NULL,
          `role` enum('admin','operator','user') NOT NULL DEFAULT 'user',
          `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
          PRIMARY KEY (`id`),
          UNIQUE KEY `username` (`username`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
        if (!$conn->query($create_table_sql)) {
            json_error_handler(E_ERROR, "Gagal membuat tabel 'users' secara otomatis: " . $conn->error, __FILE__, __LINE__);
        }
    }

    // 2. Check if an admin user exists
    $admin_check = $conn->query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if ($admin_check->num_rows == 0) {
        $default_username = 'admin';
        // Password is 'admin123'
        $default_password_hash = '$2y$10$I0aDBx.71.g.j5k2L1J5HeR.l5IeozME43Q4J8B25I4Y0J8k.itS.';
        $default_full_name = 'Administrator Utama';
        $default_role = 'admin';

        $insert_admin_sql = $conn->prepare("INSERT INTO users (username, password, nama_lengkap, role) VALUES (?, ?, ?, ?)");
        $insert_admin_sql->bind_param('ssss', $default_username, $default_password_hash, $default_full_name, $default_role);
        $insert_admin_sql->execute(); // We let this fail silently if admin already exists (e.g. race condition)
    }
}
run_initial_setup($conn);
// --- END SELF-HEALING ---

// --- HELPER FUNCTIONS ---
function send_response($success, $data = null, $message = '', $http_code = null) {
    // PERBAIKAN KRITIS: Jangan tutup koneksi di sini.
    // Biarkan PHP yang menanganinya di akhir skrip, setelah session handler selesai.
    // global $conn;
    // if ($conn) $conn->close();
    
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

function compress_image($source, $destination, $quality) {
    $info = getimagesize($source);
    if ($info['mime'] == 'image/jpeg') $image = imagecreatefromjpeg($source);
    elseif ($info['mime'] == 'image/gif') $image = imagecreatefromgif($source);
    elseif ($info['mime'] == 'image/png') $image = imagecreatefrompng($source);
    else return false;
    imagejpeg($image, $destination, $quality);
    return $destination;
}

function check_permission($allowed_roles) {
    if (!isset($_SESSION['user_id'])) {
        send_response(false, null, 'Akses ditolak. Sesi tidak valid.', 401);
    }
    if (!in_array($_SESSION['role'], $allowed_roles)) {
        send_response(false, null, 'Anda tidak memiliki izin untuk melakukan aksi ini.', 403);
    }
}

// --- ROUTING / ACTION HANDLER ---
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($action) {
        // ========================================================
        // ENDPOINTS: AUTENTIKASI & PENGGUNA
        // ========================================================
        case 'login':
            $data = get_post_data();
            $username = $data['username'] ?? '';
            $password = $data['password'] ?? '';
            
            if (empty($username) || empty($password)) {
                send_response(false, null, 'Username dan password harus diisi.', 400);
            }
            
            $stmt = $conn->prepare("SELECT id, password, nama_lengkap, role FROM users WHERE username = ?");
            $stmt->bind_param('s', $username);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($user = $result->fetch_assoc()) {
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
                    
                    // PERBAIKAN: Pastikan session tersimpan sebelum response
                    session_write_close();
                    
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
                    // Log failed login attempt
                    error_log("Login gagal untuk user: $username - Password salah");
                    send_response(false, null, 'Username atau password salah.', 401);
                }
            } else {
                // Log failed login attempt
                error_log("Login gagal untuk user: $username - User tidak ditemukan");
                send_response(false, null, 'Username atau password salah.', 401);
            }
            break;

        case 'logout':
            if (session_status() === PHP_SESSION_ACTIVE) {
                session_destroy();
            }
            send_response(true, null, 'Logout berhasil.');
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
                
                // Validasi user masih ada di database
                $stmt = $conn->prepare("SELECT id, nama_lengkap, role FROM users WHERE id = ?");
                $stmt->bind_param('i', $_SESSION['user_id']);
                $stmt->execute();
                $result = $stmt->get_result();
                
                if ($user = $result->fetch_assoc()) {
                    // Update session data jika ada perubahan di database
                    $_SESSION['nama_lengkap'] = $user['nama_lengkap'];
                    $_SESSION['role'] = $user['role'];
                    
                    send_response(true, [
                        'user_id' => $_SESSION['user_id'],
                        'username' => $_SESSION['username'],
                        'nama_lengkap' => $user['nama_lengkap'],
                        'role' => $user['role'],
                        'session_id' => session_id(),
                        'last_activity' => $_SESSION['last_activity']
                    ]);
                } else {
                    // User tidak ditemukan di database, hapus session
                    session_destroy();
                    send_response(false, null, 'Akun tidak valid. Silakan login kembali.', 401);
                }
            } else {
                send_response(false, null, 'Tidak ada sesi aktif.', 401);
            }
            break;

        case 'getUsers':
            check_permission(['admin']);
            $result = $conn->query("SELECT id, username, nama_lengkap, role, created_at FROM users");
            send_response(true, $result->fetch_all(MYSQLI_ASSOC));
            break;

        case 'saveUser':
            check_permission(['admin']);
            $data = get_post_data();
            $id = $data['id'] ?? null;
            $username = $data['username'];
            $password = $data['password'] ?? null;
            $nama_lengkap = $data['nama_lengkap'];
            $role = $data['role'];

            if ($id) { // Update
                if ($password) {
                    $hashed_password = password_hash($password, PASSWORD_DEFAULT);
                    $stmt = $conn->prepare("UPDATE users SET username = ?, password = ?, nama_lengkap = ?, role = ? WHERE id = ?");
                    $stmt->bind_param('ssssi', $username, $hashed_password, $nama_lengkap, $role, $id);
                } else {
                    $stmt = $conn->prepare("UPDATE users SET username = ?, nama_lengkap = ?, role = ? WHERE id = ?");
                    $stmt->bind_param('sssi', $username, $nama_lengkap, $role, $id);
                }
            } else { // Create
                if (!$password) send_response(false, null, 'Password wajib diisi untuk pengguna baru.');
                $hashed_password = password_hash($password, PASSWORD_DEFAULT);
                $stmt = $conn->prepare("INSERT INTO users (username, password, nama_lengkap, role) VALUES (?, ?, ?, ?)");
                $stmt->bind_param('ssss', $username, $hashed_password, $nama_lengkap, $role);
            }
            if (!$stmt->execute()) send_response(false, null, 'Gagal menyimpan pengguna: ' . $stmt->error);
            send_response(true, null, 'Pengguna berhasil disimpan.');
            break;

        case 'deleteUser':
            check_permission(['admin']);
            $data = get_post_data();
            $id = $data['id'];
            if ($id == 1) send_response(false, null, 'Pengguna admin utama tidak dapat dihapus.');
            if ($id == $_SESSION['user_id']) send_response(false, null, 'Anda tidak dapat menghapus diri sendiri.');
            $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
            $stmt->bind_param('i', $id);
            $stmt->execute();
            send_response(true, null, 'Pengguna berhasil dihapus.');
            break;

        // ========================================================
        // ENDPOINTS: PENGATURAN GLOBAL
        // ========================================================
        case 'getGlobalSettings':
            $result = $conn->query("SELECT setting_key, setting_value FROM global_settings");
            if (!$result) send_response(false, null, 'Gagal mengambil pengaturan global: ' . $conn->error);
            $settings = [];
            while ($row = $result->fetch_assoc()) {
                $settings[$row['setting_key']] = $row['setting_value'];
            }
            send_response(true, $settings);
            break;

        case 'saveGlobalSettings':
            check_permission(['admin']);
            if ($method !== 'POST') send_response(false, null, 'Metode harus POST.');
            
            $conn->begin_transaction();
            try {
                $stmt = $conn->prepare("INSERT INTO global_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
                
                $keys_to_save = [
                    'header_line_1', 'header_line_1_size', 'header_line_1_color',
                    'header_line_2', 'header_line_2_size', 'header_line_2_color',
                    'header_line_3', 'header_line_3_size', 'header_line_3_color',
                    'header_line_4', 'header_line_4_size', 'header_line_4_color',
                    'header_line_5', 'header_line_5_size', 'header_line_5_color',
                    'header_line_6', 'header_line_6_size', 'header_line_6_color',
                    'dashboard_title', 'dashboard_subtitle',
                    'izin_form_title', 'izin_form_subtitle', 'izin_dasbor_title', 'rapat_form_title'
                ];

                foreach ($keys_to_save as $key) {
                    if (isset($_POST[$key])) {
                        $stmt->bind_param('ss', $key, $_POST[$key]);
                        $stmt->execute();
                    }
                }
                $stmt->close();
                
                if (isset($_FILES['logo']) && $_FILES['logo']['error'] == 0) {
                    $upload_dir = 'uploads/';
                    if (!is_dir($upload_dir)) @mkdir($upload_dir, 0777, true);
                    if (!is_writable($upload_dir)) throw new Exception('Direktori `uploads` tidak dapat ditulisi.');

                    $result_old_logo = $conn->query("SELECT setting_value FROM global_settings WHERE setting_key = 'logo_path'");
                    if($row = $result_old_logo->fetch_assoc()){
                        if($row['setting_value'] && file_exists($row['setting_value']) && !filter_var($row['setting_value'], FILTER_VALIDATE_URL)) {
                            @unlink($row['setting_value']);
                        }
                    }

                    $extension = pathinfo($_FILES['logo']['name'], PATHINFO_EXTENSION);
                    $filename = 'logo_' . time() . '.' . $extension;
                    $filepath = $upload_dir . $filename;
                    if (!move_uploaded_file($_FILES['logo']['tmp_name'], $filepath)) {
                        throw new Exception('Gagal mengunggah file logo.');
                    }
                    
                    $stmt_logo = $conn->prepare("INSERT INTO global_settings (setting_key, setting_value) VALUES ('logo_path', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
                    $stmt_logo->bind_param('s', $filepath);
                    $stmt_logo->execute();
                    $stmt_logo->close();
                }

                $conn->commit();
                send_response(true, null, 'Pengaturan global berhasil disimpan.');
            } catch (Exception $e) {
                $conn->rollback();
                send_response(false, null, $e->getMessage());
            }
            break;

        // ========================================================
        // ENDPOINTS: FORM DINAMIS
        // ========================================================
        case 'getSettings':
            $result = $conn->query("SELECT setting_value FROM app_settings WHERE setting_key = 'formSettings'");
            $row = $result->fetch_assoc();
            $settings_json = ($row && !empty($row['setting_value'])) ? $row['setting_value'] : '{"fields":[],"displaySettings":{}}';
            send_response(true, json_decode($settings_json, true));
            break;
            
        case 'saveSettings':
            check_permission(['admin', 'operator']);
            $data = get_post_data();
            $json_data = json_encode($data, JSON_UNESCAPED_UNICODE);
            $stmt = $conn->prepare("INSERT INTO app_settings (setting_key, setting_value) VALUES ('formSettings', ?) ON DUPLICATE KEY UPDATE setting_value = ?");
            $stmt->bind_param('ss', $json_data, $json_data);
            $stmt->execute();
            send_response(true, null, 'Pengaturan berhasil disimpan.');
            break;
        
        case 'getPresets':
            $result = $conn->query("SELECT setting_value FROM app_settings WHERE setting_key = 'presets'");
            $row = $result->fetch_assoc();
            $presets_json = ($row && !empty($row['setting_value'])) ? $row['setting_value'] : '{"presets":{}}';
            send_response(true, json_decode($presets_json, true));
            break;
        
        case 'savePreset':
            check_permission(['admin', 'operator']);
            $data = get_post_data();
            $preset_name = $data['name'] ?? null;
            if (!$preset_name) send_response(false, null, 'Nama preset wajib diisi.');
            
            $conn->begin_transaction();
            $stmt = $conn->prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'presets' FOR UPDATE");
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
            
            $presets_json = $row ? $row['setting_value'] : '{"presets":{}}';
            $presets_data = json_decode($presets_json, true);
            if(json_last_error() !== JSON_ERROR_NONE) $presets_data = ['presets' => []];

            $new_id = uniqid('preset_');
            $data['id'] = $new_id;
            $presets_data['presets'][$new_id] = $data;
            
            $new_json = json_encode($presets_data, JSON_UNESCAPED_UNICODE);
            $update_stmt = $conn->prepare("INSERT INTO app_settings (setting_key, setting_value) VALUES ('presets', ?) ON DUPLICATE KEY UPDATE setting_value = ?");
            $update_stmt->bind_param('ss', $new_json, $new_json);
            $update_stmt->execute();
            $conn->commit();
            
            send_response(true, ['id' => $new_id], 'Preset berhasil disimpan.');
            break;

        case 'deletePreset':
            check_permission(['admin']);
            $data = get_post_data();
            $preset_id = $data['id'] ?? null;
            if (!$preset_id) send_response(false, null, 'ID preset wajib diisi.');

            $conn->begin_transaction();
            $stmt = $conn->prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'presets' FOR UPDATE");
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
            
            $presets_json = $row ? $row['setting_value'] : '{"presets":{}}';
            $presets_data = json_decode($presets_json, true);
            
            if (isset($presets_data['presets'][$preset_id])) {
                unset($presets_data['presets'][$preset_id]);
                $new_json = json_encode($presets_data, JSON_UNESCAPED_UNICODE);
                $update_stmt = $conn->prepare("UPDATE app_settings SET setting_value = ? WHERE setting_key = 'presets'");
                $update_stmt->bind_param('s', $new_json);
                $update_stmt->execute();
            }
            $conn->commit();
            send_response(true, null, 'Preset berhasil dihapus.');
            break;

        case 'getSinglePreset':
            $post_data = get_post_data();
            $preset_id = $post_data['id'] ?? null;
            if (!$preset_id) send_response(false, null, 'Preset ID tidak diberikan.');
            $result = $conn->query("SELECT setting_value FROM app_settings WHERE setting_key = 'presets'");
            $row = $result->fetch_assoc();
            $presets_json = $row ? $row['setting_value'] : '{"presets":{}}';
            $presets_data = json_decode($presets_json, true);
            if (isset($presets_data['presets'][$preset_id])) {
                send_response(true, $presets_data['presets'][$preset_id]);
            } else {
                send_response(false, null, "Preset dengan ID '{$preset_id}' tidak ditemukan.");
            }
            break;

        case 'getAllStudents':
            $result = $conn->query("SELECT * FROM students ORDER BY NAMA ASC");
            if (!$result) send_response(false, null, 'Gagal mengambil data siswa: ' . $conn->error);
            $students = $result->fetch_all(MYSQLI_ASSOC);
            send_response(true, $students);
            break;
            
        case 'updateStudent':
            check_permission(['admin', 'operator']);
            $post_data = get_post_data();
            if (empty($post_data['id'])) send_response(false, null, 'ID Siswa tidak boleh kosong.');
            
            if ($_SESSION['role'] === 'operator') {
                $protected_cols = ['ID_SISWA', 'NAMA', 'ROMBEL'];
                foreach ($protected_cols as $col) {
                    if (isset($post_data['data'][$col])) {
                        send_response(false, null, "Operator tidak dapat mengubah kolom '{$col}'.", 403);
                    }
                }
            }
            
            $id_siswa = $post_data['id'];
            $student_data = $post_data['data'];
            $student_data['Tanggal_Update_Terakhir'] = date('Y-m-d H:i:s');
            $result = $conn->query("SHOW COLUMNS FROM students");
            $allowed_columns = [];
            while ($row = $result->fetch_assoc()) $allowed_columns[] = $row['Field'];
            $updates = []; $param_values = []; $types = '';
            foreach ($student_data as $col => $val) {
                if (in_array($col, $allowed_columns)) {
                    $updates[] = "`$col` = ?";
                    $param_values[] = $val;
                    $types .= 's';
                }
            }
            if (empty($updates)) send_response(true, null, 'Tidak ada kolom valid.');
            $param_values[] = $id_siswa;
            $types .= 'i';
            $sql = "UPDATE students SET " . implode(', ', $updates) . " WHERE ID_SISWA = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param($types, ...$param_values);
            if (!$stmt->execute()) send_response(false, null, 'SQL Execute Error: ' . $stmt->error);
            send_response(true, null, 'Data berhasil diperbarui.');
            break;

        case 'addStudent':
            check_permission(['admin', 'operator']);
            $data = get_post_data();
            if (empty($data['ID_SISWA']) || empty($data['NAMA'])) send_response(false, null, 'ID Siswa dan Nama wajib diisi.');
            $stmt = $conn->prepare("INSERT INTO students (ID_SISWA, NAMA, ROMBEL) VALUES (?, ?, ?)");
            $stmt->bind_param('iss', $data['ID_SISWA'], $data['NAMA'], $data['ROMBEL']);
            if (!$stmt->execute()) send_response(false, null, 'Gagal menambah siswa: ' . $stmt->error);
            send_response(true, ['id' => $data['ID_SISWA']]);
            break;

        case 'deleteStudent':
            check_permission(['admin']);
            $data = get_post_data();
            if (empty($data['id'])) send_response(false, null, 'ID Siswa wajib diisi.');
            $stmt = $conn->prepare("DELETE FROM students WHERE ID_SISWA = ?");
            $stmt->bind_param('i', $data['id']);
            if (!$stmt->execute()) send_response(false, null, 'Gagal menghapus siswa: ' . $stmt->error);
            send_response(true, null, 'Data siswa berhasil dihapus.');
            break;

        case 'syncFromDb':
            check_permission(['admin']);
            $result = $conn->query("SHOW COLUMNS FROM students");
            $columns = [];
            while ($row = $result->fetch_assoc()) $columns[] = $row['Field'];
            send_response(true, $columns);
            break;

        case 'addColumn':
            check_permission(['admin']);
            $data = get_post_data();
            if (empty($data['name']) || empty($data['type'])) send_response(false, null, 'Nama dan tipe kolom harus diisi.');
            if (!preg_match('/^[a-zA-Z0-9_]+$/', $data['name'])) send_response(false, null, "Nama kolom mengandung karakter tidak valid.");
            $allowed_types = ['VARCHAR(255)', 'TEXT', 'INT', 'DATE'];
            if (!in_array($data['type'], $allowed_types)) send_response(false, null, 'Tipe data tidak valid.');
            $sql = "ALTER TABLE students ADD COLUMN `{$data['name']}` {$data['type']} NULL DEFAULT NULL";
            if (!$conn->query($sql)) send_response(false, null, 'Gagal menambah kolom: ' . $conn->error);
            send_response(true, null, "Kolom '{$data['name']}' berhasil ditambahkan.");
            break;

        case 'deleteColumn':
            check_permission(['admin']);
            $data = get_post_data();
            if (empty($data['name'])) send_response(false, null, 'Nama kolom harus diisi.');
            if (!preg_match('/^[a-zA-Z0-9_]+$/', $data['name'])) send_response(false, null, "Nama kolom mengandung karakter tidak valid.");
            $protected = ['id', 'ID_SISWA', 'NAMA', 'ROMBEL', 'Tanggal_Update_Terakhir', 'KELAS_BILQOLAM'];
            if (in_array(strtoupper($data['name']), array_map('strtoupper', $protected), true)) send_response(false, null, "Kolom sistem '{$data['name']}' tidak dapat dihapus.");
            $sql = "ALTER TABLE students DROP COLUMN `{$data['name']}`";
            if (!$conn->query($sql)) send_response(false, null, 'Gagal menghapus kolom: ' . $conn->error);
            send_response(true, null, "Kolom '{$data['name']}' berhasil dihapus.");
            break;

        case 'batchUpdate':
            check_permission(['admin']);
            $records = get_post_data();
            if (empty($records)) send_response(false, null, 'Tidak ada data untuk diimpor.');
            $result = $conn->query("SHOW COLUMNS FROM students");
            $table_columns = [];
            while($row = $result->fetch_assoc()) $table_columns[] = $row['Field'];
            $all_keys = array_keys($records[0]);
            $columns = array_intersect($all_keys, $table_columns);
            if (!in_array('ID_SISWA', $columns)) send_response(false, null, 'Kolom "ID_SISWA" wajib ada.');
            $update_part = [];
            foreach ($columns as $col) {
                if ($col !== 'ID_SISWA' && $col !== 'id') $update_part[] = "`$col` = VALUES(`$col`)";
            }
            if(empty($update_part)) send_response(false, null, 'Tidak ada kolom yang bisa diupdate.');
            $sql = "INSERT INTO students (`" . implode('`, `', $columns) . "`) VALUES ";
            $sql .= implode(', ', array_fill(0, count($records), '(' . implode(',', array_fill(0, count($columns), '?')) . ')'));
            $sql .= " ON DUPLICATE KEY UPDATE " . implode(', ', $update_part);
            $stmt = $conn->prepare($sql);
            $types = str_repeat('s', count($columns) * count($records));
            $params = [];
            foreach ($records as $record) {
                foreach ($columns as $col) $params[] = $record[$col] ?? null;
            }
            $stmt->bind_param($types, ...$params);
            $conn->begin_transaction();
            try {
                if (!$stmt->execute()) throw new Exception($stmt->error);
                $conn->commit();
                send_response(true, ['affected_rows' => $stmt->affected_rows], 'Data berhasil diimpor.');
            } catch (Exception $e) { $conn->rollback(); send_response(false, null, 'Gagal mengimpor data: ' . $e->getMessage()); }
            break;
            
        // ========================================================
        // SISA ENDPOINTS (IZIN, RAPAT, DLL)
        // ========================================================
        case 'saveIzin':
            $data = get_post_data();
            if (empty($data['id_siswa']) || empty($data['tanggal']) || empty($data['alasan'])) send_response(false, null, 'Data tidak lengkap.');
            
            $stmt_check = $conn->prepare("SELECT id FROM absensi WHERE id_siswa = ? AND tanggal_izin = ?");
            $stmt_check->bind_param('is', $data['id_siswa'], $data['tanggal']);
            $stmt_check->execute();
            $existing_record = $stmt_check->get_result()->fetch_assoc();
            
            if ($existing_record) {
                $stmt = $conn->prepare("UPDATE absensi SET alasan = ?, keterangan = ?, kelas_bilqolam = ? WHERE id = ?");
                $stmt->bind_param('sssi', $data['alasan'], $data['keterangan'], $data['kelasBilqolam'], $existing_record['id']);
                $stmt->execute(); send_response(true, null, 'Data izin berhasil diperbarui!');
            } else {
                $stmt = $conn->prepare("INSERT INTO absensi (id_siswa, tanggal_izin, alasan, keterangan, kelas_bilqolam) VALUES (?, ?, ?, ?, ?)");
                $stmt->bind_param('issss', $data['id_siswa'], $data['tanggal'], $data['alasan'], $data['keterangan'], $data['kelasBilqolam']);
                $stmt->execute(); send_response(true, null, 'Data izin berhasil disimpan!');
            }
            break;

        case 'getAbsensiData':
            check_permission(['admin', 'operator']);
            $params = []; $types = '';
            $sql = "SELECT a.id, a.tanggal_izin, a.alasan, a.keterangan, s.NAMA, s.ROMBEL, a.kelas_bilqolam AS KELAS_BILQOLAM FROM absensi a JOIN students s ON a.id_siswa = s.ID_SISWA WHERE 1=1";
            if (!empty($_GET['startDate'])) { $sql .= " AND a.tanggal_izin >= ?"; $params[] = $_GET['startDate']; $types .= 's'; }
            if (!empty($_GET['endDate'])) { $sql .= " AND a.tanggal_izin <= ?"; $params[] = $_GET['endDate']; $types .= 's'; }
            if (!empty($_GET['kelas'])) { $sql .= " AND s.ROMBEL = ?"; $params[] = $_GET['kelas']; $types .= 's'; }
            if (!empty($_GET['kelasBilqolam'])) { $sql .= " AND a.kelas_bilqolam = ?"; $params[] = $_GET['kelasBilqolam']; $types .= 's'; }
            if (!empty($_GET['nama'])) { $sql .= " AND s.NAMA LIKE ?"; $params[] = '%' . $_GET['nama'] . '%'; $types .= 's'; }
            $sql .= " ORDER BY a.tanggal_izin DESC, s.NAMA ASC";
            $stmt = $conn->prepare($sql);
            if (!empty($params)) $stmt->bind_param($types, ...$params);
            $stmt->execute();
            send_response(true, $stmt->get_result()->fetch_all(MYSQLI_ASSOC));
            break;

        case 'deleteAbsensi':
            check_permission(['admin']);
            if ($method !== 'POST') send_response(false, null, 'Metode harus POST.');
            $id = get_post_data()['id'] ?? null;
            if (!$id) send_response(false, null, 'ID absensi wajib diisi.');
            $stmt = $conn->prepare("DELETE FROM absensi WHERE id = ?");
            $stmt->bind_param('i', $id);
            $stmt->execute();
            send_response(true, null, 'Data absensi berhasil dihapus.');
            break;

        case 'deleteRapat':
            check_permission(['admin']);
            $id_rapat = get_post_data()['id_rapat'] ?? null;
            if (!$id_rapat) send_response(false, null, 'ID Rapat tidak valid.');
            
            $stmt_files = $conn->prepare("SELECT path_tanda_tangan FROM peserta_rapat WHERE id_rapat = ?");
            $stmt_files->bind_param('i', $id_rapat); $stmt_files->execute();
            $result_files = $stmt_files->get_result();
            while($row = $result_files->fetch_assoc()) if (file_exists($row['path_tanda_tangan'])) @unlink($row['path_tanda_tangan']);
            
            $stmt_doc = $conn->prepare("SELECT path_dokumentasi FROM rapat WHERE id = ?");
            $stmt_doc->bind_param('i', $id_rapat); $stmt_doc->execute();
            if($row_doc = $stmt_doc->get_result()->fetch_assoc()) {
                foreach(json_decode($row_doc['path_dokumentasi'] ?? '[]', true) as $path) if(file_exists($path)) @unlink($path);
            }
            
            $stmt_del = $conn->prepare("DELETE FROM rapat WHERE id = ?");
            $stmt_del->bind_param('i', $id_rapat);
            $stmt_del->execute();
            send_response(true, null, 'Rapat berhasil dihapus.');
            break;

        case 'batchImportGuru':
            check_permission(['admin']);
            $gurus = get_post_data()['gurus'] ?? [];
            if (empty($gurus)) send_response(false, null, 'Tidak ada data guru.');
            
            $conn->begin_transaction();
            try {
                $conn->query("DELETE FROM guru");
                $conn->query("ALTER TABLE guru AUTO_INCREMENT = 1");
                $stmt = $conn->prepare("INSERT INTO guru (nama_guru, jabatan) VALUES (?, ?)");
                $count = 0;
                foreach ($gurus as $g) {
                    if (!empty($g['nama_guru'])) {
                        $stmt->bind_param('ss', $g['nama_guru'], $g['jabatan']);
                        $stmt->execute(); $count++;
                    }
                }
                $conn->commit();
                send_response(true, null, "$count guru berhasil diimpor.");
            } catch (Exception $e) { $conn->rollback(); send_response(false, null, 'Gagal mengimpor: ' . $e->getMessage()); }
            break;

        // ========================================================
        // ENDPOINTS: KALENDER & AGENDA
        // ========================================================
        case 'getCalendarData':
            $year = $_GET['year'] ?? date('Y');
            $month = $_GET['month'] ?? date('m');
            
            // Get holidays (you can integrate with holiday API or use static data)
            $holidays = [];
            
            // Get custom agendas
            $agendas = [];
            $agenda_result = $conn->query("SELECT * FROM agenda WHERE YEAR(agenda_date) = $year AND MONTH(agenda_date) = $month ORDER BY agenda_date");
            if ($agenda_result) {
                while ($row = $agenda_result->fetch_assoc()) {
                    $agendas[] = $row;
                }
            }
            
            // Get documents
            $documents = [];
            $doc_result = $conn->query("SELECT * FROM calendar_documents WHERE YEAR(document_date) = $year AND MONTH(document_date) = $month ORDER BY document_date");
            if ($doc_result) {
                while ($row = $doc_result->fetch_assoc()) {
                    $date_key = $row['document_date'];
                    if (!isset($documents[$date_key])) {
                        $documents[$date_key] = [];
                    }
                    $documents[$date_key][] = [
                        'id' => $row['id'],
                        'name' => $row['document_name'],
                        'path' => $row['document_path']
                    ];
                }
            }
            
            send_response(true, [
                'holidays' => $holidays,
                'agendas' => $agendas,
                'documents' => $documents
            ]);
            break;

        case 'addAgenda':
            check_permission(['admin', 'operator']);
            $data = get_post_data();
            $startDate = $data['startDate'];
            $endDate = $data['endDate'] ?? null;
            $description = $data['description'];
            $isHoliday = $data['isHoliday'] ? 1 : 0;
            
            $stmt = $conn->prepare("INSERT INTO agenda (agenda_date, end_date, description, is_holiday) VALUES (?, ?, ?, ?)");
            $stmt->bind_param('sssi', $startDate, $endDate, $description, $isHoliday);
            
            if ($stmt->execute()) {
                send_response(true, null, 'Agenda berhasil ditambahkan.');
            } else {
                send_response(false, null, 'Gagal menambahkan agenda: ' . $stmt->error);
            }
            break;

        case 'updateAgenda':
            check_permission(['admin', 'operator']);
            $data = get_post_data();
            $id = $data['id'];
            $startDate = $data['startDate'];
            $endDate = $data['endDate'] ?? null;
            $description = $data['description'];
            $isHoliday = $data['isHoliday'] ? 1 : 0;
            
            $stmt = $conn->prepare("UPDATE agenda SET agenda_date = ?, end_date = ?, description = ?, is_holiday = ? WHERE id = ?");
            $stmt->bind_param('sssii', $startDate, $endDate, $description, $isHoliday, $id);
            
            if ($stmt->execute()) {
                send_response(true, null, 'Agenda berhasil diperbarui.');
            } else {
                send_response(false, null, 'Gagal memperbarui agenda: ' . $stmt->error);
            }
            break;

        case 'deleteAgenda':
            check_permission(['admin']);
            $data = get_post_data();
            $id = $data['id'];
            
            $stmt = $conn->prepare("DELETE FROM agenda WHERE id = ?");
            $stmt->bind_param('i', $id);
            
            if ($stmt->execute()) {
                send_response(true, null, 'Agenda berhasil dihapus.');
            } else {
                send_response(false, null, 'Gagal menghapus agenda: ' . $stmt->error);
            }
            break;

        case 'saveHoliday':
            check_permission(['admin', 'operator']);
            $data = get_post_data();
            $date = $data['date'];
            $name = $data['name'];
            
            $stmt = $conn->prepare("INSERT INTO holidays (holiday_date, holiday_name, source) VALUES (?, ?, 'manual') ON DUPLICATE KEY UPDATE holiday_name = VALUES(holiday_name)");
            $stmt->bind_param('ss', $date, $name);
            
            if ($stmt->execute()) {
                send_response(true, null, 'Hari libur berhasil disimpan.');
            } else {
                send_response(false, null, 'Gagal menyimpan hari libur: ' . $stmt->error);
            }
            break;

        case 'deleteHoliday':
            check_permission(['admin']);
            $data = get_post_data();
            $date = $data['date'];
            
            $stmt = $conn->prepare("DELETE FROM holidays WHERE holiday_date = ?");
            $stmt->bind_param('s', $date);
            
            if ($stmt->execute()) {
                send_response(true, null, 'Hari libur berhasil dihapus.');
            } else {
                send_response(false, null, 'Gagal menghapus hari libur: ' . $stmt->error);
            }
            break;

        case 'uploadDocument':
            check_permission(['admin', 'operator']);
            $date = $_POST['date'];
            
            if (!isset($_FILES['files'])) {
                send_response(false, null, 'Tidak ada file yang diunggah.');
            }
            
            $upload_dir = 'uploads/calendar/';
            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, 0777, true);
            }
            
            $uploaded_files = [];
            foreach ($_FILES['files']['tmp_name'] as $key => $tmp_name) {
                if ($_FILES['files']['error'][$key] === UPLOAD_ERR_OK) {
                    $file_name = $_FILES['files']['name'][$key];
                    $file_path = $upload_dir . time() . '_' . $file_name;
                    
                    if (move_uploaded_file($tmp_name, $file_path)) {
                        $stmt = $conn->prepare("INSERT INTO calendar_documents (document_date, document_name, document_path) VALUES (?, ?, ?)");
                        $stmt->bind_param('sss', $date, $file_name, $file_path);
                        $stmt->execute();
                        $uploaded_files[] = $file_name;
                    }
                }
            }
            
            if (!empty($uploaded_files)) {
                send_response(true, null, count($uploaded_files) . ' dokumen berhasil diunggah.');
            } else {
                send_response(false, null, 'Gagal mengunggah dokumen.');
            }
            break;

        case 'deleteDocument':
            check_permission(['admin']);
            $data = get_post_data();
            $id = $data['id'];
            
            // Get file path first
            $stmt = $conn->prepare("SELECT document_path FROM calendar_documents WHERE id = ?");
            $stmt->bind_param('i', $id);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($row = $result->fetch_assoc()) {
                // Delete file
                if (file_exists($row['document_path'])) {
                    unlink($row['document_path']);
                }
                
                // Delete from database
                $delete_stmt = $conn->prepare("DELETE FROM calendar_documents WHERE id = ?");
                $delete_stmt->bind_param('i', $id);
                
                if ($delete_stmt->execute()) {
                    send_response(true, null, 'Dokumen berhasil dihapus.');
                } else {
                    send_response(false, null, 'Gagal menghapus dokumen dari database.');
                }
            } else {
                send_response(false, null, 'Dokumen tidak ditemukan.');
            }
            break;

        case 'importEvents':
            check_permission(['admin']);
            $events = get_post_data();
            
            if (empty($events)) {
                send_response(false, null, 'Tidak ada data untuk diimpor.');
            }
            
            $conn->begin_transaction();
            try {
                $stmt = $conn->prepare("INSERT INTO agenda (agenda_date, end_date, description, is_holiday) VALUES (?, ?, ?, ?)");
                $count = 0;
                
                foreach ($events as $event) {
                    $stmt->bind_param('sssi', $event['agenda_date'], $event['end_date'], $event['description'], $event['is_holiday']);
                    if ($stmt->execute()) {
                        $count++;
                    }
                }
                
                $conn->commit();
                send_response(true, null, "$count agenda berhasil diimpor.");
            } catch (Exception $e) {
                $conn->rollback();
                send_response(false, null, 'Gagal mengimpor agenda: ' . $e->getMessage());
            }
            break;

        // ========================================================
        // ENDPOINTS: GURU & RAPAT
        // ========================================================
        case 'getGuruList':
            $result = $conn->query("SELECT * FROM guru ORDER BY nama_guru ASC");
            if (!$result) send_response(false, null, 'Gagal mengambil data guru: ' . $conn->error);
            $guru_list = $result->fetch_all(MYSQLI_ASSOC);
            send_response(true, $guru_list);
            break;

        case 'getMeetings':
            $result = $conn->query("SELECT * FROM rapat ORDER BY tanggal DESC, waktu DESC");
            if (!$result) send_response(false, null, 'Gagal mengambil data rapat: ' . $conn->error);
            $meetings = $result->fetch_all(MYSQLI_ASSOC);
            send_response(true, $meetings);
            break;

        case 'getActiveMeetings':
            $result = $conn->query("SELECT * FROM rapat WHERE status = 'active' ORDER BY tanggal DESC, waktu DESC");
            if (!$result) send_response(false, null, 'Gagal mengambil data rapat aktif: ' . $conn->error);
            $meetings = $result->fetch_all(MYSQLI_ASSOC);
            send_response(true, $meetings);
            break;

        case 'getAcademicYearEvents':
            $start = $_GET['start'] ?? '';
            $end = $_GET['end'] ?? '';
            
            if (empty($start) || empty($end)) {
                send_response(false, null, 'Parameter start dan end harus diisi.');
            }
            
            // Get agendas in date range
            $agendas = [];
            $agenda_stmt = $conn->prepare("SELECT * FROM agenda WHERE agenda_date BETWEEN ? AND ? ORDER BY agenda_date");
            $agenda_stmt->bind_param('ss', $start, $end);
            $agenda_stmt->execute();
            $agenda_result = $agenda_stmt->get_result();
            while ($row = $agenda_result->fetch_assoc()) {
                $agendas[] = $row;
            }
            
            // Get holidays in date range
            $holidays = [];
            $holiday_stmt = $conn->prepare("SELECT * FROM holidays WHERE holiday_date BETWEEN ? AND ? ORDER BY holiday_date");
            $holiday_stmt->bind_param('ss', $start, $end);
            $holiday_stmt->execute();
            $holiday_result = $holiday_stmt->get_result();
            while ($row = $holiday_result->fetch_assoc()) {
                $holidays[] = $row;
            }
            
            // Get documents in date range
            $documents = [];
            $doc_stmt = $conn->prepare("SELECT * FROM calendar_documents WHERE document_date BETWEEN ? AND ? ORDER BY document_date");
            $doc_stmt->bind_param('ss', $start, $end);
            $doc_stmt->execute();
            $doc_result = $doc_stmt->get_result();
            while ($row = $doc_result->fetch_assoc()) {
                $date_key = $row['document_date'];
                if (!isset($documents[$date_key])) {
                    $documents[$date_key] = [];
                }
                $documents[$date_key][] = [
                    'id' => $row['id'],
                    'name' => $row['document_name'],
                    'path' => $row['document_path']
                ];
            }
            
            send_response(true, [
                'agendas' => $agendas,
                'holidays' => $holidays,
                'documents' => $documents
            ]);
            break;

        default:
            send_response(false, null, 'Aksi tidak valid: ' . htmlspecialchars($action), 404);
            break;
    }
} catch (Throwable $e) {
    json_error_handler(E_ERROR, $e->getMessage(), $e->getFile(), $e->getLine());
}