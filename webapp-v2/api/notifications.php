<?php
// =====================================================
// Public Notifications API — read published notifications
// GET — returns all published, non-expired notifications
// =====================================================

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$NOTIFICATIONS_FILE = __DIR__ . '/notifications.json';

if (!file_exists($NOTIFICATIONS_FILE)) {
    echo json_encode(['notifications' => [], 'total' => 0]);
    exit;
}

$all = json_decode(file_get_contents($NOTIFICATIONS_FILE), true);
if (!is_array($all)) $all = [];

$now = date('c');
$published = array_values(array_filter($all, function($n) use ($now) {
    if (empty($n['published'])) return false;
    if (!empty($n['expires_at']) && $n['expires_at'] < $now) return false;
    return true;
}));

usort($published, function($a, $b) {
    $pa = !empty($a['pinned']) ? 1 : 0;
    $pb = !empty($b['pinned']) ? 1 : 0;
    if ($pa !== $pb) return $pb - $pa;
    return strcmp($b['created_at'] ?? '', $a['created_at'] ?? '');
});

echo json_encode([
    'notifications' => $published,
    'total' => count($published),
], JSON_UNESCAPED_UNICODE);
