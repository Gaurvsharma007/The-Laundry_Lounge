<?php
// Set headers for CORS and JSON response
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Get request path
$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);
$path = ltrim($path, '/');

// Define users file path
$users_file = 'users.json';

// Function to read users from file
function read_users() {
    global $users_file;
    if (file_exists($users_file)) {
        $content = file_get_contents($users_file);
        return json_decode($content, true) ?: [];
    }
    return [];
}

// Function to write users to file
function write_users($users) {
    global $users_file;
    file_put_contents($users_file, json_encode($users, JSON_PRETTY_PRINT));
}

// Function to hash password
function hash_password($password, $salt = null) {
    if ($salt === null) {
        $salt = bin2hex(random_bytes(16));
    }
    $hash = hash('sha256', $password . $salt);
    return ['hash' => $hash, 'salt' => $salt];
}

// Function to verify password
function verify_password($password, $hash, $salt) {
    $verifyHash = hash('sha256', $password . $salt);
    return $hash === $verifyHash;
}

// Function to generate a token
function generate_token($user_id, $email) {
    $payload = [
        'id' => $user_id,
        'email' => $email,
        'exp' => time() + (24 * 60 * 60) // 24 hours
    ];
    
    $secret = 'laundry-service-simple-auth-secret-key';
    $base64_payload = base64_encode(json_encode($payload));
    $signature = hash_hmac('sha256', $base64_payload, $secret);
    
    return $base64_payload . '.' . $signature;
}

// Function to verify token
function verify_token($token) {
    $secret = 'laundry-service-simple-auth-secret-key';
    
    $parts = explode('.', $token);
    if (count($parts) !== 2) {
        return null;
    }
    
    list($base64_payload, $signature) = $parts;
    
    $expected_signature = hash_hmac('sha256', $base64_payload, $secret);
    if (!hash_equals($expected_signature, $signature)) {
        return null;
    }
    
    $payload = json_decode(base64_decode($base64_payload), true);
    if (!$payload || !isset($payload['exp']) || $payload['exp'] < time()) {
        return null;
    }
    
    return $payload;
}

// Get request body
$request_body = file_get_contents('php://input');
$data = json_decode($request_body, true) ?: [];

// Handle routes
switch ($path) {
    case 'api/auth/signup':
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            // Validate required fields
            $required_fields = ['firstName', 'lastName', 'email', 'phone', 'password'];
            foreach ($required_fields as $field) {
                if (empty($data[$field])) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => 'All fields are required'
                    ]);
                    exit;
                }
            }
            
            // Check if email already exists
            $users = read_users();
            foreach ($users as $user) {
                if ($user['email'] === $data['email']) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Email already in use'
                    ]);
                    exit;
                }
            }
            
            // Hash password
            $password_data = hash_password($data['password']);
            
            // Create new user
            $new_user = [
                'id' => uniqid(),
                'firstName' => $data['firstName'],
                'lastName' => $data['lastName'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'password' => $password_data['hash'],
                'salt' => $password_data['salt'],
                'createdAt' => date('c')
            ];
            
            // Add to users array
            $users[] = $new_user;
            
            // Save to file
            write_users($users);
            
            // Return success (exclude password and salt from response)
            $user_without_password = $new_user;
            unset($user_without_password['password']);
            unset($user_without_password['salt']);
            
            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'User registered successfully',
                'user' => $user_without_password
            ]);
        } else {
            http_response_code(405);
            echo json_encode(['message' => 'Method not allowed']);
        }
        break;
        
    case 'api/auth/login':
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            // Validate required fields
            if (empty($data['email']) || empty($data['password'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Email and password are required'
                ]);
                exit;
            }
            
            // Find user by email
            $users = read_users();
            $user = null;
            foreach ($users as $u) {
                if ($u['email'] === $data['email']) {
                    $user = $u;
                    break;
                }
            }
            
            // Check if user exists and password matches
            if (!$user || !verify_password($data['password'], $user['password'], $user['salt'])) {
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid email or password'
                ]);
                exit;
            }
            
            // Generate token
            $token = generate_token($user['id'], $user['email']);
            
            // Return success (exclude password and salt from response)
            $user_without_password = $user;
            unset($user_without_password['password']);
            unset($user_without_password['salt']);
            
            echo json_encode([
                'success' => true,
                'message' => 'Login successful',
                'user' => $user_without_password,
                'token' => $token
            ]);
        } else {
            http_response_code(405);
            echo json_encode(['message' => 'Method not allowed']);
        }
        break;
        
    case 'api/auth/me':
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            // Get authorization header
            $headers = getallheaders();
            $auth_header = isset($headers['Authorization']) ? $headers['Authorization'] : '';
            
            if (!$auth_header || !preg_match('/Bearer\s+(.*)$/i', $auth_header, $matches)) {
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'message' => 'Authentication required'
                ]);
                exit;
            }
            
            $token = $matches[1];
            $payload = verify_token($token);
            
            if (!$payload) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid or expired token'
                ]);
                exit;
            }
            
            // Find user by ID
            $users = read_users();
            $user = null;
            foreach ($users as $u) {
                if ($u['id'] === $payload['id']) {
                    $user = $u;
                    break;
                }
            }
            
            if (!$user) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'User not found'
                ]);
                exit;
            }
            
            // Return user data (exclude password and salt)
            $user_without_password = $user;
            unset($user_without_password['password']);
            unset($user_without_password['salt']);
            
            echo json_encode([
                'success' => true,
                'user' => $user_without_password
            ]);
        } else {
            http_response_code(405);
            echo json_encode(['message' => 'Method not allowed']);
        }
        break;
        
    default:
        http_response_code(404);
        echo json_encode(['message' => 'Endpoint not found']);
        break;
} 