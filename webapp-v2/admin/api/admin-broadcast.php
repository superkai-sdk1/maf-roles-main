<?php
require_once __DIR__ . '/admin-config.php';
require_once __DIR__ . '/../../login/auth-helpers.php';
require_once __DIR__ . '/../../login/auth-config.php';
setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('POST required', 405);

$input = json_decode(file_get_contents('php://input'), true);
$authToken = trim($input['token'] ?? '');
if (empty($authToken)) jsonError('Token required', 401);

$session = validateSession($database, $authToken);
if (!$session || !in_array((int)$session['telegram_id'], ADMIN_TELEGRAM_IDS)) jsonError('Access denied', 403);

$text = trim($input['text'] ?? '');
if (empty($text)) jsonError('text required');

$users = $database->select('users', ['telegram_id'], [
    'telegram_id[>]' => 0,
]);

$sent = 0;
$failed = 0;

foreach ($users as $user) {
    $tgId = (int)$user['telegram_id'];
    if ($tgId <= 0) continue;

    $ch = curl_init("https://api.telegram.org/bot" . BOT_TOKEN . "/sendMessage");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'chat_id' => $tgId,
            'text' => $text,
            'parse_mode' => 'HTML',
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code === 200) $sent++;
    else $failed++;

    usleep(35000);
}

jsonResponse([
    'ok' => true,
    'sent' => $sent,
    'failed' => $failed,
    'total' => count($users),
]);
