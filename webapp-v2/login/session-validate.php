<?php
// =====================================================
// Validate existing session token
// GET: ?token=xxx or POST: {token: xxx}
// Returns: {valid: true/false, user}
// =====================================================

require_once __DIR__ . '/auth-helpers.php';
setJsonHeaders();

$token = isset($_GET['token']) ? trim($_GET['token']) : '';

if (empty($token) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input && isset($input['token'])) {
        $token = trim($input['token']);
    }
    if (empty($token) && isset($_POST['token'])) {
        $token = trim($_POST['token']);
    }
}

if (empty($token)) {
    jsonResponse(['valid' => false, 'message' => 'Token is required']);
}

$session = validateSession($database, $token);

if (!$session) {
    jsonResponse(['valid' => false]);
}

jsonResponse([
    'valid' => true,
    'user' => [
        'id' => $session['telegram_id'],
        'username' => $session['telegram_username'],
        'first_name' => $session['telegram_first_name'],
        'last_name' => $session['telegram_last_name'],
    ]
]);

