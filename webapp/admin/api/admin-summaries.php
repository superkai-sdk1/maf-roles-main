<?php
// =====================================================
// Admin Summaries - управление итогами/отчётами
// GET    ?token=xxx                    — список всех итогов
// GET    ?token=xxx&id=xxx             — получить конкретный итог
// POST   ?token=xxx  body:{id, data}  — обновить итог
// DELETE ?token=xxx&id=xxx             — удалить итог
// =====================================================

require_once __DIR__ . '/admin-config.php';
require_once __DIR__ . '/../../login/auth-helpers.php';
setJsonHeaders();

// Читаем тело запроса один раз
$rawBody = file_get_contents('php://input');
$parsedBody = json_decode($rawBody, true);

$token = isset($_GET['token']) ? trim($_GET['token']) : '';
if (empty($token) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($parsedBody && isset($parsedBody['token'])) $token = trim($parsedBody['token']);
}
if (empty($token)) jsonError('Token required', 401);

$session = validateSession($database, $token);
if (!$session || !in_array((int)$session['telegram_id'], ADMIN_TELEGRAM_IDS)) {
    jsonError('Access denied', 403);
}

$summariesDir = __DIR__ . '/../../api/summaries';

// ===== DELETE =====
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $id = isset($_GET['id']) ? preg_replace('/[^a-f0-9]/', '', $_GET['id']) : '';
    if (empty($id)) jsonError('ID required');

    $filePath = $summariesDir . '/' . $id . '.json';
    if (!file_exists($filePath)) jsonError('Not found', 404);

    unlink($filePath);
    jsonResponse(['ok' => true]);
}

// ===== POST — обновить итог =====
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = $parsedBody;
    if (!$input) jsonError('Invalid JSON body');

    $id = isset($input['id']) ? preg_replace('/[^a-f0-9]/', '', $input['id']) : '';
    $data = isset($input['data']) ? $input['data'] : null;

    if (empty($id) || !is_array($data)) jsonError('id and data required');

    $filePath = $summariesDir . '/' . $id . '.json';
    if (!file_exists($filePath)) jsonError('Not found', 404);

    $existing = json_decode(file_get_contents($filePath), true);
    if (!$existing) jsonError('Corrupted file', 500);

    // Мерж данных
    foreach ($data as $k => $v) {
        $existing[$k] = $v;
    }
    $existing['adminModifiedAt'] = date('c');

    $written = file_put_contents($filePath, json_encode($existing, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    if ($written === false) jsonError('Write failed', 500);

    jsonResponse(['ok' => true]);
}

// ===== GET с id — конкретный итог =====
if (isset($_GET['id'])) {
    $id = preg_replace('/[^a-f0-9]/', '', $_GET['id']);
    $filePath = $summariesDir . '/' . $id . '.json';
    if (!file_exists($filePath)) jsonError('Not found', 404);

    $content = json_decode(file_get_contents($filePath), true);
    if (!$content) jsonError('Corrupted file', 500);

    jsonResponse($content);
}

// ===== GET — список всех итогов =====
if (!is_dir($summariesDir)) {
    jsonResponse(['items' => [], 'total' => 0]);
}

$files = glob($summariesDir . '/*.json');
$items = [];

foreach ($files as $file) {
    $content = json_decode(file_get_contents($file), true);
    if (!$content) continue;

    $items[] = [
        'id' => isset($content['id']) ? $content['id'] : basename($file, '.json'),
        'tournamentName' => isset($content['tournamentName']) ? $content['tournamentName'] : '—',
        'playersCount' => isset($content['data']) ? count($content['data']) : 0,
        'gamesCount' => isset($content['games']) ? count($content['games']) : 0,
        'createdAt' => isset($content['createdAt']) ? $content['createdAt'] : null,
        'savedAt' => isset($content['savedAt']) ? $content['savedAt'] : null,
    ];
}

// Сортировка по дате создания (новые первые)
usort($items, function($a, $b) {
    return strcmp($b['savedAt'] ?? '', $a['savedAt'] ?? '');
});

jsonResponse([
    'items' => $items,
    'total' => count($items),
]);

