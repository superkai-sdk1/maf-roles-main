<?php
// =====================================================
// Admin Notifications — CRUD for notifications/news
//
// GET  ?token=xxx                — list all notifications
// GET  ?token=xxx&id=XXX         — get single notification
// POST body:{data:{...}}         — create notification
// POST body:{id:XXX, data:{...}} — update notification
// DELETE ?token=xxx&id=XXX       — delete notification
// =====================================================

ini_set('display_errors', 0);
error_reporting(E_ALL);

register_shutdown_function(function() {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(500);
        }
        echo json_encode(['error' => 'Fatal: ' . $err['message']], JSON_UNESCAPED_UNICODE);
    }
});

require_once __DIR__ . '/admin-config.php';
require_once __DIR__ . '/../../login/auth-helpers.php';
setJsonHeaders();

$rawBody = file_get_contents('php://input');
$parsedBody = json_decode($rawBody, true);

$token = isset($_GET['token']) ? trim($_GET['token']) : '';
if (empty($token) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($parsedBody && isset($parsedBody['token'])) $token = trim($parsedBody['token']);
}
if (empty($token) && $_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $token = isset($_GET['token']) ? trim($_GET['token']) : '';
}
if (empty($token)) jsonError('Token required', 401);

$session = validateSession($database, $token);
if (!$session || !in_array((int)$session['telegram_id'], ADMIN_TELEGRAM_IDS)) {
    jsonError('Access denied', 403);
}

$NOTIFICATIONS_FILE = __DIR__ . '/../../api/notifications.json';

function loadNotifications($file) {
    if (!file_exists($file)) return [];
    $data = json_decode(file_get_contents($file), true);
    return is_array($data) ? $data : [];
}

function saveNotifications($file, $data) {
    file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

function generateId() {
    return bin2hex(random_bytes(8));
}

// ===== GET =====
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $notifications = loadNotifications($NOTIFICATIONS_FILE);

    if (isset($_GET['id'])) {
        $id = trim($_GET['id']);
        foreach ($notifications as $n) {
            if ($n['id'] === $id) {
                jsonResponse($n);
            }
        }
        jsonError('Notification not found', 404);
    }

    usort($notifications, function($a, $b) {
        $pa = !empty($a['pinned']) ? 1 : 0;
        $pb = !empty($b['pinned']) ? 1 : 0;
        if ($pa !== $pb) return $pb - $pa;
        return strcmp($b['created_at'] ?? '', $a['created_at'] ?? '');
    });

    jsonResponse([
        'notifications' => $notifications,
        'total' => count($notifications),
    ]);
}

// ===== POST (Create / Update) =====
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = $parsedBody;
    if (!$input || !isset($input['data'])) jsonError('data required');

    $data = $input['data'];
    $notifications = loadNotifications($NOTIFICATIONS_FILE);
    $now = date('c');

    if (isset($input['id']) && !empty($input['id'])) {
        $id = $input['id'];
        $found = false;
        foreach ($notifications as &$n) {
            if ($n['id'] === $id) {
                $n = array_merge($n, $data);
                $n['id'] = $id;
                $n['updated_at'] = $now;
                $found = true;
                break;
            }
        }
        unset($n);
        if (!$found) jsonError('Notification not found', 404);
        saveNotifications($NOTIFICATIONS_FILE, $notifications);
        jsonResponse(['ok' => true, 'message' => 'Уведомление обновлено', 'id' => $id]);
    } else {
        $notification = [
            'id' => generateId(),
            'type' => $data['type'] ?? 'news',
            'icon' => $data['icon'] ?? '📢',
            'title' => $data['title'] ?? '',
            'description' => $data['description'] ?? '',
            'accentColor' => $data['accentColor'] ?? 'var(--accent-color)',
            'published' => $data['published'] ?? true,
            'pinned' => $data['pinned'] ?? false,
            'link' => $data['link'] ?? null,
            'created_at' => $now,
            'updated_at' => $now,
            'expires_at' => $data['expires_at'] ?? null,
            'author' => $session['telegram_first_name'] ?? 'Admin',
        ];
        array_unshift($notifications, $notification);
        saveNotifications($NOTIFICATIONS_FILE, $notifications);
        jsonResponse(['ok' => true, 'message' => 'Уведомление создано', 'id' => $notification['id']]);
    }
}

// ===== DELETE =====
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $id = isset($_GET['id']) ? trim($_GET['id']) : '';
    if (empty($id)) jsonError('id required');

    $notifications = loadNotifications($NOTIFICATIONS_FILE);
    $filtered = array_values(array_filter($notifications, function($n) use ($id) {
        return $n['id'] !== $id;
    }));

    if (count($filtered) === count($notifications)) {
        jsonError('Notification not found', 404);
    }

    saveNotifications($NOTIFICATIONS_FILE, $filtered);
    jsonResponse(['ok' => true, 'message' => 'Уведомление удалено']);
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
